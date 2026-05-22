import { createFileRoute } from "@tanstack/react-router";
import { fetchAlicanteIncidencias } from "@/lib/ads/alicante-city.server";

// Cron diario a las 07:00: precarga las incidencias publicadas por
// movilidad.alicante.es para el día actual. No persiste nada: el fetcher
// se ejecuta en cada banner, así que el efecto es "calentar" el primer hit
// del día y dejar trazabilidad en logs.
export const Route = createFileRoute("/api/public/refresh-incidencias")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const items = await fetchAlicanteIncidencias();
          return new Response(
            JSON.stringify({
              ok: true,
              count: items?.length ?? 0,
              at: new Date().toISOString(),
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("refresh-incidencias failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        const items = await fetchAlicanteIncidencias();
        return new Response(
          JSON.stringify({ ok: true, count: items?.length ?? 0, items }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
