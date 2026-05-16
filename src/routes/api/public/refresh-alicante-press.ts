import { createFileRoute } from "@tanstack/react-router";
import { fetchAlicantePressDirect } from "@/lib/ads/alicante-city.server";

// Endpoint llamado por pg_cron cada día a las 03:00 para refrescar los
// titulares scrapeados de alicantepress.com. Calienta el cache de 24h.
export const Route = createFileRoute("/api/public/refresh-alicante-press")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const headlines = await fetchAlicantePressDirect({ force: true });
          return new Response(
            JSON.stringify({
              ok: true,
              count: headlines?.length ?? 0,
              at: new Date().toISOString(),
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("refresh-alicante-press failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        const headlines = await fetchAlicantePressDirect({ force: true });
        return new Response(
          JSON.stringify({ ok: true, count: headlines?.length ?? 0 }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
