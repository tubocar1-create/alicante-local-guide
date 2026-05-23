import { createFileRoute, Link } from "@tanstack/react-router";
import { Car, ArrowLeft, Clock, Bus, Users, MapPin, Sparkles, Timer } from "lucide-react";
import entornoImg from "@/assets/rentacar-entorno.jpg";
import sectorImg from "@/assets/rentacar-sector.jpg";
import carreteraImg from "@/assets/rentacar-carretera.jpg";
import playaImg from "@/assets/rentacar-playa.jpg";

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
    ],
  }),
  component: RentACarPage,
});

const FACTORS = [
  {
    icon: Clock,
    title: "Tiempo de shuttle",
    desc: "Cuánto tarda el traslado desde la terminal hasta la oficina de la compañía.",
  },
  {
    icon: Bus,
    title: "Frecuencia del shuttle",
    desc: "Tiempo medio de espera entre vehículos de traslado al parking de recogida.",
  },
  {
    icon: Users,
    title: "Tiempo de cola",
    desc: "Basado en experiencias reales de usuarios y momentos de alta ocupación.",
  },
  {
    icon: MapPin,
    title: "Oficina en terminal",
    desc: "Uno de los factores más cómodos para familias y viajeros con equipaje.",
  },
  {
    icon: Sparkles,
    title: "Estado de los vehículos",
    desc: "Limpieza, mantenimiento y antigüedad percibida de la flota.",
  },
  {
    icon: Timer,
    title: "Tiempo de devolución",
    desc: "Rapidez y facilidad al entregar el coche antes del vuelo.",
  },
];

function RentACarPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-background">
    <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver
      </Link>

      <header className="mb-6 flex items-center gap-3">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Car className="h-7 w-7" />
        </div>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Rent a car en Alicante</h1>
          <p className="text-sm text-muted-foreground">
            Aeropuerto Alicante-Elche (ALC) y alrededores
          </p>
        </div>
      </header>

      <figure className="mb-5 overflow-hidden rounded-2xl border border-border shadow-sm">
        <img
          src={entornoImg}
          alt="Carretera costera del Mediterráneo cerca de Alicante al atardecer"
          width={1920}
          height={1080}
          className="h-56 w-full object-cover sm:h-72 md:h-80"
        />
        <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">
          Costa mediterránea cerca de Alicante — el entorno ideal para descubrir en coche.
        </figcaption>
      </figure>

      <article className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
        <p>
          Alicante es uno de los destinos turísticos más importantes del Mediterráneo y su
          aeropuerto, <strong>Alicante-Elche (ALC)</strong>, recibe millones de viajeros cada año,
          especialmente durante primavera y verano. Para muchos turistas, el alquiler de coche no
          es un lujo: es la forma más cómoda de descubrir playas, calas, pueblos costeros y zonas
          como <strong>Benidorm, Jávea, Calpe o Altea</strong> con libertad total.
        </p>

        <figure className="my-2 overflow-hidden rounded-2xl border border-border shadow-sm">
          <img
            src={carreteraImg}
            alt="Carretera costera mediterránea cerca de Alicante con vistas al mar"
            width={1536}
            height={896}
            loading="lazy"
            className="h-56 w-full object-cover sm:h-72 md:h-80"
          />
          <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">
            Carreteras costeras de la provincia de Alicante, ideales para recorrer en coche alquilado.
          </figcaption>
        </figure>

        <p>
          La experiencia de alquilar un vehículo en Alicante puede variar mucho entre compañías.
          Dos reservas con precios similares pueden convertirse en experiencias completamente
          diferentes una vez el viajero aterriza. Por eso, al comparar, no es conveniente
          centrarse únicamente en el precio, sino en todo aquello que realmente impacta el inicio
          y final de las vacaciones.
        </p>

        <figure className="my-2 overflow-hidden rounded-2xl border border-border shadow-sm">
          <img
            src={sectorImg}
            alt="Flota de coches de alquiler en el aeropuerto de Alicante-Elche"
            width={1920}
            height={1080}
            loading="lazy"
            className="h-56 w-full object-cover sm:h-72 md:h-80"
          />
          <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">
            Flota de alquiler junto a la terminal del aeropuerto de Alicante-Elche (ALC).
          </figcaption>
        </figure>

        <p>
          Después de un vuelo, el usuario quiere llegar al coche rápido, evitar esperas
          innecesarias y conducir hacia su destino sin estrés. Aspectos como el tiempo de
          shuttle desde la terminal, la frecuencia de recogida o la existencia de oficina dentro
          del aeropuerto pueden marcar diferencia, especialmente en temporada alta, cuando el
          aeropuerto opera a máxima capacidad.
        </p>
        <p>También es importante entender cómo funciona realmente cada operadora:</p>
        <ul className="ml-5 list-disc space-y-1 text-foreground/80">
          <li>algunas tienen oficinas dentro de la terminal,</li>
          <li>otras requieren traslado en shuttle externo,</li>
          <li>algunas priorizan rapidez,</li>
          <li>otras generan largas colas en horas punta.</li>
        </ul>
        <p>
          Por eso, además del precio, el usuario debe valorar factores operativos reales que
          afectan directamente a la experiencia del viajero.
        </p>

        <figure className="my-2 overflow-hidden rounded-2xl border border-border shadow-sm">
          <img
            src={playaImg}
            alt="Cala mediterránea con agua cristalina cerca de Alicante, accesible en coche"
            width={1536}
            height={896}
            loading="lazy"
            className="h-56 w-full object-cover sm:h-72 md:h-80"
          />
          <figcaption className="bg-card px-3 py-2 text-xs text-muted-foreground">
            Calas y playas de la Costa Blanca que puedes descubrir con total libertad en coche.
          </figcaption>
        </figure>
      </article>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Qué mirar antes de reservar</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {FACTORS.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Icon className="h-4 w-4" />
                <span className="text-sm font-semibold text-foreground">{title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Próximamente</p>
        <p className="mt-1">
          Estamos preparando un comparador real de compañías de alquiler en ALC con datos
          operativos, no solo precios. Si quieres aportar tu experiencia, escríbenos desde el
          perfil.
        </p>
      </section>
    </main>
    </div>
  );
}
