// Estimación de tiempo de viaje en bus urbano por tramo.
// Usa coordenadas de paradas si están disponibles; si no, cae a una media
// por número de paradas. Velocidad media urbana con tráfico Alicante ≈ 16 km/h
// más 0.25 min de parada por bus stop.

import type { Leg } from "@/lib/bus-routing";

const URBAN_KMH = 16;
const DWELL_MIN_PER_STOP = 0.25;
const FALLBACK_MIN_PER_STOP = 1.6;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function estimateLegMinutes(
  leg: Leg,
  coords: Map<string, { lat: number; lng: number }>,
): number {
  const seq: { lat: number; lng: number }[] = [];
  const codes = [leg.fromCode, ...leg.intermediate.map((s) => s.code).filter(Boolean) as string[], leg.toCode];
  for (const c of codes) {
    const p = coords.get(c);
    if (p) seq.push(p);
  }

  if (seq.length >= 2) {
    let km = 0;
    for (let i = 1; i < seq.length; i++) km += haversineKm(seq[i - 1], seq[i]);
    const travel = (km / URBAN_KMH) * 60;
    const dwell = leg.numStops * DWELL_MIN_PER_STOP;
    return Math.max(1, Math.round(travel + dwell));
  }
  return Math.max(1, Math.round(leg.numStops * FALLBACK_MIN_PER_STOP));
}

export function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
