import { createFileRoute, Link } from "@tanstack/react-router";
import { Film, Drama, Music2, X } from "lucide-react";

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
  slug: "cines" | "teatros" | "conciertos";
  label: string;
  emoji: string;
  description: string;
  accent: string;
  Icon: typeof Film;
  ready: boolean;
};

const SUBS: Sub[] = [
  {
    slug: "cines",
    label: "Cines",
    emoji: "🎬",
    description: "Cartelera, horarios y compra de entradas",
    accent: "#f472b6",
    Icon: Film,
    ready: true,
  },
  {
    slug: "teatros",
    label: "Teatros",
    emoji: "🎭",
    description: "Principal, Arniches, Aula CAM…",
    accent: "#fbbf24",
    Icon: Drama,
    ready: false,
  },
  {
    slug: "conciertos",
    label: "Conciertos",
    emoji: "🎤",
    description: "Salas, festivales y giras",
    accent: "#a78bfa",
    Icon: Music2,
    ready: false,
  },
];

function OcioDashboard() {
  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-white"
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SUBS.map((s) => {
            const card = (
              <div
                className="group flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]"
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
                  className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: s.ready ? s.accent : "#9ca3af" }}
                >
                  {s.ready ? "Explorar →" : "Próximamente"}
                </div>
              </div>
            );
            if (s.ready && s.slug === "cines") {
              return (
                <Link key={s.slug} to="/ocio/cines" className="block">
                  {card}
                </Link>
              );
            }
            return (
              <div key={s.slug} className="block opacity-60">
                {card}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
