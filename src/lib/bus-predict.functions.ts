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
  fetchedAt: string;
};

export async function loadBusEngineSnapshot(): Promise<BusEngineSnapshot> {
    const [stopsRes, stopsMetaRes, segRes, cycleRes, depRes, swRes] = await Promise.all([
      supabaseAdmin.from("bus_line_stops").select("line_code,direction,seq,stop_code,stop_name"),
      supabaseAdmin.from("bus_stops").select("code,name,lat,lng"),
      supabaseAdmin
        .from("bus_segment_stats")
        .select("line_code,direction,from_stop,to_stop,distance_m,avg_minutes,rush_minutes,night_minutes,weekend_minutes,holiday_minutes,samples,variance,confidence"),
      supabaseAdmin
        .from("bus_cycle_stats")
        .select("line_code,cycle_avg_min,cycle_morning_min,cycle_midday_min,cycle_afternoon_min,cycle_night_min,cycle_weekend_min,terminal_wait_avg_min,samples,confidence"),
      supabaseAdmin.from("bus_line_departures").select("line_code,direction,departure_time,day_type"),
      supabaseAdmin
        .from("bus_line_service_windows")
        .select("line_code,direction,day_type,first_departure,last_departure,terminal_name"),
    ]);

    return {
      stops: stopsRes.data ?? [],
      stopsMeta: stopsMetaRes.data ?? [],
      segmentStats: segRes.data ?? [],
      cycleStats: cycleRes.data ?? [],
      departures: depRes.data ?? [],
      serviceWindows: swRes.data ?? [],
      fetchedAt: new Date().toISOString(),
    };
}

export const getBusEngineSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<BusEngineSnapshot> => loadBusEngineSnapshot(),
);
