import { useEffect, useState } from "react";
import { getClientStopRealtime } from "@/lib/bus-realtime-client";

interface Props {
  line: string;
  stop: string;
  initialMin?: number | null;
  intervalMs?: number;
  /** "lg" muestra el bloque grande (hora + minutos). "sm" mantiene el pill compacto. */
  size?: "sm" | "lg";
  /** Índice del paso a mostrar (0 = primero, 1 = segundo, etc.) */
  index?: number;
  /** Mínimo de minutos que debe tener el paso (para transbordos: tiempo del 1er trayecto). */
  minMin?: number | null;
}

function formatHHMM(date: Date): string {
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function LiveEta({
  line,
  stop,
  initialMin = null,
  intervalMs = 30000,
  size = "lg",
  index = 0,
  minMin = null,
}: Props) {
  const [eta, setEta] = useState<number | null>(initialMin);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [now, setNow] = useState<number>(Date.now());

  // Tick local cada 15s para que los minutos restantes bajen sin esperar al fetch
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const tick = async () => {
      controller?.abort();
      controller = new AbortController();
      setLoading(true);
      try {
        const r = await getClientStopRealtime({
          stopId: stop,
          line,
          index,
          minMin,
          signal: controller.signal,
        });
        if (!cancelled) {
          setEta(typeof r.etaMin === "number" ? r.etaMin : null);
          setUpdatedAt(r.fetchedAt);
        }
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    };

    timer = setTimeout(tick, initialMin == null ? 500 : intervalMs);
    return () => {
      cancelled = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
    };
  }, [line, stop, intervalMs, initialMin, index, minMin]);

  // Compact variant (legacy) — muestra minutos restantes + hora estimada
  if (size === "sm") {
    const arrivalSm = eta != null ? new Date(updatedAt + Math.max(0, eta) * 60_000) : null;
    const minsLabel =
      eta == null ? "sin paso" : eta <= 0 ? "llegando" : `faltan ${eta} min`;
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle ${
          eta != null && eta <= 3
            ? "bg-primary/15 text-primary"
            : "bg-muted text-foreground/80"
        }`}
        title={`Línea ${line} · parada ${stop}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            loading ? "bg-amber-500 animate-pulse" : eta != null ? "bg-emerald-500" : "bg-muted-foreground/50"
          }`}
        />
        🚌 {minsLabel}
        {arrivalSm && (
          <span className="font-bold tabular-nums">· {formatHHMM(arrivalSm)}</span>
        )}
      </span>
    );
  }

  // Large variant: hora estimada + minutos restantes, dentro de la tarjeta.
  const hasEta = eta != null;
  const arrival = hasEta ? new Date(updatedAt + Math.max(0, eta!) * 60_000) : null;
  // Recalcula minutos restantes desde "ahora" para que vaya bajando entre fetches
  const liveMin = arrival ? Math.max(0, Math.round((arrival.getTime() - now) / 60000)) : null;
  const isImminent = liveMin != null && liveMin <= 3;

  return (
    <div
      className={`w-full rounded-2xl border px-4 py-3 ${
        isImminent
          ? "border-primary/40 bg-primary/10"
          : hasEta
            ? "border-border bg-muted/40"
            : "border-dashed border-border bg-muted/20"
      }`}
      title={`Línea ${line} · parada ${stop}`}
    >
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              loading
                ? "bg-amber-500 animate-pulse"
                : hasEta
                  ? "bg-emerald-500"
                  : "bg-muted-foreground/50"
            }`}
          />
          Tiempo de llegada (tiempo real)
        </span>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm sm:text-base font-semibold tabular-nums text-foreground/90">
            {liveMin == null ? "Sin paso" : liveMin <= 0 ? "Llegando" : `Faltan ${liveMin} min`}
          </span>
          <span className="flex flex-col items-end leading-none">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Hora estimada
            </span>
            <span
              className={`mt-0.5 text-3xl font-bold tabular-nums leading-none ${
                isImminent ? "text-primary" : "text-foreground"
              }`}
            >
              {arrival ? formatHHMM(arrival) : "--:--"}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
