import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

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
  const [liveMin, setLiveMin] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    setStop(loadFavoriteStop());
    const onChange = () => setStop(loadFavoriteStop());
    window.addEventListener("vamos:favorite-stop-changed", onChange);
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      window.removeEventListener("vamos:favorite-stop-changed", onChange);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchLive() {
      try {
        const r = await fetch(
          `/api/public/bus-eta?stop=${encodeURIComponent(stop.stopId)}&line=${encodeURIComponent(stop.line)}&_=${Date.now()}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const j = (await r.json()) as { etaMin: number | null };
        if (!cancelled) setLiveMin(typeof j.etaMin === "number" ? j.etaMin : null);
      } catch {
        if (!cancelled) setLiveMin(null);
      }
    }
    fetchLive();
    const id = window.setInterval(fetchLive, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [stop.stopId, stop.line]);

  const fallback = computeNextArrival(stop);
  const minutes = liveMin ?? fallback.minutes;
  const arrivalDate = new Date(Date.now() + minutes * 60_000);
  const arrivalTime =
    liveMin != null
      ? `${String(arrivalDate.getHours()).padStart(2, "0")}:${String(arrivalDate.getMinutes()).padStart(2, "0")}`
      : fallback.arrivalTime;

  return (
    <Link
      to="/transporte/parada-favorita"
      aria-label="Abrir mi parada favorita"
      className="group flex w-full max-w-[150px] items-stretch gap-1.5 rounded-2xl border border-amber-100/80 bg-[#fffaf2] p-1.5 shadow-[0_6px_18px_-8px_rgba(180,120,40,0.35)] transition active:scale-[0.98]"
    >
      <div className="flex flex-1 flex-col justify-center gap-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="rounded-md bg-[#0d3b8a] px-1.5 py-0.5 text-[8px] font-extrabold leading-none text-white">
            Bus línea ({stop.line})
          </span>
          <span className="text-[7px] font-bold uppercase tracking-wider text-emerald-700 leading-none">
            ● live
          </span>
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
        {minutes <= 1 ? (
          <div className="flex h-[48px] w-[48px] flex-col items-center justify-center rounded-full bg-[#0d3b8a] animate-blink ring-1 ring-[#0d3b8a]">
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
              className="text-[24px] font-extrabold leading-none tabular-nums text-[#0d3b8a]"
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
