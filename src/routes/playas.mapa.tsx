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
  { name: "Playa de Muchavista", lat: 38.4256, lng: -0.4108, description: "El Campello, larga playa de arena dorada." },
  { name: "Playa Carrer la Mar", lat: 38.4347, lng: -0.4011, description: "Playa céntrica de El Campello." },
  { name: "Cala Lanuza", lat: 38.4398, lng: -0.3950, description: "Pequeña cala rocosa en El Campello." },
  { name: "Cala del Amerador", lat: 38.4445, lng: -0.3886, description: "Cala tranquila al norte de El Campello." },
  { name: "Playa de San Juan", lat: 38.4044, lng: -0.4222, description: "La playa más famosa y extensa de Alicante." },
  { name: "Cala Cantalar", lat: 38.3922, lng: -0.4117, description: "Pequeña cala virgen en el Cabo de las Huertas." },
  { name: "Cala Palmera", lat: 38.3878, lng: -0.4083, description: "Cala rocosa ideal para snorkel." },
  { name: "Cala de los Judíos", lat: 38.3833, lng: -0.4072, description: "Cala virgen en el Cabo de las Huertas." },
  { name: "Cala Calabarda", lat: 38.3792, lng: -0.4108, description: "Pequeña cala con aguas cristalinas." },
  { name: "Cala del Tío Ximo", lat: 38.3756, lng: -0.4172, description: "Cala protegida entre rocas." },
  { name: "Playa de la Almadraba", lat: 38.3736, lng: -0.4244, description: "Playa familiar al pie del Cabo de las Huertas." },
  { name: "Playa de la Albufereta", lat: 38.3717, lng: -0.4319, description: "Playa urbana tranquila en forma de concha." },
  { name: "Playa del Postiguet", lat: 38.3447, lng: -0.4775, description: "Playa urbana junto al Castillo de Santa Bárbara." },
  { name: "Playa del Saladar", lat: 38.3194, lng: -0.5036, description: "Playa de Urbanova, larga y abierta." },
  { name: "Playa de Urbanova", lat: 38.3056, lng: -0.5158, description: "Arena fina cerca del aeropuerto." },
  { name: "Playa del Altet", lat: 38.2731, lng: -0.5392, description: "Playa de arena cerca del aeropuerto." },
  { name: "Playa de los Arenales del Sol", lat: 38.2611, lng: -0.5444, description: "Amplia playa de arena fina con dunas." },
  { name: "Playa del Carabassí", lat: 38.2456, lng: -0.5586, description: "Dunas protegidas y aguas cristalinas." },
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
