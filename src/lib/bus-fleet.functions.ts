// Fase 3 del motor predictivo: persistencia anclada + reconciliación + health.
//
// Server functions:
//   - tickVirtualFleet({ line })           → genera + UPSERT en virtual_buses + bus_engine_health
//   - tickAllLines()                       → tick masivo (cron)
//   - getActiveFleet({ line })             → SELECT plano
//   - getEngineHealth({ line? })           → estado del motor
//   - reportRealtimeObservation({...})     → log + reconciliación (phase + stats por slot)

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { getBusEngineSnapshot } from "@/lib/bus-predict.functions";
import { fromSnapshot } from "@/lib/bus-engine/from-snapshot";
import {
  buildLineFleetPlan,
  generateActiveFleet,
  deriveStopEtas,
} from "@/lib/bus-engine/fleet";
import { getServiceSlot } from "@/lib/bus-engine/slots";
import { classifyPredictionQuality, shouldEnterSafeMode } from "@/lib/bus-engine/safe-mode";
import { extraBusActivationScore } from "@/lib/bus-engine/extra-bus-activation";
import { getLineProfile } from "@/lib/bus-engine/line-profiles";

function todayMadrid(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

async function loadPhaseCorrections(lineCode: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { data } = await supabaseAdmin
    .from("virtual_buses")
    .select("trip_key, meta")
    .eq("line_code", lineCode)
    .eq("service_date", todayMadrid())
    .eq("is_active", true);
  if (!data) return out;
  for (const row of data) {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const corr = typeof meta.phase_correction === "number" ? meta.phase_correction : 0;
    if (corr) out.set(row.trip_key as string, corr);
  }
  return out;
}

async function lastObservationAgeSec(lineCode: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from("bus_fleet_observations")
    .select("observed_at")
    .eq("line_code", lineCode)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.observed_at) return null;
  return Math.max(0, Math.round((Date.now() - Date.parse(data.observed_at)) / 1000));
}

