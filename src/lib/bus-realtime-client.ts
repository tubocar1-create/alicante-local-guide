export type StopArrival = {
  line: string;
  destination: string;
  etaMin: number;
  lat: number | null;
  lng: number | null;
};

export type StopRealtimeResult = {
  arrivals: StopArrival[];
  all: number[];
  etaMin: number | null;
  fetchedAt: number;
};

const STOP_PAGE_URL = "https://qr.vectalia.es/Alicante/consulta.aspx";
const CACHE_TTL_MS = 20_000;
const MAX_CONCURRENT = 3;
const REQUEST_DELAY_MS = 200;

const ARRIVAL_RE = /Linea\s+(\d{1,3}[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min(?:\.?\s*:\s*\d+\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*:)?/gi;
const cache = new Map<string, StopRealtimeResult>();
const inFlight = new Map<string, Promise<StopRealtimeResult>>();
const queue: Array<() => void> = [];
let active = 0;
let lastStart = 0;

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

function parseArrivals(raw: string): StopArrival[] {
  const out: StopArrival[] = [];
  for (const m of raw.matchAll(ARRIVAL_RE)) {
    const etaMin = parseInt(m[3], 10);
    const lat = Number(m[4]);
    const lng = Number(m[5]);
    if (!Number.isFinite(etaMin)) continue;
    out.push({
      line: normalizeLine(m[1]),
      destination: m[2].replace(/\\r|\\n|\\t|<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
      etaMin,
      lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
      lng: Number.isFinite(lng) && lng !== 0 ? lng : null,
    });
  }
  const seen = new Set<string>();
  return out
    .filter((a) => {
      const key = `${a.line}|${a.destination}|${a.etaMin}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.etaMin - b.etaMin);
}

function enqueue<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const wait = Math.max(0, REQUEST_DELAY_MS - (Date.now() - lastStart));
      window.setTimeout(() => {
        active += 1;
        lastStart = Date.now();
        task().then(resolve, reject).finally(() => {
          active -= 1;
          const next = queue.shift();
          if (next) next();
        });
      }, wait);
    };
    if (active < MAX_CONCURRENT) run();
    else queue.push(run);
  });
}

async function fetchStop(stopId: string, signal?: AbortSignal): Promise<StopRealtimeResult> {
  const valid = cache.get(stopId);
  if (valid && Date.now() - valid.fetchedAt < CACHE_TTL_MS) return valid;
  const pending = inFlight.get(stopId);
  if (pending) return pending;

  const promise = enqueue(async () => {
    const response = await fetch(`${STOP_PAGE_URL}?p=${encodeURIComponent(stopId)}`, {
      cache: "no-store",
      credentials: "omit",
      signal,
    });
    if (!response.ok) throw new Error(`Vectalia ${response.status}`);
    const arrivals = parseArrivals(await response.text());
    const result: StopRealtimeResult = {
      arrivals,
      all: arrivals.map((a) => a.etaMin).sort((a, b) => a - b),
      etaMin: arrivals[0]?.etaMin ?? null,
      fetchedAt: Date.now(),
    };
    cache.set(stopId, result);
    return result;
  }, signal).catch(() => {
    const empty = { arrivals: [], all: [], etaMin: null, fetchedAt: Date.now() };
    cache.set(stopId, empty);
    return empty;
  }).finally(() => inFlight.delete(stopId));

  inFlight.set(stopId, promise);
  return promise;
}

export async function getClientStopRealtime({
  stopId,
  line,
  index = 0,
  minMin = null,
  signal,
}: {
  stopId: string;
  line?: string;
  index?: number;
  minMin?: number | null;
  signal?: AbortSignal;
}): Promise<StopRealtimeResult> {
  const base = await fetchStop(stopId.trim(), signal);
  const wanted = line ? normalizeLine(line) : null;
  const arrivals = wanted ? base.arrivals.filter((a) => normalizeLine(a.line) === wanted) : base.arrivals;
  const all = arrivals.map((a) => a.etaMin).sort((a, b) => a - b);
  const filtered = typeof minMin === "number" ? all.filter((m) => m >= minMin) : all;
  return {
    arrivals,
    all,
    etaMin: filtered[Math.min(index, Math.max(0, filtered.length - 1))] ?? null,
    fetchedAt: base.fetchedAt,
  };
}

export function readCachedStopRealtime(stopId: string, line?: string): StopRealtimeResult | null {
  const cached = cache.get(stopId.trim());
  if (!cached || Date.now() - cached.fetchedAt >= CACHE_TTL_MS) return null;
  if (!line) return cached;
  const wanted = normalizeLine(line);
  const arrivals = cached.arrivals.filter((a) => normalizeLine(a.line) === wanted);
  const all = arrivals.map((a) => a.etaMin).sort((a, b) => a - b);
  return { arrivals, all, etaMin: all[0] ?? null, fetchedAt: cached.fetchedAt };
}
