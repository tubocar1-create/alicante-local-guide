import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { X, Star, Search } from "lucide-react";
import { getDrinksPlaces } from "@/lib/places.functions";

export const Route = createFileRoute("/nocturno")({
  head: () => ({
    meta: [
      { title: "Dashboard Nocturno · Bares y Copas en Alicante" },
      {
        name: "description",
        content:
          "Tabla con todos los bares, pubs, cocktail bars, cervecerías y discotecas de Alicante. Ordena por valoración, precio o estado.",
      },
      { property: "og:title", content: "Dashboard Nocturno · Alicante" },
      {
        property: "og:description",
        content:
          "Bares, pubs, coctelerías, cervecerías y discotecas de Alicante en una sola tabla.",
      },
      { property: "og:url", content: "https://vamosalicante.com/nocturno" },
    ],
    links: [
      { rel: "canonical", href: "https://vamosalicante.com/nocturno" },
    ],
  }),
  component: NocturnoDashboard,
});

type DrinkPlace = {
  google_place_id: string;
  name: string;
  cuisine: string | null;
  primary_type: string | null;
  address: string | null;
  rating: number | null;
  user_rating_count: number | null;
  price_level: string | null;
  open_now: boolean | null;
  lat: number | null;
  lng: number | null;
};

// Bounding box aproximada de la provincia de Alicante.
function isInAlicante(p: DrinkPlace): boolean {
  if (p.lat != null && p.lng != null) {
    return p.lat >= 37.8 && p.lat <= 38.9 && p.lng >= -1.5 && p.lng <= 0.5;
  }
  const addr = (p.address ?? "").toLowerCase();
  return /alicante|alacant|elche|elx|benidorm|torrevieja|denia|altea|villajoyosa|orihuela|sant joan|santa pola|petrer|elda|alcoy|alcoi/.test(
    addr,
  );
}

function classify(p: DrinkPlace): "Discoteca" | "Cervecería" | "Coctelería" | "Pub" | "Bar" {
  const t = (p.primary_type ?? "").toLowerCase();
  const c = (p.cuisine ?? "").toLowerCase();
  if (t.includes("night_club") || t.includes("nightclub") || /discoteca|club/.test(c))
    return "Discoteca";
  if (/cerveceria|cervecería|brewery|cerveza/.test(c) || t.includes("brewery"))
    return "Cervecería";
  if (/cocktail|cocteler|coctel/.test(c)) return "Coctelería";
  if (/pub|irland/.test(c)) return "Pub";
  return "Bar";
}

function priceStr(p: DrinkPlace): string {
  if (!p.price_level) return "—";
  const n = Math.min(4, Math.max(1, Number(p.price_level.replace(/\D/g, "")) || 2));
  return "€".repeat(n);
}

function shortZone(addr: string | null): string {
  if (!addr) return "—";
  // Extrae la ciudad: penúltimo segmento por comas, o el primer match conocido.
  const parts = addr.split(",").map((s) => s.trim());
  for (const part of parts) {
    const m = part.match(
      /(Alicante|Alacant|Elche|Elx|Benidorm|Torrevieja|Denia|Altea|Villajoyosa|Orihuela|Sant Joan|Santa Pola|Petrer|Elda|Alcoy|Alcoi)/i,
    );
    if (m) return m[1];
  }
  return parts[parts.length - 2] ?? parts[0] ?? "—";
}

type SortKey = "rating" | "name" | "type" | "price" | "open";

