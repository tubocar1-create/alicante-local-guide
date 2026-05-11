import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronDown, Info, MapPin, Sparkles, MessageCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Alicante Friend — Tu guía local en Alicante" },
      {
        name: "description",
        content:
          "Descubre Alicante como un local: dónde comer, dormir, planes del día y un amigo IA al que preguntar lo que sea.",
      },
      { property: "og:title", content: "Alicante Friend" },
      {
        property: "og:description",
        content: "Tu amigo local de Alicante: comida, alojamiento, playas y planes.",
      },
    ],
  }),
  component: Home,
});

type Tile = {
  title: string;
  emoji: string;
  to: string;
  bg: string;
  ring: string;
};

const PRIMARY: Tile[] = [
  {
    title: "Comer",
    emoji: "🍽️",
    to: "/eat",
    bg: "from-[oklch(0.96_0.05_70)] to-[oklch(0.92_0.08_60)]",
    ring: "ring-[oklch(0.85_0.10_60)]",
  },
  {
    title: "Dormir",
    emoji: "🛏️",
    to: "/stay",
    bg: "from-[oklch(0.95_0.04_220)] to-[oklch(0.9_0.07_220)]",
    ring: "ring-[oklch(0.82_0.09_220)]",
  },
];

const SECONDARY: Tile[] = [
  {
    title: "Explorar",
    emoji: "🗺️",
    to: "/explore",
    bg: "from-[oklch(0.96_0.04_140)] to-[oklch(0.9_0.07_140)]",
    ring: "ring-[oklch(0.82_0.10_140)]",
  },
  {
    title: "Chatear",
    emoji: "💬",
    to: "/chat",
    bg: "from-[oklch(0.95_0.05_35)] to-[oklch(0.9_0.09_35)]",
    ring: "ring-[oklch(0.82_0.12_35)]",
  },
  {
    title: "Mi perfil",
    emoji: "👤",
    to: "/perfil",
    bg: "from-[oklch(0.96_0.04_310)] to-[oklch(0.9_0.07_310)]",
    ring: "ring-[oklch(0.82_0.10_310)]",
  },
];

const QUICK_PICKS: { title: string; emoji: string; to: string; sub: string }[] = [
  { title: "Restaurantes", emoji: "🍤", to: "/eat", sub: "Locales auténticos" },
  { title: "Cafeterías", emoji: "☕", to: "/eat", sub: "Para empezar el día" },
  { title: "Hoteles", emoji: "🏨", to: "/stay", sub: "Cerca de la playa" },
  { title: "Apartamentos", emoji: "🏢", to: "/stay", sub: "Estancias largas" },
  { title: "Playas", emoji: "🏖️", to: "/explore", sub: "Postiguet, San Juan…" },
  { title: "Castillo", emoji: "🏰", to: "/explore", sub: "Santa Bárbara" },
];

function Home() {
  const { user } = useAuth();
  const name = user?.name?.split(" ")[0] ?? "amig@";

  return (
    <div className="min-h-[100dvh] bg-background pb-10">
      {/* Yellow hero (Glovo-inspired) */}
      <section className="relative overflow-hidden bg-[oklch(0.86_0.16_85)] pt-6 pb-16 md:pt-10 md:pb-24">
        <div className="mx-auto w-full max-w-5xl px-4 md:px-8">
          {/* Location pill */}
          <button
            type="button"
            className="mx-auto flex items-center gap-2 rounded-full bg-[oklch(0.95_0.08_85)] px-4 py-2 text-sm font-semibold text-foreground shadow-sm md:text-base"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <span className="max-w-[180px] truncate md:max-w-none">Alicante, España</span>
            <ChevronDown className="h-4 w-4 opacity-60" />
          </button>

          {/* Big primary tiles */}
          <div className="mt-8 grid grid-cols-2 gap-4 md:gap-6">
            {PRIMARY.map((t) => (
              <CategoryTile key={t.title} tile={t} large />
            ))}
          </div>

          {/* Secondary tiles */}
          <div className="mt-4 grid grid-cols-3 gap-3 md:mt-6 md:gap-5">
            {SECONDARY.map((t) => (
              <CategoryTile key={t.title} tile={t} />
            ))}
          </div>
        </div>

        {/* Soft wave bottom */}
        <svg
          className="absolute -bottom-1 left-0 right-0 w-full text-background"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M0,48 C240,96 480,0 720,32 C960,64 1200,80 1440,40 L1440,80 L0,80 Z"
          />
        </svg>
      </section>

      {/* "Para ti" horizontal scroller */}
      <section className="mx-auto mt-6 w-full max-w-5xl px-4 md:px-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight md:text-2xl">
            {user ? `${name}, esto es para ti` : "Esto es para ti"}
          </h2>
          <Info className="h-5 w-5 text-muted-foreground" />
        </div>

        <div className="-mx-4 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 no-scrollbar md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 lg:grid-cols-6">
          {QUICK_PICKS.map((q) => (
            <Link
              key={q.title}
              to={q.to}
              className="snap-start shrink-0 w-32 md:w-auto rounded-2xl bg-card border border-border/60 shadow-soft transition active:scale-95"
            >
              <div className="grid aspect-square w-full place-items-center rounded-t-2xl bg-gradient-to-br from-secondary to-accent/40 text-4xl">
                {q.emoji}
              </div>
              <div className="px-3 py-2">
                <div className="truncate text-sm font-semibold">{q.title}</div>
                <div className="truncate text-[11px] text-muted-foreground">{q.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Promo banner */}
      <section className="mx-auto mt-6 w-full max-w-5xl px-4 md:px-8">
        <Link
          to="/chat"
          className="relative flex items-center gap-4 overflow-hidden rounded-3xl gradient-warm p-5 text-primary-foreground shadow-soft md:p-8"
        >
          <div className="flex-1">
            <div className="inline-flex items-center gap-1 rounded-full bg-card/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="h-3 w-3" /> Nuevo
            </div>
            <h3 className="mt-2 font-display text-xl font-bold leading-tight md:text-3xl">
              Pregúntame lo que quieras
            </h3>
            <p className="mt-1 text-sm opacity-90 md:text-base">
              Tu amigo local responde en segundos.
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-2 text-sm font-semibold text-foreground">
              <MessageCircle className="h-4 w-4" /> Abrir chat
            </div>
          </div>
          <div className="hidden text-7xl md:block">🌅</div>
          <div className="text-6xl md:hidden">🌅</div>
        </Link>
      </section>
    </div>
  );
}

function CategoryTile({ tile, large = false }: { tile: Tile; large?: boolean }) {
  return (
    <Link
      to={tile.to}
      className={`group relative block rounded-3xl bg-card shadow-md ring-1 ${tile.ring} transition active:scale-95`}
    >
      <div
        className={`grid place-items-center rounded-3xl bg-gradient-to-br ${tile.bg} ${
          large ? "aspect-[4/3] text-6xl md:text-7xl" : "aspect-square text-4xl md:text-5xl"
        }`}
      >
        <span className="drop-shadow-sm">{tile.emoji}</span>
      </div>
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-border/70 bg-card px-4 py-1.5 text-[13px] font-semibold shadow-sm md:text-sm">
        {tile.title}
      </div>
    </Link>
  );
}
