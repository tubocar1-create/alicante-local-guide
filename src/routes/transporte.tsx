import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bus, Train, TrainFront, Star, X, ArrowRight } from "lucide-react";
import { SedanCar } from "@/components/icons/SedanCar";

export const Route = createFileRoute("/transporte")({
  head: () => ({
    meta: [
      { title: "Transporte en Alicante — TRAM, bus y rent-a-car" },
      {
        name: "description",
        content:
          "Hub de movilidad en Alicante: autobuses urbanos, TRAM (FGV) y alquiler de coches en el aeropuerto.",
      },
      { property: "og:title", content: "Transporte en Alicante" },
      {
        property: "og:description",
        content: "Elige cómo moverte: bus, TRAM o rent-a-car.",
      },
      { property: "og:url", content: "https://vamosalicante.com/transporte" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/transporte" }],
  }),
  component: TransporteHub,
});

type Sector = {
  to: string;
  label: string;
  description: string;
  accent: string;
  accent2: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
};

const SECTORS: Sector[] = [
  {
    to: "/bus",
    label: "Autobús urbano",
    description: "Paradas, líneas y tiempos en vivo",
    accent: "#7dd3fc",
    accent2: "#38bdf8",
    Icon: Bus,
  },
  {
    to: "/tram",
    label: "TRAM (FGV)",
    description: "Líneas, estaciones y próximas salidas",
    accent: "#60a5fa",
    accent2: "#3b82f6",
    Icon: Train,
  },
  {
    to: "/trenes",
    label: "Tren (AVE · OUIGO · IRYO)",
    description: "Larga distancia desde Alicante-Terminal",
    accent: "#f0abfc",
    accent2: "#c026d3",
    Icon: TrainFront,
  },
  {
    to: "/rent-a-car",
    label: "Rent a car",
    description: "Comparador de alquiler en el aeropuerto",
    accent: "#818cf8",
    accent2: "#6366f1",
    Icon: SedanCar,
  },
];

function TransporteHub() {
  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #0a1428 0%, #0f2547 50%, #060b1c 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-400/[0.10] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-indigo-400/[0.10] blur-3xl" />
      </div>



      <main className="relative mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-5">
        <header className="mb-1 flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver al inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-sky-300">
              Live · ALC
            </span>
            <Link
              to="/"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-sky-300/90">
            Dashboard de Transporte
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Cómo moverte{" "}
            <span className="bg-gradient-to-r from-sky-300 via-white to-indigo-300 bg-clip-text text-transparent">
              por Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Bus, TRAM y rent-a-car. Elige tu medio para ver paradas, horarios y
            tiempos en vivo.
          </p>
        </div>

        {SECTORS.map((s: Sector) => (
          <Link
            key={s.to}
            to={s.to}
            className="group relative block overflow-hidden rounded-2xl border-0"
          >
            <div
              className="absolute -inset-0.5 rounded-2xl opacity-60 blur-sm transition duration-500 group-hover:opacity-100 group-hover:blur-md"
              style={{
                background: `linear-gradient(135deg, ${s.accent} 0%, ${s.accent2} 60%, ${s.accent} 100%)`,
              }}
            />
            <div className="relative flex items-center gap-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-5 backdrop-blur-xl transition-all group-hover:from-white/[0.12] group-hover:to-white/[0.05] active:scale-[0.98]">
              <div className="relative shrink-0">
                <div
                  className="absolute inset-0 rounded-2xl blur-lg transition duration-500 group-hover:blur-xl"
                  style={{ background: s.accent, opacity: 0.35 }}
                />
                <div
                  className="relative grid h-16 w-16 place-items-center rounded-2xl border"
                  style={{
                    background: `linear-gradient(135deg, ${s.accent}22, ${s.accent2}22)`,
                    borderColor: `${s.accent}88`,
                    boxShadow: `0 0 20px -4px ${s.accent}66`,
                  }}
                >
                  <s.Icon
                    className="h-9 w-9 transition-transform duration-500 group-hover:scale-110"
                    strokeWidth={2.4}
                    style={{ color: "#ffffff" }}
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-300" />
                  </span>
                  <span
                    className="text-[10px] font-bold uppercase tracking-[0.2em]"
                    style={{ color: s.accent }}
                  >
                    En vivo
                  </span>
                </div>
                <div className="mt-1 text-xl font-bold leading-tight tracking-tight text-white">
                  {s.label}
                </div>
                <div className="mt-1 text-[11px] text-white/55">
                  {s.description}
                </div>
              </div>

              <div className="shrink-0">
                <div className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] transition-all duration-500 group-hover:border-white/25 group-hover:bg-white/[0.10]">
                  <ArrowRight
                    className="h-5 w-5 transition-transform duration-500 group-hover:translate-x-0.5"
                    style={{ color: s.accent }}
                  />
                </div>
              </div>
            </div>
          </Link>
        ))}

        {/* Mi parada favorita — pie de página */}
        <div className="pt-2">
          <Link
            to="/transporte/parada-favorita"
            className="group relative flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.98]"
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border"
              style={{
                background: "linear-gradient(135deg, #fde68a22, #fbbf2422)",
                borderColor: "#fde68a88",
              }}
            >
              <Star className="h-4 w-4" style={{ color: "#fde68a" }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white">
                Mi parada favorita
              </span>
              <span className="block text-[11px] text-white/55">
                Acceso rápido a tu parada habitual
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-white/50 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
