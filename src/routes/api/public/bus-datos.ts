import { createFileRoute } from "@tanstack/react-router";

// Debug de la página oficial SUBUS. La fuente correcta es consulta.aspx.

const BASE = "http://www.subus.es/QR/Alicante";
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
          const text = await page.text();
          return new Response(
            JSON.stringify({
              ok: page.ok,
              status: page.status,
              ms: Date.now() - t0,
              target: consultaUrl,
              sessionStatus: page.status,
              cookieSeen: Boolean(cookie),
              raw: text,
              json: null,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
            },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ error: String(e), ms: Date.now() - t0, target: consultaUrl }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
