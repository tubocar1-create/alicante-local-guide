// Hook realtime de línea.
//
// === Arquitectura Bridge ===
// La lectura en vivo usa el bridge HTTPS /api/public/bus-datos.
// En preview se consulta el bridge, se parsea, se ingesta a BBDD y refresca.
//
// El sitio PUBLICADO (vamosalicante.com, *.lovable.app prod) NO hace
// scraping: lee los snapshots ya ingestados por el preview desde la BBDD
// (server fn `getLineRealtimeState`) cada 40 s. Entre lectura y lectura
// el dashboard "modela" el movimiento decrementando los ETAs en local
// según el `capturedAt` (ya implementado en el consumidor).
//
// Esto crea un puente: la realidad medida en preview se replica en prod
// con un tick local de 15 s (gestionado por el reloj 1 s del dashboard,
// que produce decrementos visualmente continuos).

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLineStops,
  getLineRealtimeState,
  ingestStopSnapshots,
  type RealtimeLineState,
} from "@/lib/bus-realtime.functions";
import { fetchStopFromQR, normalizeLine } from "@/lib/bus-qr-client";

const REFRESH_PREVIEW_MS = 30_000;
const REFRESH_PUBLISHED_MS = 40_000;
const STALE_MS = 5 * 60 * 1000;
const FROZEN_MS = 10 * 60 * 1000;
const CONCURRENCY = 6;

export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false; // SSR → trátalo como publicado
  const h = window.location.hostname;
  // Producción real: SOLO los dominios de cliente (vamosalicante.com y el
  // alicante-local-guide.lovable.app publicado). Todo lo demás es preview.
  const isProd =
    h === "vamosalicante.com" ||
    h === "www.vamosalicante.com" ||
    h === "alicante-local-guide.lovable.app";
  return !isProd;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function useLineRealtime(lineCode: string | null | undefined) {
  const fetchLineStops = useServerFn(getLineStops);
  const ingest = useServerFn(ingestStopSnapshots);
  const fetchLineFromCache = useServerFn(getLineRealtimeState);

  const preview = isPreviewHost();

  return useQuery<RealtimeLineState>({
    queryKey: ["bus-realtime-line", lineCode, preview ? "preview" : "published"],
    enabled: !!lineCode,
    refetchInterval: preview ? REFRESH_PREVIEW_MS : REFRESH_PUBLISHED_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const code = normalizeLine(lineCode!);

      // === SITIO PUBLICADO: leer SOLO cache de BBDD (bridge desde preview). ===
      if (!preview) {
        return await fetchLineFromCache({ data: { lineCode: code } });
      }

      // === PREVIEW: lectura real vía bridge + ingesta a BBDD. ===
      const fetchedAtIso = new Date().toISOString();
      const meta = await fetchLineStops({ data: { lineCode: code } });
      const stops = meta.stops;
      if (stops.length === 0) {
        return {
          lineCode: code,
          fetchedAt: fetchedAtIso,
          capturedAt: null,
          ageSec: null,
          stale: true,
          frozen: true,
          stops: [],
        };
      }

      const uniqueCodes = Array.from(new Set(stops.map((s) => s.stop_code)));
      const qrByStop = new Map<string, Awaited<ReturnType<typeof fetchStopFromQR>>>();
      await mapLimit(uniqueCodes, CONCURRENCY, async (sc) => {
        const r = await fetchStopFromQR(sc);
        qrByStop.set(sc, r);
      });

      const cachedState = await fetchLineFromCache({ data: { lineCode: code } });
      const cachedByStop = new Map(cachedState.stops.map((s) => [s.stopCode, s]));

      const result = stops.map((s) => {
        const qr = qrByStop.get(s.stop_code);
        const mins = qr?.byLine.get(code)?.minutes ?? [];
        const cached = cachedByStop.get(s.stop_code);
        const etaMinutes = mins.length > 0 ? mins : (cached?.etaMinutes ?? []);
        const capturedAt = mins.length > 0 ? fetchedAtIso : (cached?.capturedAt ?? fetchedAtIso);
        return {
          stopCode: s.stop_code,
          stopName: s.stop_name,
          direction: (s.direction === 2 ? 2 : 1) as 1 | 2,
          seq: s.seq,
          etaMinutes,
          capturedAt,
          ageSec: mins.length > 0 ? 0 : (cached?.ageSec ?? 0),
          stale: mins.length > 0 ? false : (cached?.stale ?? true),
          frozen: mins.length > 0 ? false : (cached?.frozen ?? true),
        };
      });

      const hasAnyLiveEta = result.some((s) => s.etaMinutes.length > 0);
      if (!hasAnyLiveEta && cachedState.stops.some((s) => s.etaMinutes.length > 0)) {
        return cachedState;
      }

      // Persistir TODAS las líneas vistas en cada parada → fuente del bridge.
      const snaps: Array<{ stopCode: string; lineCode: string; etaMinutes: number[] }> = [];
      for (const [sc, qr] of qrByStop.entries()) {
        if (!qr) continue;
        for (const [lc, info] of qr.byLine.entries()) {
          snaps.push({ stopCode: sc, lineCode: lc, etaMinutes: info.minutes });
        }
      }
      if (snaps.length > 0) {
        for (let i = 0; i < snaps.length; i += 100) {
          const chunk = snaps.slice(i, i + 100);
          ingest({ data: { snapshots: chunk } }).catch(() => {});
        }
      }

      return {
        lineCode: code,
        fetchedAt: fetchedAtIso,
        capturedAt: hasAnyLiveEta ? fetchedAtIso : cachedState.capturedAt,
        ageSec: hasAnyLiveEta ? 0 : cachedState.ageSec,
        stale: hasAnyLiveEta ? false : cachedState.stale,
        frozen: hasAnyLiveEta ? false : cachedState.frozen,
        stops: result,
      };
    },
  });
}

// Re-export para no romper imports antiguos.
export { STALE_MS, FROZEN_MS };
