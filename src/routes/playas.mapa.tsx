import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/playas/mapa")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mapa interactivo de las playas de Alicante" },
      {
        name: "description",
        content:
          "Mapa real con las principales playas de Alicante: Postiguet, San Juan, Albufereta, Muchavista, Almadraba, Carabassí, Arenales del Sol y más.",
      },
      { property: "og:title", content: "Mapa interactivo — Playas de Alicante" },
      {
        property: "og:description",
        content: "Explora la costa alicantina sobre un mapa real e interactivo.",
      },
    ],
  }),
  component: MapaPlayasPage,
});

type Beach = {
  name: string;
  lat: number;
  lng: number;
  description: string;
};

const BEACHES: Beach[] = [
  { name: "Cala Lanuza", lat: 38.4410, lng: -0.3905, description: "Pequeña cala rocosa al norte de El Campello." },
  { name: "Playa Carrer la Mar", lat: 38.4360, lng: -0.3970, description: "Playa céntrica de El Campello." },
  { name: "Playa de Muchavista", lat: 38.4280, lng: -0.4040, description: "Larga playa de arena dorada entre El Campello y San Juan." },
  { name: "Playa de San Juan", lat: 38.4020, lng: -0.4170, description: "La playa más famosa y extensa de Alicante." },
  { name: "Cala Cantalar", lat: 38.3905, lng: -0.4080, description: "Cala virgen en el Cabo de las Huertas." },
  { name: "Cala Palmera", lat: 38.3865, lng: -0.4045, description: "Cala rocosa ideal para snorkel." },
  { name: "Cala de los Judíos", lat: 38.3825, lng: -0.4055, description: "Cala virgen en el Cabo de las Huertas." },
  { name: "Cala del Tío Ximo", lat: 38.3775, lng: -0.4115, description: "Cala protegida entre rocas." },
  { name: "Playa de la Almadraba", lat: 38.3735, lng: -0.4180, description: "Playa familiar al pie del Cabo de las Huertas." },
  { name: "Playa de la Albufereta", lat: 38.3680, lng: -0.4260, description: "Playa urbana en forma de concha." },
  { name: "Playa del Postiguet", lat: 38.3445, lng: -0.4750, description: "Playa urbana junto al Castillo de Santa Bárbara." },
  { name: "Playa de Agua Amarga", lat: 38.3188, lng: -0.5127, description: "Tramo litoral al sur de Alicante." },
  { name: "Playa del Saladar", lat: 38.3038, lng: -0.5198, description: "Larga playa abierta de Urbanova." },
  { name: "Playa de Urbanova", lat: 38.2916, lng: -0.5283, description: "Arena fina cerca del aeropuerto." },
  { name: "Playa del Altet", lat: 38.2720, lng: -0.5458, description: "Playa de arena junto a Gran Alacant." },
  { name: "Playa de los Arenales del Sol", lat: 38.2474, lng: -0.5207, description: "Amplia playa de arena fina con dunas." },
  { name: "Playa del Carabassí", lat: 38.2310, lng: -0.5179, description: "Dunas protegidas y aguas cristalinas." },
];

function MapaPlayasPage() {
  const [Map, setMap] = useState<null | typeof import("@/components/LeafletBeachMap")>(null);

  useEffect(() => {
    import("@/components/LeafletBeachMap").then(setMap);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {Map ? <Map.LeafletMap beaches={BEACHES} /> : (
        <div className="flex h-full w-full items-center justify-center bg-[oklch(0.74_0.12_205)] text-white">
          Cargando mapa…
        </div>
      )}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center justify-between gap-3 px-4 pt-4">
        <Link
          to="/playas"
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-sm font-bold text-slate-800 shadow-lg backdrop-blur"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la charla
        </Link>
        <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-[oklch(0.62_0.17_45)] shadow-lg backdrop-blur">
          <MapPin className="h-4 w-4" /> Playas de Alicante
        </div>
      </header>
    </div>
  );
}
