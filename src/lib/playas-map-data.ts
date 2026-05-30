// Shared catalogue of the 17 beaches shown on the interactive map.
// Each entry carries a slug (used in /playas/$slug), a Wikipedia title
// (used to fetch real photos via Wikimedia) and a Google Maps query
// (used for the "Cómo ir" button).

export type MapBeach = {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  description: string;
  wikiTitle: string;
  mapsQuery: string;
};

export const MAP_BEACHES: MapBeach[] = [
  {
    slug: "cala-lanuza",
    name: "Cala Lanuza",
    lat: 38.4496,
    lng: -0.3712,
    description: "Pequeña cala rocosa al norte de El Campello.",
    wikiTitle: "El Campello",
    mapsQuery: "Cala Lanuza El Campello",
  },
  {
    slug: "carrer-la-mar",
    name: "Playa Carrer la Mar",
    lat: 38.4276,
    lng: -0.3937,
    description: "Playa céntrica de El Campello.",
    wikiTitle: "El Campello",
    mapsQuery: "Playa Carrer la Mar El Campello",
  },
  {
    slug: "muchavista",
    name: "Playa de Muchavista",
    lat: 38.4145,
    lng: -0.4045,
    description: "Larga playa de arena dorada entre El Campello y San Juan.",
    wikiTitle: "Playa de Muchavista",
    mapsQuery: "Playa de Muchavista El Campello",
  },
  {
    slug: "san-juan",
    name: "Playa de San Juan",
    lat: 38.3866,
    lng: -0.4258,
    description: "La playa más famosa y extensa de Alicante.",
    wikiTitle: "Playa de San Juan (Alicante)",
    mapsQuery: "Playa de San Juan Alicante",
  },
  {
    slug: "cala-cantalar",
    name: "Cala Cantalar",
    lat: 38.3556,
    lng: -0.4023,
    description: "Cala virgen en el Cabo de las Huertas.",
    wikiTitle: "Cabo de las Huertas",
    mapsQuery: "Cala Cantalar Alicante",
  },
  {
    slug: "cala-palmera",
    name: "Cala Palmera",
    lat: 38.3527,
    lng: -0.4063,
    description: "Cala rocosa ideal para snorkel.",
    wikiTitle: "Cabo de las Huertas",
    mapsQuery: "Cala Palmera Alicante",
  },
  {
    slug: "cala-judios",
    name: "Cala de los Judíos",
    lat: 38.3500,
    lng: -0.4118,
    description: "Cala virgen en el Cabo de las Huertas.",
    wikiTitle: "Cabo de las Huertas",
    mapsQuery: "Cala de los Judios Alicante",
  },
  {
    slug: "cala-tio-ximo",
    name: "Cala del Tío Ximo",
    lat: 38.3548,
    lng: -0.4173,
    description: "Cala protegida entre rocas.",
    wikiTitle: "Cabo de las Huertas",
    mapsQuery: "Cala del Tio Ximo Alicante",
  },
  {
    slug: "almadraba",
    name: "Playa de la Almadraba",
    lat: 38.3501,
    lng: -0.4220,
    description: "Playa familiar al pie del Cabo de las Huertas.",
    wikiTitle: "Playa de la Almadraba (Alicante)",
    mapsQuery: "Playa de la Almadraba Alicante",
  },
  {
    slug: "albufereta",
    name: "Playa de la Albufereta",
    lat: 38.3637,
    lng: -0.4498,
    description: "Playa urbana en forma de concha.",
    wikiTitle: "Playa de la Albufereta",
    mapsQuery: "Playa de la Albufereta Alicante",
  },
  {
    slug: "postiguet",
    name: "Playa del Postiguet",
    lat: 38.3471,
    lng: -0.4756,
    description: "Playa urbana junto al Castillo de Santa Bárbara.",
    wikiTitle: "Playa del Postiguet",
    mapsQuery: "Playa del Postiguet Alicante",
  },
  {
    slug: "agua-amarga",
    name: "Playa de Agua Amarga",
    lat: 38.3210,
    lng: -0.5040,
    description: "Tramo litoral al sur de Alicante.",
    wikiTitle: "Alicante",
    mapsQuery: "Playa Agua Amarga Alicante",
  },
  {
    slug: "saladar",
    name: "Playa del Saladar",
    lat: 38.3088,
    lng: -0.5180,
    description: "Larga playa abierta de Urbanova.",
    wikiTitle: "Playa de Urbanova",
    mapsQuery: "Playa del Saladar Urbanova",
  },
  {
    slug: "urbanova",
    name: "Playa de Urbanova",
    lat: 38.3000,
    lng: -0.5290,
    description: "Arena fina cerca del aeropuerto.",
    wikiTitle: "Playa de Urbanova",
    mapsQuery: "Playa de Urbanova Alicante",
  },
  {
    slug: "el-altet",
    name: "Playa del Altet",
    lat: 38.2785,
    lng: -0.5450,
    description: "Playa de arena junto a Gran Alacant.",
    wikiTitle: "El Altet",
    mapsQuery: "Playa del Altet Elche",
  },
  {
    slug: "arenales-del-sol",
    name: "Playa de los Arenales del Sol",
    lat: 38.2628,
    lng: -0.5180,
    description: "Amplia playa de arena fina con dunas.",
    wikiTitle: "Arenales del Sol",
    mapsQuery: "Playa de los Arenales del Sol Elche",
  },
  {
    slug: "carabassi",
    name: "Playa del Carabassí",
    lat: 38.2400,
    lng: -0.5260,
    description: "Dunas protegidas y aguas cristalinas.",
    wikiTitle: "Santa Pola",
    mapsQuery: "Playa del Carabassí Elche",
  },
];

export function getBeachBySlug(slug: string): MapBeach | undefined {
  return MAP_BEACHES.find((b) => b.slug === slug);
}

// Las fotos locales ahora viven en la tabla `beach_covers` (columna `photos`).
// Se conservan aquí solo a modo de referencia histórica.

// Skip the first N Google-sourced photos for a beach (when those photos
// are mislabeled in Google and have been re-attributed locally).
export const GOOGLE_PHOTO_SKIP: Record<string, number> = {
  "postiguet": 3,
};
