import { useEffect, useMemo, useState } from "react";
import { Loader2, Navigation, MapPin, Star, X, Phone, Globe } from "lucide-react";
import { fetchListings, type Listing } from "@/lib/overpass-listings";
import { useUserLocation, distanceKm, formatDistance } from "@/hooks/useUserLocation";

type Cuisine = {
  key: string;
  label: string;
  emoji: string;
  // OSM cuisine values that match (lowercase, matched as substring)
  match: string[];
  // Overpass amenity kinds to query
  amenities: ("restaurant" | "bar" | "cafe" | "fast_food" | "pub" | "ice_cream")[];
};

const CUISINES: Cuisine[] = [
  { key: "any", label: "Lo que sea", emoji: "🤷", match: [], amenities: ["restaurant", "bar", "cafe"] },
  { key: "spanish", label: "Española / Tapas", emoji: "🥘", match: ["spanish", "mediterranean", "tapas", "regional"], amenities: ["restaurant", "bar"] },
  { key: "seafood", label: "Marisco / Arroces", emoji: "🦐", match: ["seafood", "fish", "paella", "rice"], amenities: ["restaurant"] },
  { key: "italian", label: "Italiana / Pizza", emoji: "🍕", match: ["italian", "pizza", "pasta"], amenities: ["restaurant", "fast_food"] },
  { key: "asian", label: "Asiática", emoji: "🍜", match: ["asian", "japanese", "sushi", "chinese", "thai", "vietnamese", "korean", "ramen"], amenities: ["restaurant"] },
  { key: "burger", label: "Burgers / Fast", emoji: "🍔", match: ["burger", "american"], amenities: ["fast_food", "restaurant"] },
  { key: "vegan", label: "Vegano / Sano", emoji: "🥗", match: ["vegan", "vegetarian", "healthy", "salad"], amenities: ["restaurant", "cafe"] },
  { key: "cafe", label: "Café / Desayuno", emoji: "☕", match: ["coffee", "breakfast", "bakery", "cake"], amenities: ["cafe"] },
  { key: "drinks", label: "Algo de beber", emoji: "🍻", match: [], amenities: ["bar", "pub"] },
  { key: "sweet", label: "Dulce / Helado", emoji: "🍦", match: ["ice_cream", "dessert", "cake"], amenities: ["ice_cream", "cafe"] },
];

type Props = { onClose: () => void };

function openExternal(url: string) {
  try {
    const topWindow = window.top ?? window;
    const opened = topWindow.open(url, "_blank", "noopener,noreferrer");
    if (opened) return;
  } catch {
    // If the preview frame blocks access to the top window, try the current one.
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) return;

  try {
    navigator.clipboard?.writeText(url);
  } catch {
    // Clipboard may be unavailable; the message below still explains what happened.
  }
  alert("Tu navegador ha bloqueado la ventana nueva. Te he copiado el enlace para que lo pegues en otra pestaña 💛");
}

