import { createFileRoute } from "@tanstack/react-router";
import { ListingPage } from "@/components/ListingPage";
import { STAY_FILTERS, stayFiltersToOverpass, type StayKind } from "@/lib/overpass-listings";

export const Route = createFileRoute("/stay")({
  head: () => ({
    meta: [
      { title: "Dormir en Alicante — Hoteles, hostales y apartamentos" },
      {
        name: "description",
        content:
          "Encuentra hoteles, hostales, apartamentos y casas rurales en la provincia de Alicante con datos abiertos de OpenStreetMap. Filtra por tipo, cercanía y valoración.",
      },
      { property: "og:title", content: "Dormir en Alicante" },
      {
        property: "og:description",
        content: "Hoteles, hostales y apartamentos turísticos en Alicante.",
      },
      { property: "og:url", content: "https://vamosalicante.com/stay" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/stay" }],
  }),
  component: StayPage,
});

function StayPage() {
  return (
    <ListingPage<StayKind>
      title="Dormir en Alicante"
      subtitle="Hoteles, hostales y apartamentos · datos abiertos"
      filters={STAY_FILTERS}
      initial={["hotel", "hostel", "apartment"]}
      toOverpass={stayFiltersToOverpass}
      externalSearch={[
        {
          label: "Booking",
          url: (q) =>
            `https://www.booking.com/searchresults.es.html?ss=${encodeURIComponent(
              q + " Alicante",
            )}`,
        },
        {
          label: "Airbnb",
          url: (q) =>
            `https://www.airbnb.es/s/${encodeURIComponent(q + " Alicante")}/homes`,
        },
      ]}
    />
  );
}
