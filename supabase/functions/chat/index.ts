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
  return /\b(comer|cenar|almorzar|desayunar|brunch|restaurante|restaurantes|tapas|tapear|bar|bares|cafe|cafeteria|postre|postres|tomar algo|beber|copa|copas|cocktail|coctel|cerveza|vino|hamburguesa|hamburguesas|hamburgueseria|burger|pizza|pizzas|pizzeria|arro(z|ces)|marisco|pescado|menu|menú|italiano|italiana|japones|japonesa|asiatico|asiatica|vegano|vegana|saludable|kebab|kebap|doner|döner|shawarma|durum|montadit(o|os)|bocadill(o|os)|bocat(a|as)|pollo|pollos|kfc|popeyes|mexicano|mexicana|tacos|burritos|taco bell|comida rapida|comida rápida|fast food|cadena|cadenas|mcdonalds|mac donalds|burger king|telepizza|domino|dominos|pizza hut|tgb|goiko|five guys|fosters hollywood|carls jr|100 montaditos|cien montaditos|lizarran|lizarrán)\b/.test(
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

type FastFoodSub = "kebab" | "burger" | "chain" | "pizza" | "montaditos" | "chicken" | "mexican" | "all" | null;

function detectFastFoodSub(text: string): FastFoodSub {
  const t = normalized(text);
  const isFastFood = /\b(comida rapida|fast ?food|comer rapido|algo rapido|para llevar|takeaway|take away)\b/.test(t);
  const isKebab = /\b(kebab|d[oö]ner|kebap|shawarma|durum|d[uü]rum|turco)\b/.test(t);
  const isMontaditos = /\b(montadit[oa]s?|100 montaditos|cien montaditos|lizarran|lizarrán|bocadillos?|bocatas?)\b/.test(t);
  const isChicken = /\b(pollo frito|pollos? asados?|fried chicken|kfc|popeyes|alitas|wings|asador de pollos?)\b/.test(t);
  const isMexican = /\b(mexicano|mexicana|tacos?|burritos?|taco bell|tex ?mex|nachos|quesadilla)\b/.test(t);
  const isBurger = /\b(hamburguesa|hamburguesas|burger|burgers|smash|smashburger|mcdonalds?|mac ?donalds?|burger ?king|tgb|the good burger|goiko|five guys|fosters? hollywood|carls? jr)\b/.test(t);
  const isChain = /\b(cadena|cadenas)\b/.test(t);
  const isPizza = /\b(pizza|pizzas|pizzeria|pizzería|telepizza|dominos?|papa johns?)\b/.test(t);
  const isHotDog = /\b(perrito|hot ?dog|frankfurt)\b/.test(t);
  if (isKebab) return "kebab";
  if (isMontaditos) return "montaditos";
  if (isChicken) return "chicken";
  if (isMexican) return "mexican";
  if (isChain) return "chain";
  if (isBurger) return "burger";
  if (isPizza) return "pizza";
  if (isHotDog) return "all";
  if (isFastFood) return "all";
  return null;
}

const CHAIN_NAMES = /\b(mcdonalds?|mac ?donalds?|kfc|burger ?king|tgb|the good burger|100 montaditos|cien montaditos|telepizza|dominos|popeyes|five guys|goiko|carls? jr|subway|taco bell|starbucks|llaollao|foster ?s? hollywood)\b/;

function matchesFoodPreference(place: FoodPlace, latestText: string) {
  const text = normalized(latestText);
  const haystack = normalized(`${place.name} ${place.kind} ${place.cuisine ?? ""}`);

  // "Tomar algo / beber / copas" → SOLO bares, pubs, cervecerías, vinotecas, discotecas.
  if (/\b(tomar algo|beber|copa|copas|cocktail|coctel|cerveza|cervezas|cerveceria|vino|vinos|vinoteca|pub|pubs|discoteca|disco|club|clubs|bar|bares|terraceo|terraza)\b/.test(text)) {
    const isDrinkSpot = /\b(bar|pub|wine_bar|wine|cocktail|brewery|biergarten|nightclub|night_club|cerveceria|vinoteca|taberna|coctel)\b/.test(haystack);
    const isFoodOnly = /\b(restaurant|kebab|pizza|pasta|burger|hamburger|fast_food|ice_cream|bakery|cafe|coffee|sushi|sandwich|donut|heladeria|panaderia|cafeteria)\b/.test(haystack)
      && !isDrinkSpot;
    return isDrinkSpot && !isFoodOnly;
  }

  // Comida rápida con submenú: kebab / burger / cadenas / pizza / todo.
  const sub = detectFastFoodSub(text);
  if (sub) {
    const isFastAny = /\b(fast_food|burger|hamburger|kebab|turkish|pizza|sandwich|chicken|fried_chicken|hot_dog|food_court|doner)\b/.test(haystack)
      || CHAIN_NAMES.test(haystack);
    if (sub === "kebab") return /\b(kebab|turkish|doner|shawarma)\b/.test(haystack);
    if (sub === "burger") return /\b(burger|hamburger|smash|mcdonald|burger ?king|tgb|good burger|goiko|five guys|foster|carls? jr)\b/.test(haystack);
    if (sub === "pizza") return /\b(pizza|italian|telepizza|domino|papa john)\b/.test(haystack);
    if (sub === "montaditos") return /\b(montadit|lizarran|bocadill|sandwich|100 montaditos|cien montaditos)\b/.test(haystack);
    if (sub === "chicken") return /\b(kfc|popeyes|pollo|chicken|fried_chicken|asador|alitas|wings)\b/.test(haystack);
    if (sub === "mexican") return /\b(mexican|taco|burrito|tex.?mex|nachos|quesadilla|taco bell)\b/.test(haystack);
    if (sub === "chain") return CHAIN_NAMES.test(haystack);
    return isFastAny;
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

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const VIBE_POOLS: { rx: RegExp; lines: string[] }[] = [
  { rx: /pizza|italian|pasta/, lines: [
    "Masa fina y mozzarella derritiéndose, un peligro 🍕",
    "Aquí la pizza no se dobla, se reza 🙏🍕",
    "Pasta como la nonna, pero con vistas a Alicante 🇮🇹",
    "Si no repites porción, no eres humano 🍕😅",
  ] },
  { rx: /burger|hamburger|smash|mcdonald|burger ?king|tgb|goiko|five guys/, lines: [
    "Smash burger jugosa, prepárate para mancharte 🍔",
    "De esas hamburguesas que te hacen cerrar los ojos 🤤",
    "Pan brioche + queso fundido = amor verdadero 💛",
    "Patatas crujientes y servilletas a mansalva 🍟",
  ] },
  { rx: /kebab|doner|turkish|shawarma/, lines: [
    "El kebab salvavidas de las 3am 🌯✨",
    "Carne asada al momento, salsita generosa 🔥",
    "Rápido, barato y te deja KO de feliz 🌯",
  ] },
  { rx: /sushi|japanese|asian|thai|chinese|korean/, lines: [
    "Sushi fresquito que se deshace en la boca 🍣",
    "Wok humeante y sabores que te teletransportan 🥢",
    "Picante nivel: '¿quién pidió esto?' 🌶️😂",
    "Ramen calentito, abrazo en cuenco 🍜",
  ] },
  { rx: /vegan|vegetarian|healthy|salad|juice/, lines: [
    "Verde, rico y te deja ligerito como pluma 🌱",
    "Healthy sin aburrir, ni te enteras 🥗✨",
    "Tu cuerpo te lo va a agradecer mañana 💚",
  ] },
  { rx: /cafe|coffee|bakery|pastry/, lines: [
    "Café que despierta hasta a los muertos ☕⚡",
    "Bollería casera, peligro nivel desayuno eterno 🥐",
    "Wifi, enchufe y latte art — oficina improvisada 💻☕",
  ] },
  { rx: /ice_cream|gelato|helader/, lines: [
    "Helado artesanal, el mejor amigo del calor alicantino 🍦☀️",
    "Bola doble obligatoria, tú decides los sabores 😋",
  ] },
  { rx: /seafood|paella|rice|spanish|mediterranean|regional|tapas/, lines: [
    "Paella con socarrat, como mandan los cánones 🥘",
    "Tapeo de los de toda la vida, ambiente top 🍤",
    "Pescaíto fresco del Mediterráneo, sin postureo 🐟",
    "Cocina de la abuela pero con mantel bonito 🥘❤️",
  ] },
  { rx: /bar|pub|cocktail|brewery|wine/, lines: [
    "Cañas frescas y conversación que se alarga 🍻",
    "Cocteles bien hechos, sin prisa pero sin pausa 🍹",
    "Para empezar la noche o no acabarla nunca 🌙🍺",
    "Vinos de la tierra y mucho rollo local 🍷",
  ] },
];

const VIBE_FALLBACK = [
  "Un sitio con buen rollo, no falla ✨",
  "De los que repites sin pensarlo dos veces 🙌",
  "Pequeño tesoro local, sin postureo 💎",
  "Ambiente top y la peña encantada 🔥",
  "De los que cuentas a tus colegas al volver 🗣️",
];

const URGENT_TAILS = [
  "¡Corre que cierra pronto! ⏰",
  "Pilla mesa antes de que cierren 🏃💨",
  "Última llamada, no te duermas 🛎️",
];

function vibeFor(place: FoodPlace, index = 0, used?: Set<string>): string {
  const h = normalized(`${place.kind} ${place.cuisine ?? ""} ${place.name}`);
  const seed = hashStr(place.name) + index * 7;
  const matched = VIBE_POOLS.filter((p) => p.rx.test(h));
  const pool = matched.length > 0 ? matched[seed % matched.length].lines : VIBE_FALLBACK;
  let base = pool[seed % pool.length];
  if (used) {
    let attempts = 0;
    while (used.has(base) && attempts < pool.length) {
      base = pool[(seed + ++attempts) % pool.length];
    }
    // If still colliding, fall back to fallback pool with offset
    if (used.has(base)) {
      for (let i = 0; i < VIBE_FALLBACK.length; i++) {
        const cand = VIBE_FALLBACK[(seed + i) % VIBE_FALLBACK.length];
        if (!used.has(cand)) { base = cand; break; }
      }
    }
    used.add(base);
  }
  if (place.closesInMinutes <= 60) {
    return `${base} · ${URGENT_TAILS[seed % URGENT_TAILS.length]}`;
  }
  return base;
}

const THEMES = ["sun", "sea", "citrus", "rose", "mint", "grape"] as const;

function formatFoodPlace(place: FoodPlace, index = 0, usedVibes?: Set<string>) {
  const seed = hashStr(place.name);
  const card = {
    name: place.name,
    cuisine: place.cuisine ?? null,
    address: place.address ?? null,
    closesAt: place.closesAt,
    lat: place.lat,
    lon: place.lon,
    vibe: vibeFor(place, index, usedVibes),
    theme: THEMES[(seed + index) % THEMES.length],
  };
  return `[[card:${encodeURIComponent(JSON.stringify(card))}]]`;
}

function buildMentionedPlacesResponse(mentionedPlaces: MentionedPlace[], openFoodPlaces: FoodPlace[]) {
  const lines: string[] = [];
  const usedVibes = new Set<string>();
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
      alternatives.forEach((alt, index) => lines.push(formatFoodPlace(alt, index + 1, usedVibes)));
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
  const selected = shuffle(candidates).slice(0, Math.max(maxOptions, 8));

  if (selected.length === 0) {
    return "Uy, ahora mismo no se me ocurre ningún sitio así que te pueda recomendar con la cabeza tranquila 😅 ¿Probamos cambiando de zona o de tipo de comida?";
  }

  const sub = detectFastFoodSub(latestUserText);
  const intro = selected.length >= 3
    ? `¡Marchando! Aquí van ${selected.length} opciones que te van a encantar 😋`
    : selected.length === 2
      ? "¡Marchando! Te dejo estas 2 opciones que me encantan 😋"
      : "¡Marchando! Aquí va una opción que te va a encantar 😋";
  const outro = sub === "all"
    ? "¿Quieres que afine más? Dime: **kebab 🌯**, **hamburguesa 🍔**, **pizza 🍕** o **cadenas (McDonald's, KFC, BK, TGB, 100 Montaditos…) 🏪** 🙌"
    : candidates.length > selected.length
      ? "¿Quieres que te dé otra alternativa más? 🙌"
      : "¿Probamos con otra zona o tipo de comida para ampliar opciones? 🙌";
  const usedVibes = new Set<string>();
  return [
    intro,
    ...selected.map((place, index) => formatFoodPlace(place, index + 1, usedVibes)),
    outro,
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

// Multi-result Text Search — broadens coverage for specific cuisines/keywords
// (e.g. "hamburguesería", "kebab", "pizzería") that Nearby's type list misses.
async function googlePlacesSearchTextMany(
  query: string,
  center: { lat: number; lng: number },
  radius = 9000,
): Promise<GooglePlace[]> {
  const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return [];
  try {
    const res = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.regularOpeningHours,places.currentOpeningHours",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "es",
        regionCode: "ES",
        maxResultCount: 20,
        locationBias: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius,
          },
        },
      }),
    });
    if (!res.ok) {
      console.error("Google Places searchTextMany failed", query, res.status, await res.text());
      return [];
    }
    const json = await res.json();
    return (json.places ?? []) as GooglePlace[];
  } catch (e) {
    console.error("Google Places searchTextMany error:", query, e);
    return [];
  }
}

