import { getStopRealtime, getStopsRealtimeBatch } from "@/lib/bus-realtime.functions";

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

const CACHE_TTL_MS = 20_000;

const cache = new Map<string, StopRealtimeResult>();
const inFlight = new Map<string, Promise<StopRealtimeResult>>();

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

// El navegador no puede hacer fetch directo a qr.vectalia.es (CORS + 403
// anti-bot). Delegamos en la server function `getStopRealtime`, que llama
// a Vectalia desde el servidor con User-Agent real y caché compartida.
async function fetchStop(stopId: string): Promise<StopRealtimeResult> {
  const valid = cache.get(stopId);
  if (valid && Date.now() - valid.fetchedAt < CACHE_TTL_MS) return valid;
  const pending = inFlight.get(stopId);
  if (pending) return pending;

  const promise = getStopRealtime({ data: { stopCode: stopId } })
    .then((res) => {
      const arrivals: StopArrival[] = (res.arrivals ?? []).map((a) => ({
        line: normalizeLine(a.line),
        destination: a.destination,
        etaMin: a.etaMin,
        lat: a.lat,
        lng: a.lng,
      }));
      const result: StopRealtimeResult = {
        arrivals,
        all: arrivals.map((a) => a.etaMin).sort((a, b) => a - b),
        etaMin: arrivals[0]?.etaMin ?? null,
        fetchedAt: Date.now(),
      };
      cache.set(stopId, result);
      return result;
    })
    .catch(() => {
      const empty: StopRealtimeResult = {
        arrivals: [],
        all: [],
        etaMin: null,
        fetchedAt: Date.now(),
      };
      cache.set(stopId, empty);
      return empty;
    })
    .finally(() => {
      inFlight.delete(stopId);
    });

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
  const base = await fetchStop(stopId.trim());
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

export async function getClientStopsRealtimeBatch({
  stopIds,
  line,
}: {
  stopIds: string[];
  line: string;
}): Promise<Record<string, number[]>> {
  const ids = [...new Set(stopIds.map((id) => id.trim()).filter(Boolean))];
  const missingIds = ids.filter((id) => {
    const valid = cache.get(id);
    return (!valid || Date.now() - valid.fetchedAt >= CACHE_TTL_MS) && !inFlight.has(id);
  });

  if (missingIds.length > 0) {
    const batchPromise = getStopsRealtimeBatch({ data: { stopCodes: missingIds, line } })
      .then((res) => {
        const fetchedAt = Date.now();
        for (const stopId of missingIds) {
          const arrivalsRaw = res.stops?.[stopId] ?? [];
          const arrivals: StopArrival[] = arrivalsRaw.map((a) => ({
            line: normalizeLine(a.line),
            destination: a.destination,
            etaMin: a.etaMin,
            lat: a.lat,
            lng: a.lng,
          }));
          cache.set(stopId, {
            arrivals,
            all: arrivals.map((a) => a.etaMin).sort((a, b) => a - b),
            etaMin: arrivals[0]?.etaMin ?? null,
            fetchedAt,
          });
        }
      })
      .catch(() => {
        const fetchedAt = Date.now();
        for (const stopId of missingIds) {
          cache.set(stopId, { arrivals: [], all: [], etaMin: null, fetchedAt });
        }
      })
      .finally(() => {
        for (const stopId of missingIds) inFlight.delete(stopId);
      });

    for (const stopId of missingIds) {
      inFlight.set(stopId, batchPromise.then(() => cache.get(stopId) ?? {
        arrivals: [],
        all: [],
        etaMin: null,
        fetchedAt: Date.now(),
      }));
    }
  }

  await Promise.all(ids.map((id) => inFlight.get(id) ?? Promise.resolve(cache.get(id) ?? null)));

  return Object.fromEntries(
    stopIds.map((id) => {
      const cached = readCachedStopRealtime(id, line);
      return [id, cached?.all.slice(0, 1) ?? []];
    }),
  );
}
