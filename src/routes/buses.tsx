import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Bus } from "lucide-react";

export const Route = createFileRoute("/buses")({
  head: () => ({
    meta: [
      { title: "Buses de larga distancia desde Alicante" },
      {
        name: "description",
        content:
          "Buses interurbanos y de larga distancia desde la Estación de Autobuses de Alicante y el Aeropuerto Alicante-Elche.",
      },
      { property: "og:title", content: "Buses de larga distancia desde Alicante" },
      {
        property: "og:description",
        content: "Líneas, operadores y horarios desde Alicante y el aeropuerto.",
      },
    ],
  }),
  component: BusesIndex,
});

type Origin = {
  code: string;
  icon: string;
  city: string;
  station: string;
  description: string;
};

const ORIGINS: Origin[] = [
  {
    code: "ALC-BUS",
    icon: "🚍",
    city: "Alicante",
    station: "Estación de Autobuses",
    description: "Hub principal · ALSA, Vectalia, Baile, Beniconnect…",
  },
  {
    code: "ALC-APT",
    icon: "✈️",
    city: "Aeropuerto",
    station: "Alicante-Elche (ALC)",
    description: "Salidas directas a Benidorm, Murcia, Valencia y costa.",
  },
];

function BusesIndex() {
  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain text-slate-100 lg:min-h-screen lg:h-auto lg:overflow-visible"
      style={{
        background: "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-orange-500/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-3 pb-10 pt-5 md:px-6">
        <header className="mb-4 flex items-center justify-between">
          <Link
            to="/transporte"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-500/50 hover:text-amber-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-amber-300">
              LARGA DISTANCIA · ALICANTE
            </span>
          </div>
        </header>

        <div className="mb-4">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/90">
            Dashboard de Buses
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Buses{" "}
            <span className="bg-gradient-to-r from-amber-300 via-white to-orange-300 bg-clip-text text-transparent">
              desde Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Líneas interurbanas y de larga distancia. ALSA, Vectalia, Baile, Beniconnect y más bajo demanda.
          </p>
        </div>

        <section className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">
            Elige punto de salida
          </p>

          <div className="space-y-3">
            {ORIGINS.map((o) => (
              <Link
                key={o.code}
                to="/buses/$code"
                params={{ code: o.code }}
                className="group flex items-start gap-3 overflow-hidden rounded-2xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-slate-900/60 to-slate-950/60 p-4 transition hover:border-amber-400/70 hover:from-amber-500/20"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-2xl ring-1 ring-amber-400/40">
                  {o.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-white md:text-lg">{o.city}</h2>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200">
                      {o.code}
                    </span>
                  </div>
                  <div className="text-sm text-slate-200">{o.station}</div>
                  <p className="mt-1 text-xs text-slate-400">{o.description}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-amber-300 transition group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-3 text-xs text-slate-400">
            <Bus className="mb-1 inline h-3.5 w-3.5 text-amber-300" /> Próximamente: rutas frecuentes (Benidorm, Elche, Murcia, Valencia…) y horarios en vivo por operador.
          </div>
        </section>
      </div>
    </div>
  );
}
