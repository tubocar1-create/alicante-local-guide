// Geometría de polilínea: proyección de puntos, longitud e interpolación.
// Coordenadas en formato [lng, lat] (GeoJSON) o LatLng según firma.

import { haversineMeters, type LatLng } from "./geometry";

export type LngLat = [number, number]; // [lng, lat], formato GeoJSON
export type Polyline = LngLat[];

function toLatLng(p: LngLat): LatLng {
  return { lat: p[1], lng: p[0] };
}

/** Longitud total de una polilínea en metros (suma de Haversine). */
export function polylineLength(poly: Polyline): number {
  let total = 0;
  for (let i = 1; i < poly.length; i++) {
    total += haversineMeters(toLatLng(poly[i - 1]), toLatLng(poly[i]));
  }
  return total;
}

/**
 * Proyecta un punto sobre una polilínea. Devuelve:
 * - distanceAlong_m: distancia desde el inicio del shape hasta la proyección
 * - offset_m: distancia perpendicular del punto al shape
 * - segmentIndex: índice del segmento más cercano
 * - snapped: el punto sobre la polilínea
 */
export function projectPointOnPolyline(
  point: LatLng,
  poly: Polyline,
): {
  distanceAlong_m: number;
  offset_m: number;
  segmentIndex: number;
  snapped: LatLng;
} {
  if (poly.length < 2) {
    throw new Error("polyline needs at least 2 points");
  }
  const p: LngLat = [point.lng, point.lat];
  let best = {
    distanceAlong_m: 0,
    offset_m: Infinity,
    segmentIndex: 0,
    snapped: toLatLng(poly[0]),
  };
  let cumulative = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const snap: LngLat = [a[0] + t * dx, a[1] + t * dy];
    const snapLL = toLatLng(snap);
    const offset = haversineMeters(point, snapLL);
    if (offset < best.offset_m) {
      const segLen = haversineMeters(toLatLng(a), toLatLng(b));
      best = {
        distanceAlong_m: cumulative + segLen * t,
        offset_m: offset,
        segmentIndex: i,
        snapped: snapLL,
      };
    }
    cumulative += haversineMeters(toLatLng(a), toLatLng(b));
  }
  return best;
}

/** Punto sobre la polilínea a una distancia dada desde el inicio (metros). */
export function interpolateOnPolyline(poly: Polyline, distance_m: number): LatLng {
  if (poly.length < 2) throw new Error("polyline needs at least 2 points");
  if (distance_m <= 0) return toLatLng(poly[0]);
  let cumulative = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    const segLen = haversineMeters(toLatLng(a), toLatLng(b));
    if (cumulative + segLen >= distance_m) {
      const t = segLen === 0 ? 0 : (distance_m - cumulative) / segLen;
      return { lat: a[1] + t * (b[1] - a[1]), lng: a[0] + t * (b[0] - a[0]) };
    }
    cumulative += segLen;
  }
  return toLatLng(poly[poly.length - 1]);
}

/**
 * Para una lista ordenada de paradas (con lat/lng), devuelve para cada parada
 * su distancia desde el inicio sobre la polilínea (cumulative_m) y el offset
 * al shape (snap_offset_m). Si una parada queda detrás de la anterior por
 * snap impreciso, se fuerza a la cumulativa anterior para preservar orden.
 */
export function projectStopsOnPolyline(
  stops: { lat: number; lng: number }[],
  poly: Polyline,
): { cumulative_m: number; snap_offset_m: number }[] {
  const out: { cumulative_m: number; snap_offset_m: number }[] = [];
  let lastCum = 0;
  for (const s of stops) {
    const r = projectPointOnPolyline({ lat: s.lat, lng: s.lng }, poly);
    const cum = Math.max(r.distanceAlong_m, lastCum);
    out.push({ cumulative_m: cum, snap_offset_m: r.offset_m });
    lastCum = cum;
  }
  return out;
}
