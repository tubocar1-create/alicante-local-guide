import { useEffect, useState } from "react";

export type Coords = { lat: number; lng: number; accuracy?: number };
export type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; coords: Coords }
  | { status: "error"; message: string };

let cached: Coords | null = null;
let watchId: number | null = null;
let watchRefs = 0;
const listeners = new Set<(c: Coords) => void>();
const errorListeners = new Set<(message: string) => void>();

function notify(c: Coords) {
  cached = c;
  listeners.forEach((l) => l(c));
}

function startWatch() {
  if (watchId !== null) return;
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) =>
      notify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
    (err) => {
      const message =
        err.code === err.PERMISSION_DENIED ? "Permiso denegado" : "No se pudo obtener tu ubicación";
      errorListeners.forEach((l) => l(message));
    },
    { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
  );
}

function stopWatch() {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
}

/** Fully release geolocation: stop watching and clear any cached coords so
 *  the next time the user opens the app we ask again. */
function releaseLocation() {
  stopWatch();
  cached = null;
  // Reset every active subscriber back to idle so the UI re-prompts
  listeners.forEach((l) => {
    try {
      (l as unknown as { __reset?: () => void }).__reset?.();
    } catch {
      /* noop */
    }
  });
}

// Pause geolocation when the app is not in use (tab hidden, app backgrounded,
// or page closed). Resume automatically when the user returns, but only if
// some component is still actively watching.
let lifecycleBound = false;
function bindLifecycle() {
  if (lifecycleBound || typeof document === "undefined") return;
  lifecycleBound = true;
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      // App backgrounded: fully release so a returning user is asked again.
      releaseLocation();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  // pagehide fires on tab close / navigation away / mobile app backgrounding
  window.addEventListener("pagehide", releaseLocation);
  window.addEventListener("beforeunload", releaseLocation);
}

export function useUserLocation(opts?: { watch?: boolean }) {
  const watch = !!opts?.watch;
  const [state, setState] = useState<LocationState>(
    cached ? { status: "ready", coords: cached } : { status: "idle" },
  );

  useEffect(() => {
    const onUpdate = (c: Coords) => setState({ status: "ready", coords: c });
    const onError = (message: string) =>
      setState((prev) => (prev.status === "ready" ? prev : { status: "error", message }));
    listeners.add(onUpdate);
    errorListeners.add(onError);
    bindLifecycle();
    if (watch) {
      watchRefs += 1;
      if (!cached) setState({ status: "loading" });
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        startWatch();
      }
    }
    return () => {
      listeners.delete(onUpdate);
      errorListeners.delete(onError);
      if (watch) {
        watchRefs -= 1;
        if (watchRefs <= 0) stopWatch();
      }
    };
  }, [watch]);

  function request() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState({ status: "error", message: "Geolocalización no disponible en este navegador" });
      return;
    }
    // Detect blocked permission so we can give actionable instructions
    const tryGet = () => {
      setState({ status: "loading" });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          };
          notify(c);
          setState({ status: "ready", coords: c });
          startWatch();
        },
        (err) => {
          const message =
            err.code === err.PERMISSION_DENIED
              ? "Permiso bloqueado. Toca el candado 🔒 de la barra del navegador → Permisos → Ubicación → Permitir, y vuelve a intentarlo."
              : err.code === err.POSITION_UNAVAILABLE
                ? "No se pudo obtener tu ubicación (GPS sin señal). Sal al exterior o activa el GPS."
                : err.code === err.TIMEOUT
                  ? "Se agotó el tiempo buscando tu ubicación. Inténtalo de nuevo."
                  : "No se pudo obtener tu ubicación";
          setState({ status: "error", message });
        },
        { enableHighAccuracy: true, maximumAge: 60_000, timeout: 15_000 },
      );
    };

    if (cached) {
      setState({ status: "ready", coords: cached });
      startWatch();
      return;
    }

    // If the Permissions API is available, check current state first
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions;
    if (perms?.query) {
      perms
        .query({ name: "geolocation" as PermissionName })
        .then((res) => {
          if (res.state === "denied") {
            setState({
              status: "error",
              message:
                "Permiso bloqueado en el navegador. Toca el candado 🔒 de la barra de direcciones → Permisos → Ubicación → Permitir, y recarga la página.",
            });
            return;
          }
          tryGet();
        })
        .catch(() => tryGet());
    } else {
      tryGet();
    }
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
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
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
