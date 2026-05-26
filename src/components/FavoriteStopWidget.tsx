import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Clock } from "lucide-react";

export type FavoriteStop = {
  stopId: string;
  stopName: string;
  line: string;
  destination: string;
};

export const DEFAULT_FAVORITE_STOP: FavoriteStop = {
  stopId: "3101",
  stopName: "Luceros",
  line: "C6",
  destination: "Aeropuerto",
};

const STORAGE_KEY = "vamos:favorite-stop";

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

// Mock arrival generator — deterministic per minute so it feels "live"
export function computeNextArrival(stop: FavoriteStop): {
  minutes: number;
  arrivalTime: string;
} {
  const now = new Date();
  // base frequency 15 min, offset by stopId hash
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
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setStop(loadFavoriteStop());
    const onChange = () => setStop(loadFavoriteStop());
    window.addEventListener("vamos:favorite-stop-changed", onChange);
    const id = window.setInterval(() => setTick((t) => t + 1), 45_000);
    return () => {
      window.removeEventListener("vamos:favorite-stop-changed", onChange);
      window.clearInterval(id);
    };
  }, []);

  const { minutes, arrivalTime } = computeNextArrival(stop);

  return (
    <Link
      to="/transporte/parada-favorita"
      aria-label="Abrir mi parada favorita"
      className="group flex w-full max-w-[230px] items-center gap-2 rounded-2xl border border-amber-100/80 bg-[#fffaf2] px-2.5 py-2 shadow-[0_6px_18px_-8px_rgba(180,120,40,0.35)] transition active:scale-[0.98]"
    >
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">
            En directo
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-md bg-[#0d3b8a] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-white">
            {stop.line}
          </span>
          <span className="truncate text-[12px] font-semibold text-stone-800">
            {stop.destination}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-stone-600">
          <span className="inline-flex items-center gap-0.5 truncate">
            <MapPin className="h-2.5 w-2.5 text-stone-500" />
            <span className="truncate">{stop.stopName}</span>
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5 text-stone-500" />
            {arrivalTime}
          </span>
        </div>
      </div>
      <div
        key={minutes}
        className="flex flex-col items-center justify-center rounded-xl bg-white px-2 py-1 ring-1 ring-stone-200 animate-in fade-in zoom-in-95 duration-300"
      >
        <span
          className="text-[22px] font-extrabold leading-none tabular-nums text-[#0d3b8a]"
          aria-live="polite"
        >
          {minutes}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-600">
          min
        </span>
      </div>
    </Link>
  );
}
