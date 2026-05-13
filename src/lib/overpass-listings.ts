// Generic Overpass listing fetcher for stays & food.
// Pulls live data from OpenStreetMap. No API key required.

const ALICANTE_BBOX = "37.84,-1.13,38.87,0.21";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type Listing = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kind: string; // hotel | restaurant | bar | cafe | hostel ...
  cuisine?: string;
  stars?: number;
  phone?: string;
  website?: string;
  address?: string;
  wikipedia?: string;
  openingHours?: string;
  tags: Record<string, string>;
};

export type StayKind = "hotel" | "hostel" | "guest_house" | "apartment" | "motel";
export type EatKind =
  | "restaurant"
  | "cafe"
  | "bar"
  | "pub"
  | "fast_food"
  | "ice_cream"
  | "arroz_pescado";

const STAY_TAG: Record<StayKind, string> = {
  hotel: "tourism",
  hostel: "tourism",
  guest_house: "tourism",
  apartment: "tourism",
  motel: "tourism",
};
const EAT_TAG = "amenity"; // all eat kinds use amenity=...

type FetchListingsOptions = {
  center?: { lat: number; lng: number };
  radiusMeters?: number;
};

function buildQuery(
  filters: { tag: string; value: string }[],
  opts?: FetchListingsOptions,
): string {
  const area = opts?.center
    ? `(around:${opts.radiusMeters ?? 4500},${opts.center.lat},${opts.center.lng})`
    : `(${ALICANTE_BBOX})`;
  const parts = filters.map((f) => `nwr["${f.tag}"="${f.value}"]${area};`).join("\n");
  return `[out:json][timeout:30];
(
${parts}
);
out center 600;`;
}

export async function fetchListings(
  filters: { tag: string; value: string }[],
  opts?: FetchListingsOptions,
): Promise<Listing[]> {
  if (filters.length === 0) return [];
  const body = buildQuery(filters, opts);
  let lastErr: unknown;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(body),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as {
        elements: Array<{
          type: string;
          id: number;
          lat?: number;
          lon?: number;
          center?: { lat: number; lon: number };
          tags?: Record<string, string>;
        }>;
      };
      const seen = new Set<string>();
      const out: Listing[] = [];
      for (const el of json.elements) {
        const tags = el.tags ?? {};
        const name = tags.name || tags["name:es"] || tags["name:en"];
        if (!name) continue;
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        if (lat == null || lon == null) continue;
        const key = `${name}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const kind = tags.tourism || tags.amenity || "place";
        const stars = tags.stars ? parseInt(tags.stars, 10) : undefined;
        const addr = [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
          .filter(Boolean)
          .join(" ");
        out.push({
          id: `${el.type}/${el.id}`,
          name,
          lat,
          lon,
          kind,
          cuisine: tags.cuisine,
          stars: Number.isFinite(stars) ? stars : undefined,
          phone: tags.phone || tags["contact:phone"],
          website: tags.website || tags["contact:website"],
          address: addr || undefined,
          wikipedia: tags.wikipedia,
          openingHours: tags.opening_hours,
          tags,
        });
      }
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Overpass unreachable");
}

export const STAY_FILTERS: { kind: StayKind; label: string; emoji: string }[] = [
  { kind: "hotel", label: "Hoteles", emoji: "🏨" },
  { kind: "hostel", label: "Hostales", emoji: "🛏️" },
  { kind: "apartment", label: "Apartamentos", emoji: "🏢" },
  { kind: "guest_house", label: "Casas rurales", emoji: "🏡" },
  { kind: "motel", label: "Moteles", emoji: "🛣️" },
];

export const EAT_FILTERS: { kind: EatKind; label: string; emoji: string }[] = [
  { kind: "arroz_pescado", label: "Arroces y pescados", emoji: "🥘" },
  { kind: "restaurant", label: "Restaurantes", emoji: "🍽️" },
  { kind: "cafe", label: "Cafeterías", emoji: "☕" },
  { kind: "bar", label: "Bares", emoji: "🍻" },
  { kind: "pub", label: "Pubs", emoji: "🍺" },
  { kind: "fast_food", label: "Fast food", emoji: "🍔" },
  { kind: "ice_cream", label: "Heladerías", emoji: "🍦" },
];

export function stayFiltersToOverpass(kinds: StayKind[]) {
  return kinds.map((k) => ({ tag: STAY_TAG[k], value: k }));
}
export function eatFiltersToOverpass(kinds: EatKind[]) {
  return kinds
    .filter((k) => k !== "arroz_pescado")
    .map((k) => ({ tag: EAT_TAG, value: k }));
}
