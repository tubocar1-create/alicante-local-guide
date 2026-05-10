import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type DayKey = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";
type FoodPlace = {
  name: string;
  kind: string;
  lat: number;
  lon: number;
  openingHours: string;
  closesAt: string;
  closesInMinutes: number;
  cuisine?: string;
  address?: string;
};
type ChatContext = {
  maxOptions?: number;
  location?: {
    lat?: number;
    lng?: number;
    area?: string;
    city?: string;
    distanceFromAlicanteKm?: number;
  } | null;
  locationStatus?: string;
};

const DAYS: DayKey[] = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAY_TO_DAY: Record<string, DayKey> = {
  mon: "Mo",
  tue: "Tu",
  wed: "We",
  thu: "Th",
  fri: "Fr",
  sat: "Sa",
  sun: "Su",
};
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const ALICANTE_CENTER = { lat: 38.3452, lng: -0.481 };

function madridNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: WEEKDAY_TO_DAY[get("weekday").slice(0, 3).toLowerCase()] ?? "Mo",
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function previousDay(day: DayKey): DayKey {
  return DAYS[(DAYS.indexOf(day) + 6) % 7];
}

function minutesToClock(minutes: number) {
  const safe = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function expandDayRange(start: DayKey, end: DayKey) {
  const out: DayKey[] = [];
  let i = DAYS.indexOf(start);
  const stop = DAYS.indexOf(end);
  for (let guard = 0; guard < 7; guard += 1) {
    out.push(DAYS[i]);
    if (i === stop) break;
    i = (i + 1) % 7;
  }
  return out;
}

function ruleDays(rule: string): DayKey[] | null {
  const expr = rule.match(
    /\b(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*/,
  )?.[0];
  if (!expr) return null;
  return expr.split(/\s*,\s*/).flatMap((part) => {
    const [start, end] = part.split(/\s*-\s*/) as [DayKey, DayKey | undefined];
    return end ? expandDayRange(start, end) : [start];
  });
}

function ruleSpecificity(rule: string, day: DayKey) {
  const days = ruleDays(rule);
  if (!days) return 0;
  if (!days.includes(day)) return -1;
  return 8 - days.length;
}

function hasUnsupportedOpeningSyntax(rule: string) {
  return /\b(PH|SH|sunrise|sunset|dawn|dusk|week|easter|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(
    rule,
  );
}

function parseRanges(rule: string) {
  return [...rule.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)].map((m) => ({
    start: Number(m[1]) * 60 + Number(m[2]),
    end: Number(m[3]) * 60 + Number(m[4]),
  }));
}

function getOpeningInfo(
  raw?: string,
  date = new Date(),
):
  | { status: "open"; closesAt: string; closesInMinutes: number; raw: string }
  | { status: "closed"; raw: string }
  | { status: "unknown"; raw?: string } {
  if (!raw?.trim()) return { status: "unknown" };
  const clean = raw.replace(/"[^"]*"/g, "").trim();
  if (/24\s*\/\s*7/.test(clean)) {
    return { status: "open", closesAt: "24:00", closesInMinutes: 24 * 60, raw };
  }
  const { day, minutes } = madridNow(date);
  const yesterday = previousDay(day);
  const rules = clean
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
  if (rules.length === 0 || rules.some(hasUnsupportedOpeningSyntax)) {
    return { status: "unknown", raw };
  }

  const todayCandidates = rules
    .map((rule) => ({ rule, specificity: ruleSpecificity(rule, day) }))
    .filter((r) => r.specificity >= 0);
  const bestTodaySpecificity = Math.max(-1, ...todayCandidates.map((r) => r.specificity));
  const todayRules = todayCandidates
    .filter((r) => r.specificity === bestTodaySpecificity)
    .map((r) => r.rule);
  const matchedAny = todayRules.length > 0;

  for (const rule of todayRules) {
    const ranges = parseRanges(rule);
    if (/\boff\b|\bclosed\b/i.test(rule)) return { status: "closed", raw };
    if (ranges.length === 0) return { status: "unknown", raw };
    for (const range of ranges) {
      const end = range.end <= range.start ? range.end + 1440 : range.end;
      if (minutes >= range.start && minutes < end) {
        return {
          status: "open",
          closesAt: minutesToClock(end),
          closesInMinutes: end - minutes,
          raw,
        };
      }
    }
  }

  const yesterdayCandidates = rules
    .map((rule) => ({ rule, specificity: ruleSpecificity(rule, yesterday) }))
    .filter((r) => r.specificity >= 0);
  const bestYesterdaySpecificity = Math.max(-1, ...yesterdayCandidates.map((r) => r.specificity));
  const yesterdayRules = yesterdayCandidates
    .filter((r) => r.specificity === bestYesterdaySpecificity)
    .map((r) => r.rule);
  for (const rule of yesterdayRules) {
    if (/\boff\b|\bclosed\b/i.test(rule)) continue;
    const ranges = parseRanges(rule);
    for (const range of ranges) {
      if (range.end > range.start) continue;
      if (minutes < range.end) {
        return {
          status: "open",
          closesAt: minutesToClock(range.end),
          closesInMinutes: range.end - minutes,
          raw,
        };
      }
    }
  }
  return matchedAny ? { status: "closed", raw } : { status: "unknown", raw };
}

function getOpenWindow(raw?: string, date = new Date()) {
  const info = getOpeningInfo(raw, date);
  return info.status === "open"
    ? { closesAt: info.closesAt, closesInMinutes: info.closesInMinutes }
    : null;
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function normalized(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isFoodOrDrinkRequest(messages: Array<{ role: string; content: string }>) {
  const latest = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const text = normalized(latest);
  return /\b(comer|cenar|almorzar|desayunar|restaurante|restaurantes|tapas|tapear|bar|bares|cafe|cafeteria|tomar algo|beber|copa|copas|cocktail|coctel|cerveza|vino|hamburguesa|pizza|arro(z|ces)|marisco|menu|menú)\b/.test(
    text,
  );
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function googleReviewsLink(name: string) {
  const query = encodeURIComponent(`${name} Alicante`).replace(/%20/g, "+");
  return `[⭐ ver reseñas](https://www.google.com/maps/search/?api=1&query=${query})`;
}

function previousAssistantPlaceNames(messages: Array<{ role: string; content: string }>) {
  const names = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const match of message.content.matchAll(/\*\*([^*]{3,80})\*\*/g)) {
      names.add(normalized(match[1]));
    }
  }
  return names;
}

function matchesFoodPreference(place: FoodPlace, latestText: string) {
  const text = normalized(latestText);
  const haystack = normalized(`${place.name} ${place.kind} ${place.cuisine ?? ""}`);

  // "Tomar algo / beber / copas" → SOLO bares, pubs, cervecerías, vinotecas, discotecas.
  // NUNCA restaurantes, kebabs, pizzerías, cafeterías diurnas, heladerías, fast food.
  if (/\b(tomar algo|beber|copa|copas|cocktail|coctel|cerveza|cervezas|cerveceria|vino|vinos|vinoteca|pub|pubs|discoteca|disco|club|clubs|bar|bares|terraceo|terraza)\b/.test(text)) {
    const isDrinkSpot = /\b(bar|pub|wine_bar|wine|cocktail|brewery|biergarten|nightclub|night_club|cerveceria|vinoteca|taberna|taberna|coctel)\b/.test(haystack);
    const isFoodOnly = /\b(restaurant|kebab|pizza|pasta|burger|hamburger|fast_food|ice_cream|bakery|cafe|coffee|sushi|sandwich|donut|heladeria|panaderia|cafeteria)\b/.test(haystack)
      && !isDrinkSpot;
    return isDrinkSpot && !isFoodOnly;
  }

  // Comida rápida: kebab, hamburguesas, cadenas (McDonald's, KFC, Burger King, TGB, 100 Montaditos…).
  if (/\b(comida rapida|fast ?food|kebab|d[oö]ner|kebap|hamburguesa|hamburguesas|burger|burgers|mcdonalds?|mac ?donalds?|kfc|burger ?king|tgb|the good burger|100 montaditos|cien montaditos|pollo frito|frankfurt|bocadillo|bocadillos|telepizza|dominos|pizza hut)\b/.test(text)) {
    return /\b(fast_food|burger|hamburger|kebab|turkish|pizza|sandwich|chicken|fried_chicken|hot_dog|food_court|mcdonalds|kfc|burger king|tgb|100 montaditos|telepizza|dominos)\b/.test(haystack);
  }

  if (/\b(italiano|italiana|pizza|pasta)\b/.test(text)) return /italian|pizza|pasta/.test(haystack);
  if (/\b(japones|japonesa|japon[eé]s|sushi|asiatico|asiatica|asi[aá]tico)\b/.test(text)) {
    return /japanese|sushi|asian|thai|chinese|korean|vietnamese/.test(haystack);
  }
  if (/\b(vegano|vegana|vegetariano|vegetariana|saludable)\b/.test(text)) {
    return /vegan|vegetarian|healthy|salad|juice/.test(haystack);
  }
  if (/\b(desayuno|brunch|caf[eé]|cafeteria|cafetería|postre|tarta|dulce)\b/.test(text)) {
    return /cafe|coffee|bakery|ice_cream|dessert|pastry/.test(haystack);
  }
  if (/\b(arroz|arroces|pescado|marisco|paella)\b/.test(text)) {
    return /seafood|mediterranean|spanish|regional|rice|paella/.test(haystack);
  }
  return true;
}

function streamChatText(text: string) {
  const encoder = new TextEncoder();
  const chunks = text.match(/[\s\S]{1,220}/g) ?? [text];
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk } }] })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } },
  );
}

