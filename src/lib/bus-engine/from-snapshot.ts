// Convierte el snapshot crudo del servidor en estructuras del motor.

import type {
  BusEngineData,
  CycleStat,
  Direction,
  LineStop,
  ScheduledDeparture,
  SegmentStat,
  ServiceWindow,
  StopMeta,
} from "./types";
import { parseHHMMtoMin } from "./schedule";
import { segmentKey } from "./segments";
import type { BusEngineSnapshot } from "@/lib/bus-predict.functions";

function asDirection(n: number): Direction {
  return n === 2 || n === 0 ? 2 : 1;
}

// El esquema actual de bus_line_departures usa direction smallint (0/1).
// Tratamos 0 como dirección 2 (vuelta) para alinear con bus_line_stops (1/2).
function normalizeDirSmallint(n: number): Direction {
  if (n === 1) return 1;
  return 2;
}

export function fromSnapshot(snap: BusEngineSnapshot): BusEngineData {
  const stops: LineStop[] = snap.stops.map((s) => ({
    lineCode: s.line_code,
    direction: asDirection(s.direction),
    seq: s.seq,
    stopCode: s.stop_code,
    stopName: s.stop_name,
  }));

  const stopsMeta = new Map<string, StopMeta>();
  for (const m of snap.stopsMeta) {
    stopsMeta.set(m.code, { code: m.code, name: m.name, lat: m.lat, lng: m.lng });
  }

  const segmentStats = new Map<string, SegmentStat>();
  for (const s of snap.segmentStats) {
    const dir = asDirection(s.direction);
    const item: SegmentStat = {
      lineCode: s.line_code,
      direction: dir,
      fromStop: s.from_stop,
      toStop: s.to_stop,
      distanceM: s.distance_m,
      avgMinutes: Number(s.avg_minutes),
      rushMinutes: s.rush_minutes == null ? null : Number(s.rush_minutes),
      nightMinutes: s.night_minutes == null ? null : Number(s.night_minutes),
      weekendMinutes: s.weekend_minutes == null ? null : Number(s.weekend_minutes),
      holidayMinutes: s.holiday_minutes == null ? null : Number(s.holiday_minutes),
      samples: s.samples,
      variance: Number(s.variance),
      confidence: Number(s.confidence),
    };
    segmentStats.set(segmentKey(s.line_code, dir, s.from_stop, s.to_stop), item);
  }

  const cycleStats = new Map<string, CycleStat>();
  for (const c of snap.cycleStats) {
    cycleStats.set(c.line_code, {
      lineCode: c.line_code,
      cycleAvgMin: Number(c.cycle_avg_min),
      cycleMorningMin: c.cycle_morning_min == null ? null : Number(c.cycle_morning_min),
      cycleMiddayMin: c.cycle_midday_min == null ? null : Number(c.cycle_midday_min),
      cycleAfternoonMin: c.cycle_afternoon_min == null ? null : Number(c.cycle_afternoon_min),
      cycleNightMin: c.cycle_night_min == null ? null : Number(c.cycle_night_min),
      cycleWeekendMin: c.cycle_weekend_min == null ? null : Number(c.cycle_weekend_min),
      terminalWaitAvgMin: Number(c.terminal_wait_avg_min),
      samples: c.samples,
      confidence: Number(c.confidence),
    });
  }

  const departures: ScheduledDeparture[] = snap.departures
    .filter((d) => ["laborable", "sabado", "domingo", "festivo"].includes(d.day_type))
    .map((d) => ({
      lineCode: d.line_code,
      direction: normalizeDirSmallint(d.direction),
      departureMin: parseHHMMtoMin(d.departure_time.slice(0, 5)),
      dayType: d.day_type as ScheduledDeparture["dayType"],
    }));

  const serviceWindows: ServiceWindow[] = snap.serviceWindows.map((w) => ({
    lineCode: w.line_code,
    direction: normalizeDirSmallint(w.direction),
    dayType: w.day_type,
    firstDepartureMin: parseHHMMtoMin(w.first_departure.slice(0, 5)),
    lastDepartureMin: parseHHMMtoMin(w.last_departure.slice(0, 5)),
  }));

  return {
    stops,
    stopsMeta,
    segmentStats,
    cycleStats,
    departures,
    serviceWindows,
    fetchedAt: Date.parse(snap.fetchedAt),
  };
}
