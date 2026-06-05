import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { getPlaceById, getPlacePhotos } from "@/lib/places.functions";
import { getAiReview } from "@/lib/ai-review.functions";
import { Sparkles, X, Loader2 } from "lucide-react";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Star,
  Euro,
  MessageSquare,
  CalendarCheck,
} from "lucide-react";
import ReferralDialog from "@/components/ReferralDialog";
import BookingDialog from "@/components/BookingDialog";
import { resolveOpeningStatus } from "@/lib/opening-hours";

const PlaceLocationMap = lazy(() => import("@/components/PlaceLocationMap"));
import OpeningHoursCard from "@/components/OpeningHoursCard";
const RESTAURANT_PREVIEW_KEY = "afp:restaurant-preview";

export const Route = createFileRoute("/restaurants/$placeId")({
  loader: async ({ params }) => ({ placeId: params.placeId }),
  head: ({ params }) => {
    const title = `Restaurante — Alicante`;
    const desc = `Ficha de restaurante en Alicante: horario, precio, valoración y ubicación.`;
    const url = `https://vamosalicante.com/restaurants/${params.placeId}`;
    const ld: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: "Restaurante",
      url,
      address: { "@type": "PostalAddress", addressLocality: "Alicante", addressCountry: "ES" },
    };
    return {
      meta: [
        { title: title.slice(0, 60) },
        { name: "description", content: desc.slice(0, 160) },
        { property: "og:title", content: title.slice(0, 60) },
        { property: "og:description", content: desc.slice(0, 160) },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
      ],
      links: [
        { rel: "canonical", href: url },
      ],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-slate-950 p-6 text-sm text-rose-300">
      No se pudo cargar el restaurante: {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-slate-950 p-6 text-sm text-slate-300">
      Restaurante no encontrado.
    </div>
  ),
  component: RestaurantDashboard,
});


type Place = Awaited<ReturnType<typeof getPlaceById>>["place"];

function readRestaurantPreview(placeId: string): Place | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RESTAURANT_PREVIEW_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as {
      placeId?: string | null;
      name?: string;
      cuisine?: string | null;
      address?: string | null;
      openingHours?: string | null;
      lat?: number;
      lon?: number;
      priceLevel?: string | null;
      priceRangeMin?: number | null;
      priceRangeMax?: number | null;
      rating?: number | null;
      openNow?: boolean | null;
      savedAt?: number;
    };
    if (p.placeId !== placeId || (p.savedAt && Date.now() - p.savedAt > 5 * 60_000)) return null;
    return {
      google_place_id: placeId,
      name: p.name ?? "Restaurante",
      cuisine: p.cuisine ?? null,
      primary_type: null,
      types: null,
      address: p.address ?? null,
      lat: p.lat ?? null,
      lng: p.lon ?? null,
      opening_hours_text: p.openingHours ?? null,
      opening_hours_json: null,
      open_now: p.openNow ?? null,
      price_level: p.priceLevel ?? null,
      price_range_min: p.priceRangeMin ?? null,
      price_range_max: p.priceRangeMax ?? null,
      price_currency: "EUR",
      rating: p.rating ?? null,
      user_rating_count: null,
      phone: null,
      website: null,
      category: "restaurant",
      fetched_at: new Date().toISOString(),
    } as Place;
  } catch {
    return null;
  }
}