// ------------------------------------------------------------------
// 1. tickVirtualFleet — UPSERT flota actual + health
// ------------------------------------------------------------------
async function tickLineInternal(lineCode: string) {
  const snap = await getBusEngineSnapshot();
  const engine = fromSnapshot(snap);
  const corrections = await loadPhaseCorrections(lineCode);
  const lastObsSec = await lastObservationAgeSec(lineCode);
  const at = new Date();
  const plan = buildLineFleetPlan(engine, lineCode, at);
  const { fleet, validatorReport } = generateActiveFleet(plan, at, corrections, lastObsSec);

  const serviceDate = todayMadrid();
  const nowIso = at.toISOString();
  const activeKeys = new Set<string>();

  const avgConfidence =
    fleet.length > 0 ? fleet.reduce((a, b) => a + b.confidence, 0) / fleet.length : 0.3;
  const safeMode = shouldEnterSafeMode({
    avgConfidence,
    lastObservationAgeSec: lastObsSec,
    validatorReport,
  });
  const predictionQuality = classifyPredictionQuality({
    avgConfidence,
    lastObservationAgeSec: lastObsSec,
    validatorReport,
  });

  for (const bus of fleet) {
    const slotKey = bus.busId.split("_").pop() ?? "BUS01";
    activeKeys.add(`${bus.direction}::${slotKey}`);
    const existingCorr = corrections.get(slotKey) ?? 0;

    // departure_time: si slotKey es HHMM (4 dígitos), úsalo como hora.
    let departureTime: string | null = null;
    if (/^\d{4}$/.test(slotKey)) {
      const hh = slotKey.slice(0, 2);
      const mm = slotKey.slice(2, 4);
      departureTime = `${hh}:${mm}:00`;
    }

    await supabaseAdmin.from("virtual_buses").upsert(
      {
        line_code: lineCode,
        direction: bus.direction,
        trip_key: slotKey,
        service_date: serviceDate,
        current_segment_idx: bus.segmentIndex,
        segment_progress: bus.segmentProgress,
        state: bus.status,
        source: bus.anchoredDeparture ? "scheduled" : "inferred",
        headway_slot: slotKey,
        confidence: bus.confidence,
        last_tick_at: nowIso,
        is_active: true,
        position_lat: bus.position?.lat ?? null,
        position_lng: bus.position?.lng ?? null,
        departure_time: departureTime,
        origin_terminal: bus.originTerminal ?? null,
        service_slot: bus.serviceSlot ?? plan.serviceSlot,
        anchored_to_departure: bus.anchoredDeparture ?? false,
        phase_error_sec: bus.phaseErrorSec ?? 0,
        reliability: bus.reliability ?? 0.5,
        last_observation_sec: lastObsSec,
        speed_kmh: bus.speedKmh ?? null,
        safe_mode: safeMode,
        meta: {
          phase_correction: existingCorr,
          cycle_min: plan.cycleMin,
          headway_min: plan.headwayMin,
          elapsed_min: bus.elapsedMin,
          day_type: plan.dayType,
          service_slot: plan.serviceSlot,
          fleet_size_expected: plan.fleetSizeExpected,
        },
      },
      { onConflict: "line_code,direction,trip_key,service_date" },
    );
  }

  // Desactivar buses fuera de la flota actual.
  const { data: existing } = await supabaseAdmin
    .from("virtual_buses")
    .select("id, direction, trip_key, is_active")
    .eq("line_code", lineCode)
    .eq("service_date", serviceDate);
  if (existing) {
    const toDeactivate = existing
      .filter((r) => r.is_active && !activeKeys.has(`${r.direction}::${r.trip_key}`))
      .map((r) => r.id);
    if (toDeactivate.length > 0) {
      await supabaseAdmin.from("virtual_buses").update({ is_active: false }).in("id", toDeactivate);
    }
  }

  // UPSERT health.
  await supabaseAdmin.from("bus_engine_health").upsert(
    {
      line_code: lineCode,
      last_tick_at: nowIso,
      last_tick_sec: 0,
      engine_alive: true,
      prediction_quality: predictionQuality,
      active_buses: fleet.length,
      fleet_size_expected: plan.fleetSizeExpected,
      avg_confidence: avgConfidence,
      safe_mode: safeMode,
      learning_active: true,
      meta: {
        headway_min: plan.headwayMin,
        cycle_min: plan.cycleMin,
        service_slot: plan.serviceSlot,
        day_type: plan.dayType,
        validator: validatorReport,
        last_observation_sec: lastObsSec,
      },
      updated_at: nowIso,
    },
    { onConflict: "line_code" },
  );

  return {
    line: lineCode,
    activeBusCount: fleet.length,
    fleetSizeExpected: plan.fleetSizeExpected,
    headwayMin: plan.headwayMin,
    cycleMin: plan.cycleMin,
    safeMode,
    predictionQuality,
    avgConfidence,
    tickedAt: nowIso,
  };
}

export const tickVirtualFleet = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ line: z.string().min(1).max(20) }).parse(input))
  .handler(async ({ data }) => tickLineInternal(data.line));

// ------------------------------------------------------------------
// 1b. tickAllLines — tick masivo (para cron)
// ------------------------------------------------------------------
export const tickAllLines = createServerFn({ method: "POST" })
  .handler(async () => {
    const { data: lines } = await supabaseAdmin.from("bus_lines").select("code");
    const codes = (lines ?? []).map((l) => l.code as string);
    const results: Array<{ line: string; ok: boolean; error?: string }> = [];
    for (const code of codes) {
      try {
        await tickLineInternal(code);
        results.push({ line: code, ok: true });
      } catch (e) {
        results.push({ line: code, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return { count: results.length, results };
  });

// ------------------------------------------------------------------
// 2. getActiveFleet — SELECT plano
// ------------------------------------------------------------------
export const getActiveFleet = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ line: z.string().min(1).max(20) }).parse(input))
  .handler(async ({ data }) => {
    const { data: rows } = await supabaseAdmin
      .from("virtual_buses")
      .select(
        "trip_key, direction, current_segment_idx, segment_progress, state, confidence, position_lat, position_lng, last_tick_at, meta, safe_mode, origin_terminal, service_slot, speed_kmh, phase_error_sec, reliability, anchored_to_departure",
      )
      .eq("line_code", data.line)
      .eq("service_date", todayMadrid())
      .eq("is_active", true);
    return {
      line: data.line,
      buses: (rows ?? []).map((r) => ({
        tripKey: r.trip_key as string,
        direction: r.direction as 1 | 2,
        segmentIndex: r.current_segment_idx ?? 0,
        segmentProgress: Number(r.segment_progress ?? 0),
        state: r.state as string,
        confidence: Number(r.confidence ?? 0.3),
        lat: r.position_lat,
        lng: r.position_lng,
        lastTickAt: r.last_tick_at,
        safeMode: r.safe_mode ?? false,
        originTerminal: r.origin_terminal ?? null,
        serviceSlot: r.service_slot ?? null,
        speedKmh: r.speed_kmh ?? null,
        phaseErrorSec: r.phase_error_sec ?? 0,
        reliability: Number(r.reliability ?? 0.5),
        anchoredToDeparture: r.anchored_to_departure ?? false,
        meta: (r.meta ?? {}) as Record<string, string | number | boolean | null>,
      })),
    };
  });

// ------------------------------------------------------------------
// 2b. getEngineHealth
// ------------------------------------------------------------------
export const getEngineHealth = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ line: z.string().min(1).max(20).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const q = supabaseAdmin.from("bus_engine_health").select("*");
    const { data: rows } = data.line ? await q.eq("line_code", data.line) : await q;
    return { rows: rows ?? [] };
  });

