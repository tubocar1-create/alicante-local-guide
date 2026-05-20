import { useEffect, useMemo, useState } from "react";
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
  /** Si se pasa, el picker arranca preseleccionado con esta línea, saltando "ask" y "line". */
  initialLineCode?: string | null;
};

// Categorías de líneas en Alicante:
// - Nocturnas: código terminado en N (3N, 13N, 22N…)
// - Interurbanas (TAM): salen de la ciudad (27, 28, 39…)
// - Urbanas: el resto
const EXTRAURBAN_CODES = new Set(["24", "27", "28", "39"]);

function classifyLine(code: string): "night" | "extraurban" | "urban" {
  if (/N$/i.test(code)) return "night";
  if (EXTRAURBAN_CODES.has(code.toUpperCase())) return "extraurban";
  return "urban";
}

const CATEGORY_COLOR: Record<"night" | "extraurban" | "urban", string> = {
  urban: "#DC2626",       // rojo
  extraurban: "#1E3A8A",  // azul marino
  night: "#312E81",       // índigo profundo (nocturno)
};


export function BusKnownPicker({ onClose, onUnknown, onSelected, initialLineCode }: Props) {
  const { data, loading } = useBusGraph();
  const { state: locState, request: requestLocation } = useUserLocation();
  const [step, setStep] = useState<"ask" | "line" | "direction" | "stop">(
    initialLineCode ? "direction" : "ask",
  );
  const [line, setLine] = useState<{ code: string; name: string; color: string | null } | null>(
    null,
  );
  const [direction, setDirection] = useState<1 | 2 | null>(null);
  const [search, setSearch] = useState("");
  const isExpanded = step === "stop" || step === "line" || step === "direction";

  // Cuando llega el catálogo de líneas y el agente nos pidió arrancar
  // preseleccionado con una línea concreta, fijamos la línea y dejamos
  // el flujo en "direction" para que el usuario solo elija sentido/parada.
  useEffect(() => {
    if (!initialLineCode || line || !data) return;
    const target = initialLineCode.trim().toUpperCase();
    const found = data.lines.find((l) => l.code.toUpperCase() === target);
    if (found) {
      setLine(found);
      setStep("direction");
      if (locState.status === "idle") requestLocation();
    } else {
      // Línea inexistente → caemos al paso "line" para que elija manualmente.
      setStep("line");
    }
  }, [initialLineCode, data, line, locState.status, requestLocation]);

  const directions = useMemo(() => {
    if (!data || !line)
      return [] as { dir: 1 | 2; origin: string; headsign: string; count: number }[];
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
      .filter(
        (
          x,
        ): x is {
          code: string;
          name: string;
          lat: number | null;
          lng: number | null;
          seq: number;
        } => !!x,
      );
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
    if (!q) return stopsWithDistance;
    return stopsWithDistance.filter(
      (s) => s.code.includes(q) || (s.name ?? "").toLowerCase().includes(q),
    );
  }, [stopsWithDistance, search]);

  const nearest = stopsWithDistance.find((s) => s.distM != null) ?? null;

  return (
    <div
      className={[
        "rounded-2xl border border-border bg-card/95 p-2.5 shadow-soft backdrop-blur",
        isExpanded
          ? "fixed bottom-[5.75rem] left-1/2 top-[4.75rem] z-50 flex w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 flex-col"
          : "mt-2",
      ].join(" ")}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
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
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-1">
          {loading && <p className="text-sm text-muted-foreground">Cargando líneas…</p>}

          {(["urban", "extraurban", "night"] as const).map((cat, idx) => {
            const lines = (data?.lines ?? [])
              .filter((l) => classifyLine(l.code) === cat)
              .slice()
              .sort((a, b) =>
                a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }),
              );
            if (lines.length === 0) return null;
            const label =
              cat === "urban" ? "URBANAS" : cat === "extraurban" ? "INTERURBANAS" : "NOCTURNAS";
            const sublabel =
              cat === "urban"
                ? "Dentro de la ciudad"
                : cat === "extraurban"
                  ? "Fuera de Alicante"
                  : "Servicio nocturno";
            const catColor =
              cat === "urban" ? "#EF4444" : cat === "extraurban" ? "#3B82F6" : "#A855F7";
            return (
              <div key={cat} className={idx > 0 ? "border-t border-border/60 pt-4" : ""}>
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: catColor }}
                  />
                  <span className="text-[12px] font-extrabold uppercase tracking-wider text-foreground">
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">· {sublabel}</span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {lines.map((l) => {
                    const filled = cat === "urban";
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
                        className="flex aspect-square items-center justify-center gap-0.5 rounded-2xl text-[15px] font-extrabold shadow-sm transition active:scale-95"
                        style={
                          filled
                            ? {
                                color: "#fff",
                                background: `linear-gradient(160deg, ${catColor} 0%, #B91C1C 100%)`,
                              }
                            : {
                                color: catColor,
                                background: "transparent",
                                border: `1.5px solid ${catColor}`,
                              }
                        }
                      >
                        {cat === "night" && <span aria-hidden>🌙</span>}
                        <span>{l.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

        </div>
      )}

      {step === "direction" && line && (
        <div className="grid grid-cols-1 gap-2">
          {directions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sin sentidos disponibles para esta línea.
            </p>
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
              <div className="mt-0.5 truncate">
                {d.origin} → {d.headsign}
              </div>
            </button>
          ))}
        </div>
      )}

      {step === "stop" && line && direction && (
        <div className="flex min-h-0 flex-1 flex-col space-y-3">
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
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-left text-[12px] font-semibold shadow-sm hover:bg-primary/15 active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate">
                {nearest
                  ? `Más cercana: ${nearest.name} (${nearest.code})`
                  : locState.status === "loading"
                    ? "Buscando ubicación…"
                    : "Activar ubicación para sugerir parada"}
              </span>
            </span>
            {nearest?.distM != null && (
              <span className="shrink-0 text-[11px] font-bold text-primary">{nearest.distM} m</span>
            )}
          </button>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-1.5 flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-2.5 py-1">
              <Search className="h-3 w-3 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar parada…"
                className="flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-1">
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
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-background/70 px-2 py-1.5 text-left text-[12px] shadow-sm hover:bg-accent/40 active:scale-[0.99]"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-semibold">{s.name}</span>
                    <span className="ml-1 text-[10px] text-muted-foreground">#{s.code}</span>
                  </span>
                  {s.distM != null && (
                    <span className="shrink-0 text-[10px] text-muted-foreground">{s.distM} m</span>
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
