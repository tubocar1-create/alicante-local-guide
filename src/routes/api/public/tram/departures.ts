import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// /api/public/tram/departures?stop_id=...&date=YYYY-MM-DD&from=HH:MM&limit=20
// Próximas salidas programadas en una parada, filtradas por servicios activos
// en la fecha indicada (calendar + calendar_dates).
export const Route = createFileRoute("/api/public/tram/departures")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stopId = url.searchParams.get("stop_id");
        if (!stopId) return new Response(JSON.stringify({ error: "stop_id required" }), { status: 400 });

        const today = new Date();
        const hasExplicitDate = url.searchParams.has("date");
        const dateStr = url.searchParams.get("date") || today.toISOString().slice(0, 10);
        const from = url.searchParams.get("from") || `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
        const limit = Math.min(Number(url.searchParams.get("limit") || 20), 100);
        const [fh, fm] = from.split(":").map(Number);
        const fromSecs = fh * 3600 + fm * 60;

        if (!hasExplicitDate) {
          const fromAt = new Date(Date.now() + 60_000 * Math.max(0, fromSecs - (today.getHours() * 3600 + today.getMinutes() * 60)));
          const { data: liveRows } = await supabaseAdmin
            .from("tram_live_departures")
            .select("trip_id, route_id, headsign, direction, line_short_name, line_long_name, line_color, arrival_at, departure_at")
            .eq("stop_id", stopId)
            .gte("departure_at", fromAt.toISOString())
            .order("departure_at", { ascending: true })
            .limit(limit);

          if ((liveRows ?? []).length > 0) {
            return Response.json({
              stop_id: stopId,
              date: dateStr,
              from,
              departures: (liveRows ?? []).map((r: any) => ({
                trip_id: r.trip_id,
                route_id: r.route_id,
                line_short_name: r.line_short_name,
                line_long_name: r.line_long_name,
                line_color: r.line_color,
                headsign: r.headsign,
                direction: r.direction,
                arrival_time: r.arrival_at ? new Date(r.arrival_at).toISOString().slice(11, 19) : null,
                departure_time: r.departure_at ? new Date(r.departure_at).toISOString().slice(11, 19) : null,
              })),
            });
          }
        }

        // 1. Servicios activos.
        const dow = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(dateStr + "T00:00:00").getDay()];
        const { data: cal } = await supabaseAdmin
          .from("tram_calendar")
          .select(`service_id, ${dow}`)
          .lte("start_date", dateStr).gte("end_date", dateStr);
        const baseServices = new Set(
          ((cal ?? []) as any[]).filter((c) => c[dow]).map((c) => c.service_id as string),
        );

        const { data: exc } = await supabaseAdmin
          .from("tram_calendar_dates").select("service_id, exception_type").eq("date", dateStr);
        ((exc ?? []) as Array<{ service_id: string; exception_type: number }>).forEach((e) => {
          if (e.exception_type === 1) baseServices.add(e.service_id);
          if (e.exception_type === 2) baseServices.delete(e.service_id);
        });
        const services = Array.from(baseServices);
        if (!services.length) return Response.json({ stop_id: stopId, date: dateStr, departures: [] });

        // 2. Trips.
        const { data: tripsRaw } = await supabaseAdmin
          .from("tram_trips").select("trip_id, route_id, trip_headsign, direction_id")
          .in("service_id", services).limit(5000);
        const trips = (tripsRaw ?? []) as Array<{ trip_id: string; route_id: string; trip_headsign: string | null; direction_id: number | null }>;
        if (!trips.length) return Response.json({ stop_id: stopId, date: dateStr, departures: [] });
        const tripMap = new Map(trips.map((t) => [t.trip_id, t]));

        // 3. Stop_times.
        const { data: stRaw } = await supabaseAdmin
          .from("tram_stop_times")
          .select("trip_id, arrival_seconds, departure_seconds, stop_sequence")
          .eq("stop_id", stopId)
          .gte("departure_seconds", fromSecs)
          .in("trip_id", trips.map((t) => t.trip_id))
          .order("departure_seconds", { ascending: true })
          .limit(limit);
        const st = (stRaw ?? []) as Array<{ trip_id: string; arrival_seconds: number | null; departure_seconds: number | null; stop_sequence: number }>;

        const routeIds = Array.from(new Set(st.map((r) => tripMap.get(r.trip_id)?.route_id).filter(Boolean) as string[]));
        const { data: routes } = await supabaseAdmin.from("tram_routes")
          .select("route_id, route_short_name, route_long_name, route_color").in("route_id", routeIds);
        const routeMap = new Map(((routes ?? []) as any[]).map((r) => [r.route_id, r]));

        const fmt = (n: number | null) => {
          if (n === null) return null;
          const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60), s = n % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        };

        return Response.json({
          stop_id: stopId, date: dateStr, from,
          departures: st.map((r) => {
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
              arrival_time: fmt(r.arrival_seconds),
              departure_time: fmt(r.departure_seconds),
            };
          }),
        });
      },
    },
  },
});
