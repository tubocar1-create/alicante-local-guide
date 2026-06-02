import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useBusEngine } from "@/hooks/useBusEngine";
import { predictLineState } from "@/lib/bus-engine/predict";

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

function busIcon(line: string, color: string, confidence: number) {
  const opacity = Math.max(0.55, Math.min(1, confidence));
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;min-width:30px;height:24px;padding:0 6px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.45);border:2px solid white;opacity:${opacity}">🚌${line}</div>`,
    iconSize: [44, 24],
    iconAnchor: [22, 12],
  });
}

const userIcon = L.divIcon({
  className: "",
  html: `<div style="background:#10b981;color:white;width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const ALC: [number, number] = [38.3452, -0.481];
const TICK_MS = 15_000;

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

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

  // Mantener prev/curr de cada bus para interpolación rAF entre ticks.
  const prevRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const currRef = useRef<Map<string, { lat: number; lng: number; destination: string; direction: 1 | 2; confidence: number }>>(new Map());
  const tickAtRef = useRef<number>(Date.now());
  const [, setFrame] = useState(0);

  // Tick predictivo cada TICK_MS
  useEffect(() => {
    if (!engine) return;
    let cancelled = false;

    const recompute = () => {
      const state = predictLineState(engine, lineCode, new Date());
      const next = new Map<string, { lat: number; lng: number; destination: string; direction: 1 | 2; confidence: number }>();
      const orderedByDir: Record<1 | 2, LineStopPoint[]> = { 1: ida, 2: vuelta };
      for (const b of state.buses) {
        if (b.status !== "moving") continue;
        if (!b.position) continue;
        const ordered = orderedByDir[b.direction];
        const dest = ordered[ordered.length - 1]?.name ?? "";
        next.set(b.busId, {
          lat: b.position.lat,
          lng: b.position.lng,
          destination: dest,
          direction: b.direction,
          confidence: b.confidence,
        });
      }
      // prev = curr antes de pisar
      const newPrev = new Map<string, { lat: number; lng: number }>();
      for (const [id, c] of next) {
        const prevCurr = currRef.current.get(id);
        newPrev.set(id, prevCurr ? { lat: prevCurr.lat, lng: prevCurr.lng } : { lat: c.lat, lng: c.lng });
      }
      prevRef.current = newPrev;
      currRef.current = next;
      tickAtRef.current = Date.now();
      setFrame((f) => f + 1);
    };

    recompute();
    const id = setInterval(recompute, TICK_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
      void cancelled;
    };
  }, [engine, lineCode, ida, vuelta]);

  // rAF para interpolación visual
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const renderedBuses: RenderedBus[] = useMemo(() => {
    const now = Date.now();
    const t = Math.min(1, (now - tickAtRef.current) / TICK_MS);
    const out: RenderedBus[] = [];
    for (const [id, c] of currRef.current) {
      const p = prevRef.current.get(id) ?? { lat: c.lat, lng: c.lng };
      out.push({
        key: id,
        lat: lerpNum(p.lat, c.lat, t),
        lng: lerpNum(p.lng, c.lng, t),
        destination: c.destination,
        direction: c.direction,
        confidence: c.confidence,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [/* re-render via setFrame */]);

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
          <Marker key={b.key} position={[b.lat, b.lng]} icon={busIcon(lineCode, color, b.confidence)}>
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
