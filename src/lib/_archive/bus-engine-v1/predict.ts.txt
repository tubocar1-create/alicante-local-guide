// API pública legacy del "motor predictivo".
//
// REFACTOR (regla nueva): NO se inventan buses ni se simulan trayectos.
// Vectalia es la única fuente operativa. Estas funciones quedan como
// stubs vacíos para no romper imports históricos: los consumidores deben
// migrar a `useLineRealtime` / `getLineRealtimeState` / `getStopRealtimeState`.
//
// Cualquier llamada a las funciones de abajo devuelve estado vacío en lugar
// de generar flota sintética, ciclos recursivos o ETAs imaginarias.

import type { BusEngineData, Direction, StopEta, VirtualBus } from "./types";

export function predictLineState(
  _data: BusEngineData,
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
  return {
    line: lineCode,
    timestamp: at.toISOString(),
    buses: [],
    stops: [],
    activeBusCount: 0,
    averageCycleMinutes: 0,
    confidence: 0,
    realtimeAgeSeconds: null,
  };
}

export function predictStopArrivals(
  _data: BusEngineData,
  _stopCode: string,
  _at: Date = new Date(),
): Array<{
  line: string;
  direction: Direction;
  etaMin: number;
  etaClock: string;
  confidence: number;
  destination: string;
}> {
  return [];
}
