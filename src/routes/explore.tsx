import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LEAFLET_HEAD_LINK } from "@/lib/leaflet-head";

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explora Alicante — Mapa interactivo de turismo y senderismo" },
      {
        name: "description",
        content:
          "Mapa interactivo con museos, castillos, playas, miradores, atracciones y rutas de senderismo en la provincia de Alicante. Datos abiertos de OpenStreetMap.",
      },
      { property: "og:title", content: "Explora Alicante — Mapa interactivo" },
      {
        property: "og:description",
        content:
          "Descubre cultura, naturaleza, playas y miradores en la provincia de Alicante con un mapa abierto.",
      },
    ],
    links: [LEAFLET_HEAD_LINK],
  }),
  component: ExplorePage,
});

function ExplorePage() {
  // Leaflet touches window/document → render only on the client.
  const [mounted, setMounted] = useState(false);
  const [Map, setMap] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    setMounted(true);
    import("@/components/ExploreMap").then((m) => setMap(() => m.ExploreMap));
  }, []);

  if (!mounted || !Map) {
    return (
      <div className="flex items-center justify-center h-[100dvh] text-sm text-muted-foreground">
        Cargando mapa…
      </div>
    );
  }
  return <Map />;
}
