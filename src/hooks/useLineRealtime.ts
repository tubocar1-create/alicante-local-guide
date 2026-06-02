// Hook realtime de línea: el NAVEGADOR lee Vectalia (QR datos.aspx) directamente
// para cada parada de la línea, en paralelo (con concurrencia limitada).
// Después de cada lectura, ingestamos los snapshots en BBDD para que otros
// consumidores (mapa, dashboard) los reutilicen sin volver a pedir al QR.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLineStops, ingestStopSnapshots, type RealtimeLineState } from "@/lib/bus-realtime.functions";
import { fetchStopFromQR, normalizeLine } from "@/lib/bus-qr-client";

const REFRESH_INTERVAL_MS = 30_000; // refresco cada 30s
const STALE_MS = 5 * 60 * 1000;
const FROZEN_MS = 10 * 60 * 1000;
const CONCURRENCY = 6;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

  return useQuery<RealtimeLineState>({
    queryKey: ["bus-realtime-line", lineCode],
    enabled: !!lineCode,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const code = normalizeLine(lineCode!);
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

      const now = Date.now();
      const result = stops.map((s) => {
        const qr = qrByStop.get(s.stop_code);
        const mins = qr?.byLine.get(code)?.minutes ?? [];
        return {
          stopCode: s.stop_code,
          stopName: s.stop_name,
          direction: (s.direction === 2 ? 2 : 1) as 1 | 2,
          seq: s.seq,
          etaMinutes: mins,
          capturedAt: fetchedAtIso,
          ageSec: 0,
          stale: false,
          frozen: false,
        };
      });

      // Persistir TODAS las líneas vistas en cada parada para reuso en BBDD.
      const snaps: Array<{ stopCode: string; lineCode: string; etaMinutes: number[] }> = [];
      for (const [sc, qr] of qrByStop.entries()) {
        if (!qr) continue;
        for (const [lc, info] of qr.byLine.entries()) {
          snaps.push({ stopCode: sc, lineCode: lc, etaMinutes: info.minutes });
        }
      }
      if (snaps.length > 0) {
        // Fire-and-forget: no bloqueamos el render por la ingesta.
        for (let i = 0; i < snaps.length; i += 100) {
          const chunk = snaps.slice(i, i + 100);
          ingest({ data: { snapshots: chunk } }).catch(() => {});
        }
      }

      return {
        lineCode: code,
        fetchedAt: fetchedAtIso,
        capturedAt: fetchedAtIso,
        ageSec: 0,
        stale: false,
        frozen: false,
        stops: result,
      };
    },
  });
}

// Re-export para no romper imports antiguos.
export { STALE_MS, FROZEN_MS };
