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
  {
    label: "Comida rápida",
    emoji: "🍔",
    submenu: [
      { label: "🍔 Hamburguesas", prompt: "Una buena hamburguesería abierta ahora (McDonald's, Burger King, TGB, Goiko, Five Guys…)" },
      { label: "🍕 Pizzas", prompt: "Una pizzería abierta ahora (Telepizza, Domino's…)" },
      { label: "🥖 Montaditos", prompt: "Un sitio de montaditos abierto ahora (100 Montaditos, Lizarrán…)" },
      { label: "🌯 Kebaps", prompt: "Un buen kebap abierto ahora" },
      { label: "🍗 Pollo frito", prompt: "Un sitio de pollo frito o pollos asados abierto ahora (KFC, Popeyes…)" },
      { label: "🌮 Comida mexicana", prompt: "Un mexicano abierto ahora (Taco Bell, tacos, burritos…)" },
    ],
  },
  { label: "Postres / Cafetería", emoji: "🍰", prompt: "Una cafetería con postres ricos abierta ahora" },
  { label: "Barato y rico", emoji: "💸", prompt: "Algo barato y rico para comer ya, abierto ahora" },
  { label: "Internacional", emoji: "🌍", prompt: "Quiero comida internacional (hindú, libanés, peruano, mexicano, latino, árabe…), ¿dónde voy ahora?" },
];

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
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-3 py-3">
        <header className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold leading-tight">🍽️ Comer</h1>
            <p className="text-[11px] text-muted-foreground">
              ¿Qué te apetece ahora en Alicante?
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="text-xs text-primary underline underline-offset-2 shrink-0"
          >
            ← Volver
          </button>
        </header>

        <section>
          <div className="grid grid-cols-3 gap-1.5">
            {CATEGORIES.map((it) => (
              <CategoryButton key={it.label} item={it} onPick={goWithPrompt} />
            ))}
          </div>
        </section>

        <section className="mt-3">
          <div className="flex items-center justify-between mb-1.5">
            <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Populares cerca de ti
            </h2>
            {populares.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{populares.length} sitios</span>
            )}
          </div>

          {populares.length === 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-28 h-28 rounded-xl bg-muted animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar snap-x">
              {populares.map((r) => {
                const km = distanceKm(origin, { lat: r.lat, lng: r.lng });
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => goRestaurant(r)}
                    className="shrink-0 w-28 snap-start text-left rounded-xl border bg-card overflow-hidden hover:shadow-md active:scale-[0.98] transition"
                  >
                    <div className="w-full h-16 bg-muted overflow-hidden">
                      <img
                        src={r.cover_photo}
                        alt={r.name}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-1.5">
                      <div className="text-[11px] font-semibold leading-tight line-clamp-1">
                        {r.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
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
  const hasSubmenu = !!item.submenu?.length;

  if (!hasSubmenu) {
    return (
      <button
        type="button"
        onClick={() => item.prompt && onPick(item.prompt)}
        className="flex flex-col items-center justify-center gap-0.5 px-1 py-2 rounded-xl border bg-card hover:bg-accent/40 active:scale-[0.97] text-center shadow-sm"
      >
        <span className="text-3xl leading-none">{item.emoji}</span>
        <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
      </button>
    );
  }

  return (
    <details className="col-span-3 rounded-xl border bg-card overflow-hidden shadow-sm">
      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer list-none">
        <span className="flex items-center gap-2">
          <span className="text-3xl leading-none">{item.emoji}</span>
          <span className="text-sm font-bold leading-tight">{item.label}</span>
        </span>
        <span className="text-[10px] text-muted-foreground">Ver opciones ▾</span>
      </summary>
      <div className="grid grid-cols-3 gap-1.5 p-1.5 border-t bg-muted/30">
        {item.submenu!.map((sub) => (
          <button
            key={sub.label}
            type="button"
            onClick={() => onPick(sub.prompt)}
            className="flex items-center justify-center gap-1 px-1 py-2 rounded-lg border bg-background hover:bg-accent/40 active:scale-[0.97] text-center"
          >
            <span className="text-[10px] font-semibold leading-tight">{sub.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
