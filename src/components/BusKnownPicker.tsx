import { useMemo, useState } from "react";
import { ArrowLeft, MapPin, Search, X } from "lucide-react";
import { useBusGraph } from "@/hooks/useBusGraph";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";

export type BusStopPick = {
  line: string;
  lineName?: string;
  stopCode: string;
  stopName: string;
  distanceM?: number | null;
};

type Props = {
  onClose: () => void;
  onUnknown: () => void;
  onSelected: (pick: BusStopPick) => void;
};

const PALETTE = [
  "#E84E2C", "#3FA9F5", "#7BC043", "#F4B400", "#9B59B6",
  "#1ABC9C", "#E91E63", "#34495E", "#FF7F50", "#00ACC1",
];

export function BusKnownPicker({ onClose, onUnknown, onSelected }: Props) {
  const { data, loading } = useBusGraph();
  const { state: locState, request: requestLocation } = useUserLocation();
  const [step, setStep] = useState<"ask" | "line" | "direction" | "stop">("ask");
  const [line, setLine] = useState<{ code: string; name: string; color: string | null } | null>(null);
  const [direction, setDirection] = useState<1 | 2 | null>(null);
  const [search, setSearch] = useState("");

  const directions = useMemo(() => {
    if (!data || !line) return [] as { dir: 1 | 2; origin: string; headsign: string; count: number }[];
    const out: { dir: 1 | 2; origin: string; headsign: string; count: number }[] = [];
    for (const dir of [1, 2] as const) {
      const seq = data.stops
        .filter((s) => s.line_code === line.code && s.direction === dir)
        .sort((a, b) => a.seq - b.seq);
      if (seq.length === 0) continue;
      out.push({
        dir,
        origin: seq[0].stop_name,
        headsign: seq[seq.length - 1].stop_name,
        count: seq.length,
      });
    }
    return out;
  }, [data, line]);

  const lineStops = useMemo(() => {
    if (!data || !line || !direction) return [];
    const seq = data.stops
      .filter((s) => s.line_code === line.code && s.direction === direction)
      .sort((a, b) => a.seq - b.seq);
    const metaByCode = new Map(data.stopsMeta.map((s) => [s.code, s]));
    return seq
      .map((s) => {
        if (!s.stop_code) return null;
        const meta = metaByCode.get(s.stop_code);
        return {
          code: s.stop_code,
          name: s.stop_name ?? meta?.name ?? s.stop_code,
          lat: meta?.lat ?? null,
          lng: meta?.lng ?? null,
          seq: s.seq,
        };
      })
      .filter((x): x is { code: string; name: string; lat: number | null; lng: number | null; seq: number } => !!x);
  }, [data, line, direction]);

  const userCoords = locState.status === "ready" ? locState.coords : null;

  const stopsWithDistance = useMemo(() => {
    if (!userCoords) return lineStops.map((s) => ({ ...s, distM: null as number | null }));
    return lineStops
      .map((s) => {
        if (s.lat == null || s.lng == null) return { ...s, distM: null as number | null };
        return {
          ...s,
          distM: Math.round(distanceKm({ lat: s.lat, lng: s.lng }, userCoords) * 1000),
        };
      })
      .sort((a, b) => {
        if (a.distM == null) return 1;
        if (b.distM == null) return -1;
        return a.distM - b.distM;
      });
  }, [lineStops, userCoords]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stopsWithDistance.slice(0, 30);
    return stopsWithDistance
      .filter(
        (s) =>
          s.code.includes(q) ||
          (s.name ?? "").toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [stopsWithDistance, search]);

  const nearest = stopsWithDistance.find((s) => s.distM != null) ?? null;

  return (
    <div className="mt-2 rounded-3xl border border-border bg-card/95 p-4 shadow-soft backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {step !== "ask" && (
            <button
              onClick={() => {
                if (step === "stop") setStep("direction");
                else if (step === "direction") setStep("line");
                else if (step === "line") setStep("ask");
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Atrás"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h3 className="text-sm font-semibold">
            {step === "ask" && "🚌 ¿Ya sabes qué bus tomar?"}
            {step === "line" && "Elige tu línea"}
            {step === "direction" && `Línea ${line?.code} · ¿Hacia dónde?`}
            {step === "stop" && `Línea ${line?.code} · ¿Qué parada?`}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {step === "ask" && (
        <div className="grid grid-cols-1 gap-2">
          <button
            onClick={() => setStep("line")}
            className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-left text-sm font-semibold shadow-sm hover:bg-accent/40 active:scale-[0.99]"
          >
            ✅ Sí, conozco mi bus
            <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
              Te muestro el tiempo de llegada en tu parada.
            </p>
          </button>
          <button
            onClick={onUnknown}
            className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-left text-sm font-semibold shadow-sm hover:bg-accent/40 active:scale-[0.99]"
          >
            🤔 No, ayúdame a elegir ruta
            <p className="mt-0.5 text-[11px] font-normal text-muted-foreground">
              Te pregunto origen y destino para planificar el viaje.
            </p>
          </button>
        </div>
      )}

      {step === "line" && (
        <div>
          {loading && <p className="text-sm text-muted-foreground">Cargando líneas…</p>}
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-7">
            {(data?.lines ?? []).map((l, i) => {
              const color = l.color || PALETTE[i % PALETTE.length];
              return (
                <button
                  key={l.code}
                  onClick={() => {
                    setLine(l);
                    setDirection(null);
                    setStep("direction");
                    if (locState.status === "idle") requestLocation();
                  }}
                  title={l.name}
                  className="flex h-12 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm transition active:scale-95"
                  style={{ backgroundColor: color }}
                >
                  {l.code}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === "direction" && line && (
        <div className="grid grid-cols-1 gap-2">
          {directions.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin sentidos disponibles para esta línea.</p>
          )}
          {directions.map((d) => (
            <button
              key={d.dir}
              onClick={() => {
                setDirection(d.dir);
                setStep("stop");
              }}
              className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-left text-sm font-semibold shadow-sm hover:bg-accent/40 active:scale-[0.99]"
            >
              <span className="text-[11px] font-normal text-muted-foreground">
                {d.dir === 1 ? "Ida" : "Vuelta"} · {d.count} paradas
              </span>
              <div className="mt-0.5 truncate">→ {d.headsign}</div>
            </button>
          ))}
        </div>
      )}

      {step === "stop" && line && direction && (
        <div className="space-y-3">
          <button
            disabled={!nearest}
            onClick={() => {
              if (!nearest) {
                requestLocation();
                return;
              }
              onSelected({
                line: line.code,
                lineName: line.name,
                stopCode: nearest.code,
                stopName: nearest.name ?? nearest.code,
                distanceM: nearest.distM ?? null,
              });
            }}
            className="flex w-full items-center justify-between gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-left text-sm font-semibold shadow-sm hover:bg-primary/15 active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              {nearest
                ? `La más cercana: ${nearest.name} (${nearest.code})`
                : locState.status === "loading"
                  ? "Buscando tu ubicación…"
                  : "Activar ubicación para sugerirte la más cercana"}
            </span>
            {nearest?.distM != null && (
              <span className="shrink-0 text-[11px] font-bold text-primary">
                {nearest.distM} m
              </span>
            )}
          </button>

          <div>
            <div className="mb-2 flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar parada por nombre o código…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {filtered.map((s) => (
                <button
                  key={s.code}
                  onClick={() =>
                    onSelected({
                      line: line.code,
                      lineName: line.name,
                      stopCode: s.code,
                      stopName: s.name ?? s.code,
                      distanceM: s.distM ?? null,
                    })
                  }
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-background/70 px-3 py-2 text-left text-sm shadow-sm hover:bg-accent/40 active:scale-[0.99]"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{s.name}</span>
                    <span className="ml-1 text-[11px] text-muted-foreground">#{s.code}</span>
                  </span>
                  {s.distM != null && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">{s.distM} m</span>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                  Sin resultados.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
