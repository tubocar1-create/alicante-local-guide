import { useEffect, useState } from "react";
import { findPlaceOverride } from "@/data/places";
import {
  type Coords,
  type TravelMode,
  distanceKm,
  estimateMinutes,
  formatDistance,
  formatTime,
  useUserLocation,
} from "@/hooks/useUserLocation";

type WikiData = { image: string | null; coords: Coords | null };
const cache = new Map<string, WikiData>();

const BAD_IMAGE_RE =
  /(\.svg($|\?))|(map|mapa|locator|location|flag|bandera|coat[_-]?of[_-]?arms|escudo|escut|wappen|blason|seal|logo|icon)/i;

function isLikelyPhoto(url: string | undefined | null): url is string {
  if (!url) return false;
  if (BAD_IMAGE_RE.test(url)) return false;
  return true;
}

function extractCoords(data: any): Coords | null {
  const c = data?.coordinates;
  if (c && typeof c.lat === "number" && typeof c.lon === "number") {
    return { lat: c.lat, lng: c.lon };
  }
  return null;
}

async function fetchWikiData(title: string): Promise<WikiData> {
  const langs = ["es", "en"];
  for (const lang of langs) {
    try {
      const direct = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
      );
      if (direct.ok) {
        const data = await direct.json();
        const img = data.originalimage?.source || data.thumbnail?.source;
        if (isLikelyPhoto(img)) return { image: img, coords: extractCoords(data) };
      }
      const search = await fetch(
        `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=3&srsearch=${encodeURIComponent(title)}`,
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
          if (isLikelyPhoto(img)) return { image: img, coords: extractCoords(data) };
        }
      }
    } catch {
      // try next lang
    }
  }
  return { image: null, coords: null };
}

const MODES: { id: TravelMode; icon: string; label: string }[] = [
  { id: "walking", icon: "🚶", label: "A pie" },
  { id: "driving", icon: "🚗", label: "Coche" },
  { id: "transit", icon: "🚌", label: "Bus" },
];

function TravelInfo({ target }: { target: Coords | null }) {
  const { state, request } = useUserLocation();
  const [mode, setMode] = useState<TravelMode>("walking");

  useEffect(() => {
    if (state.status === "idle") request();
  }, [state.status, request]);

  if (!target) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="inline-flex rounded-full border border-border bg-muted/60 p-0.5 text-xs">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={[
              "rounded-full px-2.5 py-1 transition",
              mode === m.id
                ? "bg-background font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
            aria-pressed={mode === m.id}
          >
            <span className="mr-1">{m.icon}</span>
            {m.label}
          </button>
        ))}
      </div>

      <div className="text-xs">
        {state.status === "ready" && (() => {
          const km = distanceKm(state.coords, target);
          const min = estimateMinutes(km, mode);
          return (
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{formatDistance(km)}</span>
              {" · "}
              <span className="font-medium text-foreground">~{formatTime(min)}</span>
              <span className="ml-1 opacity-60">(estimado)</span>
            </span>
          );
        })()}
        {state.status === "loading" && (
          <span className="text-muted-foreground">Calculando distancia…</span>
        )}
        {state.status === "error" && (
          <button
            onClick={request}
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            📍 Activar ubicación para ver distancia
          </button>
        )}
      </div>
    </div>
  );
}

function mapsHref(query: string, mode: TravelMode = "walking") {
  const tm = mode === "walking" ? "walking" : mode === "driving" ? "driving" : "transit";
  return `https://www.google.com/maps/dir/?api=1&destination=${query}&travelmode=${tm}`;
}

export function PlaceImage({ name }: { name: string }) {
  const key = name.trim().toLowerCase();
  const override = findPlaceOverride(name);
  const [wiki, setWiki] = useState<WikiData | undefined>(
    override ? undefined : cache.get(key),
  );

  useEffect(() => {
    if (override) return;
    if (cache.has(key)) {
      setWiki(cache.get(key)!);
      return;
    }
    let cancelled = false;
    fetchWikiData(name).then((d) => {
      cache.set(key, d);
      if (!cancelled) setWiki(d);
    });
    return () => {
      cancelled = true;
    };
  }, [key, name, override]);

  if (override) {
    const query = encodeURIComponent(override.address || `${override.title}, Alicante`);
    return (
      <figure className="my-1 overflow-hidden rounded-2xl shadow-soft">
        <img
          src={override.image}
          alt={override.title}
          loading="lazy"
          className="h-44 w-full object-cover"
        />
        <figcaption className="bg-card/95 px-3 py-2.5 text-sm">
          <span className="block font-semibold text-foreground">{override.title}</span>
          <span className="mt-0.5 block text-muted-foreground">{override.description}</span>
          <div className="mt-2 flex flex-wrap items-center gap-y-1.5">
            <DistanceBadge target={override.coords ?? null} />
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${query}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            >
              📍 Cómo llegar
            </a>
          </div>
        </figcaption>
      </figure>
    );
  }

  if (wiki === undefined) {
    return (
      <div className="my-1 flex h-44 w-full animate-pulse items-center justify-center rounded-2xl bg-muted/60 text-xs text-muted-foreground">
        Buscando una foto de {name}…
      </div>
    );
  }

  if (!wiki.image) return null;

  const mapsQuery = encodeURIComponent(name);
  return (
    <div className="my-1 space-y-2">
      <img
        src={wiki.image}
        alt={name}
        loading="lazy"
        className="h-44 w-full rounded-2xl object-cover shadow-soft"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="flex flex-wrap items-center gap-y-1.5">
        <DistanceBadge target={wiki.coords} />
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
        >
          📍 Cómo llegar
        </a>
      </div>
    </div>
  );
}
