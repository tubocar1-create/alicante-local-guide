// Motor operacional basado en BUSES VIRTUALES PERSISTENTES.
//
// Filosofía:
//   1. Inferir flota activa = round(cycle_time / headway) por ventana horaria.
//   2. Simular cada bus a lo largo del ciclo completo (IDA → regulación → VUELTA → regulación → ...).
//   3. Posicionar cada bus sobre la polilínea.
//   4. DERIVAR ETAs por parada desde la posición de cada bus (nunca al revés).
//
// Estados:
//   - moving           : entre dos paradas
//   - dwell_stop       : detenido en parada (corto, simulado vía baseline)
//   - terminal_regulation : descansando en terminal entre trips
//   - out_of_service   : fuera de la ventana de servicio o flota sobrante

import type {
  BusEngineData,
  CycleStat,
  Direction,
  LineStop,
  StopEta,
  StopMeta,
  VirtualBus,
} from "./types";
import { haversineMeters, lerp, type LatLng } from "./geometry";
import { segmentKey, segmentMinutes } from "./segments";
import { formatClock, getDeparturesForLine, nowMinutes } from "./schedule";
import { dayType, detectProfile } from "./peak-detector";
import { getServiceSlot, type ServiceSlot } from "./slots";
import { computeFleetSize, fleetSizeCap } from "./fleet-sizer";
import { validateFleetConsistency, type ValidatorReport } from "./fleet-validator";
import {
  classifyPredictionQuality,
  degradeConfidenceByAge,
  shouldEnterSafeMode,
  type PredictionQuality,
} from "./safe-mode";
import {
  applyProfileFleetTarget,
  getLineProfile,
  type FleetWindow,
} from "./line-profiles";
import { classifyDepartureWindow } from "./active-window";
import { validateTemporalConsistency } from "./temporal-consistency";


// Aprendizaje SOLO puede ajustar la fase del bus en ±MAX_PHASE_CORRECTION_MIN.
// Nunca puede inventar un bus ni reposicionarlo libremente.
const MAX_PHASE_CORRECTION_MIN = 1.5; // ±90 s




export type OrderedStop = LineStop & { lat: number | null; lng: number | null };

export type DirectionPlan = {
  direction: Direction;
  stops: OrderedStop[];
  cumTimes: number[];   // minutos acumulados desde parada 0
  segMinutes: number[]; // minutos por segmento i→i+1
  segConf: number[];    // confianza por segmento
  totalMin: number;     // duración total del trip
};

export type LineFleetPlan = {
  lineCode: string;
  dirIda: DirectionPlan | null;
  dirVuelta: DirectionPlan | null;
  cycleMin: number;
  terminalRegulationMin: number;
  headwayMin: number;
  activeBusCount: number;        // = fleetSizeExpected tras perfil (compatibilidad)
  fleetSizeExpected: number;     // tras aplicar perfil operacional (cap/floor)
  fleetSizeInferred: number;     // valor crudo (ceil cycle/headway)
  fleetSizeMin: number;          // tope inferior del perfil (base diurna)
  fleetSizeMax: number;          // tope superior del perfil
  fleetWindow: FleetWindow | "no_profile";
  fleetReason: string;
  dayType: ReturnType<typeof dayType>;
  serviceSlot: ServiceSlot;
  officialDeparturesMin: number[]; // salidas oficiales IDA dentro del slot activo
  officialDeparturesByDirection: Record<Direction, number[]>;
  terminalIda: string | null;
  terminalVuelta: string | null;
};

type CycleLocation = {
  direction: Direction;
  state: VirtualBus["status"];
  segmentIndex: number;
  segmentProgress: number;
  position: LatLng | null;
  segmentConfidence: number;
};


