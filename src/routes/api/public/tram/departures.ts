import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// /api/public/tram/departures?stop_id=...&date=YYYY-MM-DD&from=HH:MM&limit=20
// Devuelve las próximas salidas programadas en una parada, filtradas por
// servicios activos en la fecha indicada (calendar + calendar_dates).
export const Route = createFileRoute("/api/public/tram/departures")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stopId = url.searchParams.get("stop_id");
        if (!stopId) return new Response(JSON.stringify({ error: "stop_id required" }), { status: 400 });

        const today = new Date();
        const isoDate = (url.searchParams.get("date") || today.toISOString().slice(0, 10));
        const dateCompact = isoDate.replace(/-/g, "");
        const from = url.searchParams.get("from") || `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
        const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);

        // 1. Servicios activos en esa fecha.
        const dow = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(isoDate + "T00:00:00").getDay()];
        const { data: cal } = await supabaseAdmin
          .from("tram_calendar")
          .select("service_id, start_date, end_date, " + dow)
          .lte("start_date", dateCompact).gte("end_date", dateCompact);
        const baseServices = new Set((cal ?? []).filter((c: any) => c[dow]).map((c) => c.service_id));

        const { data: exc } = await supabaseAdmin
          .from("tram_calendar_dates").select("service_id, exception_type").eq("date", isoDate);
        (exc ?? []).forEach((e) => {
          if (e.exception_type === 1) baseServices.add(e.service_id);
          if (e.exception_type === 2) baseServices.delete(e.service_id);
        });
        const services = Array.from(baseServices);
        if (!services.length) return Response.json({ stop_id: stopId, date: isoDate, departures: [] });

        // 2. Trips de esos servicios.
        const { data: trips } = await supabaseAdmin
          .from("tram_trips").select("trip_id, route_id, trip_headsign, direction_id")
          .in("service_id", services).limit(5000);
        if (!trips?.length) return Response.json({ stop_id: stopId, date: isoDate, departures: [] });
        const tripMap = new Map(trips.map((t) => [t.trip_id, t]));

        // 3. Stop_times en esa parada para esos trips, a partir de `from`.
        const fromHHMMSS = from.length === 5 ? `${from}:00` : from;
        const { data: st } = await supabaseAdmin
          .from("tram_stop_times")
          .select("trip_id, arrival_time, departure_time, stop_sequence")
          .eq("stop_id", stopId)
          .gte("departure_time", fromHHMMSS)
          .in("trip_id", trips.map((t) => t.trip_id))
          .order("departure_time", { ascending: true })
          .limit(limit);

        const routeIds = Array.from(new Set((st ?? []).map((r) => tripMap.get(r.trip_id)?.route_id).filter(Boolean) as string[]));
        const { data: routes } = await supabaseAdmin.from("tram_routes").select("route_id, route_short_name, route_long_name, route_color").in("route_id", routeIds);
        const routeMap = new Map((routes ?? []).map((r) => [r.route_id, r]));

        return Response.json({
          stop_id: stopId,
          date: isoDate,
          from,
          departures: (st ?? []).map((r) => {
            const trip = tripMap.get(r.trip_id)!;
            const route = routeMap.get(trip.route_id);
            return {
              trip_id: r.trip_id,
              route_id: trip.route_id,
              line_short_name: route?.route_short_name,
              line_long_name: route?.route_long_name,
              line_color: route?.route_color,
              headsign: trip.trip_headsign,
              direction: trip.direction_id,
              arrival_time: r.arrival_time,
              departure_time: r.departure_time,
            };
          }),
        });
      },
    },
  },
});
