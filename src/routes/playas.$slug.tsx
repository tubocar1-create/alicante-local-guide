import { createFileRoute, Link, notFound, redirect, Await } from "@tanstack/react-router";
import { Suspense } from "react";
import { ArrowLeft, MapPin, Navigation, Sparkles, Star, Ticket } from "lucide-react";
import { getBeachQuick, getBeachExtras, type BeachExtras } from "@/lib/playas-map.functions";
import { getBeachBySlug } from "@/lib/playas-map-data";
import { getToursForBeach } from "@/lib/viator-tours";

export const Route = createFileRoute("/playas/$slug")({
  loader: async ({ params }) => {
    // Defensive: slug debe ser ascii kebab-case. Si no, redirigimos al listado.
    if (!/^[a-z0-9-]+$/.test(params.slug)) {
      throw redirect({ to: "/playas" });
    }
    let quick;
    try {
      quick = await getBeachQuick({ data: { slug: params.slug } });
    } catch {
      throw redirect({ to: "/playas" });
    }
    if (!quick) throw redirect({ to: "/playas" });
    // Fire-and-forget — render header immediately, stream the rest.
    const extras = getBeachExtras({ data: { slug: params.slug } });
    return { quick, extras };
  },
  staleTime: Infinity,
  gcTime: Infinity,
  shouldReload: false,
  head: ({ params }) => {
    const b = getBeachBySlug(params.slug);
    const name = b?.name ?? "Playa de Alicante";
    const url = `https://vamosalicante.com/playas/${params.slug}`;
    const ld: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      name,
      url,
      description: b?.description ?? "Playa de Alicante con fotos reales, reseñas y cómo llegar.",
      address: { "@type": "PostalAddress", addressLocality: "Alicante", addressCountry: "ES" },
    };
    if (b?.lat && b?.lng) {
      ld.geo = { "@type": "GeoCoordinates", latitude: b.lat, longitude: b.lng };
    }
    return {
      meta: [
        { title: `${name} — Fotos, reseñas y cómo ir`.slice(0, 60) },
        { name: "description", content: (b?.description ?? "Playa de Alicante con fotos reales, reseñas y cómo llegar.").slice(0, 160) },
        { property: "og:title", content: `${name} — Playas de Alicante` },
        { property: "og:description", content: (b?.description ?? "").slice(0, 160) },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },

  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 p-6 text-center">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Playa no encontrada</h1>
        <Link to="/playas" className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-bold text-white">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 p-6 text-center">
      <div>
        <h1 className="text-xl font-black text-slate-900">No pudimos cargar esta playa</h1>
        <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        <Link to="/playas" className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-bold text-white">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>
    </div>
  ),
  component: BeachDetailPage,
});

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i <= full ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
      ))}
    </div>
  );
}

function ExtrasSkeleton() {
  return (
    <>
      <section className="-mt-4">
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 w-72 flex-none animate-pulse rounded-2xl bg-slate-200 sm:h-56 sm:w-80" />
          ))}
        </div>
      </section>
      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-sky-100">
        <div className="flex items-center gap-2 text-cyan-700">
          <Sparkles className="h-4 w-4" />
          <p className="text-[11px] font-black uppercase tracking-[0.2em]">Comentario IA</p>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-9/12 animate-pulse rounded bg-slate-200" />
        </div>
      </section>
    </>
  );
}

