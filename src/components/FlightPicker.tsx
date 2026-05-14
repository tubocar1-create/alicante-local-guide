import { useEffect, useMemo, useState } from "react";
import { Loader2, Plane, Search, X } from "lucide-react";

type Flight = {
  numVuelo: string;
  fecha: string;
  horaProgramada: string;
  horaEstimada?: string;
  iataOtro: string;
  ciudad: string;
  estado?: string;
  terminal?: string;
  puerta?: string;
  mostrador?: string;
  compania?: string;
  iataCompania?: string;
  aeronave?: string;
};

type Tab = "mine" | "destinations";
type Direction = "S" | "L";

const ESTADO_LABEL: Record<string, { text: string; cls: string }> = {
  BOR: { text: "Programado", cls: "bg-muted text-muted-foreground" },
  C: { text: "Cancelado", cls: "bg-destructive/15 text-destructive" },
  T: { text: "Embarcando", cls: "bg-primary/15 text-primary" },
  E: { text: "Embarcando", cls: "bg-primary/15 text-primary" },
  Z: { text: "Despegado", cls: "bg-emerald-500/15 text-emerald-600" },
  A: { text: "Aterrizado", cls: "bg-emerald-500/15 text-emerald-600" },
  R: { text: "Retrasado", cls: "bg-amber-500/15 text-amber-700" },
};

function estadoBadge(e?: string) {
  if (!e) return null;
  const meta = ESTADO_LABEL[e] ?? { text: e, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.cls}`}>
      {meta.text}
    </span>
  );
}

function fmtDate(d: string) {
  // dd/mm/yyyy → dd MMM
  const [dd, mm] = d.split("/");
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${dd} ${months[Number(mm) - 1] ?? mm}`;
}

export function FlightPicker({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("mine");
  const [direction, setDirection] = useState<Direction>("S");
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/public/aena-flights?airport=ALC&type=${direction}`)
      .then((r) => r.json())
      .then((d: { flights?: Flight[]; error?: string }) => {
        if (cancelled) return;
        if (d.error) setError(d.error);
        setFlights(d.flights ?? []);
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [direction]);

  // Lista única de ciudades (ordenada alfabéticamente)
  const cities = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of flights) {
      map.set(f.ciudad, (map.get(f.ciudad) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], "es"))
      .map(([ciudad, count]) => ({ ciudad, count }));
  }, [flights]);

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => c.ciudad.toLowerCase().includes(q));
  }, [cities, query]);

  const cityFlights = useMemo(() => {
    if (!selectedCity) return [];
    return flights.filter((f) => f.ciudad === selectedCity);
  }, [flights, selectedCity]);

  const myFlightMatches = useMemo(() => {
    const q = query.trim().toUpperCase().replace(/\s+/g, "");
    if (q.length < 2) return [];
    return flights
      .filter((f) => f.numVuelo.toUpperCase().includes(q))
      .slice(0, 30);
  }, [flights, query]);

  // Rango de fechas que cubrimos
  const dateRange = useMemo(() => {
    const dates = [...new Set(flights.map((f) => f.fecha))];
    if (!dates.length) return null;
    return `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;
  }, [flights]);

  return (
    <div className="rounded-2xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Aeropuerto Alicante-Elche (ALC)</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-muted-foreground hover:bg-accent/40"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs principales */}
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-xs">
        <button
          onClick={() => {
            setTab("mine");
            setSelectedCity(null);
            setQuery("");
          }}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${
            tab === "mine" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          Mi vuelo
        </button>
        <button
          onClick={() => {
            setTab("destinations");
            setQuery("");
          }}
          className={`rounded-lg px-3 py-1.5 font-medium transition ${
            tab === "destinations" ? "bg-background shadow-sm" : "text-muted-foreground"
          }`}
        >
          Ver destinos
        </button>
      </div>

      {/* Salidas / Llegadas */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background/60 p-0.5 text-[11px]">
          <button
            onClick={() => setDirection("S")}
            className={`rounded-md px-2 py-1 transition ${
              direction === "S" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Salidas
          </button>
          <button
            onClick={() => setDirection("L")}
            className={`rounded-md px-2 py-1 transition ${
              direction === "L" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Llegadas
          </button>
        </div>
        {dateRange && (
          <span className="text-[10px] text-muted-foreground">
            Próx. días: {dateRange}
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          <span className="text-sm">Cargando vuelos de AENA…</span>
        </div>
      )}

      {!loading && error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
          No pude conectar con AENA ahora mismo. Inténtalo en unos minutos.
        </p>
      )}

      {!loading && !error && tab === "mine" && (
        <div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nº de vuelo (ej. FR4156, IB3140)"
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
              autoFocus
            />
          </div>
          {query.trim().length < 2 ? (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Escribe el código de tu vuelo para ver hora, terminal y estado.
            </p>
          ) : myFlightMatches.length === 0 ? (
            <p className="px-1 py-3 text-xs text-muted-foreground">
              No hay vuelos con ese código en los próximos días en ALC.
            </p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {myFlightMatches.map((f, i) => (
                <FlightRow key={`${f.numVuelo}-${f.fecha}-${i}`} f={f} dir={direction} />
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && !error && tab === "destinations" && !selectedCity && (
        <div>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Buscar ciudad${direction === "S" ? " destino" : " origen"}…`}
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <p className="mb-1 px-1 text-[11px] text-muted-foreground">
            {filteredCities.length} ciudades programadas
          </p>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {filteredCities.map((c) => (
              <li key={c.ciudad}>
                <button
                  onClick={() => setSelectedCity(c.ciudad)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2 text-left text-sm transition hover:bg-accent/40"
                >
                  <span className="truncate pr-2">{c.ciudad}</span>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {c.count} vuelo{c.count === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && !error && tab === "destinations" && selectedCity && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="truncate text-sm font-medium">{selectedCity}</p>
            <button
              onClick={() => setSelectedCity(null)}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              ← Volver
            </button>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {cityFlights.map((f, i) => (
              <FlightRow key={`${f.numVuelo}-${f.fecha}-${i}`} f={f} dir={direction} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FlightRow({ f, dir }: { f: Flight; dir: Direction }) {
  return (
    <li className="rounded-lg border border-border bg-background/60 px-3 py-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{f.numVuelo}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{fmtDate(f.fecha)}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono">{f.horaProgramada}</span>
          {f.horaEstimada && f.horaEstimada !== f.horaProgramada && (
            <span className="text-amber-600">→ {f.horaEstimada}</span>
          )}
        </div>
        {estadoBadge(f.estado)}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        {f.compania && <span>{f.compania}</span>}
        <span>
          {dir === "S" ? "→" : "←"} {f.iataOtro} {f.ciudad}
        </span>
        {f.terminal && <span>T{f.terminal}</span>}
        {f.puerta && <span>Puerta {f.puerta}</span>}
        {f.mostrador && dir === "S" && <span>Most. {f.mostrador}</span>}
      </div>
    </li>
  );
}