function NocturnoDashboard() {
  const fetcher = useServerFn(getDrinksPlaces);
  const { data, isLoading } = useQuery({
    queryKey: ["places", "drinks"],
    queryFn: () => fetcher(),
    staleTime: 5 * 60 * 1000,
  });

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("Todos");
  const [sortKey, setSortKey] = useState<SortKey>("rating");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rows = useMemo(() => {
    const all = ((data?.places ?? []) as DrinkPlace[]).filter(isInAlicante);
    const enriched = all.map((p) => ({ ...p, _kind: classify(p) }));

    const filtered = enriched.filter((p) => {
      if (typeFilter !== "Todos" && p._kind !== typeFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.address ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "type":
          return a._kind.localeCompare(b._kind) * dir;
        case "price":
          return (priceStr(a).length - priceStr(b).length) * dir;
        case "open":
          return ((a.open_now ? 1 : 0) - (b.open_now ? 1 : 0)) * dir;
        case "rating":
        default:
          return ((a.rating ?? 0) - (b.rating ?? 0)) * dir;
      }
    });
    return filtered;
  }, [data, query, typeFilter, sortKey, sortDir]);

  const counts = useMemo(() => {
    const all = ((data?.places ?? []) as DrinkPlace[]).filter(isInAlicante);
    const c: Record<string, number> = { Todos: all.length };
    for (const p of all) {
      const k = classify(p);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [data]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(key === "name" || key === "type" ? "asc" : "desc");
    }
  };

  const TABS = ["Todos", "Bar", "Pub", "Coctelería", "Cervecería", "Discoteca"];

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #1a0a2e 0%, #2d1b4e 50%, #0f0820 100%)",
      }}
    >
      <main className="relative mx-auto max-w-6xl space-y-3 px-3 pb-24 pt-4">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 hover:text-white"
          >
            ← Volver
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-violet-300">
              Live · ALC
            </span>
            <Link
              to="/"
              aria-label="Cerrar"
              className="rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-violet-300/90">
            Dashboard Nocturno
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">
            Bares, copas y discotecas de Alicante
          </h1>
        </div>

        {/* Buscador */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o dirección…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder-white/40 outline-none focus:border-violet-400/40"
          />
        </div>

        {/* Filtros tipo */}
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
                  active
                    ? "border-violet-400 bg-violet-500/20 text-white"
                    : "border-white/15 bg-white/[0.04] text-white/70 hover:border-white/30"
                }`}
              >
                {t}
                <span className="ml-1 text-white/40">{counts[t] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <table className="min-w-full text-left text-xs md:text-sm">
            <thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/50">
              <tr>
                <Th onClick={() => toggleSort("open")} active={sortKey === "open"} dir={sortDir}>
                  •
                </Th>
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir}>
                  Local
                </Th>
                <Th onClick={() => toggleSort("type")} active={sortKey === "type"} dir={sortDir} className="hidden sm:table-cell">
                  Tipo
                </Th>
                <Th className="hidden md:table-cell">Zona</Th>
                <Th onClick={() => toggleSort("rating")} active={sortKey === "rating"} dir={sortDir}>
                  ⭐
                </Th>
                <Th onClick={() => toggleSort("price")} active={sortKey === "price"} dir={sortDir} className="hidden sm:table-cell">
                  €
                </Th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td colSpan={6} className="p-3">
                      <div className="h-4 animate-pulse rounded bg-white/[0.05]" />
                    </td>
                  </tr>
                ))}

              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-white/50">
                    Sin resultados con esos filtros.
                  </td>
                </tr>
              )}

              {!isLoading &&
                rows.map((p) => (
                  <tr
                    key={p.google_place_id}
                    className="border-t border-white/5 transition hover:bg-white/[0.05]"
                  >
                    <td className="px-2 py-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          p.open_now == null
                            ? "bg-white/20"
                            : p.open_now
                              ? "bg-emerald-400"
                              : "bg-rose-400"
                        }`}
                        title={
                          p.open_now == null
                            ? "Horario desconocido"
                            : p.open_now
                              ? "Abierto"
                              : "Cerrado"
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Link
                        to="/restaurants/$placeId"
                        params={{ placeId: p.google_place_id }}
                        className="font-medium text-white hover:text-violet-300"
                      >
                        {p.name}
                      </Link>
                      <div className="text-[10px] text-white/40 sm:hidden">
                        {p._kind} · {shortZone(p.address)}
                      </div>
                    </td>
                    <td className="hidden px-2 py-2 text-white/70 sm:table-cell">
                      {p._kind}
                    </td>
                    <td className="hidden px-2 py-2 text-white/60 md:table-cell">
                      {shortZone(p.address)}
                    </td>
                    <td className="px-2 py-2">
                      {p.rating != null ? (
                        <span className="inline-flex items-center gap-1 text-amber-300">
                          <Star className="h-3 w-3 fill-amber-300" />
                          {p.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="text-white/30">—</span>
                      )}
                    </td>
                    <td className="hidden px-2 py-2 text-white/60 sm:table-cell">
                      {priceStr(p)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <p className="pt-2 text-center text-[10px] text-white/40">
          {rows.length} resultados · datos en vivo
        </p>
      </main>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  dir,
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  dir?: "asc" | "desc";
  className?: string;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-2 py-2 font-medium ${onClick ? "cursor-pointer select-none hover:text-white" : ""} ${active ? "text-violet-300" : ""} ${className}`}
    >
      {children}
      {active && <span className="ml-0.5">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
