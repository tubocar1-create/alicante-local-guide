// Tiempo real oficial de SUBUS/Vectalia Alicante, sin proxy externo.
// La fuente correcta es la página de parada consulta.aspx?p=N.

const BASE = "https://qr.vectalia.es/Alicante";
const ARRIVAL_RE = /Linea\s+(\d{1,3}[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;
const FETCH_TIMEOUT_MS = 4_500;

function normalizeLine(code: string): string {
  // "008" -> "8", "24" -> "24", "23N" -> "23N"
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const browserHeaders = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept: "text/html,application/xhtml+xml",
};

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
  const mins: number[] = [];
  for (const m of raw.matchAll(ARRIVAL_RE)) {
    if (normalizeLine(m[1]) !== wanted) continue;
    const min = parseInt(m[3], 10);
    if (Number.isFinite(min)) mins.push(min);
  }
  return mins.sort((a, b) => a - b);
}

async function fetchFromSubus(stopCode: string, lineCode: string): Promise<{ etas: number[]; source: string }> {
  try {
    const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stopCode)}`;

    const page = await fetchWithTimeout(consultaUrl, {
      redirect: "follow",
      headers: browserHeaders,
    });
    if (!page.ok) return { etas: [], source: `subus-consulta-http-${page.status}` };
    return { etas: parseEtas(await page.text(), lineCode), source: "subus-consulta-page" };
  } catch (e) {
    console.error("[bus-eta] subus direct failed", e);
    return { etas: [], source: "subus-error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const url = new URL(req.url);
  const stop = (url.searchParams.get("stop") || "").trim();
  const line = (url.searchParams.get("line") || "").trim();
  const indexRaw = (url.searchParams.get("index") || "0").trim();
  const minRaw = (url.searchParams.get("min") || "").trim();
  const index = Math.max(0, Math.min(5, parseInt(indexRaw, 10) || 0));
  const minThreshold = minRaw ? parseInt(minRaw, 10) : null;

  if (!/^\d{1,6}$/.test(stop) || !/^\d{1,3}[A-Za-z]?$/.test(line)) {
    return new Response(JSON.stringify({ error: "bad params" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const { etas, source } = await fetchFromSubus(stop, line);

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
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
