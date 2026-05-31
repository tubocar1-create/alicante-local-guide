import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Bus, ChevronRight, Clock, Info, MapPin, Plane, RefreshCcw, Search, Star } from "lucide-react";
import {
  FavoriteStop,
  computeNextArrival,
  computeUpcomingArrivals,
  loadFavoriteStop,
  saveFavoriteStop,
} from "@/components/FavoriteStopWidget";
import { useBusGraph } from "@/hooks/useBusGraph";
import { useBusServiceWindows, useBusLineDepartures, getServiceStatus, getNightLineEstimates } from "@/hooks/useBusServiceWindow";
import { cumulativeMinutes, NIGHT_URBAN_KMH } from "@/lib/bus-eta";

export const Route = createFileRoute("/transporte_/parada-favorita")({
  validateSearch: (s: Record<string, unknown>) => ({
    stop: typeof s.stop === "string" ? s.stop : undefined,
    line: typeof s.line === "string" ? s.line : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Mi parada favorita — VAMOS Alicante" },
      {
        name: "description",
        content: "Información en tiempo real de tu parada de bus favorita en Alicante.",
      },
    ],
  }),
  component: ParadaFavoritaPage,
});

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function ParadaFavoritaPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const { data: graph } = useBusGraph();
  const [stop, setStop] = useState<FavoriteStop>(() => loadFavoriteStop());
  const [searchLookupDone, setSearchLookupDone] = useState(!search.stop);
  const [, setTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showOnHome, setShowOnHome] = useState(true);
  // Real-time ETAs en minutos (lista completa devuelta por Vectalia).
  const [liveAll, setLiveAll] = useState<number[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<number>(Date.now());

  const serviceWindows = useBusServiceWindows();
  const lineDepartures = useBusLineDepartures();
  const searchMatchesCurrent = Boolean(search.stop) &&
    stop.stopId === search.stop &&
    (!search.line || stop.line.toUpperCase() === search.line.toUpperCase());
  const searchTargetPending = Boolean(search.stop) && !searchMatchesCurrent && !searchLookupDone;
  // Para líneas nocturnas: el cuadro Vectalia se identifica por el ORIGEN
  // del trayecto del usuario (primer stop de la dirección cuyo último stop
  // es stop.destination). Lo calculamos abajo en `originTerminalName`.
  const originTerminalName = useMemo(() => {
    if (!graph) return "";
    const lineRows = graph.stops.filter((r) => r.line_code === stop.line);
    const byDir = new Map<number, typeof lineRows>();
    for (const r of lineRows) {
      if (!byDir.has(r.direction)) byDir.set(r.direction, []);
      byDir.get(r.direction)!.push(r);
    }
    for (const [, rows] of byDir) {
      const sorted = [...rows].sort((a, b) => a.seq - b.seq);
      if (sorted[sorted.length - 1]?.stop_name === stop.destination) {
        return sorted[0]?.stop_name ?? "";
      }
    }
    return "";
  }, [graph, stop.line, stop.destination]);

  const serviceStatus = getServiceStatus(serviceWindows, stop.line, new Date(), originTerminalName);
  const outOfService = serviceStatus.outOfService;
  const reopensDayLabel = serviceStatus.reopensDayLabel;
  const reopensAt = serviceStatus.reopensAt ?? "07:00";
  const reopensLabel = reopensDayLabel ? `${reopensDayLabel} ${reopensAt}` : reopensAt;
  const lastDeparture = serviceStatus.lastDeparture;
  const isNightLine = serviceStatus.isNightLine;

  // Para líneas nocturnas: leemos horas reales de bus_line_departures.
  // Si la parada del usuario es el ORIGEN del trayecto, hora_llegada =
  // hora_salida programada por Vectalia (sin offset). Si es intermedia/
  // destino, sumamos el tiempo de recorrido estimado por distancia.
  const nightEstimate = useMemo(() => {
    if (!isNightLine || outOfService || !graph || !originTerminalName) return null;
    const lineRows = graph.stops.filter((r) => r.line_code === stop.line);
    if (lineRows.length === 0) return null;
    const coords = new Map<string, { lat: number; lng: number }>();
    for (const s of graph.stopsMeta) {
      if (s.lat != null && s.lng != null) coords.set(s.code, { lat: s.lat, lng: s.lng });
    }
    const byDir = new Map<number, typeof lineRows>();
    for (const r of lineRows) {
      if (!byDir.has(r.direction)) byDir.set(r.direction, []);
      byDir.get(r.direction)!.push(r);
    }
    let offsetMin = 0;
    let found = false;
    for (const [, rows] of byDir) {
      const sorted = [...rows].sort((a, b) => a.seq - b.seq);
      if (sorted[sorted.length - 1]?.stop_name !== stop.destination) continue;
      const idx = sorted.findIndex((r) => String(r.stop_code) === stop.stopId);
      if (idx < 0) continue;
      const codes = sorted.map((r) => String(r.stop_code ?? ""));
      const cum = cumulativeMinutes(codes, coords, { speedKmh: NIGHT_URBAN_KMH });
      offsetMin = cum[idx] ?? 0;
      found = true;
      break;
    }
    if (!found) return null;
    return getNightLineEstimates(
      serviceWindows,
      lineDepartures,
      stop.line,
      originTerminalName,
      offsetMin,
      new Date(),
      4,
    );
  }, [isNightLine, outOfService, graph, serviceWindows, lineDepartures, stop, originTerminalName]);

  // Nota: para líneas nocturnas funciona UN solo bus que parte siempre a
  // la hora oficial de Vectalia desde el origen del trayecto. La llegada a
  // una parada intermedia se estima sumando el tiempo de recorrido a la
  // salida; en el origen, llegada = salida (no puede llegar antes de salir).


  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setSearchLookupDone(!search.stop || searchMatchesCurrent);
  }, [search.stop, search.line, searchMatchesCurrent]);

  // Una sola petición a Vectalia: trae todos los ETAs disponibles.
  // Para líneas nocturnas no consultamos Vectalia (sin cobertura live) y
  // usamos estimados horarios desde el terminal de origen.
  useEffect(() => {
    if (searchTargetPending || outOfService || isNightLine) {
      setLiveAll([]);
      setLiveLoading(false);
      return;
    }
    let cancelled = false;
    const fetchAll = async () => {
      setLiveLoading(true);
      try {
        const params = new URLSearchParams({ stop: stop.stopId, line: stop.line });
        const r = await fetch(`/api/public/bus-eta?${params.toString()}`, { cache: "no-store" });
        if (!r.ok) {
          if (!cancelled) setLiveAll([]);
          return;
        }
        const j = await r.json();
        const all: number[] = Array.isArray(j?.all)
          ? j.all.filter((n: unknown) => typeof n === "number")
          : [];
        if (!cancelled) {
          setLiveAll(all);
          setLiveUpdatedAt(Date.now());
        }
      } catch {
        if (!cancelled) setLiveAll([]);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    };
    fetchAll();
    const id = window.setInterval(fetchAll, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stop.stopId, stop.line, outOfService, isNightLine, searchTargetPending]);

  const elapsedMin = Math.floor((Date.now() - liveUpdatedAt) / 60_000);
  const liveMinutes = liveAll.length > 0 ? Math.max(0, liveAll[0] - elapsedMin) : null;
  const fallback = computeNextArrival(stop);
  // Si hay estimado nocturno, lo usamos como fuente principal.
  const nightFirst = nightEstimate?.upcoming[0];
  const minutes = nightFirst ? nightFirst.minutes : (liveMinutes ?? fallback.minutes);
  const arrivalDate = new Date(Date.now() + minutes * 60_000);
  const arrivalTime = nightFirst
    ? nightFirst.arrivalTime
    : `${String(arrivalDate.getHours()).padStart(2, "0")}:${String(arrivalDate.getMinutes()).padStart(2, "0")}`;
  const fallbackUpcoming = computeUpcomingArrivals(stop, 4);
  // Construye las 4 próximas llegadas. Para líneas nocturnas en servicio
  // usamos los estimados horarios; en el resto, live Vectalia + relleno.
  const upcoming = (() => {
    if (nightEstimate) {
      // En el ORIGEN del trayecto mostramos la hora oficial de salida de
      // Vectalia. En paradas intermedias mostramos la hora estimada de
      // llegada, calculada por distancia desde el origen.
      const atOrigin = nightEstimate.atOrigin;
      // En el origen, el "tiempo de espera" es hasta la SALIDA oficial
      // (la llegada se estima 5 min antes para carga de pasajeros).
      return nightEstimate.upcoming.map((u) => ({
        minutes: atOrigin ? u.minutes + 5 : u.minutes,
        arrivalTime: atOrigin ? u.departureTime : u.arrivalTime,
        live: false,
      }));
    }
    const out: Array<{ minutes: number; arrivalTime: string; live: boolean }> = [];
    const liveAdjusted = liveAll.map((m) => Math.max(0, m - elapsedMin)).sort((a, b) => a - b);
    for (const m of liveAdjusted.slice(0, 4)) {
      const d = new Date(Date.now() + m * 60_000);
      out.push({
        minutes: m,
        arrivalTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        live: true,
      });
    }
    // Frecuencia inferida a partir de los ETAs live; por defecto 15 min.
    let freq = 15;
    if (liveAdjusted.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < liveAdjusted.length; i++) diffs.push(liveAdjusted[i] - liveAdjusted[i - 1]);
      diffs.sort((a, b) => a - b);
      const med = diffs[Math.floor(diffs.length / 2)];
      if (med >= 5 && med <= 60) freq = med;
    }
    const lastMin = out.length > 0 ? out[out.length - 1].minutes : null;
    let idx = 0;
    while (out.length < 4) {
      const base = lastMin != null ? lastMin + freq * (idx + 1) : fallbackUpcoming[idx].minutes;
      const d = new Date(Date.now() + base * 60_000);
      out.push({
        minutes: base,
        arrivalTime: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
        live: false,
      });
      idx++;
    }
    return out;
  })();
  const isArriving = minutes <= 1 && !nightEstimate; // los estimados no parpadean
  const hasLiveData = liveAll.length > 0 && !isNightLine;



  // Build (line+direction) options with real terminal as destination.
  const options = useMemo<FavoriteStop[]>(() => {
    const out: FavoriteStop[] = [];
    if (graph?.stops?.length) {
      const byKey = new Map<string, typeof graph.stops>();
      for (const r of graph.stops) {
        const k = `${r.line_code}|${r.direction}`;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k)!.push(r);
      }
      for (const [, rows] of byKey) {
        const sorted = [...rows].sort((a, b) => a.seq - b.seq);
        const terminal = sorted[sorted.length - 1]?.stop_name ?? "";
        for (const r of sorted) {
          if (!r.stop_code) continue;
          if (r.seq === sorted[sorted.length - 1].seq) continue;
          out.push({
            stopId: String(r.stop_code),
            stopName: r.stop_name,
            line: r.line_code,
            destination: terminal,
          });
        }
      }
    }
    // Ensure key lines (C6, 23) are always selectable with sus paradas principales.
    const ensureMany = (line: string, destination: string, stops: Array<{ stopId: string; stopName: string }>) => {
      const exists = (sid: string) =>
        out.some((o) => o.line.toUpperCase() === line.toUpperCase() && o.stopId === sid);
      for (const s of stops) {
        if (!exists(s.stopId)) out.push({ line, destination, stopId: s.stopId, stopName: s.stopName });
      }
    };
    ensureMany("C6", "Aeropuerto", [
      { stopId: "3101", stopName: "Luceros" },
      { stopId: "1851", stopName: "Mercado Central" },
      { stopId: "1900", stopName: "Avda. Aguilera" },
      { stopId: "3933", stopName: "Princesa Mercedes" },
      { stopId: "3950", stopName: "Hospital General" },
      { stopId: "3980", stopName: "Aeropuerto T1" },
    ]);
    ensureMany("23", "Playa de San Juan", [
      { stopId: "1820", stopName: "Plaza España" },
      { stopId: "1830", stopName: "Maisonnave" },
      { stopId: "1845", stopName: "Estación Renfe" },
      { stopId: "2300", stopName: "Vía Parque" },
      { stopId: "2350", stopName: "Playa San Juan" },
    ]);
    return out;
  }, [graph]);


  // Apply ?stop & ?line search params once options are ready
  useEffect(() => {
    if (!search.stop) {
      setSearchLookupDone(true);
      return;
    }
    if (!graph) return;
    const match = options.find(
      (o) =>
        o.stopId === search.stop &&
        (!search.line || o.line.toUpperCase() === search.line.toUpperCase()),
    );
    if (match) {
      saveFavoriteStop(match);
      setStop(match);
    }
    setSearchLookupDone(true);
  }, [search.stop, search.line, options, graph]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return options.slice(0, 80);
    const tokens = q.split(/\s+/).filter(Boolean);
    const matches = options.filter((o) => {
      const hay = normalize(`${o.line} ${o.stopName} ${o.stopId} ${o.destination}`);
      return tokens.every((t) => hay.includes(t));
    });
    // Priority: exact stopId, stopId startsWith, line code, then rest
    const score = (o: FavoriteStop) => {
      const id = o.stopId.toLowerCase();
      const ln = o.line.toLowerCase();
      if (id === q) return 0;
      if (id.startsWith(q)) return 1;
      if (id.includes(q)) return 2;
      if (ln === q) return 3;
      if (ln.startsWith(q)) return 4;
      return 5;
    };
    return matches.sort((a, b) => score(a) - score(b)).slice(0, 80);
  }, [options, query]);

  function selectStop(s: FavoriteStop) {
    saveFavoriteStop(s);
    setStop(s);
    setSearchOpen(false);
    setQuery("");
  }

  if (searchTargetPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fdf7ee] px-6 text-center">
        <div className="rounded-3xl bg-white px-6 py-5 shadow-[0_8px_24px_-12px_rgba(60,40,10,0.25)] ring-1 ring-stone-200">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-[#0d3b8a]" />
          <p className="text-sm font-extrabold text-stone-900">Cargando tu parada…</p>
          <p className="mt-1 text-xs text-stone-500">Preparando horarios y próximas llegadas.</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#fdf7ee] pb-6">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          onClick={() => router.history.back()}
          aria-label="Volver"
          className="flex h-9 w-9 items-center justify-center rounded-full text-orange-500 active:scale-95"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-extrabold text-stone-900">Mi parada favorita</h1>
          <p className="text-[11px] text-stone-500">Información en tiempo real</p>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Cambiar parada"
          className="flex h-11 w-11 flex-col items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 active:scale-95"
        >
          <Star className="h-4 w-4 fill-orange-500 text-orange-500" />
          <span className="text-[8px] font-semibold text-stone-600">Cambiar</span>
        </button>
      </header>

      {/* Live block */}
      <section className="mx-3 rounded-3xl bg-white p-3 shadow-[0_8px_24px_-12px_rgba(60,40,10,0.25)]">
        <div className="grid grid-cols-[minmax(0,1fr)_128px] gap-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0d3b8a]" />
              </span>
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#0d3b8a]">
                En directo
              </span>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0d3b8a] text-base font-extrabold text-white">
                {stop.line}
              </span>
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Bus línea ({stop.line})
              </span>
            </div>

            {/* Parada → Destino, separados visualmente con flecha */}
            <div className="rounded-2xl bg-stone-50 p-2.5 ring-1 ring-stone-200">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-[#0d3b8a]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                    Tu parada
                  </div>
                  <div className="truncate text-sm font-extrabold text-stone-900">
                    {stop.stopName}
                  </div>
                </div>
              </div>

              <div className="my-2 flex items-center gap-2 pl-1">
                <div className="h-px flex-1 bg-stone-300" />
                <ArrowRight className="h-4 w-4 text-orange-500" />
                <div className="h-px flex-1 bg-stone-300" />
              </div>

              <div className="flex items-center gap-1.5">
                <Bus className="h-4 w-4 shrink-0 text-[#0d3b8a]" />
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
                    Dirección
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="truncate text-sm font-extrabold text-stone-900">
                      {stop.destination}
                    </span>
                    {stop.destination.toLowerCase().includes("aeropuerto") && (
                      <Plane className="h-3.5 w-3.5 shrink-0 text-[#0d3b8a]" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2 py-0.5 text-[10px]">
              <span className="text-stone-600">Código</span>
              <span className="rounded-md bg-[#0d3b8a] px-1.5 py-0.5 font-extrabold text-white">
                {stop.stopId}
              </span>
            </div>
          </div>

          <div className="flex w-full flex-col items-center justify-start">
            <span className="w-full text-center text-[10px] font-bold uppercase tracking-wider leading-tight text-stone-500">
              {outOfService ? <>Servicio<br />nocturno</> : <>Llegada<br />estimada</>}
            </span>
            {outOfService ? (
              <div className="mt-2 flex w-full flex-col items-center rounded-2xl bg-stone-100 px-2 py-3 text-center ring-1 ring-stone-300">
                <span className="text-xs font-black uppercase leading-tight tracking-tight text-stone-600">
                  Fuera de<br />servicio
                </span>
                <span className="mt-1 text-[9px] font-semibold text-stone-500">
                  Reanuda {reopensLabel}
                </span>
              </div>
            ) : isArriving ? (
              <div className="mt-2 w-full animate-blink rounded-2xl bg-[#0d3b8a] px-2 py-3 text-center shadow-lg">
                <div className="text-[9px] font-bold uppercase tracking-widest text-white/80">
                  Faltan
                </div>
                <div className="text-lg font-black uppercase leading-tight tracking-tight text-white">
                  ¡Llegando!
                </div>
              </div>
            ) : (
              <div
                key={minutes}
                className="flex w-full flex-col items-center animate-in fade-in zoom-in-95 duration-300"
              >
                <span className="text-[96px] font-extrabold leading-none tabular-nums text-[#0d3b8a]">
                  {minutes}
                </span>
                <span className="-mt-1 text-sm font-bold uppercase tracking-wider text-stone-600">
                  Min
                </span>
              </div>
            )}
            {!outOfService && (
              <div className="mt-2 w-full rounded-xl bg-stone-50 px-2 py-1.5 text-center ring-1 ring-stone-200">
                <div className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase text-stone-500">
                  <Clock className="h-3 w-3" />
                  Llega a las
                </div>
                <div className="text-sm font-extrabold tabular-nums text-stone-900">
                  {arrivalTime}
                </div>
              </div>
            )}
          </div>

        </div>

        <div className="mt-2 flex items-center gap-2 border-t border-stone-100 pt-2 text-stone-600">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              outOfService ? "bg-stone-400" : nightEstimate ? "bg-indigo-500" : liveLoading ? "bg-amber-500 animate-pulse" : hasLiveData ? "bg-emerald-500" : "bg-stone-300"
            }`}
          />
          <div className="text-xs">
            <span className="text-[9px] uppercase tracking-wider text-stone-500">Datos:</span>{" "}
            <span className="font-extrabold text-stone-800">
              {outOfService
                ? `fuera de servicio · reanuda ${reopensLabel}`
                : nightEstimate
                  ? nightEstimate.atOrigin
                    ? `horario Vectalia · salidas desde ${nightEstimate.originTerminal}`
                    : `horario Vectalia + recorrido estimado desde ${nightEstimate.originTerminal}`
                  : hasLiveData
                    ? "tiempo real (Vectalia)"
                    : "estimación · sin paso en vivo"}
            </span>
          </div>
        </div>
        {nightEstimate && !nightEstimate.atOrigin && (
          <p className="mt-1 text-[10px] leading-snug text-stone-500">
            ⓘ La hora de salida es la oficial de Vectalia desde {nightEstimate.originTerminal}; la llegada a tu parada se estima a partir del recorrido (velocidad media de madrugada).
          </p>
        )}
      </section>


      {/* Upcoming buses */}
      <section className="mx-3 mt-2 rounded-3xl bg-white p-3 shadow-[0_8px_24px_-12px_rgba(60,40,10,0.25)]">
        <h3 className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-stone-500">
          <span>Próximas salidas</span>
          {!outOfService && hasLiveData && (
            <span className="inline-flex items-center gap-1 normal-case text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              en vivo
            </span>
          )}
        </h3>
        {outOfService ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <span className="text-sm font-extrabold text-stone-700">Fuera de servicio</span>
            <span className="text-[11px] text-stone-500">
              El servicio se reanuda {reopensDayLabel ? `el ${reopensLabel}` : `a las ${reopensAt}`}.{lastDeparture ? ` El último bus parte de la parada extrema a las ${lastDeparture}.` : ""}
            </span>
          </div>
        ) : (
          <ul className="divide-y divide-stone-100">
            {upcoming.map((u, i) => (
              <li
                key={i}
                className="grid grid-cols-[auto_auto_auto_1fr_auto_auto] items-center gap-1.5 py-1.5"
              >
                <Bus className="h-4 w-4 text-[#0d3b8a]" />
                <span className="text-sm font-extrabold tabular-nums text-stone-900">
                  {u.arrivalTime}
                </span>
                <span className="rounded-md bg-[#0d3b8a] px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {stop.line}
                </span>
                <span className="truncate text-xs text-stone-800">{stop.destination}</span>
                <span className={`text-xs font-extrabold tabular-nums ${u.live ? "text-emerald-700" : "text-stone-400"}`}>
                  {u.minutes}{" "}
                  <span className="text-[9px] font-semibold text-stone-500">
                    {u.live ? "min · live" : "min est."}
                  </span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
              </li>
            ))}
          </ul>
        )}
      </section>


      {/* Change favorite */}
      <section className="mx-3 mt-2 flex items-center gap-2 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-stone-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-orange-200">
          <RefreshCcw className="h-4 w-4 text-orange-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-extrabold text-stone-900">Cambiar parada favorita</div>
          <p className="text-[10px] leading-snug text-stone-500">
            Elige otra parada y línea para ver su información en tiempo real.
          </p>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1 rounded-xl bg-orange-500 px-2.5 py-2 text-xs font-bold text-white shadow-sm active:scale-95"
        >
          <Search className="h-3.5 w-3.5" />
          Buscar
        </button>
      </section>

      {/* Show on home toggle */}
      <section className="mx-3 mt-2 flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-stone-200">
        <Star className="h-4 w-4 text-orange-500" />
        <span className="flex-1 text-xs text-stone-800">Mostrar en página principal</span>
        <button
          role="switch"
          aria-checked={showOnHome}
          onClick={() => setShowOnHome((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition ${
            showOnHome ? "bg-[#0d3b8a]" : "bg-stone-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              showOnHome ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </section>

      {/* Info banner — footer */}
      <footer className="mx-3 mt-3 flex items-start gap-2 rounded-2xl bg-[#fff3da] px-3 py-2 ring-1 ring-amber-200/60">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-600" />
        <p className="text-[10px] leading-snug text-stone-700">
          El código de tu parada favorita puede consultarse en la marquesina correspondiente.
        </p>
      </footer>

      {/* Search modal */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-200" />
            <h3 className="mb-2 text-lg font-extrabold text-stone-900">Buscar parada</h3>
            <div className="relative flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2">
              <Search className="h-4 w-4 text-stone-500" />
              <div className="relative flex-1">
                {/* Ghost text: shows the rest of the top suggestion inline */}
                {query && filtered[0] && (() => {
                  const label = `${filtered[0].stopName} (${filtered[0].line})`;
                  const nq = normalize(query);
                  const nl = normalize(label);
                  if (!nl.startsWith(nq)) return null;
                  const completion = label.slice(query.length);
                  return (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 flex items-center text-sm"
                    >
                      <span className="invisible">{query}</span>
                      <span className="text-stone-400">{completion}</span>
                    </div>
                  );
                })()}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.key === "Tab" || e.key === "ArrowRight") && filtered[0]) {
                      const label = `${filtered[0].stopName} (${filtered[0].line})`;
                      if (normalize(label).startsWith(normalize(query)) && query.length < label.length) {
                        e.preventDefault();
                        setQuery(label);
                      }
                    } else if (e.key === "Enter" && filtered[0]) {
                      e.preventDefault();
                      selectStop(filtered[0]);
                    }
                  }}
                  placeholder="Nombre, línea o código…"
                  autoComplete="off"
                  autoCorrect="on"
                  autoCapitalize="words"
                  spellCheck
                  inputMode="search"
                  className="relative w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
                />
              </div>
            </div>
            <p className="mt-1 px-1 text-[10px] text-stone-400">
              Pulsa <kbd className="rounded bg-stone-200 px-1 font-mono">Tab</kbd> o → para completar
            </p>

            <ul className="mt-3 max-h-[50vh] divide-y divide-stone-100 overflow-y-auto">
              {filtered.map((s) => (
                <li key={s.stopId}>
                  <button
                    onClick={() => selectStop(s)}
                    className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 py-2.5 text-left"
                  >
                    <span className="rounded-md bg-[#0d3b8a] px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                      {s.line}
                    </span>
                    <span className="min-w-0">
                      <div className="truncate text-sm font-bold text-stone-900">
                        {s.stopName}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        → {s.destination} · cód. {s.stopId}
                      </div>
                    </span>
                    <ChevronRight className="h-4 w-4 text-stone-400" />
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="py-6 text-center text-sm text-stone-500">
                  No se encontraron paradas.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
