// Fase 2 del motor predictivo: persistencia y reconciliación.
//
// Server functions:
//   - tickVirtualFleet({ line })           → genera + UPSERT en virtual_buses
//   - getActiveFleet({ line })             → SELECT plano
//   - reportRealtimeObservation({...})     → log de campo + reconciliación
//
// Filosofía:
//   El preview (Akamai NO bloquea) actúa como "sensor": cuando recibe ETAs
//   reales, las envía aquí. Comparamos contra el ETA virtual del bus más
//   cercano y persistimos `meta.phase_correction` por slot. Los próximos
//   ticks reusan esa corrección al posicionar la flota.

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

// ------------------------------------------------------------------
// 1. tickVirtualFleet — UPSERT flota actual
// ------------------------------------------------------------------
export const tickVirtualFleet = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ line: z.string().min(1).max(20) }).parse(input))
  .handler(async ({ data }) => {
    const lineCode = data.line;
    const snap = await getBusEngineSnapshot();
    const engine = fromSnapshot(snap);
    const corrections = await loadPhaseCorrections(lineCode);
    const at = new Date();
    const plan = buildLineFleetPlan(engine, lineCode, at);
    const fleet = generateActiveFleet(plan, at, corrections);

    const serviceDate = todayMadrid();
    const nowIso = at.toISOString();
    const activeKeys = new Set<string>();

    // UPSERT por bus
    for (const bus of fleet) {
      const slotKey = bus.busId.split("_").pop() ?? "BUS01";
      activeKeys.add(`${bus.direction}::${slotKey}`);
      const existingCorr = corrections.get(slotKey) ?? 0;

      await supabaseAdmin
        .from("virtual_buses")
        .upsert(
          {
            line_code: lineCode,
            direction: bus.direction,
            trip_key: slotKey,
            service_date: serviceDate,
            current_segment_idx: bus.segmentIndex,
            segment_progress: bus.segmentProgress,
            state: bus.status,
            source: "inferred",
            headway_slot: slotKey,
            confidence: bus.confidence,
            last_tick_at: nowIso,
            is_active: true,
            position_lat: bus.position?.lat ?? null,
            position_lng: bus.position?.lng ?? null,
            meta: {
              phase_correction: existingCorr,
              cycle_min: plan.cycleMin,
              headway_min: plan.headwayMin,
              elapsed_min: bus.elapsedMin,
              day_type: plan.dayType,
            },
          },
          { onConflict: "line_code,direction,trip_key,service_date" },
        );
    }

    // Marcar inactivos los buses del día de esta línea que no estén ahora.
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
        await supabaseAdmin
          .from("virtual_buses")
          .update({ is_active: false })
          .in("id", toDeactivate);
      }
    }

    return {
      line: lineCode,
      activeBusCount: fleet.length,
      headwayMin: plan.headwayMin,
      cycleMin: plan.cycleMin,
      tickedAt: nowIso,
    };
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
        "trip_key, direction, current_segment_idx, segment_progress, state, confidence, position_lat, position_lng, last_tick_at, meta",
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
        meta: r.meta as Record<string, unknown>,
      })),
    };
  });

// ------------------------------------------------------------------
// 3. reportRealtimeObservation — observación real → reconciliación
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
    // 1) Persistir observación
    await supabaseAdmin.from("bus_fleet_observations").insert({
      line_code: data.line,
      direction: data.direction,
      stop_code: data.stopCode,
      observed_eta_min: data.etaMin,
      source: data.source,
      client_id: data.clientId ?? null,
      meta: {},
    });

    // 2) Construir flota virtual actual para comparar
    const snap = await getBusEngineSnapshot();
    const engine = fromSnapshot(snap);
    const corrections = await loadPhaseCorrections(data.line);
    const at = new Date();
    const plan = buildLineFleetPlan(engine, data.line, at);
    const fleet = generateActiveFleet(plan, at, corrections);
    const etas = deriveStopEtas(plan, fleet, at);

    // ETA virtual más cercano a la parada+dirección observada
    const candidates = etas
      .filter((e) => e.stopCode === data.stopCode && e.direction === data.direction)
      .sort((a, b) => Math.abs(a.etaMin - data.etaMin) - Math.abs(b.etaMin - data.etaMin));
    const best = candidates[0];
    if (!best) {
      return { applied: false, reason: "no_matching_virtual_bus" };
    }

    const delta = data.etaMin - best.etaMin;
    // Filtro de outliers: |delta| > 10 min se ignora; <1 min no merece ajuste.
    if (Math.abs(delta) < 1) return { applied: false, reason: "within_tolerance", delta };
    if (Math.abs(delta) > 10) return { applied: false, reason: "outlier", delta };

    // El bus virtual se llama `${line}_${slot}`; extraemos slot.
    const slotKey = best.busId.split("_").pop();
    if (!slotKey) return { applied: false, reason: "no_slot" };

    // delta>0 → bus virtual va ADELANTADO al real → atrasamos fase (correction negativa)
    // delta<0 → bus virtual va RETRASADO → adelantamos fase (correction positiva)
    // Aplicamos suavizado WMWA: nueva = 0.7·anterior + 0.3·(anterior - delta)
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
          last_observation_delta: delta,
        },
        last_observation_at: at.toISOString(),
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
    };
  });
