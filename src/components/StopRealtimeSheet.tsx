import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Loader2, Bus, Clock, RefreshCw, ExternalLink } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { StopArrival } from "@/lib/bus-realtime-client";
import { getStopRealtime } from "@/lib/bus-realtime.functions";
import { liveStopUrl } from "@/lib/bus";
import { ArrivalAlarm } from "@/components/ArrivalAlarm";
import { useBusEngine } from "@/hooks/useBusEngine";
import { predictStopArrivals } from "@/lib/bus-engine/predict";

const RealtimeMiniMap = lazy(() =>
  import("./RealtimeMiniMap").then((m) => ({ default: m.RealtimeMiniMap })),
);

export type StopRealtimeContext = {
  code: string;
  name: string | null;
  lines: string[] | null;
  lat: number | null;
  lng: number | null;
};

const TICK_MS = 30_000;
const SUBUS_TIMEOUT_MS = 2_500;
type Source = "live" | "estimated" | "none";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function StopRealtimeSheet({
  stop,
  open,
  onOpenChange,
}: {
  stop: StopRealtimeContext | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: engine } = useBusEngine();
  const [arrivals, setArrivals] = useState<StopArrival[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [source, setSource] = useState<Source>("none");
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open || !stop) return;
    let cancelled = false;

    const computeFallback = (): StopArrival[] => {
      if (!engine) return [];
      const wanted = new Set((stop.lines ?? []).map((l) => l.toUpperCase()));
      const raw = predictStopArrivals(engine, stop.code, new Date());
      const filtered = wanted.size > 0
        ? raw.filter((r) => wanted.has(r.line.toUpperCase()))
        : raw;
      return filtered.slice(0, 12).map((r) => ({
        line: r.line,
        destination: r.destination,
        etaMin: r.etaMin,
        lat: null,
        lng: null,
      }));
    };

    const run = async () => {
      setLoading(true);
      try {
        const res = await withTimeout(
          getStopRealtime({ data: { stopCode: stop.code } }),
          SUBUS_TIMEOUT_MS,
        );
        if (cancelled) return;
        const wanted = new Set((stop.lines ?? []).map((l) => l.toUpperCase()));
        const live = (res.arrivals ?? [])
          .filter((a) => wanted.size === 0 || wanted.has(a.line.toUpperCase()))
          .slice(0, 12);
        if (live.length > 0) {
          setArrivals(live);
          setSource("live");
          setFetchedAt(Date.now());
          return;
        }
        // Subus respondió vacío → fallback
        const fb = computeFallback();
        setArrivals(fb);
        setSource(fb.length > 0 ? "estimated" : "none");
        setFetchedAt(Date.now());
      } catch {
        if (cancelled) return;
        const fb = computeFallback();
        setArrivals(fb);
        setSource(fb.length > 0 ? "estimated" : "none");
        setFetchedAt(Date.now());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    const id = setInterval(run, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [open, stop, engine, tick]);

  // reset when closed
  useEffect(() => {
    if (!open) {
      setArrivals([]);
      setFetchedAt(null);
      setSource("none");
    }
  }, [open]);

  const error: string | null = null;

  const buses = useMemo(
    () =>
      arrivals
        .filter((a) => a.lat != null && a.lng != null)
        .map((a) => ({
          line: a.line,
          destination: a.destination,
          etaMin: a.etaMin,
          lat: a.lat as number,
          lng: a.lng as number,
        })),
    [arrivals],
  );



  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b bg-background px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-left">
            <Bus className="h-4 w-4 text-primary" />
            <span>
              Parada {stop?.code}
              {stop?.name ? ` · ${stop.name}` : ""}
            </span>
          </SheetTitle>
          <SheetDescription className="flex items-center justify-between text-xs">
            <span>
              {fetchedAt ? `Actualizado ${new Date(fetchedAt).toLocaleTimeString("es-ES")}` : "Cargando…"}
              {loading && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
            </span>
            {stop && (
              <a
                href={liveStopUrl(stop.code)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Web oficial <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {/* Map */}
          {stop?.lat != null && stop?.lng != null ? (
            <Suspense
              fallback={
                <div className="flex h-[260px] items-center justify-center rounded-xl border text-sm text-muted-foreground">
                  Cargando mapa…
                </div>
              }
            >
              <RealtimeMiniMap
                stop={{ lat: stop.lat, lng: stop.lng, name: stop.name, code: stop.code }}
                buses={buses}
              />
            </Suspense>
          ) : (
            <div className="rounded-xl border bg-muted/30 p-4 text-xs text-muted-foreground">
              Esta parada no tiene coordenadas. Geocodifica la lista en /bus para ver el mapa.
            </div>
          )}

          {/* Alarm */}
          {stop && (
            <ArrivalAlarm
              arrivals={arrivals}
              stopName={stop.name ?? `Parada ${stop.code}`}
              availableLines={Array.from(
                new Set([...(stop.lines ?? []), ...arrivals.map((a) => a.line)]),
              ).sort((a, b) => Number(a) - Number(b))}
            />
          )}

          {/* Arrivals */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Próximas llegadas
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTick((t) => t + 1)}
                disabled={loading}
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Refrescar
              </Button>

            </div>

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {!error && arrivals.length === 0 && !loading && (
              <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                No hay buses programados ahora mismo. Puede que sea fuera de horario.
              </p>
            )}

            <ul className="space-y-2">
              {arrivals.map((a, i) => (
                <li
                  key={`${a.line}-${a.etaMin}-${i}`}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="h-9 w-9 justify-center rounded-full text-sm font-bold">
                      {a.line}
                    </Badge>
                    <div className="leading-tight">
                      <div className="font-medium">{a.destination}</div>
                      {a.lat != null && (
                        <div className="text-xs text-muted-foreground">
                          Bus localizado en mapa
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-right">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={`font-semibold ${a.etaMin <= 3 ? "text-primary" : ""}`}>
                      {a.etaMin}
                    </span>
                    <span className="text-xs text-muted-foreground">min</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
