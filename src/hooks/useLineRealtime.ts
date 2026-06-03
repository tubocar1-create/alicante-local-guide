// Hook realtime de línea.
//
// Arquitectura simplificada: el navegador hace UNA sola llamada a la server
// function `getLineLive`. Esa función corre en Cloudworkers, hace en paralelo
// las N peticiones a qr.vectalia.es por parada, parsea y devuelve el estado
// completo de la línea con ETAs en vivo. Persiste snapshots a BBDD como
// respaldo para el caso de que alguna parada falle.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getLineLive,
  type RealtimeLineState,
} from "@/lib/bus-realtime.functions";
import { normalizeLine } from "@/lib/bus-qr-client";

const REFRESH_MS = 30_000;
const STALE_MS = 5 * 60 * 1000;
const FROZEN_MS = 10 * 60 * 1000;

export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  const isProd =
    h === "vamosalicante.com" ||
    h === "www.vamosalicante.com" ||
    h === "alicante-local-guide.lovable.app";
  return !isProd;
}

export function useLineRealtime(lineCode: string | null | undefined) {
  const fetchLineLive = useServerFn(getLineLive);

  return useQuery<RealtimeLineState>({
    queryKey: ["bus-realtime-line", lineCode],
    enabled: !!lineCode,
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
    queryFn: async () => {
      const code = normalizeLine(lineCode!);
      return await fetchLineLive({ data: { lineCode: code } });
    },
  });
}

export { STALE_MS, FROZEN_MS };
