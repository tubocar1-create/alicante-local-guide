import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RouteStop } from "@/lib/bus-routing";

export type LineRow = { code: string; name: string; color: string | null };

type Cache = {
  stops: RouteStop[];
  lines: LineRow[];
  stopsMeta: { code: string; name: string | null; lat: number | null; lng: number | null }[];
};

const STORAGE_KEY = "busGraphCache:v1";

let cache: Cache | null = null;
let inflight: Promise<Cache> | null = null;

function readPersistent(): Cache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cache;
    if (!parsed?.stops || !parsed?.lines || !parsed?.stopsMeta) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writePersistent(data: Cache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

async function fetchFresh(): Promise<Cache> {
  const [lsRes, linesRes, stopsRes] = await Promise.all([
    supabase
      .from("bus_line_stops")
      .select("line_code,direction,seq,stop_code,stop_name")
      .order("line_code")
      .order("direction")
      .order("seq"),
    supabase.from("bus_lines").select("code,name,color").order("code"),
    supabase.from("bus_stops").select("code,name,lat,lng").order("code"),
  ]);
  return {
    stops: (lsRes.data ?? []) as RouteStop[],
    lines: (linesRes.data ?? []) as LineRow[],
    stopsMeta: (stopsRes.data ?? []) as Cache["stopsMeta"],
  };
}

async function load(): Promise<Cache> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const fresh = await fetchFresh();
    cache = fresh;
    writePersistent(fresh);
    return fresh;
  })();
  const r = await inflight;
  inflight = null;
  return r;
}

// Hydrate in-memory cache from localStorage at module load
if (!cache) {
  const persisted = readPersistent();
  if (persisted) cache = persisted;
}

export function useBusGraph() {
  const [data, setData] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    // Las paradas son estáticas: si existen en memoria/localStorage, no volvemos
    // a pedirlas en cada entrada. Esto elimina la espera inicial recurrente.
    if (cache) {
      setData(cache);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const fresh = await load();
        if (cancelled) return;
        setData(fresh);
      } catch {
        // ignore, keep cached data
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}