function fastFoodSubQueries(sub: FastFoodSub): string[] {
  if (sub === "burger")
    return ["hamburguesería", "burger", "smash burger", "McDonald's", "Burger King", "TGB", "Goiko", "Five Guys", "Foster's Hollywood", "Carl's Jr"];
  if (sub === "kebab") return ["kebab", "döner", "shawarma"];
  if (sub === "pizza")
    return ["pizzería", "pizza", "Telepizza", "Domino's Pizza", "Papa John's"];
  if (sub === "montaditos")
    return ["100 Montaditos", "Lizarrán", "montaditos", "bocadillos"];
  if (sub === "chicken")
    return ["KFC", "Popeyes", "pollo frito", "pollos asados", "asador de pollos", "alitas"];
  if (sub === "mexican")
    return ["Taco Bell", "restaurante mexicano", "tacos", "burritos", "tex mex"];
  if (sub === "chain")
    return ["McDonald's", "KFC", "Burger King", "TGB", "100 Montaditos", "Telepizza", "Domino's", "Five Guys", "Goiko", "Popeyes", "Foster's Hollywood", "Taco Bell", "Lizarrán"];
  if (sub === "all") return ["comida rápida", "hamburguesería", "kebab", "pizzería"];
  return [];
}

function detectCuisineQueries(text: string): string[] {
  const t = normalized(text);
  const out: string[] = [];
  if (/\b(italiano|italiana|pasta)\b/.test(t)) out.push("restaurante italiano", "trattoria");
  if (/\b(japones|japonesa|sushi)\b/.test(t)) out.push("restaurante japonés", "sushi");
  if (/\b(asiatico|asiatica|chino|china|tailandes|tailandesa|vietnamita|coreano|coreana)\b/.test(t))
    out.push("restaurante asiático", "wok");
  if (/\b(vegano|vegana|vegetariano|vegetariana|saludable)\b/.test(t)) out.push("restaurante vegano", "vegetariano");
  if (/\b(arroz|arroces|paella|marisco|marisqueria)\b/.test(t)) out.push("arrocería", "marisquería", "paella");
  if (/\b(brunch|desayuno)\b/.test(t)) out.push("brunch", "desayunos");
  return out;
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

async function fetchConfirmedOpenFoodPlaces(
  context?: ChatContext,
  latestText = "",
): Promise<FoodPlace[]> {
  const loc = context?.location;
  const center =
    typeof loc?.lat === "number" && typeof loc?.lng === "number"
      ? { lat: loc.lat, lng: loc.lng }
      : ALICANTE_CENTER;
  const radius = loc ? 9000 : 12000;

  // 1) PRIMARY: Google Places — Nearby + targeted Text Searches.
  const nowDate = new Date();
  const sub = detectFastFoodSub(latestText);
  const extraQueries = [...fastFoodSubQueries(sub), ...detectCuisineQueries(latestText)];
  const [nearby, ...textGroups] = await Promise.all([
    googlePlacesNearbyFood(center, radius),
    ...extraQueries.map((q) => googlePlacesSearchTextMany(q, center, radius)),
  ]);
  const gPlaces: GooglePlace[] = [...nearby];
  const mergedSeen = new Set<string>(
    nearby.map((p) => (p as { id?: string }).id ?? `${p.displayName?.text}|${p.location?.latitude}|${p.location?.longitude}`),
  );
  for (const list of textGroups) {
    for (const p of list) {
      const id = (p as { id?: string }).id ?? `${p.displayName?.text}|${p.location?.latitude}|${p.location?.longitude}`;
      if (mergedSeen.has(id)) continue;
      mergedSeen.add(id);
      gPlaces.push(p);
    }
  }
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
      if (!closes || closes.closesInMinutes <= 30) continue;
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
        if (!open || open.closesInMinutes <= 30) continue;
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

const SYSTEM_PROMPT = `Eres "Alicante Friend", un/a alicantino/a de 28 años, nacido y criado en Alicante. Hablas con naturalidad, eres simpático, directo, algo sarcástico y muy auténtico. Mezclas español e inglés de forma natural, como hacen los locales bilingües de la zona.

Tu personalidad: hablas como un amigo local que está ayudando a otro amigo que viene de visita. Usas expresiones como "tío/a", "hostia", "flipar", "brutal", "de puta madre", "esto es otro nivel", pero sin exagerar ni sonar forzado.

Reglas OBLIGATORIAS:
- Nunca suenes como un guía turístico formal o robot. Sé conversacional y cercano.
- Prioriza siempre recomendaciones de locales por encima de lo típico turístico. Solo menciona Postiguet, Explanada, Castillo de Santa Bárbara o San Juan si el usuario lo pide explícitamente o es su primera vez.
- Sé muy honesto: si algo está sobrevalorado, es caro para lo que ofrece o es muy turístico, dilo sin miedo.
- Adapta todas las recomendaciones al contexto del usuario: presupuesto, número de personas (solo, pareja, amigos, familia), humor, clima actual, preferencias (fiesta, relax, cultura, comida, playa...).
- Incluye siempre detalles prácticos útiles: precios aproximados 2026, mejor hora, cómo llegar, si hace falta reservar, trucos de local (aparcamiento, evitar colas, etc.).
- Cuando recomiendes, da 1 opción principal + 1-2 alternativas (una más conocida y una más hidden gem).

Conocimiento actualizado 2026:
- Conoces muy bien la ciudad y provincia de Alicante.
- Recomendaciones de comida locales reales: Ñora y Ají, La Taberna del Racó del Pla, Govana, L'Arruz, Gravina 4, Nou Manolín (clásico), Manero, Pelego, Tabula Rasa, etc. Sé exigente y honesto.
- Playas locales: Albufereta, Cabo de las Huertas (Almadraba, Cala del Carritxal), Urbanova, playas del Campello, calas más escondidas (Moraig, Tío Ximo, etc.).
- Noche: Tardeo en Castaños y Mercado Central, El Barrio (Santa Cruz), Labradores, Marina para clubs.
- Day trips: Altea, Villajoyosa (casas de colores), Guadalest, Elche (palmeral), Calpe, Santa Pola + Tabarca, interior (Relleu, Novelda, etc.).

Estructura ideal de respuestas (intégralo de forma natural, no como lista rígida):
1. Saludo / empatía breve y cercano.
2. Recomendación principal + por qué te mola como local.
3. Detalles prácticos importantes.
4. Alternativa(s): una más conocida y una hidden gem.
5. Pregunta para continuar la conversación y conocer mejor al usuario.

Memoria: Recuerda las preferencias del usuario durante toda la conversación (presupuesto, gustos, si tiene coche, etc.).
Si no estás 100% seguro de algo (horarios exactos, precios), di "según la última vez que fui..." o da aproximados.
Nunca des consejos ilegales, peligrosos o poco seguros. Mantén un tono positivo pero realista.

---

REGLA IMPORTANTE: Pizza Hut ya NO existe en España. NUNCA lo recomiendes ni lo menciones.

SISTEMA DE PUNTOS (Alicante Friend Points / AFP) — VERSIÓN BETA: La app está en Beta, así que los puntos y estadísticas que se generan ahora son DE PRUEBA. Cuando el usuario pregunte por puntos, recompensas, descuentos o qué puede hacer con los AFP, responde con honestidad algo como: "Estamos en versión Beta, así que los puntos ahora son de prueba. Cuando lancemos la Versión 1 los puntos serán reales y podrás canjearlos por descuentos y beneficios en locales partners 🔥". Aun así, anímalo a testear el sistema: generar QR de referral (+20, +80 si el local lo confirma), completar itinerarios (+40), dejar reseñas (+35), racha diaria (+25, máx 100/semana) e invitar amigos (+150). Niveles: Alicante Friend (0-600) → Local Insider (601-2000) → Alicante Legend (2001-4500) → Alicante VIP (+4501).

You are "Alicante Friend", a warm, caring local companion living in Alicante, Spain.
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
- Open Wash — self-service laundromat (lavadero/lavandería de autoservicio) at Calle Teulada 25, Alicante. Open every day from 8:30 to 23:00, 365 days a year. Use [[place: Open Wash]] when recommending it.

(transporte público — ver bloque TRANSPORTE PÚBLICO URBANO al final del prompt)

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
- Si el usuario pregunta "¿qué opinan los demás?" o "¿tiene buenas reseñas?", responde con tu impresión sincera en 1-2 frases y vuelve a darle el enlace para que las lea él mismo.

QUIERO IR (CRÍTICO):
- INMEDIATAMENTE después de cada enlace de reseñas (sea de un sitio mencionado por el usuario o de una recomendación tuya), añade siempre, en la MISMA línea separado por " · ", un enlace EXACTO con este formato: [🎟️ Quiero ir](qi:NOMBRE+DEL+SITIO) — el esquema es \`qi:\` (no http), y los espacios del nombre van como '+'. Ejemplo: [⭐ ver reseñas](https://www.google.com/maps/search/?api=1&query=El+Portal+Alicante) · [🎟️ Quiero ir](qi:El+Portal)
- NO añadas Quiero ir a sitios públicos sin reseñas (playas, monumentos). Solo a locales reales (bares, restaurantes, hoteles, tiendas, clubs, cafeterías).
- NO expliques qué es Quiero ir, solo añade el botón. Si el usuario pregunta, dile que genera un QR único intransferible, válido solo ese día, y que solo da puntos cuando el local lo valida en sitio (en Beta los puntos son demo).

TRANSPORTE PÚBLICO URBANO (BUS / TRAM):
- **PRIORIDAD ABSOLUTA**: si hay VECTALIA_TRIPS en el contexto, ÚSALO como única verdad. Es la red oficial de Vectalia (líneas, sentidos, nombres y códigos de parada exactos). Ignora TRANSIT_RESULT salvo que VECTALIA_TRIPS esté vacío.
- Lista corta: línea + parada subida + parada bajada. Una línea por opción, sin adornos.
- **SIEMPRE**, sin que el usuario lo pida, incluye el enlace al esquema de la línea con formato [📍 Ver esquema línea X](/bus/lines/X) usando el código exacto. Si hay transbordo, añade ambos esquemas.
- Si VECTALIA_TRIPS trae qr_subida=XXXX (es el código de parada), añade 🕒 [tiempo real QR](https://qr.vectalia.es/Alicante/consulta.aspx?p=XXXX). No pidas el código al usuario.
- Si no hay qr_subida y el usuario te da explícitamente un código de parada de 3-5 dígitos, dale el enlace directo: 🕒 [Próximos buses parada XXXX](https://qr.vectalia.es/Alicante/consulta.aspx?p=XXXX).
- Si VECTALIA_TRIPS y TRANSIT_RESULT.options están vacíos: dilo en una frase y pide destino o código de parada más concreto.
- **NUNCA inventes** números de línea, códigos de parada ni nombres de parada. Si no aparece en VECTALIA_TRIPS ni en TRANSIT_RESULT, no existe.`;

// ──────────────────────────────────────────────────────────────────────
// TRANSIT (Vectalia bus / TRAM via OpenStreetMap Overpass)
// ──────────────────────────────────────────────────────────────────────

type LatLng = { lat: number; lng: number };
type TransitStop = {
  id: number;
  name: string;
  ref: string | null; // OSM stop ref; not trusted as Vectalia QR code
  qrCode?: string | null; // fixed Vectalia QR stop code resolved from public GTFS mirrors when possible
  lat: number;
  lng: number;
  distMeters: number;
};
type TransitOption = {
  line: string;
  lineName: string;
  network?: string;
  board: TransitStop;
  alight: TransitStop;
  stopsBetween: number;
};
type TransitResult = {
  searched: true;
  origin: LatLng & { label?: string };
  destination: LatLng & { label: string };
  options: TransitOption[];
};

function detectTransitIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(bus|autob[uú]s|tram|guagua|l[ií]nea\s*\d|transporte\s+p[uú]blico|c[oó]mo\s+(voy|llego|ir)|qu[eé]\s+l[ií]nea|en\s+bus|en\s+autob[uú]s)\b/.test(
    t,
  );
}

function extractTransitDestination(text: string): string | null {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[¿?¡!]/g, "")
    .trim();
  // Patterns ordered by specificity
  const patterns = [
    /\b(?:c[oó]mo\s+(?:voy|llego|ir)|qu[eé]\s+l[ií]nea\s+(?:me\s+lleva\s+)?)(?:en\s+bus\s+|en\s+autob[uú]s\s+|en\s+tram\s+)?(?:a|al|hasta|hacia|para|para\s+ir\s+a)\s+(.+?)(?:\s+desde\s+.+)?$/i,
    /\b(?:en\s+bus|en\s+autob[uú]s|en\s+tram)\s+(?:a|al|hasta|hacia)\s+(.+?)(?:\s+desde\s+.+)?$/i,
    /\b(?:a|al|hasta|hacia)\s+(.+?)\s+en\s+(?:bus|autob[uú]s|tram)\b/i,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1]) {
      const dest = m[1]
        .replace(/^(la|el|los|las)\s+/i, "")
        .replace(/[.,;:]+$/, "")
        .trim();
      if (dest.length >= 3 && dest.length < 120) return dest;
    }
  }
  return null;
}

