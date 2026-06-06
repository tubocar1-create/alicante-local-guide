// Tours de Viator (afiliado) distribuidos a pie de cada ficha de playa.
// Todas las URLs comparten los mismos 4 parámetros de afiliado.

const AFFILIATE_QS = "pid=P00304490&mcid=42383&medium=link&campaign=excursionesalicante";

const RAW_URLS: string[] = [
  "https://www.viator.com/tours/Alicante/Secret-Flavors-of-Alicante-Food-and-Tapas-Tour-Eat-Like-a-Local/d23519-115858P2",
  "https://www.viator.com/tours/Alicante/The-best-of-Alicante/d23519-130544P5",
  "https://www.viator.com/en-PH/tours/Alicante/Day-charter-on-board-of-the-Keyolha/d23519-438781P2",
  "https://www.viator.com/tours/Alicante/Private-half-day-walking-tour-of-Alicante/d23519-8647P79",
  "https://www.viator.com/tours/Alicante/Alicante-City-and-Beach-Bike-Guided-Tour/d23519-364104P1",
  "https://www.viator.com/tours/Alicante/Alicante-Canelobre-Caves-and-Busot-Tour-including-transfer/d23519-5542600P2",
  "https://www.viator.com/tours/Alicante/From-Alicante-or-Benidorm-Guadalest-and-Algar-Waterfalls-Tour/d23519-405770P4",
  "https://www.viator.com/tours/Alicante/Highlights-and-Hidden-Gems-With-Locals-Best-of-Alicante-Private-Tour/d23519-24380P1622",
  "https://www.viator.com/tours/Alicante/Paella-and-Sangria-Cooking-Workshop/d23519-390938P1",
  "https://www.viator.com/tours/Alicante/Wine-Tasting-and-tapas-for-foddies/d23519-130544P8",
  "https://www.viator.com/tours/Alicante/Surf-initiation-course/d23519-263161P1",
  "https://www.viator.com/en-IN/tours/Alicante/Alicantes-History-and-Highlights-Audio-Guide/d23519-110804P783",
  "https://www.viator.com/tours/Alicante/Parasailing-in-Alicante/d23519-8661P10",
  "https://www.viator.com/tours/Alicante/ALICANTE-CASTLE-AND-HISTORICAL-CENTRE/d23519-157952P1",
  "https://www.viator.com/tours/Alicante/Private-custom-tour-with-a-local-guide-Alicante/d23519-104357P133",
  "https://www.viator.com/tours/Alicante/Alicante-4-Hour-Shore-Excursion/d23519-10121P4",
  "https://www.viator.com/tours/Alicante/Seven-Secrets-Tour-explore-eat-and-drink/d23519-115858P1",
  "https://www.viator.com/tours/Alicante/Alicante-Private-Walking-Tour/d23519-10121P11",
  "https://www.viator.com/en-HK/tours/Alicante/Alicante-Must-See-private-Walking-tour/d23519-104357P404",
  "https://www.viator.com/tours/Alicante/Alicante-shore-excursion-Private-Walking-Tour/d23519-10121P42",
  "https://www.viator.com/tours/Alicante/Tour-en-bicicleta-alrededor-de-Alicante/d23519-67064P1",
  "https://www.viator.com/tours/Alicante/Shore-excursion-Getting-around-Alicante/d23519-130544P7",
  "https://www.viator.com/tours/Alicante/Alicante-Highlights-bike-tour/d23519-88803P2",
  "https://www.viator.com/tours/Alicante/Alicante-Old-Winery-Tour-and-Wine-Tasting-including-transfer/d23519-5542600P1",
  "https://www.viator.com/tours/Alicante/Foodies-walking-tour/d23519-114883P4",
  "https://www.viator.com/tours/Alicante/Guadalest-and-Algar-springs/d23519-114883P1",
  "https://www.viator.com/tours/Alicante/Private-bike-tour/d23519-88803P3",
  "https://www.viator.com/tours/Alicante/Winery-Tour-with-7-Tastings-and-Chocolate-Factory/d23519-5557582P3",
  "https://www.viator.com/tours/Alicante/Alicante-through-its-museums-with-an-Aperitivo/d23519-130544P4",
  "https://www.viator.com/tours/Alicante/Essential-Alicante-4-Hour-Cruise-Port-Tour/d23519-349914P3",
  "https://www.viator.com/tours/Alicante/Incredible-castle-of-the-province-of-Alicante-and-wine-tasting/d23519-5491768P3",
  "https://www.viator.com/tours/Alicante/Alicante-Like-a-Local-Customized-Private-Tour/d23519-86919P108",
  "https://www.viator.com/tours/Alicante/From-Alicante-Benidorm-LAlbir-Guadalest-and-Altea-Day-Trip/d23519-405770P11",
  "https://www.viator.com/tours/Alicante/Paella-Tour/d23519-349914P1",
  "https://www.viator.com/en-AU/tours/Alicante/Tuk-Tuk-Tour-in-Alicante/d23519-5522124P2",
  "https://www.viator.com/tours/Alicante/Alicante-Highlights-bike-tour/d23519-88803P1",
  "https://www.viator.com/tours/Alicante/The-10-Tastings-of-Alicante-With-Locals-Private-Food-Tour/d23519-24380P1621",
  "https://www.viator.com/en-CA/tours/Alicante/Private-Alicante-Shore-Excursion-with-castle-tour/d23519-130544P21",
  "https://www.viator.com/en-GB/tours/Alicante/Alicante-Paella-Cooking-Class-Tapas-Drinks-and-visit-the-Market/d23519-115858P4",
  "https://www.viator.com/tours/Alicante/Alicante-Legends-and-Misteries/d23519-157952P4",
  "https://www.viator.com/tours/Alicante/3-Hour-Private-Historic-Bike-Tour-of-Alicante-with-Tapas/d23519-364104P3",
  "https://www.viator.com/tours/Alicante/Taste-Alicante/d23519-130544P6",
  "https://www.viator.com/tours/Alicante/Elche-museums-and-Heritage/d23519-157952P3",
  "https://www.viator.com/tours/Alicante/Charming-villages-Villajoyosa-and-Altea/d23519-114883P2",
];