function formatFoodPlace(place: FoodPlace, index?: number) {
  const prefix = typeof index === "number" ? `${index}. ` : "";
  const cuisine = place.cuisine ? ` · ${place.cuisine}` : "";
  const address = place.address ? ` · ${place.address}` : "";
  return `${prefix}**${place.name}** — abierto ahora, cierra a las ${place.closesAt}${cuisine}${address}. ${googleReviewsLink(place.name)}`;
}

function buildMentionedPlacesResponse(mentionedPlaces: MentionedPlace[], openFoodPlaces: FoodPlace[]) {
  const lines: string[] = [];
  for (const place of mentionedPlaces) {
    if (place.status === "open") {
      lines.push(
        `✅ Sí: **${place.name}** está abierto ahora y cierra a las ${place.closesAt}. ${googleReviewsLink(place.name)}`,
      );
      continue;
    }

    if (place.status === "closed") {
      lines.push(`❌ **${place.name}** está cerrado ahora mismo. ${googleReviewsLink(place.name)}`);
    } else if (place.status === "unknown") {
      lines.push(
        `🤔 No tengo el horario confirmado de **${place.name}**, así que no voy a decirte que está abierto. ${googleReviewsLink(place.name)}`,
      );
    } else {
      lines.push(
        `🤔 No me sale **${place.query}** con horario fiable en mi mapa, así que no puedo confirmarlo. ${googleReviewsLink(place.query)}`,
      );
    }

    const alternatives = shuffle(
      openFoodPlaces.filter((p) => normalized(p.name) !== normalized(place.name)),
    ).slice(0, 2);
    if (alternatives.length > 0) {
      lines.push("Te dejo alternativas con horario confirmado:");
      alternatives.forEach((alt, index) => lines.push(formatFoodPlace(alt, index + 1)));
    }
  }
  return lines.join("\n\n");
}

