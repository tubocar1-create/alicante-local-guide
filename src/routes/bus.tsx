import { createFileRoute, Link } from "@tanstack/react-router";
import { LEAFLET_HEAD_LINK } from "@/lib/leaflet-head";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bus, ExternalLink, Search, MapPin, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { isValidStopCode } from "@/lib/bus";
import { useUserLocation } from "@/hooks/useUserLocation";
import { geocodeBusStops } from "@/lib/bus-geocode.functions";
import { haversineKm, type MapStop, type LineRoute } from "@/components/BusMap";
import { StopRealtimeSheet, type StopRealtimeContext } from "@/components/StopRealtimeSheet";

const BusMapLazy = lazy(() =>
  import("@/components/BusMap").then((m) => ({ default: m.BusMap })),
);

type Stop = {
  code: string;
  name: string | null;
  lines: string[] | null;
  lat: number | null;
  lng: number | null;
};

type LineRow = { code: string; name: string; color: string | null };
type LineStopRow = { line_code: string; direction: number; seq: number; stop_code: string | null };

const PALETTE = [
  "#E84E2C", "#3FA9F5", "#7BC043", "#F4B400", "#9B59B6",
  "#1ABC9C", "#E91E63", "#34495E", "#FF7F50", "#00ACC1",
];

export const Route = createFileRoute("/bus")({
  head: () => ({
    meta: [
      { title: "Buses en vivo · Alicante" },
      {
        name: "description",
        content:
          "Mapa de paradas de Alicante con tiempos de paso en vivo. Encuentra las paradas más cercanas y consulta los próximos buses.",
      },
    ],
  }),
  component: BusPage,
});

