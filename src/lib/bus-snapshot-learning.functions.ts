// Server fns para Fase 5: registro de snapshots manuales y recalibración WMA
// de bus_segment_stats / bus_cycle_stats / bus_headway_stats / bus_terminal_rest_stats.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wmaUpdate } from "@/lib/bus-engine/learning";

const RecordInput = z.object({
  lineCode: z.string().min(1).max(16),
  direction: z.number().int().min(0).max(2),
  stopCode: z.string().min(1).max(32),
  observedEtaMinutes: z.number().int().min(0).max(120).nullable().optional(),
  observedClockTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

export const recordBusSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RecordInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Insertar snapshot en bus_operator_snapshots (admin RLS OK)
    const { data: snap, error: snapErr } = await supabase
      .from("bus_operator_snapshots")
      .insert({
        line_code: data.lineCode,
        direction: data.direction,
        stop_code: data.stopCode,
        eta_minutes: data.observedEtaMinutes ?? null,
        eta_clock: data.observedClockTime ?? null,
        observed_by: userId,
        notes: data.notes ?? null,
      })
      .select("id, observed_at")
      .single();
    if (snapErr || !snap) {
      throw new Error(snapErr?.message ?? "No se pudo insertar el snapshot");
    }

    // 2) Cargar contexto mínimo: paradas de la línea y stats del segmento anterior
    const dir = data.direction === 0 ? 2 : (data.direction as 1 | 2);
    const { data: stops } = await supabaseAdmin
      .from("bus_line_stops")
      .select("seq, stop_code, stop_name")
      .eq("line_code", data.lineCode)
      .eq("direction", dir)
      .order("seq", { ascending: true });

    const ordered = (stops ?? []).filter((s) => s.stop_code);
    const idx = ordered.findIndex((s) => s.stop_code === data.stopCode);

    let segmentFrom: string | null = null;
    let segmentTo: string | null = null;
    let updatedSegmentStats: Record<string, unknown> | null = null;

    // 3) WMA sobre el segmento que termina en esta parada (si existe)
    if (idx > 0 && data.observedEtaMinutes != null) {
      segmentFrom = ordered[idx - 1].stop_code as string;
      segmentTo = ordered[idx].stop_code as string;

      const { data: existing } = await supabaseAdmin
        .from("bus_segment_stats")
        .select("avg_minutes, variance, samples, confidence")
        .eq("line_code", data.lineCode)
        .eq("direction", dir)
        .eq("from_stop", segmentFrom)
        .eq("to_stop", segmentTo)
        .maybeSingle();

      // Heurística: si la observación es 0 min, asumir tiempo de segmento mínimo (0.5)
      // En otro caso, atribuimos al segmento previo un porcentaje del total observado.
      const observedSegMin = Math.max(0.3, data.observedEtaMinutes / Math.max(1, idx));
      const w = data.confidence ?? 0.8;

      const upd = wmaUpdate({
        prevAvg: existing ? Number(existing.avg_minutes) : observedSegMin,
        prevVariance: existing ? Number(existing.variance) : 0,
        prevSamples: existing ? existing.samples : 0,
        observation: observedSegMin,
        weight: w,
      });

      const { error: upsertErr } = await supabaseAdmin
        .from("bus_segment_stats")
        .upsert(
          {
            line_code: data.lineCode,
            direction: dir,
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
      if (upsertErr) {
        // No abortamos: el evento queda registrado igualmente
        console.error("segment_stats upsert failed", upsertErr.message);
      } else {
        updatedSegmentStats = {
          fromStop: segmentFrom,
          toStop: segmentTo,
          avgMinutes: upd.newAvg,
          samples: upd.newSamples,
          confidence: upd.newConfidence,
        };
      }
    }

    // 4) Registrar evento normalizado
    const { data: evt, error: evtErr } = await supabaseAdmin
      .from("bus_snapshot_events")
      .insert({
        source_snapshot_id: snap.id,
        observed_at: snap.observed_at,
        line_code: data.lineCode,
        direction: dir,
        stop_code: data.stopCode,
        observed_eta_minutes: data.observedEtaMinutes ?? null,
        observed_clock_time: data.observedClockTime ?? null,
        segment_from_stop: segmentFrom,
        segment_to_stop: segmentTo,
        confidence: data.confidence ?? 0.8,
        snapshot_source: "manual",
        processed: updatedSegmentStats != null,
        processed_at: updatedSegmentStats != null ? new Date().toISOString() : null,
        impact: updatedSegmentStats ?? {},
      })
      .select("id")
      .single();
    if (evtErr) {
      console.error("snapshot_event insert failed", evtErr.message);
    }

    // 5) Marcar snapshot original como aplicado
    await supabaseAdmin
      .from("bus_operator_snapshots")
      .update({
        applied: updatedSegmentStats != null,
        applied_at: updatedSegmentStats != null ? new Date().toISOString() : null,
        impact: updatedSegmentStats ?? {},
      })
      .eq("id", snap.id);

    return {
      snapshotId: snap.id,
      eventId: evt?.id ?? null,
      updatedSegmentStats,
    };
  });

// Lista los eventos recientes (para UI admin y para que el motor priorice
// realtime cuando hay snapshots <15 min de antigüedad).
export const listRecentSnapshotEvents = createServerFn({ method: "GET" })
  .inputValidator((input: { lineCode?: string; limit?: number } = {}) => ({
    lineCode: input.lineCode,
    limit: Math.min(200, Math.max(1, input.limit ?? 50)),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("bus_snapshot_events")
      .select(
        "id, observed_at, line_code, direction, stop_code, observed_eta_minutes, observed_clock_time, segment_from_stop, segment_to_stop, confidence, processed, impact",
      )
      .order("observed_at", { ascending: false })
      .limit(data.limit);
    if (data.lineCode) q = q.eq("line_code", data.lineCode);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { events: rows ?? [] };
  });