function orderedStops(
  data: BusEngineData,
  lineCode: string,
  direction: Direction,
): OrderedStop[] {
  return data.stops
    .filter((s) => s.lineCode === lineCode && s.direction === direction)
    .sort((a, b) => a.seq - b.seq)
    .map((s) => {
      const meta = data.stopsMeta.get(s.stopCode);
      return { ...s, lat: meta?.lat ?? null, lng: meta?.lng ?? null };
    });
}

function buildDirectionPlan(
  data: BusEngineData,
  lineCode: string,
  direction: Direction,
  at: Date,
): DirectionPlan | null {
  const stops = orderedStops(data, lineCode, direction);
  if (stops.length < 2) return null;
  const profile = detectProfile(at);
  const cumTimes: number[] = [0];
  const segMinutes: number[] = [];
  const segConf: number[] = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const distance =
      a.lat != null && a.lng != null && b.lat != null && b.lng != null
        ? haversineMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
        : 250;
    const stat = data.segmentStats.get(segmentKey(lineCode, direction, a.stopCode, b.stopCode));
    const seg = segmentMinutes({ stat, distanceM: distance, profile });
    segMinutes.push(seg.minutes);
    segConf.push(seg.confidence);
    cumTimes.push(cumTimes[i - 1] + seg.minutes);
  }
  return {
    direction,
    stops,
    cumTimes,
    segMinutes,
    segConf,
    totalMin: cumTimes[cumTimes.length - 1],
  };
}

function cycleDurationMin(cycle: CycleStat | undefined, fallbackMin: number, d: Date): number {
  if (!cycle) return fallbackMin;
  const h = d.getHours();
  if (h >= 7 && h < 10 && cycle.cycleMorningMin) return cycle.cycleMorningMin;
  if (h >= 10 && h < 13 && cycle.cycleMiddayMin) return cycle.cycleMiddayMin;
  if (h >= 13 && h < 16 && cycle.cycleAfternoonMin) return cycle.cycleAfternoonMin;
  if ((h < 7 || h >= 22) && cycle.cycleNightMin) return cycle.cycleNightMin;
  const dt = dayType(d);
  if ((dt === "sabado" || dt === "domingo" || dt === "festivo") && cycle.cycleWeekendMin) {
    return cycle.cycleWeekendMin;
  }
  return cycle.cycleAvgMin;
}

// Infiere headway efectivo desde lista de salidas dentro de [now-30, now+60].
function inferHeadwayMin(deps: number[], now: number, fallback: number): number {
  const near = deps.filter((d) => d >= now - 30 && d <= now + 60).sort((a, b) => a - b);
  if (near.length < 2) return fallback;
  const diffs: number[] = [];
  for (let i = 1; i < near.length; i++) diffs.push(near[i] - near[i - 1]);
  diffs.sort((a, b) => a - b);
  // mediana
  const mid = Math.floor(diffs.length / 2);
  return diffs.length % 2 === 0 ? (diffs[mid - 1] + diffs[mid]) / 2 : diffs[mid];
}

