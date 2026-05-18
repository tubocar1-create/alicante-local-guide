import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Navigation,
  Coffee,
  ShieldCheck,
  Star,
  Footprints,
  Sparkles,
  ExternalLink,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
import { getHotel, getHotelCalendar } from "@/lib/hotels.functions";
import { getAiReview } from "@/lib/ai-review.functions";

export const Route = createFileRoute("/hotel/$id")({
  component: HotelDetail,
});

const ROOM_LABELS_CLIENT: Record<string, string> = {
  single: "Sencilla",
  double: "Doble",
  triple: "Triple",
  quadruple: "Cuádruple",
  suite: "Suite",
  other: "Otra",
};

function HotelDetail() {
  const { id } = Route.useParams();
  const fetchHotel = useServerFn(getHotel);
  const { data, isLoading } = useQuery({
    queryKey: ["hotel", id],
    queryFn: () => fetchHotel({ data: { id } }),
  });
  const h: any = data?.hotel;
  const d = h && (Array.isArray(h.hotels_dynamic) ? h.hotels_dynamic[0] : h.hotels_dynamic);

  const fetchReview = useServerFn(getAiReview);
  const review = useQuery({
    queryKey: ["hotel-review", id],
    enabled: !!h?.name,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: () =>
      fetchReview({
        data: {
          name: h.name,
          cuisine: h.hotel_type ?? "hotel",
          address: h.address ?? null,
        },
      }),
  });

  const startDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const fetchCalendar = useServerFn(getHotelCalendar);
  const calendar = useQuery({
    queryKey: ["hotel-calendar", id, startDate],
    staleTime: 60 * 60 * 1000,
    queryFn: () => fetchCalendar({ data: { id, startDate } }),
  });
  const days: Array<{ date: string; available: boolean; price_double: number | null; price_min: number | null; currency: string }> =
    calendar.data?.days ?? [];
  const roomTypes: Array<{ type: string; price: number; currency: string; label?: string }> =
    Array.isArray(d?.room_types) ? d.room_types : [];

  const mapsHref = h
    ? h.lat && h.lng
      ? `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}&travelmode=walking`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((h.name ?? "") + " Alicante")}`
    : "#";
  const q = h ? encodeURIComponent((h.name ?? "") + " Alicante") : "";
  const bookingHref = h?.booking_url || `https://www.booking.com/searchresults.es.html?ss=${q}`;
  const expediaHref = `https://www.expedia.es/Hotel-Search?destination=${q}`;
  const hotelsHref = `https://es.hotels.com/Hotel-Search?destination=${q}`;
  const triHref = `https://www.trivago.es/?query=${q}`;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-amber-50"
      style={{
        background:
          "linear-gradient(180deg, #1a0f05 0%, #2a1607 50%, #120800 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-amber-500/[0.08] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/donde-dormir"
            className="text-[11px] uppercase tracking-[0.25em] text-amber-200/60 hover:text-amber-300"
          >
            ← Volver al listado
          </Link>
          <Link
            to="/donde-dormir"
            aria-label="Cerrar"
            className="rounded-full border border-amber-900/60 p-1.5 text-amber-200/70 hover:border-amber-500/50 hover:text-amber-300"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        {isLoading || !h ? (
          <div className="h-64 animate-pulse rounded-2xl bg-amber-100/[0.05]" />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-amber-100/[0.08] bg-[rgba(20,10,4,0.7)] backdrop-blur-xl">
              {h.main_image ? (
                <img
                  src={h.main_image}
                  alt={h.name}
                  className="h-56 w-full object-cover md:h-72"
                />
              ) : (
                <div className="flex h-40 items-center justify-center text-5xl opacity-30">🏨</div>
              )}
              <div className="p-4 md:p-5">
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                  {h.hotel_type ?? "Alojamiento"}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {h.name}
                </h1>
                {h.address && (
                  <p className="mt-1 text-xs text-amber-200/70">{h.address}</p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {h.stars && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-200">
                      <Star className="h-3 w-3 fill-current" />
                      {Number(h.stars).toFixed(1)}
                    </span>
                  )}
                  {h.distance_km != null && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.05] px-2 py-0.5 text-amber-100/80">
                      <Footprints className="h-3 w-3" />
                      {h.distance_km < 1
                        ? `${Math.round(h.distance_km * 1000)} m`
                        : `${Number(h.distance_km).toFixed(1)} km`}
                    </span>
                  )}
                  {h.neighborhood && (
                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-amber-100/80">
                      {h.neighborhood}
                    </span>
                  )}
                </div>

                {/* Live availability */}
                <div className="mt-4 rounded-xl border border-amber-100/[0.08] bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/70">
                        Esta noche
                      </p>
                      {d?.current_price != null ? (
                        <p className="mt-0.5">
                          <span className="font-display text-2xl font-bold">
                            {Math.round(d.current_price)}€
                          </span>
                          <span className="ml-1 text-[11px] text-amber-200/60">/noche</span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-amber-200/60">Sin precio en directo</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-right text-[10px]">
                      {d?.breakfast_included && (
                        <span className="inline-flex items-center justify-end gap-1 text-emerald-300">
                          <Coffee className="h-3 w-3" /> Desayuno
                        </span>
                      )}
                      {d?.free_cancellation && (
                        <span className="inline-flex items-center justify-end gap-1 text-sky-300">
                          <ShieldCheck className="h-3 w-3" /> Cancelable gratis
                        </span>
                      )}
                      {d?.available === false && (
                        <span className="text-rose-300">No disponible</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] px-3 py-2.5 text-[12px] font-semibold text-amber-50 hover:bg-white/[0.1]"
                  >
                    <Navigation className="h-3.5 w-3.5" /> Cómo ir
                  </a>
                  <a
                    href={bookingHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-400 px-3 py-2.5 text-[12px] font-bold text-amber-950 hover:brightness-110"
                  >
                    Reservar en Booking <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <a
                    href={expediaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-white/[0.04] px-2 py-2 text-center text-[11px] font-semibold text-amber-100/90 hover:bg-white/[0.08]"
                  >
                    Expedia
                  </a>
                  <a
                    href={hotelsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-white/[0.04] px-2 py-2 text-center text-[11px] font-semibold text-amber-100/90 hover:bg-white/[0.08]"
                  >
                    Hotels.com
                  </a>
                  <a
                    href={triHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl bg-white/[0.04] px-2 py-2 text-center text-[11px] font-semibold text-amber-100/90 hover:bg-white/[0.08]"
                  >
                    Trivago
                  </a>
                </div>
              </div>
            </div>

            {/* Tipos de habitación */}
            {roomTypes.length > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-100/[0.08] bg-[rgba(20,10,4,0.7)] p-4 backdrop-blur-xl md:p-5">
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                  Habitaciones y tarifas
                </p>
                <ul className="mt-2 divide-y divide-amber-100/[0.06]">
                  {roomTypes.map((rt, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-amber-100/90">
                        {ROOM_LABELS_CLIENT[rt.type] ?? rt.label ?? rt.type}
                      </span>
                      <span className="font-mono font-semibold tabular-nums text-amber-50">
                        {Math.round(rt.price)} {rt.currency || "EUR"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warning de precios */}
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-[11px] text-amber-100/90">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
              <p>
                Los precios varían según la temporada y la disponibilidad. Nosotros sólo damos
                información orientativa: la reserva y el precio final se confirman en el operador
                que elijas.
              </p>
            </div>

            {/* Calendario 30 días */}
            <div className="mt-4 rounded-2xl border border-amber-100/[0.08] bg-[rgba(20,10,4,0.7)] p-4 backdrop-blur-xl md:p-5">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                <CalendarDays className="h-3 w-3" /> Disponibilidad · próximos 30 días
              </p>
              <p className="mt-1 text-[10px] text-amber-200/60">
                Verde = hay habitaciones · rojo = sin disponibilidad. El precio mostrado es de la
                habitación doble.
              </p>
              {calendar.isLoading ? (
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {Array.from({ length: 30 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded bg-amber-100/[0.06]" />
                  ))}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {days.map((dy) => {
                    const dt = new Date(dy.date + "T00:00:00Z");
                    const day = dt.getUTCDate();
                    const dow = dt.toLocaleDateString("es-ES", {
                      weekday: "short",
                      timeZone: "UTC",
                    });
                    const priceLabel =
                      dy.price_double != null
                        ? `${Math.round(dy.price_double)}€`
                        : dy.price_min != null
                          ? `${Math.round(dy.price_min)}€`
                          : "—";
                    return (
                      <div
                        key={dy.date}
                        className={
                          "flex h-12 flex-col items-center justify-center rounded text-[10px] leading-tight " +
                          (dy.available
                            ? "bg-emerald-500/20 text-emerald-100"
                            : "bg-rose-500/15 text-rose-200/80")
                        }
                        title={`${dy.date} · ${dy.available ? "disponible" : "sin disponibilidad"}`}
                      >
                        <span className="text-[8px] uppercase tracking-wide opacity-70">{dow}</span>
                        <span className="font-mono font-semibold">{day}</span>
                        <span className="font-mono text-[9px] tabular-nums opacity-90">
                          {priceLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* AI Review */}
            <div className="mt-4 rounded-2xl border border-amber-100/[0.08] bg-[rgba(20,10,4,0.7)] p-4 backdrop-blur-xl md:p-5">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                <Sparkles className="h-3 w-3" /> Nuestra reseña
              </p>
              {review.isLoading ? (
                <div className="mt-2 space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-amber-100/[0.08]" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-amber-100/[0.08]" />
                  <div className="h-3 w-4/6 animate-pulse rounded bg-amber-100/[0.08]" />
                </div>
              ) : review.data?.text ? (
                <p className="mt-2 text-sm leading-relaxed text-amber-100/90">
                  {review.data.text}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-200/60">
                  No hemos podido generar la reseña ahora mismo.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
