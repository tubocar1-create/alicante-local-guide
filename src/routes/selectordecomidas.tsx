import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import {
  getRandomRestaurantsWithPhotos,
  type RandomRestaurant,
} from "@/lib/restaurants.functions";

export const Route = createFileRoute("/selectordecomidas")({
  head: () => ({
    meta: [
      { title: "Comer — Alicante Friend" },
      {
        name: "description",
        content:
          "Elige qué te apetece comer en Alicante: cocina típica, arroces, italiano, japonés, vegano, brunch, postres, comida rápida, barato o internacional.",
      },
      { property: "og:title", content: "Comer — Alicante Friend" },
      { property: "og:description", content: "Elige qué te apetece comer hoy en Alicante." },
    ],
  }),
  component: SelectorDeComidasPage,
});

type Item = { label: string; emoji: string; prompt?: string; submenu?: SubItem[] };
type SubItem = { label: string; prompt: string };

const CATEGORIES: Item[] = [
  { label: "Cocina típica", emoji: "🥘", prompt: "Recomiéndame un sitio de cocina típica alicantina tradicional abierto ahora" },
  { label: "Arroces y pescado", emoji: "🍤", prompt: "Quiero un buen arroz, paella o pescado fresco, ¿dónde voy ahora?" },
  { label: "Italiano", emoji: "🍕", prompt: "Apetece italiano (pizza, pasta), ¿dónde puedo ir ahora?" },
  { label: "Japonés / Asiático", emoji: "🍣", prompt: "Un japonés o asiático rico abierto ahora" },
  { label: "Vegano / Saludable", emoji: "🌱", prompt: "Un sitio vegano o saludable abierto ahora" },
  { label: "Desayuno / Brunch", emoji: "🥐", prompt: "Necesito un buen desayuno o brunch en Alicante abierto ahora" },
  { label: "Comida rápida", emoji: "🍔", prompt: "Quiero comida rápida abierta ahora (hamburguesas, pizza, kebap, pollo, mexicano, montaditos…), ¿dónde voy?" },
  { label: "Postres / Cafetería", emoji: "🍰", prompt: "Una cafetería con postres ricos abierta ahora" },
  { label: "Barato y rico", emoji: "💸", prompt: "Algo barato y rico para comer ya, abierto ahora" },
  { label: "Internacional", emoji: "🌍", prompt: "Quiero comida internacional (hindú, libanés, peruano, mexicano, latino, árabe…), ¿dónde voy ahora?" },
];

// Map a free-text cuisine string to one of the 10 selector categories
function matchCategory(cuisine: string | null): { label: string; emoji: string } | null {
  const c = (cuisine ?? "").toLowerCase().trim();
  if (!c) return null;
  const has = (...keys: string[]) => keys.some((k) => c.includes(k));
  if (has("paella", "arroz", "arrocer", "rice", "seafood", "fish", "pescado", "marisco", "marisquer")) return CATEGORIES[1];
  if (has("italian", "italiano", "pizza", "pizzer", "pasta")) return CATEGORIES[2];
  if (has("japan", "japon", "sushi", "ramen", "asian", "asiát", "asiat", "chin", "thai", "tailan", "korean", "corean", "vietnam", "wok", "poke")) return CATEGORIES[3];
  if (has("vegan", "vegetarian", "healthy", "salad", "ensalad", "saludable", "bowl")) return CATEGORIES[4];
  if (has("breakfast", "brunch", "desayuno", "tosta")) return CATEGORIES[5];
  if (has("burger", "hamburg", "fast", "rápida", "rapida", "kebab", "kebap", "doner", "hot dog", "fried chicken", "pollo frito")) return CATEGORIES[6];
  if (has("dessert", "postre", "ice cream", "helad", "cafe", "café", "coffee", "cafeter", "bakery", "pasteler", "panader", "chocolat", "gofre", "crep")) return CATEGORIES[7];
  if (has("indian", "hindú", "hindu", "lebanese", "líban", "liban", "mexican", "mejican", "peruvian", "peruan", "arab", "árab", "turkish", "turco", "moroccan", "marroqu", "latin", "latino", "venezolan", "argentin", "colomb", "cuban", "brasil")) return CATEGORIES[9];
  if (has("spanish", "español", "espanol", "tapas", "tapeo", "mediterran", "alicant", "valencian", "tradicional", "típica", "tipica", "casera", "tabern", "bodega", "asador", "parrilla", "brasa", "jamón", "jamon", "embutid")) return CATEGORIES[0];
  return null;
}