function extractTransitOrigin(text: string): string | null {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/[¿?¡!]/g, "")
    .trim();
  const patterns = [
    /\b(?:estoy\s+(?:en|por|ahora\s+en)|me\s+encuentro\s+en|salgo\s+desde|salgo\s+de|desde)\s+(?:la\s+|el\s+|los\s+|las\s+)?(.+?)(?:\s+(?:y\s+quiero|y\s+voy|hasta|hacia|al?|para|en\s+bus|en\s+autob[uú]s|en\s+tram|\.|,|;).*)?$/i,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (m && m[1]) {
      const o = m[1].replace(/[.,;:]+$/, "").trim();
      if (o.length >= 3 && o.length < 120) return o;
    }
  }
  return null;
}

async function geocodeAlicante(query: string): Promise<(LatLng & { label: string }) | null> {
  // Bias hard to Alicante province via viewbox
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", `${query}, Alicante`);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "es");
  url.searchParams.set("viewbox", "-0.65,38.45,-0.30,38.20"); // lon_min,lat_max,lon_max,lat_min
  url.searchParams.set("bounded", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "AlicanteFriend/1.0 (contact via lovable.app)" },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!arr.length) return null;
    return {
      lat: Number(arr[0].lat),
      lng: Number(arr[0].lon),
      label: arr[0].display_name.split(",").slice(0, 2).join(",").trim(),
    };
  } catch {
    return null;
  }
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

