import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const stopIcon = L.divIcon({
  className: "",
  html: `<div style="background:hsl(var(--primary));color:hsl(var(--primary-foreground));width:24px;height:24px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:12px;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid white">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function busIcon(line: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:#0ea5e9;color:white;min-width:28px;height:24px;padding:0 6px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid white">🚌${line}</div>`,
    iconSize: [40, 24],
    iconAnchor: [20, 12],
  });
}

type Bus = {
  line: string;
  destination: string;
  etaMin: number;
  lat: number;
  lng: number;
};

function FitBounds({ stop, buses }: { stop: { lat: number; lng: number }; buses: Bus[] }) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [[stop.lat, stop.lng], ...buses.map((b) => [b.lat, b.lng] as [number, number])];
    if (points.length === 1) {
      map.setView(points[0], 16);
    } else {
      map.fitBounds(points, { padding: [40, 40], maxZoom: 16 });
    }
  }, [map, stop.lat, stop.lng, buses]);
  return null;
}

export function RealtimeMiniMap({
  stop,
  buses,
}: {
  stop: { lat: number; lng: number; name: string | null; code: string };
  buses: Bus[];
}) {
  // Stable mount key per stop so the map doesn't re-mount on every poll.
  const mountKey = useMemo(() => `${stop.code}`, [stop.code]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  return (
    <div ref={containerRef} className="h-[280px] w-full overflow-hidden rounded-xl border">
      <MapContainer
        key={mountKey}
        center={[stop.lat, stop.lng]}
        zoom={16}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <CircleMarker
          center={[stop.lat, stop.lng]}
          radius={10}
          pathOptions={{ color: "hsl(var(--primary))", fillColor: "hsl(var(--primary))", fillOpacity: 0.25 }}
        />
        <Marker position={[stop.lat, stop.lng]} icon={stopIcon}>
          <Popup>
            <strong>
              {stop.code}
              {stop.name ? ` · ${stop.name}` : ""}
            </strong>
          </Popup>
        </Marker>
        {buses.map((b, i) => (
          <Marker key={`${b.line}-${i}-${b.lat}-${b.lng}`} position={[b.lat, b.lng]} icon={busIcon(b.line)}>
            <Popup>
              <div className="space-y-0.5">
                <div className="font-semibold">Línea {b.line}</div>
                <div className="text-xs">→ {b.destination}</div>
                <div className="text-xs">Llega en {b.etaMin} min</div>
              </div>
            </Popup>
          </Marker>
        ))}
        <FitBounds stop={stop} buses={buses} />
      </MapContainer>
    </div>
  );
}
