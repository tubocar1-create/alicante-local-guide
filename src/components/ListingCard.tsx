import { useEffect, useState } from "react";
import {
  Heart,
  Navigation,
  Phone,
  Globe,
  Star,
  Ticket,
  Sparkles,
  MapPin,
  Footprints,
} from "lucide-react";
import { type Listing } from "@/lib/overpass-listings";
import { distanceKm, formatDistance, type Coords } from "@/hooks/useUserLocation";

const BAD_IMAGE_RE =
  /(\.svg($|\?))|(map|mapa|locator|location|flag|bandera|coat[_-]?of[_-]?arms|escudo|seal|logo|icon)/i;

const imgCache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function fetchWikiImage(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (imgCache.has(key)) return imgCache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = (async () => {
    for (const lang of ["es", "en"]) {
      try {
        const r = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}?redirect=true`,
        );
        if (!r.ok) continue;
        const d = await r.json();
        const img: string | undefined = d.originalimage?.source || d.thumbnail?.source;
        if (img && !BAD_IMAGE_RE.test(img)) return img;
      } catch {
        // try next
      }
    }
    return null;
  })().then((v) => {
    imgCache.set(key, v);
    inflight.delete(key);
    return v;
  });
  inflight.set(key, p);
  return p;
}

function kindLabel(it: Listing) {
  const k = it.kind.replace(/_/g, " ");
  return it.cuisine ? `${k} · ${it.cuisine.replace(/;/g, ", ")}` : k;
}

function walkMinutes(km: number) {
  // ~5 km/h walking pace
  return Math.max(1, Math.round((km / 5) * 60));
}

type Props = {
  it: Listing;
  me: Coords | null;
  onWantToGo: (it: Listing) => void;
};

export function ListingCard({ it, me, onWantToGo }: Props) {
  const [img, setImg] = useState<string | null | undefined>(() =>
    imgCache.get(it.name.trim().toLowerCase()),
  );
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (img !== undefined) return;
    let cancelled = false;
    fetchWikiImage(it.name).then((v) => {
      if (!cancelled) setImg(v);
    });
    return () => {
      cancelled = true;
    };
  }, [it.name, img]);

  const dist = me ? distanceKm(me, { lat: it.lat, lng: it.lon }) : null;
  const minutes = dist != null ? walkMinutes(dist) : null;
  const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${it.lat},${it.lon}`;
  const wikiSlug = it.wikipedia?.split(":")[1];

  return (
    <article className="group rounded-3xl bg-card overflow-hidden border border-border/60 shadow-soft transition active:scale-[0.99]">
      {/* Hero image */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-secondary to-accent/40">
        {img ? (
          <img
            src={img}
            alt={it.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.03]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : img === null ? (
          <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40">
            🏝️
          </div>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-muted" />
        )}

        {/* Promo / want-to-go badge (top-left) */}
        <button
          type="button"
          onClick={() => onWantToGo(it)}
          className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full gradient-warm px-3 py-1.5 text-[11px] font-bold text-primary-foreground shadow-md backdrop-blur"
        >
          <Ticket className="h-3 w-3" />
          Quiero ir
        </button>

        {/* Heart (top-right) */}
        <button
          type="button"
          onClick={() => setLiked((v) => !v)}
          aria-label="Guardar favorito"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-card/90 backdrop-blur shadow-sm active:scale-90"
        >
          <Heart
            className={`h-4 w-4 transition ${
              liked ? "fill-primary text-primary" : "text-foreground/70"
            }`}
          />
        </button>

        {/* Distance pill (bottom-left over image) */}
        {dist != null && (
          <div className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-semibold shadow-sm">
            <Footprints className="h-3 w-3 text-primary" />
            {minutes} min · {formatDistance(dist)}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-[17px] font-semibold leading-tight tracking-tight">
            {it.name}
          </h3>
          {it.stars ? (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-foreground shrink-0">
              <Star className="h-3 w-3 fill-current" />
              {it.stars}
            </span>
          ) : null}
        </div>

        <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className="capitalize truncate">{kindLabel(it)}</span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
            Abierto
          </span>
        </div>

        {it.address && (
          <div className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="truncate">{it.address}</span>
          </div>
        )}

        {/* Action chips */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
          >
            <Navigation className="h-3 w-3" /> Cómo llegar
          </a>
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent(it.name + " Alicante reseñas")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground"
          >
            <Sparkles className="h-3 w-3" /> Reseñas
          </a>
          {it.phone && (
            <a
              href={`tel:${it.phone}`}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground"
            >
              <Phone className="h-3 w-3" /> Llamar
            </a>
          )}
          {it.website && (
            <a
              href={it.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground"
            >
              <Globe className="h-3 w-3" /> Web
            </a>
          )}
          {wikiSlug && (
            <a
              href={`https://es.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-medium text-secondary-foreground"
            >
              Wiki
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
