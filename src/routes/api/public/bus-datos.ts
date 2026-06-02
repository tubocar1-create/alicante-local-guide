import { createFileRoute } from "@tanstack/react-router";

// Captura datos.aspx (JSON oficial con tiempos + coords + avisos)
// usando solo el flujo directo de SUBUS: consulta.aspx → cookies → datos.aspx.

const BASE = "https://qr.vectalia.es/Alicante";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

function extractCookies(res: Response): string {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.() ?? [];
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

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
        const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stop)}`;
        const datosUrl = `${BASE}/datos.aspx?p=${encodeURIComponent(stop)}`;
        const t0 = Date.now();
        try {
          const page = await fetch(consultaUrl, {
            redirect: "follow",
            headers: {
              "User-Agent": UA,
              Accept: "text/html,application/xhtml+xml",
              "Accept-Language": "es-ES,es;q=0.9",
            },
          });
          const cookie = extractCookies(page);
          await page.arrayBuffer().catch(() => null);

          const r = await fetch(datosUrl, {
            redirect: "follow",
            headers: {
              "User-Agent": UA,
              Accept: "application/json, text/plain, */*",
              "Accept-Language": "es-ES,es;q=0.9",
              Referer: consultaUrl,
              "X-Requested-With": "XMLHttpRequest",
              "X-Vectalia-App": "qr-alicante",
              ...(cookie ? { Cookie: cookie } : {}),
            },
          });
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
              target: datosUrl,
              sessionStatus: page.status,
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
            JSON.stringify({ error: String(e), ms: Date.now() - t0, target: datosUrl }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
