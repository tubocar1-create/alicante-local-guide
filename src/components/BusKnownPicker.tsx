import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, MapPin, MoonStar, Search, TreePine, X } from "lucide-react";
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
  /** Cuando es true, se renderiza como página (no como modal flotante). */
  embedded?: boolean;
};

// Categorías de líneas en Alicante:
// - Nocturnas: código terminado en N (3N, 13N, 22N…)
// - Interurbanas (TAM): salen de la ciudad (27, 28, 39…)
// - Urbanas: el resto
export const EXTRAURBAN_CODES = new Set(["24", "27", "28", "39"]);

export function classifyLine(code: string): "night" | "extraurban" | "urban" {
  if (/N$/i.test(code)) return "night";
  if (EXTRAURBAN_CODES.has(code.toUpperCase())) return "extraurban";
  return "urban";
}

const CATEGORY_COLOR: Record<"night" | "extraurban" | "urban", string> = {
  urban: "#DC2626",       // rojo
  extraurban: "#1E3A8A",  // azul marino
  night: "#312E81",       // índigo profundo (nocturno)
};


export function BusKnownPicker({ onClose, onUnknown, onSelected, initialLineCode, embedded }: Props) {
  const { data, loading } = useBusGraph();
  const { state: locState, request: requestLocation } = useUserLocation();
  const [step, setStep] = useState<"line" | "direction" | "stop">(
    initialLineCode ? "direction" : "line",
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
      className={
        embedded
          ? "flex min-h-[calc(100dvh-3.5rem)] w-full flex-col bg-white p-3 text-foreground"
          : [
              "rounded-2xl border border-border bg-black p-2.5 shadow-soft",
              isExpanded
                ? "fixed bottom-[5.75rem] left-1/2 top-[4.75rem] z-50 flex w-[calc(100vw-1.5rem)] max-w-2xl -translate-x-1/2 flex-col"
                : "mt-2",
            ].join(" ")
      }
    >
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          {step !== "line" && (
            <button
              onClick={() => {
                if (step === "stop") setStep("direction");
                else if (step === "direction") setStep("line");
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#EF4444] hover:bg-muted"
              aria-label="Atrás"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h3 className={`font-sans text-base font-bold not-italic tracking-tight ${embedded ? "text-foreground" : "text-white"}`}>
            {step === "line" && "Elige tu línea"}
            {step === "direction" && `Línea ${line?.code} · ¿Hacia dónde?`}
            {step === "stop" && `Línea ${line?.code} · ¿Qué parada?`}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 hover:bg-muted"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>


      {step === "line" && (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
          {loading && <p className="text-sm text-muted-foreground">Cargando líneas…</p>}

          {(["urban", "extraurban", "night"] as const).map((cat) => {
            const lines = (data?.lines ?? [])
              .filter((l) => classifyLine(l.code) === cat)
              .slice()
              .sort((a, b) =>
                a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }),
              );
            if (lines.length === 0) return null;
            const label =
              cat === "urban" ? "Urbanas" : cat === "extraurban" ? "Interurbanas" : "Nocturnas";
            const sublabel =
              cat === "urban"
                ? "Dentro de la ciudad"
                : cat === "extraurban"
                  ? "Fuera de Alicante"
                  : "Servicio nocturno";
            const palette =
              cat === "urban"
                ? {
                    cardBg: "#FEF2F2",
                    cardBorder: "#FCA5A5",
                    iconBg: "#DC2626",
                    title: "#DC2626",
                    btnFrom: "#EF4444",
                    btnTo: "#B91C1C",
                    icon: "🏙️",
                  }
                : cat === "extraurban"
                  ? {
                      cardBg: "#EFF6FF",
                      cardBorder: "#93C5FD",
                      iconBg: "#2563EB",
                      title: "#2563EB",
                      btnFrom: "#3B82F6",
                      btnTo: "#1E40AF",
                      icon: "🛣️",
                    }
                  : {
                      cardBg: "#F5F3FF",
                      cardBorder: "#C4B5FD",
                      iconBg: "#7C3AED",
                      title: "#7C3AED",
                      btnFrom: "#8B5CF6",
                      btnTo: "#5B21B6",
                      icon: "🌙",
                    };
            return (
              <div
                key={cat}
                className="rounded-2xl border p-4"
                style={{ backgroundColor: palette.cardBg, borderColor: palette.cardBorder }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full text-2xl text-white shadow-sm"
                    style={{ backgroundColor: palette.iconBg }}
                    aria-hidden
                  >
                    {palette.icon}
                  </span>
                  <div className="min-w-0">
                    <div
                      className="font-sans text-xl font-extrabold leading-tight not-italic"
                      style={{ color: palette.title }}
                    >
                      {label}
                    </div>
                    <div className="font-sans text-sm not-italic text-slate-600">
                      {sublabel}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {lines.map((l) => (
                    <a
                      key={l.code}
                      href={`/bus/dashboard/${encodeURIComponent(l.code)}`}
                      title={l.name}
                      className="flex h-16 items-center justify-center gap-1 font-sans text-xl font-extrabold not-italic text-white no-underline shadow-md transition active:scale-95"
                      style={{
                        background: `linear-gradient(160deg, ${palette.btnFrom} 0%, ${palette.btnTo} 100%)`,
                        borderRadius: 16,
                      }}
                    >
                      {cat === "night" && <span aria-hidden className="text-base">🌙</span>}
                      <span>{l.code}</span>
                    </a>
                  ))}
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
