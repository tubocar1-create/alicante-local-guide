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
  reopensDayLabel: string | null; // p.ej. "viernes" si no opera hoy
  isNightLine: boolean;
  hasData: boolean;
};

const DAY_NAMES = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];

function nextServiceDay(
  rows: ServiceWindowRow[],
  lineCode: string,
  from: Date,
): { dayType: string; date: Date } | null {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from.getTime() + i * 24 * 60 * 60_000);
    const dt = dayTypeOf(d);
    if (rows.some((r) => r.line_code === lineCode && r.day_type === dt)) {
      return { dayType: dt, date: d };
    }
  }
  return null;
}

/**
 * Devuelve el estado de servicio para una línea en `now`.
 * Para líneas nocturnas detectadas a partir de cualquier día_type, indica
 * cuándo es el próximo servicio si hoy no opera.
 */
export function getServiceStatus(
  rows: ServiceWindowRow[] | null,
  lineCode: string | undefined,
  now: Date = new Date(),
  originTerminalName?: string,
): ServiceStatus {
  const empty: ServiceStatus = {
    outOfService: false,
    firstDeparture: null,
    lastDeparture: null,
    reopensAt: null,
    reopensDayLabel: null,
    isNightLine: false,
    hasData: false,
  };
  if (!rows || !lineCode) return empty;

  const allLineRows = rows.filter((r) => r.line_code === lineCode);
  if (allLineRows.length === 0) return empty;

  // Si conocemos el terminal de origen del recorrido del usuario, filtramos
  // por esa dirección para no mezclar horarios de ambos sentidos.
  const dirRows = originTerminalName
    ? allLineRows.filter((r) => r.terminal_name === originTerminalName)
    : allLineRows;
  const effectiveRows = dirRows.length > 0 ? dirRows : allLineRows;

  const isNight = effectiveRows.some(
    (r) => toMin(r.last_departure) < toMin(r.first_departure),
  );

  const dayType = dayTypeOf(now);
  const todayRows = effectiveRows.filter((r) => r.day_type === dayType);

  if (todayRows.length === 0) {
    if (isNight) {
      // Un turno nocturno arranca el día anterior (p.ej. "sabado" 23:30
      // → 06:30 cubre la madrugada del domingo). Si la madrugada actual
      // está dentro de la ventana de ayer, seguimos EN servicio.
      const yesterday = new Date(now.getTime() - 24 * 60 * 60_000);
      const yDay = dayTypeOf(yesterday);
      const yRows = effectiveRows.filter((r) => r.day_type === yDay);
      const nowMinNow = now.getHours() * 60 + now.getMinutes();
      const yNightRows = yRows.filter(
        (r) => toMin(r.last_departure) < toMin(r.first_departure),
      );
      if (yNightRows.length > 0) {
        const yLastMin = Math.max(...yNightRows.map((r) => toMin(r.last_departure)));
        const yFirstMin = Math.min(...yNightRows.map((r) => toMin(r.first_departure)));
        if (nowMinNow <= yLastMin) {
          return {
            outOfService: false,
            firstDeparture: fmtHM(yFirstMin),
            lastDeparture: null,
            reopensAt: null,
            reopensDayLabel: null,
            isNightLine: true,
            hasData: true,
          };
        }
      }
      const nxt = nextServiceDay(allLineRows, lineCode, now);
      if (nxt) {
        const nxtRows = effectiveRows.filter((r) => r.day_type === nxt.dayType);
        if (nxtRows.length > 0) {
          const firstMin = Math.min(...nxtRows.map((r) => toMin(r.first_departure)));
          // Un servicio nocturno con day_type "sabado"/"festivo" que arranca
          // a última hora (>= 18:00) en realidad parte la tarde-noche del
          // día anterior. Mostramos ese día en la etiqueta.
          const physicalDate =
            firstMin >= 18 * 60
              ? new Date(nxt.date.getTime() - 24 * 60 * 60_000)
              : nxt.date;
          return {
            outOfService: true,
            firstDeparture: fmtHM(firstMin),
            lastDeparture: null,
            reopensAt: fmtHM(firstMin),
            reopensDayLabel: DAY_NAMES[physicalDate.getDay()],
            isNightLine: true,
            hasData: true,
          };
        }
      }
    }
    return { ...empty, isNightLine: isNight, hasData: false };
  }

  const firstMin = Math.min(...todayRows.map((r) => toMin(r.first_departure)));
  const lastMin = Math.max(...todayRows.map((r) => toMin(r.last_departure)));
  const nowMin = now.getHours() * 60 + now.getMinutes();

  let outOfService = false;
  let reopensMin: number | null = null;

  if (isNight) {
    const inService = nowMin >= firstMin || nowMin <= lastMin;
    outOfService = !inService;
    if (outOfService) reopensMin = firstMin;
  } else if (nowMin < firstMin) {
    outOfService = true;
    reopensMin = firstMin;
  } else if (nowMin > lastMin) {
    outOfService = true;
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
    const tDay = dayTypeOf(tomorrow);
    const tRows = effectiveRows.filter((r) => r.day_type === tDay);
    reopensMin = tRows.length
      ? Math.min(...tRows.map((r) => toMin(r.first_departure)))
      : firstMin;
  }

  return {
    outOfService,
    firstDeparture: fmtHM(firstMin),
    lastDeparture: isNight ? null : fmtHM(lastMin),
    reopensAt: reopensMin == null ? null : fmtHM(reopensMin),
    reopensDayLabel: null,
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
 * asumiendo salidas horarias desde el terminal de origen (cadencia ~60 min,
 * según la tabla oficial de Vectalia). `offsetMinutes` es el tiempo
 * estimado desde el terminal de origen hasta la parada del usuario,
 * calculado por el llamador a partir de la distancia recorrida.
 */
export function getNightLineEstimates(
  rows: ServiceWindowRow[] | null,
  lineCode: string,
  originTerminalName: string,
  offsetMinutes: number,
  now: Date = new Date(),
  count = 4,
): NightEstimate | null {
  if (!rows) return null;
  const dayType = dayTypeOf(now);
  // Buscar la ventana cuyo terminal de salida coincide con el origen del
  // recorrido del usuario (primera parada de su sentido en bus_line_stops).
  const todayRows = rows.filter(
    (r) =>
      r.line_code === lineCode &&
      r.day_type === dayType &&
      r.terminal_name === originTerminalName,
  );
  if (todayRows.length === 0) return null;
  const sw = todayRows[0];
  const firstMin = toMinHM(sw.first_departure);
  const lastMin = toMinHM(sw.last_departure);
  const isNight = lastMin < firstMin;
  if (!isNight) return null;

  // Salidas horarias desde el terminal de origen (23:30, 00:30, 01:30…).
  const departures: number[] = [];
  const windowEnd = lastMin + 24 * 60;
  for (let t = firstMin; t <= windowEnd; t += 60) departures.push(t);

  const offset = Math.max(0, Math.round(offsetMinutes));
  const nowMin = now.getHours() * 60 + now.getMinutes();
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
  return { upcoming, originTerminal: sw.terminal_name, tripMinutes: offset };
}
