import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Wine,
  Beer,
  Music,
  Star,
  MapPin,
  Euro,
  Clock,
  Martini,
  Sparkles,
} from "lucide-react";
import { getDrinksPlaces } from "@/lib/places.functions";

export const Route = createFileRoute("/nocturno")({
  head: () => ({
    meta: [
      { title: "Bares y Zona de Copas en Alicante" },
      {
        name: "description",
        content:
          "Los mejores bares, pubs, cocktail bars y discotecas de Alicante. Valoraciones, precios y ubicación.",
      },
      { property: "og:title", content: "Bares y Zona de Copas en Alicante" },
      {
        property: "og:description",
        content:
          "Bares, pubs, cocktail bars y discotecas en Alicante.",
      },
      { property: "og:url", content: "https://vamosalicante.com/bares" },
    ],
    links: [
      { rel: "canonical", href: "https://vamosalicante.com/bares" },
    ],
  }),
  component: BaresDashboard,
});

function BaresDashboard() {
  const fetcher = useServerFn(getDrinksPlaces);
  const { data, isLoading } = useQuery({
    queryKey: ["places", "drinks"],
    queryFn: () => fetcher(),
    staleTime: 5 * 60 * 1000,
  });

  const places = (data?.places ?? []) as Array<{
    google_place_id: string;
    name: string;
    cuisine: string | null;
    primary_type: string | null;
    address: string | null;
    rating: number | null;
    user_rating_count: number | null;
    price_level: string | null;
    open_now: boolean | null;
    lat: number | null;
    lng: number | null;
  }>;

  const bars = places.filter(
    (p) =>
      !p.primary_type?.includes("night_club") &&
      !p.primary_type?.includes("nightclub") &&
      !p.cuisine?.toLowerCase().includes("discoteca"),
  );
  const clubs = places.filter(
    (p) =>
      p.primary_type?.includes("night_club") ||
      p.primary_type?.includes("nightclub") ||
      p.cuisine?.toLowerCase().includes("discoteca"),
  );

  const openCount = places.filter((p) => p.open_now).length;

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 50%, #0f0820 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-violet-400/[0.10] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-fuchsia-400/[0.08] blur-3xl" />
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-violet-300">
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
          <p className="text-[10px] uppercase tracking-[0.3em] text-violet-300/90">
            Vida Nocturna
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Bares{" "}
            <span className="bg-gradient-to-r from-violet-300 via-white to-fuchsia-300 bg-clip-text text-transparent">
              y Copas
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Bares, pubs, cocktail bars y discotecas de Alicante.
          </p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
          </div>
        )}

        {!isLoading && places.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <Martini className="mx-auto h-8 w-8 text-white/30" />
            <p className="mt-2 text-sm text-white/60">
              No hay datos de bares disponibles en este momento.
            </p>
          </div>
        )}

        {/* Bares y Pubs */}
        {bars.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Wine className="h-4 w-4 text-violet-300" />
              <h2 className="text-sm font-bold text-white">Bares y Pubs</h2>
              <span className="ml-auto text-[10px] text-white/50">
                {bars.length} locales
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {bars.map((p) => (
                <PlaceCard key={p.google_place_id} place={p} />
              ))}
            </div>
          </section>
        )}

        {/* Discotecas y Clubs */}
        {clubs.length > 0 && (
          <section>
            <div className="mb-2 flex items-center gap-2">
              <Music className="h-4 w-4 text-fuchsia-300" />
              <h2 className="text-sm font-bold text-white">
                Discotecas y Clubs
              </h2>
              <span className="ml-auto text-[10px] text-white/50">
                {clubs.length} locales
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {clubs.map((p) => (
                <PlaceCard key={p.google_place_id} place={p} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function PlaceCard({
  place,
}: {
  place: {
    google_place_id: string;
    name: string;
    cuisine: string | null;
    address: string | null;
    rating: number | null;
    user_rating_count: number | null;
    price_level: string | null;
    open_now: boolean | null;
    lat: number | null;
    lng: number | null;
  };
}) {
  const priceLabel = place.price_level
    ? "€".repeat(
        Math.min(
          4,
          Math.max(
            1,
            Number(place.price_level.replace(/\D/g, "")) || 2,
          ),
        ),
      )
    : "—";

  return (
    <Link
      to="/restaurants/$placeId"
      params={{ placeId: place.google_place_id }}
      className="group flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300">
        <Beer className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-white">
            {place.name}
          </span>
          {place.open_now != null && (
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                place.open_now ? "bg-emerald-400" : "bg-rose-400"
              }`}
            />
          )}
        </div>
        {place.cuisine && (
          <p className="mt-0.5 text-[10px] text-white/50">{place.cuisine}</p>
        )}
        {place.address && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/40">
            <MapPin className="h-2.5 w-2.5" />
            <span className="truncate">{place.address}</span>
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-3">
          {place.rating != null && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" />
              {place.rating.toFixed(1)}
            </span>
          )}
          {place.user_rating_count != null && (
            <span className="text-[10px] text-white/40">
              {place.user_rating_count.toLocaleString("es-ES")} reseñas
            </span>
          )}
          <span className="ml-auto text-[10px] text-white/40">{priceLabel}</span>
        </div>
      </div>
    </Link>
  );
}
