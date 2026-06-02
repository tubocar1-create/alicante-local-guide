// Núcleo del motor: reconstruye buses virtuales activos y calcula ETAs por parada.

import type {
  BusEngineData,
  CycleStat,
  Direction,
  LineStop,
  StopEta,
  VirtualBus,
} from "./types";
import { haversineMeters, lerp } from "./geometry";
import { segmentKey, segmentMinutes, segmentBaselineMin } from "./segments";
import {
  formatClock,
  getDeparturesForLine,
  nowMinutes,
} from "./schedule";
import { dayType, detectProfile } from "./peak-detector";

// Devuelve las paradas ordenadas con sus coordenadas.
function orderedStops(
  data: BusEngineData,
  lineCode: string,
  direction: Direction,
): Array<LineStop & { lat: number | null; lng: number | null }> {
  const list = data.stops
    .filter((s) => s.lineCode === lineCode && s.direction === direction)
    .sort((a, b) => a.seq - b.seq);
  return list.map((s) => {
    const meta = data.stopsMeta.get(s.stopCode);
    return { ...s, lat: meta?.lat ?? null, lng: meta?.lng ?? null };
  });
}

// Calcula tiempos acumulados (min) desde la parada 0 hasta cada parada de la lista.
function cumulativeStopTimes(
  data: BusEngineData,
  lineCode: string,
  direction: Direction,
  stops: Array<LineStop & { lat: number | null; lng: number | null }>,
  d: Date,
): { times: number[]; segMinutes: number[]; distances: number[]; conf: number[] } {
  const profile = detectProfile(d);
  const times: number[] = [0];
  const segMinutes: number[] = [];
  const distances: number[] = [];
  const conf: number[] = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const distance =
      a.lat != null && a.lng != null && b.lat != null && b.lng != null
        ? haversineMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
        : 250;
    const stat = data.segmentStats.get(
      segmentKey(lineCode, direction, a.stopCode, b.stopCode),
    );
    const seg = segmentMinutes({ stat, distanceM: distance, profile });
    segMinutes.push(seg.minutes);
    distances.push(distance);
    conf.push(seg.confidence);
    times.push(times[i - 1] + seg.minutes);
  }
  return { times, segMinutes, distances, conf };
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

export function predictLineState(
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
  confidence: number;
  realtimeAgeSeconds: number | null;
} {
  const now = nowMinutes(at);
  const dt = dayType(at);
  const cycle = data.cycleStats.get(lineCode);
  const buses: VirtualBus[] = [];
  const stopEtas: StopEta[] = [];

  for (const direction of [1, 2] as Direction[]) {
    const stops = orderedStops(data, lineCode, direction);
    if (stops.length < 2) continue;

    const { times: cumTimes, segMinutes, conf } = cumulativeStopTimes(
      data,
      lineCode,
      direction,
      stops,
      at,
    );
    const totalMin = cumTimes[cumTimes.length - 1];
    const cycleMin = cycleDurationMin(cycle, totalMin * 2 + 5, at);

    const departures = getDeparturesForLine({
      lineCode,
      direction,
      dayType: dt,
      departures: data.departures,
      windows: data.serviceWindows,
    });

    // Considerar salidas en ventana [now - totalMin - 5, now + 1] para mover buses activos.
    const minDep = now - totalMin - 5;
    const maxDep = now + 1;
    const active = departures.filter((d) => d.departureMin >= minDep && d.departureMin <= maxDep);

    for (const dep of active) {
      const elapsed = now - dep.departureMin;
      let status: VirtualBus["status"] = "moving";
      let segIdx = 0;
      let segProg = 0;
      let position = stops[0].lat != null && stops[0].lng != null
        ? { lat: stops[0].lat, lng: stops[0].lng }
        : null;
      let busConf = 0.5;

      if (elapsed < 0) {
        status = "terminal_wait";
      } else if (elapsed >= totalMin) {
        status = "finished";
        const last = stops[stops.length - 1];
        if (last.lat != null && last.lng != null) position = { lat: last.lat, lng: last.lng };
        segIdx = stops.length - 2;
        segProg = 1;
      } else {
        // Encontrar segmento actual
        let idx = 0;
        while (idx < segMinutes.length && cumTimes[idx + 1] <= elapsed) idx++;
        segIdx = idx;
        const segElapsed = elapsed - cumTimes[idx];
        segProg = segMinutes[idx] > 0 ? Math.min(1, segElapsed / segMinutes[idx]) : 0;
        const a = stops[idx];
        const b = stops[idx + 1];
        if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
          position = lerp({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }, segProg);
        }
        busConf = conf[idx] ?? 0.4;
      }

      const busId = `${lineCode}_${direction === 1 ? "IDA" : "VUELTA"}_${formatClock(dep.departureMin)}`;
      buses.push({
        busId,
        lineCode,
        direction,
        status,
        departureMin: dep.departureMin,
        elapsedMin: Math.max(0, elapsed),
        segmentIndex: segIdx,
        segmentProgress: segProg,
        position,
        delayMin: 0,
        confidence: busConf,
      });

      // ETAs para cada parada por delante de este bus (status moving o terminal_wait).
      if (status === "moving" || status === "terminal_wait") {
        const startIdx = status === "terminal_wait" ? 0 : segIdx + 1;
        for (let i = startIdx; i < stops.length; i++) {
          const arrivalAbsMin = dep.departureMin + cumTimes[i];
          const etaMin = arrivalAbsMin - now;
          if (etaMin < 0 || etaMin > 60) continue;
          stopEtas.push({
            lineCode,
            direction,
            busId,
            etaMin: Math.round(etaMin),
            etaClock: formatClock(arrivalAbsMin),
            confidence: busConf,
          });
        }
      }
    }

    void cycleMin; // reservado para fase 4
  }

  // Métricas agregadas para el dashboard / mapa.
  const activeBuses = buses.filter((b) => b.status === "moving" || b.status === "terminal_wait");
  const activeBusCount = activeBuses.length;
  const cycle = data.cycleStats.get(lineCode);
  const averageCycleMinutes = cycle ? Number(cycle.cycleAvgMin) : 0;
  const avgBusConfidence = activeBuses.length
    ? activeBuses.reduce((acc, b) => acc + b.confidence, 0) / activeBuses.length
    : 0.4;
  const cycleConfidence = cycle ? Number(cycle.confidence) : 0.3;
  const confidence = Math.max(0, Math.min(1, avgBusConfidence * 0.7 + cycleConfidence * 0.3));

  return {
    line: lineCode,
    timestamp: at.toISOString(),
    buses,
    stops: stopEtas.sort((a, b) => a.etaMin - b.etaMin),
    activeBusCount,
    averageCycleMinutes,
    confidence,
    realtimeAgeSeconds: null,
  };
}

