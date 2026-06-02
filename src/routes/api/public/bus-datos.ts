import { createFileRoute } from "@tanstack/react-router";

// Fuente oficial: SUBUS consulta.aspx. Esa página carga los minutos con su
// propia llamada interna; aquí replicamos esa secuencia desde NUESTRO servidor.

const BASE = "http://www.subus.es/QR/Alicante";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const TIMEOUT_MS = 8_000;

const jsonHeaders = { "Content-Type": "application/json", "Cache-Control": "no-store" };

function extractCookies(res: Response): string {
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.() ?? [];
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export const Route = createFileRoute("/api/public/bus-datos")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        if (!/^\d{1,6}$/.test(stop)) {
          return new Response(JSON.stringify({ error: "bad stop" }), { status: 400, headers: jsonHeaders });
        }
        const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stop)}`;
        const t0 = Date.now();
        try {
          const page = await fetchWithTimeout(consultaUrl, {
            redirect: "follow",
            headers: {
              "User-Agent": UA,
              Accept: "text/html,application/xhtml+xml",
              "Accept-Language": "es-ES,es;q=0.9",
            },
          });
          const cookie = extractCookies(page);
          const pageText = await page.text();
          const finalConsultaUrl = page.url || consultaUrl;
          const datosUrl = new URL("datos.aspx", finalConsultaUrl);
          datosUrl.searchParams.set("p", stop);

          let raw = pageText;
          let json: unknown = null;
          let datosStatus: number | null = null;
          try {
            const datos = await fetchWithTimeout(datosUrl.toString(), {
              redirect: "follow",
              headers: {
                "User-Agent": UA,
                Accept: "application/json,text/plain,*/*",
                "Accept-Language": "es-ES,es;q=0.9",
                Referer: finalConsultaUrl,
                "X-Vectalia-App": "qr-alicante",
                ...(cookie ? { Cookie: cookie } : {}),
              },
            });
            datosStatus = datos.status;
            const datosText = await datos.text();
            if (datos.ok && datosText.trim()) {
              raw = datosText;
              try {
                json = JSON.parse(datosText);
              } catch {
                json = null;
              }
            }
          } catch {
            // Si la llamada interna falla, devolvemos al menos el HTML de consulta.aspx.
          }
          return new Response(
            JSON.stringify({
              ok: page.ok,
              status: page.status,
              ms: Date.now() - t0,
              target: consultaUrl,
              finalTarget: finalConsultaUrl,
              sessionStatus: page.status,
              datosStatus,
              cookieSeen: Boolean(cookie),
              raw,
              json,
            }),
            {
              status: 200,
              headers: jsonHeaders,
            },
          );
        } catch (e) {
          return new Response(
            JSON.stringify({ error: String(e), ms: Date.now() - t0, target: consultaUrl }),
            { status: 200, headers: jsonHeaders },
          );
        }
      },
    },
  },
});
