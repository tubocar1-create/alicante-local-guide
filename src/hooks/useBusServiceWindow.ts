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

function dayTypeOf(d: Date): "laborable" | "sabado" | "domingo" {
  const dow = d.getDay();
  if (dow === 0) return "domingo";
  if (dow === 6) return "sabado";
  return "laborable";
}

function toMin(hms: string): number {
  const [h, m] = hms.split(":").map(Number);
  return h * 60 + m;
}

function fmtHM(mins: number): string {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

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
