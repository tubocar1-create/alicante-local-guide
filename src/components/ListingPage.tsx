import { useEffect, useMemo, useState } from "react";
import { Loader2, Navigation } from "lucide-react";
import { fetchListings, type Listing } from "@/lib/overpass-listings";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import ReferralDialog from "@/components/ReferralDialog";
import { ListingCard } from "@/components/ListingCard";

export type FilterChip<K extends string> = { kind: K; label: string; emoji: string };

type Props<K extends string> = {
  title: string;
  subtitle: string;
  filters: FilterChip<K>[];
  initial: K[];
  toOverpass: (kinds: K[]) => { tag: string; value: string }[];
  /** Optional: extra UI extras like "Buscar Airbnb" link in stays */
  externalSearch?: { label: string; url: (q: string) => string }[];
  /** Optional: featured listings pinned at the top of the grid */
  featured?: Listing[];
};

type Sort = "distance" | "rating" | "name";

export function ListingPage<K extends string>(props: Props<K>) {
  const [active, setActive] = useState<Set<K>>(new Set(props.initial));
  const [items, setItems] = useState<Listing[]>([]);
  const [referral, setReferral] = useState<Listing | null>(null);
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
        <div className="mx-auto w-full max-w-7xl px-4 py-3 md:px-8 md:py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-semibold leading-tight md:text-3xl">
                {props.title}
              </h1>
              <p className="text-xs text-muted-foreground md:text-sm">{props.subtitle}</p>
            </div>
            <button
              onClick={request}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground active:scale-95 md:px-4 md:py-2.5 md:text-sm"
            >
              <Navigation className="h-3.5 w-3.5" />
              {me ? "Ubicación ✓" : "Mi ubicación"}
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-3 md:mt-4 md:flex-row md:items-center md:gap-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, tipo de comida, calle…"
              className="w-full rounded-full border bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring md:flex-1 md:py-2.5 md:text-base"
            />
            <div className="hidden shrink-0 items-center gap-1 text-xs text-muted-foreground md:flex">
              <span>Ordenar:</span>
              {(["distance", "rating", "name"] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-full px-3 py-1.5 ${
                    sort === s ? "bg-secondary text-secondary-foreground" : "hover:bg-muted"
                  }`}
                  disabled={s === "distance" && !me}
                >
                  {s === "distance" ? "Cercanía" : s === "rating" ? "★" : "A-Z"}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {props.filters.map((f) => {
              const on = active.has(f.kind);
              return (
                <button
                  key={f.kind}
                  onClick={() => toggle(f.kind)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition md:text-sm ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <span>{f.emoji}</span>
                  {f.label}
                </button>
              );
            })}
            <div className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground md:hidden">
              <span>Ordenar:</span>
              {(["distance", "rating", "name"] as Sort[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={`rounded-full px-2 py-1 ${
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

      <main className="mx-auto w-full max-w-7xl px-4 py-4 md:px-8 md:py-8">
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

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:gap-5">
          {(props.featured ?? []).map((it) => (
            <li key={`featured-${it.id}`}>
              <ListingCard it={it} me={me} onWantToGo={setReferral} />
            </li>
          ))}
          {visible.map((it) => (
            <li key={it.id}>
              <ListingCard it={it} me={me} onWantToGo={setReferral} />
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-muted-foreground text-center mt-6 pb-6">
          Datos abiertos © OpenStreetMap contributors
        </p>
      </main>
      {referral && (
        <ReferralDialog
          placeId={String(referral.id)}
          placeName={referral.name}
          onClose={() => setReferral(null)}
        />
      )}
    </div>
  );
}
