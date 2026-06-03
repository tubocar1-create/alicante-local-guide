// Hook autónomo del motor predictivo: tick masivo de todas las líneas.
// Pensado para llamarse desde pg_cron o un scheduler externo cada 20-60s.
// Protección: header `x-engine-tick-secret` debe coincidir con BUS_FLEET_TICK_SECRET.

import { createFileRoute } from "@tanstack/react-router";
import { tickAllLinesInternal } from "@/lib/bus-fleet.functions";

export const Route = createFileRoute("/api/public/hooks/bus-fleet-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.BUS_FLEET_TICK_SECRET;
        const provided = request.headers.get("x-engine-tick-secret");
        if (secret && provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await tickAllLinesInternal();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
