import { createFileRoute } from "@tanstack/react-router";

// Captura datos.aspx (JSON oficial de Vectalia con tiempos + coords + avisos)
// vía ScrapingBee. Endpoint de prueba para inspección.

const DATOS_URL = "https://movilidad.vectalia.es/QR/Alicante/datos.aspx";

export const Route = createFileRoute("/api/public/bus-datos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        if (!/^\d{1,6}$/.test(stop)) {
          return new Response(JSON.stringify({ error: "bad stop" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const key = process.env.SCRAPINGBEE_API_KEY;
        if (!key) {
          return new Response(JSON.stringify({ error: "no scrapingbee key" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const target = `${DATOS_URL}?p=${encodeURIComponent(stop)}`;
        const sb = new URL("https://app.scrapingbee.com/api/v1/");
        sb.searchParams.set("api_key", key);
        sb.searchParams.set("url", target);
        sb.searchParams.set("render_js", "false");
        const t0 = Date.now();
        try {
          const r = await fetch(sb.toString(), { headers: { Accept: "*/*" } });
          const text = await r.text();
          let parsed: unknown = null;
          try {
            parsed = JSON.parse(text);
          } catch {
            /* not json */
          }
          return new Response(
            JSON.stringify({
              ok: r.ok,
              status: r.status,
              ms: Date.now() - t0,
              target,
              raw: text,
              json: parsed,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ error: String(e), ms: Date.now() - t0, target }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