function BusPage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [lines, setLines] = useState<LineRow[]>([]);
  const [lineStops, setLineStops] = useState<LineStopRow[]>([]);
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeStop, setActiveStop] = useState<StopRealtimeContext | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const loc = useUserLocation({ watch: true });
  const userCoords = loc.state.status === "ready" ? loc.state.coords : null;
  useEffect(() => {
    if (loc.state.status === "idle") loc.request();
  }, [loc]);

  const runGeocode = useServerFn(geocodeBusStops);

  const refresh = async () => {
    const [stopsRes, linesRes, lsRes] = await Promise.all([
      supabase.from("bus_stops").select("code,name,lines,lat,lng").order("code"),
      supabase.from("bus_lines").select("code,name,color").order("code"),
      supabase.from("bus_line_stops").select("line_code,direction,seq,stop_code").order("line_code").order("direction").order("seq"),
    ]);
    setStops((stopsRes.data ?? []) as Stop[]);
    setLines((linesRes.data ?? []) as LineRow[]);
    setLineStops((lsRes.data ?? []) as LineStopRow[]);
    setLoading(false);
  };

  useEffect(() => {
    setMounted(true);
    refresh();
  }, []);

  const openStop = (s: StopRealtimeContext) => {
    setActiveStop(s);
    setSheetOpen(true);
  };

  const openByCode = (c: string) => {
    if (!isValidStopCode(c)) return;
    const found = stops.find((x) => x.code === c.trim());
    openStop(
      found
        ? { code: found.code, name: found.name, lines: found.lines, lat: found.lat, lng: found.lng }
        : { code: c.trim(), name: null, lines: null, lat: null, lng: null },
    );
  };


  const mapStops: MapStop[] = useMemo(
    () =>
      stops
        .filter((s): s is Stop & { lat: number; lng: number } => s.lat != null && s.lng != null)
        .map((s) => ({ code: s.code, name: s.name, lines: s.lines, lat: s.lat, lng: s.lng })),
    [stops],
  );

  const nearest = useMemo(() => {
    if (!userCoords) return [];
    return mapStops
      .map((s) => ({ ...s, distKm: haversineKm(userCoords, { lat: s.lat, lng: s.lng }) }))
      .sort((a, b) => a.distKm - b.distKm)
      .slice(0, 5);
  }, [mapStops, userCoords]);

  const stopCoordIndex = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const s of mapStops) m.set(s.code, [s.lat, s.lng]);
    return m;
  }, [mapStops]);

  const lineColor = useMemo(() => {
    const m = new Map<string, string>();
    lines.forEach((l, i) => m.set(l.code, l.color || PALETTE[i % PALETTE.length]));
    return m;
  }, [lines]);

  const routes: LineRoute[] = useMemo(() => {
    if (!lineStops.length) return [];
    const groups = new Map<string, LineStopRow[]>();
    for (const r of lineStops) {
      const k = `${r.line_code}|${r.direction}`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const out: LineRoute[] = [];
    for (const [k, rows] of groups) {
      const [lineCode, dirStr] = k.split("|");
      if (selectedLines.size && !selectedLines.has(lineCode)) continue;
      const points: [number, number][] = [];
      for (const r of rows.sort((a, b) => a.seq - b.seq)) {
        const c = r.stop_code ? stopCoordIndex.get(r.stop_code) : undefined;
        if (c) points.push(c);
      }
      if (points.length >= 2) {
        out.push({
          lineCode,
          direction: Number(dirStr),
          color: lineColor.get(lineCode) || "#666",
          points,
        });
      }
    }
    return out;
  }, [lineStops, stopCoordIndex, lineColor, selectedLines]);

  const toggleLine = (code: string) =>
    setSelectedLines((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  const ungeocoded = stops.length - mapStops.length;

  const handleGeocode = async () => {
    setGeocoding(true);
    try {
      const r = await runGeocode();
      console.log("geocode result", r);
      await refresh();
    } finally {
      setGeocoding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Buses en vivo</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/bus/planner"
            className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Search className="h-4 w-4" /> Cómo ir
          </Link>
          <Link
            to="/bus/lines"
            className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Bus className="h-4 w-4" /> Líneas
          </Link>
        </div>
        <Card className="p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Introduce el código de 4 dígitos de la parada para ver los próximos buses en tiempo real.
          </p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              openByCode(code);
            }}
          >
            <Input
              inputMode="numeric"
              pattern="\d*"
              maxLength={5}
              placeholder="Ej. 4081"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <Button type="submit" disabled={!isValidStopCode(code)}>
              <Search className="mr-2 h-4 w-4" /> Ver
            </Button>
          </form>
        </Card>

        {/* Map */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Mapa de paradas
            </h2>
            {ungeocoded > 0 && (
              <Button size="sm" variant="outline" onClick={handleGeocode} disabled={geocoding}>
                {geocoding ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Geocodificar {ungeocoded}
              </Button>
            )}
          </div>
          {mounted ? (
            <Suspense
              fallback={
                <div className="flex h-[420px] items-center justify-center rounded-xl border text-sm text-muted-foreground">
                  Cargando mapa…
                </div>
              }
            >
              <BusMapLazy stops={mapStops} user={userCoords} routes={routes} />
            </Suspense>
          ) : (
            <div className="h-[420px] rounded-xl border" />
          )}

          {lines.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedLines(new Set())}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedLines.size === 0
                    ? "border-primary bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                Todas
              </button>
              {lines.map((l) => {
                const active = selectedLines.has(l.code);
                const color = lineColor.get(l.code) || "#666";
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => toggleLine(l.code)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      active ? "text-white" : "bg-background hover:bg-muted"
                    }`}
                    style={active ? { backgroundColor: color, borderColor: color } : undefined}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    L{l.code}
                  </button>
                );
              })}
            </div>
          )}
          {mapStops.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground">
              Aún no hay paradas con coordenadas. Pulsa <strong>Geocodificar</strong> para
              calcularlas con Google Places.
            </p>
          )}
        </section>

        {/* Nearest */}
        {userCoords && nearest.length > 0 && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              <MapPin className="h-4 w-4" /> Cerca de ti
            </h2>
            <ul className="space-y-2">
              {nearest.map((s) => (
                <li key={s.code}>
                  <button
                    type="button"
                    onClick={() => openStop({ code: s.code, name: s.name, lines: s.lines, lat: s.lat, lng: s.lng })}
                    className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bus className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {s.code}
                          {s.name ? ` · ${s.name}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(s.distKm * 1000).toFixed(0)} m
                          {s.lines && s.lines.length > 0 && ` · Líneas ${s.lines.join(", ")}`}
                        </div>
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Full list */}
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Todas las paradas ({stops.length})
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <ul className="space-y-2">
              {stops.map((s) => (
                <li key={s.code}>
                  <button
                    type="button"
                    onClick={() => openStop({ code: s.code, name: s.name, lines: s.lines, lat: s.lat, lng: s.lng })}
                    className="flex w-full items-center justify-between rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bus className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {s.code}
                          {s.name ? ` · ${s.name}` : ""}
                        </div>
                        {s.lines && s.lines.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Líneas: {s.lines.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <StopRealtimeSheet stop={activeStop} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}
