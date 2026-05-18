import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, MapPin, ExternalLink, Waves, Compass, Backpack, Lightbulb } from "lucide-react";
import { getPlayasBeaches, getPlayasGuide, type PlayaInfo } from "@/lib/playas.functions";
import { PLAYAS } from "@/lib/playas-data";

export const Route = createFileRoute("/playas")({
  head: () => ({
    meta: [
      { title: "Playas de Alicante — Guía local con fotos reales" },
      {
        name: "description",
        content:
          "Guía completa de las mejores playas y calas escondidas de la provincia de Alicante: cómo ir, qué llevar y qué hacer en la Costa Blanca.",
      },
      { property: "og:title", content: "Playas de Alicante — Guía local" },
      {
        property: "og:description",
        content:
          "Arenales urbanos y calas salvajes de la Costa Blanca con fotos reales y consejos prácticos.",
      },
    ],
  }),
  component: PlayasPage,
});

// Seed list shown instantly while Wikipedia photos/extracts load.
const SEED_BEACHES: PlayaInfo[] = PLAYAS.map((p) => ({
  slug: p.slug,
  name: p.name,
  town: p.town,
  category: p.category,
  extract: "",
  photo: null,
  wikiUrl: `https://es.wikipedia.org/wiki/${encodeURIComponent(p.wikiTitle)}`,
  lat: p.lat,
  lng: p.lng,
}));

function PlayasPage() {
  const fetchBeaches = useServerFn(getPlayasBeaches);
  const fetchGuide = useServerFn(getPlayasGuide);

  const beachesQ = useQuery({
    queryKey: ["playas-beaches"],
    queryFn: () => fetchBeaches(),
    staleTime: 1000 * 60 * 60,
  });
  const guideQ = useQuery({
    queryKey: ["playas-guide"],
    queryFn: () => fetchGuide(),
    staleTime: 1000 * 60 * 60,
  });

  const [tab, setTab] = useState<"populares" | "escondidas">("populares");

  const beaches = beachesQ.data ?? SEED_BEACHES;
  const list = useMemo(() => beaches.filter((p) => p.category === tab), [beaches, tab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-cyan-50 to-white text-slate-900">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Playa_de_la_Granadella_-_Javea.jpg/1600px-Playa_de_la_Granadella_-_Javea.jpg')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sky-900/40 via-sky-900/30 to-white" />
        <div className="relative mx-auto max-w-3xl px-4 pt-6 pb-10">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <div className="mt-8 text-white drop-shadow">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              <Waves className="h-3.5 w-3.5" /> Costa Blanca
            </div>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
              Playas de Alicante
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/90 sm:text-base">
              Arenales urbanos y calas escondidas, con fotos reales y consejos de quien las pisa cada verano.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20 -mt-4">
        {/* Intro */}
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {isLoading ? (
            <div className="h-24 animate-pulse rounded bg-slate-100" />
          ) : error ? (
            <p className="text-sm text-red-600">No se pudo cargar la guía. Reintenta en un momento.</p>
          ) : (
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700">
              {data?.guide.intro}
            </p>
          )}
        </section>

        {/* Tabs */}
        <div className="mt-6 flex gap-2 rounded-full bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {([
            { id: "populares", label: "Playas populares" },
            { id: "escondidas", label: "Calas escondidas" },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Beach grid */}
        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-100" />
              ))
            : list.map((p) => <PlayaCard key={p.slug} p={p} />)}
        </section>

        {/* Guide */}
        {data?.guide && (
          <section className="mt-10 space-y-4">
            <h2 className="text-xl font-bold text-slate-800">Guía práctica</h2>
            <GuideBlock icon={<Compass className="h-5 w-5" />} title="Cómo ir" body={data.guide.comoIr} tone="sky" />
            <GuideBlock icon={<Backpack className="h-5 w-5" />} title="Qué llevar" body={data.guide.queLlevar} tone="amber" />
            <GuideBlock icon={<Waves className="h-5 w-5" />} title="Qué hacer" body={data.guide.queHacer} tone="cyan" />
            <GuideBlock icon={<Lightbulb className="h-5 w-5" />} title="Consejos locales" body={data.guide.consejos} tone="emerald" />
          </section>
        )}
      </main>
    </div>
  );
}

function PlayaCard({ p }: { p: PlayaInfo }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className="relative h-44 w-full bg-slate-100">
        {p.photo ? (
          <img
            src={p.photo}
            alt={p.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <Waves className="h-10 w-10" />
          </div>
        )}
        <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
          <MapPin className="h-3 w-3" /> {p.town}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-base font-bold text-slate-800">{p.name}</h3>
        <p className="mt-1 line-clamp-5 text-sm leading-relaxed text-slate-600">
          {p.extract || "Una de las joyas de la Costa Blanca, ideal para disfrutar del Mediterráneo."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {p.lat && p.lng && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-700 hover:bg-sky-100"
            >
              <MapPin className="h-3 w-3" /> Cómo llegar
            </a>
          )}
          <a
            href={p.wikiUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
          >
            <ExternalLink className="h-3 w-3" /> Más info
          </a>
        </div>
      </div>
    </article>
  );
}

function GuideBlock({
  icon,
  title,
  body,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  tone: "sky" | "amber" | "cyan" | "emerald";
}) {
  const tones: Record<string, string> = {
    sky: "from-sky-500 to-cyan-500",
    amber: "from-amber-500 to-orange-500",
    cyan: "from-cyan-500 to-teal-500",
    emerald: "from-emerald-500 to-green-500",
  };
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <div className={`flex items-center gap-2 bg-gradient-to-r ${tones[tone]} px-4 py-2.5 text-white`}>
        {icon}
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
      </div>
      <p className="whitespace-pre-line p-4 text-[14px] leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}