type BusMapsStop = {
  countryUrl?: string;
  stopHash1?: string;
  stopName?: string;
  urlStopName?: string;
  stopTypeGroup?: string;
  city500Name?: string;
  stopLat?: number;
  stopLon?: number;
  routeNames?: string;
};

const vectaliaQrCache = new Map<string, string | null>();

function normalizeLineToken(value: string): string {
  const raw = value.toUpperCase().replace(/\s+/g, "").replace(/^LINEA/, "").replace(/^L(?=\d)/, "");
  const m = raw.match(/^(\d+)([A-Z]*)$/);
  if (!m) return raw;
  return `${Number(m[1])}${m[2]}`;
}

function routeNamesMatchLine(routeNames: string | undefined, line: string): boolean {
  const target = normalizeLineToken(line);
  return (routeNames ?? "")
    .split(/[\s,;/]+/)
    .map(normalizeLineToken)
    .some((token) => token === target);
}

async function fetchBusMapsStopCode(stop: TransitStop, line: string): Promise<string | null> {
  const cacheKey = `${stop.name}|${stop.lat.toFixed(5)},${stop.lng.toFixed(5)}|${normalizeLineToken(line)}`;
  if (vectaliaQrCache.has(cacheKey)) return vectaliaQrCache.get(cacheKey)!;

  try {
    const url = new URL("https://api.busmaps.com/api/v3/autosuggest");
    url.searchParams.set("q", stop.name);
    url.searchParams.set("results", "stops");
    url.searchParams.set("location", `${stop.lat},${stop.lng}`);
    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        Origin: "https://busmaps.com",
        Referer: "https://busmaps.com/",
        "User-Agent": "AlicanteFriend/1.0",
      },
    });
    if (!res.ok) throw new Error(`BusMaps autosuggest ${res.status}`);
    const json = (await res.json()) as { stops?: BusMapsStop[] };
    const candidates = (json.stops ?? [])
      .filter((s) => s.stopHash1 && s.urlStopName && s.stopTypeGroup === "bus" && s.city500Name === "Alicante")
      .map((s) => ({
        stop: s,
        meters: haversineMeters(stop, { lat: Number(s.stopLat), lng: Number(s.stopLon) }),
        lineMatch: routeNamesMatchLine(s.routeNames, line),
      }))
      .filter((s) => Number.isFinite(s.meters) && s.meters <= 140)
      .sort((a, b) => (a.lineMatch === b.lineMatch ? a.meters - b.meters : a.lineMatch ? -1 : 1));

    for (const candidate of candidates.slice(0, 3)) {
      const country = candidate.stop.countryUrl ?? "spain";
      const pageUrl = `https://busmaps.com/en/${country}/public_transit-stop-${encodeURIComponent(candidate.stop.urlStopName!)}-${candidate.stop.stopHash1}`;
      const page = await fetch(pageUrl, { headers: { "User-Agent": "AlicanteFriend/1.0" } });
      if (!page.ok) continue;
      const html = await page.text();
      const code = html.match(/"identifier"\s*:\s*"(\d{1,5})"/)?.[1] ?? null;
      if (code) {
        vectaliaQrCache.set(cacheKey, code);
        return code;
      }
    }
  } catch (e) {
    console.error("Vectalia QR resolve error:", e);
  }

  vectaliaQrCache.set(cacheKey, null);
  return null;
}

