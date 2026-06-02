// Hook que consume el snapshot realtime de Vectalia (cacheado 5 min server-side).
// Refrescamos 3s ANTES de que expire el TTL del servidor para que el nuevo
// snapshot llegue justo cuando caduca la caché y la transición sea invisible.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLineRealtimeState, type RealtimeLineState } from "@/lib/bus-realtime.functions";

const SERVER_TTL_MS = 5 * 60 * 1000; // debe coincidir con CACHE_TTL_MS en bus-realtime.functions.ts
const REFRESH_LEAD_MS = 3_000;       // pedimos el siguiente snapshot 3s antes

export function useLineRealtime(lineCode: string | null | undefined) {
  const fetchFn = useServerFn(getLineRealtimeState);
  return useQuery<RealtimeLineState>({
    queryKey: ["bus-realtime-line", lineCode],
    queryFn: () => fetchFn({ data: { lineCode: lineCode! } }),
    enabled: !!lineCode,
    staleTime: SERVER_TTL_MS - REFRESH_LEAD_MS,
    refetchInterval: (query) => {
      const data = query.state.data as RealtimeLineState | undefined;
      const ageSec = data?.ageSec ?? 0;
      const remainingMs = SERVER_TTL_MS - ageSec * 1000 - REFRESH_LEAD_MS;
      // mínimo 5s para no martillear si el snapshot llega ya viejo
      return Math.max(5_000, remainingMs);
    },
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