export type ViatorTour = { title: string; url: string; rawUrl: string };

function titleFromUrl(u: string): string {
  const m = u.match(/\/tours\/Alicante\/([^/]+)\//);
  if (!m) return "Excursión en Alicante";
  return decodeURIComponent(m[1])
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function withAffiliate(u: string): string {
  const base = u.split("?")[0];
  return `${base}?${AFFILIATE_QS}`;
}

export const VIATOR_TOURS: ViatorTour[] = RAW_URLS.map((u) => ({
  title: titleFromUrl(u),
  url: withAffiliate(u),
  rawUrl: u,
}));


// Orden estable de slugs de playas (mismo que MAP_BEACHES). 17 playas, 43 tours.
// Distribución round-robin: cada playa recibe 2-3 tours, todos distintos.
const BEACH_SLUG_ORDER: string[] = [
  "cala-lanuza",
  "carrer-la-mar",
  "muchavista",
  "san-juan",
  "cala-cantalar",
  "cala-palmera",
  "cala-judios",
  "cala-tio-ximo",
  "almadraba",
  "albufereta",
  "postiguet",
  "agua-amarga",
  "saladar",
  "urbanova",
  "el-altet",
  "arenales-del-sol",
  "carabassi",
];

export function getToursForBeach(slug: string): ViatorTour[] {
  const idx = BEACH_SLUG_ORDER.indexOf(slug);
  if (idx === -1) return [];
  const n = BEACH_SLUG_ORDER.length;
  const out: ViatorTour[] = [];
  for (let i = idx; i < VIATOR_TOURS.length; i += n) {
    out.push(VIATOR_TOURS[i]);
  }
  return out;
}
