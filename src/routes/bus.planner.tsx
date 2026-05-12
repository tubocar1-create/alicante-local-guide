import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRightLeft, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBusGraph } from "@/hooks/useBusGraph";
import { findTrips } from "@/lib/bus-routing";
import { TripTimeline } from "@/components/TripTimeline";

export const Route = createFileRoute("/bus/planner")({
  head: () => ({
    meta: [
      { title: "Cómo ir en bus · Alicante" },
      {
        name: "description",
        content:
          "Planifica tu trayecto en bus por Alicante con esquema visual, tiempos estimados y llegadas en vivo.",
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
      .filter((s) => (isCode ? s.code.startsWith(term) : s.name.toLowerCase().includes(term)))
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

function PlannerPage() {
  const { data, loading } = useBusGraph();
  const [origin, setOrigin] = useState<StopOption | null>(null);
  const [dest, setDest] = useState<StopOption | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  const options: StopOption[] = useMemo(() => {
    if (!data) return [];
    return data.stopsMeta
      .filter((s) => s.name)
      .map((s) => ({ code: s.code, name: s.name as string }));
  }, [data]);

  const coords = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const s of data?.stopsMeta ?? []) {
      if (s.lat != null && s.lng != null) m.set(s.code, { lat: s.lat, lng: s.lng });
    }
    return m;
  }, [data]);

  const lineColors = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const l of data?.lines ?? []) m.set(l.code, l.color);
    return m;
  }, [data]);

  const lineIndex = useMemo(() => {
    const m = new Map<string, number>();
    (data?.lines ?? []).forEach((l, i) => m.set(l.code, i));
    return m;
  }, [data]);

  const trips = useMemo(() => {
    if (!data || !origin || !dest) return [];
    return findTrips(data.stops, origin.code, dest.code, { maxResults: 8 });
  }, [data, origin, dest]);

  const swap = () => {
    setOrigin(dest);
    setDest(origin);
    setSelectedIdx(0);
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
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <StopAutocomplete
            label="Desde"
            value={origin}
            onChange={(v) => {
              setOrigin(v);
              setSelectedIdx(0);
            }}
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
            onChange={(v) => {
              setDest(v);
              setSelectedIdx(0);
            }}
            options={options}
            placeholder="Nombre o código de parada…"
          />
        </div>

        {loading && <p className="text-sm text-muted-foreground">Cargando red de líneas…</p>}

        {!loading && origin && dest && trips.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No encontramos un trayecto directo ni con un transbordo entre estas paradas.
          </p>
        )}

        {trips.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {trips.length} opciones · ordenadas por menos transbordos y paradas. La más rápida está
            seleccionada por defecto.
          </p>
        )}

        <div className="space-y-3">
          {trips.map((t, i) => (
            <TripTimeline
              key={i}
              trip={t}
              coords={coords}
              lineColors={lineColors}
              lineIndex={lineIndex}
              selected={i === selectedIdx}
              onSelect={() => setSelectedIdx(i)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
