/**
 * Vista de visitantes — server functions admin
 *
 * Agrupa `interaction_events` por (user_id, visitor_id) para mostrar:
 *  - Lista de usuarios + visitantes anónimos con país/ciudad/eventos/última visita
 *  - Detalle por id: cabecera, preferencias inferidas, adquisición y timeline
 *
 * Protegidas con `requireSupabaseAuth` + check de rol admin. Usan
 * `supabaseAdmin` para leer la tabla bypassando RLS y poder agregar.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: ReturnType<typeof requireSupabaseAuth> extends never ? never : any, userId: string) {
  // supabase aquí es el cliente autenticado del contexto
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("forbidden");
}

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
  metadata: Record<string, unknown> | null;
};

// ---------- LISTA ----------

const ListInput = z.object({
  limit: z.number().int().min(1).max(500).optional().default(100),
  search: z.string().max(120).optional().default(""),
});

export const listVisitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ListInput.parse(i))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);

    // Traemos los últimos 30 días, hasta 5000 eventos, y agregamos en memoria.
    const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("interaction_events")
      .select(
        "id,type,user_id,visitor_id,occurred_at,country,city,browser,os,device,path,referrer,utm",
      )
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    type Agg = {
      id: string; // "u:<uuid>" | "v:<vid>"
      kind: "user" | "visitor";
      user_id: string | null;
      visitor_id: string | null;
      events: number;
      first_seen: string;
      last_seen: string;
      country: string | null;
      city: string | null;
      browser: string | null;
      os: string | null;
      device: string | null;
      top_paths: Record<string, number>;
    };

    const map = new Map<string, Agg>();
    (rows ?? []).forEach((r) => {
      const key = r.user_id ? `u:${r.user_id}` : r.visitor_id ? `v:${r.visitor_id}` : null;
      if (!key) return;
      let a = map.get(key);
      if (!a) {
        a = {
          id: key,
          kind: r.user_id ? "user" : "visitor",
          user_id: r.user_id,
          visitor_id: r.visitor_id,
          events: 0,
          first_seen: r.occurred_at,
          last_seen: r.occurred_at,
          country: r.country,
          city: r.city,
          browser: r.browser,
          os: r.os,
          device: r.device,
          top_paths: {},
        };
        map.set(key, a);
      }
      a.events += 1;
      if (r.occurred_at > a.last_seen) a.last_seen = r.occurred_at;
      if (r.occurred_at < a.first_seen) a.first_seen = r.occurred_at;
      if (!a.country && r.country) a.country = r.country;
      if (!a.city && r.city) a.city = r.city;
      if (!a.browser && r.browser) a.browser = r.browser;
      if (!a.os && r.os) a.os = r.os;
      if (!a.device && r.device) a.device = r.device;
      if (r.path) a.top_paths[r.path] = (a.top_paths[r.path] ?? 0) + 1;
    });

    // Resolver emails de los usuarios autenticados
    const userIds = Array.from(map.values())
      .filter((a) => a.user_id)
      .map((a) => a.user_id as string);
    const emails = new Map<string, { email: string | null; name: string | null }>();
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id,email,display_name")
        .in("id", userIds);
      (profiles ?? []).forEach((p: { id: string; email: string | null; display_name: string | null }) =>
        emails.set(p.id, { email: p.email, name: p.display_name }),
      );
    }

    const all = Array.from(map.values()).map((a) => {
      const profile = a.user_id ? emails.get(a.user_id) : undefined;
      const topPath =
        Object.entries(a.top_paths).sort((x, y) => y[1] - x[1])[0]?.[0] ?? null;
      return {
        id: a.id,
        kind: a.kind,
        label:
          profile?.name ??
          profile?.email ??
          (a.visitor_id ? `Anónimo · ${a.visitor_id.slice(0, 8)}` : "Anónimo"),
        email: profile?.email ?? null,
        events: a.events,
        first_seen: a.first_seen,
        last_seen: a.last_seen,
        country: a.country,
        city: a.city,
        browser: a.browser,
        device: a.device,
        os: a.os,
        top_path: topPath,
      };
    });

    const filter = data.search.trim().toLowerCase();
    const filtered = filter
      ? all.filter((x) =>
          [x.label, x.email, x.country, x.city, x.id]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(filter),
        )
      : all;

    filtered.sort((a, b) => (a.last_seen < b.last_seen ? 1 : -1));
    return { visitors: filtered.slice(0, data.limit), total: filtered.length };
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
      return { header: null, prefs: null, acquisition: null, events: [] };
    }

    // Cabecera: tomamos el evento más reciente con país/UA poblado
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
      sessions_estimate: estimateSessions(events),
    };

    // Preferencias inferidas
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

    // Adquisición: el primer evento con referrer o UTM
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

    // Timeline: últimos 100 eventos
    const timeline = events.slice(0, 100).map((e) => ({
      id: e.id,
      type: e.type,
      occurred_at: e.occurred_at,
      path: e.path,
      source: e.source,
      metadata: e.metadata,
    }));

    return { header, prefs, acquisition, events: timeline };
  });

function topN(counts: Record<string, number>, n: number) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, value]) => ({ key, value }));
}

function estimateSessions(events: RawEvent[]): number {
  if (events.length === 0) return 0;
  // Ordenadas desc por occurred_at: invertimos para recorrer cronológicamente
  const asc = events.slice().reverse();
  let sessions = 1;
  let last = new Date(asc[0].occurred_at).getTime();
  for (let i = 1; i < asc.length; i++) {
    const t = new Date(asc[i].occurred_at).getTime();
    if (t - last > 30 * 60 * 1000) sessions++; // 30 min de inactividad = nueva sesión
    last = t;
  }
  return sessions;
}