export function buildLineFleetPlan(
  data: BusEngineData,
  lineCode: string,
  at: Date = new Date(),
  opts?: { activationScore?: number },
): LineFleetPlan {
  const ida = buildDirectionPlan(data, lineCode, 1, at);
  const vuelta = buildDirectionPlan(data, lineCode, 2, at);
  const dt = dayType(at);
  const cycle = data.cycleStats.get(lineCode);
  const terminalRegulationMin = cycle ? Number(cycle.terminalWaitAvgMin) : 5;
  const fallbackCycle = (ida?.totalMin ?? 0) + (vuelta?.totalMin ?? 0) + 2 * terminalRegulationMin;
  const cycleMin = cycleDurationMin(cycle, fallbackCycle, at);

  // Headway desde departures (ida como referencia primaria; si no, vuelta)
  const now = nowMinutes(at);
  const idaDeps = getDeparturesForLine({
    lineCode,
    direction: 1,
    dayType: dt,
    departures: data.departures,
    windows: data.serviceWindows,
  }).map((d) => d.departureMin);
  const vueltaDeps = getDeparturesForLine({
    lineCode,
    direction: 2,
    dayType: dt,
    departures: data.departures,
    windows: data.serviceWindows,
  }).map((d) => d.departureMin);
  const fallbackHeadway = dt === "laborable" ? 15 : 20;
  const headwayMin = inferHeadwayMin(idaDeps, now, fallbackHeadway);

  const fleetSizeInferred = computeFleetSize(cycleMin, headwayMin);
  const serviceSlot = getServiceSlot(at);

  // Perfil operacional (línea 12, etc.): tiene PRIORIDAD sobre el cálculo
  // matemático. Define base diurna, máximos, ventana nocturna y último servicio.
  const profileResult = applyProfileFleetTarget({
    lineCode,
    inferred: fleetSizeInferred,
    activationScore: opts?.activationScore ?? 0,
    at,
  });
  // Siempre usamos el resultado del perfil (con perfil por defecto = 4 buses
  // para líneas sin perfil explícito).
  const fleetSizeExpected = profileResult.target;
  const fleetSizeMin = profileResult.min;
  const fleetSizeMax = profileResult.max;

  // Salidas oficiales por terminal en la ventana operacional inmediata.
  const officialDeparturesMin = idaDeps
    .filter((d) => d >= now - cycleMin - 5 && d <= now + cycleMin)
    .sort((a, b) => a - b);
  const officialDeparturesByDirection: Record<Direction, number[]> = {
    1: officialDeparturesMin,
    2: vueltaDeps
      .filter((d) => d >= now - cycleMin - 5 && d <= now + cycleMin)
      .sort((a, b) => a - b),
  };

  const terminalIda = ida?.stops[0]?.stopName ?? null;
  const terminalVuelta = vuelta?.stops[0]?.stopName ?? null;

  return {
    lineCode,
    dirIda: ida,
    dirVuelta: vuelta,
    cycleMin,
    terminalRegulationMin,
    headwayMin,
    activeBusCount: fleetSizeExpected,
    fleetSizeExpected,
    fleetSizeInferred,
    fleetSizeMin,
    fleetSizeMax,
    fleetWindow: profileResult.window,
    fleetReason: profileResult.reason,
    dayType: dt,
    serviceSlot,
    officialDeparturesMin,
    officialDeparturesByDirection,
    terminalIda,
    terminalVuelta,
  };
}


// Dado un offset dentro del ciclo (0..cycleMin), determina dónde está el bus.
// El ciclo se descompone como:
//   [0, idaTotal)                          → moving IDA
//   [idaTotal, idaTotal + reg)             → terminal_regulation (terminal IDA)
//   [+reg, +reg + vueltaTotal)             → moving VUELTA
//   [+vueltaTotal, +vueltaTotal + reg)     → terminal_regulation (terminal VUELTA)
function locateBusInCycle(
  plan: LineFleetPlan,
  cycleOffset: number,
  cycleStartDirection: Direction = 1,
): CycleLocation {
  if (cycleStartDirection === 2) {
    return locateBusInDirectionCycle(plan, cycleOffset, 2);
  }
  return locateBusInDirectionCycle(plan, cycleOffset, 1);
}

