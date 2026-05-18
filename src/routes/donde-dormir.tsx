import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Star,
  Coffee,
  ShieldCheck,
  Navigation,
  Footprints,
  ExternalLink,
  Filter,
} from "lucide-react";
import { listHotels } from "@/lib/hotels.functions";

export const Route = createFileRoute("/donde-dormir")({
  head: () => ({
    meta: [
      { title: "Dónde dormir en Alicante esta noche · precios reales" },
      {
        name: "description",
        content:
          "Hoteles, hostales y apartamentos en Alicante con precio para esta noche, desayuno y cancelación gratis. Datos en directo.",
      },
    ],
  }),
  component: DondeDormirPage,
});

type SortKey = "price" | "rating" | "distance";

function DondeDormirPage() {
  const fetchHotels = useServerFn(listHotels);
  const { data, isLoading } = useQuery({
    queryKey: ["hotels-stay"],
    queryFn: () => fetchHotels(),
  });

  const [sort, setSort] = useState<SortKey>("price");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [breakfast, setBreakfast] = useState(false);
  const [refundable, setRefundable] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);

  const hotels = useMemo(() => {
    const all = (data?.hotels ?? []).map((h: any) => ({
      ...h,
      dyn: Array.isArray(h.hotels_dynamic) ? h.hotels_dynamic[0] : h.hotels_dynamic,
    }));
    let list = all.filter((h: any) => {
      if (onlyAvailable && !h.dyn?.available) return false;
      if (breakfast && !h.dyn?.breakfast_included) return false;
      if (refundable && !h.dyn?.free_cancellation) return false;
      if (maxPrice && (h.dyn?.current_price ?? Infinity) > maxPrice) return false;
      return true;
    });
    list.sort((a: any, b: any) => {
      if (sort === "price") {
        const pa = a.dyn?.current_price ?? Infinity;
        const pb = b.dyn?.current_price ?? Infinity;
        return pa - pb;
      }
      if (sort === "rating") return (b.stars ?? 0) - (a.stars ?? 0);
      return (a.distance_km ?? 99) - (b.distance_km ?? 99);
    });
    return list;
  }, [data, sort, onlyAvailable, breakfast, refundable, maxPrice]);

  const availableCount = (data?.hotels ?? []).filter((h: any) => {
    const d = Array.isArray(h.hotels_dynamic) ? h.hotels_dynamic[0] : h.hotels_dynamic;
    return d?.available;
  }).length;

  return (
    <div className="mx-auto max-w-md space-y-3 p-3 pb-24">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Dónde dormir
        </h1>
        <p className="text-xs text-muted-foreground">
          Precios para esta noche · {availableCount} disponibles ·{" "}
          {data?.hotels?.length ?? 0} alojamientos
        </p>
      </header>

      {/* Filters */}
      <div className="sticky top-0 z-10 -mx-3 border-b border-border/40 bg-background/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground shrink-0">
            <Filter className="h-3 w-3" /> Orden
          </span>
          {(
            [
              ["price", "💸 Precio"],
              ["rating", "⭐ Valoración"],
              ["distance", "📍 Cerca"],
            ] as [SortKey, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setSort(k)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                sort === k
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto">
          <Toggle active={breakfast} onClick={() => setBreakfast((v) => !v)}>
            <Coffee className="h-3 w-3" /> Desayuno
          </Toggle>
          <Toggle active={refundable} onClick={() => setRefundable((v) => !v)}>
            <ShieldCheck className="h-3 w-3" /> Cancelación gratis
          </Toggle>
          <Toggle active={onlyAvailable} onClick={() => setOnlyAvailable((v) => !v)}>
            Solo disponibles
          </Toggle>
          <select
            value={maxPrice ?? ""}
            onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : null)}
            className="shrink-0 rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-secondary-foreground"
          >
            <option value="">Sin límite €</option>
            <option value="80">≤ 80€</option>
            <option value="120">≤ 120€</option>
            <option value="200">≤ 200€</option>
          </select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : hotels.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No hay alojamientos con esos filtros.
        </p>
      ) : (
        <ul className="space-y-2">
          {hotels.map((h: any) => (
            <HotelRow key={h.id} h={h} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function HotelRow({ h }: { h: any }) {
  const d = h.dyn;
  const price = d?.current_price;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    h.name + " Alicante",
  )}`;
  const bookingHref =
    h.booking_url ||
    `https://www.booking.com/searchresults.es.html?ss=${encodeURIComponent(
      h.name + " Alicante",
    )}`;

  return (
    <li className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-soft">
      <div className="flex gap-3 p-3">
        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-secondary to-accent/40">
          {h.main_image ? (
            <img
              src={h.main_image}
              alt={h.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-3xl opacity-40">
              🏨
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-[14px] font-semibold leading-tight tracking-tight line-clamp-2">
              {h.name}
            </h3>
            {h.stars ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground shrink-0">
                <Star className="h-2.5 w-2.5 fill-current" />
                {Number(h.stars).toFixed(1)}
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            {h.hotel_type && <span className="capitalize">{h.hotel_type}</span>}
            {h.distance_km != null && (
              <span className="inline-flex items-center gap-0.5">
                <Footprints className="h-2.5 w-2.5" />
                {h.distance_km < 1
                  ? `${Math.round(h.distance_km * 1000)} m`
                  : `${h.distance_km.toFixed(1)} km`}
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap gap-1">
            {d?.breakfast_included && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <Coffee className="h-2.5 w-2.5" /> Desayuno
              </span>
            )}
            {d?.free_cancellation && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">
                <ShieldCheck className="h-2.5 w-2.5" /> Cancelable
              </span>
            )}
          </div>

          <div className="mt-1.5 flex items-end justify-between gap-2">
            <div>
              {price != null ? (
                <>
                  <span className="font-display text-lg font-bold leading-none">
                    {Math.round(price)}€
                  </span>
                  <span className="ml-1 text-[10px] text-muted-foreground">/noche</span>
                </>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Sin precio en directo
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Cómo llegar"
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary text-secondary-foreground"
              >
                <Navigation className="h-3.5 w-3.5" />
              </a>
              <a
                href={bookingHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground active:scale-95"
              >
                Reservar <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
