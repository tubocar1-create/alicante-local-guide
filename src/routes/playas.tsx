import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Waves, Navigation, Camera, Car, Train, Footprints } from "lucide-react";

export const Route = createFileRoute("/playas")({
  head: () => ({
    meta: [
      { title: "Playas de Alicante — Guía visual con fotos reales" },
      {
        name: "description",
        content:
          "Mapeo visual de las playas alrededor de Alicante ciudad con fotos reales, zonas, consejos, transporte y enlaces para llegar.",
      },
      { property: "og:title", content: "Playas de Alicante — Guía visual" },
      {
        property: "og:description",
        content:
          "Postiguet, San Juan, Albufereta, Cabo de las Huertas, Urbanova y escapadas de la Costa Blanca con fotos reales.",
      },
    ],
  }),
  component: PlayasPage,
});

type Beach = {
  zone: string;
  name: string;
  mood: string;
  image: string;
  alt: string;
  ideal: string;
  access: string;
  tip: string;
  query: string;
};

const BEACHES: Beach[] = [
  {
    zone: "Centro",
    name: "Playa del Postiguet",
    mood: "La playa urbana más icónica: castillo, puerto y casco antiguo a un paso.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Alicante_-_Playa_del_Postiguet.jpg/1280px-Alicante_-_Playa_del_Postiguet.jpg",
    alt: "Playa del Postiguet con el Castillo de Santa Bárbara al fondo",
    ideal: "Primera visita, familias, baño rápido, fotos y paseo por la Explanada.",
    access: "A pie desde el centro; TRAM y buses hacia Puerta del Mar/Postiguet.",
    tip: "Mejor temprano o al atardecer: la luz sobre el castillo es preciosa.",
    query: "Playa del Postiguet Alicante",
  },
  {
    zone: "Norte amplio",
    name: "Playa de San Juan",
    mood: "Arena larga, horizonte abierto y plan de día completo junto al mar.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Playa_de_San_Juan_-_Alicante.jpg/1280px-Playa_de_San_Juan_-_Alicante.jpg",
    alt: "Playa de San Juan en Alicante con arena y mar abierto",
    ideal: "Caminar, deporte, grupos, niños, chiringuitos de temporada y mucho espacio.",
    access: "TRAM hacia Playa de San Juan/Costa Blanca; también bus urbano.",
    tip: "Si quieres tranquilidad, aléjate de los accesos principales y ve hacia Muchavista.",
    query: "Playa de San Juan Alicante",
  },
  {
    zone: "Norte cercano",
    name: "Playa de la Albufereta",
    mood: "Bahía cómoda, más recogida y con ambiente local.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/02/Albufereta_beach_Alicante.jpg/1280px-Albufereta_beach_Alicante.jpg",
    alt: "Playa de la Albufereta en Alicante",
    ideal: "Mañana tranquila, baño calmado, familias y plan sin mucha logística.",
    access: "TRAM y bus desde Alicante; coche fuera de horas punta.",
    tip: "Combina muy bien con un paseo hacia Almadraba o Cabo de las Huertas.",
    query: "Playa de la Albufereta Alicante",
  },
  {
    zone: "Norte cercano",
    name: "Cala de la Almadraba",
    mood: "Pequeña, suave y muy bonita cuando baja el sol.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Playa_de_la_Almadraba%2C_Alicante%2C_Espa%C3%B1a%2C_2014-07-04%2C_DD_01.JPG/1280px-Playa_de_la_Almadraba%2C_Alicante%2C_Espa%C3%B1a%2C_2014-07-04%2C_DD_01.JPG",
    alt: "Cala de la Almadraba en Alicante",
    ideal: "Atardecer, parejas, lectura, baño corto y plan tranquilo.",
    access: "TRAM o bus hacia la zona Albufereta-Cabo.",
    tip: "Lleva agua y algo ligero; no tiene tantos servicios como una playa grande.",
    query: "Cala de la Almadraba Alicante",
  },
  {
    zone: "Cabo",
    name: "Cabo de las Huertas",
    mood: "Roca, agua clara, calas pequeñas y sensación más salvaje.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/Cabo_de_las_Huertas_Alicante.jpg/1280px-Cabo_de_las_Huertas_Alicante.jpg",
    alt: "Cabo de las Huertas en Alicante con costa rocosa",
    ideal: "Snorkel, amanecer, atardecer, fotos y aventura suave.",
    access: "TRAM o bus hasta paradas cercanas y caminar; aparcamiento limitado.",
    tip: "Escarpines obligatorios si quieres entrar cómodo al agua.",
    query: "Cabo de las Huertas Alicante",
  },
  {
    zone: "Cabo",
    name: "Cala Cantalar",
    mood: "Un rincón rocoso para agua transparente y gafas de snorkel.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Cala_Cantalar%2C_Cabo_de_la_Huerta%2C_Alicante.jpg/1280px-Cala_Cantalar%2C_Cabo_de_la_Huerta%2C_Alicante.jpg",
    alt: "Cala Cantalar en el Cabo de la Huerta de Alicante",
    ideal: "Snorkel, plan adulto, baño tranquilo y fotos del litoral.",
    access: "Transporte hasta Cabo de las Huertas y paseo final a pie.",
    tip: "Evita horas centrales en verano: hay poca sombra y la roca calienta.",
    query: "Cala Cantalar Alicante",
  },
  {
    zone: "Sur",
    name: "Saladar-Urbanova",
    mood: "Playa amplia, horizonte abierto y ritmo menos céntrico.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Playa_de_Urbanova%2C_Alicante.jpg/1280px-Playa_de_Urbanova%2C_Alicante.jpg",
    alt: "Playa de Urbanova en Alicante",
    ideal: "Caminar, ir con espacio, familias y desconexión cerca de la ciudad.",
    access: "Bus hacia Urbanova o coche.",
    tip: "Revisa viento y bandera: al estar abierta, el mar se nota más.",
    query: "Playa del Saladar Urbanova Alicante",
  },
  {
    zone: "Sur",
    name: "Agua Amarga",
    mood: "Un tramo diferente del litoral sur para explorar otra cara de Alicante.",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Alicante_-_Agua_Amarga.jpg/1280px-Alicante_-_Agua_Amarga.jpg",
    alt: "Zona costera de Agua Amarga en Alicante",
    ideal: "Paseo, fotos, plan alternativo y exploración tranquila.",
    access: "Mejor coche o bus según temporada y punto exacto.",
    tip: "Lleva calzado cómodo, agua y protección solar.",
    query: "Agua Amarga Alicante playa",
  },
];

