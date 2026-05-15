import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getPlaceById, getPlacePhotos } from "@/lib/places.functions";
import { ArrowLeft, MapPin, Phone, Globe, Star, Clock, Euro, MessageSquare, CalendarCheck } from "lucide-react";
import BookingDialog from "@/components/BookingDialog";
import type { Listing } from "@/lib/overpass-listings";

export const Route = createFileRoute("/restaurants/$placeId")({
  head: () => ({
    meta: [
      { title: "Restaurante — Alicante Friend" },
      { name: "description", content: "Detalles del restaurante: horario, precio, valoración y ubicación." },
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
  const [bookingOpen, setBookingOpen] = useState(false);

  const bookingListing = useMemo<Listing | null>(() => {
    if (!place) return null;
    return {
      id: place.google_place_id ?? placeId,
      name: place.name ?? "Restaurante",
      lat: place.lat ?? 0,
      lon: place.lng ?? 0,
      kind: "restaurant",
      cuisine: place.cuisine ?? undefined,
      phone: place.phone ?? undefined,
      website: place.website ?? undefined,
      address: place.address ?? undefined,
      openingHours: place.opening_hours_text ?? undefined,
      tags: {},
    };
  }, [place, placeId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPhotos([]);
    fetchPlace({ data: { placeId } })
      .then((r) => { if (!cancelled) setPlace(r.place); })
      .catch((e) => { if (!cancelled) setErr(String(e?.message ?? e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    fetchPhotos({ data: { placeId, max: 6 } })
      .then((r) => { if (!cancelled) setPhotos(r.photos); })
      .catch(() => { /* photos optional */ });
    return () => { cancelled = true; };
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
                {place.open_now != null && (
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${
                      place.open_now
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-rose-500/15 text-rose-300"
                    }`}
                  >
                    ● {place.open_now ? "Abierto" : "Cerrado"}
                  </span>
                )}
              </div>

              {place.rating != null && (
                <div className="mt-3 flex items-center gap-1.5 text-sm">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{place.rating.toFixed(1)}</span>
                  {place.user_rating_count != null && (
                    <span className="text-slate-400">({place.user_rating_count} reseñas)</span>
                  )}
                </div>
              )}
            </section>

            {/* Photo gallery */}
            {photos.length > 0 && (
              <section className="-mx-4">
                <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
                  {photos.map((src, i) => (
                    <div
                      key={src}
                      className="relative h-44 w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                    >
                      <img
                        src={src}
                        alt={`${place.name} foto ${i + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Stats grid */}
            <section className="grid grid-cols-2 gap-3">
              <Stat
                icon={<Euro className="h-4 w-4" />}
                label="Precio"
                value={
                  place.price_range_min != null || place.price_range_max != null
                    ? `${place.price_range_min ?? "?"}–${place.price_range_max ?? "?"} ${place.price_currency ?? "€"}`
                    : place.price_level?.replace("PRICE_LEVEL_", "") ?? "—"
                }
              />
              <Stat
                icon={<Clock className="h-4 w-4" />}
                label="Estado"
                value={
                  place.open_now == null
                    ? "s/d"
                    : place.open_now
                    ? "Abierto ahora"
                    : "Cerrado"
                }
              />
            </section>

            {/* Horarios */}
            {place.opening_hours_text && (
              <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Clock className="h-4 w-4" /> Horario
                </h3>
                <ul className="space-y-1 text-sm text-slate-300">
                  {place.opening_hours_text.split(" · ").map((line, i) => (
                    <li key={i} className="font-mono text-[12px]">{line}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Contacto */}
            <section className="space-y-2">
              {place.address && (
                <Row icon={<MapPin className="h-4 w-4" />} text={place.address} />
              )}
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
            <section className="flex gap-2 pt-2">
              {place.lat != null && place.lng != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-xl bg-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-slate-950 hover:bg-cyan-400"
                >
                  Cómo llegar
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
  icon, text, href, external,
}: { icon: React.ReactNode; text: string; href?: string; external?: boolean }) {
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
