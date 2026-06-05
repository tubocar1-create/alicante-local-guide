import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import {
  getRandomRestaurantsWithPhotos,
  type RandomRestaurant,
} from "@/lib/restaurants.functions";

export type FoodItem = {
  label: string;
  emoji: string;
  prompt?: string;
  to?: string;
};

type Props = {
  title: string;
  categories: FoodItem[];
  cuisineKeys?: string[];
  backTo?: string;
  /** Categories used to label each carousel card */
  badgeCategories?: { keys: string[]; label: string; emoji: string }[];
  /** Tailwind bg class for page background */
  bgClass?: string;
};

const ALICANTE_CENTER = { lat: 38.3414, lng: -0.481 };

function matchBadge(
  cuisine: string | null,
  badges: Props["badgeCategories"],
): { label: string; emoji: string } | null {
  if (!badges) return null;
  const c = (cuisine ?? "").toLowerCase().trim();
  if (!c) return null;
  for (const b of badges) {
    if (b.keys.some((k) => c.includes(k.toLowerCase()))) {
      return { label: b.label, emoji: b.emoji };
    }
  }
  return null;
}

export default function FoodSelector({
  title,
  categories,
  cuisineKeys,
  backTo = "/",
  badgeCategories,
  bgClass = "bg-[#d9bd87]",
}: Props) {
  const navigate = useNavigate();
  const { state } = useUserLocation();
  const me = state.status === "ready" ? state.coords : null;
  const origin = me ?? ALICANTE_CENTER;

  const [populares, setPopulares] = useState<RandomRestaurant[]>([]);

  useEffect(() => {
    let cancel = false;
    const payload: { lat?: number; lng?: number; cuisineKeys?: string[] } = {};
    if (me) {
      payload.lat = me.lat;
      payload.lng = me.lng;
    }
    if (cuisineKeys && cuisineKeys.length) payload.cuisineKeys = cuisineKeys;

    getRandomRestaurantsWithPhotos({ data: payload })
      .then((items) => {
        if (!cancel) setPopulares(items);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [me?.lat, me?.lng, cuisineKeys?.join("|")]);

  const handlePick = (it: FoodItem) => {
    if (it.to) {
      navigate({ to: it.to });
      return;
    }
    if (it.prompt) {
      try {
        window.sessionStorage.setItem("afp:pendingFoodPrompt", it.prompt);
      } catch {}
      navigate({ to: "/" });
    }
  };

  const goRestaurant = (r: RandomRestaurant) => {
    navigate({ to: "/restaurants/$placeId", params: { placeId: r.id } });
  };

  return (
    <div className="h-dvh bg-[#d9bd87] text-[#2c1810] flex flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-2xl px-3 pt-2 pb-2 flex-1 flex flex-col min-h-0">
        <header className="flex items-center justify-between gap-2 mb-1">
          <h1 className="text-sm sm:text-base font-semibold leading-tight text-[#2c1810]">
            {title}
          </h1>
          <button
            type="button"
            onClick={() => navigate({ to: backTo })}
            className="text-xs text-[#2c1810]/80 underline underline-offset-2 shrink-0"
          >
            ← Volver
          </button>
        </header>

        <section className="flex-1 min-h-0 grid grid-cols-2 gap-1.5 auto-rows-fr">
          {categories.map((it) => (
            <CategoryButton key={it.label} item={it} onPick={handlePick} />
          ))}
        </section>

        <section className="mt-5 shrink-0">
          {populares.length === 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-44 h-44 bg-black/10 animate-pulse"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar snap-x">
              {populares.map((r) => {
                const km = distanceKm(origin, { lat: r.lat, lng: r.lng });
                const cat = matchBadge(r.cuisine, badgeCategories);
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
  item: FoodItem;
  onPick: (item: FoodItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className="relative flex flex-col items-center justify-center rounded-2xl border bg-card hover:bg-accent/40 active:scale-[0.97] text-center shadow-sm w-full h-full overflow-hidden p-1"
    >
      <span className="leading-none" style={{ lineHeight: 1 }}>
        <span style={{ fontSize: "clamp(2.5rem, 11vw, 5rem)" }}>{item.emoji}</span>
      </span>
      <span className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold leading-tight truncate">
        {item.label}
      </span>
    </button>
  );
}