async function fetchBusOptions(
  origin: LatLng,
  destination: LatLng & { label: string },
): Promise<TransitOption[]> {
  const RADIUS_M = 500;
  const q = `[out:json][timeout:30];
(
  node["highway"="bus_stop"](around:${RADIUS_M},${origin.lat},${origin.lng});
  node["public_transport"="platform"]["bus"!="no"](around:${RADIUS_M},${origin.lat},${origin.lng});
)->.os;
(
  node["highway"="bus_stop"](around:${RADIUS_M},${destination.lat},${destination.lng});
  node["public_transport"="platform"]["bus"!="no"](around:${RADIUS_M},${destination.lat},${destination.lng});
)->.ds;
.os out tags;
.ds out tags;
(
  rel(bn.os)["type"="route"]["route"~"^(bus|tram)$"];
  rel(bn.ds)["type"="route"]["route"~"^(bus|tram)$"];
)->.routes;
.routes out body;`;

  type OverpassNode = {
    type: "node";
    id: number;
    lat: number;
    lon: number;
    tags?: Record<string, string>;
  };
  type OverpassRelation = {
    type: "relation";
    id: number;
    tags?: Record<string, string>;
    members: Array<{ type: string; ref: number; role: string }>;
  };
  type OverpassEl = OverpassNode | OverpassRelation;

  let json: { elements: OverpassEl[] } | null = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
      });
      if (!res.ok) continue;
      json = await res.json();
      if (json) break;
    } catch (e) {
      console.error("Overpass transit error:", e);
    }
  }
  if (!json) return [];

  const nodes = new Map<number, OverpassNode>();
  const rels: OverpassRelation[] = [];
  for (const el of json.elements) {
    if (el.type === "node") nodes.set(el.id, el);
    else if (el.type === "relation") rels.push(el);
  }

  // Build origin/destination stop sets by distance (only nodes that are within radius)
  const originStops = new Map<number, TransitStop>();
  const destStops = new Map<number, TransitStop>();
  for (const n of nodes.values()) {
    const tags = n.tags ?? {};
    const isStop =
      tags["highway"] === "bus_stop" ||
      (tags["public_transport"] === "platform" && tags["bus"] !== "no");
    if (!isStop) continue;
    const stop: TransitStop = {
      id: n.id,
      name: tags["name"] ?? "Parada sin nombre",
      ref: tags["ref"] ?? tags["ref:vectalia"] ?? null,
      lat: n.lat,
      lng: n.lon,
      distMeters: 0,
    };
    const dO = haversineMeters(origin, { lat: n.lat, lng: n.lon });
    const dD = haversineMeters(destination, { lat: n.lat, lng: n.lon });
    if (dO <= RADIUS_M) originStops.set(n.id, { ...stop, distMeters: Math.round(dO) });
    if (dD <= RADIUS_M) destStops.set(n.id, { ...stop, distMeters: Math.round(dD) });
  }

  const options: TransitOption[] = [];
  const seenLines = new Set<string>();

  for (const rel of rels) {
    const tags = rel.tags ?? {};
    const lineRef = (tags["ref"] ?? tags["name"] ?? "").trim();
    if (!lineRef) continue;
    const memberStopIds = rel.members
      .filter((m) => m.type === "node" && (m.role === "stop" || m.role === "platform" || m.role === ""))
      .map((m) => m.ref);

    let boardIdx = -1;
    let board: TransitStop | null = null;
    let alightIdx = -1;
    let alight: TransitStop | null = null;
    for (let i = 0; i < memberStopIds.length; i++) {
      const id = memberStopIds[i];
      if (boardIdx === -1 && originStops.has(id)) {
        boardIdx = i;
        board = originStops.get(id)!;
      } else if (board && destStops.has(id) && i > boardIdx) {
        alightIdx = i;
        alight = destStops.get(id)!;
        break;
      }
    }
    if (!board || !alight || alightIdx <= boardIdx) continue;

    const dedupKey = `${lineRef}|${board.id}|${alight.id}`;
    if (seenLines.has(dedupKey)) continue;
    seenLines.add(dedupKey);

    options.push({
      line: lineRef,
      lineName: tags["name"] ?? lineRef,
      network: tags["network"] ?? tags["operator"],
      board,
      alight,
      stopsBetween: alightIdx - boardIdx,
    });
  }

  // Best options: shortest walking distance to board + fewest stops
  options.sort(
    (a, b) =>
      a.board.distMeters + a.alight.distMeters + a.stopsBetween * 5 -
      (b.board.distMeters + b.alight.distMeters + b.stopsBetween * 5),
  );

  // Dedup by line keeping best
  const byLine = new Map<string, TransitOption>();
  for (const o of options) {
    if (!byLine.has(o.line)) byLine.set(o.line, o);
  }
  const best = [...byLine.values()].slice(0, 4);
  await Promise.all(
    best.map(async (o) => {
      o.board.qrCode = await fetchBusMapsStopCode(o.board, o.line);
    }),
  );
  return best;
}

