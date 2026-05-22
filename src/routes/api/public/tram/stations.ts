import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/tram/stations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim();
        const lineId = url.searchParams.get("line_id")?.trim();

        // Si filtra por línea, devolvemos estaciones únicas usadas por esa línea.
        if (lineId) {
          const { data: trips } = await supabaseAdmin
            .from("tram_trips").select("trip_id").eq("route_id", lineId).limit(2000);
          const tripIds = (trips ?? []).map((t) => t.trip_id);
          if (!tripIds.length) return Response.json({ stations: [] });
          const { data: st } = await supabaseAdmin
            .from("tram_stop_times").select("stop_id").in("trip_id", tripIds).limit(10000);
          const ids = Array.from(new Set((st ?? []).map((r) => r.stop_id)));
          const { data: stops, error } = await supabaseAdmin
            .from("tram_stops").select("*").in("stop_id", ids).order("stop_name");
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
          return Response.json({ stations: stops });
        }

        let query = supabaseAdmin.from("tram_stops").select("*").order("stop_name").limit(500);
        if (q) query = query.ilike("stop_name", `%${q}%`);
        const { data, error } = await query;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return Response.json({ stations: data });
      },
    },
  },
});
