// Geometría pura para el motor predictivo. Sin red, sin estado.

export type LatLng = { lat: number; lng: number };

const R_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(s));
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1000;
}

// Interpolación lineal sobre un segmento [a, b] con t ∈ [0,1].
export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.max(0, Math.min(1, t));
  return {
    lat: a.lat + (b.lat - a.lat) * k,
    lng: a.lng + (b.lng - a.lng) * k,
  };
}

// Distancias acumuladas en metros entre paradas consecutivas.
export function cumulativeMeters(points: LatLng[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    out.push(out[i - 1] + haversineMeters(points[i - 1], points[i]));
  }
  return out;
}
