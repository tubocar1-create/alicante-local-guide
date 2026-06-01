import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Bus, Clock, Loader2, AlertTriangle, CheckCircle2, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClientStopRealtime, type StopArrival } from "@/lib/bus-realtime-client";
import type { Trip } from "@/lib/bus-routing";
import { estimateLegMinutes, formatMinutes } from "@/lib/bus-eta";

const POLL_MS = 15_000;
const PALETTE = [
  "#E84E2C", "#3FA9F5", "#7BC043", "#F4B400", "#9B59B6",
  "#1ABC9C", "#E91E63", "#34495E", "#FF7F50", "#00ACC1",
];

function colorForLine(code: string, paletteIdx: number, override?: string | null) {
  return override || PALETTE[paletteIdx % PALETTE.length];
}

export function TripTimeline({
  trip,
  coords,
  lineColors,
  lineIndex,
  selected,
  onSelect,
}: {
  trip: Trip;
  coords: Map<string, { lat: number; lng: number }>;
  lineColors: Map<string, string | null>;
  lineIndex: Map<string, number>;
  selected: boolean;
  onSelect: () => void;
}) {
  // Per-leg estimates
  const legMins = useMemo(() => trip.legs.map((l) => estimateLegMinutes(l, coords)), [trip, coords]);
  const totalMin = legMins.reduce((a, b) => a + b, 0);

  // Realtime: ETA at origin for line A; ETA at each transfer stop for next leg's line.
  // We only poll when this trip is the selected one.
  const [originEta, setOriginEta] = useState<StopArrival[] | null>(null);
  const [transferEtas, setTransferEtas] = useState<Record<number, StopArrival[]>>({});
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

    const clearRetry = (key: string) => {
      const t = retryTimers.get(key);
      if (t) {
        clearTimeout(t);
        retryTimers.delete(key);
      }
    };

    // Llama al API para una parada/línea. Si el API falla o no
    // devuelve datos, reintenta cada 5s SOLO para esa parada
    // hasta obtener información.
    const fetchStopWithRetry = (
      key: string,
      stopCode: string,
      lineCode: string,
      onArrivals: (arr: StopArrival[]) => void,
    ) => {
      clearRetry(key);
      const attempt = async () => {
        if (cancelled) return;
        try {
          const r = await getClientStopRealtime({ stopId: stopCode, line: lineCode });
          if (cancelled) return;
          if (r.arrivals && r.arrivals.length > 0) {
            onArrivals(r.arrivals);
            clearRetry(key);
            return;
          }
        } catch {
          /* sin respuesta válida, reintentamos */
        }
        if (cancelled) return;
        retryTimers.set(key, setTimeout(attempt, 5_000));
      };
      attempt();
    };

    const tick = () => {
      setLoading(true);
      try {
        const first = trip.legs[0];
        fetchStopWithRetry(
          `origin:${first.fromCode}:${first.lineCode}`,
          first.fromCode,
          first.lineCode,
          (arr) => {
            if (!cancelled) setOriginEta(arr);
          },
        );
        if (selected) {
          for (let i = 1; i < trip.legs.length; i++) {
            const transfer = trip.legs[i];
            const idx = i;
            fetchStopWithRetry(
              `transfer:${idx}:${transfer.fromCode}:${transfer.lineCode}`,
              transfer.fromCode,
              transfer.lineCode,
              (arr) => {
                if (!cancelled) setTransferEtas((prev) => ({ ...prev, [idx]: arr }));
              },
            );
          }
        }
        if (!cancelled) setFetchedAt(new Date().toISOString());
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled) pollTimer = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      retryTimers.forEach((t) => clearTimeout(t));
      retryTimers.clear();
    };
  }, [selected, trip]);

  const firstLine = trip.legs[0].lineCode;
  const nextOrigin = useMemo(() => {
    if (!originEta) return null;
    const f = originEta.filter((a) => a.line === firstLine).sort((a, b) => a.etaMin - b.etaMin);
    return f[0] ?? null;
  }, [originEta, firstLine]);

  return (
    <div
      className={`relative rounded-2xl border bg-background transition-colors ${
        selected ? "border-primary shadow-sm" : "border-border hover:border-foreground/30"
      }`}
    >
      {/* Header strip */}
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center justify-between gap-3 px-4 pt-4 text-left"
      >
        <div className="flex items-center gap-2">
          {trip.transfers === 0 ? (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Directo</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Repeat className="h-3 w-3" /> {trip.transfers} transbordo
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{trip.totalStops} paradas</span>
        </div>
        <div className="flex items-center gap-1.5">
          {trip.legs.map((l, i) => {
            const c = colorForLine(l.lineCode, lineIndex.get(l.lineCode) ?? 0, lineColors.get(l.lineCode));
            return (
              <span key={i} className="flex items-center gap-1">
                <span
                  className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                  style={{ backgroundColor: c }}
                >
                  L{l.lineCode}
                </span>
                {i < trip.legs.length - 1 && (
                  <Repeat className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            );
          })}
        </div>
      </button>

      <div className="flex items-baseline gap-2 px-4 pt-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-2xl font-semibold tabular-nums">~{formatMinutes(totalMin)}</span>
        <span className="text-xs text-muted-foreground">tiempo estimado a bordo</span>
      </div>

      {/* Timeline */}
      <div className="px-4 pb-4 pt-3">
        {trip.legs.map((leg, legIdx) => {
          const c = colorForLine(leg.lineCode, lineIndex.get(leg.lineCode) ?? 0, lineColors.get(leg.lineCode));
          const isFirst = legIdx === 0;
          const transferArrivals = transferEtas[legIdx];
          const nextTransfer = transferArrivals
            ? transferArrivals.filter((a) => a.line === leg.lineCode).sort((a, b) => a.etaMin - b.etaMin)[0]
            : null;

          // Connection: time from now until transfer bus passes minus
          //   (origin first bus eta + sum of previous legs estimated minutes)
          let connectionInfo: { mins: number; tight: boolean } | null = null;
          if (!isFirst && selected && nextOrigin && nextTransfer) {
            const previousMins = legMins.slice(0, legIdx).reduce((a, b) => a + b, 0);
            const arriveAtTransfer = nextOrigin.etaMin + previousMins;
            const wait = nextTransfer.etaMin - arriveAtTransfer;
            connectionInfo = { mins: wait, tight: wait < 2 };
          }

          return (
            <div key={legIdx}>
              {/* Connection block (between legs) */}
              {!isFirst && (
                <div className="my-2 ml-1 flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 p-2 text-xs">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">Transbordo en {leg.fromName}</span>
                  {connectionInfo ? (
                    connectionInfo.mins < 0 ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Conexión imposible (siguiente bus pasa antes)
                      </span>
                    ) : connectionInfo.tight ? (
                      <span className="ml-auto inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Justo: {connectionInfo.mins} min de margen
                      </span>
                    ) : (
                      <span className="ml-auto inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {connectionInfo.mins} min de espera
                      </span>
                    )
                  ) : selected ? (
                    <span className="ml-auto text-muted-foreground">
                      <Loader2 className="inline h-3 w-3 animate-spin" /> calculando…
                    </span>
                  ) : null}
                </div>
              )}

              {/* Leg block */}
              <div className="relative pl-5">
                <span
                  className="absolute left-1.5 top-2 bottom-2 w-1 rounded-full"
                  style={{ backgroundColor: c }}
                />
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Bus className="h-3.5 w-3.5" /> Línea {leg.lineCode}
                  <span className="text-muted-foreground/70">· {leg.direction === 1 ? "Ida" : "Vuelta"}</span>
                  <span className="ml-auto text-foreground">~{formatMinutes(legMins[legIdx])}</span>
                </div>

                {/* Stops mini-list */}
                <ol className="space-y-1.5">
                  <StopRow
                    name={leg.fromName}
                    code={leg.fromCode}
                    color={c}
                    bold
                    suffix={
                      isFirst ? (
                        nextOrigin ? (
                          <span className="font-semibold text-primary">
                            Próximo bus: {nextOrigin.etaMin} min
                          </span>
                        ) : loading && originEta == null ? (
                          <span className="text-muted-foreground">Buscando…</span>
                        ) : (
                          <span className="text-muted-foreground">Sin paso ahora</span>
                        )
                      ) : null
                    }
                  />
                  {leg.intermediate.length > 0 && (
                    <li className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                      <ArrowDown className="h-3 w-3" />
                      {leg.intermediate.length} paradas intermedias
                    </li>
                  )}
                  <StopRow name={leg.toName} code={leg.toCode} color={c} bold />
                </ol>
              </div>
            </div>
          );
        })}

        {fetchedAt && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Tiempos en vivo · actualizado {new Date(fetchedAt).toLocaleTimeString("es-ES")}
            {loading && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
          </p>
        )}
      </div>
    </div>
  );
}

function StopRow({
  name,
  code,
  color,
  bold,
  suffix,
}: {
  name: string;
  code: string;
  color: string;
  bold?: boolean;
  suffix?: React.ReactNode;
}) {
  return (
    <li className="relative flex items-center gap-2 text-sm">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full ring-2 ring-background"
        style={{ backgroundColor: color }}
      />
      <span className={bold ? "font-semibold" : ""}>{name}</span>
      {code && <span className="text-xs text-muted-foreground">· {code}</span>}
      {suffix && <span className="ml-auto text-xs">{suffix}</span>}
    </li>
  );
}
