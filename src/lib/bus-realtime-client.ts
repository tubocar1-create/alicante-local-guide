import { getStopRealtime, getStopsRealtimeBatch } from "@/lib/bus-realtime.functions";
import { isEstimatedMode } from "@/lib/transport-mode";
import {
  getEstimatedStopArrivals,
  isEstimatedSupported,
  isNightLine as isNightLineCode,
} from "@/lib/bus-eta-estimated";


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
const batchQueues = new Map<string, { ids: Set<string>; waiters: Map<string, (() => void)[]>; timer: ReturnType<typeof setTimeout> | null }>();

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

// El navegador no puede hacer fetch directo al QR oficial (CORS/redirecciones).
// Delegamos en la server function `getStopRealtime`, que llama a SUBUS directo
// desde el servidor con User-Agent real y caché compartida.
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
  const normalizedStopId = stopId.trim();
  const cached = readCachedStopRealtime(normalizedStopId, line);
  if (cached) return selectStopRealtime(cached, index, minMin);
  if (line) {
    await queueBatchStop(normalizedStopId, line);
    const batched = readCachedStopRealtime(normalizedStopId, line) ?? {
      arrivals: [],
      all: [],
      etaMin: null,
      fetchedAt: Date.now(),
    };
    return selectStopRealtime(batched, index, minMin);
  }
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

function selectStopRealtime(base: StopRealtimeResult, index: number, minMin: number | null): StopRealtimeResult {
  const filtered = typeof minMin === "number" ? base.all.filter((m) => m >= minMin) : base.all;
  return {
    ...base,
    etaMin: filtered[Math.min(index, Math.max(0, filtered.length - 1))] ?? null,
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

function queueBatchStop(stopId: string, line: string): Promise<void> {
  const key = normalizeLine(line);
  return new Promise((resolve) => {
    let queue = batchQueues.get(key);
    if (!queue) {
      queue = { ids: new Set(), waiters: new Map(), timer: null };
      batchQueues.set(key, queue);
    }
    queue.ids.add(stopId);
    const waiters = queue.waiters.get(stopId) ?? [];
    waiters.push(resolve);
    queue.waiters.set(stopId, waiters);

    if (!queue.timer) {
      queue.timer = setTimeout(async () => {
        const active = batchQueues.get(key);
        if (!active) return;
        batchQueues.delete(key);
        const ids = [...active.ids];
        try {
          await getClientStopsRealtimeBatch({ stopIds: ids, line: key });
        } finally {
          for (const callbacks of active.waiters.values()) {
            for (const done of callbacks) done();
          }
        }
      }, 40);
    }
  });
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
    const chunks: string[][] = [];
    for (let i = 0; i < missingIds.length; i += 12) chunks.push(missingIds.slice(i, i + 12));

    const batchPromise = Promise.all(chunks.map((chunk) => getStopsRealtimeBatch({ data: { stopCodes: chunk, line } })))
      .then((res) => {
        const fetchedAt = Date.now();
        for (const stopId of missingIds) {
          const arrivalsRaw = res.flatMap((batch) => batch.stops?.[stopId] ?? []);
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
