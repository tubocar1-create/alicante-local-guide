import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Drama, Music2, Clapperboard, X, Ticket } from "lucide-react";

export const Route = createFileRoute("/ocio")({
  head: () => ({
    meta: [
      { title: "Ocio en Alicante — Cines, teatros y conciertos" },
      {
        name: "description",
        content:
          "Cartelera de cines, programación de teatros y conciertos en Alicante. Horarios, fichas y compra de entradas.",
      },
      { property: "og:title", content: "Ocio en Alicante" },
      {
        property: "og:description",
        content: "Cines, teatros y conciertos en Alicante.",
      },
    ],
  }),
  component: OcioDashboard,
});

type Sub = {
  to: "/ocio/eventos";
  label: string;
  description: string;
  accent: string;
  Icon: typeof Film;
};

const SUBS: Sub[] = [
  {
    to: "/ocio/eventos/cartelera",
    label: "Teatro, conciertos y eventos",
    description: "Principal, ADDA, Plaza de Toros, Área 12, Muelle Live…",
    accent: "#a78bfa",
    Icon: Drama,
  },
];
void Music2;

function OcioDashboard() {
  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 50%, #0f0820 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-pink-400/[0.10] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-violet-400/[0.10] blur-3xl" />
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-pink-300">
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
          <p className="text-[10px] uppercase tracking-[0.3em] text-pink-300/90">
            Dashboard de Ocio
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Ocio{" "}
            <span className="bg-gradient-to-r from-pink-300 via-white to-violet-300 bg-clip-text text-transparent">
              en Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Cines, teatros y conciertos. Elige un sector para explorar la
            cartelera y horarios.
          </p>
        </div>

        {/* Cartelera — Destacado */}
        <Link
          to="/ocio/cartelera"
          className="group relative block overflow-hidden rounded-2xl border-0"
        >
          {/* Glow exterior */}
          <div
            className="absolute -inset-0.5 rounded-2xl opacity-60 blur-sm transition duration-500 group-hover:opacity-100 group-hover:blur-md"
            style={{
              background:
                "linear-gradient(135deg, #f9a8d4 0%, #f472b6 40%, #c084fc 100%)",
            }}
          />
          <div className="relative flex items-center gap-5 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-5 backdrop-blur-xl transition-all group-hover:from-white/[0.12] group-hover:to-white/[0.05] active:scale-[0.98]">
            {/* Icono grande con brillo */}
            <div className="relative shrink-0">
              <div
                className="absolute inset-0 rounded-2xl blur-lg transition duration-500 group-hover:blur-xl"
                style={{ background: "#f9a8d4", opacity: 0.35 }}
              />
              <div
                className="relative grid h-16 w-16 place-items-center rounded-2xl border"
                style={{
                  background: "linear-gradient(135deg, #f9a8d422, #f472b622)",
                  borderColor: "#f9a8d488",
                  boxShadow: "0 0 20px -4px #f9a8d466",
                }}
              >
                <Clapperboard
                  className="h-8 w-8 transition-transform duration-500 group-hover:scale-110"
                  style={{ color: "#f9a8d4" }}
                />
              </div>
            </div>

            {/* Texto */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pink-300" />
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.2em]"
                  style={{ color: "#f9a8d4" }}
                >
                  En vivo
                </span>
              </div>
              <div className="mt-1 text-xl font-bold leading-tight tracking-tight text-white">
                Cartelera de cines
              </div>
              <div className="mt-1 text-[11px] text-white/55">
                Elige cine y mira las sesiones de hoy
              </div>
            </div>

            {/* Flecha / ticket */}
            <div className="shrink-0">
              <div
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.05] transition-all duration-500 group-hover:border-white/25 group-hover:bg-white/[0.10]"
              >
                <Ticket
                  className="h-5 w-5 rotate-[-15deg] transition-transform duration-500 group-hover:rotate-0"
                  style={{ color: "#f9a8d4" }}
                />
              </div>
            </div>
          </div>
        </Link>

        {/* Otros sectores */}
        <div className="grid grid-cols-1 gap-3">
          {SUBS.map((s) => (
            <Link key={s.to} to={s.to} className="block">
              <div
                className="group flex h-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]"
                style={{ boxShadow: `0 6px 20px -12px ${s.accent}66` }}
              >
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
                  style={{
                    background: `${s.accent}22`,
                    color: s.accent,
                    border: `1px solid ${s.accent}55`,
                  }}
                >
                  <s.Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold leading-tight text-white">
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/55">
                    {s.description}
                  </div>
                </div>
                <div
                  className="text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: s.accent }}
                >
                  Explorar →
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
