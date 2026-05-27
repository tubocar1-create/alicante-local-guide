import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ServiceWindowRow = {
  line_code: string;
  direction: number;
  terminal_name: string;
  day_type: string; // laborable | sabado | domingo | festivo
  first_departure: string; // HH:MM:SS
  last_departure: string; // HH:MM:SS
};

type Cache = ServiceWindowRow[];

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

async function load(): Promise<Cache> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("bus_line_service_windows")
      .select("line_code,direction,terminal_name,day_type,first_departure,last_departure");
    cache = (data ?? []) as Cache;
    return cache;
  })();
  const r = await inflight;
  inflight = null;
  return r;
}

export function useBusServiceWindows() {
  const [rows, setRows] = useState<Cache | null>(cache);
  useEffect(() => {
    if (cache) return;
    load().then(setRows);
  }, []);
  return rows;
}

export function dayTypeOf(d: Date): "laborable" | "sabado" | "domingo" {
  const dow = d.getDay();
  if (dow === 0) return "domingo";
  if (dow === 6) return "sabado";
  return "laborable";
}

export function toMinHM(hms: string): number {
  const [h, m] = hms.split(":").map(Number);
  return h * 60 + m;
}

export function fmtHMMin(mins: number): string {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const toMin = toMinHM;
const fmtHM = fmtHMMin;


export type ServiceStatus = {
  outOfService: boolean;
  firstDeparture: string | null; // HH:MM
  lastDeparture: string | null; // HH:MM
  reopensAt: string | null; // HH:MM si está fuera de servicio
  isNightLine: boolean;
  hasData: boolean;
};

/**
 * Devuelve el estado de servicio para una línea en `now`.
 * Toma la unión de ambos sentidos: primera salida = MIN, última = MAX.
 * Para líneas nocturnas (last < first) la ventana cruza medianoche.
 */
export function getServiceStatus(
  rows: ServiceWindowRow[] | null,
  lineCode: string | undefined,
  now: Date = new Date(),
): ServiceStatus {
  if (!rows || !lineCode) {
    return {
      outOfService: false,
      firstDeparture: null,
      lastDeparture: null,
      reopensAt: null,
      isNightLine: false,
      hasData: false,
    };
  }
  const dayType = dayTypeOf(now);
  const todayRows = rows.filter(
    (r) => r.line_code === lineCode && r.day_type === dayType,
  );
  if (todayRows.length === 0) {
    // sin datos: no bloqueamos
    return {
      outOfService: false,
      firstDeparture: null,
      lastDeparture: null,
      reopensAt: null,
      isNightLine: false,
      hasData: false,
    };
  }
  const firstMin = Math.min(...todayRows.map((r) => toMin(r.first_departure)));
  const lastMin = Math.max(...todayRows.map((r) => toMin(r.last_departure)));
  const isNight = lastMin < firstMin;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let outOfService = false;
  let reopensMin: number | null = null;

  if (isNight) {
    // Nocturna: en servicio si nowMin >= firstMin || nowMin <= lastMin
    const inService = nowMin >= firstMin || nowMin <= lastMin;
    outOfService = !inService;
    if (outOfService) reopensMin = firstMin;
  } else {
    if (nowMin < firstMin) {
      outOfService = true;
      reopensMin = firstMin;
    } else if (nowMin > lastMin) {
      outOfService = true;
      // mañana — usamos el firstMin del siguiente día_type
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
      const tDay = dayTypeOf(tomorrow);
      const tRows = rows.filter(
        (r) => r.line_code === lineCode && r.day_type === tDay,
      );
      reopensMin = tRows.length
        ? Math.min(...tRows.map((r) => toMin(r.first_departure)))
        : firstMin;
    }
  }

  return {
    outOfService,
    firstDeparture: fmtHM(firstMin),
    lastDeparture: fmtHM(lastMin),
    reopensAt: reopensMin == null ? null : fmtHM(reopensMin),
    isNightLine: isNight,
    hasData: true,
  };
}

export type NightEstimate = {
  upcoming: Array<{ minutes: number; arrivalTime: string; departureTime: string }>;
  originTerminal: string;
  tripMinutes: number;
};

/**
 * Para líneas nocturnas: estima las próximas llegadas a la parada del usuario
 * asumiendo salidas horarias desde el terminal de origen (Vectalia opera N
 * con cadencia ~60 min). El offset por parada se aproxima linealmente con
 * `tripMinutes` (30 min por defecto). Los resultados son estimados, no live.
 */
export function getNightLineEstimates(
  rows: ServiceWindowRow[] | null,
  lineCode: string,
  destinationTerminal: string,
  stopSeq: number,
  totalStops: number,
  now: Date = new Date(),
  tripMinutes = 30,
  count = 4,
): NightEstimate | null {
  if (!rows || totalStops <= 0) return null;
  const dayType = dayTypeOf(now);
  // El bus que va hacia destinationTerminal sale del OTRO terminal.
  const todayRows = rows.filter(
    (r) =>
      r.line_code === lineCode &&
      r.day_type === dayType &&
      r.terminal_name !== destinationTerminal,
  );
  if (todayRows.length === 0) return null;
  const sw = todayRows[0];
  const firstMin = toMinHM(sw.first_departure);
  const lastMin = toMinHM(sw.last_departure);
  const isNight = lastMin < firstMin;
  if (!isNight) return null;

  // Lista de salidas (cadencia 60 min) en minutos absolutos desde firstMin.
  const departures: number[] = [];
  // Total minutos operativos: si nocturna, lastMin + 24h.
  const windowEnd = lastMin + 24 * 60;
  for (let t = firstMin; t <= windowEnd; t += 60) departures.push(t);

  // Offset por parada (fracción del recorrido).
  const offset = Math.round((stopSeq / totalStops) * tripMinutes);

  // Convertir "ahora" a minutos comparables con departures.
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Si nowMin < firstMin pero estamos en madrugada, sumamos 24h.
  const nowAdj = nowMin < firstMin && nowMin <= lastMin ? nowMin + 24 * 60 : nowMin;

  const upcoming: NightEstimate["upcoming"] = [];
  for (const dep of departures) {
    const arr = dep + offset;
    const minsAway = arr - nowAdj;
    if (minsAway < -1) continue;
    upcoming.push({
      minutes: Math.max(0, minsAway),
      arrivalTime: fmtHMMin(arr),
      departureTime: fmtHMMin(dep),
    });
    if (upcoming.length >= count) break;
  }
  if (upcoming.length === 0) return null;
  return { upcoming, originTerminal: sw.terminal_name, tripMinutes };
}
