import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBusGraph } from "@/hooks/useBusGraph";
import type { RouteStop } from "@/lib/bus-routing";
import { cumulativeMinutes, formatMinutes } from "@/lib/bus-eta";
import { StopRealtimeSheet, type StopRealtimeContext } from "@/components/StopRealtimeSheet";

export const Route = createFileRoute("/bus/lines/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Línea ${params.code} · Buses Alicante` },
      {
        name: "description",
        content: `Paradas y recorrido de la Línea ${params.code} de Vectalia en Alicante, con tiempos de paso en vivo.`,
      },
    ],
  }),
  component: LineDetailPage,
});

function LineDetailPage() {
  const { code } = Route.useParams();
  const { data, loading } = useBusGraph();
  const [direction, setDirection] = useState<1 | 2>(1);
  const [activeStop, setActiveStop] = useState<StopRealtimeContext | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const line = data?.lines.find((l) => l.code === code);

  const stopsByDir = useMemo(() => {
    const out: Record<1 | 2, RouteStop[]> = { 1: [], 2: [] };
    if (!data) return out;
    for (const s of data.stops) {
      if (s.line_code !== code) continue;
      if (s.direction === 1 || s.direction === 2) out[s.direction as 1 | 2].push(s);
    }
    out[1].sort((a, b) => a.seq - b.seq);
    out[2].sort((a, b) => a.seq - b.seq);
    return out;
  }, [data, code]);

  const stopMeta = useMemo(() => {
    const m = new Map<string, { name: string | null; lat: number | null; lng: number | null }>();
    for (const s of data?.stopsMeta ?? []) m.set(s.code, { name: s.name, lat: s.lat, lng: s.lng });
    return m;
  }, [data]);

  const coords = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const s of data?.stopsMeta ?? []) {
      if (s.lat != null && s.lng != null) m.set(s.code, { lat: s.lat, lng: s.lng });
    }
    return m;
  }, [data]);

  const list = stopsByDir[direction];
  const cumMins = useMemo(
    () => cumulativeMinutes(list.map((s) => s.stop_code ?? ""), coords),
    [list, coords],
  );
  const totalMin = cumMins.length > 0 ? Math.round(cumMins[cumMins.length - 1]) : 0;
  const headsign =
    list.length > 0 ? `→ ${list[list.length - 1].stop_name}` : "";

  const open = (stopCode: string | null, name: string) => {
    if (!stopCode) return;
    const meta = stopMeta.get(stopCode);
    setActiveStop({
      code: stopCode,
      name: meta?.name ?? name,
      lines: [code],
      lat: null,
      lng: null,
    });
    setSheetOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/bus/lines"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: line?.color || "hsl(var(--primary))" }}
            >
              {code}
            </div>
            <h1 className="text-base font-semibold capitalize">{line?.name ?? `Línea ${code}`}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <div className="flex gap-2">
          <Button
            variant={direction === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => setDirection(1)}
            disabled={stopsByDir[1].length === 0}
          >
            Ida
          </Button>
          <Button
            variant={direction === 2 ? "default" : "outline"}
            size="sm"
            onClick={() => setDirection(2)}
            disabled={stopsByDir[2].length === 0}
          >
            Vuelta
          </Button>
          {headsign && (
            <span className="ml-auto self-center text-xs text-muted-foreground truncate max-w-[60%]">
              {headsign}
            </span>
          )}
        </div>

        {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {!loading && list.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">
            Sin datos de paradas para este sentido.
          </Card>
        )}

        {list.length > 0 && (
          <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Recorrido completo</span>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums">~{formatMinutes(totalMin)}</div>
              <div className="text-[11px] text-muted-foreground">{list.length} paradas</div>
            </div>
          </div>
        )}

        <ol className="relative space-y-0 pl-6">
          {/* Línea de color del recorrido */}
          {list.length > 1 && (
            <span
              aria-hidden
              className="absolute left-2 top-2 bottom-2 w-1 rounded-full"
              style={{ backgroundColor: line?.color || "hsl(var(--primary))" }}
            />
          )}
          {list.map((s, i) => {
            const m = Math.round(cumMins[i] ?? 0);
            const delta = i === 0 ? 0 : Math.round((cumMins[i] ?? 0) - (cumMins[i - 1] ?? 0));
            return (
              <li key={`${s.stop_code}-${i}`} className="relative pb-3">
                <span
                  className="absolute -left-[2px] top-3 h-3.5 w-3.5 rounded-full border-2 bg-background"
                  style={{ borderColor: line?.color || "hsl(var(--primary))" }}
                />
                <button
                  type="button"
                  onClick={() => open(s.stop_code, s.stop_name)}
                  className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{s.stop_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.stop_code ? `Parada ${s.stop_code}` : "Sin código"}
                        {i > 0 && <span className="ml-2">· +{delta} min</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {i === 0 ? "0 min" : `${m} min`}
                      </span>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </main>

      <StopRealtimeSheet stop={activeStop} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
