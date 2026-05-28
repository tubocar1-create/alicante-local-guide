import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Search, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/tram/estaciones")({
  head: () => ({
    meta: [
      { title: "TRAM Alicante — Estaciones" },
      { name: "description", content: "Busca cualquier estación del TRAM de Alicante y consulta sus próximas salidas." },
      { property: "og:title", content: "Estaciones del TRAM de Alicante" },
      { property: "og:description", content: "Buscador de estaciones del TRAM de Alicante con próximas salidas en tiempo real." },
      { property: "og:url", content: "https://vamosalicante.com/tram/estaciones" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/tram/estaciones" }],
  }),
  component: EstacionesPage,
});

type Station = { stop_id: string; stop_name: string };

function EstacionesPage() {
  const [q, setQ] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    abort.current?.abort();
    const ctrl = new AbortController(); abort.current = ctrl;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/public/tram/stations${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((d) => { setStations(d?.stations ?? []); setLoading(false); })
        .catch(() => setLoading(false));
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  return (
    <main className="h-dvh overflow-y-auto overscroll-contain bg-background pb-24">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
        <Link to="/tram" className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition active:scale-95">
          <ChevronLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <h1 className="text-sm font-semibold tracking-tight">Estaciones TRAM</h1>
      </header>
      <div className="mx-auto max-w-2xl p-3 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estación…" autoFocus
            className="w-full rounded-full border border-border bg-background/80 py-2.5 pl-9 pr-3 text-sm shadow-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20" />
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <ul className="rounded-2xl border border-border bg-card overflow-hidden">
            {stations.map((s) => (
              <li key={s.stop_id} className="border-b border-border/60 last:border-b-0">
                <Link to="/tram/parada/$stopId" params={{ stopId: s.stop_id }}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 active:scale-[0.99] transition">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 text-sm truncate">{s.stop_name}</span>
                </Link>
              </li>
            ))}
            {stations.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">Sin resultados.</li>}
          </ul>
        )}
      </div>
    </main>
  );
}
