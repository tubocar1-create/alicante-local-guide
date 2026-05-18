// Curated list of beaches in the province of Alicante.
// `wikiTitle` is the Spanish Wikipedia article used to fetch the real
// photo and a factual extract via the public REST summary endpoint.

export type PlayaSeed = {
  slug: string;
  name: string;
  town: string;
  wikiTitle: string;
  category: "populares" | "escondidas";
  lat?: number;
  lng?: number;
};

export const PLAYAS: PlayaSeed[] = [
  // ── Populares ───────────────────────────────────────────────
  { slug: "postiguet", name: "Playa del Postiguet", town: "Alicante", wikiTitle: "Playa del Postiguet", category: "populares", lat: 38.3471, lng: -0.4756 },
  { slug: "san-juan", name: "Playa de San Juan", town: "Alicante", wikiTitle: "Playa de San Juan (Alicante)", category: "populares", lat: 38.3866, lng: -0.4258 },
  { slug: "albufereta", name: "Playa de la Albufereta", town: "Alicante", wikiTitle: "Playa de la Albufereta", category: "populares", lat: 38.3637, lng: -0.4498 },
  { slug: "muchavista", name: "Playa de Muchavista", town: "El Campello", wikiTitle: "Playa de Muchavista", category: "populares", lat: 38.4145, lng: -0.4045 },
  { slug: "levante-benidorm", name: "Playa de Levante", town: "Benidorm", wikiTitle: "Playa de Levante (Benidorm)", category: "populares", lat: 38.5403, lng: -0.1207 },
  { slug: "poniente-benidorm", name: "Playa de Poniente", town: "Benidorm", wikiTitle: "Playa de Poniente (Benidorm)", category: "populares", lat: 38.5371, lng: -0.1402 },
  { slug: "arenal-bol", name: "Playa del Arenal-Bol", town: "Calp", wikiTitle: "Playa del Arenal-Bol", category: "populares", lat: 38.6395, lng: 0.0664 },
  { slug: "centro-santa-pola", name: "Playa de Levante (Santa Pola)", town: "Santa Pola", wikiTitle: "Playa de Levante (Santa Pola)", category: "populares", lat: 38.1944, lng: -0.5575 },
  { slug: "arenal-javea", name: "Playa del Arenal de Jávea", town: "Jávea", wikiTitle: "Playa del Arenal (Jávea)", category: "populares", lat: 38.7710, lng: 0.1875 },
  { slug: "marineta-cassiana", name: "Playa de la Marineta Cassiana", town: "Dénia", wikiTitle: "Playa de la Marineta Cassiana", category: "populares", lat: 38.8417, lng: 0.1083 },

  // ── Calas escondidas ────────────────────────────────────────
  { slug: "granadella", name: "Cala de la Granadella", town: "Jávea", wikiTitle: "Cala de la Granadella", category: "escondidas", lat: 38.7220, lng: 0.2229 },
  { slug: "moraig", name: "Cala del Moraig", town: "Benitatxell", wikiTitle: "Cala del Moraig", category: "escondidas", lat: 38.7271, lng: 0.1903 },
  { slug: "tio-ximo", name: "Cala del Tío Ximo", town: "Benidorm", wikiTitle: "Cala del Tío Ximo", category: "escondidas", lat: 38.5510, lng: -0.1019 },
  { slug: "almadraba-denia", name: "Cala de la Almadraba", town: "Dénia", wikiTitle: "Playa de la Almadraba (Dénia)", category: "escondidas", lat: 38.8278, lng: 0.1417 },
  { slug: "racons", name: "Cala dels Racons (Les Rotes)", town: "Dénia", wikiTitle: "Les Rotes", category: "escondidas", lat: 38.8275, lng: 0.1419 },
  { slug: "cantalars", name: "Cala dels Cantalars", town: "Alicante", wikiTitle: "Cabo de las Huertas", category: "escondidas", lat: 38.3514, lng: -0.4055 },
  { slug: "finestrat", name: "Cala de Finestrat", town: "Finestrat", wikiTitle: "Cala de Finestrat", category: "escondidas", lat: 38.5283, lng: -0.1611 },
  { slug: "racó-conill", name: "Cala del Racó del Conill", town: "Villajoyosa", wikiTitle: "Villajoyosa", category: "escondidas", lat: 38.4970, lng: -0.2086 },
  { slug: "llebeig", name: "Cala Llebeig", town: "Teulada", wikiTitle: "Teulada (España)", category: "escondidas", lat: 38.6883, lng: 0.1789 },
  { slug: "advocat", name: "Cala de l'Advocat", town: "Benissa", wikiTitle: "Benisa", category: "escondidas", lat: 38.6878, lng: 0.0683 },
];
