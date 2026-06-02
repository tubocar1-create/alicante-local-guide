import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBusEngine } from "@/hooks/useBusEngine";
import { predictLineState } from "@/lib/bus-engine/predict";
import { getActiveFleet, tickVirtualFleet } from "@/lib/bus-fleet.functions";
import busAlicanteImg from "@/assets/bus-alicante.png";

export type LineStopPoint = {
  code: string;
  name: string;
  direction: 1 | 2;
  seq: number;
  lat: number;
  lng: number;
};

type RenderedBus = {
  key: string;
  lat: number;
  lng: number;
  destination: string;
  direction: 1 | 2;
  confidence: number;
};

function busIcon(line: string, confidence: number) {
  const opacity = Math.max(0.6, Math.min(1, confidence));
  // Autobusito rojo de Alicante (mismo asset usado en las paradas) montado
  // sobre un disco blanco para destacarlo sobre cualquier tile del mapa.
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;width:40px;height:40px;border-radius:9999px;background:white;border:2px solid #b91c1c;box-shadow:0 3px 10px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;opacity:${opacity}"><img src="${busAlicanteImg}" alt="" style="width:30px;height:30px;object-fit:contain;pointer-events:none"/><span style="position:absolute;right:-4px;bottom:-4px;background:#b91c1c;color:white;font:800 10px/1 system-ui,sans-serif;padding:2px 5px;border-radius:6px;border:1.5px solid white">${line}</span></div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}


const userIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10b981;color:white;width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const ALC: [number, number] = [38.3452, -0.481];
// El motor ya interpola posición linealmente dentro del segmento actual
// usando el reloj real. Recalculando ~3 Hz el bus se desliza fluido sobre
// la polilínea sin necesidad de animación rAF separada.
const TICK_MS = 333;

export function BusLineLiveMap({
  lineCode,
  color,
  stops,
  user,
}: {
  lineCode: string;
  color: string;
  stops: LineStopPoint[];
  user: { lat: number; lng: number } | null;
}) {
  const { data: engine } = useBusEngine();

  const ida = useMemo(
    () => stops.filter((s) => s.direction === 1).sort((a, b) => a.seq - b.seq),
    [stops],
  );
  const vuelta = useMemo(
    () => stops.filter((s) => s.direction === 2).sort((a, b) => a.seq - b.seq),
    [stops],
  );

  const [renderedBuses, setRenderedBuses] = useState<RenderedBus[]>([]);

  useEffect(() => {
    if (!engine) return;
    const orderedByDir: Record<1 | 2, LineStopPoint[]> = { 1: ida, 2: vuelta };

    const recompute = () => {
      const state = predictLineState(engine, lineCode, new Date());
      const next: RenderedBus[] = [];
      for (const b of state.buses) {
        if (b.status !== "moving" || !b.position) continue;
        const ordered = orderedByDir[b.direction];
        const dest = ordered[ordered.length - 1]?.name ?? "";
        next.push({
          key: b.busId,
          lat: b.position.lat,
          lng: b.position.lng,
          destination: dest,
          direction: b.direction,
          confidence: b.confidence,
        });
      }
      setRenderedBuses(next);
    };

    recompute();
    const id = setInterval(recompute, TICK_MS);
    return () => clearInterval(id);
  }, [engine, lineCode, ida, vuelta]);

  const center = useMemo<[number, number]>(() => {
    if (user) return [user.lat, user.lng];
    if (ida.length) return [ida[Math.floor(ida.length / 2)].lat, ida[Math.floor(ida.length / 2)].lng];
    if (vuelta.length) return [vuelta[0].lat, vuelta[0].lng];
    return ALC;
  }, [user, ida, vuelta]);

  const idaPath = useMemo<[number, number][]>(() => ida.map((s) => [s.lat, s.lng]), [ida]);
  const vueltaPath = useMemo<[number, number][]>(() => vuelta.map((s) => [s.lat, s.lng]), [vuelta]);

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-2xl border border-white/10">
      <MapContainer center={center} zoom={13} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {idaPath.length > 1 && (
          <Polyline positions={idaPath} pathOptions={{ color, weight: 4, opacity: 0.85 }} />
        )}
        {vueltaPath.length > 1 && (
          <Polyline positions={vueltaPath} pathOptions={{ color, weight: 4, opacity: 0.55, dashArray: "6 6" }} />
        )}
        {stops.map((s) => (
          <CircleMarker
            key={`${s.direction}-${s.code}-${s.seq}`}
            center={[s.lat, s.lng]}
            radius={3}
            pathOptions={{ color: "white", fillColor: color, fillOpacity: 1, weight: 1 }}
          >
            <Popup>
              <strong>{s.name}</strong>
              <br />
              <span>Parada {s.code} · {s.direction === 1 ? "Ida" : "Vuelta"}</span>
            </Popup>
          </CircleMarker>
        ))}
        {user && <Marker position={[user.lat, user.lng]} icon={userIcon} />}
        {renderedBuses.map((b) => (
          <Marker key={b.key} position={[b.lat, b.lng]} icon={busIcon(lineCode, b.confidence)}>
            <Popup>
              <strong>Línea {lineCode}</strong>
              <br />
              <span>→ {b.destination}</span>
              <br />
              <span>{b.direction === 1 ? "Ida" : "Vuelta"} · estimado</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
        {renderedBuses.length} bus{renderedBuses.length === 1 ? "" : "es"} estimado{renderedBuses.length === 1 ? "" : "s"}
      </div>
    </div>
  );
}
