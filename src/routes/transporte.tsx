import { createFileRoute, Link } from "@tanstack/react-router";
import { Bus, Train, TrainFront, X, ArrowRight } from "lucide-react";
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
    to: "/buses",
    label: "Buses larga distancia",
    description: "ALSA, Vectalia, Beniconnect desde Alicante",
    accent: "#fcd34d",
    accent2: "#f59e0b",
    Icon: Bus,
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
      className="fixed inset-0 z-[60] flex flex-col lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] text-white"
      style={{
        background:
          "linear-gradient(180deg, #0a1428 0%, #0f2547 50%, #060b1c 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-400/[0.10] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-indigo-400/[0.10] blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col gap-2 px-4 pb-4 pt-3">
        <header className="flex shrink-0 items-center justify-between">
          <Link
            to="/"
            className="text-[10px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
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
              className="ml-1 rounded-full border border-white/20 p-1 text-white/70 hover:border-white/40 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <div className="shrink-0">
          <p className="text-[9px] uppercase tracking-[0.3em] text-sky-300/90">
            Dashboard de Transporte
          </p>
          <h1 className="mt-0.5 font-display text-xl font-bold tracking-tight text-white md:text-3xl">
            Cómo moverte{" "}
            <span className="bg-gradient-to-r from-sky-300 via-white to-indigo-300 bg-clip-text text-transparent">
              por Alicante
            </span>
          </h1>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-5 gap-2">
          {SECTORS.map((s: Sector) => (
            <Link
              key={s.to}
              to={s.to}
              className="group relative block overflow-hidden rounded-2xl border-0"
            >
              <div
                className="absolute -inset-0.5 rounded-2xl opacity-60 blur-sm transition duration-500 group-hover:opacity-100"
                style={{
                  background: `linear-gradient(135deg, ${s.accent} 0%, ${s.accent2} 60%, ${s.accent} 100%)`,
                }}
              />
              <div className="relative flex h-full items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] px-3 py-2 backdrop-blur-xl transition-all group-hover:from-white/[0.12] group-hover:to-white/[0.05] active:scale-[0.98]">
                <div className="relative shrink-0">
                  <div
                    className="absolute inset-0 rounded-xl blur-md"
                    style={{ background: s.accent, opacity: 0.35 }}
                  />
                  <div
                    className="relative grid h-14 w-14 place-items-center rounded-2xl border"
                    style={{
                      background: `linear-gradient(135deg, ${s.accent}22, ${s.accent2}22)`,
                      borderColor: `${s.accent}88`,
                      boxShadow: `0 0 20px -4px ${s.accent}66`,
                    }}
                  >
                    <s.Icon
                      className="h-8 w-8 transition-transform duration-500 group-hover:scale-110"
                      strokeWidth={2.4}
                      style={{ color: "#ffffff" }}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-300" />
                    </span>
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.2em]"
                      style={{ color: s.accent }}
                    >
                      En vivo
                    </span>
                  </div>
                  <div className="mt-0.5 text-[19px] font-bold leading-tight tracking-tight text-white md:text-xl">
                    {s.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-white/60">
                    {s.description}
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[0.05] transition-all duration-500 group-hover:border-white/25 group-hover:bg-white/[0.10]">
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5"
                      style={{ color: s.accent }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

