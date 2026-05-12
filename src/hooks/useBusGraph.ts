import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RouteStop } from "@/lib/bus-routing";

export type LineRow = { code: string; name: string; color: string | null };

type Cache = {
  stops: RouteStop[];
  lines: LineRow[];
  stopsMeta: { code: string; name: string | null }[];
};

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

async function load(): Promise<Cache> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [lsRes, linesRes, stopsRes] = await Promise.all([
      supabase
        .from("bus_line_stops")
        .select("line_code,direction,seq,stop_code,stop_name")
        .order("line_code")
        .order("direction")
        .order("seq"),
      supabase.from("bus_lines").select("code,name,color").order("code"),
      supabase.from("bus_stops").select("code,name").order("code"),
    ]);
    cache = {
      stops: (lsRes.data ?? []) as RouteStop[],
      lines: (linesRes.data ?? []) as LineRow[],
      stopsMeta: (stopsRes.data ?? []) as { code: string; name: string | null }[],
    };
    return cache;
  })();
  const r = await inflight;
  inflight = null;
  return r;
}

export function useBusGraph() {
  const [data, setData] = useState(cache);
  const [loading, setLoading] = useState(!cache);
  useEffect(() => {
    if (cache) return;
    load().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);
  return { data, loading };
}