// ------------------------------------------------------------------
// 3. reportRealtimeObservation — observación real → reconciliación + slot stats
// ------------------------------------------------------------------
export const reportRealtimeObservation = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        line: z.string().min(1).max(20),
        direction: z.union([z.literal(1), z.literal(2)]),
        stopCode: z.string().min(1).max(20),
        etaMin: z.number().min(0).max(180),
        source: z.enum(["preview_real", "snapshot_manual"]).default("preview_real"),
        clientId: z.string().max(64).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    await supabaseAdmin.from("bus_fleet_observations").insert({
      line_code: data.line,
      direction: data.direction,
      stop_code: data.stopCode,
      observed_eta_min: data.etaMin,
      source: data.source,
      client_id: data.clientId ?? null,
      meta: {},
    });

    const snap = await getBusEngineSnapshot();
    const engine = fromSnapshot(snap);
    const corrections = await loadPhaseCorrections(data.line);
    const at = new Date();
    const plan = buildLineFleetPlan(engine, data.line, at);
    const { fleet } = generateActiveFleet(plan, at, corrections);
    const etas = deriveStopEtas(plan, fleet, at);

    const candidates = etas
      .filter((e) => e.stopCode === data.stopCode && e.direction === data.direction)
      .sort((a, b) => Math.abs(a.etaMin - data.etaMin) - Math.abs(b.etaMin - data.etaMin));
    const best = candidates[0];
    if (!best) return { applied: false, reason: "no_matching_virtual_bus" };

    const delta = data.etaMin - best.etaMin;
    if (Math.abs(delta) < 1) return { applied: false, reason: "within_tolerance", delta };
    if (Math.abs(delta) > 10) return { applied: false, reason: "outlier", delta };

    const slotKey = best.busId?.split("_").pop();
    if (!slotKey) return { applied: false, reason: "no_slot" };

    const prev = corrections.get(slotKey) ?? 0;
    const next = Math.round((0.7 * prev + 0.3 * (prev - delta)) * 100) / 100;

    await supabaseAdmin
      .from("virtual_buses")
      .update({
        meta: {
          phase_correction: next,
          cycle_min: plan.cycleMin,
          headway_min: plan.headwayMin,
          day_type: plan.dayType,
          service_slot: plan.serviceSlot,
          last_observation_delta: delta,
        },
        last_observation_at: at.toISOString(),
        last_observation_sec: 0,
        confidence: Math.min(0.95, (fleet.find((b) => b.busId === best.busId)?.confidence ?? 0.4) + 0.05),
      })
      .eq("line_code", data.line)
      .eq("service_date", todayMadrid())
      .eq("trip_key", slotKey)
      .eq("direction", data.direction);

    return {
      applied: true,
      busId: best.busId,
      delta,
      previousCorrection: prev,
      newCorrection: next,
      serviceSlot: getServiceSlot(at),
    };
  });
