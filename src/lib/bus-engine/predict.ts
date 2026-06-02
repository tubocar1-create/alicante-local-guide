// API pública del motor predictivo.
//
// IMPORTANTE: a partir de la fase 1 del rediseño, el motor es BUS-FIRST.
// Toda la lógica viva está en `fleet.ts`. Este archivo se mantiene como
// fachada para no romper los imports existentes en componentes y server fns.

import type { BusEngineData, Direction, StopEta, VirtualBus } from "./types";
import { predictLineFromFleet, predictStopFromFleet } from "./fleet";

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
  const res = predictLineFromFleet(data, lineCode, at);
  // Mantenemos la forma legacy (sin headwayMinutes) para no romper consumidores.
  return {
    line: res.line,
    timestamp: res.timestamp,
    buses: res.buses,
    stops: res.stops,
    activeBusCount: res.activeBusCount,
    averageCycleMinutes: res.averageCycleMinutes,
    confidence: res.confidence,
    realtimeAgeSeconds: res.realtimeAgeSeconds,
  };
}

export function predictStopArrivals(
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
  return predictStopFromFleet(data, stopCode, at);
}