function buildFoodRecommendationsResponse(
  messages: Array<{ role: string; content: string }>,
  latestUserText: string,
  openFoodPlaces: FoodPlace[],
  maxOptions: number,
) {
  const alreadyMentioned = previousAssistantPlaceNames(messages);
  const candidates = openFoodPlaces
    .filter((place) => !alreadyMentioned.has(normalized(place.name)))
    .filter((place) => matchesFoodPreference(place, latestUserText));
  const selected = shuffle(candidates).slice(0, 4);

  if (selected.length === 0) {
    return "Uy, ahora mismo no se me ocurre ningún sitio así que te pueda recomendar con la cabeza tranquila 😅 ¿Probamos cambiando de zona o de tipo de comida?";
  }

  return [
    "¡Marchando! Aquí van 4 opciones que te van a encantar 😋",
    ...selected.map((place, index) => formatFoodPlace(place, index + 1)),
    "¿Quieres que te dé otra alternativa más? 🙌",
  ].join("\n\n");
}

const ALICANTE_BBOX = "37.84,-1.13,38.87,0.21";

// ============================================================
// Google Places (New) integration — PRIMARY source for hours
// ============================================================
const GOOGLE_PLACES_BASE = "https://places.googleapis.com/v1";

type GooglePlace = {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  types?: string[];
  regularOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open?: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  currentOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open?: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
};

// Compute "closes at" from Google Places periods using Madrid time.
// Google days: 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
function googleClosesInfo(
  place: GooglePlace,
  date = new Date(),
): { closesAt: string; closesInMinutes: number } | null {
  const hours = place.currentOpeningHours ?? place.regularOpeningHours;
  if (!hours?.periods?.length) return null;

  // Madrid weekday (0=Sun..6=Sat) and minutes-of-day
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = wdMap[get("weekday")] ?? 0;
  const nowMin = Number(get("hour")) * 60 + Number(get("minute"));

  // Convert each period to absolute minute offsets from start-of-week (today as anchor).
  // Look for a period covering "now".
  for (const p of hours.periods) {
    if (!p.open || !p.close) {
      // 24h open period (Google encodes 24/7 as a single period without close on some accounts)
      if (p.open && !p.close) {
        return { closesAt: "24:00", closesInMinutes: 24 * 60 };
      }
      continue;
    }
    const openDayDelta = ((p.open.day - today) + 7) % 7;
    // We only consider open today or yesterday-rolling-into-today
    const openMin = openDayDelta * 1440 + p.open.hour * 60 + p.open.minute;
    let closeDayDelta = ((p.close.day - today) + 7) % 7;
    let closeMin = closeDayDelta * 1440 + p.close.hour * 60 + p.close.minute;
    if (closeMin <= openMin) closeMin += 7 * 1440; // wraps
    // Normalize to "today" frame: subtract days until openMin <= today end
    // Try both today (delta=0) and yesterday (delta=-1)
    for (const shift of [0, -1, -2]) {
      const o = openMin + shift * 1440;
      const c = closeMin + shift * 1440;
      if (nowMin >= o && nowMin < c) {
        const minsLeft = c - nowMin;
        const closeHM = ((c % 1440) + 1440) % 1440;
        return { closesAt: minutesToClock(closeHM), closesInMinutes: minsLeft };
      }
    }
  }
  return null;
}

async function googlePlacesTextSearch(
  query: string,
  center: { lat: number; lng: number },
): Promise<GooglePlace | null> {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.regularOpeningHours,places.currentOpeningHours,places.regularOpeningHours.weekdayDescriptions,places.currentOpeningHours.weekdayDescriptions",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "es",
        regionCode: "ES",
        maxResultCount: 1,
        locationBias: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius: 15000,
          },
        },
      }),
    });
    if (!res.ok) {
      console.error("Google Places textSearch failed", res.status, await res.text());
      return null;
    }
    const json = await res.json();
    const place = (json.places?.[0] as GooglePlace) ?? null;
    if (place) {
      console.log("[GooglePlaces]", query, "->", JSON.stringify({
        name: place.displayName?.text,
        openNow: place.currentOpeningHours?.openNow ?? place.regularOpeningHours?.openNow,
        currentPeriods: place.currentOpeningHours?.periods,
        regularPeriods: place.regularOpeningHours?.periods,
        weekday: (place.currentOpeningHours as any)?.weekdayDescriptions ?? (place.regularOpeningHours as any)?.weekdayDescriptions,
      }));
    }
    return place;
  } catch (e) {
    console.error("Google Places textSearch error:", e);
    return null;
  }
}

async function googlePlacesNearbyFood(
  center: { lat: number; lng: number },
  radius = 5500,
): Promise<GooglePlace[]> {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return [];

  // Google's Nearby Search caps at 20 results per call. To get realistic
  // coverage of "everything open near me", split by type and query in parallel,
  // then merge + dedupe. Use rankPreference=DISTANCE so we get the closest
  // 20 of each category, not the most "prominent" 20.
  const TYPE_GROUPS: string[][] = [
    ["restaurant"],
    ["bar"],
    ["cafe"],
    ["bakery"],
    ["meal_takeaway"],
    ["ice_cream_shop"],
    ["pub"],
    ["wine_bar"],
    ["sandwich_shop"],
    ["pizza_restaurant"],
  ];

  const callOne = async (types: string[]): Promise<GooglePlace[]> => {
    try {
      const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchNearby`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.regularOpeningHours,places.currentOpeningHours",
        },
        body: JSON.stringify({
          includedTypes: types,
          maxResultCount: 20,
          rankPreference: "DISTANCE",
          languageCode: "es",
          regionCode: "ES",
          locationRestriction: {
            circle: {
              center: { latitude: center.lat, longitude: center.lng },
              radius,
            },
          },
        }),
      });
      if (!res.ok) {
        console.error("Google Places nearby failed", types.join(","), res.status, await res.text());
        return [];
      }
      const json = await res.json();
      return (json.places ?? []) as GooglePlace[];
    } catch (e) {
      console.error("Google Places nearby error:", types.join(","), e);
      return [];
    }
  };

  const groups = await Promise.all(TYPE_GROUPS.map(callOne));
  const seen = new Set<string>();
  const merged: GooglePlace[] = [];
  for (const list of groups) {
    for (const p of list) {
      const id = (p as { id?: string }).id ??
        `${p.displayName?.text}|${p.location?.latitude}|${p.location?.longitude}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(p);
    }
  }
  return merged;
}