function ExtrasBlock({ data, beachName }: { data: BeachExtras; beachName: string }) {
  const { photos, review, reviews, rating, userRatingCount, formattedAddress } = data;
  return (
    <>
      {photos.length > 1 && (
        <section className="-mt-4">
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
            {photos.slice(1).map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`${beachName} — foto ${i + 2}`}
                loading="lazy"
                decoding="async"
                className="h-48 w-72 flex-none snap-start rounded-2xl object-cover shadow ring-1 ring-sky-100 sm:h-56 sm:w-80"
              />
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-sky-100">
        <div className="flex items-center gap-2 text-cyan-700">
          <Sparkles className="h-4 w-4" />
          <p className="text-[11px] font-black uppercase tracking-[0.2em]">Comentario IA</p>
        </div>
        <p className="mt-3 whitespace-pre-line text-[15px] font-medium leading-relaxed text-slate-800">{review}</p>
      </section>

      {typeof rating === "number" && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-800 shadow-sm ring-1 ring-sky-100">
          <Stars value={rating} />
          <span>{rating.toFixed(1)}</span>
          {userRatingCount ? <span className="text-slate-500">· {userRatingCount} reseñas</span> : null}
        </div>
      )}

      {reviews.length > 0 && (
        <section className="mt-6">
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Reseñas de Google</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Qué dicen quienes han ido</h2>
          </div>
          <div className="space-y-3">
            {reviews.map((r, i) => (
              <article key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-sky-100">
                <header className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black text-slate-900">{r.author}</p>
                  <Stars value={r.rating} />
                </header>
                {r.relativeTime && <p className="mt-0.5 text-[11px] text-slate-500">{r.relativeTime}</p>}
                <p className="mt-2 line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-slate-700">{r.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {formattedAddress && (
        <p className="mt-6 text-sm text-slate-600">
          <span className="font-black text-slate-900">Dirección: </span>
          {formattedAddress}
        </p>
      )}
    </>
  );
}

function ViatorFooter({ beachSlug }: { beachSlug: string }) {
  const tours = getToursForBeach(beachSlug);
  if (tours.length === 0) return null;
  return (
    <section className="mt-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-sky-100">
      <div className="flex items-center gap-2 text-cyan-700">
        <Ticket className="h-4 w-4" />
        <p className="text-[11px] font-black uppercase tracking-[0.2em]">Excursiones recomendadas</p>
      </div>
      <h2 className="mt-1 text-lg font-black text-slate-950">Planes y tours cerca</h2>
      <ul className="mt-3 divide-y divide-sky-100">
        {tours.map((t) => (
          <li key={t.url}>
            <a
              href={t.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="flex items-center justify-between gap-3 py-2.5 text-sm font-semibold text-slate-800 hover:text-cyan-700"
            >
              <span className="line-clamp-2">{t.title}</span>
              <span className="shrink-0 text-[11px] font-black uppercase tracking-wider text-cyan-700">Reservar →</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] uppercase tracking-wider text-slate-400">Enlaces de afiliado · Viator</p>
    </section>
  );
}

function BeachDetailPage() {
  const { quick, extras } = Route.useLoaderData();
  const { beach, cover, googleMapsUri } = quick;
  const directionsUrl =
    googleMapsUri ??
    `https://www.google.com/maps/dir/?api=1&destination=${beach.lat},${beach.lng}&destination_place_id=${encodeURIComponent(beach.mapsQuery)}`;

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.018_205)] text-[oklch(0.18_0.04_235)]">
      <header className="relative h-[52vh] min-h-[320px] w-full overflow-hidden">
        {cover ? (
          <img src={cover} alt={beach.name} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-sky-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-[oklch(0.98_0.018_205)]" />
        <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-between px-4 py-5">
          <Link
            to="/playas"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-sm font-bold text-slate-800 shadow"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <div className="pb-6 text-white drop-shadow-lg">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] backdrop-blur">
              <MapPin className="h-3.5 w-3.5" /> Playa de Alicante
            </div>
            <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">{beach.name}</h1>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-white/95 sm:text-base">{beach.description}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-16">
        <Suspense fallback={<ExtrasSkeleton />}>
          <Await promise={extras as unknown as Promise<BeachExtras | null>}>
            {(data) => (data ? <ExtrasBlock data={data} beachName={beach.name} /> : null)}
          </Await>
        </Suspense>

        <section className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-cyan-600 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.01]"
          >
            <Navigation className="h-4 w-4" /> Cómo ir a {beach.name}
          </a>
          <Link
            to="/playas/mapa"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-cyan-700 shadow ring-1 ring-cyan-100"
          >
            <MapPin className="h-4 w-4" /> Ver en el mapa
          </Link>
        </section>

        <ViatorFooter beachSlug={beach.slug} />
      </main>
    </div>
  );
}
