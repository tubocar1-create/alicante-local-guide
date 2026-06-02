import { createFileRoute } from "@tanstack/react-router";

// Tiempo real oficial de SUBUS/Vectalia Alicante, sin proxy externo.
// La fuente correcta es la página de parada consulta.aspx?p=N.

const BASE = "http://www.subus.es/QR/Alicante";
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
  const wanted = normalizeLine(requestedLine);
  const out: number[] = [];
  for (const m of raw.matchAll(ARRIVAL_RE)) {
    if (normalizeLine(m[1]) !== wanted) continue;
    const min = parseInt(m[3], 10);
    if (Number.isFinite(min)) out.push(min);
  }
  return out.sort((a, b) => a - b);
}

async function fromSubus(stop: string, line: string): Promise<{ etas: number[]; source: string }> {
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
