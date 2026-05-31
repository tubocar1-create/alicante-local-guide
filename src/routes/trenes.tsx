import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Train, ArrowLeft, ArrowRight, ArrowLeftRight } from "lucide-react";

export const Route = createFileRoute("/trenes")({
  head: () => ({
    meta: [
      { title: "Trenes desde Alicante — Renfe, OUIGO e IRYO" },
      {
        name: "description",
        content:
          "Destinos y orígenes en tren desde Alicante-Terminal. Horarios reales de Renfe, OUIGO e IRYO bajo demanda.",
      },
      { property: "og:title", content: "Trenes desde Alicante" },
      {
        property: "og:description",
        content: "Mapa de destinos y orígenes en tren desde Alicante.",
      },
    ],
  }),
  component: TrenesIndex,
});

// ---------- Catálogo provisional (se rellenará con GTFS) ----------
// Códigos de estación tipo "TRN-XXX" para no chocar con IATA de aeropuertos.
export type TrainStation = {
  code: string;       // identificador interno
  city: string;
  station: string;    // nombre de la estación
  country: string;    // ISO2
  countryName: string;
  operators: string[]; // RENFE | OUIGO | IRYO
};

export const STATIONS: TrainStation[] = [
  { code: "MAD-ATO", city: "Madrid", station: "Puerta de Atocha — Almudena Grandes", country: "ES", countryName: "España", operators: ["RENFE", "OUIGO", "IRYO"] },
  { code: "MAD-CHA", city: "Madrid", station: "Chamartín — Clara Campoamor", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "BCN-SAN", city: "Barcelona", station: "Sants", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "VLC-JOA", city: "Valencia", station: "Joaquín Sorolla", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "MUR-CAR", city: "Murcia", station: "Murcia del Carmen", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "ZAZ-DEL", city: "Zaragoza", station: "Delicias", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "SEV-SJ",  city: "Sevilla", station: "Santa Justa", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "COR-CEN", city: "Córdoba", station: "Central", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "ALB-LH",  city: "Albacete", station: "Los Llanos", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "CR-CR",   city: "Ciudad Real", station: "Ciudad Real", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "CUE-FCS", city: "Cuenca", station: "Fernando Zóbel", country: "ES", countryName: "España", operators: ["RENFE"] },
  { code: "ELC-CAR", city: "Elche", station: "Carrús", country: "ES", countryName: "España", operators: ["RENFE"] },
];

const OPERATOR_COLORS: Record<string, string> = {
  RENFE: "#7e22ce",
  OUIGO: "#ec4899",
  IRYO:  "#dc2626",
};

function flagEmoji(cc: string) {
  return String.fromCodePoint(
    ...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

function TrenesIndex() {
  const [direction, setDirection] = useState<"S" | "L">("S"); // S=salidas (desde Alicante), L=llegadas (hacia Alicante)
  const [query, setQuery] = useState("");

  const filtered = STATIONS.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.city.toLowerCase().includes(q) ||
      s.station.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q)
    );
  });

  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain text-slate-100 lg:min-h-screen lg:h-auto lg:overflow-visible"
      style={{
        background: "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-fuchsia-500/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-violet-500/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-3 pb-10 pt-5 md:px-6">
        <header className="mb-4 flex items-center justify-between">
          <Link
            to="/transporte"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-fuchsia-500/50 hover:text-fuchsia-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-fuchsia-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-fuchsia-300">
              GTFS · ALICANTE-TERMINAL
            </span>
          </div>
        </header>

        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-fuchsia-300/90">
            Dashboard de Trenes
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Trenes{" "}
            <span className="bg-gradient-to-r from-fuchsia-300 via-white to-violet-300 bg-clip-text text-transparent">
              {direction === "S" ? "desde Alicante" : "hacia Alicante"}
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Renfe, OUIGO e IRYO desde la estación de Alicante-Terminal. Datos GTFS oficiales bajo demanda.
          </p>
        </div>

        {/* Toggle Salidas / Llegadas */}
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-700 bg-slate-900/60 p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setDirection("S")}
              className={`rounded-lg px-3 py-1.5 font-semibold uppercase tracking-wider transition ${
                direction === "S"
                  ? "bg-fuchsia-500/20 text-fuchsia-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Salidas
            </button>
            <button
              type="button"
              onClick={() => setDirection("L")}
              className={`rounded-lg px-3 py-1.5 font-semibold uppercase tracking-wider transition ${
                direction === "L"
                  ? "bg-fuchsia-500/20 text-fuchsia-200"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Llegadas
            </button>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
            <ArrowLeftRight className="h-3 w-3" />
            {direction === "S" ? "ALC → destino" : "origen → ALC"}
          </span>
        </div>

        {/* Buscador */}
        <div className="mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ciudad o estación…"
            className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-fuchsia-500/50"
          />
        </div>

        {/* Lista */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-2">
          <div className="mb-1 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {filtered.length} {direction === "S" ? "destinos" : "orígenes"} · Clic para ver horarios
          </div>
          <ul className="space-y-1">
            {filtered.map((s, i) => (
              <li key={s.code}>
                <Link
                  to="/trenes/$code"
                  params={{ code: s.code }}
                  search={{ dir: direction }}
                  className="group flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2.5 transition hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5"
                >
                  <span className="w-6 shrink-0 text-right font-mono text-[11px] text-slate-500">
                    {i + 1}
                  </span>
                  <span className="text-lg leading-none">{flagEmoji(s.country)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold text-white">{s.city}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                        {s.code}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-slate-400">{s.station}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {s.operators.map((op) => (
                      <span
                        key={op}
                        className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          background: (OPERATOR_COLORS[op] ?? "#64748b") + "22",
                          color: OPERATOR_COLORS[op] ?? "#94a3b8",
                        }}
                      >
                        {op}
                      </span>
                    ))}
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-fuchsia-300" />
                </Link>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-slate-500">
                Sin resultados.
              </li>
            )}
          </ul>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
          <Train className="h-3 w-3" />
          Esqueleto preparado — los horarios se cargarán bajo demanda con GTFS oficial.
        </p>
      </div>
    </div>
  );
}
