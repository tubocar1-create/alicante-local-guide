import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AlsaScheduleItem = {
  id: number;
  service_date: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  origin_station: string;
  destination_station: string;
  bus_type: string | null;
  observations: string[];
};

export type AlsaScheduleResponse = {
  items: AlsaScheduleItem[];
  generatedAt: string | null;
};

const Input = z.object({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  direction: z.enum(["S", "L"]),
});

export const getAlsaSchedule = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AlsaScheduleResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ventana: desde hoy (Europe/Madrid) hasta +30 días.
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const today = fmt.format(new Date());

    const { data: rows, error } = await supabaseAdmin
      .from("alsa_schedules")
      .select("id, service_date, departure_time, arrival_time, duration_minutes, origin_station, destination_station, bus_type, observations, created_at")
      .eq("route_slug", data.slug)
      .eq("direction", data.direction)
      .gte("service_date", today)
      .order("service_date", { ascending: true })
      .order("departure_time", { ascending: true })
      .limit(2000);

    if (error) throw new Error(error.message);

    const items: AlsaScheduleItem[] = (rows ?? []).map((r) => ({
      id: r.id as number,
      service_date: r.service_date as string,
      departure_time: r.departure_time as string,
      arrival_time: r.arrival_time as string,
      duration_minutes: r.duration_minutes as number,
      origin_station: r.origin_station as string,
      destination_station: r.destination_station as string,
      bus_type: (r.bus_type as string | null) ?? null,
      observations: Array.isArray(r.observations) ? (r.observations as string[]) : [],
    }));

    const generatedAt = (rows?.[0]?.created_at as string | undefined) ?? null;
    return { items, generatedAt };
  });

const ItemInput = z.object({ id: z.number().int().positive() });

export const getAlsaScheduleItem = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => ItemInput.parse(data))
  .handler(async ({ data }): Promise<AlsaScheduleItem & { route_slug: string; direction: "S" | "L" } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin
      .from("alsa_schedules")
      .select("id, service_date, departure_time, arrival_time, duration_minutes, origin_station, destination_station, bus_type, observations, route_slug, direction")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return null;
    return {
      id: r.id as number,
      service_date: r.service_date as string,
      departure_time: r.departure_time as string,
      arrival_time: r.arrival_time as string,
      duration_minutes: r.duration_minutes as number,
      origin_station: r.origin_station as string,
      destination_station: r.destination_station as string,
      bus_type: (r.bus_type as string | null) ?? null,
      observations: Array.isArray(r.observations) ? (r.observations as string[]) : [],
      route_slug: r.route_slug as string,
      direction: r.direction as "S" | "L",
    };
  });
