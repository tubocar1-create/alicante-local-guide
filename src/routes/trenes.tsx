import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Train, ArrowLeft, ArrowRight, Radio, CalendarRange } from "lucide-react";

export const Route = createFileRoute("/trenes")({
  head: () => ({
    meta: [
      { title: "Trenes desde Alicante — Renfe, OUIGO e IRYO" },
      {
        name: "description",
        content:
          "Corredores ferroviarios desde Alicante-Terminal. Horarios reales de Renfe, OUIGO e IRYO bajo demanda.",
      },
      { property: "og:title", content: "Trenes desde Alicante" },
      {
        property: "og:description",
        content: "Corredores y estaciones en tren desde Alicante.",
      },
    ],
  }),
  component: TrenesIndex,
});

// ---------- Corredores desde Alicante-Terminal ----------
export type CorridorId =
  | "MAD"   // Madrid · Alta Velocidad
  | "MEDN"  // Mediterráneo Norte
  | "NOR"   // Norte (AVE/Alvia hacia Zaragoza/Galicia/Asturias)
  | "MUR"   // Cercanías C1 (Alicante–Murcia)
  | "CTG"   // Media Distancia hacia Cartagena
  | "LOR"   // Media Distancia hacia Lorca
  | "UNI";  // Cercanías C3 (Universidad)

export type Corridor = {
  id: CorridorId;
  icon: string;       // emoji
  name: string;       // título visible
  product: string;    // subtítulo (productos)
  operators: string[];
};

export type TrainStation = {
  code: string;
  city: string;
  station: string;
  corridor: CorridorId;
  operators: string[];
};

export const CORRIDORS: Corridor[] = [
  { id: "MAD",  icon: "🚄", name: "Destino Madrid Chamartín",     product: "Alta Velocidad · AVE · AVLO · OUIGO · IRYO", operators: ["RENFE", "OUIGO", "IRYO"] },
  { id: "MEDN", icon: "🚄", name: "Destino Barcelona Sants",      product: "Euromed · Intercity · AVE",                  operators: ["RENFE"] },
  { id: "NOR",  icon: "🚄", name: "Destino Norte de España",       product: "AVE · Alvia · Galicia · Asturias",            operators: ["RENFE"] },
  { id: "MUR",  icon: "🚆", name: "Destino Murcia del Carmen",    product: "Cercanías C1",                                operators: ["RENFE"] },
  { id: "CTG",  icon: "🚆", name: "Destino Cartagena",            product: "Media Distancia",                             operators: ["RENFE"] },
  { id: "LOR",  icon: "🚆", name: "Destino Lorca Sutullena",      product: "Media Distancia",                             operators: ["RENFE"] },
  { id: "UNI",  icon: "🚆", name: "Destino Sant Vicent Centre",   product: "Cercanías C3",                                operators: ["RENFE"] },
];