async function buildTransitResult(
  origin: LatLng | null,
  text: string,
  opts?: { force?: boolean },
): Promise<TransitResult | null> {
  if (!origin || (!opts?.force && !detectTransitIntent(text))) return null;
  const destText = extractTransitDestination(text);
  if (!destText) return null;
  const dest = await geocodeAlicante(destText);
  if (!dest) {
    return {
      searched: true,
      origin,
      destination: { lat: 0, lng: 0, label: destText },
      options: [],
    };
  }
  const options = await fetchBusOptions(origin, dest);
  return { searched: true, origin, destination: dest, options };
}

// ──────────────────────────────────────────────────────────────────────
// VECTALIA TRIPS (DB oficial: bus_line_stops + bus_stops desde Supabase)
// ──────────────────────────────────────────────────────────────────────

type DbStop = { code: string; name: string | null; lat: number | null; lng: number | null };
type DbLineStop = {
  line_code: string;
  direction: number;
  seq: number;
  stop_code: string | null;
  stop_name: string;
};

let vectaliaCache: { stops: DbStop[]; lineStops: DbLineStop[]; loadedAt: number } | null = null;

async function loadVectaliaGraph() {
  if (vectaliaCache && Date.now() - vectaliaCache.loadedAt < 10 * 60 * 1000) return vectaliaCache;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const [sRes, lRes] = await Promise.all([
      fetch(`${url}/rest/v1/bus_stops?select=code,name,lat,lng&limit=10000`, { headers }),
      fetch(
        `${url}/rest/v1/bus_line_stops?select=line_code,direction,seq,stop_code,stop_name&limit=20000`,
        { headers },
      ),
    ]);
    if (!sRes.ok || !lRes.ok) return null;
    vectaliaCache = {
      stops: (await sRes.json()) as DbStop[],
      lineStops: (await lRes.json()) as DbLineStop[],
      loadedAt: Date.now(),
    };
    return vectaliaCache;
  } catch (e) {
    console.error("loadVectaliaGraph error:", e);
    return null;
  }
}

function normTxt(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchStops(query: string, stops: DbStop[], coords: LatLng | null): DbStop[] {
  const q = normTxt(query);
  if (!q) return [];
  const tokens = q.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return [];
  return stops
    .map((s) => {
      const name = normTxt(s.name ?? "");
      if (!name) return { s, score: 0 };
      let score = 0;
      const nameTokens = name.split(" ");
      for (const t of tokens) {
        if (nameTokens.includes(t)) score += t.length + 2;
        else if (name.includes(t)) score += t.length;
      }
      if (name === q) score += 30;
      if (coords && s.lat != null && s.lng != null) {
        const d = haversineMeters(coords, { lat: s.lat, lng: s.lng });
        if (d < 700) score += 6;
      }
      return { s, score };
    })
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.s);
}

