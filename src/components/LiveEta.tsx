import { useEffect, useState } from "react";

interface Props {
  line: string;
  stop: string;
  initialMin?: number | null;
  intervalMs?: number;
}

export function LiveEta({ line, stop, initialMin = null, intervalMs = 30000 }: Props) {
  const [eta, setEta] = useState<number | null>(initialMin);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `/api/public/bus-eta?stop=${encodeURIComponent(stop)}&line=${encodeURIComponent(line)}`,
          { cache: "no-store" },
        );
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) setEta(typeof j.etaMin === "number" ? j.etaMin : null);
        }
      } catch {
        /* noop */
      } finally {
        if (!cancelled) setLoading(false);
        if (!cancelled) timer = setTimeout(tick, intervalMs);
      }
    };

    // Refresca enseguida si no había dato inicial; si lo había, espera el intervalo.
    timer = setTimeout(tick, initialMin == null ? 500 : intervalMs);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [line, stop, intervalMs, initialMin]);

  const label =
    eta == null ? "sin paso confirmado" : eta <= 0 ? "llegando" : `${eta} min`;

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
      🚌 {label}
    </span>
  );
}
