import { useEffect, useState } from "react";

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

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ stop, line });
        if (index > 0) params.set("index", String(index));
        if (typeof minMin === "number" && minMin > 0) params.set("min", String(minMin));
        const r = await fetch(`/api/public/bus-eta?${params.toString()}`, { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) {
            setEta(typeof j.etaMin === "number" ? j.etaMin : null);
            setUpdatedAt(Date.now());
          }
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
  const isImminent = hasEta && eta! <= 3;
  const minsText =
    !hasEta ? "—" : eta! <= 0 ? "llegando" : `${eta} min`;

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
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {hasEta ? (eta! <= 0 ? "Llegando" : `Faltan ${eta} min`) : "Sin paso"}
          </span>
          <span
            className={`text-3xl font-bold tabular-nums leading-none ${
              isImminent ? "text-primary" : "text-foreground"
            }`}
          >
            {arrival ? formatHHMM(arrival) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}
