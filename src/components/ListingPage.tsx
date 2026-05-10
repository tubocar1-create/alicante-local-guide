import { useEffect, useMemo, useState } from "react";
import { Loader2, Navigation, Phone, Globe, MapPin, Star } from "lucide-react";
import { fetchListings, type Listing } from "@/lib/overpass-listings";
import { useUserLocation, distanceKm, formatDistance } from "@/hooks/useUserLocation";

export type FilterChip<K extends string> = { kind: K; label: string; emoji: string };

type Props<K extends string> = {
  title: string;
  subtitle: string;
  filters: FilterChip<K>[];
  initial: K[];
  toOverpass: (kinds: K[]) => { tag: string; value: string }[];
  /** Optional: extra UI extras like "Buscar Airbnb" link in stays */
  externalSearch?: { label: string; url: (q: string) => string }[];
};

type Sort = "distance" | "rating" | "name";

export function ListingPage<K extends string>(props: Props<K>) {
  const [active, setActive] = useState<Set<K>>(new Set(props.initial));
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("distance");
  const { state, request } = useUserLocation();
  const me = state.status === "ready" ? state.coords : null;

  useEffect(() => {
    let cancelled = false;
    const kinds = Array.from(active);
    if (kinds.length === 0) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchListings(props.toOverpass(kinds))
      .then((d) => !cancelled && setItems(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let arr = items;
    if (q) {
      arr = arr.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.cuisine?.toLowerCase().includes(q) ||
          i.address?.toLowerCase().includes(q),
      );
    }
    arr = [...arr].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rating") return (b.stars ?? 0) - (a.stars ?? 0);
      if (sort === "distance" && me) {
        const da = distanceKm(me, { lat: a.lat, lng: a.lon });
        const db = distanceKm(me, { lat: b.lat, lng: b.lon });
        return da - db;
      }
      return 0;
    });
    return arr.slice(0, 200);
  }, [items, search, sort, me]);

  function toggle(k: K) {
    setActive((prev) => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold leading-tight">{props.title}</h1>
              <p className="text-xs text-muted-foreground">{props.subtitle}</p>
            </div>
            <button
              onClick={request}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full bg-primary text-primary-foreground active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
              {me ? "Ubicación ✓" : "Mi ubicación"}
            </button>
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, tipo de comida, calle…"
            className="mt-3 w-full text-sm rounded-full border bg-background px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex gap-2 mt-3 overflow-x-auto -mx-4 px-4 pb-1 no-scrollbar">
            {props.filters.map((f) => {
              const on = active.has(f.kind);
              return (
                <button
                  key={f.kind}
                  onClick={() => toggle(f.kind)}
                  className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <span>{f.emoji}</span>
                  {f.label}
                </button>
              );
            })}
            <div className="ml-auto shrink-0 flex items-center gap-1 text-xs text-muted-foreground">
              <span>Ordenar:</span>
              {(["distance", "rating", "name"] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`px-2 py-1 rounded-full ${
                    sort === s ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"
                  }`}
                  disabled={s === "distance" && !me}
                >
                  {s === "distance" ? "Cercanía" : s === "rating" ? "★" : "A-Z"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos abiertos…
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive py-4">No se pudieron cargar: {error}</div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Sin resultados. Prueba a activar más filtros.
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {visible.map((it) => {
            const dist = me ? distanceKm(me, { lat: it.lat, lng: it.lon }) : null;
            const mapsHref = `https://www.google.com/maps/dir/?api=1&destination=${it.lat},${it.lon}`;
            const wikiSlug = it.wikipedia?.split(":")[1];
            return (
              <li
                key={it.id}
                className="rounded-2xl bg-card shadow-soft border p-4 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base leading-tight truncate">
                      {it.name}
                    </h3>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                      {it.kind.replace(/_/g, " ")}
                      {it.cuisine ? ` · ${it.cuisine.replace(/;/g, ", ")}` : ""}
                    </div>
                  </div>
                  {it.stars ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium bg-accent text-accent-foreground rounded-full px-2 py-0.5 shrink-0">
                      <Star className="w-3 h-3 fill-current" />
                      {it.stars}
                    </span>
                  ) : null}
                </div>

                {it.address && (
                  <div className="text-xs text-muted-foreground flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{it.address}</span>
                  </div>
                )}
                {dist != null && (
                  <div className="text-xs text-muted-foreground">
                    📍 a {formatDistance(dist)} de ti
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-primary text-primary-foreground"
                  >
                    <Navigation className="w-3 h-3" /> Cómo llegar
                  </a>
                  {it.phone && (
                    <a
                      href={`tel:${it.phone}`}
                      className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      <Phone className="w-3 h-3" /> Llamar
                    </a>
                  )}
                  {it.website && (
                    <a
                      href={it.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      <Globe className="w-3 h-3" /> Web
                    </a>
                  )}
                  {wikiSlug && (
                    <a
                      href={`https://es.wikipedia.org/wiki/${encodeURIComponent(wikiSlug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      Wiki
                    </a>
                  )}
                  {props.externalSearch?.map((ext) => (
                    <a
                      key={ext.label}
                      href={ext.url(it.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground"
                    >
                      {ext.label}
                    </a>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-muted-foreground text-center mt-6 pb-6">
          Datos abiertos © OpenStreetMap contributors
        </p>
      </main>
    </div>
  );
}
