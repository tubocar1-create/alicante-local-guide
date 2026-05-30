import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  X,
  Coffee,
  ShieldCheck,
  Star,
  Sparkles,
  ExternalLink,
  CalendarDays,
  BedDouble,
} from "lucide-react";
import { getHotel, getHotelCalendar, getHotelPhotos } from "@/lib/hotels.functions";
import { getAiReview } from "@/lib/ai-review.functions";
import { useUserLocation, distanceKm } from "@/hooks/useUserLocation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Puerta del Mar, Alicante (fallback reference point)
const PUERTA_DEL_MAR = { lat: 38.3404, lng: -0.4811 };

export const Route = createFileRoute("/hotel/$id")({
  loader: ({ params }) => getHotel({ data: { id: params.id } }),
  head: ({ params, loaderData }) => {
    const h: any = loaderData?.hotel;
    const name: string = h?.name ?? "Hotel en Alicante";
    const city: string = h?.city ?? "Alicante";
    const title = `${name} — Hotel en ${city}`.slice(0, 60);
    const description = (
      h?.description?.toString().trim() ||
      `Ficha del ${name} en ${city}: fotos, valoraciones, ubicación y disponibilidad. Reserva al mejor precio con Vamos Alicante.`
    ).slice(0, 160);
    const url = `https://vamosalicante.com/hotel/${params.id}`;
    const image: string | undefined =
      h?.photo_url || h?.image_url || h?.thumbnail_url || undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Hotel",
            name,
            description,
            url,
            image: image ?? undefined,
            address: h?.address
              ? {
                  "@type": "PostalAddress",
                  streetAddress: h.address,
                  addressLocality: city,
                  addressCountry: "ES",
                }
              : undefined,
          }),
        },
      ],
    };
  },
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
  const initialHotelData = Route.useLoaderData();
  const fetchHotel = useServerFn(getHotel);
  const { data, isLoading } = useQuery({
    queryKey: ["hotel", id],
    queryFn: () => fetchHotel({ data: { id } }),
    initialData: initialHotelData,
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

  const { startDate, endDate, months } = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const start = new Date(Date.UTC(y, m, today.getDate()));
    const end = new Date(Date.UTC(y, m + 4, 0)); // last day of (current+3)
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const ms: Array<{ year: number; month: number; firstDay: number; daysInMonth: number; firstWeekday: number }> = [];
    for (let i = 0; i < 4; i++) {
      const monthStart = new Date(Date.UTC(y, m + i, 1));
      const monthEnd = new Date(Date.UTC(y, m + i + 1, 0));
      const firstDay = i === 0 ? today.getDate() : 1;
      const jsDow = monthStart.getUTCDay(); // 0=Sun
      const firstWeekday = (jsDow + 6) % 7; // Mon=0
      ms.push({
        year: monthStart.getUTCFullYear(),
        month: monthStart.getUTCMonth(),
        firstDay,
        daysInMonth: monthEnd.getUTCDate(),
        firstWeekday,
      });
    }
    return { startDate: fmt(start), endDate: fmt(end), months: ms };
  }, []);

  const fetchCalendar = useServerFn(getHotelCalendar);
  const calendar = useQuery({
    queryKey: ["hotel-calendar", id, startDate, endDate],
    staleTime: 60 * 60 * 1000,
    queryFn: () => fetchCalendar({ data: { id, startDate, endDate } }),
  });

  const fetchPhotos = useServerFn(getHotelPhotos);
  const photosQ = useQuery({
    queryKey: ["hotel-photos", id, "scraped-first"],
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: () => fetchPhotos({ data: { id } }),
  });
  const gallery: string[] = useMemo(() => {
    const arr = photosQ.data?.photos ?? [];
    if (arr.length) return arr;
    if (Array.isArray(h?.scraped_photos) && h.scraped_photos.length) return h.scraped_photos;
    return h?.main_image ? [h.main_image] : [];
  }, [photosQ.data, h?.scraped_photos, h?.main_image]);
  const days: Array<{ date: string; available: boolean; price_double: number | null; price_min: number | null; currency: string }> =
    calendar.data?.days ?? [];
  const daysByDate = useMemo(() => {
    const map: Record<string, (typeof days)[number]> = {};
    for (const d of days) map[d.date] = d;
    return map;
  }, [days]);
  const roomTypes: Array<{ type: string; price: number; currency: string; label?: string }> =
    Array.isArray(d?.room_types) ? d.room_types : [];

  // Distancia: geolocalización del usuario si existe, en su defecto a Puerta del Mar
  const { state: geo } = useUserLocation();
  const distance = useMemo(() => {
    if (!h?.lat || !h?.lng) return null;
    if (geo.status === "ready") {
      return { km: distanceKm(geo.coords, { lat: h.lat, lng: h.lng }), source: "tú" as const };
    }
    return {
      km: distanceKm(PUERTA_DEL_MAR, { lat: h.lat, lng: h.lng }),
      source: "Puerta del Mar" as const,
    };
  }, [geo, h?.lat, h?.lng]);

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
  const googleHotelsHref = `https://www.google.com/travel/hotels?q=${q}`;
  const agodaHref = `https://www.agoda.com/search?city=&query=${q}`;

  const operators: { label: string; href: string }[] = [
    { label: "Booking", href: bookingHref },
    { label: "Expedia", href: expediaHref },
    { label: "Hotels.com", href: hotelsHref },
    { label: "Trivago", href: triHref },
    { label: "Google Hoteles", href: googleHotelsHref },
    { label: "Agoda", href: agodaHref },
  ];

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto text-amber-50"
      style={{
        background:
          "linear-gradient(180deg, #050b1f 0%, #0a1638 50%, #03081a 100%)",
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
              {gallery.length > 0 ? (
                <div className="flex h-[60vh] max-h-[640px] min-h-[320px] snap-x snap-mandatory gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {gallery.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`${h.name} foto ${i + 1}`}
                      loading={i === 0 ? "eager" : "lazy"}
                      className="h-full w-full flex-none snap-start object-cover"
                    />
                  ))}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-5xl opacity-30">🏨</div>
              )}
              <div className="p-4 md:p-5">
                <div className="mb-2 flex justify-end">
                  <Dialog>
                    <DialogTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-500/20"
                      >
                        <Sparkles className="h-3 w-3" /> Nuestra reseña
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md border-amber-100/10 bg-[#0a1638] text-amber-50">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-1.5 text-amber-200">
                          <Sparkles className="h-4 w-4" /> Nuestra reseña
                        </DialogTitle>
                      </DialogHeader>
                      {review.isLoading ? (
                        <div className="space-y-2">
                          <div className="h-3 w-full animate-pulse rounded bg-amber-100/10" />
                          <div className="h-3 w-5/6 animate-pulse rounded bg-amber-100/10" />
                          <div className="h-3 w-4/6 animate-pulse rounded bg-amber-100/10" />
                        </div>
                      ) : review.data?.text ? (
                        <p className="text-sm leading-relaxed text-amber-100/90">
                          {review.data.text}
                        </p>
                      ) : (
                        <p className="text-xs text-amber-200/60">
                          No hemos podido generar la reseña ahora mismo.
                        </p>
                      )}
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                  {h.hotel_type ?? "Alojamiento"}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold tracking-tight md:text-3xl">
                  {h.name}
                </h1>
                {h.address && (
                  <p className="mt-1 text-xs text-amber-200/70">{h.address}</p>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-100"
                  >
                    🚶 Cómo ir
                  </a>
                  {h.stars && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-200">
                      <Star className="h-3 w-3 fill-current" />
                      {Number(h.stars).toFixed(1)}
                    </span>
                  )}
                  {h.neighborhood && (
                    <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-amber-100/80">
                      {h.neighborhood}
                    </span>
                  )}
                </div>


                {/* Tarifas por tipo de habitación */}
                <div className="mt-4 rounded-xl border border-amber-100/[0.08] bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-amber-300/70">
                      Habitaciones y tarifas
                    </p>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      {d?.rooms_available != null && (
                        <span
                          title="Habitaciones disponibles ahora mismo"
                          className={"inline-flex items-center gap-1 " + (d.rooms_available > 0 ? "text-emerald-300" : "text-rose-300")}
                        >
                          <BedDouble className="h-3 w-3" /> {d.rooms_available} hab. disponibles
                        </span>
                      )}
                      {d?.breakfast_included && (
                        <span className="inline-flex items-center gap-1 text-emerald-300">
                          <Coffee className="h-3 w-3" /> Desayuno
                        </span>
                      )}
                      {d?.free_cancellation && (
                        <span className="inline-flex items-center gap-1 text-sky-300">
                          <ShieldCheck className="h-3 w-3" /> Cancelable
                        </span>
                      )}
                    </div>

                  </div>
                  {roomTypes.length > 0 ? (
                    <ul className="mt-2 divide-y divide-amber-100/[0.06]">
                      {roomTypes.map((rt, i) => (
                        <li
                          key={i}
                          className="flex items-center justify-between py-1.5 text-sm"
                        >
                          <span className="text-amber-100/90">
                            {ROOM_LABELS_CLIENT[rt.type] ?? rt.label ?? rt.type}
                          </span>
                          <span className="font-mono font-semibold tabular-nums text-amber-50">
                            {Math.round(rt.price)} {rt.currency || "EUR"}
                            <span className="ml-1 text-[10px] font-normal text-amber-200/60">
                              /noche
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : d?.current_price != null ? (
                    <p className="mt-2 text-sm text-amber-100/90">
                      <span className="font-display text-xl font-bold">
                        {Math.round(d.current_price)}€
                      </span>
                      <span className="ml-1 text-[11px] text-amber-200/60">
                        /noche (doble)
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-amber-200/60">
                      Sin tarifas en directo
                    </p>
                  )}
                  {d?.available === false && (
                    <p className="mt-2 text-[11px] text-rose-300">No disponible</p>
                  )}
                </div>

                {/* Operadores en 2 columnas */}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {operators.map((op) => (
                    <a
                      key={op.label}
                      href={op.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-200 to-[#FF6347] px-3 py-2 text-[12px] font-semibold text-amber-950 hover:opacity-90"
                    >
                      {op.label} <ExternalLink className="h-3 w-3" />
                    </a>
                  ))}
                </div>

              </div>
            </div>



            {/* Calendarios mensuales (mes actual + 2 siguientes) */}
            <div className="mt-4 rounded-2xl border border-amber-100/[0.08] bg-[rgba(20,10,4,0.7)] p-4 backdrop-blur-xl md:p-5">
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.3em] text-amber-400/80">
                <CalendarDays className="h-3 w-3" /> Disponibilidad · próximos 4 meses
              </p>
              <p className="mt-1 text-[10px] text-amber-200/60">
                Verde = hay habitaciones · rojo = sin disponibilidad. Precio mostrado: habitación
                doble.
              </p>

              <div className="mt-3 space-y-5">
                {months.map((mo) => {
                  const monthName = new Date(Date.UTC(mo.year, mo.month, 1)).toLocaleDateString(
                    "es-ES",
                    { month: "long", year: "numeric", timeZone: "UTC" },
                  );
                  const cells: Array<{ key: string; kind: "blank" | "out" | "day"; date?: string; dayNum?: number }> = [];
                  // Weekday of the first visible day (mo.firstDay), Mon=0..Sun=6
                  const firstVisibleJs = new Date(Date.UTC(mo.year, mo.month, mo.firstDay)).getUTCDay();
                  const firstVisibleWeekday = (firstVisibleJs + 6) % 7;
                  for (let i = 0; i < firstVisibleWeekday; i++) {
                    cells.push({ key: `b-${mo.year}-${mo.month}-${i}`, kind: "blank" });
                  }
                  for (let d = mo.firstDay; d <= mo.daysInMonth; d++) {
                    const dateStr = `${mo.year}-${String(mo.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                    cells.push({ key: dateStr, kind: "day", date: dateStr, dayNum: d });
                  }
                  return (
                    <div key={`${mo.year}-${mo.month}`}>
                      <p className="mb-1.5 text-[11px] font-semibold capitalize tracking-wide text-amber-100/90">
                        {monthName}
                      </p>
                      <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] uppercase tracking-wide text-amber-200/50">
                        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                          <div key={d} className="py-0.5">
                            {d}
                          </div>
                        ))}
                      </div>
                      <div className="mt-0.5 grid grid-cols-7 gap-0.5">
                        {cells.map((c) => {
                          if (c.kind === "blank") {
                            return <div key={c.key} className="h-12 rounded" />;
                          }
                          if (c.kind === "out") {
                            return <div key={c.key} className="h-12 rounded" />;
                          }
                          const dy = daysByDate[c.date!];
                          const loading = calendar.isLoading;
                          if (loading) {
                            return (
                              <div
                                key={c.key}
                                className="h-12 animate-pulse rounded bg-amber-100/[0.06]"
                              />
                            );
                          }
                          const available = !!dy?.available;
                          const priceLabel =
                            dy?.price_double != null
                              ? `${Math.round(dy.price_double)}€`
                              : dy?.price_min != null
                                ? `${Math.round(dy.price_min)}€`
                                : "—";
                          return (
                            <div
                              key={c.key}
                              title={`${c.date} · ${available ? "disponible" : "sin disponibilidad"}`}
                              className={
                                "flex h-12 flex-col items-center justify-center rounded text-[10px] leading-tight " +
                                (available
                                  ? "bg-emerald-600/50 text-emerald-50"
                                  : "bg-rose-600/40 text-rose-50/90")

                              }
                            >
                              <span className="font-mono font-semibold">{c.dayNum}</span>
                              <span className="font-mono text-[9px] tabular-nums opacity-90">
                                {priceLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
}
