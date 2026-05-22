import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET /api/public/tram/bus-connections?stop_id=<tram_stop_id>&radius_m=400
// Devuelve las líneas de bus urbano (Vectalia) cuyas paradas estén cerca
// de la estación de TRAM indicada, para mostrarlas como "conexiones en destino".
export const Route = createFileRoute("/api/public/tram/bus-connections")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stopId = url.searchParams.get("stop_id");
        const radius = Math.min(Math.max(Number(url.searchParams.get("radius_m") || 400), 100), 1500);
        if (!stopId) {
          return new Response(JSON.stringify({ error: "stop_id required" }), { status: 400 });
        }

        const { data: tramStop } = await supabaseAdmin
          .from("tram_stops")
          .select("stop_id, stop_name, lat, lng")
          .eq("stop_id", stopId)
          .maybeSingle();
        if (!tramStop?.lat || !tramStop?.lng) return Response.json({ lines: [] });

        const lat0 = tramStop.lat as number;
        const lng0 = tramStop.lng as number;
        // bounding box rápido (grados aprox)
        const dLat = radius / 111000;
        const dLng = radius / (111000 * Math.cos((lat0 * Math.PI) / 180));

        const { data: stops } = await supabaseAdmin
          .from("bus_stops")
          .select("code, name, lat, lng, lines")
          .gte("lat", lat0 - dLat).lte("lat", lat0 + dLat)
          .gte("lng", lng0 - dLng).lte("lng", lng0 + dLng)
          .limit(200);

        const hav = (a: number, b: number, c: number, d: number) => {
          const R = 6371000;
          const toRad = (x: number) => (x * Math.PI) / 180;
          const dphi = toRad(c - a), dl = toRad(d - b);
          const A = Math.sin(dphi / 2) ** 2 +
            Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dl / 2) ** 2;
          return 2 * R * Math.asin(Math.sqrt(A));
        };

        type S = { code: string; name: string | null; lat: number; lng: number; lines: string[] | null };
        const near = ((stops ?? []) as S[])
          .filter((s) => s.lat != null && s.lng != null && hav(lat0, lng0, s.lat, s.lng) <= radius);

        // Map: line_code -> nearest stop info
        const byLine = new Map<string, { line_code: string; stop_code: string; stop_name: string | null; distance_m: number }>();
        for (const s of near) {
          const d = Math.round(hav(lat0, lng0, s.lat, s.lng));
          for (const code of s.lines ?? []) {
            const existing = byLine.get(code);
            if (!existing || d < existing.distance_m) {
              byLine.set(code, { line_code: code, stop_code: s.code, stop_name: s.name, distance_m: d });
            }
          }
        }
        if (!byLine.size) return Response.json({ lines: [] });

        const { data: lineRows } = await supabaseAdmin
          .from("bus_lines")
          .select("code, name, color, operator")
          .in("code", Array.from(byLine.keys()));

        const lines = ((lineRows ?? []) as Array<{ code: string; name: string; color: string | null; operator: string | null }>)
          .map((l) => {
            const info = byLine.get(l.code)!;
            return {
              code: l.code,
              name: l.name,
              color: l.color,
              operator: l.operator,
              stop_code: info.stop_code,
              stop_name: info.stop_name,
              distance_m: info.distance_m,
            };
          })
          .sort((a, b) => a.distance_m - b.distance_m || a.code.localeCompare(b.code, "es", { numeric: true }));

        return Response.json({ stop_id: stopId, lines });
      },
    },
  },
});
