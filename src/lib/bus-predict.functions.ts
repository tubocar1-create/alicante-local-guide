// Server function que sirve un snapshot completo de los datos del motor
// predictivo (paradas, geometría, stats aprendidos, horarios y ventanas).
// Pensado para cachear en TanStack Query con staleTime alto.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type BusEngineSnapshot = {
  stops: Array<{ line_code: string; direction: number; seq: number; stop_code: string | null; stop_name: string }>;
  stopsMeta: Array<{ code: string; name: string | null; lat: number | null; lng: number | null }>;
  segmentStats: Array<{
    line_code: string;
    direction: number;
    from_stop: string;
    to_stop: string;
    distance_m: number | null;
    avg_minutes: number;
    rush_minutes: number | null;
    night_minutes: number | null;
    weekend_minutes: number | null;
    holiday_minutes: number | null;
    samples: number;
    variance: number;
    confidence: number;
  }>;
  cycleStats: Array<{
    line_code: string;
    cycle_avg_min: number;
    cycle_morning_min: number | null;
    cycle_midday_min: number | null;
    cycle_afternoon_min: number | null;
    cycle_night_min: number | null;
    cycle_weekend_min: number | null;
    terminal_wait_avg_min: number;
    samples: number;
    confidence: number;
  }>;
  departures: Array<{ line_code: string; direction: number; departure_time: string; day_type: string }>;
  serviceWindows: Array<{
    line_code: string;
    direction: number;
    day_type: string;
    first_departure: string;
    last_departure: string;
    terminal_name: string | null;
  }>;
  stopDistances: Array<{
    line_code: string;
    direction: number;
    from_stop_code: string;
    to_stop_code: string;
    distance_m: number | null;
  }>;
  fetchedAt: string;
};

export async function loadBusEngineSnapshot(): Promise<BusEngineSnapshot> {
    // Paginador: PostgREST limita por defecto a 1000 filas. Para tablas grandes
    // (bus_line_departures ~9.7k filas) hay que traerlas en bloques o se pierden
    // datos críticos (algunas líneas no aparecen y el motor genera 0 buses).
    async function fetchAll<T>(table: string, columns: string): Promise<T[]> {
      const pageSize = 1000;
      const out: T[] = [];
      let from = 0;
      while (true) {
        // Cast a any: el cliente tipado de Supabase exige literal del nombre de
        // tabla; aquí necesitamos un helper genérico para paginar.
        const { data, error } = await (supabaseAdmin.from(table as never) as unknown as {
          select: (c: string) => { range: (a: number, b: number) => Promise<{ data: T[] | null; error: { message: string } | null }> };
        })
          .select(columns)
          .range(from, from + pageSize - 1);
        if (error) throw new Error(`load ${table} failed: ${error.message}`);
        const rows = (data ?? []) as T[];
        out.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return out;
    }


    const [stops, stopsMeta, segs, cycles, deps, sws] = await Promise.all([
      fetchAll<BusEngineSnapshot["stops"][number]>("bus_line_stops", "line_code,direction,seq,stop_code,stop_name"),
      fetchAll<BusEngineSnapshot["stopsMeta"][number]>("bus_stops", "code,name,lat,lng"),
      fetchAll<BusEngineSnapshot["segmentStats"][number]>(
        "bus_segment_stats",
        "line_code,direction,from_stop,to_stop,distance_m,avg_minutes,rush_minutes,night_minutes,weekend_minutes,holiday_minutes,samples,variance,confidence",
      ),
      fetchAll<BusEngineSnapshot["cycleStats"][number]>(
        "bus_cycle_stats",
        "line_code,cycle_avg_min,cycle_morning_min,cycle_midday_min,cycle_afternoon_min,cycle_night_min,cycle_weekend_min,terminal_wait_avg_min,samples,confidence",
      ),
      fetchAll<BusEngineSnapshot["departures"][number]>("bus_line_departures", "line_code,direction,departure_time,day_type"),
      fetchAll<BusEngineSnapshot["serviceWindows"][number]>(
        "bus_line_service_windows",
        "line_code,direction,day_type,first_departure,last_departure,terminal_name",
      ),
    ]);

    return {
      stops,
      stopsMeta,
      segmentStats: segs,
      cycleStats: cycles,
      departures: deps,
      serviceWindows: sws,
      fetchedAt: new Date().toISOString(),
    };
}


export const getBusEngineSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<BusEngineSnapshot> => loadBusEngineSnapshot(),
);
