// Lectura DIRECTA del QR oficial de SUBUS desde el navegador.
// La fuente correcta es la página de parada:
// http://www.subus.es/QR/Alicante/consulta.aspx?p=<stop>
// NO usamos scraping externo (ScrapingBee/Firecrawl). NO usamos `datos.aspx`
// como fuente directa.

const SUBUS_CONSULTA_URL = "http://www.subus.es/QR/Alicante/consulta.aspx";
const ARRIVAL_RE = /Linea\s+(\d{1,3}[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;
const FETCH_TIMEOUT_MS = 6_000;

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
    // texto plano: úsalo tal cual
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

export async function fetchStopFromQR(stopCode: string, signal?: AbortSignal): Promise<StopQrResult | null> {
  const url = `${SUBUS_CONSULTA_URL}?p=${encodeURIComponent(stopCode)}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const linked = () => controller.abort();
  signal?.addEventListener("abort", linked);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    return { byLine: parseArrivalText(text), fetchedAt: Date.now() };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", linked);
  }
}
