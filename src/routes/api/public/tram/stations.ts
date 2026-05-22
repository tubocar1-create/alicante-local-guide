import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/tram/stations")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const q = url.searchParams.get("q")?.trim();
        const lineId = url.searchParams.get("line_id")?.trim();
        const stopId = url.searchParams.get("stop_id")?.trim();

        // Lookup directo por id (útil para páginas de parada).
        const mapRow = (s: any) => ({ stop_id: s.stop_id, stop_name: s.stop_name, stop_lat: s.lat, stop_lon: s.lng });

        if (stopId) {
          const { data, error } = await supabaseAdmin
            .from("tram_stops").select("stop_id, stop_name, lat, lng").eq("stop_id", stopId).maybeSingle();
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
          return Response.json({ stations: data ? [mapRow(data)] : [] });
        }

        // Si filtra por línea, devolvemos estaciones únicas usadas por esa línea.
        if (lineId) {
          const { data: trips } = await supabaseAdmin
            .from("tram_trips").select("trip_id").eq("route_id", lineId).limit(2000);
          const tripIds = ((trips ?? []) as Array<{ trip_id: string }>).map((t) => t.trip_id);
          if (!tripIds.length) return Response.json({ stations: [] });
          const { data: st } = await supabaseAdmin
            .from("tram_stop_times").select("stop_id").in("trip_id", tripIds).limit(10000);
          const ids = Array.from(new Set(((st ?? []) as Array<{ stop_id: string }>).map((r) => r.stop_id)));
          const { data: stops, error } = await supabaseAdmin
            .from("tram_stops").select("stop_id, stop_name, lat, lng").in("stop_id", ids).order("stop_name");
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
          return Response.json({ stations: (stops ?? []).map(mapRow) });
        }


        let query = supabaseAdmin.from("tram_stops").select("stop_id, stop_name, lat, lng").order("stop_name").limit(500);
        if (q) query = query.ilike("stop_name", `%${q}%`);
        const { data, error } = await query;
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        const stations = (data ?? []).map((s: any) => ({ stop_id: s.stop_id, stop_name: s.stop_name, stop_lat: s.lat, stop_lon: s.lng }));
        return Response.json({ stations });
      },
    },
  },
});