function RestaurantDashboard() {
  const { placeId } = Route.useParams();
  const [place, setPlace] = useState<Place | null>(() => readRestaurantPreview(placeId));
  const [photos, setPhotos] = useState<string[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [zoomedIdx, setZoomedIdx] = useState<number | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);
  const fetchPlace = useServerFn(getPlaceById);
  const fetchAiReview = useServerFn(getAiReview);
  const fetchPhotos = useServerFn(getPlacePhotos);

  useEffect(() => {
    let cancelled = false;
    fetchPlace({ data: { placeId } })
      .then((res) => {
        if (!cancelled) setPlace(res.place ?? null);
      })
      .catch(() => {})
    return () => {
      cancelled = true;
    };
  }, [fetchPlace, placeId]);

  useEffect(() => {
    let cancelled = false;
    setPhotos([]);
    fetchPhotos({ data: { placeId, max: 6 } })
      .then((res) => {
        if (!cancelled) setPhotos(res.photos ?? []);
      })
      .catch(() => {
        if (!cancelled) setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPhotos, placeId]);

  async function openReview() {
    setReviewOpen(true);
    if (reviewText || reviewLoading) return;
    setReviewLoading(true);
    setReviewErr(null);
    try {
      const r = await fetchAiReview({
        data: {
          name: place?.name ?? "",
          cuisine: place?.cuisine ?? null,
          address: place?.address ?? null,
        },
      });
      setReviewText(r.text);
    } catch (e) {
      setReviewErr(String((e as Error)?.message ?? e));
    } finally {
      setReviewLoading(false);
    }
  }


  const heroOpeningStatus = useMemo(
    () => (place ? resolveOpeningStatus(place.opening_hours_text) : null),
    [place],
  );
  const heroIsOpen =
    heroOpeningStatus?.status === "open"
      ? true
      : heroOpeningStatus?.status === "closed"
        ? false
        : (place?.open_now ?? null);
  const heroClosesAt = heroOpeningStatus?.status === "open" ? heroOpeningStatus.closesAt : null;

  return (
    <div className="flex h-[100dvh] flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="z-10 flex shrink-0 items-center gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <Link
          to="/selectordecomidas"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
          aria-label="Volver al selector"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="truncate text-base font-semibold">
          {place?.name ?? "Restaurante"}
        </h1>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5">
        {!place && (
          <p className="text-sm text-slate-400">No se encontró este restaurante en la base.</p>
        )}

        {place && (
          <div className="space-y-4">
            {/* Hero */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold">{place.name}</h2>
                  {place.cuisine && (
                    <p className="mt-0.5 text-sm text-slate-400">{place.cuisine}</p>
                  )}
                </div>
                {heroIsOpen != null && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      heroIsOpen
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    ● {heroIsOpen ? `Abierto · cierra ${heroClosesAt ?? "—"}` : "Cerrado"}
                  </span>
                )}
              </div>

              {place.rating != null && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                    <div className="flex items-baseline gap-1">
                      <Star className="h-5 w-5 self-center fill-amber-400 text-amber-400" />
                      <span className="text-2xl font-bold leading-none text-white">
                        {place.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-400">/5</span>
                    </div>
                    {place.user_rating_count != null && (
                      <div className="text-sm font-semibold text-slate-200">
                        {place.user_rating_count.toLocaleString("es-ES")} reseñas
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={`https://search.google.com/local/reviews?placeid=${place.google_place_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08]"
                    >
                      <MessageSquare className="h-4 w-4 text-cyan-300" />
                      Google
                    </a>
                    <a
                      href={`https://www.tripadvisor.es/Search?q=${encodeURIComponent(`${place.name} Alicante`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-[11px] font-semibold text-slate-200 hover:bg-white/[0.08]"
                    >
                      <MessageSquare className="h-4 w-4 text-emerald-300" />
                      TripAdvisor
                    </a>
                    <button
                      type="button"
                      onClick={openReview}
                      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-300/30 bg-amber-400/10 px-2 py-2.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/20"
                    >
                      <Sparkles className="h-4 w-4 text-amber-300" />
                      Nuestra reseña
                    </button>
                  </div>

                </div>
              )}
            </section>

            {/* Photo gallery */}
            {photos.length > 0 && (
              <section className="-mx-4">
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
                  {photos.map((src, i) => {
                    const isZoom = zoomedIdx === i;
                    return (
                      <button
                        key={src}
                        type="button"
                        onClick={() => setZoomedIdx(isZoom ? null : i)}
                        className={`group relative shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition-all duration-500 ease-out ${
                          isZoom ? "h-[22rem] w-[22rem]" : "h-44 w-64"
                        }`}
                        aria-label={isZoom ? `Reducir foto ${i + 1}` : `Ampliar foto ${i + 1}`}
                      >
                        <img
                          src={src}
                          alt={`${place.name} foto ${i + 1}`}
                          loading="lazy"
                          className={`h-full w-full object-cover transition-transform duration-500 ${
                            isZoom
                              ? "scale-110 cursor-zoom-out"
                              : "cursor-zoom-in group-hover:scale-105"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Precio */}
            <section>
              <Stat
                icon={<Euro className="h-4 w-4" />}
                label="Precio"
                value={
                  place.price_range_min != null || place.price_range_max != null
                    ? `${place.price_range_min ?? "?"}–${place.price_range_max ?? "?"} ${place.price_currency ?? "€"}`
                    : (place.price_level?.replace("PRICE_LEVEL_", "") ?? "—")
                }
              />
            </section>

            {/* Estado + horarios desplegables */}
            <OpeningHoursCard
              openingHoursText={place.opening_hours_text}
              openNow={place.open_now}
              rawOpeningHours={null}
            />

            {/* Contacto */}
            <section className="space-y-2">
              {place.address && <Row icon={<MapPin className="h-4 w-4" />} text={place.address} />}
              {place.phone && (
                <Row
                  icon={<Phone className="h-4 w-4" />}
                  text={place.phone}
                  href={`tel:${place.phone}`}
                />
              )}
              {place.website && (
                <Row
                  icon={<Globe className="h-4 w-4" />}
                  text={place.website.replace(/^https?:\/\//, "")}
                  href={place.website}
                  external
                />
              )}
            </section>

            {/* Acciones */}
            <section className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl gradient-warm px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg ring-2 ring-white/40 opacity-60 cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4" />
                  ¡VAMOS!
                </span>
                <span className="text-[10px] font-medium opacity-90">
                  Te emitimos una invitación
                </span>
              </button>
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-white opacity-60 cursor-not-allowed"
              >
                Reservar
              </button>
              {place.lat != null && place.lng != null && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center rounded-xl bg-blue-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-400"
                >
                  ¿Cómo llegar?
                </a>
              )}
              <Link
                to="/selectordecomidas"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Volver al selector
              </Link>
            </section>

            {/* Mapa de ubicación */}
            {place.lat != null && place.lng != null && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <MapPin className="h-4 w-4" /> Ubicación
                </h3>
                <Suspense
                  fallback={<div className="h-56 w-full animate-pulse rounded-2xl bg-white/5" />}
                >
                  <PlaceLocationMap
                    lat={place.lat}
                    lng={place.lng}
                    name={place.name ?? "Restaurante"}
                    address={place.address}
                  />
                </Suspense>
              </section>
            )}
          </div>
        )}
      </main>

      {qrOpen && place && (
        <ReferralDialog
          placeId={place.google_place_id ?? placeId}
          placeName={place.name ?? "Restaurante"}
          onClose={() => setQrOpen(false)}
        />
      )}

      {bookingOpen && place && (
        <BookingDialog
          listing={{
            id: place.google_place_id ?? placeId,
            name: place.name ?? "Restaurante",
            lat: place.lat ?? 0,
            lon: place.lng ?? 0,
            kind: "restaurant",
            cuisine: place.cuisine ?? undefined,
            address: place.address ?? undefined,
            tags: {},
          }}
          onClose={() => setBookingOpen(false)}
        />
      )}

      {reviewOpen && place && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setReviewOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-amber-100">Nuestra reseña</h3>
                <p className="text-[11px] text-slate-400">{place.name}</p>
              </div>
            </div>
            <div className="min-h-[8rem] text-sm leading-relaxed text-slate-200">
              {reviewLoading && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pensando en {place.name}…
                </div>
              )}
              {reviewErr && !reviewLoading && (
                <p className="text-rose-300">No pudimos generar la reseña: {reviewErr}</p>
              )}
              {reviewText && !reviewLoading && (
                <p className="whitespace-pre-wrap">{reviewText}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
    </div>
  );
}

function Row({
  icon,
  text,
  href,
  external,
}: {
  icon: React.ReactNode;
  text: string;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <span className="flex items-start gap-2 text-sm text-slate-300">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <span className="min-w-0 break-words">{text}</span>
    </span>
  );
  if (!href) return <div className="rounded-xl bg-white/[0.02] px-3 py-2">{inner}</div>;
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="block rounded-xl bg-white/[0.02] px-3 py-2 hover:bg-white/[0.05]"
    >
      {inner}
    </a>
  );
}
