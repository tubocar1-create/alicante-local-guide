/**
 * Vista de visitantes — server functions admin
 *
 * Cada sesión (gap > 30 min de inactividad) se cuenta y se devuelve como
 * fila individual: hora de entrada, hora de salida, duración real y nº
 * de eventos. Se mantiene `total_visits` por identidad para saber cuántas
 * veces ha entrado ese visitante/usuario.
 *
 * Protegidas con `requireSupabaseAuth` + check de rol admin.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

type RawEvent = {
  id: string;
  type: string;
  user_id: string | null;
  visitor_id: string | null;
  occurred_at: string;
  path: string | null;
  source: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  referrer: string | null;
  utm: Record<string, string> | null;
  ip_trunc: string | null;
  metadata: Json | null;
};

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min inactividad → nueva sesión

// ---------- LISTA (UNA FILA POR EVENTO/VISITA, SIN AGRUPAR) ----------

const ListInput = z.object({
  limit: z.number().int().min(1).max(5000).optional().default(500),
  search: z.string().max(120).optional().default(""),
});

type VisitRow = {
  event_id: string;
  identity_id: string;        // "u:..." | "v:..."
  kind: "user" | "visitor";
  label: string;
  email: string | null;
  visit_index: number;        // 1..total_visits cronológico de esa identidad
  total_visits: number;       // total acumulado de visitas de esa identidad
  occurred_at: string;
  gap_ms: number | null;      // ms desde la visita anterior de esa identidad
  type: string;
  path: string | null;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
};

export const listVisitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListInput.parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("interaction_events")
      .select(
        "id,type,user_id,visitor_id,occurred_at,country,city,browser,os,device,path",
      )
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true })
      .limit(10000);
    if (error) throw new Error(error.message);

    // Resolver perfiles
    const userIds = Array.from(
      new Set((rows ?? []).map((r) => r.user_id).filter(Boolean) as string[]),
    );
    const profileMap = new Map<string, { email: string | null; name: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id,email,display_name")
        .in("id", userIds);
      (profiles ?? []).forEach((p: { id: string; email: string | null; display_name: string | null }) =>
        profileMap.set(p.id, { email: p.email, name: p.display_name }),
      );
    }

    // Contador por identidad
    const counters = new Map<string, number>();
    const totals = new Map<string, number>();
    const lastTs = new Map<string, number>();

    // Calcular totales primero
    (rows ?? []).forEach((r) => {
      const key = r.user_id ? `u:${r.user_id}` : r.visitor_id ? `v:${r.visitor_id}` : null;
      if (!key) return;
      totals.set(key, (totals.get(key) ?? 0) + 1);
    });

    const visits: VisitRow[] = [];
    (rows ?? []).forEach((r) => {
      const key = r.user_id ? `u:${r.user_id}` : r.visitor_id ? `v:${r.visitor_id}` : null;
      if (!key) return;
      const idx = (counters.get(key) ?? 0) + 1;
      counters.set(key, idx);
      const ts = new Date(r.occurred_at).getTime();
      const prev = lastTs.get(key);
      lastTs.set(key, ts);

      const profile = r.user_id ? profileMap.get(r.user_id) : undefined;
      const label =
        profile?.name ??
        profile?.email ??
        (r.visitor_id ? `Anónimo · ${r.visitor_id.slice(0, 8)}` : "Anónimo");

      visits.push({
        event_id: r.id,
        identity_id: key,
        kind: r.user_id ? "user" : "visitor",
        label,
        email: profile?.email ?? null,
        visit_index: idx,
        total_visits: totals.get(key) ?? idx,
        occurred_at: r.occurred_at,
        gap_ms: prev ? ts - prev : null,
        type: r.type,
        path: r.path,
        country: r.country,
        city: r.city,
        browser: r.browser,
        os: r.os,
        device: r.device,
      });
    });

    const filter = data.search.trim().toLowerCase();
    const filtered = filter
      ? visits.filter((s) =>
          [s.label, s.email, s.country, s.city, s.identity_id, s.path, s.type]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(filter),
        )
      : visits;

    filtered.sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1));

    return {
      visits: filtered.slice(0, data.limit),
      total: filtered.length,
    };
  });


// ---------- DETALLE ----------

const DetailInput = z.object({ id: z.string().min(3).max(80) });

export const getVisitorDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => DetailInput.parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const [kind, ref] = data.id.split(":") as ["u" | "v", string];
    if (!ref || (kind !== "u" && kind !== "v")) throw new Error("invalid id");

    const col = kind === "u" ? "user_id" : "visitor_id";
    const { data: rows, error } = await supabaseAdmin
      .from("interaction_events")
      .select("*")
      .eq(col, ref)
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const events = (rows ?? []) as RawEvent[];
    if (events.length === 0) {
      return { header: null, prefs: null, acquisition: null, events: [], sessions: [] };
    }

    const latestWithGeo = events.find((e) => e.country || e.city) ?? events[0];
    const latestWithUa = events.find((e) => e.browser || e.os) ?? events[0];
    const first = events[events.length - 1];

    let label = kind === "u" ? null : `Anónimo · ${ref.slice(0, 8)}`;
    let email: string | null = null;
    if (kind === "u") {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email,display_name")
        .eq("id", ref)
        .maybeSingle();
      email = profile?.email ?? null;
      label = profile?.display_name ?? profile?.email ?? `Usuario · ${ref.slice(0, 8)}`;
    }

    // Sesiones cronológicas
    const asc = events.slice().reverse();
    const sessions: { index: number; start_at: string; end_at: string; duration_ms: number; events: number }[] = [];
    let segStart = asc[0];
    let segLast = asc[0];
    let segCount = 1;
    for (let i = 1; i < asc.length; i++) {
      const t = new Date(asc[i].occurred_at).getTime();
      const prev = new Date(segLast.occurred_at).getTime();
      if (t - prev > SESSION_GAP_MS) {
        sessions.push({
          index: sessions.length + 1,
          start_at: segStart.occurred_at,
          end_at: segLast.occurred_at,
          duration_ms: prev - new Date(segStart.occurred_at).getTime(),
          events: segCount,
        });
        segStart = asc[i];
        segCount = 1;
      } else {
        segCount++;
      }
      segLast = asc[i];
    }
    sessions.push({
      index: sessions.length + 1,
      start_at: segStart.occurred_at,
      end_at: segLast.occurred_at,
      duration_ms: new Date(segLast.occurred_at).getTime() - new Date(segStart.occurred_at).getTime(),
      events: segCount,
    });

    const header = {
      id: data.id,
      kind,
      label,
      email,
      first_seen: first.occurred_at,
      last_seen: events[0].occurred_at,
      country: latestWithGeo.country,
      city: latestWithGeo.city,
      region: latestWithGeo.region,
      browser: latestWithUa.browser,
      os: latestWithUa.os,
      device: latestWithUa.device,
      ip_trunc: latestWithGeo.ip_trunc,
      total_events: events.length,
      sessions_estimate: sessions.length,
    };

    const sectionCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const hourBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    events.forEach((e) => {
      if (e.path) {
        const seg = "/" + (e.path.split("/").filter(Boolean)[0] ?? "");
        sectionCounts[seg] = (sectionCounts[seg] ?? 0) + 1;
      }
      typeCounts[e.type] = (typeCounts[e.type] ?? 0) + 1;
      const h = new Date(e.occurred_at).getHours();
      if (h >= 6 && h < 12) hourBuckets.morning++;
      else if (h >= 12 && h < 18) hourBuckets.afternoon++;
      else if (h >= 18 && h < 22) hourBuckets.evening++;
      else hourBuckets.night++;
    });

    const prefs = {
      top_sections: topN(sectionCounts, 5),
      top_event_types: topN(typeCounts, 5),
      schedule: hourBuckets,
    };

    const firstAcq =
      events
        .slice()
        .reverse()
        .find((e) => e.referrer || (e.utm && Object.keys(e.utm).length > 0)) ??
      first;
    const acquisition = {
      first_seen: first.occurred_at,
      referrer: firstAcq.referrer,
      utm: firstAcq.utm,
      first_path: first.path,
    };

    const timeline = events.slice(0, 100).map((e) => ({
      id: e.id,
      type: e.type,
      occurred_at: e.occurred_at,
      path: e.path,
      source: e.source,
      metadata: e.metadata,
    }));

    return { header, prefs, acquisition, events: timeline, sessions: sessions.slice().reverse() };
  });

function topN(counts: Record<string, number>, n: number) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({ key, value }));
}
