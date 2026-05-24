import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  UtensilsCrossed,
  Flame,
  Fish,
  Globe,
  Pizza,
  Coffee,
  Star,
  MapPin,
  Euro,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  getTypicalPlaces,
  getRiceFishPlaces,
  getAsianPlaces,
  getItalianPlaces,
  getPizzasPlaces,
  getBrunchPlaces,
} from "@/lib/places.functions";

export const Route = createFileRoute("/restaurants")({
  head: () => ({
    meta: [
      { title: "Restaurantes en Alicante — Guía por categorías" },
      {
        name: "description",
        content:
          "Descubre los mejores restaurantes de Alicante: cocina típica, arrocerías, asiático, italiano, pizzas y brunch. Valoraciones, precios y ubicación.",
      },
      { property: "og:title", content: "Restaurantes en Alicante" },
      {
        property: "og:description",
        content:
          "Cocina típica, arrocerías, asiático, italiano, pizzas y brunch en Alicante.",
      },
      { property: "og:url", content: "https://vamosalicante.com/restaurants" },
    ],
    links: [
      { rel: "canonical", href: "https://vamosalicante.com/restaurants" },
    ],
  }),
  component: RestaurantsDashboard,
});

type CategoryDef = {
  slug: string;
  label: string;
  emoji: string;
  description: string;
  accent: string;
  Icon: typeof UtensilsCrossed;
  fn: typeof getTypicalPlaces;
};

const CATEGORIES: CategoryDef[] = [
  {
    slug: "typical",
    label: "Cocina Típica",
    emoji: "🥘",
    description: "Alicantina, mediterránea y tapas tradicionales",
    accent: "#f59e0b",
    Icon: Flame,
    fn: getTypicalPlaces,
  },
  {
    slug: "rice_fish",
    label: "Arroz y Pescado",
    emoji: "🦐",
    description: "Arrocerías, paellas y marisquerías",
    accent: "#06b6d4",
    Icon: Fish,
    fn: getRiceFishPlaces,
  },
  {
    slug: "asian",
    label: "Asiático",
    emoji: "🍜",
    description: "Japonés, chino, thai y coreano",
    accent: "#ef4444",
    Icon: Globe,
    fn: getAsianPlaces,
  },
  {
    slug: "italian",
    label: "Italiano",
    emoji: "🍝",
    description: "Trattorias, pasta y auténtica cocina italiana",
    accent: "#22c55e",
    Icon: UtensilsCrossed,
    fn: getItalianPlaces,
  },
  {
    slug: "pizzas",
    label: "Pizzas",
    emoji: "🍕",
    description: "Pizzerías y delivery",
    accent: "#f97316",
    Icon: Pizza,
    fn: getPizzasPlaces,
  },
  {
    slug: "brunch",
    label: "Brunch y Café",
    emoji: "☕",
    description: "Desayunos, specialty coffee y brunch",
    accent: "#a855f7",
    Icon: Coffee,
    fn: getBrunchPlaces,
  },
];

function useCategoryPlaces(fn: typeof getTypicalPlaces, enabled: boolean) {
  const fetcher = useServerFn(fn);
  return useQuery({
    queryKey: ["places", fn.name],
    queryFn: () => fetcher(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

function RestaurantsDashboard() {
  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0a0f1c 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-400/[0.08] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-orange-400/[0.06] blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-4xl space-y-4 px-4 pb-24 pt-5">
        <header className="mb-1 flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver al inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-amber-300">
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
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300/90">
            Guía Gastronómica
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Restaurantes{" "}
            <span className="bg-gradient-to-r from-amber-300 via-white to-orange-300 bg-clip-text text-transparent">
              en Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Explora por tipo de cocina. Toca una tarjeta para ver los
            establecimientos.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <CategoryCard key={cat.slug} cat={cat} />
          ))}
        </div>
      </main>
    </div>
  );
}

function CategoryCard({ cat }: { cat: CategoryDef }) {
  const { data, isLoading } = useCategoryPlaces(cat.fn, true);
  const places = (data?.places ?? []).slice(0, 3);
  const total = (data?.places ?? []).length;

  return (
    <div
      className="group flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]"
      style={{ boxShadow: `0 6px 20px -12px ${cat.accent}66` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full"
          style={{
            background: `${cat.accent}22`,
            color: cat.accent,
            border: `1px solid ${cat.accent}55`,
          }}
        >
          <cat.Icon className="h-5 w-5" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
          {total > 0 ? `${total} locales` : isLoading ? "Cargando…" : "—"}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-base font-semibold leading-tight text-white">
          {cat.label}
        </div>
        <div className="mt-0.5 text-[11px] text-white/55">
          {cat.description}
        </div>
      </div>

      {places.length > 0 && (
        <ul className="mt-1 space-y-1.5">
          {places.map((p: any) => (
            <li key={p.google_place_id}>
              <Link
                to="/restaurants/$placeId"
                params={{ placeId: p.google_place_id }}
                className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-2.5 py-1.5 text-[11px] text-white/80 transition hover:bg-white/[0.07] hover:text-white"
              >
                <span className="truncate font-medium">{p.name}</span>
                {p.rating != null && (
                  <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 text-[10px] text-amber-300">
                    <Star className="h-2.5 w-2.5 fill-amber-300" />
                    {p.rating.toFixed(1)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-1">
        <span
          className="text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: cat.accent }}
        >
          {total > 0 ? "Ver todos →" : "Próximamente"}
        </span>
      </div>
    </div>
  );
}
