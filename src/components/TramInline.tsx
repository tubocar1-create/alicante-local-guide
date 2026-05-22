import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Search, MapPin, Train, Map as MapIcon, Star, History, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

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
  direction?: number | null;
  arrival_time?: string | null;
  departure_time?: string | null;
};

// Líneas oficiales como fallback visual (por si el endpoint tarda).
const FALLBACK_LINES: Array<{ short: string; long: string; color: string }> = [
  { short: "L1", long: "Luceros ↔ Benidorm", color: "#E2231A" },
  { short: "L2", long: "Luceros ↔ Sant Vicent", color: "#7BB662" },
  { short: "L3", long: "Luceros ↔ El Campello", color: "#0084C9" },
  { short: "L4", long: "Luceros ↔ Plaza La Coruña", color: "#F6A800" },
  { short: "L5", long: "Porta del Mar ↔ Plaza La Coruña", color: "#9B4DCA" },
  { short: "L9", long: "Benidorm ↔ Dénia", color: "#00897B" },
];

function ensureHash(c?: string | null) {
  if (!c) return null;
  return c.startsWith("#") ? c : `#${c}`;
}

function minutesUntil(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const tMin = h * 60 + m;
  const diff = tMin - nowMin;
  return diff < 0 ? null : diff;
}

const FAV_KEY = "tram:favorites";
const LAST_KEY = "tram:last";

