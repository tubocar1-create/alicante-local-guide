import plastiahorroImg from "@/assets/places/plastiahorro.jpg";
import openWashImg from "@/assets/places/open-wash.jpg";

export type PlaceOverride = {
  /** Display name shown in the card */
  title: string;
  /** Imported local image */
  image: string;
  /** Short description (1-3 sentences) */
  description: string;
  /** Full address used to build the Google Maps link */
  address?: string;
  /** Aliases that should match this place (lowercased, no accents recommended) */
  aliases: string[];
  /** Coordinates for distance/maps */
  coords?: { lat: number; lng: number };
};

export const PLACE_OVERRIDES: PlaceOverride[] = [
  {
    title: "Plastiahorro",
    image: plastiahorroImg,
    description:
      "Tienda de envases, bolsas, servilletas, platos y vasos ubicada en la Calle Teulada nº 21, Alicante.",
    address: "Calle Teulada 21, Alicante, España",
    aliases: ["plastiahorro", "plastiahorro distribuciones"],
    coords: { lat: 38.3567, lng: -0.4915 },
  },
  {
    title: "Open Wash",
    image: openWashImg,
    description:
      "Lavadero de autoservicio en la Calle Teulada nº 25, Alicante. Horario de 8:30 a 23:00, 365 días al año.",
    address: "Calle Teulada 25, Alicante, España",
    aliases: ["open wash", "openwash", "lavanderia open wash", "lavandería open wash"],
    coords: { lat: 38.3567, lng: -0.4915 },
  },
];

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function findPlaceOverride(name: string): PlaceOverride | null {
  const n = normalize(name);
  for (const p of PLACE_OVERRIDES) {
    if (p.aliases.some((a) => normalize(a) === n || n.includes(normalize(a)))) {
      return p;
    }
  }
  return null;
}
