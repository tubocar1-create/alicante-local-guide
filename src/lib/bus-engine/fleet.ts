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
  cycleMin: number;              // duración ciclo completo (ida + regulación + vuelta + regulación)
  terminalRegulationMin: number; // tiempo de regulación en cada terminal
  headwayMin: number;            // headway efectivo según ventana horaria / horarios
  activeBusCount: number;        // flota inferida
  dayType: ReturnType<typeof dayType>;
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
  const fallbackHeadway = dt === "laborable" ? 15 : 20;
  const headwayMin = inferHeadwayMin(idaDeps, now, fallbackHeadway);

  const activeBusCount =
    cycleMin > 0 && headwayMin > 0 ? Math.max(1, Math.round(cycleMin / headwayMin)) : 0;

  return {
    lineCode,
    dirIda: ida,
    dirVuelta: vuelta,
    cycleMin,
    terminalRegulationMin,
    headwayMin,
    activeBusCount,
    dayType: dt,
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
): {
  direction: Direction;
  state: VirtualBus["status"];
  segmentIndex: number;
  segmentProgress: number;
  position: LatLng | null;
  segmentConfidence: number;
} {
  const reg = plan.terminalRegulationMin;
  const idaTotal = plan.dirIda?.totalMin ?? 0;
  const vueltaTotal = plan.dirVuelta?.totalMin ?? 0;
  let t = ((cycleOffset % plan.cycleMin) + plan.cycleMin) % plan.cycleMin;

  // Fase IDA moving
  if (plan.dirIda && t < idaTotal) {
    return locateInDirection(plan.dirIda, t);
  }
  t -= idaTotal;

  // Fase regulación terminal IDA
  if (t < reg) {
    const last = plan.dirIda?.stops[plan.dirIda.stops.length - 1];
    return {
      direction: 1,
      state: "terminal_wait",
      segmentIndex: plan.dirIda ? plan.dirIda.stops.length - 1 : 0,
      segmentProgress: 0,
      position: last && last.lat != null && last.lng != null ? { lat: last.lat, lng: last.lng } : null,
      segmentConfidence: 0.6,
    };
  }
  t -= reg;

  // Fase VUELTA moving
  if (plan.dirVuelta && t < vueltaTotal) {
    return locateInDirection(plan.dirVuelta, t);
  }
  t -= vueltaTotal;

  // Fase regulación terminal VUELTA
  const last = plan.dirVuelta?.stops[plan.dirVuelta.stops.length - 1]
    ?? plan.dirIda?.stops[0];
  return {
    direction: 2,
    state: "terminal_wait",
    segmentIndex: plan.dirVuelta ? plan.dirVuelta.stops.length - 1 : 0,
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
// Cada bus tiene identidad estable: bus_id = `${line}_${slot}` donde slot ∈ [0, N).
// `phaseCorrections` (opcional): Map<slotKey, minutos> a sumar al offset del slot;
// se rellena con los `meta.phase_correction` persistidos en `virtual_buses` y
// permite que las observaciones reales del preview corrijan la posición.
export function generateActiveFleet(
  plan: LineFleetPlan,
  at: Date = new Date(),
  phaseCorrections?: Map<string, number>,
): VirtualBus[] {
  const N = plan.activeBusCount;
  if (N <= 0 || plan.cycleMin <= 0) return [];
  const buses: VirtualBus[] = [];
  const now = nowMinutes(at);
  const slotSpacing = plan.cycleMin / N;

  for (let slot = 0; slot < N; slot++) {
    const slotKey = `BUS${String(slot + 1).padStart(2, "0")}`;
    const correction = phaseCorrections?.get(slotKey) ?? 0;
    const rawOffset = now - slot * slotSpacing + correction;
    const offset = ((rawOffset % plan.cycleMin) + plan.cycleMin) % plan.cycleMin;
    const loc = locateBusInCycle(plan, offset);
    const busId = `${plan.lineCode}_${slotKey}`;
    buses.push({
      busId,
      lineCode: plan.lineCode,
      direction: loc.direction,
      status: loc.state,
      departureMin: now - offset,
      elapsedMin: offset,
      segmentIndex: loc.segmentIndex,
      segmentProgress: loc.segmentProgress,
      position: loc.position,
      delayMin: correction,
      confidence: Math.max(0.35, loc.segmentConfidence * 0.85),
    });
  }
  return buses;
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
    const offset = bus.elapsedMin;
    // Recorremos paradas futuras dentro de los próximos 90 min.
    addStopsFromOffset(plan, offset, bus.busId, now, bus.confidence, out, 90);
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
): void {
  const reg = plan.terminalRegulationMin;
  const ida = plan.dirIda;
  const vuelta = plan.dirVuelta;
  const idaTotal = ida?.totalMin ?? 0;
  const vueltaTotal = vuelta?.totalMin ?? 0;

  // Recorremos el ciclo dos veces como mucho para cubrir 90 min.
  let tInCycle = startOffset;
  let absT = 0; // tiempo desde "ahora" hasta alcanzar cada parada

  const loops = 3;
  for (let loop = 0; loop < loops; loop++) {
    // Fase IDA
    if (ida && tInCycle < idaTotal) {
      // Encontrar próxima parada
      const elapsed = tInCycle;
      let idx = 0;
      while (idx < ida.segMinutes.length && ida.cumTimes[idx + 1] <= elapsed) idx++;
      for (let i = idx + 1; i < ida.stops.length; i++) {
        const arriveOffset = ida.cumTimes[i] - elapsed;
        const etaMin = absT + arriveOffset;
        if (etaMin > horizonMin) return;
        out.push({
          lineCode: plan.lineCode,
          direction: 1,
          busId,
          stopCode: ida.stops[i].stopCode,
          stopSeq: ida.stops[i].seq,
          etaMin: Math.max(0, Math.round(etaMin)),
          etaClock: formatClock(now + etaMin),
          confidence,
        });
      }
      absT += idaTotal - elapsed;
      tInCycle = idaTotal;
    }
    // Fase regulación terminal IDA
    if (tInCycle < idaTotal + reg) {
      absT += idaTotal + reg - tInCycle;
      tInCycle = idaTotal + reg;
    }
    // Fase VUELTA
    if (vuelta && tInCycle < idaTotal + reg + vueltaTotal) {
      const elapsed = tInCycle - idaTotal - reg;
      let idx = 0;
      while (idx < vuelta.segMinutes.length && vuelta.cumTimes[idx + 1] <= elapsed) idx++;
      for (let i = idx + 1; i < vuelta.stops.length; i++) {
        const arriveOffset = vuelta.cumTimes[i] - elapsed;
        const etaMin = absT + arriveOffset;
        if (etaMin > horizonMin) return;
        out.push({
          lineCode: plan.lineCode,
          direction: 2,
          busId,
          stopCode: vuelta.stops[i].stopCode,
          stopSeq: vuelta.stops[i].seq,
          etaMin: Math.max(0, Math.round(etaMin)),
          etaClock: formatClock(now + etaMin),
          confidence,
        });
      }
      absT += idaTotal + reg + vueltaTotal - tInCycle;
      tInCycle = idaTotal + reg + vueltaTotal;
    }
    // Fase regulación terminal VUELTA → reinicio de ciclo
    absT += plan.cycleMin - tInCycle;
    tInCycle = 0;
    if (absT > horizonMin) return;
  }
}

// Snapshot conveniente para mapa/dashboard: devuelve flota + ETAs derivadas + métricas.
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
  const fleet = generateActiveFleet(plan, at);
  const etas = deriveStopEtas(plan, fleet, at);
  const avgConf =
    fleet.length > 0
      ? fleet.reduce((acc, b) => acc + b.confidence, 0) / fleet.length
      : 0.4;
  const cycleConf = data.cycleStats.get(lineCode)?.confidence ?? 0.3;
  const confidence = Math.max(0, Math.min(1, avgConf * 0.7 + Number(cycleConf) * 0.3));
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
