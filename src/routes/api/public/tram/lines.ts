import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/tram/lines")({
  server: {
    handlers: {
      GET: async () => {
        const { data, error } = await supabaseAdmin
          .from("tram_routes")
          .select("route_id, route_short_name, route_long_name, route_color, route_text_color, route_type, agency_id")
          .order("route_short_name", { ascending: true });
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return Response.json({
          lines: (data ?? []).map((r) => ({
            id: r.route_id,
            short_name: r.route_short_name,
            long_name: r.route_long_name,
            color: r.route_color,
            text_color: r.route_text_color,
            agency_id: r.agency_id,
          })),
        });
      },
    },
  },
});
