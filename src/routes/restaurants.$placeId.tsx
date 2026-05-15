import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useEffect, useState } from "react";
import { getPlaceById, getPlacePhotos } from "@/lib/places.functions";
import { ArrowLeft, MapPin, Phone, Globe, Star, Clock, CalendarCheck, Navigation } from "lucide-react";
import ReferralDialog from "@/components/ReferralDialog";

const PlaceLocationMap = lazy(() => import("@/components/PlaceLocationMap"));

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
  const [qrOpen, setQrOpen] = useState(false);

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

  const price =
    place?.price_range_min != null || place?.price_range_max != null
      ? `${place?.price_range_min ?? "?"}–${place?.price_range_max ?? "?"} ${place?.price_currency ?? "€"}`
      : place?.price_level?.replace("PRICE_LEVEL_", "") ?? null;

  return (
    <div className="flex h-[100svh] flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header compacto */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-slate-950/80 px-3 py-2 backdrop-blur">
        <button
          onClick={() => router.history.back()}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/5 hover:bg-white/10"
          aria-label="Volver"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {place?.name ?? (loading ? "Cargando…" : "Restaurante")}
        </h1>
        {place?.open_now != null && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              place.open_now
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-rose-500/15 text-rose-300"
            }`}
          >
            ● {place.open_now ? "Abierto" : "Cerrado"}
          </span>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
        {loading && <p className="text-xs text-slate-400">Cargando…</p>}
        {err && <p className="text-xs text-rose-400">Error: {err}</p>}
        {!loading && !place && !err && (
          <p className="text-xs text-slate-400">No se encontró este restaurante.</p>
        )}

        {place && (
          <>
            {/* Meta line: cuisine · rating · price */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
              {place.cuisine && <span className="text-slate-400">{place.cuisine}</span>}
              {place.rating != null && (
                <a
                  href={`https://search.google.com/local/reviews?placeid=${place.google_place_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 hover:bg-white/10"
                >
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-semibold">{place.rating.toFixed(1)}</span>
                  {place.user_rating_count != null && (
                    <span className="text-slate-400">({place.user_rating_count})</span>
                  )}
                </a>
              )}
              {price && <span className="text-emerald-300">{price}</span>}
              {place.opening_hours_text && (
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Clock className="h-3 w-3" />
                  <span className="truncate max-w-[180px]">{place.opening_hours_text.split(" · ")[0]}</span>
                </span>
              )}
            </div>

            {/* Photo strip — compacta */}
            {photos.length > 0 && (
              <div className="-mx-3 shrink-0">
                <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto px-3">
                  {photos.map((src, i) => (
                    <div
                      key={src}
                      className="relative h-20 w-28 shrink-0 snap-start overflow-hidden rounded-lg border border-white/10 bg-white/5"
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
              </div>
            )}

            {/* Mapa — toma el espacio restante */}
            {place.lat != null && place.lng != null && (
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10">
                <Suspense fallback={<div className="h-full w-full animate-pulse bg-white/5" />}>
                  <PlaceLocationMap
                    lat={place.lat}
                    lng={place.lng}
                    name={place.name ?? "Restaurante"}
                    address={place.address}
                  />
                </Suspense>
              </div>
            )}

            {/* Contacto compacto: una línea */}
            <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-300">
              {place.address && (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="truncate max-w-[200px]">{place.address}</span>
                </span>
              )}
              {place.phone && (
                <a href={`tel:${place.phone}`} className="inline-flex items-center gap-1 hover:text-white">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {place.phone}
                </a>
              )}
              {place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-white"
                >
                  <Globe className="h-3 w-3 text-slate-400" />
                  Web
                </a>
              )}
            </div>

            {/* Acciones */}
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="flex flex-1 flex-col items-center justify-center gap-0 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-2 text-sm font-bold text-slate-950 shadow-md shadow-emerald-500/20"
              >
                <span className="flex items-center gap-1.5">
                  <CalendarCheck className="h-4 w-4" />
                  ¡VAMOS!
                </span>
                <span className="text-[9px] font-medium opacity-80">Te emitimos una invitación</span>
              </button>
              {place.lat != null && place.lng != null && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Cómo llegar
                </a>
              )}
              <Link
                to="/"
                className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                Volver
              </Link>
            </div>
          </>
        )}
      </main>

      {qrOpen && place && (
        <ReferralDialog
          placeId={place.google_place_id ?? placeId}
          placeName={place.name ?? "Restaurante"}
          onClose={() => setQrOpen(false)}
        />
      )}
    </div>
  );
}
