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
import { loadBusEngineSnapshot } from "@/lib/bus-predict.functions";
import { fromSnapshot } from "@/lib/bus-engine/from-snapshot";
import {
  buildLineFleetPlan,
  generateActiveFleet,
  deriveStopEtas,
} from "@/lib/bus-engine/fleet";
import type { Direction, VirtualBus } from "@/lib/bus-engine/types";
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

function hhmmssToMinutes(value: string | null | undefined): number {
  if (!value) return 0;
  const [h, m, s] = value.split(":").map((n) => Number(n));
  return (h || 0) * 60 + (m || 0) + (s || 0) / 60;
}

function tripDirectionFromKey(tripKey: string, fallback: Direction): Direction {
  return tripKey.startsWith("2-") ? 2 : tripKey.startsWith("1-") ? 1 : fallback;
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
async function historicalActivationPattern(
  lineCode: string,
  dayType: string,
  serviceSlot: string,
): Promise<number> {
  const profile = getLineProfile(lineCode);
  if (!profile) return 0;
  const { data } = await supabaseAdmin
    .from("bus_line_fleet_activations")
    .select("active_bus_count, base_bus_count")
    .eq("line_code", lineCode)
    .eq("day_type", dayType)
    .eq("service_slot", serviceSlot)
    .order("observed_at", { ascending: false })
    .limit(200);
  if (!data || data.length === 0) return 0;
  const aboveBase = data.filter((r) => (r.active_bus_count ?? 0) > (r.base_bus_count ?? 0)).length;
  return aboveBase / data.length;
}

async function tickLineInternal(lineCode: string) {
  const snap = await loadBusEngineSnapshot();
  const engine = fromSnapshot(snap);
  const corrections = await loadPhaseCorrections(lineCode);
  const lastObsSec = await lastObservationAgeSec(lineCode);
  const at = new Date();

  // Plan inicial (sin score) para conocer slot/dayType y poder calcular
  // patrón histórico + score real, y luego reconstruir el plan ya con score.
  const draftPlan = buildLineFleetPlan(engine, lineCode, at);
  const historical = await historicalActivationPattern(
    lineCode,
    draftPlan.dayType,
    draftPlan.serviceSlot,
  );
  const avgDelayMin =
    corrections.size > 0
      ? Array.from(corrections.values()).reduce((a, b) => a + Math.abs(b), 0) / corrections.size
      : 0;
  // Tomamos un baseline de cycle: si el plan tiene fleetSizeInferred y el
  // perfil define base, una desviación al alza es señal de saturación.
  const activationScore = extraBusActivationScore({
    avgDelayMin,
    spacingErrorRatio: 0,
    cycleTimeGrowth: 1,
    congestionIndex: 0,
    historicalSlotPattern: historical,
  });

  const plan = buildLineFleetPlan(engine, lineCode, at, { activationScore });
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

    // departure_time: si slotKey es HHMM o DIR-HHMM, conserva la hora oficial.
    let departureTime: string | null = null;
    const timeKey = slotKey.match(/^(?:[12]-)?(\d{4})$/)?.[1];
    if (timeKey) {
      const hh = timeKey.slice(0, 2);
      const mm = timeKey.slice(2, 4);
      departureTime = `${hh}:${mm}:00`;
    }

    const deathAt = new Date(at.getTime() + Math.max(0, bus.tripElapsedMin == null ? 0 : ((bus.tripDirection === 2 ? plan.dirVuelta?.totalMin : plan.dirIda?.totalMin) ?? 0) - bus.tripElapsedMin) * 60_000).toISOString();
    const { error: upsertError } = await supabaseAdmin.from("virtual_buses").upsert(
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
        estimated_terminal_arrival: deathAt,
        estimated_cycle_completion: deathAt,
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
    if (upsertError) throw new Error(`virtual_buses upsert failed: ${upsertError.message}`);
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
      const { error } = await supabaseAdmin.from("virtual_buses").update({ is_active: false }).in("id", toDeactivate);
      if (error) throw new Error(`virtual_buses deactivate failed: ${error.message}`);
    }
  }

  // UPSERT health.
  const { error: healthError } = await supabaseAdmin.from("bus_engine_health").upsert(
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
  if (healthError) throw new Error(`bus_engine_health upsert failed: ${healthError.message}`);

  // Log de activación: alimenta el aprendizaje de patrones (línea 12 etc.).
  // Sólo si la línea tiene perfil operacional y está en ventana de servicio.
  const profile = getLineProfile(lineCode);
  if (profile && plan.fleetWindow !== "before_service" && plan.fleetWindow !== "after_last_service") {
    const { error: activationError } = await supabaseAdmin.from("bus_line_fleet_activations").insert({
      line_code: lineCode,
      service_date: serviceDate,
      weekday: at.getDay(),
      day_type: plan.dayType,
      service_slot: plan.serviceSlot,
      active_bus_count: fleet.length,
      target_bus_count: plan.fleetSizeExpected,
      base_bus_count: profile.baseBuses,
      max_bus_count: profile.maxBuses,
      activation_score: activationScore,
      avg_delay_min: avgDelayMin,
      spacing_error: validatorReport.removedRatio,
      cycle_time_min: plan.cycleMin,
      headway_min: plan.headwayMin,
      congestion_index: null,
      trigger: "tick",
      meta: {
        fleet_window: plan.fleetWindow,
        fleet_reason: plan.fleetReason,
        fleet_inferred: plan.fleetSizeInferred,
        historical_pattern: historical,
      },
    });
    if (activationError) throw new Error(`bus_line_fleet_activations insert failed: ${activationError.message}`);
  }

  return {
    line: lineCode,
    activeBusCount: fleet.length,
    fleetSizeExpected: plan.fleetSizeExpected,
    fleetSizeInferred: plan.fleetSizeInferred,
    fleetWindow: plan.fleetWindow,
    fleetReason: plan.fleetReason,
    headwayMin: plan.headwayMin,
    cycleMin: plan.cycleMin,
    activationScore,
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
export async function tickAllLinesInternal() {
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
}

export const tickAllLines = createServerFn({ method: "POST" })
  .handler(async () => tickAllLinesInternal());

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

export const getVirtualStopArrivals = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({
      stopCode: z.string().min(1).max(20),
      line: z.string().min(1).max(20).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const snap = await loadBusEngineSnapshot();
    const engine = fromSnapshot(snap);
    const wantedLine = data.line ? data.line.trim().toUpperCase() : null;
    const linesAtStop = Array.from(new Set(
      engine.stops
        .filter((s) => s.stopCode === data.stopCode && (!wantedLine || s.lineCode.toUpperCase() === wantedLine))
        .map((s) => s.lineCode),
    ));
    if (linesAtStop.length === 0) return { arrivals: [], all: [], etaMin: null, fetchedAt: Date.now() };

    const { data: rows, error } = await supabaseAdmin
      .from("virtual_buses")
      .select("line_code,direction,trip_key,departure_time,current_segment_idx,segment_progress,state,confidence,position_lat,position_lng,last_tick_at,meta,safe_mode,origin_terminal,service_slot,speed_kmh,phase_error_sec,reliability,anchored_to_departure,is_active")
      .eq("service_date", todayMadrid())
      .eq("is_active", true)
      .in("line_code", linesAtStop);
    if (error) throw new Error(`virtual_buses read failed: ${error.message}`);

    const now = new Date();
    const arrivals: Array<{ line: string; direction: Direction; destination: string; etaMin: number; etaClock: string; confidence: number; busId: string; lat: number | null; lng: number | null }> = [];
    for (const line of linesAtStop) {
      const plan = buildLineFleetPlan(engine, line, now);
      const fleet: VirtualBus[] = (rows ?? [])
        .filter((r) => r.line_code === line)
        .map((r) => {
          const meta = (r.meta ?? {}) as Record<string, unknown>;
          const dir = (Number(r.direction) === 2 ? 2 : 1) as Direction;
          const tripDirection = tripDirectionFromKey(String(r.trip_key), dir);
          const lastTickAgeMin = r.last_tick_at ? Math.max(0, (Date.now() - Date.parse(String(r.last_tick_at))) / 60_000) : 0;
          const elapsedBase = typeof meta.elapsed_min === "number" ? meta.elapsed_min : Math.max(0, currentMadridMinutes(now) - hhmmssToMinutes(r.departure_time as string | null));
          return {
            busId: `${line}_${r.trip_key}`,
            lineCode: line,
            direction: dir,
            status: r.state as VirtualBus["status"],
            departureMin: hhmmssToMinutes(r.departure_time as string | null),
            tripDirection,
            tripElapsedMin: elapsedBase + lastTickAgeMin,
            elapsedMin: elapsedBase + lastTickAgeMin,
            segmentIndex: Number(r.current_segment_idx ?? 0),
            segmentProgress: Number(r.segment_progress ?? 0),
            position: r.position_lat != null && r.position_lng != null ? { lat: Number(r.position_lat), lng: Number(r.position_lng) } : null,
            delayMin: Number(r.phase_error_sec ?? 0) / 60,
            confidence: Number(r.confidence ?? 0.3),
            anchoredDeparture: r.anchored_to_departure ?? true,
            originTerminal: r.origin_terminal ?? null,
            serviceSlot: r.service_slot ?? undefined,
            phaseErrorSec: Number(r.phase_error_sec ?? 0),
            reliability: Number(r.reliability ?? 0.5),
            speedKmh: r.speed_kmh == null ? null : Number(r.speed_kmh),
            safeMode: r.safe_mode ?? false,
          };
        });
      const stopEtas = deriveStopEtas(plan, fleet, now).filter((e) => e.stopCode === data.stopCode);
      for (const eta of stopEtas) {
        const destStops = engine.stops.filter((s) => s.lineCode === line && s.direction === eta.direction).sort((a, b) => a.seq - b.seq);
        const bus = fleet.find((b) => b.busId === eta.busId);
        arrivals.push({
          line,
          direction: eta.direction,
          destination: destStops[destStops.length - 1]?.stopName ?? "",
          etaMin: eta.etaMin,
          etaClock: eta.etaClock,
          confidence: eta.confidence,
          busId: eta.busId ?? "",
          lat: bus?.position?.lat ?? null,
          lng: bus?.position?.lng ?? null,
        });
      }
    }
    arrivals.sort((a, b) => a.etaMin - b.etaMin);
    return { arrivals, all: arrivals.map((a) => a.etaMin), etaMin: arrivals[0]?.etaMin ?? null, fetchedAt: Date.now() };
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

    const snap = await loadBusEngineSnapshot();
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
