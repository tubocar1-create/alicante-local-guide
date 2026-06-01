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
import { getClientStopRealtime, type StopArrival } from "@/lib/bus-realtime-client";
import { liveStopUrl } from "@/lib/bus";
import { ArrivalAlarm } from "@/components/ArrivalAlarm";

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

const POLL_MS = 15_000;

export function StopRealtimeSheet({
  stop,
  open,
  onOpenChange,
}: {
  stop: StopRealtimeContext | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [arrivals, setArrivals] = useState<StopArrival[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !stop) return;
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const clearRetry = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };

    const attempt = async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      controller?.abort();
      controller = new AbortController();
      try {
        const r = await getClientStopRealtime({ stopId: stop.code, signal: controller.signal });
        if (cancelled) return;
        const wanted = new Set((stop.lines ?? []).map((l) => l.toUpperCase()));
        const next = wanted.size > 0 ? r.arrivals.filter((a) => wanted.has(a.line.toUpperCase())) : r.arrivals;
        if (next.length > 0) {
          setArrivals(next);
          setFetchedAt(r.fetchedAt);
          clearRetry();
          if (!cancelled) pollTimer = setTimeout(attempt, POLL_MS);
          return;
        }
        // Sin datos: reintento en 5s solo para esta parada.
        if (!cancelled) retryTimer = setTimeout(attempt, 5_000);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error");
          retryTimer = setTimeout(attempt, 5_000);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    attempt();
    return () => {
      cancelled = true;
      controller?.abort();
      if (pollTimer) clearTimeout(pollTimer);
      clearRetry();
    };
  }, [open, stop]);

  // reset when stop changes
  useEffect(() => {
    if (!open) {
      setArrivals([]);
      setError(null);
      setFetchedAt(null);
    }
  }, [open]);

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
                onClick={() => {
                  if (!stop) return;
                  setLoading(true);
                  getClientStopRealtime({ stopId: stop.code })
                    .then((r) => {
                      const wanted = new Set((stop.lines ?? []).map((l) => l.toUpperCase()));
                      setArrivals(wanted.size > 0 ? r.arrivals.filter((a) => wanted.has(a.line.toUpperCase())) : r.arrivals);
                      setFetchedAt(r.fetchedAt);
                      setError(null);
                    })
                    .catch((e) =>
                      setError(e instanceof Error ? e.message : "Error"),
                    )
                    .finally(() => setLoading(false));
                }}
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