export function EatNearby({ onClose }: Props) {
  const { state, request } = useUserLocation();
  const me = state.status === "ready" ? state.coords : null;
  const [picked, setPicked] = useState<Cuisine | null>(null);
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(4);

  useEffect(() => {
    if (!picked || !me) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVisible(4);
    fetchListings(picked.amenities.map((a) => ({ tag: "amenity", value: a })))
      .then((d) => !cancelled && setItems(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [picked, me]);

  const top10 = useMemo(() => {
    if (!me || !picked) return [];
    let arr = items;
    if (picked.match.length > 0) {
      arr = arr.filter((i) => {
        const c = (i.cuisine || "").toLowerCase();
        return picked.match.some((m) => c.includes(m));
      });
      // If filtering gives too few, fallback to unfiltered amenity results
      if (arr.length < 6) arr = items;
    }
    return [...arr]
      .map((i) => ({ i, d: distanceKm(me, { lat: i.lat, lng: i.lon }) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 10);
  }, [items, me, picked]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative w-full sm:max-w-lg max-h-[92dvh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-card shadow-soft flex flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b">
          <div>
            <h2 className="text-base font-semibold leading-tight">🍽️ Comer cerca de ti</h2>
            <p className="text-xs text-muted-foreground">
              Te enseño máximo 10 sitios a un paso
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="h-9 w-9 rounded-full bg-muted hover:bg-accent flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="overflow-y-auto px-4 py-4 flex-1">
          {/* Step 1: location */}
          {!me && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">📍</div>
              <h3 className="font-semibold">Oye, ¿me dejas verte en el mapa?</h3>
              <p className="text-sm text-muted-foreground mt-1 px-4">
                Solo así te puedo recomendar lo más rico que tengas al lado. Prometo no
                guardar nada 💛
              </p>
              <button
                onClick={request}
                disabled={state.status === "loading"}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-full gradient-warm text-primary-foreground shadow-soft active:scale-95 disabled:opacity-60"
              >
                <Navigation className="w-4 h-4" />
                {state.status === "loading" ? "Buscándote…" : "Compartir mi ubicación"}
              </button>
              {state.status === "error" && (
                <p className="text-xs text-destructive mt-3">{state.message}</p>
              )}
            </div>
          )}

          {/* Step 2: cuisine */}
          {me && !picked && (
            <div>
              <p className="text-sm">
                ¡Genial, ya te tengo! 🙌 Cuéntame, <strong>¿qué te apetece comer ahora mismo?</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Elige lo que te tire más, no hace falta pensarlo mucho 😉
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {CUISINES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setPicked(c)}
                    className="flex items-center gap-2 px-3 py-3 rounded-2xl border bg-background hover:bg-accent/40 active:scale-[0.98] text-left"
                  >
                    <span className="text-xl">{c.emoji}</span>
                    <span className="text-sm font-medium leading-tight">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: results */}
          {me && picked && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm">
                  Va, lo mejor de <strong>{picked.label.toLowerCase()}</strong> cerquita de ti
                  ✨
                </p>
                <button
                  onClick={() => setPicked(null)}
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Cambiar
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando los mejores…
                </div>
              )}
              {error && (
                <div className="text-sm text-destructive py-4">No pude cargarlo: {error}</div>
              )}
              {!loading && !error && top10.length === 0 && (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  Uy, no veo nada de eso aquí al lado. Prueba otra opción 🙃
                </div>
              )}

              <ul className="flex flex-col gap-3">
                {top10.map(({ i, d }, idx) => {
                  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${i.lat},${i.lon}`;
                  const reviewsHref = `https://www.google.com/search?q=${encodeURIComponent(
                    `${i.name} Alicante reseñas`,
                  )}`;
                  const tripHref = `https://www.tripadvisor.es/Search?q=${encodeURIComponent(
                    `${i.name} Alicante`,
                  )}`;
                  return (
                    <li
                      key={i.id}
                      className="rounded-2xl bg-background border p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-sm leading-tight truncate">
                            <span className="text-muted-foreground mr-1">{idx + 1}.</span>
                            {i.name}
                          </h4>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                            {i.kind.replace(/_/g, " ")}
                            {i.cuisine ? ` · ${i.cuisine.replace(/;/g, ", ")}` : ""}
                          </div>
                        </div>
                        <span className="text-[11px] font-medium bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 shrink-0">
                          📍 {formatDistance(d)}
                        </span>
                      </div>

                      {i.address && (
                        <div className="text-xs text-muted-foreground flex items-start gap-1">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="truncate">{i.address}</span>
                        </div>
                      )}

                      {i.stars ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="w-3 h-3 fill-current text-amber-500" />
                          <span className="font-medium">{i.stars}</span>
                          <span className="text-muted-foreground">según OSM</span>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => openExternal(reviewsHref)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary text-primary-foreground active:scale-95"
                        >
                          ⭐ Reseñas Google
                        </button>
                        <button
                          type="button"
                          onClick={() => openExternal(tripHref)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground active:scale-95"
                        >
                          🦉 TripAdvisor
                        </button>
                        <button
                          type="button"
                          onClick={() => openExternal(mapsHref)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground active:scale-95"
                        >
                          <Navigation className="w-3 h-3" /> Cómo llegar
                        </button>
                        {i.phone && (
                          <a
                            href={`tel:${i.phone}`}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground"
                          >
                            <Phone className="w-3 h-3" /> Llamar
                          </a>
                        )}
                        {i.website && (
                          <button
                            type="button"
                            onClick={() => openExternal(i.website!)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground"
                          >
                            <Globe className="w-3 h-3" /> Web
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