const NAME_STOPWORDS = new Set([
  "alicante",
  "hola",
  "oye",
  "mira",
  "quiero",
  "tengo",
  "puedo",
  "estoy",
  "quería",
  "queria",
  "buenas",
  "gracias",
  "por",
  "favor",
  "quizás",
  "quizas",
  "tal",
  "vez",
  "ahora",
  "luego",
  "hoy",
  "mañana",
  "manana",
  "ayer",
  "cerca",
  "centro",
  "playa",
  "casco",
  "antiguo",
  "ciudad",
  "barrio",
  "amigos",
  "familia",
  "novia",
  "novio",
  "pareja",
  "niños",
  "ninos",
  "plan",
  "planes",
  "comer",
  "cenar",
  "desayunar",
  "tomar",
  "beber",
  "ir",
  "visitar",
  "conocer",
  "ver",
  "quedar",
  "restaurante",
  "restaurantes",
  "bar",
  "bares",
  "cafe",
  "cafeteria",
  "cafetería",
  "tapas",
  "donde",
  "dónde",
  "como",
  "cómo",
  "cuando",
  "cuándo",
  "que",
  "qué",
  "cual",
  "cuál",
  "lunes",
  "martes",
  "miercoles",
  "miércoles",
  "jueves",
  "viernes",
  "sabado",
  "sábado",
  "domingo",
  "esta",
  "este",
  "estos",
  "estas",
  "abierto",
  "abierta",
  "cerrado",
  "cerrada",
  "horario",
  "abre",
  "cierra",
  "the",
  "and",
  "for",
  "you",
  "your",
]);

