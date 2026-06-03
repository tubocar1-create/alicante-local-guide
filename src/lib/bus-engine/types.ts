import type { LatLng } from "./geometry";

export type Direction = 1 | 2;

export type LineStop = {
  lineCode: string;
  direction: Direction;
  seq: number;
  stopCode: string;
  stopName: string;
};

export type StopMeta = {
  code: string;
  name: string | null;
  lat: number | null;
  lng: number | null;
};

export type SegmentStat = {
  lineCode: string;
  direction: Direction;
  fromStop: string;
  toStop: string;
  distanceM: number | null;
  avgMinutes: number;
  rushMinutes: number | null;
  nightMinutes: number | null;
  weekendMinutes: number | null;
  holidayMinutes: number | null;
  samples: number;
  variance: number;
  confidence: number;
};

export type CycleStat = {
  lineCode: string;
  cycleAvgMin: number;
  cycleMorningMin: number | null;
  cycleMiddayMin: number | null;
  cycleAfternoonMin: number | null;
  cycleNightMin: number | null;
  cycleWeekendMin: number | null;
  terminalWaitAvgMin: number;
  samples: number;
  confidence: number;
};

export type ScheduledDeparture = {
  lineCode: string;
  direction: Direction;
  departureMin: number; // minutos desde medianoche
  dayType: "laborable" | "sabado" | "domingo" | "festivo";
};

export type ServiceWindow = {
  lineCode: string;
  direction: Direction;
  dayType: string;
  firstDepartureMin: number;
  lastDepartureMin: number;
  terminalName: string | null;
};

export type BusEngineData = {
  stops: LineStop[];
  stopsMeta: Map<string, StopMeta>;
  segmentStats: Map<string, SegmentStat>; // key = `${line}|${dir}|${from}|${to}`
  cycleStats: Map<string, CycleStat>; // key = lineCode
  departures: ScheduledDeparture[];
  serviceWindows: ServiceWindow[];
  fetchedAt: number;
};

export type VirtualBus = {
  busId: string;
  lineCode: string;
  direction: Direction;
  status: "moving" | "terminal_wait" | "finished" | "inactive";
  departureMin: number;
  tripDirection?: Direction;
  tripElapsedMin?: number;
  elapsedMin: number;
  segmentIndex: number;
  segmentProgress: number;
  position: LatLng | null;
  delayMin: number;
  confidence: number;
  // Telemetría (fase 3): anclaje + seguridad
  anchoredDeparture?: boolean;
  originTerminal?: string | null;
  serviceSlot?: string;
  phaseErrorSec?: number;
  reliability?: number;
  speedKmh?: number | null;
  lastObservationSec?: number | null;
  safeMode?: boolean;
};


export type StopEta = {
  lineCode: string;
  direction: Direction;
  busId: string | null;
  stopCode: string;
  stopSeq: number;
  etaMin: number;
  etaClock: string;
  confidence: number;
};

