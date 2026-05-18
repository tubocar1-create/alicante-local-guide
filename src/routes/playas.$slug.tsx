import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Navigation, Sparkles } from "lucide-react";
import { getBeachDetail } from "@/lib/playas-map.functions";
import { getBeachBySlug } from "@/lib/playas-map-data";

export const Route = createFileRoute("/playas/$slug")({
  loader: async ({ params }) => {
    const detail = await getBeachDetail({ data: { slug: params.slug } });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ params }) => {
    const b = getBeachBySlug(params.slug);
    const name = b?.name ?? "Playa de Alicante";
    return {
      meta: [
        { title: `${name} — Guía visual con fotos reales` },
        { name: "description", content: b?.description ?? "Ficha visual de una playa de Alicante." },
        { property: "og:title", content: `${name} — Playas de Alicante` },
        { property: "og:description", content: b?.description ?? "" },
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 p-6 text-center">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Playa no encontrada</h1>
        <Link to="/playas/mapa" className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-bold text-white">
          <MapPin className="h-4 w-4" /> Abrir mapa
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen items-center justify-center bg-sky-50 p-6 text-center">
      <div>
        <h1 className="text-xl font-black text-slate-900">No pudimos cargar la ficha</h1>
        <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        <Link to="/playas/mapa" className="mt-4 inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-bold text-white">
          <MapPin className="h-4 w-4" /> Volver al mapa
        </Link>
      </div>
    </div>
  ),
  component: BeachDetailPage,
});

function BeachDetailPage() {
  const { beach, photos, review } = Route.useLoaderData();
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${beach.lat},${beach.lng}&destination_place_id=${encodeURIComponent(beach.mapsQuery)}`;
  const cover = photos[0];

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.018_205)] text-[oklch(0.18_0.04_235)]">
      <header className="relative h-[52vh] min-h-[320px] w-full overflow-hidden">
        {cover ? (
          <img src={cover} alt={beach.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-sky-700" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/15 to-[oklch(0.98_0.018_205)]" />
        <div className="relative mx-auto flex h-full max-w-5xl flex-col justify-between px-4 py-5">
          <Link
            to="/playas/mapa"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-sm font-bold text-slate-800 shadow"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al mapa
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
        {photos.length > 1 && (
          <section className="-mt-4">
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {photos.slice(1).map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`${beach.name} — foto ${i + 2}`}
                  loading="lazy"
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
      </main>
    </div>
  );
}
