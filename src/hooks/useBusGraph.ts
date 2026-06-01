import { busStaticGraph } from "@/data/bus-static";
import type { RouteStop } from "@/lib/bus-routing";

export type LineRow = { code: string; name: string; color: string | null };

type Cache = {
  stops: RouteStop[];
  lines: LineRow[];
  stopsMeta: { code: string; name: string | null; lat: number | null; lng: number | null }[];
};

let cache: Cache | null = busStaticGraph as Cache;

export function useBusGraph() {
  return { data: cache, loading: false };
}
