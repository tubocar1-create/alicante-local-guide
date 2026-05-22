import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, MapPin, Loader2 } from "lucide-react";

export const Route = createFileRoute("/tram/linea/$lineId")({
  head: ({ params }) => ({
    meta: [
      { title: `TRAM Alicante — Línea ${params.lineId}` },
      { name: "description", content: `Paradas y recorrido de la línea ${params.lineId} del TRAM de Alicante.` },
    ],
  }),
  component: LineaPage,
});

type Stop = { stop_id: string; stop_name: string; stop_lat?: number; stop_lon?: number };
type StopRow = { sequence: number; arrival_time: string | null; departure_time: string | null; stop: Stop | null };

function LineaPage() {
  const { lineId } = useParams({ from: "/tram/linea/$lineId" });
  const [stops, setStops] = useState<StopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState(0);
  const [lineLabel, setLineLabel] = useState<string>(lineId);
  const [lineColor, setLineColor] = useState<string>("#E2231A");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/public/tram/line-stops?line_id=${encodeURIComponent(lineId)}&direction=${direction}`)
      .then((r) => r.json())
      .then((d) => { setStops(d?.stops ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [lineId, direction]);

  useEffect(() => {
    fetch("/api/public/tram/lines").then((r) => r.json()).then((d) => {
      const match = (d?.lines ?? []).find((l: { id: string }) => l.id === lineId);
      if (match) {
        setLineLabel(match.short_name ?? lineId);
        if (match.color) setLineColor(match.color.startsWith("#") ? match.color : `#${match.color}`);
      }
    }).catch(() => {/* noop */});
  }, [lineId]);

  return (
    <main className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/60 bg-background/90 px-3 py-2.5 backdrop-blur">
        <Link to="/tram" className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium shadow-sm transition active:scale-95">
          <ChevronLeft className="h-3.5 w-3.5" /> Volver
        </Link>
        <span className="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-md px-1.5 text-[11px] font-black text-white shadow-sm" style={{ background: lineColor }}>{lineLabel}</span>
        <h1 className="text-sm font-semibold tracking-tight">Recorrido</h1>
      </header>
      <div className="mx-auto max-w-2xl p-3 space-y-3">
        <div className="flex gap-1.5">
          {[0, 1].map((d) => (
            <button key={d} type="button" onClick={() => setDirection(d)}
              className={`flex-1 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm transition active:scale-95 ${direction === d ? "border-primary bg-primary/10" : "border-border bg-background/80"}`}>
              Sentido {d === 0 ? "ida" : "vuelta"}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : stops.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Sin información de paradas.</p>
        ) : (
          <ol className="rounded-2xl border border-border bg-card overflow-hidden">
            {stops.map((s) => s.stop ? (
              <li key={`${s.sequence}-${s.stop.stop_id}`} className="border-b border-border/60 last:border-b-0">
                <Link to="/tram/parada/$stopId" params={{ stopId: s.stop.stop_id }}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30 active:scale-[0.99] transition">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: lineColor }}>{s.sequence}</span>
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="flex-1 text-sm">{s.stop.stop_name}</span>
                  {s.departure_time && <span className="text-[10px] tabular-nums text-muted-foreground">{s.departure_time.slice(0, 5)}</span>}
                </Link>
              </li>
            ) : null)}
          </ol>
        )}
      </div>
    </main>
  );
}
