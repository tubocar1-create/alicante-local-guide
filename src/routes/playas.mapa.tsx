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
  { name: "Playa del Postiguet", position: { top: "58%", left: "48%" }, description: "Playa urbana junto al Castillo de Santa Bárbara." },
  { name: "Playa de San Juan", position: { top: "30%", left: "70%" }, description: "La playa más grande y famosa de Alicante." },
  { name: "Playa de la Albufereta", position: { top: "46%", left: "60%" }, description: "Cala tranquila entre Alicante y San Juan." },
  { name: "Cabo de las Huertas", position: { top: "38%", left: "78%" }, description: "Calas rocosas ideales para snorkel." },
  { name: "Playa de Urbanova", position: { top: "82%", left: "30%" }, description: "Arena amplia cerca del aeropuerto y dunas." },
];

function MapaPlayasPage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-sky-300 via-cyan-200 to-amber-100">
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Playa_de_San_Juan_-_Alicante.jpg/1600px-Playa_de_San_Juan_-_Alicante.jpg"
        alt="Costa de Alicante vista desde el aire"
        className="absolute inset-0 h-full w-full object-cover opacity-80"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-sky-900/35 via-sky-700/15 to-cyan-300/10" />

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

      <div className="relative z-10 mx-auto mt-6 h-[78vh] w-full max-w-6xl px-4 pb-10">
        <div className="relative h-full w-full overflow-hidden rounded-3xl border border-white/40 bg-white/10 shadow-2xl backdrop-blur-sm">
          {MAP_BEACHES.map((beach) => (
            <div key={beach.name} className="group absolute" style={beach.position}>
              <div className="relative">
                <button
                  type="button"
                  aria-label={beach.name}
                  className="h-7 w-7 animate-pulse rounded-full border-4 border-white bg-orange-500 shadow-lg transition-transform hover:scale-125 focus:scale-125"
                />
                <div className="pointer-events-none absolute left-10 top-1/2 z-20 -translate-y-1/2 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100 group-active:opacity-100">
                  <div className="w-72 rounded-2xl border border-orange-100 bg-white p-4 shadow-xl">
                    <h3 className="mb-1 text-lg font-black text-[oklch(0.62_0.17_45)]">{beach.name}</h3>
                    <p className="text-sm text-slate-600">{beach.description}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
