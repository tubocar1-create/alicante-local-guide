import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Search, MapPin, Navigation, Star, ArrowRight,
  ChevronDown, ChevronUp, Map as MapIcon, X, Locate, Check,
} from "lucide-react";
import { distanceKm, useUserLocation, isGeoEnabled, setGeoEnabled, type Coords } from "@/hooks/useUserLocation";

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
type PlanLeg2 = {
  line_short_name: string | null;
  line_color: string | null;
  line_text_color: string | null;
  headsign: string | null;
  depart_time: string;
  arrive_time: string;
  duration_min: number;
  stops_between: number;
};
type PlanTransfer = {
  at_stop_id: string;
  at_stop_name: string;
  wait_min: number;
  leg1_arrive_time: string;
  leg2_depart_time: string;
  leg2: PlanLeg2;
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
  transfer?: PlanTransfer | null;
};
type ValidGroup = {
  route_id: string;
  line_short_name: string | null;
  line_long_name: string | null;
  line_color: string | null;
  line_text_color: string | null;
  direction_id: number;
  headsign: string | null;
  via_transfer?: boolean;
  transfer_at?: string;
  stops: Station[];
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

// Atajos a destinos clave: stop_id fijo para evitar ambigüedades
// (p.ej. "Benidorm" = ciudad, no "Av. Benidorm" en Playa San Juan).
const POPULAR: Array<{ emoji: string; label: string; stop_id: string; stop_name: string }> = [
  { emoji: "🏙", label: "San Vicente del Raspeig", stop_id: "124", stop_name: "Sant Vicent del Raspeig" },
  { emoji: "🎓", label: "Universidad", stop_id: "123", stop_name: "Universitat" },
  { emoji: "🏥", label: "Hospital", stop_id: "117", stop_name: "Hospital" },
  { emoji: "🏰", label: "Plaza Luceros", stop_id: "2", stop_name: "Alicante - Luceros" },
  { emoji: "🛍", label: "Mercado", stop_id: "3", stop_name: "Mercado" },
  { emoji: "🏛", label: "MARQ", stop_id: "4", stop_name: "MARQ - CASTILLO" },
  { emoji: "🏖", label: "Albufereta", stop_id: "7", stop_name: "Albufereta" },
  { emoji: "🌊", label: "Playa San Juan", stop_id: "108", stop_name: "Av. Benidorm / Platja de San Joan" },
  { emoji: "🌊", label: "Muchavista", stop_id: "12", stop_name: "Muchavista" },
  { emoji: "🍹", label: "El Campello", stop_id: "17", stop_name: "El Campello" },
  { emoji: "🏖", label: "Villajoyosa", stop_id: "27", stop_name: "La Vila Joiosa" },
  { emoji: "🎡", label: "Benidorm", stop_id: "33", stop_name: "Benidorm" },
  { emoji: "⚓", label: "Puerta del Mar", stop_id: "101", stop_name: "Porta del Mar" },
];

function nearestFromList(coords: Coords, stations: Station[]): Station | null {
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
  const [lines, setLines] = useState<Line[]>([]);
  const [favorites, setFavorites] = useState<Station[]>([]);

  // Búsqueda destino
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Station[]>([]);
  const searchAbort = useRef<AbortController | null>(null);

  // Flujo
  const [destination, setDestination] = useState<Station | null>(null);
  const [origin, setOrigin] = useState<Station | null>(null);
  const [originConfirmed, setOriginConfirmed] = useState(false);

  // Estaciones válidas para el destino actual
  const [validGroups, setValidGroups] = useState<ValidGroup[] | null>(null);
  const [loadingValid, setLoadingValid] = useState(false);

  // Plan
  const [planOptions, setPlanOptions] = useState<PlanOption[] | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(false);

  const [showLines, setShowLines] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  // Origen pendiente proveniente de URL (?tram_origin=...) que se aplicará
  // cuando ya tengamos destino + validStops cargados.
  const [pendingOriginId, setPendingOriginId] = useState<string | null>(null);

  // Suscripción a search params (el agente navega a /?tram_dest=...&tram_origin=...)
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });

  // Carga inicial: líneas + favoritos + origen guardado (solo como pista)
  useEffect(() => {
    fetch("/api/public/tram/lines").then((r) => r.json())
      .then((d) => setLines(d?.lines ?? []))
      .catch(() => {});
    try {
      const f = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      if (Array.isArray(f)) setFavorites(f);
    } catch { /* noop */ }
  }, []);

  // Aplicar destino/origen desde URL (?tram_dest=&tram_origin=)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const destId = sp.get("tram_dest");
    const originId = sp.get("tram_origin");
    if (!destId) return;
    if (destination?.stop_id === destId && (!originId || origin?.stop_id === originId)) return;
    let cancelled = false;
    fetch(`/api/public/tram/stations?stop_id=${encodeURIComponent(destId)}`)
      .then((r) => r.json())
      .then((d) => {
        const st = (d?.stations ?? [])[0];
        if (!cancelled && st) {
          setDestination(st);
          setPendingOriginId(originId || null);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchStr]);

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

  // Al elegir destino → cargar orígenes válidos y resetear estado origen
  useEffect(() => {
    if (!destination) { setValidGroups(null); return; }
    setOriginConfirmed(false);
    setOrigin(null);
    setShowPicker(false);
    let cancelled = false;
    setLoadingValid(true);
    fetch(`/api/public/tram/valid-origins?destination=${encodeURIComponent(destination.stop_id)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setValidGroups(d?.groups ?? []); setLoadingValid(false); } })
      .catch(() => { if (!cancelled) { setValidGroups([]); setLoadingValid(false); } });
    return () => { cancelled = true; };
  }, [destination?.stop_id]);

  // Conjunto de estaciones válidas (únicas) para auto-sugerir origen
  const validStops = useMemo(() => {
    if (!validGroups) return [] as Station[];
    const map = new Map<string, Station>();
    for (const g of validGroups) for (const s of g.stops) if (!map.has(s.stop_id)) map.set(s.stop_id, s);
    return Array.from(map.values());
  }, [validGroups]);

  // Si la URL trae tram_origin, aplicarlo cuando estén los validStops listos.
  useEffect(() => {
    if (!pendingOriginId || !destination || !validStops.length) return;
    const match = validStops.find((s) => s.stop_id === pendingOriginId);
    if (match) {
      setOrigin(match);
      setOriginConfirmed(true);
    }
    setPendingOriginId(null);
  }, [pendingOriginId, destination, validStops]);


  // Sugerir origen automáticamente cuando hay validGroups
  useEffect(() => {
    if (!destination || origin || !validGroups) return;
    // 1) Geolocalización (solo si está disponible)
    if (geo.status === "ready") {
      const near = nearestFromList(geo.coords, validStops);
      if (near) { setOrigin(near); return; }
    }
    // Si la geo falla / fue denegada / no existe → SIEMPRE Luceros como por defecto.
    const luceros = validStops.find((s) => /luceros/i.test(s.stop_name));
    if (geo.status === "error" || geo.status === "idle") {
      if (luceros) { setOrigin(luceros); return; }
    }
    // Mientras la geo aún se resuelve: preferir Luceros antes que historial/primera.
    if (geo.status !== "ready") {
      if (luceros) { setOrigin(luceros); return; }
    }
    // 2) Origen guardado si está en la lista válida
    try {
      const saved = JSON.parse(localStorage.getItem(ORIGIN_KEY) || "null") as Station | null;
      if (saved?.stop_id && validStops.some((s) => s.stop_id === saved.stop_id)) {
        setOrigin(saved); return;
      }
    } catch { /* noop */ }
    // 3) Luceros si está
    if (luceros) { setOrigin(luceros); return; }
    // 4) Primera válida
    if (validStops[0]) setOrigin(validStops[0]);
  }, [destination, origin, validGroups, validStops, geo]);

  // Plan cuando origen confirmado (auto-refresca cada 15 min)
  useEffect(() => {
    if (!origin || !destination || !originConfirmed) { setPlanOptions(null); return; }
    let cancelled = false;
    const load = (showSpinner: boolean) => {
      if (showSpinner) setLoadingPlan(true);
      // Pasamos hora y fecha LOCALES del cliente (el servidor corre en UTC y
      // devolvería salidas pasadas si dejamos que las calcule él).
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const from = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
      const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const url = `/api/public/tram/plan?origin=${encodeURIComponent(origin.stop_id)}&destination=${encodeURIComponent(destination.stop_id)}&from=${from}&date=${date}&limit=15`;
      fetch(url)
        .then((r) => r.json())
        .then((d) => { if (!cancelled) { setPlanOptions(d?.options ?? []); setLoadingPlan(false); } })
        .catch(() => { if (!cancelled) { setPlanOptions([]); setLoadingPlan(false); } });
    };
    load(true);
    const id = setInterval(() => load(false), 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [origin?.stop_id, destination?.stop_id, originConfirmed]);


  const pickDestinationByQuery = async (q: string) => {
    try {
      const r = await fetch(`/api/public/tram/stations?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      const first = (d?.stations ?? [])[0];
      if (first) setDestination(first);
    } catch { /* noop */ }
  };

  const confirmOrigin = (s: Station) => {
    setOrigin(s);
    setOriginConfirmed(true);
    setShowPicker(false);
    try { localStorage.setItem(ORIGIN_KEY, JSON.stringify(s)); } catch { /* noop */ }
  };

  const resetFlow = () => {
    setDestination(null);
    setOrigin(null);
    setOriginConfirmed(false);
    setValidGroups(null);
    setPlanOptions(null);
    setShowPicker(false);
  };

  const useGeolocationOrigin = () => {
    if (geo.status === "ready") {
      const near = nearestFromList(geo.coords, validStops);
      if (near) { confirmOrigin(near); return; }
    }
    // Si el usuario tenía la geolocalización desactivada en su perfil,
    // reactívala antes de pedir permiso al navegador.
    if (!isGeoEnabled()) setGeoEnabled(true);
    requestGeo();
  };

  // Cuando llega la geo después de pedirla, si aún no hay confirmación → usar
  useEffect(() => {
    if (geo.status !== "ready" || originConfirmed || !destination || !validStops.length) return;
    const near = nearestFromList(geo.coords, validStops);
    if (near && (!origin || origin.stop_id !== near.stop_id)) {
      setOrigin(near);
    }
  }, [geo, originConfirmed, destination, validStops, origin]);

  return (
    <div className={`flex animate-fade-in flex-col rounded-3xl border border-border bg-card/95 shadow-sm backdrop-blur ${embedded ? "" : "mt-2 max-h-[78vh] overflow-hidden"}`}>
      {/* Header */}
      <div className="flex flex-none items-center gap-2 border-b border-border/60 bg-gradient-to-r from-primary/15 via-accent/10 to-transparent px-4 py-3">
        <span className="text-lg" aria-hidden>🚋</span>
        <h3 className="text-sm font-semibold tracking-tight">TRAM Alicante</h3>
        <Link
          to="/tram/mapa"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2.5 py-1 text-[10px] font-semibold shadow-sm transition hover:border-primary/40 hover:bg-accent/30 active:scale-95"
        >
          <MapIcon className="h-3 w-3 text-primary" /> Mapa de líneas
        </Link>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">FGV</span>
      </div>

      <div className={`space-y-4 p-4 ${embedded ? "pb-24" : "flex-1 overflow-y-auto overscroll-contain"}`}>
        {/* PASO 1 — Destino */}
        {!destination && (
          <>
            <div>
              <label className="mb-2 block px-1 text-lg font-bold tracking-tight">
                🚋 ¿A dónde quieres ir?
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Playa, universidad, Benidorm…"
                  className="w-full rounded-2xl border border-border bg-background py-4 pl-11 pr-10 text-base shadow-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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

              {/* Chips destino populares: visibles sin scroll */}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {POPULAR.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDestination({ stop_id: p.stop_id, stop_name: p.stop_name })}
                    className="flex min-w-0 items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1.5 text-[11px] font-medium shadow-sm transition hover:border-primary/40 hover:bg-accent/30 active:scale-95"
                  >
                    <span aria-hidden className="text-sm leading-none">{p.emoji}</span>
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Favoritos como atajo destino */}
            {favorites.length > 0 && (
              <div>
                <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Tus paradas guardadas
                </p>
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {favorites.map((f) => (
                    <button
                      key={f.stop_id}
                      type="button"
                      onClick={() => setDestination(f)}
                      className="flex flex-none items-center gap-1.5 rounded-2xl border border-border bg-background/80 px-3 py-1.5 text-xs font-medium shadow-sm transition hover:border-primary/40 hover:bg-accent/30 active:scale-95"
                    >
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="max-w-[8rem] truncate">{f.stop_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* PASO 2 — Confirmar origen (cuando hay destino pero no confirmado) */}
        {destination && !originConfirmed && (
          <OriginStep
            destination={destination}
            loading={loadingValid}
            validGroups={validGroups ?? []}
            validStops={validStops}
            showPicker={showPicker}
            geoStatus={geo.status}
            geoError={geo.status === "error" ? geo.message : null}
            onUseGeo={useGeolocationOrigin}
            onConfirm={confirmOrigin}
            onOpenPicker={() => setShowPicker(true)}
            onClosePicker={() => setShowPicker(false)}
            onChangeDestination={resetFlow}
          />
        )}

        {/* PASO 4 — Plan */}
        {destination && originConfirmed && (
          <TripPlanCard
            origin={origin}
            destination={destination}
            options={planOptions}
            loading={loadingPlan}
            onClear={resetFlow}
            onChangeOrigin={() => { setOriginConfirmed(false); setShowPicker(true); }}
          />
        )}

      </div>
    </div>
  );
}

// ---------- Paso 2: confirmar origen ----------

function OriginStep({
  destination, loading, validGroups, validStops, showPicker, geoStatus,
  onUseGeo, onConfirm, onOpenPicker, onClosePicker, onChangeDestination,
}: {
  destination: Station;
  loading: boolean;
  validGroups: ValidGroup[];
  validStops: Station[];
  showPicker: boolean;
  geoStatus: string;
  onUseGeo: () => void;
  onConfirm: (s: Station) => void;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onChangeDestination: () => void;
}) {
  // Atajos rápidos = POPULAR filtrados a paradas válidas para este destino,
  // excluyendo el propio destino.
  const quickOrigins = useMemo(() => {
    const validIds = new Set(validStops.map((s) => s.stop_id));
    return POPULAR.filter(
      (p) => validIds.has(p.stop_id) && p.stop_id !== destination.stop_id,
    );
  }, [validStops, destination.stop_id]);

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Cabecera destino */}
      <div className="flex items-center gap-2 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-accent/10 px-3 py-2.5 shadow-sm">
        <div className="rounded-full bg-primary/15 p-1.5">
          <span aria-hidden>🎯</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Destino</p>
          <p className="truncate text-sm font-semibold">{destination.stop_name}</p>
        </div>
        <button
          type="button"
          onClick={onChangeDestination}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-accent/40"
          aria-label="Cambiar destino"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-background/70 p-4 shadow-inner">
        <p className="text-base font-semibold">📍 ¿Desde qué estación sales?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Solo te mostramos paradas desde las que puedes llegar.
        </p>

        {loading ? (
          <div className="mt-3 space-y-2">
            <div className="h-12 animate-pulse rounded-xl bg-muted" />
            <div className="h-10 animate-pulse rounded-xl bg-muted" />
          </div>
        ) : validGroups.length === 0 ? (
          <div className="mt-3 rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            No hay líneas TRAM directas hasta {destination.stop_name}.
          </div>
        ) : (
          <>
            {/* Atajos rápidos de origen */}
            {quickOrigins.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {quickOrigins.map((p) => (
                  <button
                    key={p.stop_id}
                    type="button"
                    onClick={() => onConfirm({ stop_id: p.stop_id, stop_name: p.stop_name })}
                    className="flex min-w-0 items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-1.5 text-[11px] font-medium shadow-sm transition hover:border-primary/40 hover:bg-accent/30 active:scale-95"
                  >
                    <span aria-hidden className="text-sm leading-none">{p.emoji}</span>
                    <span className="truncate">{p.label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {geoStatus !== "ready" && (
                <button
                  type="button"
                  onClick={onUseGeo}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent/40"
                >
                  <Locate className="h-3.5 w-3.5 text-primary" /> Usar mi ubicación
                </button>
              )}
              <button
                type="button"
                onClick={onOpenPicker}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent/40"
              >
                <Navigation className="h-3.5 w-3.5 text-primary" /> Elegir otra estación
              </button>
            </div>
          </>
        )}
      </div>

      {/* Picker agrupado por línea */}
      {showPicker && (
        <StationPicker
          groups={validGroups}
          destination={destination}
          onPick={onConfirm}
          onClose={onClosePicker}
        />
      )}
    </div>
  );
}

// ---------- Picker de estaciones origen agrupado por línea ----------

function StationPicker({
  groups, destination, onPick, onClose,
}: {
  groups: ValidGroup[];
  destination: Station;
  onPick: (s: Station) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const f = norm(filter.trim());

  return (
    <div className="rounded-2xl border border-border bg-background shadow-lg animate-scale-in">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="text-xs font-semibold">Elige tu estación de origen</span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto rounded-full p-1 text-muted-foreground hover:bg-accent/40"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar paradas…"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto px-2 pb-2">
        {groups.map((g) => {
          const bg = ensureHash(g.line_color) ?? "var(--primary)";
          const fg = ensureHash(g.line_text_color) ?? "#FFFFFF";
          const stops = g.stops.filter((s) => !f || norm(s.stop_name).includes(f));
          if (!stops.length) return null;
          return (
            <div key={`${g.route_id}|${g.direction_id}${g.via_transfer ? "|T" : ""}`} className="rounded-xl border border-border/60 bg-background/60">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-2.5 py-1.5">
                <span
                  className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-[10px] font-bold"
                  style={{ background: bg, color: fg }}
                >
                  {g.line_short_name ?? "—"}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  → {g.headsign ?? destination.stop_name}
                </span>
                {g.via_transfer && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
                    🔁 vía Luceros
                  </span>
                )}
              </div>
              <ul>
                {stops.map((s) => (
                  <li key={s.stop_id}>
                    <button
                      type="button"
                      onClick={() => onPick(s)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/30"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: bg }} />
                      <span className="truncate">{s.stop_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Tarjeta de viaje ----------

function TripPlanCard({
  origin, destination, options, loading, onClear, onChangeOrigin,
}: {
  origin: Station | null;
  destination: Station;
  options: PlanOption[] | null;
  loading: boolean;
  onClear: () => void;
  onChangeOrigin: () => void;
}) {
  // Filtro defensivo: solo salidas a partir de ahora.
  const futureOptions = useMemo(() => {
    if (!options) return null;
    return options.filter((o) => {
      const m = minutesUntil(o.depart_time);
      return m !== null && m >= 0;
    });
  }, [options]);

  // Conexiones de bus urbano (Vectalia) cercanas a la estación de destino.
  type BusConn = { code: string; name: string; color: string | null; operator: string | null; stop_name: string | null; distance_m: number };
  const [busLines, setBusLines] = useState<BusConn[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    setBusLines(null);
    fetch(`/api/public/tram/bus-connections?stop_id=${encodeURIComponent(destination.stop_id)}&radius_m=600`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setBusLines((d?.lines ?? []) as BusConn[]); })
      .catch(() => { if (!cancelled) setBusLines([]); });
    return () => { cancelled = true; };
  }, [destination.stop_id]);

  const best = futureOptions?.[0];
  const more = (futureOptions ?? []).slice(1);
  const mins = best ? minutesUntil(best.depart_time) : null;
  const color = best ? ensureHash(best.line_color) ?? "var(--primary)" : "var(--primary)";

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-accent/10 shadow-md animate-scale-in">
      <div className="border-b border-border/40 bg-background/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Desde</p>
            <p className="truncate text-sm font-semibold">{origin?.stop_name ?? "—"}</p>
          </div>
          <ArrowRight className="h-4 w-4 flex-none text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hasta</p>
            <p className="truncate text-sm font-semibold">{destination.stop_name}</p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label="Nuevo viaje"
            className="ml-1 rounded-full p-1.5 text-muted-foreground hover:bg-accent/40"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3 text-primary/70" />
          <span className="truncate">Estación {origin?.stop_name ?? "—"} → {destination.stop_name}</span>
        </div>
      </div>

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
            <p className="mt-1 text-xs text-muted-foreground">Prueba con otra estación origen.</p>
            <button
              type="button"
              onClick={onChangeOrigin}
              className="mt-3 inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent/40"
            >
              Cambiar origen
            </button>
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

            {best.transfer ? (
              <div className="mt-3 space-y-2">
                {/* Leg 1 hasta Luceros */}
                <div className="flex items-start gap-2 rounded-xl bg-accent/20 p-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 flex-none text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bájate en</p>
                    <p className="truncate text-sm font-semibold">{best.transfer.at_stop_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Llega {best.transfer.leg1_arrive_time} · {best.stops_between - best.transfer.leg2.stops_between} {(best.stops_between - best.transfer.leg2.stops_between) === 1 ? "parada" : "paradas"}
                    </p>
                  </div>
                </div>
                {/* Transbordo */}
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2">
                  <span className="text-base" aria-hidden>🔁</span>
                  <div className="min-w-0 flex-1 text-[11px]">
                    <p className="font-semibold">Transbordo en {best.transfer.at_stop_name.replace("Alicante - ", "")}</p>
                    <p className="text-muted-foreground">Espera {best.transfer.wait_min} min · sale {best.transfer.leg2_depart_time}</p>
                  </div>
                </div>
                {/* Leg 2 */}
                <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                  <span
                    className="inline-flex h-8 min-w-[2.5rem] items-center justify-center rounded-lg px-1.5 text-sm font-extrabold text-white shadow"
                    style={{ background: ensureHash(best.transfer.leg2.line_color) ?? "var(--primary)" }}
                  >
                    {best.transfer.leg2.line_short_name ?? "TRAM"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Toma hacia</p>
                    <p className="truncate text-xs font-semibold">Dirección {best.transfer.leg2.headsign}</p>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    {best.transfer.leg2.duration_min} min
                  </div>
                </div>
                {/* Llegada final */}
                <div className="flex items-start gap-2 rounded-xl bg-accent/20 p-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 flex-none text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Llega a</p>
                    <p className="truncate text-sm font-semibold">{destination.stop_name}</p>
                    <p className="text-[11px] text-muted-foreground">{best.arrive_time} · {best.transfer.leg2.stops_between} {best.transfer.leg2.stops_between === 1 ? "parada" : "paradas"} desde Luceros</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-accent/20 p-2.5">
                <MapPin className="mt-0.5 h-4 w-4 flex-none text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Bájate en</p>
                  <p className="truncate text-sm font-semibold">{destination.stop_name}</p>
                  <p className="text-[11px] text-muted-foreground">{best.stops_between} {best.stops_between === 1 ? "parada" : "paradas"} desde el origen</p>
                </div>
              </div>
            )}

            <ConnectionsPanel busLines={busLines} destination={destination} />


            {more.length > 0 && (
              <div className="mt-4">
                <p className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Más salidas</span>
                  <span className="normal-case tracking-normal text-[10px] text-muted-foreground/70">{more.length} próximas</span>
                </p>
                <ul className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/60 bg-background/60">
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
                        {o.transfer && (
                          <>
                            <span className="text-[10px] text-muted-foreground">+</span>
                            <span
                              className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md px-1 text-[10px] font-bold text-white"
                              style={{ background: ensureHash(o.transfer.leg2.line_color) ?? "var(--primary)" }}
                              title={`Transbordo Luceros · espera ${o.transfer.wait_min} min`}
                            >
                              {o.transfer.leg2.line_short_name ?? "TRAM"}
                            </span>
                          </>
                        )}
                        <span className="flex-1 truncate">
                          Sale {o.depart_time} · {o.duration_min} min
                          {o.transfer && <span className="text-muted-foreground"> · 🔁 {o.transfer.wait_min}m Luceros</span>}
                        </span>
                        {m !== null && <span className="font-semibold text-primary">{m} min</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={onChangeOrigin}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-accent/40"
              >
                <Navigation className="h-3 w-3 text-primary" /> Cambiar origen
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

// ---------- Conexiones en destino (desplegable con scroll) ----------

type BusConn = { code: string; name: string; color: string | null; operator: string | null; stop_name: string | null; distance_m: number };

function ConnectionsPanel({
  busLines, destination,
}: {
  busLines: BusConn[] | null;
  destination: Station;
}) {
  const [open, setOpen] = useState(false);
  const count = busLines?.length ?? 0;
  const loading = busLines === null;

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-accent/30"
        aria-expanded={open}
      >
        <span aria-hidden>🚍</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Conexiones en destino</p>
          <p className="truncate text-xs font-semibold">
            {loading
              ? "Buscando líneas de bus…"
              : count === 0
                ? "Sin bus urbano cerca · Taxi disponible"
                : `${count} ${count === 1 ? "línea de bus" : "líneas de bus"} cerca · Taxi`}
          </p>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 flex-none text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border/60 bg-background/60 p-2 animate-fade-in">
          {count > 0 && (
            <div className="max-h-44 overflow-y-auto pr-1">
              <ul className="space-y-1">
                {busLines!.map((b) => (
                  <li key={b.code}>
                    <Link
                      to="/bus/dashboard/$code"
                      params={{ code: b.code }}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-[12px] font-medium shadow-sm transition hover:border-primary/40 hover:bg-accent/30"
                    >
                      <span
                        className="inline-flex h-5 min-w-[1.75rem] items-center justify-center rounded px-1.5 text-[10px] font-bold text-white"
                        style={{ background: ensureHash(b.color) ?? "var(--primary)" }}
                      >
                        {b.code}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{b.name}</span>
                      <span className="flex-none text-[10px] text-muted-foreground">{b.distance_m} m</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-[11px]">🚕 Taxi</span>
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
      )}
    </div>
  );
}
