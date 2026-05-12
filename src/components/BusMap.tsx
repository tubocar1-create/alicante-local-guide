import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { liveStopUrl } from "@/lib/bus";
import type { Coords } from "@/hooks/useUserLocation";

// Fix Leaflet default icon paths (Vite/SSR safe).
const busIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));width:22px;height:22px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.25);border:2px solid white">B</div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export type MapStop = {
  code: string;
  name: string | null;
  lines: string[] | null;
  lat: number;
  lng: number;
};

export type LineRoute = {
  lineCode: string;
  direction: number;
  color: string;
  points: [number, number][];
};

const ALC: [number, number] = [38.3452, -0.481];

export function BusMap({
  stops,
  user,
  routes = [],
}: {
  stops: MapStop[];
  user: Coords | null;
  routes?: LineRoute[];
}) {
  const center = useMemo<[number, number]>(() => {
    if (user) return [user.lat, user.lng];
    if (stops.length) return [stops[0].lat, stops[0].lng];
    return ALC;
  }, [user, stops]);

  // Force re-mount key when center materially changes
  const [key, setKey] = useState(0);
  useEffect(() => setKey((k) => k + 1), [user?.lat, user?.lng]);

  return (
    <div className="h-[420px] w-full overflow-hidden rounded-xl border">
      <MapContainer
        key={key}
        center={center}
        zoom={user ? 15 : 14}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {user && (
          <CircleMarker
            center={[user.lat, user.lng]}
            radius={8}
            pathOptions={{ color: "#2563eb", fillColor: "#3b82f6", fillOpacity: 0.7 }}
          >
            <Popup>Tú estás aquí</Popup>
          </CircleMarker>
        )}
        {stops.map((s) => (
          <Marker key={s.code} position={[s.lat, s.lng]} icon={busIcon}>
            <Popup>
              <div className="space-y-1">
                <div className="font-semibold">
                  {s.code} · {s.name}
                </div>
                {s.lines && s.lines.length > 0 && (
                  <div className="text-xs">Líneas: {s.lines.join(", ")}</div>
                )}
                <a
                  className="text-xs text-primary underline"
                  href={liveStopUrl(s.code)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver próximos buses →
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}