type VLeg = {
  lineCode: string;
  direction: number;
  fromCode: string;
  fromName: string;
  toCode: string;
  toName: string;
  numStops: number;
  lineKey: string;
  fromIdx: number;
  toIdx: number;
  km?: number;
  estMin?: number;
  etaMin?: number;
};
type VTrip = { legs: VLeg[]; totalStops: number; transfers: number };

function findVTrips(lineStops: DbLineStop[], oCode: string, dCode: string): VTrip[] {
  if (!oCode || !dCode || oCode === dCode) return [];
  const byLine = new Map<string, DbLineStop[]>();
  const byStop = new Map<string, { key: string; idx: number }[]>();
  for (const s of lineStops) {
    const k = `${s.line_code}|${s.direction}`;
    if (!byLine.has(k)) byLine.set(k, []);
    byLine.get(k)!.push(s);
  }
  for (const [k, list] of byLine) {
    list.sort((a, b) => a.seq - b.seq);
    list.forEach((s, idx) => {
      if (!s.stop_code) return;
      if (!byStop.has(s.stop_code)) byStop.set(s.stop_code, []);
      byStop.get(s.stop_code)!.push({ key: k, idx });
    });
  }
  const trips: VTrip[] = [];
  const oAt = byStop.get(oCode) ?? [];
  const dAt = byStop.get(dCode) ?? [];
  if (!oAt.length || !dAt.length) return [];
  const dIdx = new Map<string, number>();
  for (const d of dAt) dIdx.set(d.key, d.idx);
  const direct = new Set<string>();
  for (const o of oAt) {
    const di = dIdx.get(o.key);
    if (di != null && di > o.idx) {
      const list = byLine.get(o.key)!;
      const a = list[o.idx], b = list[di];
      trips.push({
        legs: [{
          lineCode: a.line_code, direction: a.direction,
          fromCode: a.stop_code!, fromName: a.stop_name,
          toCode: b.stop_code!, toName: b.stop_name,
          numStops: di - o.idx,
          lineKey: o.key, fromIdx: o.idx, toIdx: di,
        }],
        totalStops: di - o.idx, transfers: 0,
      });
      direct.add(o.key);
    }
  }
  for (const o of oAt) {
    if (direct.has(o.key)) continue;
    const listA = byLine.get(o.key)!;
    const maxA = Math.min(listA.length, o.idx + 31);
    for (let i = o.idx + 1; i < maxA; i++) {
      const tr = listA[i];
      if (!tr.stop_code) continue;
      const trAt = byStop.get(tr.stop_code);
      if (!trAt) continue;
      for (const t of trAt) {
        if (t.key === o.key) continue;
        const di = dIdx.get(t.key);
        if (di != null && di > t.idx) {
          const listB = byLine.get(t.key)!;
          const a0 = listA[o.idx], a1 = listA[i], b0 = listB[t.idx], b1 = listB[di];
          trips.push({
            legs: [
              { lineCode: a0.line_code, direction: a0.direction, fromCode: a0.stop_code!, fromName: a0.stop_name, toCode: a1.stop_code!, toName: a1.stop_name, numStops: i - o.idx, lineKey: o.key, fromIdx: o.idx, toIdx: i },
              { lineCode: b0.line_code, direction: b0.direction, fromCode: b0.stop_code!, fromName: b0.stop_name, toCode: b1.stop_code!, toName: b1.stop_name, numStops: di - t.idx, lineKey: t.key, fromIdx: t.idx, toIdx: di },
            ],
            totalStops: (i - o.idx) + (di - t.idx),
            transfers: 1,
          });
        }
      }
    }
  }
  const seen = new Set<string>();
  const uniq = trips.filter((t) => {
    const sig = t.legs.map((l) => `${l.lineCode}|${l.direction}|${l.fromCode}|${l.toCode}`).join(">");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  uniq.sort((a, b) => a.transfers - b.transfers || a.totalStops - b.totalStops);
  return uniq.slice(0, 6);
}

async function buildVectaliaTransit(
  originText: string | null,
  destText: string | null,
  originCoords: LatLng | null,
): Promise<{ origin: DbStop; dest: DbStop; trips: VTrip[] }[] | null> {
  if (!destText) return null;
  const g = await loadVectaliaGraph();
  if (!g) return null;
  const dCands = matchStops(destText, g.stops, null);
  if (!dCands.length) return null;
  let oCands: DbStop[] = originText ? matchStops(originText, g.stops, originCoords) : [];
  if (!oCands.length && originCoords) {
    oCands = g.stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({ s, d: haversineMeters(originCoords, { lat: s.lat!, lng: s.lng! }) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3)
      .map((x) => x.s);
  }
  if (!oCands.length) return null;
  const all: { origin: DbStop; dest: DbStop; trips: VTrip[] }[] = [];
  for (const o of oCands) {
    for (const d of dCands) {
      if (o.code === d.code) continue;
      const trips = findVTrips(g.lineStops, o.code, d.code);
      if (trips.length) all.push({ origin: o, dest: d, trips });
    }
  }
  if (!all.length) return null;
  all.sort((a, b) => {
    const ta = a.trips[0], tb = b.trips[0];
    return ta.transfers - tb.transfers || ta.totalStops - tb.totalStops;
  });
  return all.slice(0, 3);
}

function formatVectaliaTransit(
  res: { origin: DbStop; dest: DbStop; trips: VTrip[] }[],
): string {
  const out: string[] = [
    "",
    "VECTALIA_TRIPS (FUENTE OFICIAL desde la red real de Vectalia — usa EXACTAMENTE estos códigos de línea, nombres y códigos de parada; NO inventes nada):",
  ];
  let n = 1;
  for (const r of res) {
    for (const t of r.trips.slice(0, 3)) {
      const legs = t.legs
        .map(
          (l) =>
            `Línea ${l.lineCode} (sentido ${l.direction}): sube en "${l.fromName}" [parada ${l.fromCode}] → bájate en "${l.toName}" [parada ${l.toCode}] · ${l.numStops} paradas · esquema=/bus/lines/${l.lineCode} · qr_subida=${l.fromCode}`,
        )
        .join("  ⇄ TRANSBORDO ⇄  ");
      out.push(`  ${n++}. ${legs}  | total=${t.totalStops} paradas, transbordos=${t.transfers}`);
      if (n > 8) break;
    }
    if (n > 8) break;
  }
  return out.join("\n");
}

function formatTransitResult(r: TransitResult): string {
  const head = `\nTRANSIT_RESULT (verdad para responder sobre bus/tram):\n  origin=${r.origin.lat.toFixed(5)},${r.origin.lng.toFixed(5)}\n  destination="${r.destination.label}" (${r.destination.lat.toFixed(5)},${r.destination.lng.toFixed(5)})\n  searched=true`;
  if (!r.options.length) {
    return head + "\n  options=[] (sin línea directa encontrada en OSM dentro de 500m)";
  }
  const lines = r.options
    .map((o, i) => {
      const qr = o.board.qrCode ? ` | qr_subida=${o.board.qrCode} | realtime=https://qr.vectalia.es/Alicante/consulta.aspx?p=${o.board.qrCode}` : " | qr_subida=no_resuelto";
      return `  ${i + 1}. línea=${o.line} (${o.lineName})${o.network ? ` red=${o.network}` : ""} | sube_en="${o.board.name}" (${o.board.distMeters}m a pie)${qr} | bájate_en="${o.alight.name}" (${o.alight.distMeters}m a pie) | paradas≈${o.stopsBetween}`;
    })
    .join("\n");
  return head + "\n" + lines + "\n  nota=qr_subida viene de un identificador público de parada si se pudo resolver; si qr_subida=no_resuelto, no inventes enlace ni pidas código salvo que el usuario quiera tiempo real exacto.";
}

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
    const transitMode = context?.mode === "transit";
    const foodRequest = !transitMode && isFoodOrDrinkRequest(messages);
    const mayNeedFoodFallbacks =
      !transitMode && (foodRequest || extractMentionedNames(latestUserText).length > 0);
    const [openFoodPlaces, mentionedPlaces] = await Promise.all([
      mayNeedFoodFallbacks
        ? fetchConfirmedOpenFoodPlaces(context, latestUserText)
        : Promise.resolve([] as FoodPlace[]),
      transitMode
        ? Promise.resolve([] as MentionedPlace[])
        : fetchMentionedPlaces(latestUserText).catch(() => [] as MentionedPlace[]),
    ]);
    if (!transitMode && mentionedPlaces.length > 0) {
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
    let userOriginForTransit: LatLng | null =
      loc && typeof loc.lat === "number" && typeof loc.lng === "number"
        ? { lat: loc.lat, lng: loc.lng }
        : null;
    const transitText = transitMode
      ? messages
          .filter((m: { role: string; content: string }) => m.role === "user")
          .slice(-4)
          .map((m: { content: string }) => m.content)
          .join(" \n ")
      : latestUserText;
    let originTextForTransit: string | null = null;
    const destTextForTransit = extractTransitDestination(transitText);
    if (transitMode || detectTransitIntent(transitText)) {
      originTextForTransit = extractTransitOrigin(transitText);
      if (originTextForTransit) {
        const g = await geocodeAlicante(originTextForTransit).catch(() => null);
        if (g) userOriginForTransit = { lat: g.lat, lng: g.lng };
      }
    }
    const [transitResult, vectaliaTrips] = await Promise.all([
      buildTransitResult(userOriginForTransit, transitText, { force: transitMode }).catch((err) => {
        console.error("transit lookup error:", err);
        return null;
      }),
      (transitMode || detectTransitIntent(transitText))
        ? buildVectaliaTransit(originTextForTransit, destTextForTransit, userOriginForTransit).catch(
            (err) => {
              console.error("vectalia lookup error:", err);
              return null;
            },
          )
        : Promise.resolve(null),
    ]);
    const transitLine = transitResult ? formatTransitResult(transitResult) : "";
    const vectaliaLine = vectaliaTrips ? formatVectaliaTransit(vectaliaTrips) : "";
    const transitModeLine = transitMode
      ? `\nTRANSIT_MODE: ON. Flujo "Bus/Tram urbano" de Alicante (TAM bus + TRAM).
ESTILO OBLIGATORIO en este modo:
- NO uses tarjetas [[card:...]]. NUNCA. Las tarjetas son solo para comida/bebida/sitios.
- Respuesta DIRECTA, telegráfica, sin saludos, sin "¡vamos!", sin emojis decorativos, sin paseos ni adornos.
- Máximo 3-5 líneas salvo que el usuario pida detalle.
- Solo transporte público. NO recomiendes restaurantes, bares, playas ni otros sitios.
- Si falta origen o destino: 1 pregunta corta y nada más.
- **PRIORIDAD ABSOLUTA**: si hay VECTALIA_TRIPS, USA EXACTAMENTE esa línea, ese sentido, esos nombres y esos códigos de parada. Es la red oficial de Vectalia. Ignora TRANSIT_RESULT (OSM) salvo que VECTALIA_TRIPS esté vacío.
- Con VECTALIA_TRIPS o TRANSIT_RESULT presente: línea + parada subida + parada bajada. Una línea por opción. Si aparece qr_subida=XXXX, incluye 🕒 [tiempo real QR](https://qr.vectalia.es/Alicante/consulta.aspx?p=XXXX) y NO pidas el código.
- **SIEMPRE, sin que el usuario lo pida**, añade el esquema de cada línea recomendada con el formato exacto [📍 Ver esquema línea X](/bus/lines/X) usando el código exacto. Si hay transbordo, añade el esquema de las dos líneas.
- IMPORTANTE sobre tiempo real: no inventes minutos. Si hay qr_subida, da el enlace fijo de esa parada.
- Si no hay resultado: dilo en una frase y pide código de parada o destino más concreto.
- NUNCA inventes líneas, códigos ni nombres de parada. Si no aparece en VECTALIA_TRIPS ni en TRANSIT_RESULT, NO EXISTE.`
      : "";
    const runtimeContext = `RUNTIME CONTEXT (use this when relevant):\nTODAY: ${todayStr} (zona horaria Europe/Madrid)\nMAX_NEARBY_OPTIONS: ${context?.maxOptions ?? 4}\n${locationLine}${transitModeLine}${verifiedOpenLine}${mentionedLine}${vectaliaLine}${transitLine}`;

    const gatewayBody = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${runtimeContext}` },
        ...messages,
      ],
      stream: true,
    };
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gatewayBody),
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
      return streamChatText(
        "Uy, el servicio de IA está fallando ahora mismo 😅 Inténtalo de nuevo en unos segundos.",
      );
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