// ETA para una parada específica: filtra y agrupa por línea.
export function predictStopArrivals(
  data: BusEngineData,
  stopCode: string,
  at: Date = new Date(),
): Array<{ line: string; direction: Direction; etaMin: number; etaClock: string; confidence: number; destination: string }> {
  // Encontrar todas las (line, dir) que pasan por esta parada
  const passages = data.stops.filter((s) => s.stopCode === stopCode);
  if (passages.length === 0) return [];

  const results: Array<{ line: string; direction: Direction; etaMin: number; etaClock: string; confidence: number; destination: string }> = [];
  const linesProcessed = new Set<string>();

  for (const p of passages) {
    if (linesProcessed.has(p.lineCode)) continue;
    linesProcessed.add(p.lineCode);
    const state = predictLineState(data, p.lineCode, at);
    // Buscar ETAs que correspondan a esta parada
    for (const dir of [1, 2] as Direction[]) {
      const orderedFor = data.stops
        .filter((s) => s.lineCode === p.lineCode && s.direction === dir)
        .sort((a, b) => a.seq - b.seq);
      const stopIdxInLine = orderedFor.findIndex((s) => s.stopCode === stopCode);
      if (stopIdxInLine < 0) continue;
      const destStop = orderedFor[orderedFor.length - 1];
      // Mapear ETAs por bus: necesitamos recalcular para esta parada
      for (const bus of state.buses) {
        if (bus.direction !== dir) continue;
        if (bus.status === "finished" || bus.status === "inactive") continue;
        // Si el bus ya pasó esta parada, descartar
        if (bus.status === "moving" && bus.segmentIndex >= stopIdxInLine) continue;
        // Recalcular cumulative para esta dirección y restar elapsed
        const stops = orderedFor.map((s) => {
          const meta = data.stopsMeta.get(s.stopCode);
          return { ...s, lat: meta?.lat ?? null, lng: meta?.lng ?? null };
        });
        const profile = detectProfile(at);
        let arrivalFromDepart = 0;
        for (let i = 0; i < stopIdxInLine; i++) {
          const a = stops[i];
          const b = stops[i + 1];
          const distance =
            a.lat != null && a.lng != null && b.lat != null && b.lng != null
              ? haversineMeters({ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng })
              : 250;
          const stat = data.segmentStats.get(
            segmentKey(p.lineCode, dir, a.stopCode, b.stopCode),
          );
          const seg = segmentMinutes({ stat, distanceM: distance, profile });
          arrivalFromDepart += seg.minutes;
          if (!stat) void segmentBaselineMin(distance, profile);
        }
        const etaMin = Math.round(bus.departureMin + arrivalFromDepart - nowMinutes(at));
        if (etaMin < 0 || etaMin > 90) continue;
        results.push({
          line: p.lineCode,
          direction: dir,
          etaMin,
          etaClock: formatClock(bus.departureMin + arrivalFromDepart),
          confidence: bus.confidence,
          destination: destStop?.stopName ?? "",
        });
      }
    }
  }

  return results.sort((a, b) => a.etaMin - b.etaMin);
}
