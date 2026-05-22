import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET /api/public/tram/valid-origins?destination=<stop_id>
// Devuelve los grupos línea+sentido que sirven a ese destino, y para cada uno
// las paradas previas (en orden y en el sentido correcto) desde donde el usuario
// puede coger ese TRAM.
export const Route = createFileRoute("/api/public/tram/valid-origins")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const destination = url.searchParams.get("destination");
        if (!destination) {
          return new Response(JSON.stringify({ error: "destination required" }), { status: 400 });
        }

        // 1. Trips que pasan por el destino + secuencia de la parada destino en cada trip.
        const { data: destTimesRaw } = await supabaseAdmin
          .from("tram_stop_times")
          .select("trip_id, stop_sequence")
          .eq("stop_id", destination)
          .limit(3000);
        const destTimes = (destTimesRaw ?? []) as Array<{ trip_id: string; stop_sequence: number }>;
        if (!destTimes.length) return Response.json({ groups: [] });

        const destSeqByTrip = new Map(destTimes.map((r) => [r.trip_id, r.stop_sequence]));
        const tripIds = Array.from(destSeqByTrip.keys());

        // 2. Info de esos trips (route_id, direction_id, headsign).
        const { data: tripsRaw } = await supabaseAdmin
          .from("tram_trips")
          .select("trip_id, route_id, direction_id, trip_headsign")
          .in("trip_id", tripIds);
        const trips = (tripsRaw ?? []) as Array<{
          trip_id: string; route_id: string; direction_id: number | null; trip_headsign: string | null;
        }>;

        // 3. Deduplicar por (route_id, direction_id): un trip representativo por grupo.
        type Group = { key: string; route_id: string; direction_id: number; headsign: string | null; trip_id: string; destSeq: number };
        const groups = new Map<string, Group>();
        for (const t of trips) {
          const dir = t.direction_id ?? 0;
          const key = `${t.route_id}|${dir}`;
          const seq = destSeqByTrip.get(t.trip_id);
          if (seq == null || seq <= 1) continue; // necesitamos paradas previas
          const existing = groups.get(key);
          // Preferimos el trip con mayor destSeq (más estaciones previas).
          if (!existing || seq > existing.destSeq) {
            groups.set(key, {
              key, route_id: t.route_id, direction_id: dir,
              headsign: t.trip_headsign ?? existing?.headsign ?? null,
              trip_id: t.trip_id, destSeq: seq,
            });
          }
        }
        if (!groups.size) return Response.json({ groups: [] });

        // 4. Paradas previas a destino en cada trip representativo.
        const repTripIds = Array.from(groups.values()).map((g) => g.trip_id);
        const { data: stRaw } = await supabaseAdmin
          .from("tram_stop_times")
          .select("trip_id, stop_id, stop_sequence")
          .in("trip_id", repTripIds);
        const stopTimes = (stRaw ?? []) as Array<{ trip_id: string; stop_id: string; stop_sequence: number }>;
        console.log("[valid-origins] groups:", groups.size, "stopTimes:", stopTimes.length, "repIds:", repTripIds);

        // 5. Info de líneas.
        const routeIds = Array.from(new Set(Array.from(groups.values()).map((g) => g.route_id)));
        const { data: routesRaw } = await supabaseAdmin
          .from("tram_routes")
          .select("route_id, route_short_name, route_long_name, route_color, route_text_color")
          .in("route_id", routeIds);
        const routeMap = new Map(((routesRaw ?? []) as any[]).map((r) => [r.route_id, r]));

        // 6. Stops origen únicos.
        const originStopIds = new Set<string>();
        const stopsByTrip = new Map<string, Array<{ stop_id: string; stop_sequence: number }>>();
        for (const g of groups.values()) {
          const list = stopTimes
            .filter((s) => s.trip_id === g.trip_id && s.stop_sequence < g.destSeq)
            .sort((a, b) => a.stop_sequence - b.stop_sequence);
          stopsByTrip.set(g.trip_id, list);
          list.forEach((s) => originStopIds.add(s.stop_id));
        }

        const { data: stopsRaw, error: stopsErr } = await supabaseAdmin
          .from("tram_stops")
          .select("stop_id, stop_name, stop_lat, stop_lon")
          .in("stop_id", Array.from(originStopIds));
        console.log("[valid-origins] stopsErr:", stopsErr);
        const stopMap = new Map(((stopsRaw ?? []) as any[]).map((s) => [s.stop_id, s]));

        const result = Array.from(groups.values()).map((g) => {
          const r = routeMap.get(g.route_id);
          const list = stopsByTrip.get(g.trip_id) ?? [];
          return {
            route_id: g.route_id,
            line_short_name: r?.route_short_name ?? null,
            line_long_name: r?.route_long_name ?? null,
            line_color: r?.route_color ?? null,
            line_text_color: r?.route_text_color ?? null,
            direction_id: g.direction_id,
            headsign: g.headsign,
            stops: list
              .map((s) => stopMap.get(s.stop_id))
              .filter(Boolean)
              .map((s: any) => ({
                stop_id: s.stop_id, stop_name: s.stop_name,
                stop_lat: s.stop_lat, stop_lon: s.stop_lon,
              })),
          };
        }).filter((g) => g.stops.length > 0);

        return Response.json({ destination, groups: result });
      },
    },
  },
});
