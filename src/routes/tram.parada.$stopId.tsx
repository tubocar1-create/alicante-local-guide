import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, Loader2, Star, Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/tram/parada/$stopId")({
  head: ({ params }) => ({
    meta: [
      { title: `TRAM Alicante — Próximas salidas` },
      { name: "description", content: `Próximas salidas del TRAM de Alicante desde la parada ${params.stopId}.` },
    ],
  }),
  component: ParadaPage,
});

type Departure = {
  trip_id: string; route_id: string; line_short_name?: string | null;
  line_long_name?: string | null; line_color?: string | null; headsign?: string | null;
  arrival_time?: string | null; departure_time?: string | null;
};
type Station = { stop_id: string; stop_name: string; stop_lat?: number; stop_lon?: number };

const FAV_KEY = "tram:favorites";
const LAST_KEY = "tram:last";

function minutesUntil(t?: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const now = new Date();
  const diff = h * 60 + m - (now.getHours() * 60 + now.getMinutes());
  return diff < 0 ? null : diff;
}

function ParadaPage() {
  const { stopId } = useParams({ from: "/tram/parada/$stopId" });
  const [station, setStation] = useState<Station | null>(null);
  const [departures, setDepartures] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    fetch(`/api/public/tram/stations?q=${encodeURIComponent("")}`).then((r) => r.json()).then((d) => {
      const found = (d?.stations ?? []).find((s: Station) => s.stop_id === stopId);
      if (found) { setStation(found); try { localStorage.setItem(LAST_KEY, JSON.stringify(found)); } catch {/* noop */} }
    });
    fetch(`/api/public/tram/departures?stop_id=${encodeURIComponent(stopId)}&limit=20`)
      .then((r) => r.json()).then((d) => { setDepartures(d?.departures ?? []); setLoading(false); })
      .catch(() => setLoading(false));
    try {
      const fav = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      setIsFav(Array.isArray(fav) && fav.some((f: Station) => f.stop_id === stopId));
    } catch {/* noop */}
  }, [stopId]);

  const toggleFav = () => {
    try {
      const fav: Station[] = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      const exists = fav.some((f) => f.stop_id === stopId);
      const next = exists ? fav.filter((f) => f.stop_id !== stopId) : (station ? [...fav, station] : fav);
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      setIsFav(!exists);
    } catch {/* noop */}
  };

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
        <Link to="/tram" className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition active:scale-95">
          <ChevronLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <MapPin className="h-4 w-4 text-primary" />
        <h1 className="flex-1 truncate text-sm font-semibold tracking-tight">{station?.stop_name ?? "Parada TRAM"}</h1>
        <button type="button" onClick={toggleFav} aria-label="Favorito" className="rounded-full p-1 transition hover:bg-accent/40">
          <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
        </button>
        {station?.stop_lat && station?.stop_lon && (
          <a href={`https://www.google.com/maps/search/?api=1&query=${station.stop_lat},${station.stop_lon}`} target="_blank" rel="noopener noreferrer"
            className="rounded-full p-1 transition hover:bg-accent/40" aria-label="Abrir en Mapa">
            <MapIcon className="h-4 w-4 text-primary" />
          </a>
        )}
      </header>
      <div className="mx-auto max-w-2xl p-3">
        <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Próximas salidas</p>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : departures.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay salidas programadas próximamente.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {departures.map((d, i) => {
                const mins = minutesUntil(d.departure_time);
                const color = d.line_color ? (d.line_color.startsWith("#") ? d.line_color : `#${d.line_color}`) : "var(--primary)";
                return (
                  <li key={`${d.trip_id}-${i}`} className="flex items-center gap-2.5 py-2.5">
                    <Link to="/tram/linea/$lineId" params={{ lineId: d.route_id }}
                      className="inline-flex h-7 min-w-[2.5rem] items-center justify-center rounded-md px-1.5 text-[11px] font-bold text-white shadow-sm active:scale-95"
                      style={{ background: color }}>
                      {d.line_short_name ?? "TRAM"}
                    </Link>
                    <span className="flex-1 truncate text-sm">{d.headsign ?? d.line_long_name ?? "—"}</span>
                    <span className="text-right">
                      {mins !== null ? (
                        <><span className="text-lg font-bold leading-none text-primary">{mins}</span><span className="ml-1 text-[10px] uppercase text-muted-foreground">min</span></>
                      ) : (
                        <span className="text-xs tabular-nums text-muted-foreground">{d.departure_time?.slice(0, 5) ?? "—"}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
