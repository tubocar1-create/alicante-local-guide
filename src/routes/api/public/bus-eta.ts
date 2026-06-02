import { createFileRoute } from "@tanstack/react-router";

// Tiempo real oficial QR: datos.aspx?p=N devuelve JSON con todas las llegadas.
// En servidor se entra por ScrapingBee porque el origen bloquea IPs de datacenter.

const BASE = "http://www.subus.es/QR/Alicante";
const QR_DATA_URL = "https://qr.vectalia.es/Alicante/datos.aspx";
const SCRAPINGBEE_URL = "https://app.scrapingbee.com/api/v1/";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const ARRIVAL_RE = /Linea\s+(\d{1,3}[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;
const FETCH_TIMEOUT_MS = 4_500;

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function parseEtas(raw: string, requestedLine: string): number[] {
  let text = raw;
  try {
    const json = JSON.parse(raw) as { tiempos?: unknown };
    if (typeof json.tiempos === "string") text = json.tiempos;
  } catch {
    // HTML/text fallback.
  }
  const wanted = normalizeLine(requestedLine);
  const out: number[] = [];
  for (const m of text.matchAll(ARRIVAL_RE)) {
    if (normalizeLine(m[1]) !== wanted) continue;
    const min = parseInt(m[3], 10);
    if (Number.isFinite(min)) out.push(min);
  }
  return out.sort((a, b) => a - b);
}

async function fetchViaScrapingBee(targetUrl: string): Promise<string | null> {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  if (!apiKey) return null;
  const url = new URL(SCRAPINGBEE_URL);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("url", targetUrl);
  url.searchParams.set("render_js", "false");
  url.searchParams.set("block_resources", "true");
  try {
    const res = await fetchWithTimeout(url.toString(), { redirect: "follow" });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fromSubus(stop: string, line: string): Promise<{ etas: number[]; source: string }> {
  const datosUrl = `${QR_DATA_URL}?p=${encodeURIComponent(stop)}`;
  const proxied = await fetchViaScrapingBee(datosUrl);
  if (proxied) return { etas: parseEtas(proxied, line), source: "scrapingbee-qr-datos" };

  const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stop)}`;

  const page = await fetchWithTimeout(consultaUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  if (!page.ok) return { etas: [], source: `subus-consulta-http-${page.status}` };
  return { etas: parseEtas(await page.text(), line), source: "subus-consulta-page" };
}

export const Route = createFileRoute("/api/public/bus-eta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const stop = (url.searchParams.get("stop") || "").trim();
        const line = (url.searchParams.get("line") || "").trim();
        const indexRaw = (url.searchParams.get("index") || "0").trim();
        const minRaw = (url.searchParams.get("min") || "").trim();
        const index = Math.max(0, Math.min(5, parseInt(indexRaw, 10) || 0));
        const minThreshold = minRaw ? parseInt(minRaw, 10) : null;

        if (!/^\d{1,6}$/.test(stop) || !/^\d{1,3}[A-Za-z]?$/.test(line)) {
          return new Response(JSON.stringify({ error: "bad params" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { etas, source } = await fromSubus(stop, line);

        let etaMin: number | null = null;
        if (etas.length > 0) {
          if (minThreshold != null && Number.isFinite(minThreshold)) {
            const next = etas.find((m) => m >= minThreshold);
            etaMin = next ?? etas[etas.length - 1];
          } else {
            etaMin = etas[Math.min(index, etas.length - 1)];
          }
        }

        return new Response(
          JSON.stringify({ etaMin, all: etas, source, fetchedAt: Date.now() }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          },
        );
      },
    },
  },
});
