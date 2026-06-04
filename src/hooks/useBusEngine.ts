// Hook que carga el snapshot del motor predictivo y devuelve un BusEngineData
// listo para usar. Snapshot grande pero estable: staleTime largo y caché.

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getBusEngineSnapshot } from "@/lib/bus-predict.functions";
import { fromSnapshot } from "@/lib/bus-engine/from-snapshot";
import type { BusEngineData } from "@/lib/bus-engine/types";

export function useBusEngine(): { data: BusEngineData | null; loading: boolean } {
  const { data: snap, isLoading } = useQuery({
    queryKey: ["bus-engine-snapshot"],
    queryFn: () => getBusEngineSnapshot(),
    staleTime: 0,
    gcTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
  const data = useMemo(() => (snap ? fromSnapshot(snap) : null), [snap]);
  return { data, loading: isLoading };
}
