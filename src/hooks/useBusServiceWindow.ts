import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ServiceWindowRow = {
  line_code: string;
  direction: number;
  terminal_name: string; // ORIGEN del trayecto de esa dirección
  day_type: string; // laborable | sabado | domingo | festivo
  first_departure: string; // HH:MM:SS
  last_departure: string; // HH:MM:SS
};

export type DepartureRow = {
  line_code: string;
  direction: number;
  day_type: string;
  departure_time: string; // HH:MM:SS
};

type Cache = ServiceWindowRow[];
type DepCache = DepartureRow[];

let cache: Cache | null = null;
let cacheAt = 0;
let inflight: Promise<Cache> | null = null;
let depCache: DepCache | null = null;
let depCacheAt = 0;
let depInflight: Promise<DepCache> | null = null;
const CACHE_TTL_MS = 60_000;

async function load(): Promise<Cache> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase
      .from("bus_line_service_windows")
      .select("line_code,direction,terminal_name,day_type,first_departure,last_departure");
    cache = (data ?? []) as Cache;
    cacheAt = Date.now();
    return cache;
  })();
  const r = await inflight;
  inflight = null;
  return r;
}

async function loadDepartures(): Promise<DepCache> {
  if (depCache && Date.now() - depCacheAt < CACHE_TTL_MS) return depCache;
  if (depInflight) return depInflight;
  depInflight = (async () => {
    const { data } = await supabase
      .from("bus_line_departures")
      .select("line_code,direction,day_type,departure_time");
    depCache = (data ?? []) as DepCache;
    depCacheAt = Date.now();
    return depCache;
  })();
  const r = await depInflight;
  depInflight = null;
  return r;
}

export function useBusServiceWindows() {
  const [rows, setRows] = useState<Cache | null>(cache);
  useEffect(() => {
    load().then(setRows);
  }, []);
  return rows;
}

export function useBusLineDepartures() {
  const [rows, setRows] = useState<DepCache | null>(depCache);
  useEffect(() => {
    loadDepartures().then(setRows);
  }, []);
  return rows;
}

export function dayTypeOf(d: Date): "laborable" | "sabado" | "domingo" {
  const dow = d.getDay();
  if (dow === 0) return "domingo";
  if (dow === 6) return "sabado";
  return "laborable";
}

