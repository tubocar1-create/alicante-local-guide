/**
 * Vista de visitantes — server functions admin.
 *
 * `listVisitors` devuelve UNA fila por SESIÓN de pestaña (entrada → salida).
 * Una sesión se identifica por `metadata.session_id` que el cliente genera
 * y guarda en sessionStorage (vive lo que vive la pestaña). NO hay límite
 * de duración: una sesión puede durar 10 segundos o varias horas.
 *
 * Para eventos legacy sin session_id se hace fallback a identidad + día.
 *
 * Agregados estilo Lovable (páginas, países, fuentes, dispositivos)
 * calculados sobre VISITANTES ÚNICOS, EXCLUYENDO al usuario
 * "Leopoldo Cadavid" para que las métricas reflejen tráfico real.
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

const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min → nueva sesión

// ---------- LISTA (UNA FILA POR SESIÓN) ----------

const ListInput = z.object({
  limit: z.number().int().min(1).max(5000).optional().default(500),
  search: z.string().max(120).optional().default(""),
  days: z.number().int().min(1).max(90).optional().default(30),
});

export type VisitRow = {
  session_id: string;
  identity_id: string;        // "u:..." | "v:..."
  kind: "user" | "visitor";
  label: string;
  email: string | null;
  visit_index: number;        // 1..total_visits para esa identidad
  total_visits: number;
  start_at: string;
  end_at: string;
  duration_ms: number;
  events_count: number;
  pages_count: number;
  country: string | null;
  city: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  source: string | null;
};

export type AggregateRow = { key: string; visitors: number };

const LEOPOLDO_USER_ID = "5cf72db3-6a97-4078-9039-8a3cbf654060";

function sourceFromRef(referrer: string | null, utm: Record<string, string> | null): string {
  if (utm && utm.utm_source) return utm.utm_source;
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

export const listVisitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListInput.parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    const since = new Date(Date.now() - data.days * 86400 * 1000).toISOString();
    const CHUNK = 1000;
    const MAX_ROWS = 30000;
    const rows: Array<{
      id: string; type: string; user_id: string | null; visitor_id: string | null;
      occurred_at: string; country: string | null; city: string | null;
      browser: string | null; os: string | null; device: string | null; path: string | null;
      referrer: string | null; utm: Record<string, string> | null;
      metadata: Record<string, unknown> | null;
    }> = [];
    for (let from = 0; from < MAX_ROWS; from += CHUNK) {
      const { data: chunk, error } = await supabaseAdmin
        .from("interaction_events")
        .select(
          "id,type,user_id,visitor_id,occurred_at,country,city,browser,os,device,path,referrer,utm,metadata",
        )
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: true })
        .range(from, from + CHUNK - 1);
      if (error) throw new Error(error.message);
      if (!chunk || chunk.length === 0) break;
      rows.push(...(chunk as typeof rows));
      if (chunk.length < CHUNK) break;
    }

    // Perfiles
    const userIds = Array.from(
      new Set(rows.map((r) => r.user_id).filter(Boolean) as string[]),
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

    // Identidad de cada evento
    const identityOfRow = (r: typeof rows[number]) =>
      r.user_id ? `u:${r.user_id}` : r.visitor_id ? `v:${r.visitor_id}` : null;

    // session_id real (sessionStorage del navegador) o fallback legacy
    // identidad+día para eventos antiguos sin session_id.
    const sessionKeyOf = (r: typeof rows[number]): string | null => {
      const ident = identityOfRow(r);
      if (!ident) return null;
      const sid =
        r.metadata && typeof (r.metadata as Record<string, unknown>).session_id === "string"
          ? ((r.metadata as Record<string, unknown>).session_id as string)
          : null;
      if (sid) return `${ident}#${sid}`;
      // Legacy fallback: identidad + día UTC
      const day = r.occurred_at.slice(0, 10);
      return `${ident}#legacy:${day}`;
    };

    // Agrupar eventos por sesión
    const bySession = new Map<string, typeof rows>();
    for (const r of rows) {
      const key = sessionKeyOf(r);
      if (!key) continue;
      const arr = bySession.get(key) ?? [];
      arr.push(r);
      bySession.set(key, arr);
    }

    // Agrupar sesiones por identidad para calcular visit_index/total_visits
    const sessionsByIdentity = new Map<string, string[]>();
    bySession.forEach((evs, key) => {
      const ident = identityOfRow(evs[0]);
      if (!ident) return;
      const arr = sessionsByIdentity.get(ident) ?? [];
      arr.push(key);
      sessionsByIdentity.set(ident, arr);
    });
    // Ordenar las sesiones de cada identidad por hora de inicio
    sessionsByIdentity.forEach((keys) => {
      keys.sort((a, b) => {
        const ea = bySession.get(a)![0].occurred_at;
        const eb = bySession.get(b)![0].occurred_at;
        return ea < eb ? -1 : 1;
      });
    });

    const visits: VisitRow[] = [];
    bySession.forEach((seg, key) => {
      const ident = identityOfRow(seg[0])!;
      const isUser = ident.startsWith("u:");
      const refId = ident.slice(2);
      const profile = isUser ? profileMap.get(refId) : undefined;
      const label =
        profile?.name ??
        profile?.email ??
        (isUser ? `Usuario · ${refId.slice(0, 8)}` : `Anónimo · ${refId.slice(0, 8)}`);

      const start = seg[0];
      const last = seg[seg.length - 1];
      const startT = new Date(start.occurred_at).getTime();
      const endT = new Date(last.occurred_at).getTime();
      const firstWithGeo = seg.find((e) => e.country || e.city) ?? start;
      const firstWithUa = seg.find((e) => e.browser || e.os || e.device) ?? start;
      const firstWithRef = seg.find((e) => e.referrer || (e.utm && Object.keys(e.utm).length > 0)) ?? start;
      const pages = new Set(seg.map((e) => e.path).filter(Boolean) as string[]).size;
      const idxList = sessionsByIdentity.get(ident) ?? [key];
      const visit_index = idxList.indexOf(key) + 1;
      const total_visits = idxList.length;

      visits.push({
        session_id: key,
        identity_id: ident,
        kind: isUser ? "user" : "visitor",
        label,
        email: profile?.email ?? null,
        visit_index,
        total_visits,
        start_at: start.occurred_at,
        end_at: last.occurred_at,
        duration_ms: endT - startT,
        events_count: seg.length,
        pages_count: pages,
        country: firstWithGeo.country,
        city: firstWithGeo.city,
        browser: firstWithUa.browser,
        os: firstWithUa.os,
        device: firstWithUa.device,
        source: sourceFromRef(firstWithRef.referrer, firstWithRef.utm),
      });
    });

    const filter = data.search.trim().toLowerCase();
    const filtered = filter
      ? visits.filter((s) =>
          [s.label, s.email, s.country, s.city, s.identity_id, s.source]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(filter),
        )
      : visits;

    filtered.sort((a, b) => (a.start_at < b.start_at ? 1 : -1));

    // ---------- AGREGADOS (excluyendo Leopoldo Cadavid) ----------
    const cleanRows = rows.filter((r) => r.user_id !== LEOPOLDO_USER_ID);
    const identityOf = (r: { user_id: string | null; visitor_id: string | null }) =>
      r.user_id ? `u:${r.user_id}` : r.visitor_id ? `v:${r.visitor_id}` : null;

    const uniqueBy = (field: (r: typeof cleanRows[number]) => string | null): AggregateRow[] => {
      const map = new Map<string, Set<string>>();
      for (const r of cleanRows) {
        const k = field(r);
        const id = identityOf(r);
        if (!k || !id) continue;
        const set = map.get(k) ?? new Set<string>();
        set.add(id);
        map.set(k, set);
      }
      return Array.from(map.entries())
        .map(([key, set]) => ({ key, visitors: set.size }))
        .sort((a, b) => b.visitors - a.visitors);
    };

    const pages = uniqueBy((r) => r.path).slice(0, 15);
    const countries = uniqueBy((r) => r.country).slice(0, 15);
    const sources = uniqueBy((r) => sourceFromRef(r.referrer, r.utm)).slice(0, 15);
    const devices = uniqueBy((r) => r.device).slice(0, 10);

    const totalUniqueVisitors = new Set(
      cleanRows.map(identityOf).filter(Boolean) as string[],
    ).size;
    const totalSessions = visits.filter((v) => v.identity_id !== `u:${LEOPOLDO_USER_ID}`).length;

    return {
      visits: filtered.slice(0, data.limit),
      total: filtered.length,
      aggregates: {
        pages,
        countries,
        sources,
        devices,
        total_unique_visitors: totalUniqueVisitors,
        total_sessions: totalSessions,
        total_events: cleanRows.length,
      },
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
