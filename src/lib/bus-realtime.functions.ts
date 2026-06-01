import { createServerFn } from "@tanstack/react-start";

export type StopArrival = {
  line: string;
  destination: string;
  etaMin: number;
  lat: number | null;
  lng: number | null;
};

// Flujo real que usa el QR de Subus/Vectalia en Alicante.
// Paso 1: GET consulta.aspx?p=N  → recoge cookies de sesión.
// Paso 2: GET datos.aspx?p=N     → devuelve JSON con { nparada, parada, tiempos, ... }.
// `tiempos` es texto plano: "Linea 012 JORNET NAVARRO : 22 min. : 38.34561,-0.48123 : 05_727; ..."
const BASE = "http://www.subus.es/QR/Alicante";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

const TIEMPOS_RE =
  /Linea\s+(\d+[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min\.?\s*:\s*(?:(?!-?\d+(?:\.\d+)?\s*,)[^:;]+\s*:\s*)?(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/gi;
const CACHE_TTL_MS = 20_000;
const FETCH_TIMEOUT_MS = 1_200;

const realtimeCache = new Map<string, { arrivals: StopArrival[]; fetchedAt: number }>();
const realtimeInflight = new Map<string, Promise<StopArrival[]>>();

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

function extractCookies(res: Response): string {
  // Cloudflare Workers: getSetCookie() devuelve array
  const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
  const list = anyHeaders.getSetCookie?.() ?? [];
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

function parseTiempos(raw: string): StopArrival[] {
  const out: StopArrival[] = [];
  for (const m of raw.matchAll(TIEMPOS_RE)) {
    const lat = Number(m[4]);
    const lng = Number(m[5]);
    out.push({
      line: String(parseInt(m[1], 10)) + (m[1].match(/[A-Za-z]$/)?.[0] ?? ""),
      destination: m[2].trim(),
      etaMin: parseInt(m[3], 10),
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    });
  }
  return out;
}

async function fetchStopFromSubus(stopCode: string): Promise<StopArrival[]> {
  const datosUrl = `${BASE}/datos.aspx?p=${encodeURIComponent(stopCode)}`;
  const direct = await fetchWithTimeout(datosUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "es-ES,es;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
      "X-Vectalia-App": "qr-alicante",
    },
  }).catch(() => null);
  if (direct?.ok) {
    const text = await direct.text();
    try {
      const json = JSON.parse(text) as { tiempos?: string };
      const arrivals = parseTiempos(json.tiempos ?? "");
      if (arrivals.length > 0) return arrivals;
    } catch {
      const arrivals = parseTiempos(text);
      if (arrivals.length > 0) return arrivals;
    }
  }

  // Paso 1: consulta.aspx → cookies de sesión
  const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stopCode)}`;
  const r1 = await fetchWithTimeout(consultaUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "es-ES,es;q=0.9",
    },
  });
  const cookie = extractCookies(r1);
  // Drenamos el cuerpo para no dejar conexiones colgando
  await r1.arrayBuffer().catch(() => null);

  // Paso 2: datos.aspx → JSON con tiempos
  const r2 = await fetchWithTimeout(datosUrl, {
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
  if (!r2.ok) return [];

  const text = await r2.text();
  let tiempos = "";
  try {
    const json = JSON.parse(text) as { tiempos?: string };
    tiempos = json.tiempos ?? "";
  } catch {
    // por si devuelve texto plano
    tiempos = text;
  }
  return parseTiempos(tiempos);
}

async function fetchStopViaScrapingBee(stopCode: string): Promise<StopArrival[]> {
  const key = process.env.SCRAPINGBEE_API_KEY;
  if (!key) return [];
  const target = `https://movilidad.vectalia.es/QR/Alicante/datos.aspx?p=${encodeURIComponent(stopCode)}`;
  const sb = new URL("https://app.scrapingbee.com/api/v1/");
  sb.searchParams.set("api_key", key);
  sb.searchParams.set("url", target);
  sb.searchParams.set("render_js", "false");
  const r = await fetchWithTimeout(sb.toString(), { headers: { Accept: "application/json, text/plain, */*" } }, 5_500);
  if (!r.ok) return [];
  const text = await r.text();
  try {
    const json = JSON.parse(text) as { tiempos?: string };
    return parseTiempos(json.tiempos ?? "");
  } catch {
    return parseTiempos(text);
  }
}

async function fetchStopCached(stopCode: string): Promise<StopArrival[]> {
  const cached = realtimeCache.get(stopCode);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.arrivals;

  const pending = realtimeInflight.get(stopCode);
  if (pending) return pending;

  const promise = (async () => {
    let arrivals: StopArrival[] = [];
    try {
      arrivals = await fetchStopFromSubus(stopCode);
    } catch {
      arrivals = [];
    }
    if (arrivals.length === 0) {
      try {
        arrivals = await fetchStopViaScrapingBee(stopCode);
      } catch {
        arrivals = [];
      }
    }

    const seen = new Set<string>();
    const unique = arrivals.filter((a) => {
      const k = `${a.line}|${a.etaMin}|${a.destination}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    unique.sort((a, b) => a.etaMin - b.etaMin);
    realtimeCache.set(stopCode, { arrivals: unique, fetchedAt: Date.now() });
    return unique;
  })().finally(() => {
    realtimeInflight.delete(stopCode);
  });

  realtimeInflight.set(stopCode, promise);
  return promise;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export const getStopRealtime = createServerFn({ method: "POST" })
  .inputValidator((data: { stopCode: string; lines?: string[] }) => {
    const code = String(data?.stopCode ?? "").trim();
    if (!/^\d{3,5}$/.test(code)) throw new Error("invalid stopCode");
    return { stopCode: code };
  })
  .handler(async ({ data }) => {
    const arrivals = await fetchStopCached(data.stopCode);
    return { arrivals, fetchedAt: new Date().toISOString() };
  });

export const getStopsRealtimeBatch = createServerFn({ method: "POST" })
  .inputValidator((data: { stopCodes: string[]; line?: string }) => {
    const stopCodes = [...new Set((data?.stopCodes ?? []).map((c) => String(c).trim()))]
      .filter((code) => /^\d{3,5}$/.test(code))
      .slice(0, 12);
    return { stopCodes, line: data?.line ? normalizeLine(String(data.line)) : undefined };
  })
  .handler(async ({ data }) => {
    const entries = await mapWithConcurrency(
      data.stopCodes,
      4,
      async (stopCode) => {
        const arrivals = await fetchStopCached(stopCode);
        const filtered = data.line ? arrivals.filter((a) => normalizeLine(a.line) === data.line) : arrivals;
        return [stopCode, filtered] as const;
      },
    );
    return { stops: Object.fromEntries(entries), fetchedAt: new Date().toISOString() };
  });
