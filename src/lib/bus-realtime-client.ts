import { fetchStopFromQR, normalizeLine } from "@/lib/bus-qr-client";
import { ingestStopSnapshots } from "@/lib/bus-realtime.functions";

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

// Lee QR directo desde el navegador (sin scraping, sin server). El servidor solo
// recibe el snapshot ya parseado para cachearlo en BBDD (fire-and-forget).
async function fetchStop(stopId: string): Promise<StopRealtimeResult> {
  const valid = cache.get(stopId);
  if (valid && Date.now() - valid.fetchedAt < CACHE_TTL_MS) return valid;
  const pending = inFlight.get(stopId);
  if (pending) return pending;

  const promise = (async (): Promise<StopRealtimeResult> => {
    const qr = await fetchStopFromQR(stopId);
    const arrivals: StopArrival[] = [];
    const snaps: Array<{ stopCode: string; lineCode: string; etaMinutes: number[] }> = [];
    if (qr) {
      for (const [lc, info] of qr.byLine.entries()) {
        snaps.push({ stopCode: stopId, lineCode: lc, etaMinutes: info.minutes });
        for (const m of info.minutes) {
          arrivals.push({ line: lc, destination: info.destination, etaMin: m, lat: null, lng: null });
        }
      }
      arrivals.sort((a, b) => a.etaMin - b.etaMin);
    }
    const result: StopRealtimeResult = {
      arrivals,
      all: arrivals.map((a) => a.etaMin),
      etaMin: arrivals[0]?.etaMin ?? null,
      fetchedAt: Date.now(),
    };
    cache.set(stopId, result);
    if (snaps.length > 0) {
      ingestStopSnapshots({ data: { snapshots: snaps } }).catch(() => {});
    }
    return result;
  })().finally(() => {
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
    // Lectura directa del QR desde el navegador para cada parada. Sin scraping
    // ni server. `fetchStop` ya hace dedup, cache TTL e ingesta a BBDD.
    for (const stopId of missingIds) {
      inFlight.set(stopId, fetchStop(stopId));
    }
  }
  // line se mantiene como parámetro para filtrar el resultado abajo.
  void line;

  await Promise.all(ids.map((id) => inFlight.get(id) ?? Promise.resolve(cache.get(id) ?? null)));

  return Object.fromEntries(
    stopIds.map((id) => {
      const cached = readCachedStopRealtime(id, line);
      return [id, cached?.all.slice(0, 1) ?? []];
    }),
  );
}
