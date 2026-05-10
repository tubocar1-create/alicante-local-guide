// Real public data from OpenStreetMap via Overpass API. No API key required.
// Bounding box covers Alicante province (south, west, north, east).
const ALICANTE_BBOX = "37.84,-1.13,38.87,0.21";
const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type PoiCategory =
  | "cultural"
  | "hiking"
  | "beaches"
  | "viewpoints"
  | "attractions"
  | "guides";

export type Poi = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  category: PoiCategory;
  subtype?: string;
  tags: Record<string, string>;
};

export const CATEGORY_LABEL: Record<PoiCategory, string> = {
  cultural: "Cultura e historia",
  hiking: "Senderismo",
  beaches: "Playas y calas",
  viewpoints: "Miradores",
  attractions: "Atracciones",
  guides: "Información turística",
};

export const CATEGORY_EMOJI: Record<PoiCategory, string> = {
  cultural: "🏛️",
  hiking: "🥾",
  beaches: "🏖️",
  viewpoints: "🌄",
  attractions: "✨",
  guides: "ℹ️",
};

const QUERIES: Record<PoiCategory, string> = {
  cultural: `
    nwr["tourism"="museum"](${ALICANTE_BBOX});
    nwr["historic"~"^(castle|fort|monument|ruins|archaeological_site|memorial|tower)$"](${ALICANTE_BBOX});
  `,
  hiking: `
    nwr["natural"="peak"](${ALICANTE_BBOX});
    nwr["tourism"="information"]["information"="guidepost"](${ALICANTE_BBOX});
  `,
  beaches: `
    nwr["natural"="beach"](${ALICANTE_BBOX});
  `,
  viewpoints: `
    nwr["tourism"="viewpoint"](${ALICANTE_BBOX});
  `,
  attractions: `
    nwr["tourism"="attraction"](${ALICANTE_BBOX});
    nwr["tourism"="theme_park"](${ALICANTE_BBOX});
    nwr["tourism"="zoo"](${ALICANTE_BBOX});
  `,
  guides: `
    nwr["tourism"="information"](${ALICANTE_BBOX});
  `,
};

function pickCategory(tags: Record<string, string>, fallback: PoiCategory): PoiCategory {
  if (tags.natural === "beach") return "beaches";
  if (tags.natural === "peak") return "hiking";
  if (tags.tourism === "viewpoint") return "viewpoints";
  if (tags.tourism === "museum") return "cultural";
  if (tags.historic) return "cultural";
  if (tags.tourism === "information") return "guides";
  if (tags.tourism === "attraction" || tags.tourism === "theme_park" || tags.tourism === "zoo")
    return "attractions";
  return fallback;
}

function subtype(tags: Record<string, string>): string | undefined {
  return (
    tags.historic ||
    tags.tourism ||
    tags.natural ||
    tags.amenity ||
    tags.leisure ||
    undefined
  );
}

export async function fetchPois(categories: PoiCategory[]): Promise<Poi[]> {
  if (categories.length === 0) return [];
  const body = `[out:json][timeout:25];
(
${categories.map((c) => QUERIES[c]).join("\n")}
);
out center 400;`;

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
      const out: Poi[] = [];
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
        out.push({
          id: `${el.type}/${el.id}`,
          name,
          lat,
          lon,
          category: pickCategory(tags, categories[0]),
          subtype: subtype(tags),
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