function locateBusInDirectionCycle(
  plan: LineFleetPlan,
  cycleOffset: number,
  cycleStartDirection: Direction,
): CycleLocation {
  const reg = plan.terminalRegulationMin;
  let t = ((cycleOffset % plan.cycleMin) + plan.cycleMin) % plan.cycleMin;
  const firstPlan = cycleStartDirection === 1 ? plan.dirIda : plan.dirVuelta;
  const secondPlan = cycleStartDirection === 1 ? plan.dirVuelta : plan.dirIda;
  const firstTotal = firstPlan?.totalMin ?? 0;
  const secondTotal = secondPlan?.totalMin ?? 0;

  // Fase primer sentido desde su base oficial.
  if (firstPlan && t < firstTotal) {
    return locateInDirection(firstPlan, t);
  }
  t -= firstTotal;

  // Regulación en terminal opuesta antes de volver.
  if (t < reg) {
    const last = firstPlan?.stops[firstPlan.stops.length - 1];
    return {
      direction: cycleStartDirection,
      state: "terminal_wait",
      segmentIndex: firstPlan ? firstPlan.stops.length - 1 : 0,
      segmentProgress: 0,
      position: last && last.lat != null && last.lng != null ? { lat: last.lat, lng: last.lng } : null,
      segmentConfidence: 0.6,
    };
  }
  t -= reg;

  // Fase sentido contrario.
  if (secondPlan && t < secondTotal) {
    return locateInDirection(secondPlan, t);
  }
  t -= secondTotal;

  // Regulación en base de origen antes de cerrar ciclo.
  const last = secondPlan?.stops[secondPlan.stops.length - 1]
    ?? firstPlan?.stops[0];
  return {
    direction: cycleStartDirection === 1 ? 2 : 1,
    state: "terminal_wait",
    segmentIndex: secondPlan ? secondPlan.stops.length - 1 : 0,
    segmentProgress: 0,
    position: last && last.lat != null && last.lng != null ? { lat: last.lat, lng: last.lng } : null,
    segmentConfidence: 0.6,
  };
}

function locateInDirection(plan: DirectionPlan, elapsed: number) {
  let idx = 0;
  while (idx < plan.segMinutes.length && plan.cumTimes[idx + 1] <= elapsed) idx++;
  const segEl = elapsed - plan.cumTimes[idx];
  const segProg = plan.segMinutes[idx] > 0 ? Math.min(1, segEl / plan.segMinutes[idx]) : 0;
  const a = plan.stops[idx];
  const b = plan.stops[idx + 1];
  let position: LatLng | null = null;
  if (a?.lat != null && a.lng != null && b?.lat != null && b.lng != null) {
    position = lerp({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }, segProg);
  } else if (a?.lat != null && a.lng != null) {
    position = { lat: a.lat, lng: a.lng };
  }
  return {
    direction: plan.direction,
    state: "moving" as VirtualBus["status"],
    segmentIndex: idx,
    segmentProgress: segProg,
    position,
    segmentConfidence: plan.segConf[idx] ?? 0.4,
  };
}

