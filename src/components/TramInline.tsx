import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search, MapPin, Navigation, Star, Clock, ArrowRight,
  ChevronDown, ChevronUp, Map as MapIcon, X, Locate,
} from "lucide-react";
import { distanceKm, formatDistance, useUserLocation, type Coords } from "@/hooks/useUserLocation";

type Line = {
  id: string;
  short_name: string | null;
  long_name: string | null;
  color: string | null;
  text_color: string | null;
};
type Station = {
  stop_id: string;
  stop_name: string;
  stop_lat?: number;
  stop_lon?: number;
};
type Departure = {
  trip_id: string;
  route_id: string;
  line_short_name?: string | null;
  line_long_name?: string | null;
  line_color?: string | null;
  headsign?: string | null;
  departure_time?: string | null;
};
type PlanOption = {
  trip_id: string;
  route_id: string;
  line_short_name: string | null;
  line_long_name: string | null;
  line_color: string | null;
  line_text_color: string | null;
  headsign: string | null;
  depart_time: string;
  arrive_time: string;
  duration_min: number;
  stops_between: number;
};

const FAV_KEY = "tram:favorites";
const ORIGIN_KEY = "tram:origin";

const ensureHash = (c?: string | null) => (c ? (c.startsWith("#") ? c : `#${c}`) : null);

function minutesUntil(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const diff = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
  return diff < 0 ? null : diff;
}

const POPULAR = [
  { emoji: "🌊", label: "Playa San Juan", q: "playa san juan" },
  { emoji: "🎡", label: "Benidorm", q: "benidorm" },
  { emoji: "🎓", label: "Universidad", q: "universidad" },
  { emoji: "🏖️", label: "El Campello", q: "campello" },
  { emoji: "🏰", label: "Centro", q: "luceros" },
  { emoji: "🏛️", label: "MARQ", q: "marq" },
];

