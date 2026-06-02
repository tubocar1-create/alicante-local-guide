// Ingesta automática de observaciones de subus.es para alimentar el motor
// predictivo. Se llama fire-and-forget desde bus-realtime.functions.ts.
// Throttle en memoria por (line, stop) para evitar inflar la BD.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { wmaUpdate } from "@/lib/bus-engine/learning";

type Observation = {
  lineCode: string;
  stopCode: string;
  etaMinutes: number;
  destination?: string;
};

const LEARN_THROTTLE_MS = 5 * 60 * 1000; // 5 min por (line, stop)
const lastLearnedAt = new Map<string, number>();

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  return m ? String(parseInt(m[1], 10)) + m[2] : code.trim().toUpperCase();
}

async function applyOne(obs: Observation): Promise<void> {
  const line = normalizeLine(obs.lineCode);
  const key = `${line}|${obs.stopCode}`;
  const last = lastLearnedAt.get(key) ?? 0;
  if (Date.now() - last < LEARN_THROTTLE_MS) return;
  lastLearnedAt.set(key, Date.now());

  // Resolver dirección y segmento previo (ida/vuelta)
  const { data: stopRows } = await supabaseAdmin
    .from("bus_line_stops")
    .select("seq, stop_code, direction")
    .eq("line_code", line)
    .eq("stop_code", obs.stopCode)
    .limit(2);
  const dirRow = stopRows?.[0];
  const direction = (dirRow?.direction ?? 1) as 1 | 2;

  const { data: ordered } = await supabaseAdmin
    .from("bus_line_stops")
    .select("seq, stop_code")
    .eq("line_code", line)
    .eq("direction", direction)
    .order("seq", { ascending: true });

  const idx = (ordered ?? []).findIndex((s) => s.stop_code === obs.stopCode);

  let segmentFrom: string | null = null;
  let segmentTo: string | null = null;
  let impact: Record<string, unknown> = {};

  if (idx > 0 && ordered) {
    segmentFrom = ordered[idx - 1].stop_code as string;
    segmentTo = ordered[idx].stop_code as string;

    const { data: existing } = await supabaseAdmin
      .from("bus_segment_stats")
      .select("avg_minutes, variance, samples, confidence")
      .eq("line_code", line)
      .eq("direction", direction)
      .eq("from_stop", segmentFrom)
      .eq("to_stop", segmentTo)
      .maybeSingle();

    // Atribuimos al segmento previo el ETA total / nº de segmentos.
    const observedSegMin = Math.max(0.3, obs.etaMinutes / Math.max(1, idx));
    const upd = wmaUpdate({
      prevAvg: existing ? Number(existing.avg_minutes) : observedSegMin,
      prevVariance: existing ? Number(existing.variance) : 0,
      prevSamples: existing ? existing.samples : 0,
      observation: observedSegMin,
      weight: 0.6, // menor peso que un snapshot manual de operador
    });

    await supabaseAdmin
      .from("bus_segment_stats")
      .upsert(
        {
          line_code: line,
          direction,
          from_stop: segmentFrom,
          to_stop: segmentTo,
          avg_minutes: upd.newAvg,
          variance: upd.newVariance,
          samples: upd.newSamples,
          confidence: upd.newConfidence,
          last_snapshot_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "line_code,direction,from_stop,to_stop" },
      );

    impact = {
      fromStop: segmentFrom,
      toStop: segmentTo,
      avgMinutes: upd.newAvg,
      samples: upd.newSamples,
      confidence: upd.newConfidence,
    };
  }

  await supabaseAdmin.from("bus_snapshot_events").insert({
    observed_at: new Date().toISOString(),
    line_code: line,
    direction,
    stop_code: obs.stopCode,
    observed_eta_minutes: obs.etaMinutes,
    segment_from_stop: segmentFrom,
    segment_to_stop: segmentTo,
    confidence: 0.6,
    snapshot_source: "subus_auto",
    processed: segmentFrom != null,
    processed_at: segmentFrom != null ? new Date().toISOString() : null,
    impact,
  });
}

// Fire-and-forget. Nunca lanza: aprender no debe romper el realtime.
export function ingestSubusObservations(observations: Observation[]): void {
  if (!observations.length) return;
  // Filtramos: una observación por (line, stop) — la más cercana (menor ETA).
  const best = new Map<string, Observation>();
  for (const o of observations) {
    if (!Number.isFinite(o.etaMinutes) || o.etaMinutes < 0 || o.etaMinutes > 90) continue;
    const k = `${normalizeLine(o.lineCode)}|${o.stopCode}`;
    const prev = best.get(k);
    if (!prev || o.etaMinutes < prev.etaMinutes) best.set(k, o);
  }
  // Ejecutar en background; cualquier error se silencia.
  void (async () => {
    for (const obs of best.values()) {
      try {
        await applyOne(obs);
      } catch (e) {
        console.error("[bus-learning] ingest failed", (e as Error).message);
      }
    }
  })();
}