// Genera la flota inferida y la posiciona AHORA.
//
// Estrategia (fase 3):
//   1. Si tenemos salidas oficiales en el slot activo, anclamos cada bus a la
//      salida más reciente cuyo `elapsed ≤ cycleMin`. Cada bus mantiene su
//      identidad por `departureMin` (slotKey = HHMM).
//   2. Si no hay salidas oficiales, fallback al esquema antiguo de slots
//      sintéticos uniformes (BUS01..N).
//   3. Aplicamos `phaseCorrections` (Map<slotKey, minutos>) procedentes de
//      observaciones reales.
//   4. Validamos consistencia (dedupe, spacing, velocidad, cap).
//
// El campo `lastObservationSec` se pasa por separado para degradar confianza
// uniformemente por edad.
export function generateActiveFleet(
  plan: LineFleetPlan,
  at: Date = new Date(),
  phaseCorrections?: Map<string, number>,
  lastObservationAgeSec: number | null = null,
): { fleet: VirtualBus[]; validatorReport: ValidatorReport } {
  if (plan.cycleMin <= 0) return { fleet: [], validatorReport: emptyReport() };
  // PERFIL OPERACIONAL: si una línea está fuera de servicio (perfil dice
  // target=0), no generamos NADA aunque haya salidas oficiales en el horario.
  if (plan.fleetSizeExpected === 0 && plan.fleetWindow !== "no_profile") {
    return { fleet: [], validatorReport: emptyReport() };
  }
  const now = nowMinutes(at);
  let raw: VirtualBus[] = [];

  const hasOfficial =
    plan.officialDeparturesByDirection[1].length > 0 ||
    plan.officialDeparturesByDirection[2].length > 0;
  if (hasOfficial) {
    // MODELO SIMPLE (sin carrusel):
    //   - Cada salida oficial = un bus virtual que NACE a su hora de salida.
    //   - El bus AVANZA por su sentido hasta la parada final y entonces MUERE.
    //   - No hay regulación en terminal, no se reutilizan buses, no hay carrusel.
    //   - El cap por perfil (`fleetSizeMax`) limita los buses simultáneos.
    for (const dir of [1, 2] as Direction[]) {
      const dirPlan = dir === 1 ? plan.dirIda : plan.dirVuelta;
      if (!dirPlan) continue;
      const tripDuration = dirPlan.totalMin;
      if (tripDuration <= 0) continue;
      const deps = plan.officialDeparturesByDirection[dir];
      for (const dep of deps) {
        if (dep > now) continue;                       // aún no ha nacido
        if (dep + tripDuration <= now) continue;       // ya llegó a final → murió
        const slotKey = `${dir}-${minutesToHHMM(dep)}`;
        const rawCorrection =
          phaseCorrections?.get(slotKey) ??
          phaseCorrections?.get(minutesToHHMM(dep)) ??
          0;
        const correction = Math.max(
          -MAX_PHASE_CORRECTION_MIN,
          Math.min(MAX_PHASE_CORRECTION_MIN, rawCorrection),
        );
        const elapsed = Math.max(0, Math.min(tripDuration, now - dep + correction));
        const loc = locateInDirection(dirPlan, elapsed);
        const speed = estimateSpeedKmh(plan, loc);
        raw.push(makeBus(plan, slotKey, dep, elapsed, correction, loc, speed, true, dir));
      }
    }
  } else {
    // Fallback sintético (solo si NO hay salidas oficiales para esta línea/slot).
    const N = plan.fleetSizeExpected;
    if (N > 0) {
      const slotSpacing = plan.cycleMin / N;
      for (let slot = 0; slot < N; slot++) {
        const slotKey = `BUS${String(slot + 1).padStart(2, "0")}`;
        const rawCorrection = phaseCorrections?.get(slotKey) ?? 0;
        const correction = Math.max(
          -MAX_PHASE_CORRECTION_MIN,
          Math.min(MAX_PHASE_CORRECTION_MIN, rawCorrection),
        );
        const rawOffset = now - slot * slotSpacing + correction;
        const offset = ((rawOffset % plan.cycleMin) + plan.cycleMin) % plan.cycleMin;
        const loc = locateBusInCycle(plan, offset);
        const speed = estimateSpeedKmh(plan, loc);
        raw.push(makeBus(plan, slotKey, now - offset, offset, correction, loc, speed, false, 1));
      }
    }
  }



  // Degradación por edad de observación.
  for (const b of raw) {
    b.confidence = degradeConfidenceByAge(b.confidence, lastObservationAgeSec);
    b.lastObservationSec = lastObservationAgeSec;
  }

  // Validación de consistencia.
  const speeds = new Map(raw.map((b) => [b.busId, b.speedKmh ?? 0]));
  const { fleet, report } = validateFleetConsistency({
    fleet: raw,
    cycleMin: plan.cycleMin,
    headwayMin: plan.headwayMin,
    speeds,
  });

  // CAP DURO por perfil operacional. Si el perfil define un máximo, jamás
  // entregamos más buses que ese número. Si define un mínimo y vamos cortos,
  // sólo añadimos buses sintéticos cuando NO hay anclaje oficial; con anclaje
  // oficial respetamos la realidad (no inventamos buses sin salida válida).
  let capped = fleet;
  if (plan.fleetWindow !== "no_profile" && plan.fleetSizeMax > 0) {
    if (capped.length > plan.fleetSizeMax) {
      capped = [...capped]
        .sort((a, b) => b.confidence - a.confidence || a.elapsedMin - b.elapsedMin)
        .slice(0, plan.fleetSizeMax);
    }
  }

  return { fleet: capped, validatorReport: report };
}

