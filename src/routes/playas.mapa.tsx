import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";

export const Route = createFileRoute("/playas/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa interactivo de las playas de Alicante" },
      {
        name: "description",
        content:
          "Mapa visual a página completa con las principales playas alrededor de Alicante: Postiguet, San Juan, Albufereta, Cabo de las Huertas y Urbanova.",
      },
      { property: "og:title", content: "Mapa interactivo — Playas de Alicante" },
      {
        property: "og:description",
        content: "Despliega el mapa completo de la costa alicantina y descubre cada playa de un vistazo.",
      },
    ],
  }),
  component: MapaPlayasPage,
});

const MAP_BEACHES = [
  { name: "Playa de San Juan", position: { top: "20%", left: "71%" }, description: "La playa más grande y famosa de Alicante." },
  { name: "Cabo de las Huertas", position: { top: "31%", left: "77%" }, description: "Calas rocosas ideales para snorkel." },
  { name: "Playa de la Albufereta", position: { top: "42%", left: "64%" }, description: "Cala tranquila entre Alicante y San Juan." },
  { name: "Playa del Postiguet", position: { top: "55%", left: "48%" }, description: "Playa urbana junto al Castillo de Santa Bárbara." },
  { name: "Playa de Urbanova", position: { top: "80%", left: "27%" }, description: "Arena amplia cerca del aeropuerto y dunas." },
];

function CoastMapArtwork() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.8 0.12 220)" />
          <stop offset="55%" stopColor="oklch(0.72 0.14 205)" />
          <stop offset="100%" stopColor="oklch(0.63 0.13 198)" />
        </linearGradient>
        <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.93 0.08 92)" />
          <stop offset="50%" stopColor="oklch(0.82 0.09 74)" />
          <stop offset="100%" stopColor="oklch(0.68 0.08 52)" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" fill="url(#sea)" />
      <path d="M86 0 C80 9 82 18 73 25 C65 31 70 39 59 44 C47 50 51 59 39 64 C29 69 31 79 18 85 C11 88 8 94 6 100 L100 100 L100 0 Z" fill="url(#land)" />
      <path d="M84 0 C79 10 80 18 72 24 C63 31 68 38 58 43 C45 50 50 59 38 64 C28 69 30 78 18 84 C11 88 8 94 6 100" fill="none" stroke="white" strokeWidth="1.4" opacity="0.9" />
      <path d="M74 13 C65 19 63 26 53 30 M62 52 C51 56 45 62 35 67 M31 82 C24 85 20 90 14 94" fill="none" stroke="oklch(0.55 0.09 142)" strokeWidth="0.45" opacity="0.45" />
      <path d="M5 22 C18 18 27 24 39 20 M2 42 C15 38 24 43 35 39 M8 68 C19 64 28 69 39 65" fill="none" stroke="white" strokeWidth="0.35" opacity="0.38" />
    </svg>
  );
}

function MapaPlayasPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-sky-300 via-cyan-200 to-amber-100">
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Playa_de_San_Juan_-_Alicante.jpg/1600px-Playa_de_San_Juan_-_Alicante.jpg"
        alt="Costa de Alicante vista desde el aire"
        className="absolute inset-0 h-full w-full object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-sky-900/35 via-sky-700/15 to-cyan-300/10" />

      {MAP_BEACHES.map((beach) => (
        <div key={beach.name} className="group absolute z-20" style={beach.position}>
          <div className="relative">
            <button
              type="button"
              aria-label={beach.name}
              className="h-7 w-7 animate-pulse rounded-full border-4 border-white bg-orange-500 shadow-lg transition-transform hover:scale-125 focus:scale-125"
            />
            <div className="pointer-events-none absolute left-1/2 top-9 z-30 w-64 -translate-x-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100 sm:left-10 sm:top-1/2 sm:w-72 sm:translate-x-0 sm:-translate-y-1/2">
              <div className="rounded-2xl border border-orange-100 bg-white p-4 shadow-xl">
                <h3 className="mb-1 text-lg font-black text-[oklch(0.62_0.17_45)]">{beach.name}</h3>
                <p className="text-sm text-slate-600">{beach.description}</p>
              </div>
            </div>
          </div>
        </div>
      ))}

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5">
        <Link
          to="/playas"
          className="inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-sm font-bold text-slate-800 shadow-sm backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la charla
        </Link>
        <div className="hidden items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur sm:inline-flex">
          <MapPin className="h-4 w-4" /> Mapa interactivo
        </div>
      </header>

      <div className="relative z-10 mx-auto mt-4 max-w-6xl px-4 text-white drop-shadow">
        <h1 className="text-3xl font-black leading-tight sm:text-5xl">Costa alicantina, mapa completo</h1>
        <p className="mt-2 max-w-2xl text-sm font-semibold text-white/95 sm:text-base">
          Pulsa o pasa el cursor sobre cada punto naranja para descubrir la playa.
        </p>
      </div>
    </div>
  );
}
