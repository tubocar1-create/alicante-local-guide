// Motor ETA estimado (Fase 4 del plan PRE_ESTIMATED_BUS_ENGINE).
//
// Calcula próximas llegadas a una parada usando horarios oficiales Vectalia
// (public/data/vectalia_schedule.json) sin tocar red ni Akamai. 100% cliente.
//
// SCOPE:
// - Cubre las líneas diurnas urbanas: 01, 02, 03, 04, 05, 06, 07, 08A, 09, 12,
//   13, 14, 22, 39.
// - EXCLUIDAS por ahora (24, 27, 28): horarios complejos / interurbanos, se
//   tratarán aparte.
// - EXCLUIDAS las nocturnas (03N, 13N, 22N): ya tienen lógica propia
//   (cumulativeMinutes + service window) en `useBusServiceWindow` y los
//   dashboards. NO se debe interceptar.

import type { StopArrival } from "@/lib/bus-realtime-client";
import { busStaticGraph } from "@/data/bus-static";

const EXCLUDED_LINES = new Set(["24", "27", "28"]);

// Velocidad de avance estimada entre paradas urbanas (min/parada).
const MIN_PER_STOP = 1.6;
// Horizonte máximo de ETA mostrado.
const MAX_ETA_MIN = 90;

type ScheduleRouteStop = { code: string; name: string };
type ScheduleLine = {
  code: string;
  name: string;
  routes: ScheduleRouteStop[][];
  schedule: {
    firstDeparture: string; // "HH:MM"
    lastDeparture: string;
    uniqueDepartures: number;
    avgGapMin: number;
    medianGapMin: number;
  };
};

let schedulePromise: Promise<Map<string, ScheduleLine>> | null = null;

function normalizeLineCode(code: string): string {
  return code.trim().toUpperCase();
}

export function isNightLine(line: string): boolean {
  return /N$/i.test(line.trim());
}

export function isEstimatedSupported(line: string): boolean {
  const c = normalizeLineCode(line);
  if (!c) return false;
  if (isNightLine(c)) return false;
  if (EXCLUDED_LINES.has(c)) return false;
  return true;
}

async function loadSchedule(): Promise<Map<string, ScheduleLine>> {
  if (schedulePromise) return schedulePromise;
  schedulePromise = (async () => {
    const res = await fetch("/data/vectalia_schedule.json", { cache: "force-cache" });
    if (!res.ok) throw new Error("schedule fetch failed");
    const list: ScheduleLine[] = await res.json();
    const map = new Map<string, ScheduleLine>();
    for (const l of list) map.set(normalizeLineCode(l.code), l);
    return map;
  })().catch((err) => {
    schedulePromise = null;
    throw err;
  });
  return schedulePromise;
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return h * 60 + m;
}

function findStopSeq(line: string, stopCode: string): number | null {
  // Devuelve el menor seqIndex (0-based) del stopCode dentro de cualquier
  // dirección de la línea en bus-static. Si no aparece, null.
  const lineNumeric = normalizeLineCode(line).replace(/^0+/, "").toUpperCase();
  let best: number | null = null;
  for (const s of busStaticGraph.stops as Array<{
    line_code: string;
    direction: number;
    seq: number;
    stop_code: string;
  }>) {
    const lc = String(s.line_code).toUpperCase();
    if (lc !== lineNumeric) continue;
    if (s.stop_code !== stopCode) continue;
    const seq0 = s.seq - 1;
    if (best === null || seq0 < best) best = seq0;
  }
  return best;
}

function findStopSeqFromSchedule(line: ScheduleLine, stopCode: string): number | null {
  let best: number | null = null;
  for (const route of line.routes) {
    const idx = route.findIndex((st) => st.code === stopCode);
    if (idx >= 0 && (best === null || idx < best)) best = idx;
  }
  return best;
}

function destinationFor(line: ScheduleLine, stopCode: string): string {
  for (const route of line.routes) {
    const idx = route.findIndex((st) => st.code === stopCode);
    if (idx >= 0 && idx < route.length - 1) {
      return route[route.length - 1].name;
    }
  }
  return line.name;
}

export async function getEstimatedStopArrivals({
  stopCode,
  line,
  now = new Date(),
}: {
  stopCode: string;
  line: string;
  now?: Date;
}): Promise<StopArrival[]> {
  if (!isEstimatedSupported(line)) return [];
  const map = await loadSchedule();
  const lineKey = normalizeLineCode(line);
  const lineData = map.get(lineKey);
  if (!lineData) return [];

  // seqIndex desde bus-static (más fiable) o, si no aparece, desde la propia
  // ruta del schedule.
  let seq = findStopSeq(lineKey, stopCode);
  if (seq === null) seq = findStopSeqFromSchedule(lineData, stopCode);
  if (seq === null) return [];

  const firstMin = hhmmToMin(lineData.schedule.firstDeparture);
  const lastMin = hhmmToMin(lineData.schedule.lastDeparture);
  const gap = Math.max(2, lineData.schedule.medianGapMin || lineData.schedule.avgGapMin || 10);
  const travelMin = Math.round(seq * MIN_PER_STOP);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const dest = destinationFor(lineData, stopCode);
  const arrivals: StopArrival[] = [];

  for (let dep = firstMin; dep <= lastMin; dep += gap) {
    const arrivalMin = dep + travelMin;
    const eta = arrivalMin - nowMin;
    if (eta < 0) continue;
    if (eta > MAX_ETA_MIN) break;
    arrivals.push({
      line: lineKey,
      destination: dest,
      etaMin: eta,
      lat: null,
      lng: null,
    });
    if (arrivals.length >= 5) break;
  }

  return arrivals;
}