const ESCAPES = [
  {
    name: "Cala Granadella · Jávea",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Playa_de_la_Granadella_-_Javea.jpg/1280px-Playa_de_la_Granadella_-_Javea.jpg",
    query: "Cala Granadella Javea",
  },
  {
    name: "Villajoyosa",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Villajoyosa%2C_Alicante%2C_Espa%C3%B1a%2C_2014-07-02%2C_DD_64.JPG/1280px-Villajoyosa%2C_Alicante%2C_Espa%C3%B1a%2C_2014-07-02%2C_DD_64.JPG",
    query: "Playa Villajoyosa Alicante",
  },
  {
    name: "Calpe · Peñón de Ifach",
    image: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Calpe_-_Pe%C3%B1%C3%B3n_de_Ifach.jpg/1280px-Calpe_-_Pe%C3%B1%C3%B3n_de_Ifach.jpg",
    query: "Calpe Peñón de Ifach playa",
  },
];

const zoneSummary = [
  ["Centro", "Postiguet", "10 min a pie", "baño + ciudad"],
  ["Norte cercano", "Albufereta · Almadraba · Cabo", "TRAM/bus", "calas + snorkel"],
  ["Norte amplio", "San Juan · Muchavista", "TRAM", "día completo"],
  ["Sur", "Urbanova · Agua Amarga", "bus/coche", "espacio + calma"],
  ["Escapada", "Villajoyosa · Jávea · Calpe", "coche/TRAM parcial", "postal Costa Blanca"],
];

