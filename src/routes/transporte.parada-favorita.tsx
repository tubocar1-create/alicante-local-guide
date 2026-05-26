import { useEffect, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Bus, ChevronRight, Clock, Info, MapPin, Plane, RefreshCcw, Search, Star } from "lucide-react";
import {
  DEFAULT_FAVORITE_STOP,
  FavoriteStop,
  computeNextArrival,
  computeUpcomingArrivals,
  loadFavoriteStop,
  saveFavoriteStop,
} from "@/components/FavoriteStopWidget";

export const Route = createFileRoute("/transporte/parada-favorita")({
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

const KNOWN_STOPS: FavoriteStop[] = [
  { stopId: "3101", stopName: "Plaza Luceros", line: "C6", destination: "Aeropuerto" },
  { stopId: "0123", stopName: "Mercado Central", line: "02", destination: "Vistahermosa" },
  { stopId: "0244", stopName: "Explanada", line: "21", destination: "Playa San Juan" },
  { stopId: "0337", stopName: "Renfe", line: "24", destination: "Universidad" },
  { stopId: "0418", stopName: "Maisonnave", line: "09", destination: "El Campello" },
];

function ParadaFavoritaPage() {
  const router = useRouter();
  const [stop, setStop] = useState<FavoriteStop>(DEFAULT_FAVORITE_STOP);
  const [tick, setTick] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showOnHome, setShowOnHome] = useState(true);

  useEffect(() => {
    setStop(loadFavoriteStop());
    const id = window.setInterval(() => setTick((t) => t + 1), 45_000);
    return () => window.clearInterval(id);
  }, []);

  const { minutes, arrivalTime } = computeNextArrival(stop);
  const upcoming = computeUpcomingArrivals(stop, 4);

  const filtered = KNOWN_STOPS.filter(
    (s) =>
      s.stopName.toLowerCase().includes(query.toLowerCase()) ||
      s.stopId.includes(query) ||
      s.line.toLowerCase().includes(query.toLowerCase()),
  );

  function selectStop(s: FavoriteStop) {
    saveFavoriteStop(s);
    setStop(s);
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <div className="min-h-screen bg-[#fdf7ee] pb-10">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button
          onClick={() => router.history.back()}
          aria-label="Volver"
          className="flex h-10 w-10 items-center justify-center rounded-full text-orange-500 active:scale-95"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-extrabold text-stone-900">Mi parada favorita</h1>
          <p className="text-xs text-stone-500">Información en tiempo real</p>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Cambiar parada"
          className="flex h-12 w-12 flex-col items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-stone-200 active:scale-95"
        >
          <Star className="h-5 w-5 fill-orange-500 text-orange-500" />
          <span className="text-[9px] font-semibold text-stone-600">Cambiar</span>
        </button>
      </header>

      {/* Live block */}
      <section className="mx-3 rounded-3xl bg-white p-4 shadow-[0_8px_24px_-12px_rgba(60,40,10,0.25)]">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div>
            <div className="mb-2 flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#0d3b8a]" />
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0d3b8a]">
                En directo
              </span>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0d3b8a] text-xl font-extrabold text-white">
                {stop.line}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <h2 className="truncate text-xl font-extrabold uppercase tracking-tight text-stone-900">
                    {stop.destination}
                  </h2>
                  {stop.destination.toLowerCase().includes("aeropuerto") && (
                    <Plane className="h-4 w-4 text-[#0d3b8a]" />
                  )}
                </div>
                <p className="text-[11px] text-stone-500">
                  Dirección: {stop.destination}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <MapPin className="h-5 w-5 text-[#0d3b8a]" />
              <span className="text-lg font-extrabold text-stone-900">
                {stop.stopName}
              </span>
            </div>
            <div className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-stone-100 px-2.5 py-1 text-[11px]">
              <span className="text-stone-600">Código de parada</span>
              <span className="rounded-md bg-[#0d3b8a] px-1.5 py-0.5 font-extrabold text-white">
                {stop.stopId}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-start">
            <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">
              Llegada estimada
            </span>
            <div
              key={minutes}
              className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300"
            >
              <span className="text-[56px] font-extrabold leading-none tabular-nums text-[#0d3b8a]">
                {minutes}
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                Min
              </span>
            </div>
            <span className="mt-2 text-[9px] font-bold uppercase tracking-wider text-stone-500">
              Tiempo restante
            </span>
            <div className="mt-2 rounded-xl bg-stone-50 px-3 py-1.5 text-center ring-1 ring-stone-200">
              <div className="flex items-center justify-center gap-1 text-[9px] font-bold uppercase text-stone-500">
                <Clock className="h-3 w-3" />
                Próximo bus
              </div>
              <div className="text-base font-extrabold tabular-nums text-stone-900">
                {arrivalTime}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-3 text-stone-600">
          <Bus className="h-5 w-5 text-[#0d3b8a]" />
          <div className="text-sm">
            <div className="text-[10px] uppercase tracking-wider text-stone-500">
              Frecuencia aproximada
            </div>
            <div className="font-extrabold text-stone-800">12–15 min</div>
          </div>
        </div>
      </section>

      {/* Upcoming buses */}
      <section className="mx-3 mt-4 rounded-3xl bg-white p-4 shadow-[0_8px_24px_-12px_rgba(60,40,10,0.25)]">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-stone-500">
          Próximos buses
        </h3>
        <ul className="divide-y divide-stone-100">
          {upcoming.map((u, i) => (
            <li
              key={i}
              className="grid grid-cols-[auto_auto_auto_1fr_auto_auto] items-center gap-2 py-2.5"
            >
              <Bus className="h-5 w-5 text-[#0d3b8a]" />
              <span className="text-base font-extrabold tabular-nums text-stone-900">
                {u.arrivalTime}
              </span>
              <span className="rounded-md bg-[#0d3b8a] px-1.5 py-0.5 text-[11px] font-extrabold text-white">
                {stop.line}
              </span>
              <span className="truncate text-sm text-stone-800">{stop.destination}</span>
              <span className="text-sm font-extrabold tabular-nums text-[#0d3b8a]">
                {u.minutes} <span className="text-[10px] font-semibold text-stone-500">min</span>
              </span>
              <ChevronRight className="h-4 w-4 text-stone-400" />
            </li>
          ))}
        </ul>
      </section>

      {/* Info banner */}
      <div className="mx-3 mt-4 flex items-start gap-2 rounded-2xl bg-[#fff3da] px-3 py-3 ring-1 ring-amber-200/60">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-stone-600" />
        <p className="text-[12px] leading-snug text-stone-700">
          El código de tu parada favorita puede consultarse en la marquesina correspondiente.
        </p>
      </div>

      {/* Change favorite */}
      <section className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
        <div className="flex h-12 w-12 items-center justify-center rounded-full ring-1 ring-orange-200">
          <RefreshCcw className="h-5 w-5 text-orange-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold text-stone-900">Cambiar parada favorita</div>
          <p className="text-[11px] leading-snug text-stone-500">
            Elige otra parada y línea para ver su información en tiempo real.
          </p>
        </div>
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-2.5 text-sm font-bold text-white shadow-sm active:scale-95"
        >
          <Search className="h-4 w-4" />
          Buscar
        </button>
      </section>

      {/* Show on home toggle */}
      <section className="mx-3 mt-2 flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
        <Star className="h-5 w-5 text-orange-500" />
        <span className="flex-1 text-sm text-stone-800">Mostrar en página principal</span>
        <button
          role="switch"
          aria-checked={showOnHome}
          onClick={() => setShowOnHome((v) => !v)}
          className={`relative h-7 w-12 rounded-full transition ${
            showOnHome ? "bg-[#0d3b8a]" : "bg-stone-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              showOnHome ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </section>

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
            <div className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2">
              <Search className="h-4 w-4 text-stone-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, línea o código…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
              />
            </div>
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
