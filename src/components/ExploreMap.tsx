import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  fetchPois,
  CATEGORY_LABEL,
  CATEGORY_EMOJI,
  type Poi,
  type PoiCategory,
} from "@/lib/overpass";
import { useUserLocation } from "@/hooks/useUserLocation";
import { Loader2, Navigation } from "lucide-react";

const ALL_CATEGORIES: PoiCategory[] = [
  "cultural",
  "hiking",
  "beaches",
  "viewpoints",
  "attractions",
  "guides",
];

const CATEGORY_COLOR: Record<PoiCategory, string> = {
  cultural: "#a85a2a",
  hiking: "#3a7d3a",
  beaches: "#1f8fbf",
  viewpoints: "#7a3aa8",
  attractions: "#d09022",
  guides: "#555",
};

function makeIcon(cat: PoiCategory) {
  const color = CATEGORY_COLOR[cat];
  const emoji = CATEGORY_EMOJI[cat];
  return L.divIcon({
    className: "alc-marker",
    html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff;"><span style="transform:rotate(45deg);font-size:14px;line-height:1">${emoji}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });
}

function userIcon() {
  return L.divIcon({
    className: "alc-user-marker",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 3px rgba(37,99,235,.3)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function FlyToUser({ coords }: { coords: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo([coords.lat, coords.lon], 13, { duration: 0.8 });
  }, [coords, map]);
  return null;
}

function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function ExploreMap() {
  const [active, setActive] = useState<Set<PoiCategory>>(
    new Set(["cultural", "beaches", "viewpoints"]),
  );
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lon: number } | null>(null);
  const { coords, request, status } = useUserLocation();

  useEffect(() => {
    let cancelled = false;
    const cats = Array.from(active);
    if (cats.length === 0) {
      setPois([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchPois(cats)
      .then((data) => {
        if (!cancelled) setPois(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error cargando puntos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  function toggle(cat: PoiCategory) {
    setActive((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  const icons = useMemo(() => {
    const m = new Map<PoiCategory, L.DivIcon>();
    ALL_CATEGORIES.forEach((c) => m.set(c, makeIcon(c)));
    return m;
  }, []);

  return (
    <div className="flex flex-col h-[100dvh]">
      <header className="px-4 py-3 border-b bg-card/80 backdrop-blur sticky top-0 z-[1000]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold leading-tight">Explora Alicante</h1>
            <p className="text-xs text-muted-foreground">
              Datos reales de OpenStreetMap · {pois.length} sitios
            </p>
          </div>
          <button
            onClick={() => {
              if (coords) {
                setFlyTarget({ ...coords });
              } else {
                request();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full bg-primary text-primary-foreground active:scale-95 transition"
          >
            <Navigation className="w-3.5 h-3.5" />
            {coords ? "Centrar en mí" : status === "loading" ? "Buscando…" : "Mi ubicación"}
          </button>
        </div>
        <div className="flex gap-2 mt-3 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
          {ALL_CATEGORIES.map((cat) => {
            const on = active.has(cat);
            return (
              <button
                key={cat}
                onClick={() => toggle(cat)}
                className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                  on
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-muted"
                }`}
                style={
                  on
                    ? { backgroundColor: CATEGORY_COLOR[cat], borderColor: CATEGORY_COLOR[cat] }
                    : undefined
                }
              >
                <span>{CATEGORY_EMOJI[cat]}</span>
                {CATEGORY_LABEL[cat]}
              </button>
            );
          })}
        </div>
        {loading && (
          <div className="absolute top-full left-0 right-0 flex justify-center mt-2 pointer-events-none">
            <span className="inline-flex items-center gap-2 text-xs bg-card shadow-soft border rounded-full px-3 py-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando puntos…
            </span>
          </div>
        )}
        {error && (
          <div className="mt-2 text-xs text-destructive">No se pudieron cargar puntos: {error}</div>
        )}
      </header>

      <div className="flex-1 relative">
        <MapContainer
          center={[38.345, -0.481]}
          zoom={11}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {coords && (
            <Marker position={[coords.lat, coords.lon]} icon={userIcon()}>
              <Popup>Estás aquí</Popup>
            </Marker>
          )}
          <FlyToUser coords={flyTarget} />
          {pois.map((p) => {
            const dist = coords ? distanceKm(coords, { lat: p.lat, lon: p.lon }) : null;
            const wikiSlug = p.tags.wikipedia?.split(":")[1];
            return (
              <Marker
                key={p.id}
                position={[p.lat, p.lon]}
                icon={icons.get(p.category)!}
              >
                <Popup>
                  <div className="space-y-1.5 min-w-[180px]">
                    <div className="font-semibold text-sm">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground capitalize">
                      {CATEGORY_EMOJI[p.category]} {CATEGORY_LABEL[p.category]}
                      {p.subtype ? ` · ${p.subtype.replace(/_/g, " ")}` : ""}
                    </div>
                    {dist != null && (
                      <div className="text-[11px] text-muted-foreground">
                        📍 a {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`}{" "}
                        de ti
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <a
                        className="text-[11px] font-medium underline text-primary"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Cómo llegar
                      </a>
                      {wikiSlug && (
                        <a
                          className="text-[11px] font-medium underline text-primary"
                          href={`https://es.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Wikipedia
                        </a>
                      )}
                      {p.tags.website && (
                        <a
                          className="text-[11px] font-medium underline text-primary"
                          href={p.tags.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Web
                        </a>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