function makeBus(
  plan: LineFleetPlan,
  slotKey: string,
  departureMin: number,
  elapsedMin: number,
  correction: number,
  loc: ReturnType<typeof locateBusInCycle>,
  speedKmh: number | null,
  anchored: boolean,
  tripDirection: Direction,
): VirtualBus {
  return {
    busId: `${plan.lineCode}_${slotKey}`,
    lineCode: plan.lineCode,
    direction: loc.direction,
    status: loc.state,
    departureMin,
    tripDirection,
    tripElapsedMin: elapsedMin,
    elapsedMin,
    segmentIndex: loc.segmentIndex,
    segmentProgress: loc.segmentProgress,
    position: loc.position,
    delayMin: correction,
    confidence: Math.max(0.35, loc.segmentConfidence * 0.85),
    anchoredDeparture: anchored,
    originTerminal: tripDirection === 1 ? plan.terminalIda : plan.terminalVuelta,
    serviceSlot: plan.serviceSlot,
    phaseErrorSec: Math.round(correction * 60),
    reliability: Math.max(0.3, Math.min(0.95, loc.segmentConfidence)),
    speedKmh,
    lastObservationSec: null,
    safeMode: false,
  };
}

function minutesToHHMM(min: number): string {
  const n = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
}

function estimateSpeedKmh(
  plan: LineFleetPlan,
  loc: ReturnType<typeof locateBusInCycle>,
): number | null {
  if (loc.state !== "moving") return 0;
  const dir = loc.direction === 1 ? plan.dirIda : plan.dirVuelta;
  if (!dir) return null;
  const i = loc.segmentIndex;
  const a = dir.stops[i];
  const b = dir.stops[i + 1];
  if (!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const distKm = haversineMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }) / 1000;
  const min = dir.segMinutes[i];
  if (!min || min <= 0) return null;
  return Math.max(0, Math.min(60, (distKm / min) * 60));
}

function emptyReport(): ValidatorReport {
  return {
    inputCount: 0,
    outputCount: 0,
    removedDuplicates: 0,
    removedBadSpacing: 0,
    removedBadSpeed: 0,
    removedCap: 0,
    removedRatio: 0,
  };
}