export const STATIONS: TrainStation[] = [
  // ===== 🚄 Destino Madrid Chamartín · Alta Velocidad =====
  { code: "MAD-VLL",  city: "Villena",     station: "Villena AV",                           corridor: "MAD",  operators: ["RENFE"] },
  { code: "MAD-ALB",  city: "Albacete",    station: "Los Llanos",                           corridor: "MAD",  operators: ["RENFE", "OUIGO", "IRYO"] },
  { code: "MAD-CUE",  city: "Cuenca",      station: "Fernando Zóbel",                       corridor: "MAD",  operators: ["RENFE", "OUIGO", "IRYO"] },
  { code: "MAD-CR",   city: "Ciudad Real", station: "Ciudad Real",                          corridor: "MAD",  operators: ["RENFE"] },
  { code: "MAD-PTL",  city: "Puertollano", station: "Puertollano",                          corridor: "MAD",  operators: ["RENFE"] },
  { code: "MAD-CHA",  city: "Madrid",      station: "Chamartín — Clara Campoamor",          corridor: "MAD",  operators: ["RENFE"] },

  // ===== 🚄 Mediterráneo Norte =====
  // Renfe Euromed / Intercity Alicante↔Valencia opera SIEMPRE por Estació del Nord.
  // Joaquín Sorolla es estación AVE Madrid↔Valencia y NO recibe trenes desde Alicante.
  { code: "MED-VLCN", city: "Valencia",   station: "Nord (Euromed / Intercity)", corridor: "MEDN", operators: ["RENFE"] },
  { code: "MED-XAT",  city: "Xàtiva",     station: "Xàtiva",           corridor: "MEDN", operators: ["RENFE"] },
  { code: "MED-CAS",  city: "Castelló",   station: "Castelló",         corridor: "MEDN", operators: ["RENFE"] },
  { code: "MED-TARC", city: "Tarragona",  station: "Camp de Tarragona", corridor: "MEDN", operators: ["RENFE"] },
  { code: "MED-TAR",  city: "Tarragona",  station: "Tarragona",        corridor: "MEDN", operators: ["RENFE"] },
  { code: "MED-BCN",  city: "Barcelona",  station: "Sants",            corridor: "MEDN", operators: ["RENFE"] },

  // ===== 🚄 Norte =====
  { code: "NOR-ZAZ",  city: "Zaragoza",    station: "Delicias",          corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-SEG",  city: "Segovia",     station: "Guiomar",           corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-VAD",  city: "Valladolid",  station: "Campo Grande",      corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-PAL",  city: "Palencia",    station: "Palencia",          corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-BUR",  city: "Burgos",      station: "Rosa Manzano",      corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-LEO",  city: "León",        station: "León",              corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-OUR",  city: "Ourense",     station: "Ourense",           corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-COR",  city: "A Coruña",    station: "A Coruña",          corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-VIG",  city: "Vigo",        station: "Urzáiz",            corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-OVI",  city: "Oviedo",      station: "Oviedo",            corridor: "NOR", operators: ["RENFE"] },
  { code: "NOR-GIJ",  city: "Gijón",       station: "Gijón",             corridor: "NOR", operators: ["RENFE"] },

  // ===== 🚆 Corredor Murcia — Cercanías C1 =====
  { code: "MUR-SGA",  city: "Alicante",            station: "Sant Gabriel",                 corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-TOR",  city: "Elx",                 station: "Torrellano",                   corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-EPA",  city: "Elx",                 station: "Elx Parc",                     corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-ECA",  city: "Elx",                 station: "Elx Carrús",                   corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-CRE",  city: "Crevillent",          station: "Crevillent",                   corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-ALB",  city: "Albatera",            station: "Albatera-Catral",              corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-CAL",  city: "Callosa de Segura",   station: "Callosa de Segura-Cox",        corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-ORI",  city: "Orihuela",            station: "Orihuela Miguel Hernández",    corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-BEN",  city: "Beniel",              station: "Beniel",                       corridor: "MUR", operators: ["RENFE"] },
  { code: "MUR-MUR",  city: "Murcia",              station: "Murcia del Carmen",            corridor: "MUR", operators: ["RENFE"] },

  // ===== 🚆 Corredor Cartagena — Media Distancia =====
  { code: "CTG-MUR",  city: "Murcia",       station: "Murcia del Carmen",       corridor: "CTG", operators: ["RENFE"] },
  { code: "CTG-BAL",  city: "Balsicas",     station: "Balsicas-Mar Menor",      corridor: "CTG", operators: ["RENFE"] },
  { code: "CTG-TPA",  city: "Torre-Pacheco", station: "Torre-Pacheco",          corridor: "CTG", operators: ["RENFE"] },
  { code: "CTG-CTG",  city: "Cartagena",    station: "Cartagena",               corridor: "CTG", operators: ["RENFE"] },

  // ===== 🚆 Corredor Lorca — Media Distancia =====
  { code: "LOR-MUR",  city: "Murcia",          station: "Murcia del Carmen",         corridor: "LOR", operators: ["RENFE"] },
  { code: "LOR-ALC",  city: "Alcantarilla",    station: "Alcantarilla-Los Romanos",  corridor: "LOR", operators: ["RENFE"] },
  { code: "LOR-LIB",  city: "Librilla",        station: "Librilla",                  corridor: "LOR", operators: ["RENFE"] },
  { code: "LOR-ALH",  city: "Alhama de Murcia", station: "Alhama de Murcia",         corridor: "LOR", operators: ["RENFE"] },
  { code: "LOR-TOT",  city: "Totana",          station: "Totana",                    corridor: "LOR", operators: ["RENFE"] },
  { code: "LOR-LOR",  city: "Lorca",           station: "Lorca Sutullena",           corridor: "LOR", operators: ["RENFE"] },

  // ===== 🚆 Corredor Universidad — Cercanías C3 =====
  { code: "UNI-UNI",  city: "San Vicente del Raspeig", station: "Universidad de Alicante", corridor: "UNI", operators: ["RENFE"] },
  { code: "UNI-SVI",  city: "San Vicente del Raspeig", station: "Sant Vicent Centre",      corridor: "UNI", operators: ["RENFE"] },
];

const OPERATOR_COLORS: Record<string, string> = {
  RENFE: "#7e22ce",
  OUIGO: "#ec4899",
  IRYO:  "#dc2626",
};

// Tintes por corredor — diferenciación visible que respeta la estética oscura.
const CORRIDOR_TINTS: Record<CorridorId, { section: string; list: string; border: string }> = {
  MAD:  { section: "bg-fuchsia-500/[0.10]", list: "bg-fuchsia-950/35",  border: "border-fuchsia-500/25" },
  MEDN: { section: "bg-cyan-500/[0.10]",    list: "bg-cyan-950/35",     border: "border-cyan-500/25" },
  NOR:  { section: "bg-indigo-500/[0.10]",  list: "bg-indigo-950/35",   border: "border-indigo-500/25" },
  MUR:  { section: "bg-amber-500/[0.08]",   list: "bg-amber-950/30",    border: "border-amber-500/20" },
  CTG:  { section: "bg-emerald-500/[0.08]", list: "bg-emerald-950/30",  border: "border-emerald-500/20" },
  LOR:  { section: "bg-rose-500/[0.08]",    list: "bg-rose-950/30",     border: "border-rose-500/20" },
  UNI:  { section: "bg-sky-500/[0.08]",     list: "bg-sky-950/30",      border: "border-sky-500/20" },
};


function TrenesIndex() {
  const [mode, setMode] = useState<"menu" | "programa">("menu");
  const [direction, setDirection] = useState<"S" | "L">("S");
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = (s: TrainStation) =>
    !q ||
    s.city.toLowerCase().includes(q) ||
    s.station.toLowerCase().includes(q) ||
    s.code.toLowerCase().includes(q);

  const corridorLabel = (name: string) => {
    const target = name.replace(/^Destino\s+/, "");
    if (direction === "S") return `Desde Alicante hacia ${target}`;
    return `Desde ${target} hacia Alicante`;
  };

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
            Corredores ferroviarios desde Alicante-Terminal. Renfe, OUIGO e IRYO bajo demanda.
          </p>
        </div>

        {mode === "menu" && (
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
              ¿Qué quieres consultar?
            </p>
            <Link
              to="/cartelera"
              className="group flex min-h-[150px] flex-col overflow-hidden rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-slate-900/60 to-slate-950/60 p-4 transition hover:border-emerald-400/70 hover:from-emerald-500/25"
            >
              <div className="flex flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 ring-1 ring-emerald-400/40">
                  <Radio className="h-5 w-5 text-emerald-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white md:text-lg">
                      Cartelera de trenes de hoy
                    </h2>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                      En vivo
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300">
                    Próximas salidas y llegadas en Alicante-Terminal con incidencias en tiempo real (ADIF).
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-emerald-300 transition group-hover:translate-x-0.5" />
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setMode("programa")}
              className="group flex min-h-[150px] w-full flex-col overflow-hidden rounded-2xl border-2 border-fuchsia-500/40 bg-gradient-to-br from-fuchsia-500/15 via-slate-900/60 to-slate-950/60 p-4 text-left transition hover:border-fuchsia-400/70 hover:from-fuchsia-500/25"
            >
              <div className="flex flex-1 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20 ring-1 ring-fuchsia-400/40">
                  <CalendarRange className="h-5 w-5 text-fuchsia-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-white md:text-lg">
                    Programa de trenes
                  </h2>
                  <p className="mt-1 text-xs text-slate-300">
                    Horarios y frecuencias <span className="text-fuchsia-200">desde</span> Alicante <span className="text-fuchsia-200">hasta</span> tu destino (o al revés).
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-fuchsia-300 transition group-hover:translate-x-0.5" />
              </div>
            </button>

            {/* Accesos rápidos a destinos populares */}
            <div className="space-y-3 pt-2">
              <p className="text-center text-[11px] uppercase tracking-[0.25em] text-slate-400">
                Destinos populares
              </p>

              <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
                {/* Salidas */}
                <div className="rounded-2xl border border-fuchsia-500/25 bg-fuchsia-950/20 p-3">
                  <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-fuchsia-300/90">
                    Salidas · desde Alicante
                  </p>
                  <div className="grid grid-rows-3 gap-2">
                    {[
                      { code: "MAD-CHA", label: "Madrid" },
                      { code: "MED-VLCN", label: "Valencia" },
                      { code: "MED-BCN", label: "Barcelona" },
                    ].map((d) => (
                      <Link
                        key={`S-${d.code}`}
                        to="/trenes/$code"
                        params={{ code: d.code }}
                        search={{ dir: "S" as const }}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-fuchsia-500/30 bg-slate-900/60 px-3 text-xs font-semibold text-slate-100 transition hover:border-fuchsia-400/70 hover:bg-fuchsia-500/15"
                      >
                        <span>ALC → {d.label}</span>
                        <ArrowRight className="h-3 w-3 text-fuchsia-300" />
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Llegadas */}
                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-950/20 p-3">
                  <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wider text-cyan-300/90">
                    Llegadas · hacia ALC
                  </p>
                  <div className="grid grid-rows-3 gap-2">
                    {[
                      { code: "MAD-CHA", label: "Madrid" },
                      { code: "MED-VLCN", label: "Valencia" },
                      { code: "MED-BCN", label: "Barcelona" },
                    ].map((d) => (
                      <Link
                        key={`L-${d.code}`}
                        to="/trenes/$code"
                        params={{ code: d.code }}
                        search={{ dir: "L" as const }}
                        className="flex h-12 items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-slate-900/60 px-3 text-xs font-semibold text-slate-100 transition hover:border-cyan-400/70 hover:bg-cyan-500/15"
                      >
                        <span>{d.label} → ALC</span>
                        <ArrowRight className="h-3 w-3 text-cyan-300" />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {mode === "programa" && (
        <>
        <button
          type="button"
          onClick={() => setMode("menu")}
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-fuchsia-500/50 hover:text-fuchsia-300"
        >
          <ArrowLeft className="h-3 w-3" />
          Cambiar modo
        </button>

        {/* Toggle Salidas / Llegadas — grande y claro */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border-2 border-slate-700 bg-slate-900/60 p-1.5">
          <button
            type="button"
            onClick={() => setDirection("S")}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-3 font-bold uppercase tracking-wider transition ${
              direction === "S"
                ? "bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 text-fuchsia-100 shadow-lg shadow-fuchsia-500/20 ring-1 ring-fuchsia-400/40"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            <span className="text-base md:text-lg">Salidas</span>
            <span className="text-[10px] font-medium normal-case tracking-normal opacity-80">
              ALC → destino
            </span>
          </button>
          <button
            type="button"
            onClick={() => setDirection("L")}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-3 font-bold uppercase tracking-wider transition ${
              direction === "L"
                ? "bg-gradient-to-br from-fuchsia-500/30 to-violet-500/20 text-fuchsia-100 shadow-lg shadow-fuchsia-500/20 ring-1 ring-fuchsia-400/40"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            <span className="text-base md:text-lg">Llegadas</span>
            <span className="text-[10px] font-medium normal-case tracking-normal opacity-80">
              origen → ALC
            </span>
          </button>
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

        {/* Corredores */}
        <div className="space-y-2">
          {CORRIDORS.map((corr) => {
            const base = STATIONS.filter((s) => s.corridor === corr.id && matches(s));
            const stations = direction === "L" ? [...base].reverse() : base;
            if (q && stations.length === 0) return null;

            const tint = CORRIDOR_TINTS[corr.id];
            return (
              <section
                key={corr.id}
                className={`overflow-hidden rounded-2xl border ${tint.border} ${tint.section}`}
              >
                <div className="flex w-full items-center gap-3 px-3 py-3 text-left">
                  <span className="text-xl leading-none">{corr.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{corridorLabel(corr.name)}</div>
                    <div className="truncate text-[11px] text-slate-400">{corr.product}</div>
                  </div>
                  <span className="rounded-full border border-slate-700/70 px-2 py-0.5 text-[10px] text-slate-400">
                    {STATIONS.filter((s) => s.corridor === corr.id).length}
                  </span>
                </div>

                <ul className={`border-t ${tint.border} ${tint.list} p-1.5`}>
                  {stations.map((s) => (
                    <li key={s.code}>
                      <Link
                        to="/trenes/$code"
                        params={{ code: s.code }}
                        search={{ dir: direction }}
                        className="group flex items-center gap-2 rounded-lg border border-slate-800/70 bg-slate-950/40 px-2.5 py-1.5 transition hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="truncate text-[12px] font-medium text-slate-200">
                            {s.station}
                          </span>
                          <span className="ml-1.5 text-[10px] text-slate-500">
                            · {s.city}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {s.operators.map((op) => (
                            <span
                              key={op}
                              className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                              style={{
                                background: (OPERATOR_COLORS[op] ?? "#64748b") + "22",
                                color: OPERATOR_COLORS[op] ?? "#94a3b8",
                              }}
                            >
                              {op}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-fuchsia-300" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
          <Train className="h-3 w-3" />
          Esqueleto preparado — los horarios se cargarán bajo demanda con GTFS oficial.
        </p>
        </>
        )}
      </div>
    </div>
  );
}
