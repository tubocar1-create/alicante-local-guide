// Lectura SUBUS a través del bridge del proyecto.
// El navegador no llama directo: la fuente única interna es /api/public/bus-datos.

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

async function fetchViaProxy(stopCode: string, signal: AbortSignal): Promise<string | null> {
  const res = await fetch(`${PROXY_URL}?stop=${encodeURIComponent(stopCode)}`, {
    method: "GET",
    signal,
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { raw?: string; ok?: boolean };
  if (typeof json.raw !== "string" || !json.raw.trim()) return null;
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
      raw = await fetchViaProxy(stopCode, controller.signal);
    } catch {
      raw = null;
    }
    if (!raw) return null;
    return { byLine: parseArrivalText(raw), fetchedAt: Date.now() };
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", linked);
  }
}
