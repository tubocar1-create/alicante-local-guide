import { createFileRoute, Link, Outlet, useLocation, useSearch } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Waves, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { getMapBeaches, getCoastIntro } from "@/lib/playas-map.functions";

export const Route = createFileRoute("/playas")({
  validateSearch: (s: Record<string, unknown>) => ({
    focus: typeof s.focus === "string" ? (s.focus as string) : undefined,
  }),
  loader: async () => {
    const [beaches, intro] = await Promise.all([getMapBeaches(), getCoastIntro()]);
    return { beaches, intro };
  },
  staleTime: Infinity,
  gcTime: Infinity,
  shouldReload: false,
  head: () => ({
    meta: [
      { title: "Playas de Alicante — Guía visual con fotos reales" },
      {
        name: "description",
        content:
          "Las playas de Alicante en un scroll de fotos reales conectadas con el mapa interactivo de la costa.",
      },
      { property: "og:title", content: "Playas de Alicante — Guía visual" },
      {
        property: "og:description",
        content:
          "Desliza las 17 playas de Alicante y abre el mapa interactivo para situarte.",
      },
      { property: "og:url", content: "https://vamosalicante.com/playas" }
    ],
  links: [
      { rel: "canonical", href: "https://vamosalicante.com/playas" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Playas de Alicante",
          description: "Guía visual de las 17 playas de Alicante con fotos reales y mapa interactivo.",
          url: "https://vamosalicante.com/playas",
        }),
      },
    ],
  }),
  component: PlayasPage,
});

function PlayasPage() {
  const location = useLocation();
  const search = useSearch({ from: "/playas" }) as { focus?: string };
  const { beaches: mapBeaches, intro } = Route.useLoaderData();
  const carruselRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (search.focus === "carrusel" && carruselRef.current) {
      // Pequeño delay para asegurar render completo antes del scroll.
      const t = setTimeout(() => {
        carruselRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      return () => clearTimeout(t);
    }
  }, [search.focus]);

  if (location.pathname !== "/playas") {
    return <Outlet />;
  }

  return (
    <div className="h-[100dvh] lg:h-auto overflow-y-auto lg:overflow-visible overscroll-contain bg-[oklch(0.98_0.018_205)] text-[oklch(0.18_0.04_235)]">
      <header className="relative min-h-[58vh] overflow-hidden">
        <img
          src="/playas/coast-intro.jpg"
          alt="Vista panorámica de la costa de Alicante"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-[oklch(0.98_0.018_205)]" />
        <div className="relative mx-auto flex min-h-[58vh] max-w-5xl flex-col justify-between px-4 py-5">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <div className="pb-8 text-white drop-shadow-lg">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] backdrop-blur">
              <Waves className="h-4 w-4" /> Playas de Alicante
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-none sm:text-6xl">
              La costa, en un scroll
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="-mt-8 rounded-3xl bg-white p-5 shadow-xl ring-1 ring-sky-100">
          <div className="flex items-center gap-2 text-cyan-700">
            <Sparkles className="h-4 w-4" />
            <p className="text-[11px] font-black uppercase tracking-[0.2em]">Comentario IA</p>
          </div>
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-slate-800">{intro.text}</p>
        </section>

        <section id="carrusel" ref={carruselRef} className="mt-6 scroll-mt-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">17 playas</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Desliza y abre el mapa</h2>
            </div>
            <Link
              to="/playas/mapa"
              className="inline-flex items-center gap-1 rounded-full bg-cyan-600 px-3 py-2 text-xs font-black text-white shadow"
            >
              <MapPin className="h-3.5 w-3.5" /> Mapa
            </Link>
          </div>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-5 lg:overflow-visible lg:px-0 lg:snap-none">
            {mapBeaches.map((b: typeof mapBeaches[number]) => (
              <Link
                key={b.slug}
                to="/playas/$slug"
                params={{ slug: b.slug }}
                className="group relative h-[80vh] w-[85vw] max-w-[520px] flex-none snap-center overflow-hidden rounded-3xl bg-slate-200 shadow-xl ring-1 ring-sky-100 lg:h-72 lg:w-auto lg:max-w-none lg:flex-initial lg:snap-align-none"
              >
                {b.photo ? (
                  <img
                    src={b.photo}
                    alt={b.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-sky-600" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100">Playa</p>
                  <p className="mt-1 text-sm font-black leading-tight">{b.name}</p>
                  <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-cyan-100">
                    Ver ficha
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">Cuando quieras situarte</p>
          <h2 className="mt-2 text-3xl font-black leading-tight">Abre el mapa interactivo</h2>
          <Link
            to="/playas/mapa"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-cyan-700 shadow-lg transition hover:scale-[1.02]"
          >
            <MapPin className="h-4 w-4" /> Ver mapa completo
          </Link>
        </section>
      </main>
    </div>
  );
}