// Imagen representativa por cocina (Unsplash, optimizado)
const CUISINE_IMAGE: Record<string, string> = {
  italian: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&q=70",
  pizza: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&q=70",
  japanese: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=70",
  sushi: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&q=70",
  asian: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=400&q=70",
  chinese: "https://images.unsplash.com/photo-1552611052-33e04de081de?w=400&q=70",
  spanish: "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400&q=70",
  paella: "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=400&q=70",
  mediterranean: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&q=70",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=70",
  american: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=70",
  mexican: "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400&q=70",
  vegan: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=70",
  vegetarian: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&q=70",
  cafe: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=70",
  coffee_shop: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&q=70",
  breakfast: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=400&q=70",
  ice_cream: "https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=400&q=70",
  kebab: "https://images.unsplash.com/photo-1561651823-34feb02250e4?w=400&q=70",
  indian: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&q=70",
  seafood: "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&q=70",
  fish: "https://images.unsplash.com/photo-1559737558-2f5a35f4523b?w=400&q=70",
  tapas: "https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=400&q=70",
  bar: "https://images.unsplash.com/photo-1515443961218-a51367888e4b?w=400&q=70",
};
const DEFAULT_FOOD_IMG = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=70";

function pickImage(c?: string) {
  if (!c) return DEFAULT_FOOD_IMG;
  const lc = c.toLowerCase();
  for (const key of Object.keys(CUISINE_IMAGE)) {
    if (lc.includes(key)) return CUISINE_IMAGE[key];
  }
  return DEFAULT_FOOD_IMG;
}

const ALICANTE_CENTER = { lat: 38.3414, lng: -0.481 };

function SelectorDeComidasPage() {
  const navigate = useNavigate();
  const { state } = useUserLocation();
  const me = state.status === "ready" ? state.coords : null;
  const origin = me ?? ALICANTE_CENTER;

  const [populares, setPopulares] = useState<RandomRestaurant[]>([]);

  useEffect(() => {
    let cancel = false;
    // Random each page load: server returns a fresh shuffle.
    getRandomRestaurantsWithPhotos()
      .then((items) => {
        if (cancel) return;
        setPopulares(items);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  const goWithPrompt = (prompt: string) => {
    try {
      window.sessionStorage.setItem("afp:pendingFoodPrompt", prompt);
    } catch {}
    navigate({ to: "/" });
  };

  const goRestaurant = (r: RandomRestaurant) => {
    goWithPrompt(`Cuéntame sobre el restaurante "${r.name}" en Alicante y cómo llegar ahora`);
  };

  return (
    <div className="h-dvh bg-[#3b2a1f] text-[#f5ead8] flex flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-2xl px-3 pt-2 pb-2 flex-1 flex flex-col min-h-0">
        <header className="flex items-center justify-between gap-2 mb-1">
          <h1 className="text-sm sm:text-base font-semibold leading-tight text-[#f5ead8]">
            Disfruta la experiencia de comer en Alicante
          </h1>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="text-xs text-[#f5ead8]/80 underline underline-offset-2 shrink-0"
          >
            ← Volver
          </button>
        </header>

        <section className="flex-1 min-h-0 grid grid-cols-2 gap-1.5 auto-rows-fr">
          {CATEGORIES.map((it) => (
            <CategoryButton key={it.label} item={it} onPick={goWithPrompt} />
          ))}
        </section>

        <section className="mt-2 shrink-0">
          {populares.length === 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-44 h-44 bg-white/10 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar snap-x">
              {populares.map((r) => {
                const km = distanceKm(origin, { lat: r.lat, lng: r.lng });
                const cat = matchCategory(r.cuisine);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => goRestaurant(r)}
                    className="relative shrink-0 w-44 h-44 snap-start text-left bg-black/30 overflow-hidden hover:shadow-md active:scale-[0.98] transition"
                  >
                    <img
                      src={r.cover_photo}
                      alt={r.name}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {cat && (
                      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 bg-black/70 text-white text-[10px] font-semibold shadow-sm">
                        <span className="text-sm leading-none">{cat.emoji}</span>
                        <span className="line-clamp-1">{cat.label}</span>
                      </div>
                    )}
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
        </section>
      </div>
    </div>
  );
}

function CategoryButton({
  item,
  onPick,
}: {
  item: Item;
  onPick: (prompt: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => item.prompt && onPick(item.prompt)}
      className="relative flex flex-col items-center justify-center rounded-2xl border bg-card hover:bg-accent/40 active:scale-[0.97] text-center shadow-sm w-full h-full overflow-hidden p-1"
    >
      <span
        className="leading-none"
        style={{ fontSize: "min(60%, 4.5rem)", lineHeight: 1 }}
      >
        <span style={{ fontSize: "clamp(2.5rem, 11vw, 5rem)" }}>{item.emoji}</span>
      </span>
      <span className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold leading-tight truncate">
        {item.label}
      </span>
    </button>
  );
}