// Deriva ETAs por parada desde la flota: para cada parada futura en la trayectoria
// del bus, calcula el tiempo hasta alcanzarla siguiendo el ciclo.
export function deriveStopEtas(
  plan: LineFleetPlan,
  fleet: VirtualBus[],
  at: Date = new Date(),
): StopEta[] {
  const now = nowMinutes(at);
  const out: StopEta[] = [];

  for (const bus of fleet) {
    if (bus.status === "finished" || bus.status === "inactive") continue;
    // Reconstruimos su offset dentro del ciclo.
    const offset = bus.tripElapsedMin ?? bus.elapsedMin;
    // Recorremos paradas futuras dentro de los próximos 90 min.
    addStopsFromOffset(plan, offset, bus.busId, now, bus.confidence, out, 90, bus.tripDirection ?? 1);
  }

  // Por parada+linea+dirección quedarnos con las próximas 3 ETAs (orden ascendente).
  const byKey = new Map<string, StopEta[]>();
  for (const e of out) {
    const k = `${e.lineCode}|${e.direction}|${e.stopCode}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(e);
  }
  const result: StopEta[] = [];
  for (const arr of byKey.values()) {
    arr.sort((a, b) => a.etaMin - b.etaMin);
    for (let i = 0; i < Math.min(3, arr.length); i++) result.push(arr[i]);
  }
  return result.sort((a, b) => a.etaMin - b.etaMin);
}

function addStopsFromOffset(
  plan: LineFleetPlan,
  startOffset: number,
  busId: string,
  now: number,
  confidence: number,
  out: StopEta[],
  horizonMin: number,
  cycleStartDirection: Direction = 1,
): void {
  if (cycleStartDirection === 2) {
    addStopsFromDirectionalOffset(plan, startOffset, busId, now, confidence, out, horizonMin, 2);
    return;
  }
  addStopsFromDirectionalOffset(plan, startOffset, busId, now, confidence, out, horizonMin, 1);
}

function addStopsFromDirectionalOffset(
  plan: LineFleetPlan,
  startOffset: number,
  busId: string,
  now: number,
  confidence: number,
  out: StopEta[],
  horizonMin: number,
  cycleStartDirection: Direction,
): void {
  const reg = plan.terminalRegulationMin;
  const first = cycleStartDirection === 1 ? plan.dirIda : plan.dirVuelta;
  const second = cycleStartDirection === 1 ? plan.dirVuelta : plan.dirIda;
  const firstTotal = first?.totalMin ?? 0;
  const secondTotal = second?.totalMin ?? 0;

  // Recorremos el ciclo dos veces como mucho para cubrir 90 min.
  let tInCycle = startOffset;
  let absT = 0; // tiempo desde "ahora" hasta alcanzar cada parada

  const loops = 3;
  for (let loop = 0; loop < loops; loop++) {
    // Fase primer sentido desde su salida oficial.
    if (first && tInCycle < firstTotal) {
      // Encontrar próxima parada
      const elapsed = tInCycle;
      let idx = 0;
      while (idx < first.segMinutes.length && first.cumTimes[idx + 1] <= elapsed) idx++;
      for (let i = idx + 1; i < first.stops.length; i++) {
        const arriveOffset = first.cumTimes[i] - elapsed;
        const etaMin = absT + arriveOffset;
        if (etaMin > horizonMin) return;
        out.push({
          lineCode: plan.lineCode,
          direction: first.direction,
          busId,
          stopCode: first.stops[i].stopCode,
          stopSeq: first.stops[i].seq,
          etaMin: Math.max(0, Math.round(etaMin)),
          etaClock: formatClock(now + etaMin),
          confidence,
        });
      }
      absT += firstTotal - elapsed;
      tInCycle = firstTotal;
    }
    // Regulación terminal.
    if (tInCycle < firstTotal + reg) {
      absT += firstTotal + reg - tInCycle;
      tInCycle = firstTotal + reg;
    }
    // Fase sentido contrario.
    if (second && tInCycle < firstTotal + reg + secondTotal) {
      const elapsed = tInCycle - firstTotal - reg;
      let idx = 0;
      while (idx < second.segMinutes.length && second.cumTimes[idx + 1] <= elapsed) idx++;
      for (let i = idx + 1; i < second.stops.length; i++) {
        const arriveOffset = second.cumTimes[i] - elapsed;
        const etaMin = absT + arriveOffset;
        if (etaMin > horizonMin) return;
        out.push({
          lineCode: plan.lineCode,
          direction: second.direction,
          busId,
          stopCode: second.stops[i].stopCode,
          stopSeq: second.stops[i].seq,
          etaMin: Math.max(0, Math.round(etaMin)),
          etaClock: formatClock(now + etaMin),
          confidence,
        });
      }
      absT += firstTotal + reg + secondTotal - tInCycle;
      tInCycle = firstTotal + reg + secondTotal;
    }
    // Regulación en base de origen → reinicio de ciclo.
    absT += plan.cycleMin - tInCycle;
    tInCycle = 0;
    if (absT > horizonMin) return;
  }
}

// Snapshot conveniente para mapa/dashboard: devuelve flota + ETAs derivadas + métricas.
// La flota viene de generateActiveFleet, que ya impone las normas del carrusel
// (horarios oficiales, flota N, espera obligatoria en terminales, no-adelanto).
// Sobre eso siguen actuando los validadores, el cap por perfil y el failsafe.
export function predictLineFromFleet(
  data: BusEngineData,
  lineCode: string,
  at: Date = new Date(),
): {
  line: string;
  timestamp: string;
  buses: VirtualBus[];
  stops: StopEta[];
  activeBusCount: number;
  averageCycleMinutes: number;
  headwayMinutes: number;
  confidence: number;
  realtimeAgeSeconds: number | null;
} {
  const plan = buildLineFleetPlan(data, lineCode, at);
  const { fleet: fleetRaw } = generateActiveFleet(plan, at);

  const etasRaw = deriveStopEtas(plan, fleetRaw, at);

  // Validación temporal POST-ETA (monotonicidad, orígenes múltiples).
  const tc = validateTemporalConsistency({
    fleet: fleetRaw,
    etas: etasRaw,
    cycleMin: plan.cycleMin,
  });
  let fleet = tc.fleet;
  let etas = tc.etas;

  const avgConf =
    fleet.length > 0
      ? fleet.reduce((acc, b) => acc + b.confidence, 0) / fleet.length
      : 0.4;
  const cycleConf = data.cycleStats.get(lineCode)?.confidence ?? 0.3;
  const confidence = Math.max(0, Math.min(1, avgConf * 0.7 + Number(cycleConf) * 0.3));

  // Failsafe: si la calidad es baja, ocultamos buses dudosos.
  if (confidence < 0.5) {
    const keepIds = new Set(fleet.filter((b) => b.confidence >= 0.6).map((b) => b.busId));
    if (keepIds.size > 0) {
      fleet = fleet.filter((b) => keepIds.has(b.busId));
      etas = etas.filter((e) => !e.busId || keepIds.has(e.busId));
    }
  }

  return {
    line: lineCode,
    timestamp: at.toISOString(),
    buses: fleet,
    stops: etas,
    activeBusCount: fleet.filter((b) => b.status === "moving" || b.status === "terminal_wait").length,
    averageCycleMinutes: plan.cycleMin,
    headwayMinutes: plan.headwayMin,
    confidence,
    realtimeAgeSeconds: null,
  };
}


// Resuelve ETAs en una parada concreta (todas las líneas que pasan por ella).
export function predictStopFromFleet(
  data: BusEngineData,
  stopCode: string,
  at: Date = new Date(),
): Array<{
  line: string;
  direction: Direction;
  etaMin: number;
  etaClock: string;
  confidence: number;
  destination: string;
}> {
  const linesAt = new Set(data.stops.filter((s) => s.stopCode === stopCode).map((s) => s.lineCode));
  const results: Array<{
    line: string;
    direction: Direction;
    etaMin: number;
    etaClock: string;
    confidence: number;
    destination: string;
  }> = [];

  for (const line of linesAt) {
    const state = predictLineFromFleet(data, line, at);
    const seenDir = new Map<Direction, number>();
    for (const eta of state.stops) {
      if (eta.stopCode !== stopCode) continue;
      const k = eta.direction;
      const count = seenDir.get(k) ?? 0;
      if (count >= 3) continue;
      seenDir.set(k, count + 1);
      const dirStops = data.stops
        .filter((s) => s.lineCode === line && s.direction === eta.direction)
        .sort((a, b) => a.seq - b.seq);
      const dest = dirStops[dirStops.length - 1]?.stopName ?? "";
      results.push({
        line,
        direction: eta.direction,
        etaMin: eta.etaMin,
        etaClock: eta.etaClock,
        confidence: eta.confidence,
        destination: dest,
      });
    }
  }
  return results.sort((a, b) => a.etaMin - b.etaMin);
}

// Re-export utilitario para herramientas que necesiten enumerar paradas.
export type { LatLng, StopMeta };
