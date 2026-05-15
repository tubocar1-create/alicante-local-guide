import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { getPlaceById, getPlacePhotos } from "@/lib/places.functions";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Globe,
  Star,
  Clock,
  Euro,
  MessageSquare,
  CalendarCheck,
} from "lucide-react";
import ReferralDialog from "@/components/ReferralDialog";
import BookingDialog from "@/components/BookingDialog";
import { resolveOpeningStatus } from "@/lib/opening-hours";

const PlaceLocationMap = lazy(() => import("@/components/PlaceLocationMap"));
import OpeningHoursCard from "@/components/OpeningHoursCard";

export const Route = createFileRoute("/restaurants/$placeId")({
  head: () => ({
    meta: [
      { title: "Restaurante — Alicante Friend" },
      {
        name: "description",
        content: "Detalles del restaurante: horario, precio, valoración y ubicación.",
      },
    ],
  }),
  component: RestaurantDashboard,
});

type Place = Awaited<ReturnType<typeof getPlaceById>>["place"];

function RestaurantDashboard() {
  const { placeId } = Route.useParams();
  const router = useRouter();
  const fetchPlace = useServerFn(getPlaceById);
  const fetchPhotos = useServerFn(getPlacePhotos);
  const [place, setPlace] = useState<Place | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [zoomedIdx, setZoomedIdx] = useState<number | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPhotos([]);
    fetchPlace({ data: { placeId } })
      .then((r) => {
        if (!cancelled) setPlace(r.place);
      })
      .catch((e) => {
        if (!cancelled) setErr(String(e?.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetchPhotos({ data: { placeId, max: 10 } })
      .then((r) => {
        if (!cancelled) setPhotos(r.photos);
      })
      .catch(() => {
        /* photos optional */
      });
    return () => {
      cancelled = true;
    };
  }, [fetchPlace, fetchPhotos, placeId]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <button
          onClick={() => router.history.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="truncate text-base font-semibold">
          {place?.name ?? (loading ? "Cargando…" : "Restaurante")}
        </h1>
      </header>

      <main className="w-full px-4 py-5">
        {loading && <p className="text-sm text-slate-400">Cargando información…</p>}
        {err && <p className="text-sm text-rose-400">Error: {err}</p>}
        {!loading && !place && !err && (
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
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${place.name} Alicante site:tripadvisor.es`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 hover:bg-white/[0.08]"
                >
                  <div className="flex items-baseline gap-1">
                    <Star className="h-5 w-5 self-center fill-amber-400 text-amber-400" />
                    <span className="text-2xl font-bold leading-none text-white">
                      {place.rating.toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400">/5</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    {place.user_rating_count != null && (
                      <div className="text-sm font-semibold text-slate-200">
                        {place.user_rating_count.toLocaleString("es-ES")} reseñas
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-cyan-300">
                      <MessageSquare className="h-3 w-3" />
                      Ver reseñas
                    </div>
                  </div>
                </a>
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

            {/* Acciones */}
            <section className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl gradient-warm px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg ring-2 ring-white/40 hover:opacity-95"
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
                onClick={() => setBookingOpen(true)}
                className="flex flex-1 items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-400"
              >
                Reservar
              </button>
              {place.lat != null && place.lng != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-1 items-center justify-center rounded-xl bg-blue-500 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-400"
                >
                  ¿Cómo llegar?
                </a>
              )}
              <Link
                to="/"
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-semibold text-slate-200 hover:bg-white/10"
              >
                Volver
              </Link>
            </section>
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