export function TramInline({ embedded = false }: { embedded?: boolean } = {}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ stations: Station[]; lines: Line[] }>({ stations: [], lines: [] });
  const [searching, setSearching] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const linesSectionRef = useRef<HTMLDivElement | null>(null);
  const departuresSectionRef = useRef<HTMLDivElement | null>(null);

  const [lines, setLines] = useState<Line[]>([]);
  const [station, setStation] = useState<Station | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loadingDep, setLoadingDep] = useState(true);
  const [serviceWarn, setServiceWarn] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Station[]>([]);

  // Cargar favoritos y última parada
  useEffect(() => {
    try {
      const fav = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      if (Array.isArray(fav)) setFavorites(fav);
    } catch {/* noop */}
  }, []);

  const persistStation = (s: Station) => {
    try { localStorage.setItem(LAST_KEY, JSON.stringify(s)); } catch {/* noop */}
  };
  const toggleFavorite = (s: Station) => {
    setFavorites((prev) => {
      const exists = prev.some((p) => p.stop_id === s.stop_id);
      const next = exists ? prev.filter((p) => p.stop_id !== s.stop_id) : [...prev, s];
      try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {/* noop */}
      return next;
    });
  };
  const isFav = station ? favorites.some((f) => f.stop_id === station.stop_id) : false;

  const selectStation = (s: Station) => {
    setStation(s);
    persistStation(s);
    setShowFavorites(false);
    setTimeout(() => departuresSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const selectLine = async (lineId: string) => {
    setLoadingLine(lineId);
    try {
      const data = await fetch(`/api/public/tram/line-stops?line_id=${encodeURIComponent(lineId)}&direction=0`).then((r) => r.json());
      const first = data?.stops?.[0]?.stop;
      if (first) selectStation(first);
    } catch {/* noop */}
    setLoadingLine(null);
  };

  const openMap = () => {
    const url = station?.stop_lat && station?.stop_lon
      ? `https://www.google.com/maps/search/?api=1&query=${station.stop_lat},${station.stop_lon}`
      : `https://www.google.com/maps/search/?api=1&query=TRAM+Alicante`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // 1. Cargar líneas + estación inicial (última usada o Luceros) + salidas.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let last: Station | null = null;
        try { last = JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch {/* noop */}
        const [linesRes, stationsRes] = await Promise.all([
          fetch("/api/public/tram/lines").then((r) => r.json()),
          last ? Promise.resolve({ stations: [last] }) : fetch("/api/public/tram/stations?q=luceros").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setLines(linesRes?.lines ?? []);
        const initial: Station | undefined = (stationsRes?.stations ?? [])[0];
        if (initial) {
          setStation(initial);
        } else {
          setLoadingDep(false);
        }
      } catch {
        if (!cancelled) {
          setServiceWarn("No pudimos cargar el TRAM ahora mismo.");
          setLoadingDep(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2. Cargar salidas cuando cambia la estación.
  useEffect(() => {
    if (!station) return;
    let cancelled = false;
    setLoadingDep(true);
    fetch(`/api/public/tram/departures?stop_id=${encodeURIComponent(station.stop_id)}&limit=8`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setDepartures(data?.departures ?? []);
        setLoadingDep(false);
      })
      .catch(() => {
        if (cancelled) return;
        setServiceWarn("No pudimos cargar las próximas salidas.");
        setLoadingDep(false);
      });
    return () => { cancelled = true; };
  }, [station?.stop_id]);

  // 3. Buscar al teclear (estaciones + líneas locales).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults({ stations: [], lines: [] });
      return;
    }
    searchAbort.current?.abort();
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/public/tram/stations?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => r.json())
        .then((data) => {
          const matchedLines = lines.filter((l) =>
            (l.short_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
            (l.long_name ?? "").toLowerCase().includes(q.toLowerCase())
          );
          setSearchResults({ stations: (data?.stations ?? []).slice(0, 8), lines: matchedLines.slice(0, 4) });
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [query, lines]);

  const displayLines = useMemo(() => {
    if (lines.length === 0) {
      return FALLBACK_LINES.map((l) => ({
        id: l.short, short_name: l.short, long_name: l.long, color: l.color, text_color: "#FFFFFF",
      })) as Line[];
    }
    return lines;
  }, [lines]);

  const lastStation: Station | null = (() => {
    try { return JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch { return null; }
  })();

  const quickAccess: Array<{ icon: typeof MapPin; label: string; onClick: () => void; active?: boolean }> = [
    { icon: Train, label: "Líneas", onClick: () => linesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) },
    { icon: MapPin, label: "Estaciones", onClick: () => { searchInputRef.current?.focus(); searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } },
    { icon: MapIcon, label: "Mapa", onClick: openMap },
    { icon: Star, label: showFavorites ? "Cerrar favoritos" : "Favoritos", onClick: () => setShowFavorites((v) => !v), active: showFavorites },
    { icon: History, label: "Último TRAM", onClick: () => { if (lastStation) selectStation(lastStation); } },
  ];

  return (
    <div
      className={`flex animate-fade-in flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-sm backdrop-blur ${
        embedded ? "" : "mt-2 max-h-[70vh]"
      }`}
    >
      {/* Header */}
      <div className="flex flex-none items-center gap-2 border-b border-border/60 bg-gradient-to-r from-primary/10 via-accent/10 to-transparent px-3 py-2.5">
        <span className="text-base" aria-hidden>🚋</span>
        <h3 className="text-sm font-semibold tracking-tight">TRAM Alicante</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">FGV</span>
      </div>

      <div className={`space-y-3 p-3 ${embedded ? "" : "flex-1 overflow-y-auto overscroll-contain"}`}>
        {/* Buscador */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="¿A dónde quieres ir?"
            className="w-full rounded-full border border-border bg-background/80 py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          {(searchResults.stations.length > 0 || searchResults.lines.length > 0) && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-lg animate-scale-in">
              {searchResults.lines.length > 0 && (
                <div className="mb-1">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Líneas</p>
                  {searchResults.lines.map((l) => (
                    <div key={l.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                        style={{ background: ensureHash(l.color) ?? "var(--primary)", color: ensureHash(l.text_color) ?? "#fff" }}
                      >
                        {l.short_name}
                      </span>
                      <span className="text-xs">{l.long_name}</span>
                    </div>
                  ))}
                </div>
              )}
              {searchResults.stations.length > 0 && (
                <div>
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">Estaciones</p>
                  {searchResults.stations.map((s) => (
                    <button
                      key={s.stop_id}
                      onClick={() => { selectStation(s); setQuery(""); setSearchResults({ stations: [], lines: [] }); }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent/40"
                    >
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      <span className="truncate">{s.stop_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Próximas salidas */}
        <div ref={departuresSectionRef} className="rounded-2xl border border-border bg-background/60 p-3 shadow-inner">
          <div className="mb-2 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold">{station?.stop_name ?? "Cargando…"}</span>
            {station && (
              <button
                type="button"
                onClick={() => toggleFavorite(station)}
                aria-label={isFav ? "Quitar de favoritos" : "Añadir a favoritos"}
                className="ml-1 rounded-full p-1 transition hover:bg-accent/40 active:scale-90"
              >
                <Star className={`h-3.5 w-3.5 ${isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
              </button>
            )}
            <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">Próximas salidas</span>
          </div>
          {loadingDep ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : departures.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No hay salidas programadas próximamente desde esta parada.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {departures.map((d, i) => {
                const mins = minutesUntil(d.departure_time);
                const color = ensureHash(d.line_color) ?? "var(--primary)";
                return (
                  <li key={`${d.trip_id}-${i}`} className="flex items-center gap-2.5 py-2">
                    <span
                      className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-1.5 text-[11px] font-bold text-white shadow-sm"
                      style={{ background: color }}
                    >
                      {d.line_short_name ?? "TRAM"}
                    </span>
                    <span className="flex-1 truncate text-sm">{d.headsign ?? d.line_long_name ?? "—"}</span>
                    <span className="text-right">
                      {mins !== null ? (
                        <>
                          <span className="text-lg font-bold leading-none text-primary">{mins}</span>
                          <span className="ml-1 text-[10px] uppercase text-muted-foreground">min</span>
                        </>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {d.departure_time?.slice(0, 5) ?? "—"}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Accesos rápidos */}
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          <Link to="/tram/estaciones" className="flex flex-none items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent/40 active:scale-95">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Estaciones
          </Link>
          <Link to="/tram/favoritos" className="flex flex-none items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent/40 active:scale-95">
            <Star className="h-3.5 w-3.5 text-primary" /> Favoritos
          </Link>
          {lastStation && (
            <Link to="/tram/parada/$stopId" params={{ stopId: lastStation.stop_id }} className="flex flex-none items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent/40 active:scale-95">
              <History className="h-3.5 w-3.5 text-primary" /> Último TRAM
            </Link>
          )}
          <button type="button" onClick={openMap} className="flex flex-none items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent/40 active:scale-95">
            <MapIcon className="h-3.5 w-3.5 text-primary" /> Mapa
          </button>
          <button type="button" onClick={() => linesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="flex flex-none items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:bg-accent/40 active:scale-95">
            <Train className="h-3.5 w-3.5 text-primary" /> Líneas
          </button>
        </div>

        {/* Líneas TRAM */}
        <div ref={linesSectionRef}>
          <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Líneas TRAM
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {displayLines.map((l) => {
              const bg = ensureHash(l.color) ?? "var(--primary)";
              const fg = ensureHash(l.text_color) ?? "#FFFFFF";
              return (
                <Link
                  key={l.id}
                  to="/tram/linea/$lineId"
                  params={{ lineId: l.id }}
                  className="group flex items-center gap-2 rounded-xl border border-border bg-background/80 p-2 text-left shadow-sm transition hover:border-primary/40 hover:bg-accent/30 active:scale-[0.98]"
                >
                  <span
                    className="inline-flex h-8 min-w-[2.25rem] items-center justify-center rounded-md px-1.5 text-[11px] font-black shadow-sm"
                    style={{ background: bg, color: fg }}
                  >
                    {l.short_name}
                  </span>
                  <span className="flex-1 text-[11px] leading-tight">{l.long_name}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Estado del servicio */}
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            serviceWarn
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {serviceWarn ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              <span>{serviceWarn}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>Servicio normal</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