function PlayasPage() {
  const location = useLocation();

  if (location.pathname !== "/playas") {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.018_205)] text-[oklch(0.18_0.04_235)]">
      <header className="relative min-h-[72vh] overflow-hidden">
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Alicante_-_Playa_del_Postiguet.jpg/1600px-Alicante_-_Playa_del_Postiguet.jpg"
          alt="Playa del Postiguet de Alicante con el Castillo de Santa Bárbara"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/15 to-[oklch(0.98_0.018_205)]" />
        <div className="relative mx-auto flex min-h-[72vh] max-w-5xl flex-col justify-between px-4 py-5">
          <Link
            to="/"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <div className="pb-10 text-white drop-shadow-lg">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] backdrop-blur">
              <Waves className="h-4 w-4" /> Mapa visual de playas
            </div>
            <h1 className="mt-4 max-w-3xl text-4xl font-black leading-none sm:text-6xl">
              Playas alrededor de Alicante
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-relaxed text-white/95 sm:text-lg">
              Una charla visual para elegir entre arena urbana, calas rocosas, snorkel, atardecer y escapadas por la Costa Blanca.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20">
        <section className="-mt-10 grid gap-2 rounded-3xl bg-white/95 p-3 shadow-xl ring-1 ring-sky-100 backdrop-blur sm:grid-cols-5">
          {zoneSummary.map(([zone, places, access, vibe]) => (
            <div key={zone} className="rounded-2xl bg-sky-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-sky-700">{zone}</p>
              <p className="mt-1 text-sm font-extrabold text-slate-900">{places}</p>
              <p className="mt-2 text-xs text-slate-600">{access}</p>
              <p className="text-xs font-bold text-cyan-700">{vibe}</p>
            </div>
          ))}
        </section>

        

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          {BEACHES.map((beach) => (
            <BeachCard key={beach.name} beach={beach} />
          ))}
        </section>

        <section className="mt-12">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">Si quieres ir más lejos</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">Escapadas de postal</h2>
            </div>
            <Car className="h-7 w-7 text-cyan-700" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {ESCAPES.map((escape) => (
              <a
                key={escape.name}
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(escape.query)}`}
                target="_blank"
                rel="noreferrer"
                className="group overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-sky-100"
              >
                <img src={escape.image} alt={escape.name} loading="lazy" className="h-48 w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="p-4">
                  <p className="font-black text-slate-950">{escape.name}</p>
                  <p className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-cyan-700">
                    <MapPin className="h-4 w-4" /> Abrir mapa
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-12 grid gap-3 rounded-3xl bg-slate-950 p-5 text-white sm:grid-cols-3">
          <InfoBlock icon={<Train className="h-5 w-5" />} title="Sin coche" text="Postiguet, Albufereta, San Juan y parte del Cabo funcionan muy bien con TRAM y bus." />
          <InfoBlock icon={<Footprints className="h-5 w-5" />} title="Calas" text="Para Cabo y Cantalar lleva escarpines, agua y poco peso. La sombra es limitada." />
          <InfoBlock icon={<Camera className="h-5 w-5" />} title="Mejor luz" text="Postiguet al amanecer, Almadraba al atardecer y San Juan en horas suaves." />
        </section>

        <section className="mt-12 overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-600 via-sky-600 to-indigo-700 p-6 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-100">Cuando quieras situarte</p>
          <h2 className="mt-2 text-3xl font-black leading-tight">Abre el mapa interactivo a página completa</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold text-white/90">
            Ya tienes la charla y las recomendaciones. Despliega el mapa entero para ver dónde está cada playa y elegir tu plan de un vistazo.
          </p>
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

function BeachCard({ beach }: { beach: Beach }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-sky-100">
      <div className="relative h-64 overflow-hidden">
        <img src={beach.image} alt={beach.alt} loading="lazy" className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4 text-white">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-100">{beach.zone}</p>
          <h2 className="mt-1 text-2xl font-black leading-tight">{beach.name}</h2>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm font-semibold leading-relaxed text-slate-700">{beach.mood}</p>
        <div className="grid gap-2 text-sm">
          <p><span className="font-black text-slate-950">Ideal:</span> {beach.ideal}</p>
          <p><span className="font-black text-slate-950">Cómo llegar:</span> {beach.access}</p>
          <p><span className="font-black text-slate-950">Tip:</span> {beach.tip}</p>
        </div>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(beach.query)}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-black text-white shadow-sm"
        >
          <Navigation className="h-4 w-4" /> Ver en mapa
        </a>
      </div>
    </article>
  );
}

function InfoBlock({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-4">
      <div className="flex items-center gap-2 text-cyan-200">
        {icon}
        <h3 className="font-black text-white">{title}</h3>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-white/75">{text}</p>
    </div>
  );
}

