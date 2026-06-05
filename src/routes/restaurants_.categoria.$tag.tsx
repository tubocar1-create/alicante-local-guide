import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import {
  getRandomRestaurantsWithPhotos,
  type RandomRestaurant,
} from "@/lib/restaurants.functions";

export const Route = createFileRoute("/restaurants_/categoria/$tag")({
  head: ({ params }) => {
    const meta = TAG_META[params.tag] ?? { label: params.tag, emoji: "🍽️" };
    const title = `${meta.label} en Alicante — Alicante Friend`;
    return {
      meta: [
        { title },
        {
          name: "description",
          content: `Restaurantes de ${meta.label.toLowerCase()} cerca de ti en Alicante.`,
        },
      ],
    };
  },
  component: CategoriaPage,
});

const TAG_META: Record<string, { label: string; emoji: string }> = {
  "fast_food:burger": { label: "Hamburguesas", emoji: "🍔" },
  "fast_food:pizza": { label: "Pizza", emoji: "🍕" },
  "fast_food:kebab": { label: "Kebab / Doner", emoji: "🌯" },
  "fast_food:chicken": { label: "Pollo frito", emoji: "🍗" },
  "fast_food:mexican": { label: "Mexicano", emoji: "🌮" },
  "fast_food:montaditos": { label: "Bocadillos / Montaditos", emoji: "🥖" },
  "fast_food:hotdog": { label: "Hot dogs", emoji: "🌭" },
  "fast_food:asian": { label: "Asiático rápido", emoji: "🍜" },
};

const ALICANTE_CENTER = { lat: 38.3414, lng: -0.481 };

function CategoriaPage() {
  const { tag } = Route.useParams();
  const navigate = useNavigate();
  const { state } = useUserLocation();
  const me = state.status === "ready" ? state.coords : null;
  const origin = me ?? ALICANTE_CENTER;
  const meta = TAG_META[tag] ?? { label: tag, emoji: "🍽️" };

  const [items, setItems] = useState<RandomRestaurant[] | null>(null);

  useEffect(() => {
    let cancel = false;
    const payload: { lat?: number; lng?: number; tagKeys: string[] } = {
      tagKeys: [tag],
    };
    if (me) {
      payload.lat = me.lat;
      payload.lng = me.lng;
    }
    getRandomRestaurantsWithPhotos({ data: payload })
      .then((r) => {
        if (!cancel) setItems(r);
      })
      .catch(() => {
        if (!cancel) setItems([]);
      });
    return () => {
      cancel = true;
    };
  }, [tag, me?.lat, me?.lng]);

  return (
    <div className="min-h-dvh bg-[#f3e3c2] text-[#2c1810]">
      <header className="sticky top-0 z-10 bg-[#f3e3c2]/95 backdrop-blur border-b border-black/10">
        <div className="mx-auto max-w-2xl px-3 py-2 flex items-center justify-between gap-2">
          <h1 className="text-sm sm:text-base font-semibold flex items-center gap-1.5 min-w-0">
            <span>{meta.emoji}</span>
            <span className="truncate">{meta.label}</span>
          </h1>
          <Link
            to="/selectordecomidas_/comida-rapida"
            className="text-xs underline underline-offset-2 shrink-0"
          >
            ← Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-3 py-3">
        {items === null ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-black/10 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-[#2c1810]/70 text-center py-8">
            No hay restaurantes de esta categoría cerca todavía.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((r) => {
              const km = distanceKm(origin, { lat: r.lat, lng: r.lng });
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    navigate({
                      to: "/restaurants/$placeId",
                      params: { placeId: r.id },
                    })
                  }
                  className="relative aspect-square text-left bg-black/30 overflow-hidden hover:shadow-md active:scale-[0.98] transition"
                >
                  <img
                    src={r.cover_photo}
                    alt={r.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-6 text-white">
                    <div className="text-sm font-semibold leading-tight line-clamp-2">
                      {r.name}
                    </div>
                    <div className="text-[11px] opacity-90 mt-0.5">
                      {km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
