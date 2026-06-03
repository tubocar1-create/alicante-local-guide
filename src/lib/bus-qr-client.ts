// Lectura del QR oficial de SUBUS DIRECTAMENTE desde el navegador del preview.
// El servidor (Cloudflare Worker) está bloqueado por Vectalia con 403, pero el
// navegador del preview NO está bloqueado: hace la petición a la página oficial
//   http://www.subus.es/QR/Alicante/consulta.aspx?p=<stop>
// y parsea el HTML/JSON tal cual lo devuelve SUBUS. Sin proxy, sin server.
//
// Fallback: si el navegador no puede (mixed content/CORS en algún entorno),
// se intenta el proxy /api/public/bus-datos como último recurso.

const DIRECT_URL = "http://www.subus.es/QR/Alicante/consulta.aspx";
const PROXY_URL = "/api/public/bus-datos";
const ARRIVAL_RE = /Linea\s+(\d{1,3}[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;
const FETCH_TIMEOUT_MS = 8_000;

export function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

export type StopQrResult = {
  byLine: Map<string, { destination: string; minutes: number[] }>;
  fetchedAt: number;
};

function parseArrivalText(raw: string): Map<string, { destination: string; minutes: number[] }> {
  let text = raw;
  try {
    const json = JSON.parse(raw) as { tiempos?: unknown };
    if (typeof json.tiempos === "string") text = json.tiempos;
  } catch {
    // texto plano/HTML: úsalo tal cual
  }
  const out = new Map<string, { destination: string; minutes: number[] }>();
  for (const m of text.matchAll(ARRIVAL_RE)) {
    const lineKey = normalizeLine(m[1]);
    const destination = (m[2] ?? "").trim();
    const mins = parseInt(m[3], 10);
    if (!Number.isFinite(mins)) continue;
    const cur = out.get(lineKey) ?? { destination, minutes: [] };
    if (!cur.destination && destination) cur.destination = destination;
    cur.minutes.push(mins);
    out.set(lineKey, cur);
  }
  for (const v of out.values()) v.minutes.sort((a, b) => a - b);
  return out;
}

async function fetchDirect(stopCode: string, signal: AbortSignal): Promise<string | null> {
  const url = `${DIRECT_URL}?p=${encodeURIComponent(stopCode)}`;
  const res = await fetch(url, {
    method: "GET",
    signal,
    cache: "no-store",
    credentials: "omit",
    redirect: "follow",
  });
  if (!res.ok) return null;
  const text = await res.text();
  return text || null;
}

async function fetchViaProxy(stopCode: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(`${PROXY_URL}?stop=${encodeURIComponent(stopCode)}`, {
    method: "GET",
    signal,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { raw?: string; ok?: boolean };
  if (!json.ok || typeof json.raw !== "string") return null;
  return json.raw;
}

export async function fetchStopFromQR(stopCode: string, signal?: AbortSignal): Promise<StopQrResult | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const linked = () => controller.abort();
  signal?.addEventListener("abort", linked);
  try {
    let raw: string | null = null;
    try {
      raw = await fetchDirect(stopCode, controller.signal);
    } catch {
      raw = null;
    }
    if (!raw) {
      try {
        raw = await fetchViaProxy(stopCode, controller.signal);
      } catch {
        raw = null;
      }
    }
    if (!raw) return null;
    return { byLine: parseArrivalText(raw), fetchedAt: Date.now() };
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", linked);
  }
}
