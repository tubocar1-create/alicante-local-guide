// Tiempo real oficial de SUBUS/Vectalia Alicante, sin proxy externo.
// Flujo: consulta.aspx?p=N para sesión/cookies y datos.aspx?p=N para JSON.

const BASE = "http://www.subus.es/QR/Alicante";
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
  "X-Requested-With": "XMLHttpRequest",
  "X-Vectalia-App": "qr-alicante",
  "Accept-Language": "es-ES,es;q=0.9",
  Accept: "application/json, text/plain, */*",
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

function extractCookies(res: Response): string {
  const list = res.headers.getSetCookie?.() ?? [];
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
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

async function fetchFromDataEndpoint(stopCode: string, lineCode: string): Promise<number[]> {
  try {
    const r = await sbFetch(
      `${VECTALIA_DATA_URL}?p=${encodeURIComponent(stopCode)}`,
      { headers: { ...browserHeaders, Referer: `${VECTALIA_PAGE_URL}?p=${encodeURIComponent(stopCode)}` } },
    );
    console.log("[bus-eta] datos.aspx status", r.status, "stop", stopCode);
    if (!r.ok) return [];
    const data = await r.json().catch(() => null) as { tiempos?: string } | null;
    return parseEtas(data?.tiempos ?? "", lineCode);
  } catch (e) {
    console.error("[bus-eta] datos.aspx failed", e);
    return [];
  }
}

async function fetchFromRequestEndpoint(stopCode: string, lineCode: string): Promise<number[]> {
  try {
    const vectaliaLine = toVectaliaLineCode(lineCode);
    const r = await sbFetch(
      `${VECTALIA_RT_URL}?p=${encodeURIComponent(stopCode)}&l=${encodeURIComponent(vectaliaLine)}`,
      { headers: browserHeaders },
    );
    console.log("[bus-eta] request.aspx status", r.status, "stop", stopCode);
    if (!r.ok) return [];
    return parseEtas(await r.text(), lineCode);
  } catch (e) {
    console.error("[bus-eta] request.aspx failed", e);
    return [];
  }
}

async function fetchFromStopPage(stopCode: string, lineCode: string): Promise<number[]> {
  try {
    const r = await sbFetch(
      `${VECTALIA_PAGE_URL}?p=${encodeURIComponent(stopCode)}`,
      { headers: browserHeaders },
    );
    console.log("[bus-eta] consulta.aspx status", r.status, "stop", stopCode);
    if (!r.ok) return [];
    const html = await r.text();
    // Extraer el bloque `var text = "...";`
    const idx = html.indexOf('var text = "');
    if (idx === -1) return [];
    // El bloque concatena strings con `+`; extraemos hasta el ';' final.
    const tail = html.slice(idx);
    const end = tail.indexOf('";\n\t\t\tvar textavisos');
    const block = end > 0 ? tail.slice(0, end + 1) : tail.slice(0, 5000);
    return parseEtas(block, lineCode);
  } catch (e) {
    console.error("[bus-eta] consulta.aspx failed", e);
    return [];
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

  let etas = await fetchFromDataEndpoint(stop, line);
  let source = "data";
  if (etas.length === 0) {
    etas = await fetchFromRequestEndpoint(stop, line);
    source = "request";
  }
  if (etas.length === 0) {
    etas = await fetchFromStopPage(stop, line);
    source = "page";
  }

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
