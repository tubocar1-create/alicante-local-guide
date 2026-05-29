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

// ---------- LISTA (UNA FILA POR SESIÓN) ----------

const ListInput = z.object({
  limit: z.number().int().min(1).max(2000).optional().default(300),
  search: z.string().max(120).optional().default(""),
});

type SessionRow = {
  session_id: string;       // identidad + start
  identity_id: string;      // "u:..." | "v:..."
  kind: "user" | "visitor";
  label: string;
  email: string | null;
  visit_index: number;      // 1..total_visits (cronológico)
  total_visits: number;
  start_at: string;
  end_at: string;
  duration_ms: number;
  events: number;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  top_path: string | null;
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
        "id,type,user_id,visitor_id,occurred_at,country,city,browser,os,device,path,referrer,utm",
      )
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: true })
      .limit(10000);
    if (error) throw new Error(error.message);

    // Agrupar por identidad
    type EvLite = {
      ts: number;
      occurred_at: string;
      path: string | null;
      country: string | null;
      city: string | null;
      browser: string | null;
      os: string | null;
      device: string | null;
    };
    const byIdentity = new Map<string, { kind: "user" | "visitor"; user_id: string | null; visitor_id: string | null; events: EvLite[] }>();
    (rows ?? []).forEach((r) => {
      const key = r.user_id ? `u:${r.user_id}` : r.visitor_id ? `v:${r.visitor_id}` : null;
      if (!key) return;
      let bucket = byIdentity.get(key);
      if (!bucket) {
        bucket = {
          kind: r.user_id ? "user" : "visitor",
          user_id: r.user_id,
          visitor_id: r.visitor_id,
          events: [],
        };
        byIdentity.set(key, bucket);
      }
      bucket.events.push({
        ts: new Date(r.occurred_at).getTime(),
        occurred_at: r.occurred_at,
        path: r.path,
        country: r.country,
        city: r.city,
        browser: r.browser,
        os: r.os,
        device: r.device,
      });
    });

    // Resolver emails/nombres
    const userIds = Array.from(byIdentity.values())
      .filter((a) => a.user_id)
      .map((a) => a.user_id as string);
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

    // Partir en sesiones por identidad
    const sessions: SessionRow[] = [];
    byIdentity.forEach((bucket, identity_id) => {
      const evs = bucket.events.slice().sort((a, b) => a.ts - b.ts);
      const sliced: EvLite[][] = [];
      let current: EvLite[] = [];
      let last = 0;
      for (const e of evs) {
        if (current.length === 0 || e.ts - last <= SESSION_GAP_MS) {
          current.push(e);
        } else {
          sliced.push(current);
          current = [e];
        }
        last = e.ts;
      }
      if (current.length > 0) sliced.push(current);

      const total = sliced.length;
      const profile = bucket.user_id ? profileMap.get(bucket.user_id) : undefined;
      const label =
        profile?.name ??
        profile?.email ??
        (bucket.visitor_id ? `Anónimo · ${bucket.visitor_id.slice(0, 8)}` : "Anónimo");
      const email = profile?.email ?? null;

      sliced.forEach((seg, idx) => {
        const first = seg[0];
        const lastEv = seg[seg.length - 1];
        const pathCounts: Record<string, number> = {};
        let country: string | null = null;
        let city: string | null = null;
        let browser: string | null = null;
        let os: string | null = null;
        let device: string | null = null;
        for (const e of seg) {
          if (e.path) pathCounts[e.path] = (pathCounts[e.path] ?? 0) + 1;
          country ??= e.country;
          city ??= e.city;
          browser ??= e.browser;
          os ??= e.os;
          device ??= e.device;
        }
        const top_path =
          Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        sessions.push({
          session_id: `${identity_id}@${first.ts}`,
          identity_id,
          kind: bucket.kind,
          label,
          email,
          visit_index: idx + 1,
          total_visits: total,
          start_at: first.occurred_at,
          end_at: lastEv.occurred_at,
          duration_ms: lastEv.ts - first.ts,
          events: seg.length,
          country,
          city,
          browser,
          os,
          device,
          top_path,
        });
      });
    });

    // Resumen por día/semana/mes (basado en start_at)
    const now = Date.now();
    const dayMs = 86400 * 1000;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const startTodayMs = startToday.getTime();
    const startWeekMs = startTodayMs - 6 * dayMs; // últimos 7 días
    const startMonthMs = now - 30 * dayMs;        // últimos 30 días

    function bucketStats(fromMs: number) {
      const segs = sessions.filter((s) => new Date(s.start_at).getTime() >= fromMs);
      const idents = new Set(segs.map((s) => s.identity_id));
      const users = new Set(segs.filter((s) => s.kind === "user").map((s) => s.identity_id));
      const guests = new Set(segs.filter((s) => s.kind === "visitor").map((s) => s.identity_id));
      return {
        sessions: segs.length,
        unique_identities: idents.size,
        registered_users: users.size,
        guests: guests.size,
      };
    }

    const summary = {
      today: bucketStats(startTodayMs),
      week: bucketStats(startWeekMs),
      month: bucketStats(startMonthMs),
    };

    const filter = data.search.trim().toLowerCase();
    const filtered = filter
      ? sessions.filter((s) =>
          [s.label, s.email, s.country, s.city, s.identity_id]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(filter),
        )
      : sessions;

    filtered.sort((a, b) => (a.start_at < b.start_at ? 1 : -1));

    return {
      sessions: filtered.slice(0, data.limit),
      total: filtered.length,
      summary,
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
