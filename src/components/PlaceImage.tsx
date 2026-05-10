import { useEffect, useState } from "react";
import { findPlaceOverride } from "@/data/places";

const cache = new Map<string, string | null>();

// Reject Wikipedia images that are clearly NOT a photo of the place
// (maps, flags, coats of arms, location markers, SVG diagrams, etc.)
const BAD_IMAGE_RE =
  /(\.svg($|\?))|(map|mapa|locator|location|flag|bandera|coat[_-]?of[_-]?arms|escudo|escut|wappen|blason|seal|logo|icon)/i;

function isLikelyPhoto(url: string | undefined | null): url is string {
  if (!url) return false;
  if (BAD_IMAGE_RE.test(url)) return false;
  return true;
}

async function fetchWikiImage(title: string): Promise<string | null> {
  const langs = ["es", "en"];
  for (const lang of langs) {
    try {
      // 1) Try direct page summary
      const direct = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
      );
      if (direct.ok) {
        const data = await direct.json();
        const img = data.originalimage?.source || data.thumbnail?.source;
        if (isLikelyPhoto(img)) return img;
      }

      // 2) Fallback: search the wiki, then try the top hits
      const search = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=${encodeURIComponent(
          title,
        )}`,
      );
      if (search.ok) {
        const sd = await search.json();
        const hits: { title: string }[] = sd.query?.search ?? [];
        for (const hit of hits) {
          const sum = await fetch(
            `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}?redirect=true`,
          );
          if (!sum.ok) continue;
          const data = await sum.json();
          const img = data.originalimage?.source || data.thumbnail?.source;
          if (isLikelyPhoto(img)) return img;
        }
      }
    } catch {
      // try next lang
    }
  }
  return null;
}

export function PlaceImage({ name }: { name: string }) {
  const key = name.trim().toLowerCase();
  const override = findPlaceOverride(name);
  const [src, setSrc] = useState<string | null | undefined>(
    override ? override.image : cache.get(key),
  );

  useEffect(() => {
    if (override) {
      setSrc(override.image);
      return;
    }
    if (cache.has(key)) {
      setSrc(cache.get(key)!);
      return;
    }
    let cancelled = false;
    fetchWikiImage(name).then((url) => {
      cache.set(key, url);
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [key, name, override]);

  if (override) {
    return (
      <figure className="my-1 overflow-hidden rounded-2xl shadow-soft">
        <img
          src={override.image}
          alt={override.title}
          loading="lazy"
          className="h-44 w-full object-cover"
        />
        <figcaption className="bg-card/95 px-3 py-2 text-sm">
          <span className="block font-semibold text-foreground">{override.title}</span>
          <span className="mt-0.5 block text-muted-foreground">{override.description}</span>
        </figcaption>
      </figure>
    );
  }

  if (src === undefined) {
    return (
      <div className="my-1 flex h-44 w-full animate-pulse items-center justify-center rounded-2xl bg-muted/60 text-xs text-muted-foreground">
        Buscando una foto de {name}…
      </div>
    );
  }

  if (src === null) {
    // Prefer showing nothing over showing a wrong/irrelevant image
    return null;
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      className="my-1 h-44 w-full rounded-2xl object-cover shadow-soft"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  );
}