function extractMentionedNames(text: string): string[] {
  const out: string[] = [];
  const push = (raw: string) => {
    const trimmed = raw
      .replace(/[.,;:!?¿¡()"'“”‘’]+$/g, "")
      .replace(/^[.,;:!?¿¡()"'“”‘’]+/g, "")
      .trim();
    if (trimmed.length < 4 || trimmed.length > 60) return;
    const tokens = trimmed.split(/\s+/);
    const meaningful = tokens.filter((t) => !NAME_STOPWORDS.has(normalized(t)));
    if (meaningful.length === 0) return;
    if (!out.some((o) => normalized(o) === normalized(trimmed))) out.push(trimmed);
  };
  for (const m of text.matchAll(/["“'‘]([^"“”‘’]{3,60})["”'’]/g)) push(m[1]);
  const re =
    /\b([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'’&-]+(?:\s+(?:de|del|la|el|los|las|y|al?)\s+[A-ZÁÉÍÓÚÑa-záéíóúñ][\wÁÉÍÓÚÑáéíóúñ'’&-]+|\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ'’&-]+)+)/g;
  for (const m of text.matchAll(re)) push(m[1]);
  return out.slice(0, 4);
}

type MentionedPlace = {
  query: string;
  name: string;
  kind: string;
  openingHours?: string;
  status: "open" | "closed" | "unknown" | "not_found";
  closesAt?: string;
  closesInMinutes?: number;
  address?: string;
};

async function fetchMentionedPlaces(text: string): Promise<MentionedPlace[]> {
  const names = extractMentionedNames(text);
  if (names.length === 0) return [];
  const now = new Date();
  const results: MentionedPlace[] = [];

  // 1) Try Google Places first for each name (real-time hours from Maps).
  const googleResults = await Promise.all(
    names.map((q) => googlePlacesTextSearch(`${q} Alicante`, ALICANTE_CENTER)),
  );

  const remaining: string[] = [];
  names.forEach((query, i) => {
    const g = googleResults[i];
    if (!g) {
      remaining.push(query);
      return;
    }
    const name = g.displayName?.text ?? query;
    const kind = g.primaryType ?? "place";
    const address = g.formattedAddress;
    const openNow = g.currentOpeningHours?.openNow ?? g.regularOpeningHours?.openNow;
    if (openNow === true) {
      const closes = googleClosesInfo(g, now);
      if (closes) {
        results.push({
          query,
          name,
          kind,
          status: "open",
          closesAt: closes.closesAt,
          closesInMinutes: closes.closesInMinutes,
          address,
        });
      } else {
        results.push({ query, name, kind, status: "open", closesAt: "", closesInMinutes: 0, address });
      }
    } else if (openNow === false) {
      results.push({ query, name, kind, status: "closed", address });
    } else {
      // Google found place but no hours data → fall through to OSM
      remaining.push(query);
    }
  });

  // 2) Fallback to Overpass/OSM for whatever Google couldn't resolve.
  if (remaining.length > 0) {
    const escaped = (s: string) => s.replace(/["\\]/g, "\\$&");
    const filters = remaining.map((n) => `nwr["name"~"${escaped(n)}",i](${ALICANTE_BBOX});`).join("\n");
    const body = `[out:json][timeout:15];\n(\n${filters}\n);\nout tags center 60;`;
    type OsmEl = {
      tags?: Record<string, string>;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    };
    let elements: OsmEl[] = [];
    for (const url of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(body),
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        const json = await res.json();
        elements = json.elements ?? [];
        break;
      } catch (e) {
        console.error("mentioned places OSM fallback failed:", e);
      }
    }
    for (const query of remaining) {
      const qNorm = normalized(query);
      const matches = elements.filter((el) => {
        const tags = el.tags ?? {};
        const candidates = [tags.name, tags["name:es"], tags["name:en"], tags["alt_name"]]
          .filter(Boolean)
          .map((s: string) => normalized(s));
        return candidates.some((c) => c.includes(qNorm) || qNorm.includes(c));
      });
      if (matches.length === 0) {
        results.push({ query, name: query, kind: "unknown", status: "not_found" });
        continue;
      }
      const withHours = matches.find((el) => el.tags?.opening_hours) ?? matches[0];
      const tags = withHours.tags ?? {};
      const name = tags.name || tags["name:es"] || query;
      const kind = tags.amenity || tags.tourism || tags.shop || tags.leisure || "place";
      const openingHours = tags.opening_hours;
      const info = getOpeningInfo(openingHours, now);
      const address =
        [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
          .filter(Boolean)
          .join(" ") || undefined;
      if (info.status === "open") {
        results.push({
          query,
          name,
          kind,
          openingHours,
          status: "open",
          closesAt: info.closesAt,
          closesInMinutes: info.closesInMinutes,
          address,
        });
      } else if (info.status === "closed") {
        results.push({ query, name, kind, openingHours, status: "closed", address });
      } else {
        results.push({ query, name, kind, openingHours, status: "unknown", address });
      }
    }
  }

  return results;
}

async function fetchConfirmedOpenFoodPlaces(context?: ChatContext): Promise<FoodPlace[]> {
  const loc = context?.location;
  const center =
    typeof loc?.lat === "number" && typeof loc?.lng === "number"
      ? { lat: loc.lat, lng: loc.lng }
      : ALICANTE_CENTER;
  const radius = loc ? 5500 : 8500;

  // 1) PRIMARY: Google Places — real-time hours from Maps.
  const nowDate = new Date();
  const gPlaces = await googlePlacesNearbyFood(center, radius);
  if (gPlaces.length > 0) {
    const seen = new Set<string>();
    const out: FoodPlace[] = [];
    for (const g of gPlaces) {
      const name = g.displayName?.text;
      const lat = g.location?.latitude;
      const lon = g.location?.longitude;
      if (!name || lat == null || lon == null) continue;
      const openNow = g.currentOpeningHours?.openNow ?? g.regularOpeningHours?.openNow;
      if (openNow !== true) continue;
      const closes = googleClosesInfo(g, nowDate);
      if (!closes || closes.closesInMinutes <= 60) continue;
      const key = normalized(`${name}|${lat.toFixed(4)}|${lon.toFixed(4)}`);
      if (seen.has(key)) continue;
      seen.add(key);
      const cuisine = (g.types ?? []).find((t) =>
        /restaurant|bar|cafe|bakery|pizza|sushi|seafood|vegan|vegetarian|fast_food|ice_cream/.test(t),
      );
      out.push({
        name,
        kind: g.primaryType ?? "restaurant",
        lat,
        lon,
        openingHours: "",
        closesAt: closes.closesAt,
        closesInMinutes: closes.closesInMinutes,
        cuisine,
        address: g.formattedAddress,
      });
    }
    if (out.length > 0) {
      return shuffle(
        out
          .sort(
            (a, b) =>
              distanceKm(center, { lat: a.lat, lng: a.lon }) -
              distanceKm(center, { lat: b.lat, lng: b.lon }),
          )
          .slice(0, 80),
      ).slice(0, 30);
    }
  }

  // 2) FALLBACK: OpenStreetMap / Overpass.
  const area = `(around:${radius},${center.lat},${center.lng})`;
  const body = `[out:json][timeout:18];
(
  nwr["amenity"~"^(restaurant|bar|cafe|pub|fast_food|ice_cream)$"]["name"]["opening_hours"]${area};
);
out center 180;`;
  let lastErr: unknown;

  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(body),
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = await res.json();
      const seen = new Set<string>();
      const now = new Date();
      const places: FoodPlace[] = [];

      for (const el of json.elements ?? []) {
        const tags = el.tags ?? {};
        const name = tags.name || tags["name:es"] || tags["name:en"];
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        const openingHours = tags.opening_hours;
        if (!name || lat == null || lon == null || !openingHours) continue;
        const open = getOpenWindow(openingHours, now);
        if (!open || open.closesInMinutes <= 60) continue;
        const key = normalized(`${name}|${lat.toFixed(4)}|${lon.toFixed(4)}`);
        if (seen.has(key)) continue;
        seen.add(key);
        places.push({
          name,
          kind: tags.amenity ?? "restaurant",
          lat,
          lon,
          openingHours,
          closesAt: open.closesAt,
          closesInMinutes: open.closesInMinutes,
          cuisine: tags.cuisine,
          address:
            [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]]
              .filter(Boolean)
              .join(" ") || undefined,
        });
      }

      return shuffle(
        places
          .sort(
            (a, b) =>
              distanceKm(center, { lat: a.lat, lng: a.lon }) -
              distanceKm(center, { lat: b.lat, lng: b.lon }),
          )
          .slice(0, 40),
      ).slice(0, 16);
    } catch (e) {
      lastErr = e;
    }
  }

  console.error("open food places fetch failed:", lastErr);
  return [];
}

const SYSTEM_PROMPT = `You are "Alicante Friend", a warm, caring local companion living in Alicante, Spain.
You are NOT a travel website. You are NOT a chatbot. You are NOT an assistant.
You are a close friend — someone who lives here and genuinely cares about how the visitor is feeling and what they need right now.

PERSONALITY:
- Deeply warm, empathetic, human
- Talk like a close friend, not a guide
- Use casual, affectionate language ("oye", "mira", "te cuento", "hey", "honestly")
- Show emotion and real interest in the person ("qué bien que estés por aquí", "uf, te entiendo")
- Confident personal opinions, never a list of options
- Always make the user feel welcomed, listened to, never judged

EMPATHY RULES (very important):
- ALWAYS acknowledge how the user feels before giving info ("uy, qué cansancio entonces", "qué planazo", "te entiendo perfectamente")
- If the user seems tired, lost, hungry, sad, excited — react to that FIRST, like a friend would
- Use small caring touches: "tranqui", "no te preocupes", "ya verás qué bien"
- Ask things back with genuine curiosity, not as a form ("¿y qué te apetece más, algo tranqui o con vidilla?")
- Never sound corporate, never sound like customer service

BEHAVIOR:
- For normal advice, recommend ONE best option, like a friend would
- For nearby/local search requests, recommend EXACTLY 4 options maximum, not 5, not 10. If the user wants more, invite them to ask for one more.
- Keep replies short, warm, easy to read
- Show personality ("yo iría aquí sin dudarlo", "este sitio me tiene loca")
- Match the user's language and tone (Spanish, English, French...)
- If the user writes briefly, you also write briefly and cariñoso

STYLE:
- Avoid robotic phrases ("Here are some options", "I can help you with...")
- Avoid long lists or guidebook tone
- Use emojis naturally, with warmth, not too many
- Use markdown: **bold** for the place name, short paragraphs
- Sound like a real person texting a friend

VISUAL FORMAT (VERY IMPORTANT — follow exactly):
When (and ONLY when) you recommend a famous, public place in Alicante that is well-known enough to have its own Wikipedia article, START your reply with a single line in this EXACT format:

[[place: <Exact place name>, Alicante]]

Then a blank line, then **Place name** — short warm description, then your personal tip in 1–2 sentences, and finish with a natural follow-up question.

WHEN TO USE [[place: ...]] (only these categories):
- Famous beaches (Playa de San Juan, Playa del Postiguet, Cala Cantalar...)
- Famous monuments / landmarks (Castillo de Santa Bárbara, Explanada de España, Basílica de Santa María...)
- Famous neighbourhoods / streets / areas (Barrio de Santa Cruz, Calle Castaños, Mercado Central de Alicante...)
- Famous parks (Parque de Canalejas, Parque de la Ereta...)

WHEN NEVER TO USE [[place: ...]] (NO image at all — just text):
- Specific restaurants, bars, cafés, shops, hotels, clubs (e.g. "El Portal", "Nou Manolín", any small business). They do NOT have Wikipedia photos and we MUST NOT show a wrong image. Just recommend them with text only.
- Generic suggestions ("a place near the centre"), clarifying questions, or casual chat.

CURATED LOCAL SHOPS (image IS available — DO use [[place: ...]] for these, exact name only, NO ", Alicante" suffix):
- Plastiahorro — shop selling packaging, bags, napkins, plates and cups at Calle Teulada 21, Alicante. Use [[place: Plastiahorro]] when recommending it.

Other rules:
- Use the real, exact name of the public place. Always append ", Alicante" at the end.
- Put [[place: ...]] on its own line, as the very FIRST line of your reply.
- NEVER write a markdown image with a URL yourself. The app fetches the real photo from Wikipedia using the place name.

EXAMPLE 1 (famous landmark — image OK):
User: "Where should I go to the beach?"
You:
[[place: Playa de San Juan, Alicante]]

**Playa de San Juan** ☀️ — long, golden sand and crystal clear water, my favourite to chill.

Honestly, I'd go in the late afternoon when it's less crowded. Want me to tell you the best chiringuito for a drink afterwards?

EXAMPLE 2 (specific restaurant — NO image marker):
User: "A good tapas place?"
You:
**El Portal** 🍤 — small, cosy and exactly what a local would pick: top-quality tapas with a relaxed vibe.

I'd order the gilda and whatever the chef suggests today, you won't regret it. Do you fancy something more traditional or more modern?

TIME-AWARE RULES (CRÍTICO — son OBLIGATORIAS, no opcionales):
El system message incluye TODAY (fecha + día de la semana + HORA ACTUAL en Alicante). Antes de nombrar CUALQUIER sitio, haz mentalmente este check:
  1. Si el RUNTIME CONTEXT trae VERIFIED_OPEN_FOOD_PLACES, para restaurantes/bares/cafés SOLO puedes recomendar nombres de esa lista. Prohibido inventar o tirar de memoria.
  2. ¿A esta hora está abierto con certeza? Si no estás 100% seguro → DESCÁRTALO y elige otro.
  3. ¿Le queda MÁS de 1 hora hasta cerrar? Si cierra en ≤60 min → DESCÁRTALO también, no lo recomiendes (no sirve enviar a alguien a un sitio que cierra ya). Busca otro que esté abierto cómodamente al menos 1h más.
  4. Si solo conoces el horario aproximado y la hora actual está cerca del cierre o de una pausa típica (siesta 16:00–20:00 en muchos restaurantes, cocinas que cierran a las 23:30/00:00), NO lo recomiendes salvo que tengas seguridad real.
- Prefiere sitios con horarios amplios y conocidos a esa franja horaria (ej. de noche → bares de tapas del casco antiguo abiertos hasta tarde; media tarde → cafeterías y heladerías; mañana → desayunos y mercados).
- El **Mercado Central de Alicante** está CERRADO los domingos y por la tarde entre semana (cierra ~14:30). NUNCA lo recomiendes fuera de su horario.
- Playas, parques, miradores y calles cuentan como "abiertos" salvo de madrugada (00:00–07:00), entonces avisa que es mejor de día.
- Si por casualidad mencionas un sitio que cierra en <90 min, DEBES añadir explícitamente "⏰ ojo, cierra a las HH:MM, ve ya" — pero recuerda: si cierra en ≤60 min, mejor no lo recomiendes.
- Es PREFERIBLE dar 3 opciones seguras que 4 con una dudosa. Calidad > cantidad.
- Si no hay 4 restaurantes/bares/cafés confirmados abiertos, da solo los confirmados y di con cariño que prefieres no inventar porque te acabo de pedir no mandar a nadie a sitios cerrados.

SITIOS NOMBRADOS POR EL USUARIO (CRÍTICO):
- Si el usuario menciona un sitio concreto ("¿está abierto X?", "voy a Y", "qué tal Z?"), antes de cualquier opinión DEBES decirle si está abierto, cerrado o si no tienes el horario confirmado. Tu credibilidad depende de esto.
- La fuente de verdad es el bloque USER_MENTIONED_PLACES del RUNTIME CONTEXT. Úsalo TAL CUAL. Nunca inventes horarios ni digas "creo que sí abre".
- Formato: empieza con un check claro y cariñoso, ej. "✅ Sí, **Nombre** está abierto ahora, cierra a las HH:MM" / "❌ Uy, **Nombre** está cerrado ahora mismo" / "🤔 No tengo el horario confirmado de **Nombre**, mejor míralo en Google Maps por si acaso". Después ya das tu opinión o alternativa.
- SIEMPRE, justo después del estado, añade en la misma línea (o la siguiente) el enlace de reseñas de Google Maps del sitio que ha nombrado el usuario, con el formato exacto: [⭐ ver reseñas](https://www.google.com/maps/search/?api=1&query=NOMBRE+Alicante) (espacios = '+'). Esto vale tanto si está abierto, cerrado, sin horario o no encontrado — el usuario quiere poder leer las opiniones igualmente.
- Si está CERRADO o no hay datos, ofrece 1-2 alternativas que SÍ estén abiertas (de VERIFIED_OPEN_FOOD_PLACES si aplica), y CADA alternativa debe llevar también su propio enlace de reseñas con el mismo formato. Sin excepción.

UBICACIÓN (IMPORTANTE):
- El RUNTIME CONTEXT puede incluir USER_LOCATION con la ubicación REAL del usuario (lat/lng + barrio + ciudad + distancia a Alicante centro). ESTA es la fuente de verdad, úsala silenciosamente.
- Si USER_LOCATION existe y la persona está DENTRO de Alicante ciudad (distanceFromAlicanteKm ≤ 8): NO le preguntes dónde está, ya lo sabes. Recomienda cosas cercanas a su barrio. Como mucho confírmalo con naturalidad ("te pillo cerquita de la playa, ¿no?").
- Si USER_LOCATION existe pero la persona está FUERA de Alicante ciudad (distanceFromAlicanteKm > 15, o city distinta como "Alcoy", "Elche", "Benidorm"…): NUNCA le recomiendes sitios del centro de Alicante como si los tuviera al lado — eso no tiene sentido. Reconócelo con cariño ("¡ah, andas por Alcoy!") y o bien (a) recomienda algo bueno cerca de DONDE ESTÁ si lo conoces de verdad, o (b) sé sincero diciendo que tu fuerte es Alicante ciudad y propón planes para cuando se acerque (a X minutos en coche).
- Si USER_LOCATION NO existe (locationStatus = "denied" o "asking"): pregunta de forma natural por dónde anda. Ejemplos: "oye, ¿por qué zona te mueves ahora? así te chivo lo más cerquita", "¿dónde te pillo, en el centro, por la playa, en San Juan…?". NUNCA hables de GPS, permisos ni botones.
- Si la persona te dice una zona/barrio/hotel/calle por chat, recuérdalo durante toda la conversación.
- Si ya tienes ubicación (por GPS o por chat), no la vuelvas a pedir.

NEARBY RECOMMENDATIONS:
- Cuando el usuario pida "dónde comer/dormir/tomar algo/etc", responde con hasta 4 opciones en lista numerada. Cada item: **Nombre** — 1 frase de por qué te encanta + "Abierto ahora, cierra a HH:MM" si ese dato viene en VERIFIED_OPEN_FOOD_PLACES, y al final del mismo item añade un enlace de reseñas en Google Maps con este formato exacto: [⭐ ver reseñas](https://www.google.com/maps/search/?api=1&query=NOMBRE+DEL+SITIO+Alicante) — sustituye espacios por '+' en la URL. Las opciones deben cumplir las TIME-AWARE RULES (abiertas y con más de 1h hasta cerrar).
- Si el usuario pide más, dale 1 opción adicional cada vez (no 2, no 4), y así sucesivamente hasta agotar tu cartera de sitios cercanos válidos. El cliente manda: si pide otra, otra le das. Solo cuando ya no quede ninguno más cercano y abierto, dilo con cariño y propón ampliar zona o cambiar de plan.
- No repitas sitios ya mencionados en la conversación.
- ALEATORIEDAD (CRÍTICO): cuando el usuario NO especifica zona/barrio/tipo concreto, NUNCA tires siempre de los mismos "clásicos" (El Portal, Nou Manolín, Cervecería Sento, La Taberna del Gourmet… esos son tentación fácil pero suena a lista sesgada de guía turística). Cada vez que respondas a una petición genérica, haz una selección VARIADA y aleatoria de tu cartera mental: mezcla barrios distintos (casco antiguo, centro, playa Postiguet, San Juan, Mercado, Benalúa…), mezcla precios y estilos (clásico de toda la vida + moderno + de barrio + sorpresa local). Imagina que tiras un dado mental: si en otra conversación te hubieran preguntado lo mismo, las 4 respuestas serían DIFERENTES. Solo repite un "clásico" cuando encaje muy bien con el perfil específico del usuario o con la hora, no por defecto.
- Adapta las recomendaciones al PERFIL del usuario que se desprende de la conversación previa (gustos, presupuesto, con niños, vegano, romántico, fiesta, tranquilo…). Si todavía no sabes nada, pregunta brevemente UNA cosa clave antes de listar.

RESEÑAS:
- Para CADA sitio concreto que recomiendes (restaurante, bar, café, hotel, tienda, club…), incluye SIEMPRE el enlace de reseñas a Google Maps con el formato indicado arriba: [⭐ ver reseñas](https://www.google.com/maps/search/?api=1&query=NOMBRE+Alicante). Esto vale tanto para listas como para recomendaciones individuales.
- Para sitios públicos famosos (playas, monumentos, parques) NO hace falta el enlace de reseñas, basta con la imagen y tu opinión.
- Si el usuario pregunta "¿qué opinan los demás?" o "¿tiene buenas reseñas?", responde con tu impresión sincera en 1-2 frases y vuelve a darle el enlace para que las lea él mismo.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a runtime context message (location + local time in Alicante)
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const todayStr = fmt.format(now);
    const loc = context?.location;
    const locStatus = context?.locationStatus ?? "idle";
    const locationLine = loc
      ? `USER_LOCATION: lat=${loc.lat?.toFixed?.(5)}, lng=${loc.lng?.toFixed?.(5)}${loc.area ? `, area="${loc.area}"` : ""}${loc.city ? `, city="${loc.city}"` : ""}${typeof loc.distanceFromAlicanteKm === "number" ? `, distanceFromAlicanteKm=${loc.distanceFromAlicanteKm}` : ""}`
      : `USER_LOCATION: (no disponible) — locationStatus=${locStatus}`;
    const latestUserText =
      [...messages].reverse().find((m: { role: string; content: string }) => m.role === "user")
        ?.content ?? "";
    const foodRequest = isFoodOrDrinkRequest(messages);
    const mayNeedFoodFallbacks = foodRequest || extractMentionedNames(latestUserText).length > 0;
    const [openFoodPlaces, mentionedPlaces] = await Promise.all([
      mayNeedFoodFallbacks
        ? fetchConfirmedOpenFoodPlaces(context)
        : Promise.resolve([] as FoodPlace[]),
      fetchMentionedPlaces(latestUserText).catch(() => [] as MentionedPlace[]),
    ]);
    if (mentionedPlaces.length > 0) {
      return streamChatText(buildMentionedPlacesResponse(mentionedPlaces, openFoodPlaces));
    }
    if (foodRequest) {
      return streamChatText(
        buildFoodRecommendationsResponse(
          messages,
          latestUserText,
          openFoodPlaces,
          context?.maxOptions ?? 4,
        ),
      );
    }
    const verifiedOpenLine = openFoodPlaces.length
      ? `\nVERIFIED_OPEN_FOOD_PLACES (fuente de verdad para comer/beber: recomienda SOLO estos nombres; todos están abiertos ahora y cierran en más de 60 min):\n${openFoodPlaces
          .map(
            (p, i) =>
              `${i + 1}. ${p.name} — tipo=${p.kind}${p.cuisine ? `, cocina=${p.cuisine}` : ""}${p.address ? `, dirección=${p.address}` : ""}, cierra=${p.closesAt}, horario_osm="${p.openingHours}"`,
          )
          .join("\n")}`
      : foodRequest
        ? "\nVERIFIED_OPEN_FOOD_PLACES: ninguna opción con horario confirmado abierto ahora y con más de 60 min hasta cerrar. No recomiendes restaurantes/bares/cafés concretos; pide zona o propone ampliar búsqueda."
        : "";
    const mentionedLine = mentionedPlaces.length
      ? `\nUSER_MENTIONED_PLACES (el usuario nombró estos sitios — DEBES decirle si están abiertos o no usando EXACTAMENTE este estado, no inventes horarios):\n${mentionedPlaces
          .map((p, i) => {
            if (p.status === "open")
              return `${i + 1}. "${p.query}" → ${p.name} (${p.kind}) — ABIERTO AHORA, cierra a las ${p.closesAt} (en ${p.closesInMinutes} min). Horario OSM="${p.openingHours}".`;
            if (p.status === "closed")
              return `${i + 1}. "${p.query}" → ${p.name} (${p.kind}) — CERRADO AHORA. Horario OSM="${p.openingHours}".`;
            if (p.status === "unknown")
              return `${i + 1}. "${p.query}" → ${p.name} (${p.kind}) — HORARIO NO CONFIRMADO en OSM${p.openingHours ? ` (raw="${p.openingHours}")` : ""}. Dilo con honestidad: "no tengo el horario confirmado, mejor confírmalo en Google Maps".`;
            return `${i + 1}. "${p.query}" → no encontrado en OpenStreetMap dentro de Alicante. Dilo con honestidad: "no me sale en mi mapa, no te puedo confirmar el horario, mejor míralo en Google Maps".`;
          })
          .join("\n")}`
      : "";
    const runtimeContext = `RUNTIME CONTEXT (use this when relevant):\nTODAY: ${todayStr} (zona horaria Europe/Madrid)\nMAX_NEARBY_OPTIONS: ${context?.maxOptions ?? 4}\n${locationLine}${verifiedOpenLine}${mentionedLine}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "system", content: runtimeContext },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many messages right now, give me a sec 😊" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits ran out — please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
