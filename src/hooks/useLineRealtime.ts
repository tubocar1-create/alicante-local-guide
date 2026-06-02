// Hook que consume el snapshot realtime de Vectalia (cacheado 5 min server-side).
// Refetch cada 60s para refrescar la edad del snapshot. Interpolación visual
// se hace en el componente (decrementar ETAs según ageSec).

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLineRealtimeState, type RealtimeLineState } from "@/lib/bus-realtime.functions";

export function useLineRealtime(lineCode: string | null | undefined) {
  const fetchFn = useServerFn(getLineRealtimeState);
  return useQuery<RealtimeLineState>({
    queryKey: ["bus-realtime-line", lineCode],
    queryFn: () => fetchFn({ data: { lineCode: lineCode! } }),
    enabled: !!lineCode,
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
