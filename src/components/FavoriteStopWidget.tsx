import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useBusGraph } from "@/hooks/useBusGraph";
import { useBusEngine } from "@/hooks/useBusEngine";
import { predictStopArrivals } from "@/lib/bus-engine/predict";


// Servicio urbano: el último bus parte de la parada extrema a las 22:30 y
// cada línea abre a una hora particular por la mañana. Como cota segura
// usamos 07:00; refinar por línea cuando tengamos el horario oficial.
export function isBusOutOfService(d = new Date()): boolean {
  const m = d.getHours() * 60 + d.getMinutes();
  // Fuera de servicio entre 22:31 y 06:59.
  return m > 22 * 60 + 30 || m < 7 * 60;
}

export type FavoriteStop = {
  stopId: string;
  stopName: string;
  line: string;
  destination: string;
};

export const DEFAULT_FAVORITE_STOP: FavoriteStop = {
  stopId: "5110",
  stopName: "Jornet Navarro",
  line: "12",
  destination: "Puerta del Mar",
};

const STORAGE_KEY = "vamos:favorite-stop";
const SHOW_ON_HOME_KEY = "vamos:favorite-stop-show-on-home-v2";

export function loadFavoriteStop(): FavoriteStop {
  if (typeof window === "undefined") return DEFAULT_FAVORITE_STOP;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FAVORITE_STOP;
    const parsed = JSON.parse(raw) as FavoriteStop;
    if (!parsed?.stopId || !parsed?.line) return DEFAULT_FAVORITE_STOP;
    return parsed;
  } catch {
    return DEFAULT_FAVORITE_STOP;
  }
}

export function saveFavoriteStop(stop: FavoriteStop) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stop));
  window.dispatchEvent(new Event("vamos:favorite-stop-changed"));
}

export function loadShowOnHome(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SHOW_ON_HOME_KEY);
  return v == null ? true : v === "1";
}

export function saveShowOnHome(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SHOW_ON_HOME_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event("vamos:favorite-stop-changed"));
}

// ---- Live snapshot compartido entre /transporte/parada-favorita y el widget ----
const LIVE_SNAPSHOT_KEY = "vamos:favorite-stop-live-v1";

export type FavoriteStopLiveSnapshot = {
  stopId: string;
  line: string;
  etaMin: number;
  all: number[];
  destination: string | null;
  fetchedAt: number;
};

export function saveFavoriteStopLiveSnapshot(snap: FavoriteStopLiveSnapshot) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LIVE_SNAPSHOT_KEY, JSON.stringify(snap));
  window.dispatchEvent(new Event("vamos:favorite-stop-live"));
}

