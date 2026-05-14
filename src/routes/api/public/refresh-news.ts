import { createFileRoute } from "@tanstack/react-router";
import { fetchAlicantePressHeadlines } from "@/lib/ads/alicante-city.server";

// Endpoint llamado por pg_cron cada día para precargar titulares frescos.
// No persiste nada: el fetcher no cachea, así que el efecto real es
// "calentar" el primer hit del día y dejar trazabilidad en logs.
export const Route = createFileRoute("/api/public/refresh-news")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const headlines = await fetchAlicantePressHeadlines();
          return new Response(
            JSON.stringify({ ok: true, count: headlines.length, at: new Date().toISOString() }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("refresh-news failed", err);
          return new Response(
            JSON.stringify({ ok: false, error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        const headlines = await fetchAlicantePressHeadlines();
        return new Response(
          JSON.stringify({ ok: true, count: headlines.length }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