// En Vectalia algunos cuadros usan "domingo" y otros "festivo" para el
// mismo día. Tratamos ambos como equivalentes al matchear filas de horario.
export function matchesDayType(rowDay: string, current: string): boolean {
  if (rowDay === current) return true;
  if (current === "domingo" && rowDay === "festivo") return true;
  if (current === "festivo" && rowDay === "domingo") return true;
  return false;
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
    if (rows.some((r) => r.line_code === lineCode && matchesDayType(r.day_type, dt))) {
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

  // `terminal_name` en bus_line_service_windows = terminal de ORIGEN del
  // trayecto de esa dirección. Filtramos por el origen del recorrido del
  // usuario para no mezclar horarios del sentido contrario.
  const dirRows = originTerminalName
    ? allLineRows.filter((r) => r.terminal_name === originTerminalName)
    : allLineRows;
  const effectiveRows = dirRows.length > 0 ? dirRows : allLineRows;

  const isNight = effectiveRows.some(
    (r) => toMin(r.last_departure) < toMin(r.first_departure),
  );

  const dayType = dayTypeOf(now);
  const todayRows = effectiveRows.filter((r) => matchesDayType(r.day_type, dayType));

  if (todayRows.length === 0) {
    if (isNight) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60_000);
      const yDay = dayTypeOf(yesterday);
      const yRows = effectiveRows.filter((r) => matchesDayType(r.day_type, yDay));
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
        const nxtRows = effectiveRows.filter((r) => matchesDayType(r.day_type, nxt.dayType));
        if (nxtRows.length > 0) {
          const firstMin = Math.min(...nxtRows.map((r) => toMin(r.first_departure)));
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
    const tRows = effectiveRows.filter((r) => matchesDayType(r.day_type, tDay));
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
  upcoming: Array<{ minutes: number; arrivalTime: string; departureTime: string; estimated: boolean }>;
  originTerminal: string;
  tripMinutes: number;
  /** true si la parada del usuario coincide con el terminal de origen (sin offset). */
  atOrigin: boolean;
};

/**
 * Próximas salidas Vectalia para una línea nocturna.
 * No hay cálculo de cadencia: leemos las horas exactas de bus_line_departures
 * para la línea + day_type + dirección que arranca en `originTerminalName`.
 *
 * - Si la parada del usuario es el ORIGEN del trayecto, `offsetMinutes` debe ser 0
 *   y la hora mostrada es la salida programada de Vectalia.
 * - Si es una parada intermedia/destino, sumamos `offsetMinutes` (tiempo de
 *   recorrido estimado por distancia) sobre la salida del origen; estos
 *   resultados se marcan `estimated=true`.
 */
export function getNightLineEstimates(
  serviceRows: ServiceWindowRow[] | null,
  departures: DepartureRow[] | null,
  lineCode: string,
  originTerminalName: string,
  offsetMinutes: number,
  now: Date = new Date(),
  count = 4,
): NightEstimate | null {
  if (!serviceRows || !departures) return null;
  const offset = Math.max(0, Math.round(offsetMinutes));
  const atOrigin = offset === 0;

  // Función que devuelve las salidas (en minutos) para un día_type concreto.
  const departuresFor = (targetDay: string): number[] => {
    const sw = serviceRows.find(
      (r) =>
        r.line_code === lineCode &&
        matchesDayType(r.day_type, targetDay) &&
        r.terminal_name === originTerminalName,
    );
    if (!sw) return [];
    const isNight = toMinHM(sw.last_departure) < toMinHM(sw.first_departure);
    if (!isNight) return [];
    return departures
      .filter(
        (d) =>
          d.line_code === lineCode &&
          d.direction === sw.direction &&
          matchesDayType(d.day_type, targetDay),
      )
      .map((d) => toMinHM(d.departure_time))
      .sort((a, b) => a - b);
  };

  const dayType = dayTypeOf(now);
  const yDay = dayTypeOf(new Date(now.getTime() - 24 * 60 * 60_000));

  // Salidas de hoy (turno actual) + salidas de ayer cuyo viaje aún no ha
  // llegado a destino (madrugada del día siguiente: dep_time es tarde-noche,
  // ej. ayer 03:30 ya pasó pero ayer 06:30 podría haber salido y aún rodar).
  // Tomamos ambas y representamos las salidas de ayer como dep_time - 24h
  // para comparar con el reloj actual.
  const todayDeps = departuresFor(dayType).map((m) => ({ dep: m, base: 0 }));
  const yDeps = departuresFor(yDay).map((m) => ({ dep: m, base: -24 * 60 }));

  if (todayDeps.length === 0 && yDeps.length === 0) return null;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Heurística: una salida nocturna que arranca entre 18:00 y 23:59 pertenece
  // al turno de ayer si estamos en la madrugada de hoy (nowMin pequeño).
  // Simplemente filtramos por arrivalAbs >= nowMin.
  const all = [
    ...yDeps.map((x) => x.dep + x.base), // p.ej. 03:30 ayer = 03:30 - 1440 (descartado)
    ...todayDeps.map((x) => x.dep),
  ];

  // Para turnos nocturnos: una salida con dep < 06:00 representa la madrugada.
  // Una salida con dep >= 18:00 (ej. 23:30) pertenece a la noche de hoy si
  // todavía no ha ocurrido. Si nowMin < firstNocturnaMañana (ej 02:55) y la
  // salida tarde-noche del día actual aún figura como futura, está bien.
  // Construimos una lista de [arrival_abs_min] donde arrival_abs es contado
  // desde medianoche de hoy.
  const arrivalsAbs: Array<{ dep: number; arr: number }> = [];
  for (const dep of todayDeps.map((x) => x.dep)) {
    arrivalsAbs.push({ dep, arr: dep + offset });
  }
  // Ayer: si la salida fue tarde-noche (>=18h), su madrugada es hoy → sumamos -24h+24h = 0 desde medianoche.
  // Mejor: las salidas tarde-noche de ayer ya están reflejadas como las salidas tarde-noche del día "yDay" del cuadro,
  // que en muchos cuadros viven en today. Para evitar duplicar, sólo añadimos yDeps cuya hora < 12h (madrugada),
  // dado que esas pertenecen a la noche que arrancó AYER y aún siguen siendo válidas.
  for (const dep of yDeps.map((x) => x.dep)) {
    if (dep < 12 * 60) {
      // dep es la hora de salida en el día yDay, pero esa hora ya pasó.
      // No la añadimos: el turno de ayer ya terminó si esas salidas fueron antes de medianoche de hoy.
      continue;
    }
    // Salidas tarde-noche de ayer ya transcurridas — omitir.
  }
  // (Nota: para cuadros donde el día actual no tiene rows pero ayer sí cubre
  // la madrugada de hoy, getServiceStatus delega ese caso y todayDeps puede
  // venir vacío. En esa situación usamos las salidas del cuadro de ayer cuya
  // hora < 12 (madrugada) como salidas válidas de la madrugada actual.)
  if (todayDeps.length === 0 && yDeps.length > 0) {
    for (const dep of yDeps.map((x) => x.dep)) {
      if (dep < 12 * 60) {
        arrivalsAbs.push({ dep, arr: dep + offset });
      }
    }
  }

  arrivalsAbs.sort((a, b) => a.arr - b.arr);
  // En paradas terminales (origen de la dirección, también destino del sentido
  // opuesto), Vectalia marca la HORA DE SALIDA oficial. Estimamos que el bus
  // llega 5 min antes para dar tiempo de carga de pasajeros.
  const BOARDING_BUFFER_MIN = 5;
  const upcoming: NightEstimate["upcoming"] = [];
  for (const { dep, arr } of arrivalsAbs) {
    const arrAdj = atOrigin ? arr - BOARDING_BUFFER_MIN : arr;
    const minsAway = arrAdj - nowMin;
    if (minsAway < -1) continue;
    upcoming.push({
      minutes: Math.max(0, minsAway),
      arrivalTime: fmtHMMin(((arrAdj % 1440) + 1440) % 1440),
      departureTime: fmtHMMin(dep),
      estimated: true,
    });
    if (upcoming.length >= count) break;
  }
  if (upcoming.length === 0) return null;
  return { upcoming, originTerminal: originTerminalName, tripMinutes: offset, atOrigin };
}
