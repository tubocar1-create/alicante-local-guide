import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// /api/public/tram/plan?origin=<stop_id>&destination=<stop_id>&from=HH:MM&date=YYYY-MM-DD&limit=5
// Devuelve las próximas conexiones directas entre dos paradas (sin transbordo)
// con línea, horario de salida/llegada, headsign, color y nº de paradas.
export const Route = createFileRoute("/api/public/tram/plan")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.searchParams.get("origin");
        const destination = url.searchParams.get("destination");
        if (!origin || !destination) {
          return new Response(JSON.stringify({ error: "origin & destination required" }), { status: 400 });
        }
        if (origin === destination) return Response.json({ options: [] });

        const today = new Date();
        const dateStr = url.searchParams.get("date") || today.toISOString().slice(0, 10);
        const from = url.searchParams.get("from") ||
          `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
        const limit = Math.min(Number(url.searchParams.get("limit") || 5), 20);
        const [fh, fm] = from.split(":").map(Number);
        const fromSecs = fh * 3600 + fm * 60;

        // 1. Servicios activos hoy.
        const dow = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"][new Date(dateStr + "T00:00:00").getDay()];
        const { data: cal } = await supabaseAdmin
          .from("tram_calendar")
          .select(`service_id, ${dow}`)
          .lte("start_date", dateStr).gte("end_date", dateStr);
        const services = new Set(((cal ?? []) as any[]).filter((c) => c[dow]).map((c) => c.service_id as string));
        const { data: exc } = await supabaseAdmin
          .from("tram_calendar_dates").select("service_id, exception_type").eq("date", dateStr);
        ((exc ?? []) as any[]).forEach((e) => {
          if (e.exception_type === 1) services.add(e.service_id);
          if (e.exception_type === 2) services.delete(e.service_id);
        });
        if (!services.size) return Response.json({ options: [] });

        // 2. Stop_times de origen (los próximos) y destino, en paralelo.
        const [{ data: origRaw }, { data: destRaw }] = await Promise.all([
          supabaseAdmin
            .from("tram_stop_times")
            .select("trip_id, stop_sequence, departure_seconds")
            .eq("stop_id", origin)
            .gte("departure_seconds", fromSecs)
            .order("departure_seconds", { ascending: true })
            .limit(200),
          supabaseAdmin
            .from("tram_stop_times")
            .select("trip_id, stop_sequence, arrival_seconds")
            .eq("stop_id", destination)
            .limit(2000),
        ]);
        const origRows = (origRaw ?? []) as Array<{ trip_id: string; stop_sequence: number; departure_seconds: number }>;
        const destMap = new Map<string, { stop_sequence: number; arrival_seconds: number }>();
        ((destRaw ?? []) as Array<{ trip_id: string; stop_sequence: number; arrival_seconds: number }>).forEach((r) => {
          destMap.set(r.trip_id, { stop_sequence: r.stop_sequence, arrival_seconds: r.arrival_seconds });
        });

        // 3. Intersección: trips que pasan por ambas paradas en orden correcto.
        const candidateTripIds = origRows
          .filter((r) => {
            const d = destMap.get(r.trip_id);
            return d && d.stop_sequence > r.stop_sequence;
          })
          .map((r) => r.trip_id);
        if (!candidateTripIds.length) return Response.json({ options: [] });

        const { data: tripsRaw } = await supabaseAdmin
          .from("tram_trips")
          .select("trip_id, route_id, trip_headsign, direction_id, service_id")
          .in("trip_id", Array.from(new Set(candidateTripIds)));
        const trips = (tripsRaw ?? []) as Array<{ trip_id: string; route_id: string; trip_headsign: string | null; direction_id: number | null; service_id: string }>;
        const tripMap = new Map(trips.filter((t) => services.has(t.service_id)).map((t) => [t.trip_id, t]));

        const routeIds = Array.from(new Set(Array.from(tripMap.values()).map((t) => t.route_id)));
        const { data: routes } = await supabaseAdmin
          .from("tram_routes").select("route_id, route_short_name, route_long_name, route_color, route_text_color").in("route_id", routeIds);
        const routeMap = new Map(((routes ?? []) as any[]).map((r) => [r.route_id, r]));

        const fmt = (n: number) => {
          const h = Math.floor(n / 3600), m = Math.floor((n % 3600) / 60);
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        };

        const options = origRows
          .map((r) => {
            const trip = tripMap.get(r.trip_id);
            const dest = destMap.get(r.trip_id);
            if (!trip || !dest || dest.stop_sequence <= r.stop_sequence) return null;
            const route = routeMap.get(trip.route_id);
            return {
              trip_id: r.trip_id,
              route_id: trip.route_id,
              line_short_name: route?.route_short_name ?? null,
              line_long_name: route?.route_long_name ?? null,
              line_color: route?.route_color ?? null,
              line_text_color: route?.route_text_color ?? null,
              headsign: trip.trip_headsign,
              direction: trip.direction_id,
              depart_time: fmt(r.departure_seconds),
              depart_seconds: r.departure_seconds,
              arrive_time: fmt(dest.arrival_seconds),
              arrive_seconds: dest.arrival_seconds,
              duration_min: Math.max(1, Math.round((dest.arrival_seconds - r.departure_seconds) / 60)),
              stops_between: dest.stop_sequence - r.stop_sequence,
            };
          })
          .filter(Boolean)
          .slice(0, limit);

        return Response.json({ origin, destination, date: dateStr, from, options });
      },
    },
  },
});
