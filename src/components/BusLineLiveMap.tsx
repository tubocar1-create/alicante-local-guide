import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getClientStopRealtime } from "@/lib/bus-realtime-client";

export type LineStopPoint = {
  code: string;
  name: string;
  direction: 1 | 2;
  seq: number;
  lat: number;
  lng: number;
};

type BusMarker = {
  key: string;
  lat: number;
  lng: number;
  destination: string;
  etaMin: number;
};

function busIcon(line: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:white;min-width:30px;height:24px;padding:0 6px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,.45);border:2px solid white">🚌${line}</div>`,
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
  const ida = useMemo(
    () => stops.filter((s) => s.direction === 1).sort((a, b) => a.seq - b.seq),
    [stops],
  );
  const vuelta = useMemo(
    () => stops.filter((s) => s.direction === 2).sort((a, b) => a.seq - b.seq),
    [stops],
  );

  // Sample evenly along the line to get bus positions without hammering the proxy.
  const sampledStops = useMemo(() => {
    const out: string[] = [];
    const pickEvery = (list: LineStopPoint[], n: number) => {
      if (list.length === 0) return;
      const step = Math.max(1, Math.floor(list.length / n));
      for (let i = 0; i < list.length; i += step) out.push(list[i].code);
    };
    pickEvery(ida, 5);
    pickEvery(vuelta, 5);
    return Array.from(new Set(out));
  }, [ida, vuelta]);

  const [buses, setBuses] = useState<BusMarker[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sampledStops.length === 0) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      setLoading(true);
      const results = await Promise.allSettled(
        sampledStops.map((stopCode) =>
          getClientStopRealtime({ stopId: stopCode, line: lineCode }),
        ),
      );
      if (cancelled) return;
      const map = new Map<string, BusMarker>();
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        for (const a of r.value.arrivals) {
          if (a.line !== lineCode) continue;
          if (a.lat == null || a.lng == null) continue;
          const key = `${a.lat.toFixed(5)}|${a.lng.toFixed(5)}|${a.destination}`;
          const existing = map.get(key);
          if (!existing || a.etaMin < existing.etaMin) {
            map.set(key, {
              key,
              lat: a.lat,
              lng: a.lng,
              destination: a.destination,
              etaMin: a.etaMin,
            });
          }
        }
      }
      setBuses(Array.from(map.values()));
      setLoading(false);
      timer = setTimeout(tick, 30_000);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [lineCode, sampledStops]);

  const center = useMemo<[number, number]>(() => {
    if (user) return [user.lat, user.lng];
    if (ida.length) return [ida[Math.floor(ida.length / 2)].lat, ida[Math.floor(ida.length / 2)].lng];
    if (vuelta.length) return [vuelta[0].lat, vuelta[0].lng];
    return ALC;
  }, [user, ida, vuelta]);

  const idaPath = useMemo<[number, number][]>(
    () => ida.map((s) => [s.lat, s.lng]),
    [ida],
  );
  const vueltaPath = useMemo<[number, number][]>(
    () => vuelta.map((s) => [s.lat, s.lng]),
    [vuelta],
  );

  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-2xl border border-white/10">
      <MapContainer
        center={center}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {idaPath.length > 1 && (
          <Polyline positions={idaPath} pathOptions={{ color, weight: 4, opacity: 0.85 }} />
        )}
        {vueltaPath.length > 1 && (
          <Polyline
            positions={vueltaPath}
            pathOptions={{ color, weight: 4, opacity: 0.55, dashArray: "6 6" }}
          />
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
        {buses.map((b) => (
          <Marker key={b.key} position={[b.lat, b.lng]} icon={busIcon(lineCode, color)}>
            <Popup>
              <strong>Línea {lineCode}</strong>
              <br />
              <span>→ {b.destination}</span>
              <br />
              <span>{b.etaMin} min</span>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
        {loading ? "Actualizando…" : `${buses.length} bus${buses.length === 1 ? "" : "es"} en vivo`}
      </div>
    </div>
  );
}
