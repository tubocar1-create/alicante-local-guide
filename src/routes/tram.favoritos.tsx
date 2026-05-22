import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, Star } from "lucide-react";

export const Route = createFileRoute("/tram/favoritos")({
  head: () => ({
    meta: [
      { title: "TRAM Alicante — Favoritos" },
      { name: "description", content: "Tus paradas favoritas del TRAM de Alicante." },
    ],
  }),
  component: FavoritosPage,
});

type Station = { stop_id: string; stop_name: string };
const FAV_KEY = "tram:favorites";

function FavoritosPage() {
  const [fav, setFav] = useState<Station[]>([]);
  useEffect(() => {
    try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); if (Array.isArray(v)) setFav(v); } catch {/* noop */}
  }, []);
  const remove = (id: string) => {
    const next = fav.filter((f) => f.stop_id !== id);
    setFav(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {/* noop */}
  };
  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
        <Link to="/tram" className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition active:scale-95">
          <ChevronLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <h1 className="text-sm font-semibold tracking-tight">Paradas favoritas</h1>
      </header>
      <div className="mx-auto max-w-2xl p-3">
        {fav.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Aún no tienes favoritos. Pulsa la ⭐ en una parada para guardarla.</p>
        ) : (
          <ul className="rounded-2xl border border-border bg-card overflow-hidden">
            {fav.map((f) => (
              <li key={f.stop_id} className="flex items-center border-b border-border/60 last:border-b-0">
                <Link to="/tram/parada/$stopId" params={{ stopId: f.stop_id }} className="flex flex-1 items-center gap-3 px-3 py-2.5 hover:bg-accent/30 transition">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 text-sm truncate">{f.stop_name}</span>
                </Link>
                <button onClick={() => remove(f.stop_id)} aria-label="Quitar" className="p-3 text-muted-foreground hover:bg-accent/40">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
