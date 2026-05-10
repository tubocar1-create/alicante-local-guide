import { useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };
export type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; coords: Coords }
  | { status: "error"; message: string };

let cached: Coords | null = null;
const listeners = new Set<(c: Coords) => void>();

export function useUserLocation() {
  const [state, setState] = useState<LocationState>(
    cached ? { status: "ready", coords: cached } : { status: "idle" },
  );

  useEffect(() => {
    if (cached) return;
    const onUpdate = (c: Coords) => setState({ status: "ready", coords: c });
    listeners.add(onUpdate);
    return () => {
      listeners.delete(onUpdate);
    };
  }, []);

  function request() {
    if (cached) {
      setState({ status: "ready", coords: cached });
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", message: "Geolocalización no disponible" });
      return;
    }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        cached = c;
        listeners.forEach((l) => l(c));
        setState({ status: "ready", coords: c });
      },
      (err) => {
        setState({
          status: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Permiso denegado"
              : "No se pudo obtener tu ubicación",
        });
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10000 },
    );
  }

  return { state, request };
}

/** Haversine distance in kilometres */
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export type TravelMode = "walking" | "driving" | "transit";

/** Rough travel-time estimate from straight-line distance (no routing API). */
export function estimateMinutes(km: number, mode: TravelMode): number {
  switch (mode) {
    case "walking":
      // 4.8 km/h with +20% for stops/turns
      return Math.max(1, Math.round((km / 4.8) * 60 * 1.2));
    case "driving":
      // 30 km/h urban with +30% for traffic + 2 min for parking/start
      return Math.max(2, Math.round((km / 30) * 60 * 1.3) + 2);
    case "transit":
      // 18 km/h average with +40% for transfers + 5 min wait
      return Math.max(5, Math.round((km / 18) * 60 * 1.4) + 5);
  }
}

export function formatTime(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