export function loadFavoriteStopLiveSnapshot(): FavoriteStopLiveSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LIVE_SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FavoriteStopLiveSnapshot;
    if (!parsed?.stopId || !parsed?.line || !Number.isFinite(parsed.etaMin)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Minutos restantes del snapshot si coincide stop+line y no ha caducado. */
export function liveSnapshotRemaining(
  snap: FavoriteStopLiveSnapshot | null,
  stopId: string,
  line: string,
): { etaMin: number; all: number[] } | null {
  if (!snap) return null;
  if (snap.stopId !== stopId || snap.line.toUpperCase() !== line.toUpperCase()) return null;
  const elapsed = Math.floor((Date.now() - snap.fetchedAt) / 60_000);
  const eta = snap.etaMin - elapsed;
  if (eta < -1) return null; // ~1 min de gracia tras llegar
  const remaining = Math.max(0, eta);
  const allRemaining = snap.all
    .map((m) => Math.max(0, m - elapsed))
    .filter((m, i) => i === 0 || m > 0);
  return { etaMin: remaining, all: allRemaining };
}

export function computeNextArrival(stop: FavoriteStop): {
  minutes: number;
  arrivalTime: string;
} {
  const now = new Date();
  const hash = stop.stopId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const freq = 15;
  const offset = hash % freq;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const next = Math.ceil((minutesNow - offset) / freq) * freq + offset;
  let minutes = next - minutesNow;
  if (minutes <= 0) minutes += freq;
  const arrival = new Date(now.getTime() + minutes * 60_000);
  const arrivalTime = `${String(arrival.getHours()).padStart(2, "0")}:${String(
    arrival.getMinutes(),
  ).padStart(2, "0")}`;
  return { minutes, arrivalTime };
}

export function computeUpcomingArrivals(
  stop: FavoriteStop,
  count = 4,
): Array<{ minutes: number; arrivalTime: string }> {
  const first = computeNextArrival(stop);
  const out: Array<{ minutes: number; arrivalTime: string }> = [first];
  for (let i = 1; i < count; i++) {
    const m = first.minutes + i * 15;
    const arrival = new Date(Date.now() + m * 60_000);
    out.push({
      minutes: m,
      arrivalTime: `${String(arrival.getHours()).padStart(2, "0")}:${String(
        arrival.getMinutes(),
      ).padStart(2, "0")}`,
    });
  }
  return out;
}

export function FavoriteStopWidget() {
  const [stop, setStop] = useState<FavoriteStop>(DEFAULT_FAVORITE_STOP);
  const [show, setShow] = useState<boolean>(true);
  const [liveMin, setLiveMin] = useState<number | null>(null);
  const [liveSource, setLiveSource] = useState<"realtime" | "engine" | null>(null);
  const { data: graph } = useBusGraph();
  const { data: engine } = useBusEngine();

  useEffect(() => {
    setStop(loadFavoriteStop());
    setShow(loadShowOnHome());
    const onChange = () => {
      setStop(loadFavoriteStop());
      setShow(loadShowOnHome());
    };
    window.addEventListener("vamos:favorite-stop-changed", onChange);
    return () => {
      window.removeEventListener("vamos:favorite-stop-changed", onChange);
    };
  }, []);

  // No usamos Vectalia en el home (cada llamada cuesta 1 crédito Firecrawl y
  // está limitada a 3/día por usuario). Mostramos predicción del motor; el
  // usuario podrá pedir el tiempo real desde /transporte/parada-favorita.
  useEffect(() => {
    if (engine) {
      const arrivals = predictStopArrivals(engine, stop.stopId);
      const forLine = arrivals.filter((a) => a.line === stop.line);
      setLiveMin(forLine[0]?.etaMin ?? null);
      setLiveSource(forLine[0] ? "engine" : null);
    } else {
      setLiveMin(null);
      setLiveSource(null);
    }
  }, [stop.stopId, stop.line, engine]);


  const lineColor =
    graph?.lines.find((l) => l.code === stop.line)?.color || "#0d3b8a";

  const hasLive = liveMin != null;
  const minutes = liveMin ?? 0;
  const arrivalDate = new Date(Date.now() + minutes * 60_000);
  const arrivalTime = hasLive
    ? `${String(arrivalDate.getHours()).padStart(2, "0")}:${String(arrivalDate.getMinutes()).padStart(2, "0")}`
    : "n/d";

  if (!show) return null;

  return (
    <Link
      to="/transporte/parada-favorita"
      aria-label="Abrir mi parada favorita"
      className="group flex w-full max-w-[150px] items-stretch gap-1.5 rounded-2xl border border-amber-100/80 bg-[#fffaf2] p-1.5 shadow-[0_6px_18px_-8px_rgba(180,120,40,0.35)] transition active:scale-[0.98]"
    >
      <div className="flex flex-1 flex-col justify-center gap-1 min-w-0">
        <div className="flex items-center gap-1">
          <span
            className="rounded-md px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white"
            style={{ background: lineColor }}
          >
            Bus línea ({stop.line})
          </span>
          {hasLive && liveSource === "realtime" && (
            <span className="text-[7px] font-bold uppercase tracking-wider text-emerald-700 leading-none">
              ● live
            </span>
          )}
          {hasLive && liveSource === "engine" && (
            <span className="text-[7px] font-bold uppercase tracking-wider text-amber-700 leading-none">
              ~ est
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[7px] font-bold uppercase tracking-wider text-stone-400 leading-none">
            Destino
          </div>
          <div className="truncate text-[10px] font-bold leading-tight text-stone-900">
            {stop.destination}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[7px] font-bold uppercase tracking-wider text-stone-400 leading-none">
            Origen
          </div>
          <div className="truncate text-[10px] font-semibold leading-tight text-stone-700">
            {stop.stopName}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-1">
        {!hasLive ? (
          <div className="flex h-[48px] w-[48px] flex-col items-center justify-center rounded-full bg-stone-100 ring-1 ring-stone-300">
            <span
              className="text-[18px] font-extrabold leading-none tabular-nums text-stone-500"
              aria-live="polite"
            >
              n/d
            </span>
          </div>
        ) : minutes <= 1 ? (
          <div
            className="flex h-[48px] w-[48px] flex-col items-center justify-center rounded-full animate-blink ring-1"
            style={{ background: lineColor, borderColor: lineColor }}
          >
            <span className="text-[9px] font-extrabold uppercase leading-none text-white">
              ¡Llega!
            </span>
          </div>
        ) : (
          <div
            key={minutes}
            className="flex h-[48px] w-[48px] flex-col items-center justify-center rounded-full bg-white ring-1 ring-stone-200 animate-in fade-in zoom-in-95 duration-300"
          >
            <span
              className="text-[24px] font-extrabold leading-none tabular-nums"
              style={{ color: lineColor }}
              aria-live="polite"
            >
              {minutes}
            </span>
            <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600 leading-none mt-0.5">
              min
            </span>
          </div>
        )}
        <div className="flex flex-col items-center leading-none">
          <span className="text-[7px] font-bold uppercase tracking-wider text-stone-400">
            Llega
          </span>
          <span className="text-[10px] font-extrabold tabular-nums text-stone-700 mt-0.5">
            {arrivalTime}
          </span>
        </div>
      </div>
    </Link>
  );
}
