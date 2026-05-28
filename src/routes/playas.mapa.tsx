import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { MAP_BEACHES } from "@/lib/playas-map-data";

export const Route = createFileRoute("/playas/mapa")({
  ssr: false,
  staleTime: Infinity,
  gcTime: Infinity,
  shouldReload: false,
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
      { property: "og:url", content: "https://vamosalicante.com/playas/mapa" },
    ],
  }),
  component: MapaPlayasPage,
});

function MapaPlayasPage() {
  const [Map, setMap] = useState<null | typeof import("@/components/LeafletBeachMap")>(null);

  useEffect(() => {
    import("@/components/LeafletBeachMap").then(setMap);
  }, []);

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {Map ? (
        <Map.LeafletMap beaches={MAP_BEACHES} />
      ) : (
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
