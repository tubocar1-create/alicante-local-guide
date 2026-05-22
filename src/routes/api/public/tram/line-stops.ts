import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// /api/public/tram/line-stops?line_id=...&direction=0
// Devuelve la secuencia de paradas de una línea para una dirección concreta,
// usando el trip representativo con más paradas.
export const Route = createFileRoute("/api/public/tram/line-stops")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const lineId = url.searchParams.get("line_id");
        const direction = url.searchParams.get("direction");
        if (!lineId) return new Response(JSON.stringify({ error: "line_id required" }), { status: 400 });

        let q = supabaseAdmin.from("tram_trips").select("trip_id, direction_id, trip_headsign").eq("route_id", lineId);
        if (direction !== null) q = q.eq("direction_id", Number(direction));
        const { data: trips } = await q.limit(1000);
        if (!trips?.length) return Response.json({ stops: [] });

        // Elegir el trip con más paradas como representante.
        const sample = trips.slice(0, 50).map((t) => t.trip_id);
        const { data: counts } = await supabaseAdmin
          .from("tram_stop_times").select("trip_id, stop_sequence").in("trip_id", sample).limit(5000);
        const maxByTrip = new Map<string, number>();
        (counts ?? []).forEach((r) => {
          maxByTrip.set(r.trip_id, Math.max(maxByTrip.get(r.trip_id) ?? 0, r.stop_sequence));
        });
        let bestTrip = sample[0];
        let bestCount = 0;
        for (const [tid, c] of maxByTrip) if (c > bestCount) { bestCount = c; bestTrip = tid; }

        const { data: st } = await supabaseAdmin
          .from("tram_stop_times")
          .select("stop_id, stop_sequence, arrival_time, departure_time")
          .eq("trip_id", bestTrip).order("stop_sequence", { ascending: true });

        const stopIds = (st ?? []).map((r) => r.stop_id);
        const { data: stops } = await supabaseAdmin.from("tram_stops").select("*").in("stop_id", stopIds);
        const map = new Map((stops ?? []).map((s) => [s.stop_id, s]));

        return Response.json({
          line_id: lineId,
          trip_id: bestTrip,
          stops: (st ?? []).map((r) => ({
            sequence: r.stop_sequence,
            arrival_time: r.arrival_time,
            departure_time: r.departure_time,
            stop: map.get(r.stop_id) ?? null,
          })),
        });
      },
    },
  },
});
