import { useEffect, useState } from "react";

export type Coords = { lat: number; lng: number };
export type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; coords: Coords }
  | { status: "error"; message: string };

let cached: Coords | null = null;
let watchId: number | null = null;
let watchRefs = 0;
const listeners = new Set<(c: Coords) => void>();

function notify(c: Coords) {
  cached = c;
  listeners.forEach((l) => l(c));
}

function startWatch() {
  if (watchId !== null) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => notify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => {},
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
  );
}

function stopWatch() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
}

export function useUserLocation(opts?: { watch?: boolean }) {
  const watch = !!opts?.watch;
  const [state, setState] = useState<LocationState>(
    cached ? { status: "ready", coords: cached } : { status: "idle" },
  );

  useEffect(() => {
    const onUpdate = (c: Coords) => setState({ status: "ready", coords: c });
    listeners.add(onUpdate);
    if (watch) {
      watchRefs += 1;
      startWatch();
    }
    return () => {
      listeners.delete(onUpdate);
      if (watch) {
        watchRefs -= 1;
        if (watchRefs <= 0) stopWatch();
      }
    };
  }, [watch]);

  function request() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", message: "Geolocalización no disponible" });
      return;
    }
    if (cached) {
      setState({ status: "ready", coords: cached });
      startWatch();
      return;
    }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        notify(c);
        setState({ status: "ready", coords: c });
        startWatch();
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
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
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
      return Math.max(1, Math.round((km / 4.8) * 60 * 1.2));
    case "driving":
      return Math.max(2, Math.round((km / 30) * 60 * 1.3) + 2);
    case "transit":
      return Math.max(5, Math.round((km / 18) * 60 * 1.4) + 5);
  }
}

export function formatTime(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
