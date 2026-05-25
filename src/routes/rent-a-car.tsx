import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, ArrowLeft, Clock, Bus, Users, MapPin, Sparkles, Timer, ImagePlus } from "lucide-react";

export const Route = createFileRoute("/rent-a-car")({
  head: () => ({
    meta: [
      { title: "Rent a Car en Alicante — Alquiler de coches en el aeropuerto ALC" },
      {
        name: "description",
        content:
          "Guía honesta para alquilar coche en el aeropuerto de Alicante-Elche (ALC): shuttle, colas, oficina en terminal, estado de los vehículos y devolución.",
      },
      { property: "og:title", content: "Rent a Car en Alicante (ALC)" },
      {
        property: "og:description",
        content:
          "Compara compañías de alquiler en el aeropuerto de Alicante por experiencia real, no solo por precio.",
      },
      { property: "og:url", content: "https://vamosalicante.com/rent-a-car" }
    ],
  links: [
      { rel: "canonical", href: "https://vamosalicante.com/rent-a-car" },
    ],
  }),
  component: RentACarPage,
});

const FACTORS = [
  { icon: Clock, title: "Tiempo de shuttle", desc: "Cuánto tarda el traslado desde la terminal hasta la oficina." },
  { icon: Bus, title: "Frecuencia del shuttle", desc: "Tiempo medio de espera entre vehículos de traslado." },
  { icon: Users, title: "Tiempo de cola", desc: "Basado en experiencias reales y momentos de alta ocupación." },
  { icon: MapPin, title: "Oficina en terminal", desc: "Uno de los factores más cómodos para familias con equipaje." },
  { icon: Sparkles, title: "Estado de los vehículos", desc: "Limpieza, mantenimiento y antigüedad percibida." },
  { icon: Timer, title: "Tiempo de devolución", desc: "Rapidez y facilidad al entregar el coche antes del vuelo." },
];

type Photo = { src?: string; emoji: string; caption: string };

function PhotoCard({ photo }: { photo: Photo }) {
  return (
    <figure className="my-5 overflow-hidden rounded-3xl bg-white/5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
      {photo.src ? (
        <img
          src={photo.src}
          alt={photo.caption}
          loading="lazy"
          className="h-64 w-full object-cover sm:h-80"
        />
      ) : (
        <div className="flex h-64 w-full flex-col items-center justify-center gap-2 border-b border-dashed border-white/15 bg-white/[0.03] text-white/40 sm:h-80">
          <ImagePlus className="h-8 w-8" />
          <span className="text-xs">Espacio para foto real</span>
        </div>
      )}
      <figcaption className="px-4 py-3 text-[15px] font-medium leading-snug text-white/90">
        {photo.emoji} {photo.caption}
      </figcaption>
    </figure>
  );
}

function RentACarPage() {
  return (
    <div
      className="h-dvh overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #0a1933 0%, #0d2547 40%, #0a1933 100%)",
      }}
    >
      {/* Header sticky */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 backdrop-blur-md"
        style={{ background: "linear-gradient(180deg, rgba(10,25,51,0.95), rgba(10,25,51,0.75))" }}
      >
        <Link
          to="/"
          className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-sky-400/20 text-sky-300">
            <Car className="h-5 w-5" />
          </div>
          <h1 className="font-serif text-xl font-bold tracking-tight">Rent a Car · Alicante</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-24 pt-4">
        <p className="mb-4 text-sm text-sky-200/80">
          Aeropuerto Alicante-Elche (ALC) y alrededores
        </p>

        <Link
          to="/rent-a-car-comparador"
          className="mb-5 flex items-center justify-center rounded-2xl border border-sky-300/30 bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-center font-semibold text-white shadow-lg transition hover:from-sky-400 hover:to-blue-500"
        >
          Ver compañías de Alquiler de Vehículos
        </Link>

        {/* Carrusel horizontal de fotos */}
        <div className="-mx-4 mb-5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-3 px-4 snap-x snap-mandatory">
            {[
              { src: "/alicante/altea.jpeg", emoji: "🌊", caption: "Altea — postal mediterránea" },
              { src: "/alicante/moraira.jpg", emoji: "🛣️", caption: "Moraira — calas tranquilas" },
              { src: "/alicante/guadalest.jpg", emoji: "🏰", caption: "Guadalest — interior espectacular" },
              { src: "/alicante/algar.jpg", emoji: "💧", caption: "Fuentes del Algar" },
              { src: "/alicante/tabarca.jpg", emoji: "🏝️", caption: "Isla de Tabarca" },
              { src: "/alicante/villajoyosa.jpg", emoji: "🎨", caption: "Villajoyosa — fachadas de colores" },
            ].map((p) => (
              <figure
                key={p.src}
                className="snap-start shrink-0 w-[78%] sm:w-[55%] overflow-hidden rounded-3xl bg-white/5 ring-1 ring-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)]"
              >
                <img src={p.src} alt={p.caption} loading="lazy" className="h-48 w-full object-cover sm:h-64" />
                <figcaption className="px-3 py-2 text-xs font-medium text-white/90">
                  {p.emoji} {p.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <p className="text-[16px] leading-relaxed text-white/90">
          Alicante es uno de los destinos turísticos más importantes del Mediterráneo y su
          aeropuerto, <strong className="text-white">Alicante-Elche (ALC)</strong>, recibe millones
          de viajeros cada año. Alquilar coche es la forma más cómoda de descubrir{" "}
          <strong className="text-white">Benidorm, Jávea, Calpe o Altea</strong> con libertad total.
        </p>

        <p className="mt-4 text-[16px] leading-relaxed text-white/90">
          La experiencia entre compañías varía mucho: tiempo de shuttle, frecuencia de recogida y la
          existencia de oficina dentro del aeropuerto marcan la diferencia, sobre todo en temporada
          alta.
        </p>

        <ul className="ml-5 mt-3 list-disc space-y-1 text-white/80">
          <li>algunas tienen oficinas dentro de la terminal,</li>
          <li>otras requieren traslado en shuttle externo,</li>
          <li>algunas priorizan rapidez, otras generan largas colas.</li>
        </ul>

        <p className="mt-4 text-xs text-white/50">
          Fotos: <a href="https://mochilaexpres.com/que-ver-en-alicante-provincia/" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/70">mochilaexpres.com</a>
        </p>

        <Link
          to="/rent-a-car-comparador"
          className="mt-6 flex items-center justify-center rounded-2xl border border-sky-300/30 bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-center font-semibold text-white shadow-lg transition hover:from-sky-400 hover:to-blue-500"
        >
          Ver compañías de Alquiler de Vehículos
        </Link>


        {/* Factores */}
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-xl font-semibold">Qué mirar antes de reservar</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FACTORS.map(({ icon: Icon, title, desc }) => (
              <li key={title}>
                <Link
                  to="/rent-a-car-comparador"
                  className="block rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm transition hover:border-sky-300/40 hover:bg-white/10"
                >
                  <div className="mb-2 flex items-center gap-2 text-sky-300">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-semibold text-white">{title}</span>
                  </div>
                  <p className="text-xs text-white/70">{desc}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
