import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowRightLeft, Search, Bus, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBusGraph } from "@/hooks/useBusGraph";
import { findTrips, type Trip } from "@/lib/bus-routing";

export const Route = createFileRoute("/bus/planner")({
  head: () => ({
    meta: [
      { title: "Cómo ir en bus · Alicante" },
      {
        name: "description",
        content:
          "Planifica tu trayecto en bus por Alicante. Encuentra la línea directa o el mejor transbordo entre dos paradas.",
      },
    ],
  }),
  component: PlannerPage,
});

type StopOption = { code: string; name: string };

function StopAutocomplete({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: StopOption | null;
  onChange: (v: StopOption | null) => void;
  options: StopOption[];
  placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const isCode = /^\d+$/.test(term);
    return options
      .filter((s) => {
        if (isCode) return s.code.startsWith(term);
        return s.name.toLowerCase().includes(term);
      })
      .slice(0, 8);
  }, [q, options]);

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {value ? (
        <div className="flex items-center justify-between rounded-lg border bg-card p-2">
          <div className="text-sm">
            <span className="font-medium">{value.code}</span> · {value.name}
          </div>
          <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
            Cambiar
          </Button>
        </div>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={placeholder}
              className="pl-9"
            />
          </div>
          {open && filtered.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover shadow-lg">
              {filtered.map((s) => (
                <li key={s.code}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(s);
                      setQ("");
                      setOpen(false);
                    }}
                  >
                    <Badge variant="outline" className="font-mono">
                      {s.code}
                    </Badge>
                    <span className="truncate">{s.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {trip.transfers === 0 ? (
            <Badge className="bg-emerald-600 text-white">Directo</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Repeat className="h-3 w-3" /> {trip.transfers} transbordo
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {trip.totalStops} paradas
          </span>
        </div>
        <div className="flex items-center gap-1">
          {trip.legs.map((l, i) => (
            <span key={i} className="flex items-center gap-1">
              <Badge className="rounded-full bg-primary text-primary-foreground">
                L{l.lineCode}
              </Badge>
              {i < trip.legs.length - 1 && (
                <ArrowRightLeft className="h-3 w-3 text-muted-foreground" />
              )}
            </span>
          ))}
        </div>
      </div>

      <ol className="space-y-2">
        {trip.legs.map((leg, i) => (
          <li key={i} className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Bus className="h-3.5 w-3.5" /> Línea {leg.lineCode} · sentido {leg.direction === 1 ? "Ida" : "Vuelta"}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex-1">
                <div className="font-medium">{leg.fromName}</div>
                <div className="text-xs text-muted-foreground">Parada {leg.fromCode}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 text-right">
                <div className="font-medium">{leg.toName}</div>
                <div className="text-xs text-muted-foreground">Parada {leg.toCode}</div>
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {leg.numStops} paradas en este tramo
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function PlannerPage() {
  const { data, loading } = useBusGraph();
  const [origin, setOrigin] = useState<StopOption | null>(null);
  const [dest, setDest] = useState<StopOption | null>(null);

  const options: StopOption[] = useMemo(() => {
    if (!data) return [];
    return data.stopsMeta
      .filter((s) => s.name)
      .map((s) => ({ code: s.code, name: s.name as string }));
  }, [data]);

  const trips = useMemo(() => {
    if (!data || !origin || !dest) return [];
    return findTrips(data.stops, origin.code, dest.code, { maxResults: 12 });
  }, [data, origin, dest]);

  const swap = () => {
    setOrigin(dest);
    setDest(origin);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link
            to="/bus"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-semibold">Cómo ir</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
        <Card className="space-y-3 p-4">
          <StopAutocomplete
            label="Desde"
            value={origin}
            onChange={setOrigin}
            options={options}
            placeholder="Nombre o código de parada…"
          />
          <div className="flex justify-center">
            <Button size="sm" variant="ghost" onClick={swap} disabled={!origin && !dest}>
              <ArrowRightLeft className="mr-1 h-3 w-3" /> Invertir
            </Button>
          </div>
          <StopAutocomplete
            label="Hasta"
            value={dest}
            onChange={setDest}
            options={options}
            placeholder="Nombre o código de parada…"
          />
        </Card>

        {loading && (
          <p className="text-sm text-muted-foreground">Cargando red de líneas…</p>
        )}

        {!loading && origin && dest && trips.length === 0 && (
          <Card className="p-4 text-sm text-muted-foreground">
            No encontramos un trayecto directo ni con un transbordo entre estas paradas.
            Es posible que requiera dos transbordos o que no haya servicio entre ellas
            con las líneas disponibles.
          </Card>
        )}

        <div className="space-y-3">
          {trips.map((t, i) => (
            <TripCard key={i} trip={t} />
          ))}
        </div>
      </main>
    </div>
  );
}
