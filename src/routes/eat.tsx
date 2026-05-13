import { createFileRoute } from "@tanstack/react-router";
import { ListingPage } from "@/components/ListingPage";
import {
  EAT_FILTERS,
  eatFiltersToOverpass,
  type EatKind,
  type Listing,
} from "@/lib/overpass-listings";

const TUMBARANCHO: Listing = {
  id: "featured-tumbarancho",
  name: "Tumbarancho",
  lat: 38.3452,
  lon: -0.481,
  kind: "restaurant",
  cuisine: "venezolana · arepas",
  address: "Alicante",
  tags: {},
};

export const Route = createFileRoute("/eat")({
  head: () => ({
    meta: [
      { title: "Comer en Alicante — Restaurantes, bares y cafeterías" },
      {
        name: "description",
        content:
          "Restaurantes, bares, cafeterías y heladerías en la provincia de Alicante. Filtra por tipo, cocina y cercanía con datos abiertos de OpenStreetMap.",
      },
      { property: "og:title", content: "Comer en Alicante" },
      {
        property: "og:description",
        content: "Dónde comer y tomar algo en Alicante.",
      },
    ],
  }),
  component: EatPage,
});

function EatPage() {
  return (
    <ListingPage<EatKind>
      title="Comer en Alicante"
      subtitle="Restaurantes, bares y cafeterías · datos abiertos"
      filters={EAT_FILTERS}
      initial={["restaurant", "cafe", "bar"]}
      toOverpass={eatFiltersToOverpass}
      featured={[TUMBARANCHO]}
      externalSearch={[
        {
          label: "TripAdvisor",
          url: (q) =>
            `https://www.tripadvisor.es/Search?q=${encodeURIComponent(q + " Alicante")}`,
        },
      ]}
    />
  );
}