function nearestStation(coords: Coords, stations: Station[]): Station | null {
  let best: Station | null = null;
  let bestD = Infinity;
  for (const s of stations) {
    if (s.stop_lat == null || s.stop_lon == null) continue;
    const d = distanceKm(coords, { lat: s.stop_lat, lng: s.stop_lon });
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function TramInline({ embedded = false }: { embedded?: boolean } = {}) {
  const { state: geo, request: requestGeo } = useUserLocation();
  const [origin, setOrigin] = useState<Station | null>(null);
  const [destination, setDestination] = useState<Station | null>(null);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [favorites, setFavorites] = useState<Station[]>([]);

  // Búsqueda destino
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Station[]>([]);
  const searchAbort = useRef<AbortController | null>(null);

  // Próximas salidas desde el origen (cuando no hay destino)
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loadingDep, setLoadingDep] = useState(false);

  // Plan de viaje (cuando hay destino)
  const [planOptions, setPlanOptions] = useState<PlanOption[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const [showLines, setShowLines] = useState(false);

  // Cargar todo lo estático: estaciones + líneas + favoritos + origen guardado
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [st, ln] = await Promise.all([
          fetch("/api/public/tram/stations").then((r) => r.json()),
          fetch("/api/public/tram/lines").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setAllStations(st?.stations ?? []);
        setLines(ln?.lines ?? []);
      } catch { /* noop */ }
    })();
    try {
      const f = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      if (Array.isArray(f)) setFavorites(f);
    } catch { /* noop */ }
    try {
      const o = JSON.parse(localStorage.getItem(ORIGIN_KEY) || "null");
      if (o?.stop_id) setOrigin(o);
    } catch { /* noop */ }
    return () => { cancelled = true; };
  }, []);

  // Cuando llega la geolocalización, fijar parada más cercana como origen
  // (solo si el usuario aún no ha elegido un origen distinto).
  useEffect(() => {
    if (geo.status !== "ready" || allStations.length === 0) return;
    const near = nearestStation(geo.coords, allStations);
    if (near && !origin) {
      setOrigin(near);
      try { localStorage.setItem(ORIGIN_KEY, JSON.stringify(near)); } catch { /* noop */ }
    }
  }, [geo, allStations, origin]);

  // Si no hay geo ni origen, usar Luceros por defecto.
  useEffect(() => {
    if (origin || allStations.length === 0) return;
    const luceros = allStations.find((s) => /luceros/i.test(s.stop_name));
    if (luceros) setOrigin(luceros);
  }, [allStations, origin]);

  // Próximas salidas del origen (cuando no hay destino seleccionado).
  useEffect(() => {
    if (!origin || destination) { setDepartures([]); return; }
    let cancelled = false;
    setLoadingDep(true);
    fetch(`/api/public/tram/departures?stop_id=${encodeURIComponent(origin.stop_id)}&limit=5`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setDepartures(d?.departures ?? []); setLoadingDep(false); } })
      .catch(() => { if (!cancelled) setLoadingDep(false); });
    return () => { cancelled = true; };
  }, [origin?.stop_id, destination?.stop_id]);

  // Plan de viaje cuando hay destino.
  useEffect(() => {
    if (!origin || !destination) { setPlanOptions(null); return; }
    let cancelled = false;
    setLoadingPlan(true);
    fetch(`/api/public/tram/plan?origin=${encodeURIComponent(origin.stop_id)}&destination=${encodeURIComponent(destination.stop_id)}&limit=4`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setPlanOptions(d?.options ?? []); setLoadingPlan(false); } })
      .catch(() => { if (!cancelled) { setPlanOptions([]); setLoadingPlan(false); } });
    return () => { cancelled = true; };
  }, [origin?.stop_id, destination?.stop_id]);

  // Búsqueda al teclear
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); return; }
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    const t = setTimeout(() => {
      fetch(`/api/public/tram/stations?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((d) => setResults((d?.stations ?? []).slice(0, 8)))
        .catch(() => {});
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query]);

  const pickDestinationByQuery = async (q: string) => {
    try {
      const r = await fetch(`/api/public/tram/stations?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      const first = (d?.stations ?? [])[0];
      if (first) setDestination(first);
    } catch { /* noop */ }
  };

  const swapOrigin = (s: Station) => {
    setOrigin(s);
    try { localStorage.setItem(ORIGIN_KEY, JSON.stringify(s)); } catch { /* noop */ }
  };

  const isFavOrigin = origin ? favorites.some((f) => f.stop_id === origin.stop_id) : false;
  const toggleFavOrigin = () => {
    if (!origin) return;
    setFavorites((prev) => {
      const exists = prev.some((p) => p.stop_id === origin.stop_id);
      const next = exists ? prev.filter((p) => p.stop_id !== origin.stop_id) : [...prev, origin];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };

  const openMap = () => {
    const url = origin?.stop_lat && origin?.stop_lon
      ? `https://www.google.com/maps/search/?api=1&query=${origin.stop_lat},${origin.stop_lon}`
      : `https://www.google.com/maps/search/?api=1&query=TRAM+Alicante`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const nextDep = departures[0];
  const nextDepMin = nextDep ? minutesUntil(nextDep.departure_time) : null;

  const displayLines = useMemo(() => lines, [lines]);

  return (
    <div className={`flex animate-fade-in flex-col rounded-3xl border border-border bg-card/95 shadow-sm backdrop-blur ${embedded ? "" : "mt-2 max-h-[78vh] overflow-hidden"}`}>
      {/* Header */}
      <div className="flex flex-none items-center gap-2 border-b border-border/60 bg-gradient-to-r from-primary/15 via-accent/10 to-transparent px-4 py-3">
        <span className="text-lg" aria-hidden>🚋</span>
        <h3 className="text-sm font-semibold tracking-tight">TRAM Alicante</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">FGV</span>
      </div>

      <div className={`space-y-4 p-4 ${embedded ? "pb-24" : "flex-1 overflow-y-auto overscroll-contain"}`}>

        {/* ¿A dónde quieres ir? */}
        <div>
          <label className="mb-2 block px-1 text-base font-semibold tracking-tight">
            ¿A dónde quieres ir?
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca playa, estación, universidad, Benidorm…"
              className="w-full rounded-2xl border border-border bg-background py-3.5 pl-11 pr-10 text-sm shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(""); setResults([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent/40"
                aria-label="Limpiar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            {results.length > 0 && (
              <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-xl animate-scale-in">
                {results.map((s) => (
                  <button
                    key={s.stop_id}
                    onClick={() => { setDestination(s); setQuery(""); setResults([]); }}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-accent/40"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="truncate">{s.stop_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chips destino */}
          <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1">
            {POPULAR.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => pickDestinationByQuery(p.q)}
                className="flex flex-none items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:border-primary/40 hover:bg-accent/30 active:scale-95"
              >
                <span aria-hidden>{p.emoji}</span> {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Resultado del viaje */}
        {destination ? (
          <TripPlanCard
            origin={origin}
            destination={destination}
            options={planOptions}
            loading={loadingPlan}
            onClear={() => setDestination(null)}
            onSwapToDestination={() => {
              if (!destination) return;
              swapOrigin(destination);
              setDestination(null);
            }}
          />
        ) : (
          /* Estado origen + próxima salida */
          <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-4 shadow-inner">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-primary/15 p-2">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tu estación más cercana</p>
                <p className="truncate text-base font-semibold">{origin?.stop_name ?? "Detectando…"}</p>
                {geo.status !== "ready" && (
                  <button
                    type="button"
                    onClick={requestGeo}
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Locate className="h-3 w-3" /> Usar mi ubicación
                  </button>
                )}
              </div>
              {origin && (
                <button
                  type="button"
                  onClick={toggleFavOrigin}
                  aria-label={isFavOrigin ? "Quitar favorito" : "Añadir favorito"}
                  className="rounded-full p-1.5 transition hover:bg-accent/40 active:scale-90"
                >
                  <Star className={`h-4 w-4 ${isFavOrigin ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </button>
              )}
            </div>

            <div className="mt-3 rounded-xl border border-border/60 bg-background/70 p-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Próxima salida</p>
              {loadingDep ? (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-7 w-12 animate-pulse rounded-md bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                </div>
              ) : nextDep ? (
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-md px-1.5 text-xs font-bold text-white shadow-sm"
                    style={{ background: ensureHash(nextDep.line_color) ?? "var(--primary)" }}
                  >
                    {nextDep.line_short_name ?? "TRAM"}
                  </span>
                  <span className="flex-1 truncate text-sm">{nextDep.headsign ?? nextDep.line_long_name}</span>
                  <span className="text-right">
                    {nextDepMin !== null ? (
                      <>
                        <span className="text-xl font-bold leading-none text-primary">{nextDepMin}</span>
                        <span className="ml-0.5 text-[10px] uppercase text-muted-foreground">min</span>
                      </>
                    ) : (
                      <span className="text-xs tabular-nums text-muted-foreground">{nextDep.departure_time?.slice(0, 5)}</span>
                    )}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Sin salidas próximas 🌙</p>
              )}

              {departures.length > 1 && (
                <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                  {departures.slice(1, 4).map((d, i) => {
                    const m = minutesUntil(d.departure_time);
                    return (
                      <li key={`${d.trip_id}-${i}`} className="flex items-center gap-2 text-xs">
                        <span
                          className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded px-1 text-[10px] font-bold text-white"
                          style={{ background: ensureHash(d.line_color) ?? "var(--primary)" }}
                        >
                          {d.line_short_name ?? "—"}
                        </span>
                        <span className="flex-1 truncate text-muted-foreground">{d.headsign}</span>
                        <span className="tabular-nums text-muted-foreground">{m !== null ? `${m} min` : d.departure_time?.slice(0, 5)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={openMap}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
              >
                <MapIcon className="h-3 w-3 text-primary" /> Mapa
              </button>
              <Link
                to="/tram/favoritos"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
              >
                <Star className="h-3 w-3 text-primary" /> Favoritos
              </Link>
              <Link
                to="/tram/estaciones"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
              >
                <Navigation className="h-3 w-3 text-primary" /> Cambiar origen
              </Link>
            </div>
          </div>
        )}

        {/* Favoritos rápidos */}
        {favorites.length > 0 && !destination && (
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tus favoritos
            </p>
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {favorites.map((f) => (
                <button
                  key={f.stop_id}
                  type="button"
                  onClick={() => swapOrigin(f)}
                  className="flex flex-none items-center gap-1.5 rounded-2xl border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:border-primary/40 hover:bg-accent/30 active:scale-95"
                >
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="max-w-[8rem] truncate">{f.stop_name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Explorar líneas (colapsable, secundario) */}
        <div className="rounded-2xl border border-border/60 bg-background/40">
          <button
            type="button"
            onClick={() => setShowLines((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Explorar líneas
            </span>
            {showLines ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
          {showLines && (
            <div className="grid grid-cols-2 gap-1.5 p-2 pt-0">
              {displayLines.map((l) => {
                const bg = ensureHash(l.color) ?? "var(--primary)";
                const fg = ensureHash(l.text_color) ?? "#FFFFFF";
                return (
                  <Link
                    key={l.id}
                    to="/tram/linea/$lineId"
                    params={{ lineId: l.id }}
                    className="flex items-center gap-2 rounded-xl border border-border bg-background/80 p-2 text-xs shadow-sm transition hover:border-primary/40 hover:bg-accent/20 active:scale-95"
                  >
                    <span
                      className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md px-1.5 text-[11px] font-bold"
                      style={{ background: bg, color: fg }}
                    >
                      {l.short_name}
                    </span>
                    <span className="truncate text-[11px] text-muted-foreground">{l.long_name}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Tarjeta de viaje ----------

function TripPlanCard({
  origin, destination, options, loading, onClear, onSwapToDestination,
}: {
  origin: Station | null;
  destination: Station;
  options: PlanOption[] | null;
  loading: boolean;
  onClear: () => void;
  onSwapToDestination: () => void;
}) {
  const best = options?.[0];
  const more = (options ?? []).slice(1);
  const mins = best ? minutesUntil(best.depart_time) : null;
  const color = best ? ensureHash(best.line_color) ?? "var(--primary)" : "var(--primary)";

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 shadow-md animate-scale-in">
      {/* Cabecera ruta */}
      <div className="flex items-center gap-2 border-b border-border/40 bg-background/60 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Desde</p>
          <p className="truncate text-xs font-semibold">{origin?.stop_name ?? "—"}</p>
        </div>
        <ArrowRight className="h-4 w-4 flex-none text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hasta</p>
          <p className="truncate text-xs font-semibold">{destination.stop_name}</p>
        </div>
        <button
          type="button"
          onClick={onClear}
          aria-label="Cerrar"
          className="ml-1 rounded-full p-1.5 text-muted-foreground hover:bg-accent/40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Mejor opción */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ) : !best ? (
          <div className="py-2 text-center">
            <p className="text-sm font-medium">No hay TRAM directo ahora mismo.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Puede que necesites combinar con otra línea o esperar al próximo servicio.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-10 min-w-[3rem] items-center justify-center rounded-xl px-2 text-base font-extrabold text-white shadow-lg"
                style={{ background: color }}
              >
                {best.line_short_name ?? "TRAM"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Toma</p>
                <p className="truncate text-sm font-semibold">Dirección {best.headsign ?? best.line_long_name}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sale en</p>
                {mins !== null ? (
                  <p>
                    <span className="text-2xl font-extrabold leading-none text-primary">{mins}</span>
                    <span className="ml-1 text-[10px] uppercase text-muted-foreground">min</span>
                  </p>
                ) : (
                  <p className="text-sm font-semibold tabular-nums">{best.depart_time}</p>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-background/70 p-2.5 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Salida</p>
                <p className="text-sm font-semibold tabular-nums">{best.depart_time}</p>
              </div>
              <div className="border-x border-border/60">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Duración</p>
                <p className="text-sm font-semibold">{best.duration_min} min</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Llegada</p>
                <p className="text-sm font-semibold tabular-nums">{best.arrive_time}</p>
              </div>
            </div>

            <div className="mt-3 flex items-start gap-2 rounded-xl bg-accent/20 p-2.5">
              <MapPin className="mt-0.5 h-4 w-4 flex-none text-primary" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bájate en</p>
                <p className="truncate text-sm font-semibold">{destination.stop_name}</p>
                <p className="text-[11px] text-muted-foreground">{best.stops_between} {best.stops_between === 1 ? "parada" : "paradas"} desde el origen</p>
              </div>
            </div>

            {/* Conexiones genéricas (sugeridas) */}
            <div className="mt-3">
              <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Conexiones en destino</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px]">🚍 Bus urbano</span>
                <span className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px]">🚕 Taxi</span>
                {destination.stop_lat && destination.stop_lon && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${destination.stop_lat},${destination.stop_lon}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
                  >
                    <MapIcon className="h-3 w-3 text-primary" /> Ver en mapa
                  </a>
                )}
              </div>
            </div>

            {/* Otras opciones */}
            {more.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Más salidas</p>
                <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-background/60">
                  {more.map((o) => {
                    const m = minutesUntil(o.depart_time);
                    return (
                      <li key={o.trip_id} className="flex items-center gap-2 px-2.5 py-2 text-xs">
                        <span
                          className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md px-1 text-[10px] font-bold text-white"
                          style={{ background: ensureHash(o.line_color) ?? "var(--primary)" }}
                        >
                          {o.line_short_name ?? "TRAM"}
                        </span>
                        <span className="flex-1 truncate">Sale {o.depart_time} · {o.duration_min} min</span>
                        {m !== null && (
                          <span className="font-semibold text-primary">{m} min</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={onSwapToDestination}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
              >
                <Clock className="h-3 w-3 text-primary" /> Estoy ya allí
              </button>
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
              >
                Buscar otro destino
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
