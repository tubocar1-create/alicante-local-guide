// Agrega métricas reales de VamosAlicante para el panel de administrador.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_PIN = "7910511";

async function countOf(
  table: string,
  filter?: (q: unknown) => unknown,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = (supabaseAdmin.from as any)(table).select("*", { count: "exact", head: true });
  if (filter) q = filter(q) ?? q;
  const { count, error } = await q;
  if (error) {
    console.warn(`[metrics] count ${table}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

export const getVamosMetrics = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ pin: z.string().min(1).max(32) }).parse(d),
  )
  .handler(async ({ data }) => {
    if (data.pin !== ADMIN_PIN) {
      throw new Response("Forbidden", { status: 403 });
    }

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const since24 = new Date(now - DAY).toISOString();
    const since7 = new Date(now - 7 * DAY).toISOString();
    const since30 = new Date(now - 30 * DAY).toISOString();

    // --- Contenido (catálogos) ---
    const [
      businesses,
      hotels,
      places,
      busLines,
      busStops,
      films,
      cinemas,
      health,
      pharmacies,
    ] = await Promise.all([
      countOf("businesses", (q) => (q as { eq: (a: string, b: boolean) => unknown }).eq("active", true)),
      countOf("hotels_static"),
      countOf("places"),
      countOf("bus_lines"),
      countOf("bus_stops"),
      countOf("films", (q) => (q as { eq: (a: string, b: boolean) => unknown }).eq("active", true)),
      countOf("cinemas", (q) => (q as { eq: (a: string, b: boolean) => unknown }).eq("active", true)),
      countOf("health_providers"),
      countOf("pharmacies"),
    ]);

    // --- Reservas + bookings totales / por estado ---
    const [bookingsTotal, bookings7d, bookingsPending] = await Promise.all([
      countOf("bookings"),
      countOf("bookings", (q) => (q as { gte: (a: string, b: string) => unknown }).gte("created_at", since7)),
      countOf("bookings", (q) => (q as { eq: (a: string, b: string) => unknown }).eq("status", "pending")),
    ]);

    // --- Eventos de interacción (embudo VAMOS) ---
    const { data: evRows } = await supabaseAdmin
      .from("interaction_events")
      .select("type, occurred_at")
      .gte("occurred_at", since30);
    const evTotals30: Record<string, number> = {};
    const evTotals7: Record<string, number> = {};
    const evTotals24: Record<string, number> = {};
    const series30: Record<string, number> = {};
    for (const r of evRows ?? []) {
      evTotals30[r.type] = (evTotals30[r.type] ?? 0) + 1;
      const t = new Date(r.occurred_at).getTime();
      if (now - t < 7 * DAY) evTotals7[r.type] = (evTotals7[r.type] ?? 0) + 1;
      if (now - t < DAY) evTotals24[r.type] = (evTotals24[r.type] ?? 0) + 1;
      const day = r.occurred_at.slice(0, 10);
      series30[day] = (series30[day] ?? 0) + 1;
    }
    const eventSeries = Object.entries(series30)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    // --- Agente IA ---
    const { data: agentRows } = await supabaseAdmin
      .from("agente_learning_log")
      .select("decision, resolved, fallback_used, latency_ms, created_at")
      .gte("created_at", since30);
    let agentResolved = 0;
    let agentFallback = 0;
    let latencySum = 0;
    let latencyN = 0;
    let agent24 = 0;
    let agent7 = 0;
    for (const r of agentRows ?? []) {
      if (r.resolved === true) agentResolved += 1;
      if (r.fallback_used === true) agentFallback += 1;
      if (typeof r.latency_ms === "number") {
        latencySum += r.latency_ms;
        latencyN += 1;
      }
      const t = new Date(r.created_at).getTime();
      if (now - t < DAY) agent24 += 1;
      if (now - t < 7 * DAY) agent7 += 1;
    }
    const agentTotal30 = agentRows?.length ?? 0;
    const agentResolutionPct =
      agentTotal30 > 0 ? Math.round((agentResolved / agentTotal30) * 100) : 0;
    const agentFallbackPct =
      agentTotal30 > 0 ? Math.round((agentFallback / agentTotal30) * 100) : 0;
    const avgLatencyMs = latencyN > 0 ? Math.round(latencySum / latencyN) : 0;

    const [unknownTotal, unknownPending] = await Promise.all([
      countOf("agente_unknown_queries"),
      countOf("agente_unknown_queries", (q) =>
        (q as { is: (a: string, b: null) => unknown }).is("processed_at", null),
      ),
    ]);

    return {
      generated_at: new Date().toISOString(),
      content: {
        businesses,
        hotels,
        places,
        bus_lines: busLines,
        bus_stops: busStops,
        films,
        cinemas,
        health,
        pharmacies,
      },
      bookings: {
        total: bookingsTotal,
        new_7d: bookings7d,
        pending: bookingsPending,
      },
      events: {
        totals_30d: evTotals30,
        totals_7d: evTotals7,
        totals_24h: evTotals24,
        series_30d: eventSeries,
      },
      agent: {
        total_30d: agentTotal30,
        new_24h: agent24,
        new_7d: agent7,
        resolution_pct: agentResolutionPct,
        fallback_pct: agentFallbackPct,
        avg_latency_ms: avgLatencyMs,
        unknown_total: unknownTotal,
        unknown_pending: unknownPending,
      },
    };
  });
