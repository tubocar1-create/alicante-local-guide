import { useEffect, useRef, useState, useCallback } from "react";
import {
  Sparkles,
  Send,
  X,
  Loader2,
  Mic,
  MicOff,
  Keyboard,
  Volume2,
  VolumeX,
  Pause,
  Play,
} from "lucide-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { agenteVamosChat } from "@/lib/agente.functions";
import {
  loadAgenteRoutingCatalog,
  type AgenteIntentRow,
  type AgenteRoutingCatalog,
  type AgenteSubcategory,
} from "@/lib/agente-intents.functions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const VOICE_ASSETS = import.meta.glob("../assets/agent-voice/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

// Local intent router — no AI provider needed. Maps keywords to a friendly
// reply + optional navigation. Keeps the agent fully responsive offline.
type VoiceClip =
  | "hotel"
  | "eat"
  | "beaches"
  | "beach_map"
  | "explore"
  | "bus"
  | "planner"
  | "flights"
  | "weather"
  | "cinema"
  | "theatre"
  | "concerts"
  | "leisure"
  | "fiestas"
  | "pharmacy"
  | "hospitals"
  | "health"
  | "profile"
  | "hello"
  | "thanks"
  | "fallback";
type GreetingClip = "greeting_morning" | "greeting_afternoon";
type AgentAudioClip = VoiceClip | GreetingClip;


// Arquitectura jerárquica de intents:
//   1. KEYS (exact concepts, alta confianza) → routing directo.
//   2. DOMAIN triggers (lenguaje natural ambiguo) → pregunta aclaratoria,
//      sin navegación; el dominio queda activo en `pendingDomainRef`.
//   3. CONTEXT phrases (lenguaje natural específico de UN intent concreto)
//      → routing si no había dominio.
// El follow-up usa el dominio activo para resolver palabras cortas
// ("hospital", "farmacia", "cine"…) al sub-destino correcto.
type IntentDef = {
  keys: string[];
  context?: string[];
  reply: string;
  path?: string;
  audio: VoiceClip;
};
const INTENTS: IntentDef[] = [
  {
    keys: [
      "tomar algo", "beber", "cerveza", "cervezas", "cerveceria", "copa", "copas",
      "pub", "discoteca", "bar de copas", "rooftop", "vino", "vinos", "coctel", "cocteles",
      "gin tonic", "una caña", "cañas",
    ],
    context: ["salir de fiesta noche", "ir de copas", "vamos a beber"],
    reply: "Abro el Dashboard Nocturno: bares, cervecerías, pubs y discotecas abiertos ahora.",
    path: "/",
    audio: "leisure",
  },
  {
    keys: [
      "hotel", "hoteles", "dormir", "alojamiento", "alojar", "hostal", "hostel",
      "apartamento", "habitacion", "pernoctar", "donde quedarme", "donde me quedo",
      "donde me alojo", "airbnb", "booking",
    ],
    reply: "Te llevo a alojamientos cerca de Alicante.",
    path: "/donde-dormir",
    audio: "hotel",
  },
  {
    keys: [
      "restaurante", "restaurantes", "tapas", "tapeo",
      "almorzar", "cenar", "desayunar", "desayuno", "almuerzo", "cena",
      "menu", "menus", "paella", "arroz", "picar algo",
    ],
    reply: "Te muestro sitios para comer cerca.",
    path: "/",
    audio: "eat",
  },
  {
    keys: ["mapa playa", "playas mapa", "mapa de playas"],
    reply: "Aquí tienes el mapa de playas.",
    path: "/playas/mapa",
    audio: "beach_map",
  },
  {
    keys: [
      "playa", "playas", "cala", "calas", "arena", "tabarca", "postiguet", "albufereta",
      "san juan",
    ],
    reply: "Estas son las playas. ¿Quieres verlas en el mapa?",
    path: "/playas",
    audio: "beaches",
  },
  {
    keys: ["explorar", "mapa", "ciudad", "cerca de mi", "sitios cerca", "que hay cerca"],
    reply: "Te abro el mapa de la ciudad.",
    path: "/explore",
    audio: "explore",
  },
  {
    keys: [
      "planificar ruta", "planificador", "como llego", "como voy a", "llegar a",
      "ir a", "llevarme a", "ruta hasta", "trayecto",
    ],
    reply: "Vamos al planificador de rutas.",
    path: "/bus/planner",
    audio: "planner",
  },
  {
    keys: [
      "bus", "buses", "emt", "autobus", "autobuses", "transporte publico",
      "linea de bus", "parada",
    ],
    reply: "Te abro los buses urbanos.",
    path: "action:bus-picker",
    audio: "bus",
  },
  {
    keys: [
      "vuelo", "vuelos", "aeropuerto", "aena", "avion", "aviones", "alc",
      "salida de vuelo", "llegada de vuelo", "facturar",
    ],
    reply: "Vuelos del aeropuerto de Alicante.",
    path: "/vuelos",
    audio: "flights",
  },
  {
    keys: [
      "clima", "tiempo", "llueve", "lluvia", "sol", "temperatura", "calor",
      "frio", "viento", "previsión", "prevision", "pronostico", "humedad",
    ],
    context: [
      "va a llover", "hara sol", "que tiempo hace",
      "como esta el tiempo", "como esta el clima",
    ],
    reply: "Mira la previsión.",
    path: "/clima",
    audio: "weather",
  },
  {
    keys: ["cine", "cines", "pelicula", "peliculas", "cartelera", "estreno", "estrenos"],
    reply: "Cartelera de cine.",
    path: "/ocio/cartelera",
    audio: "cinema",
  },
  {
    keys: ["teatro", "teatros", "obra de teatro", "musical"],
    reply: "Teatros en la ciudad.",
    path: "/ocio/teatros",
    audio: "theatre",
  },
  {
    keys: ["concierto", "conciertos", "musica en vivo", "directo", "festival", "festivales", "dj"],
    reply: "Conciertos por aquí.",
    path: "/ocio/conciertos",
    audio: "concerts",
  },
  {
    keys: [
      "ocio", "entretenimiento",
    ],
    reply: "Ideas para tu plan.",
    path: "/ocio",
    audio: "leisure",
  },
  {
    keys: ["fiesta", "fiestas", "hoguera", "hogueras", "moros", "cristianos", "san juan"],
    reply: "Programa de fiestas.",
    path: "/fiestas",
    audio: "fiestas",
  },
  {
    keys: [
      "farmacia", "farmacias", "guardia", "medicamento", "medicamentos",
      "pastilla", "pastillas", "receta", "ibuprofeno", "paracetamol", "antibiotico",
    ],
    reply: "Farmacias de guardia.",
    path: "/farmacias",
    audio: "pharmacy",
  },
  {
    keys: [
      "hospital", "hospitales", "urgencia", "urgencias", "ambulancia", "112", "061",
    ],
    reply: "Hospitales cercanos.",
    path: "/hospitales",
    audio: "hospitals",
  },
  {
    keys: [
      "centro de salud", "ambulatorio", "consulta medica", "especialista",
    ],
    reply: "Te abro Salud.",
    path: "/salud",
    audio: "health",
  },
  {
    keys: ["perfil", "mi cuenta", "mi usuario", "mis datos"],
    reply: "Tu perfil.",
    path: "/perfil",
    audio: "profile",
  },
  {
    keys: ["hola", "buenas", "hey", "saludos", "buenos dias", "buenas tardes", "buenas noches"],
    reply:
      "¡Hola! ¿En qué te ayudo? Puedes pedirme playa, comer, dormir, bus, vuelos, ocio o clima.",
    audio: "hello",
  },
  {
    keys: ["gracias", "muchas gracias", "te lo agradezco", "perfecto gracias"],
    reply: "¡A mandar! Si necesitas otra cosa, dímelo.",
    audio: "thanks",
  },
];

// ─── DOMINIOS GENERALES ───────────────────────────────────────────────
// Cuando el usuario habla en lenguaje natural ambiguo ("tengo dolor",
// "tengo hambre", "me aburro"), detectamos el DOMINIO y pedimos
// aclaración antes de navegar a una subcategoría concreta.
type DomainSpec = {
  id: string;
  triggers: string[];
  question: string;
  audio: VoiceClip;
  hubPath?: string;
  followups: { keys: string[]; path: string }[];
};

const DOMAINS: DomainSpec[] = [
  {
    id: "salud",
    hubPath: "/salud",
    triggers: [
      // Estados generales de "no encontrarse bien".
      "estoy enfermo", "estoy enferma", "me siento enfermo", "me siento enferma",
      "me encuentro enfermo", "me encuentro enferma", "enfermo", "enferma",
      "me encuentro mal", "me siento mal", "siento mal",
      "me siento fatal", "me encuentro fatal", "no me encuentro bien",
      "no me siento bien", "estoy pachucho", "estoy pachucha",
      "estoy malo", "estoy mala", "estoy malita", "estoy malito",
      "indispuesto", "indispuesta", "decaido", "decaida",
      // Dolor.
      "me duele", "tengo dolor", "dolor de", "duele mucho", "me duelen",
      // Síntomas como palabra suelta → SIEMPRE quedan en salud genérica.
      "dolor", "dolores", "sintoma", "sintomas", "enfermedad", "cansancio",
      "agotado", "agotada", "debil", "mareo", "mareos", "herida", "heridas",
      "sangrado", "ardor", "picor", "picores", "molestia", "molestias",
      "fiebre", "decimas", "gripe", "catarro", "resfriado", "resfriada",
      "tos", "nauseas", "vomitos", "vomito", "diarrea",
      "tengo fiebre", "tengo decimas", "tengo gripe", "tengo catarro",
      "estoy resfriado", "estoy resfriada", "tengo tos", "estoy mareado",
      "estoy mareada", "me mareo", "tengo nauseas", "tengo vomitos",
      "necesito un medico", "necesito ir al medico", "necesito ayuda medica",
      "ayuda medica", "asistencia medica",
      "me he caido", "me he hecho dano", "me he hecho daño", "tengo una herida",
      "me he cortado", "me sangra", "no puedo respirar", "me cuesta respirar",
      "malestar", "estoy fatal", "salud", "medico", "doctor", "sanitario",
    ],
    question:
      "Entiendo. ¿Necesitas hospital, farmacia, urgencias o centro de salud?",
    audio: "health",
    followups: [
      { keys: ["hospital", "hospitales", "urgencia", "urgencias", "ambulancia", "emergencia"], path: "/hospitales" },
      { keys: ["farmacia", "farmacias", "medicina", "medicamento", "pastilla", "receta"], path: "/farmacias" },
      { keys: ["centro de salud", "ambulatorio", "especialista", "medico", "doctor", "consulta"], path: "/salud" },
    ],
  },
  {
    id: "comer",
    hubPath: "/",
    triggers: [
      "tengo hambre", "estoy hambriento", "estoy hambrienta", "me muero de hambre",
      "sitio para comer", "algo de comer", "me apetece comer",
      "donde como", "donde ceno", "donde almuerzo",
      "comer", "comida", "hambre",
    ],
    question:
      "¿Buscas restaurante, tapas, paella o algo rápido?",
    audio: "eat",
    followups: [
      { keys: ["restaurante", "restaurantes", "cenar", "almorzar", "desayunar"], path: "/" },
      { keys: ["tapas", "tapeo", "picar"], path: "/" },
      { keys: ["paella", "arroz"], path: "/" },
      { keys: ["rapido", "fast", "hamburguesa", "pizza"], path: "/" },
    ],
  },
  {
    id: "transporte",
    hubPath: "action:bus-picker",
    triggers: [
      "quiero moverme", "necesito moverme", "como me muevo", "quiero desplazarme",
      "tengo que ir", "necesito ir", "como llego", "como voy",
      "transporte",
    ],
    question: "¿Quieres bus urbano, planificador de ruta o vuelos?",
    audio: "bus",
    followups: [
      { keys: ["bus", "autobus", "autobuses", "urbano", "urbanos", "emt", "parada", "linea", "lineas", "local", "locales"], path: "action:bus-picker" },
      { keys: ["ruta", "planificador", "planificar", "trayecto"], path: "/bus/planner" },
      { keys: ["vuelo", "vuelos", "avion", "aeropuerto"], path: "/vuelos" },
    ],
  },
  {
    id: "ocio",
    hubPath: "/ocio",
    triggers: [
      "quiero salir", "quiero hacer algo", "me aburro", "estoy aburrido",
      "estoy aburrida", "no se que hacer", "algo divertido",
      "que hago hoy", "que hago esta tarde", "que hacemos esta noche",
      "que puedo hacer", "diversion", "divertirme", "plan", "planes",
    ],
    question: "¿Te apetece cine, conciertos, teatro o fiestas?",
    audio: "leisure",
    followups: [
      { keys: ["cine", "pelicula", "peliculas", "cartelera"], path: "/ocio/cartelera" },
      { keys: ["concierto", "conciertos", "musica", "dj", "festival"], path: "/ocio/conciertos" },
      { keys: ["teatro", "teatros", "obra", "musical"], path: "/ocio/teatros" },
      { keys: ["fiesta", "fiestas", "hoguera", "hogueras"], path: "/fiestas" },
      { keys: ["copa", "copas", "bar", "cerveza", "discoteca", "pub"], path: "/" },
    ],
  },
  {
    id: "playas",
    hubPath: "/playas",
    triggers: [
      "me quiero banar", "me quiero bañar", "quiero banarme", "quiero bañarme",
      "ir al mar", "darme un bano", "darme un baño",
      "tomar el sol", "nadar en el mar",
    ],
    question: "¿Quieres el listado de playas o el mapa de playas?",
    audio: "beaches",
    followups: [
      { keys: ["mapa"], path: "/playas/mapa" },
      { keys: ["listado", "lista", "todas", "cuales", "playas", "playa"], path: "/playas" },
    ],
  },
  {
    id: "dormir",
    hubPath: "/donde-dormir",
    triggers: [
      "pasar la noche", "necesito cama", "busco cama", "sitio para dormir",
      "donde duermo", "donde me quedo",
    ],
    question: "¿Buscas hotel, hostal o apartamento?",
    audio: "hotel",
    followups: [
      { keys: ["hotel", "hoteles"], path: "/donde-dormir" },
      { keys: ["hostal", "hostel"], path: "/donde-dormir" },
      { keys: ["apartamento", "airbnb"], path: "/donde-dormir" },
    ],
  },
];

function normalizeSpeech(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bestKeyIntent(query: string): { intent: IntentDef; len: number } | null {
  let best: IntentDef | null = null;
  let bestLen = 0;
  for (const it of INTENTS) {
    for (const key of it.keys) {
      const n = normalizeSpeech(key);
      if (n && query.includes(n) && n.length > bestLen) {
        best = it;
        bestLen = n.length;
      }
    }
  }
  return best ? { intent: best, len: bestLen } : null;
}

function bestContextIntent(query: string): IntentDef | null {
  let best: IntentDef | null = null;
  let bestLen = 0;
  for (const it of INTENTS) {
    for (const c of it.context ?? []) {
      const n = normalizeSpeech(c);
      if (n && query.includes(n) && n.length > bestLen) {
        best = it;
        bestLen = n.length;
      }
    }
  }
  return best;
}

function matchDomain(query: string): { domain: DomainSpec; len: number } | null {
  let best: DomainSpec | null = null;
  let bestLen = 0;
  for (const d of DOMAINS) {
    for (const t of d.triggers) {
      const n = normalizeSpeech(t);
      if (n && query.includes(n) && n.length > bestLen) {
        best = d;
        bestLen = n.length;
      }
    }
  }
  return best ? { domain: best, len: bestLen } : null;
}

function matchFollowup(query: string, domain: DomainSpec): string | null {
  let bestPath: string | null = null;
  let bestLen = 0;
  for (const f of domain.followups) {
    for (const k of f.keys) {
      const n = normalizeSpeech(k);
      if (n && query.includes(n) && n.length > bestLen) {
        bestPath = f.path;
        bestLen = n.length;
      }
    }
  }
  return bestPath;
}

// ─── DB Intents (agente_intents) ──────────────────────────────────────
// Mapa: cuando un intent de BD coincida y SU dominio tenga clarificación
// definida en DOMAINS, en vez de navegar directo abrimos la pregunta
// aclaratoria (regla del usuario: conversar antes de derivar).
const DB_KEY_TO_DOMAIN: Record<string, string> = {
  salud: "salud",
  comer: "comer",
  transporte: "transporte",
  playas: "playas",
  dormir: "dormir",
  comprar: "comprar",
  tomar_algo: "tomar_algo",
  mapa: "mapa",
  ocio: "ocio",
  fiestas: "fiestas",
  perfil: "perfil",
  clima: "clima",
  qr: "qr",
};

// ─── NAMED ENTITIES (PRIORIDAD 0) ─────────────────────────────────────
// Entidades concretas que el usuario nombra explícitamente: hoteles,
// monumentos, marcas, lugares. Ganan SIEMPRE sobre dominios y keywords.
// Si no hay ruta interna, abrimos Google Maps con la consulta para que el
// usuario llegue al sitio "directamente" sin pasar por conversación.
type NamedEntity = {
  aliases: string[];
  reply: string;
  path?: string;       // ruta interna existente
  external?: string;   // URL externa (Google Maps, web oficial)
};

const NAMED_ENTITIES: NamedEntity[] = [
  // ── Transporte / infraestructura
  { aliases: ["aeropuerto de alicante", "aeropuerto alicante", "aeropuerto elche", "aeropuerto alc", "el altet"],
    reply: "Te llevo al aeropuerto de Alicante.", path: "/vuelos" },

  // ── Hoteles concretos (no hay buscador por nombre → mandamos a la lista)
  { aliases: ["melia alicante", "hotel melia", "el melia"],
    reply: "Abriendo Meliá Alicante.",
    external: "https://www.google.com/maps/search/?api=1&query=Meli%C3%A1+Alicante" },
  { aliases: ["hospes amerigo", "hotel hospes"],
    reply: "Abriendo Hospes Amérigo.",
    external: "https://www.google.com/maps/search/?api=1&query=Hospes+Amerigo+Alicante" },
  { aliases: ["hotel mediterranea plaza", "mediterranea plaza"],
    reply: "Abriendo Mediterránea Plaza.",
    external: "https://www.google.com/maps/search/?api=1&query=Hotel+Mediterranea+Plaza+Alicante" },

  // ── Monumentos y lugares emblemáticos
  { aliases: ["castillo de santa barbara", "castillo santa barbara", "santa barbara"],
    reply: "Abriendo Castillo de Santa Bárbara.",
    external: "https://www.google.com/maps/search/?api=1&query=Castillo+de+Santa+B%C3%A1rbara+Alicante" },
  { aliases: ["explanada de espana", "la explanada"],
    reply: "Abriendo la Explanada de España.",
    external: "https://www.google.com/maps/search/?api=1&query=Explanada+de+Espa%C3%B1a+Alicante" },
  { aliases: ["mercado central", "mercado de alicante"],
    reply: "Abriendo el Mercado Central.",
    external: "https://www.google.com/maps/search/?api=1&query=Mercado+Central+Alicante" },
  { aliases: ["marq", "museo arqueologico"],
    reply: "Abriendo el MARQ.",
    external: "https://www.google.com/maps/search/?api=1&query=MARQ+Alicante" },
  { aliases: ["isla de tabarca", "tabarca"],
    reply: "Abriendo Isla de Tabarca.",
    external: "https://www.google.com/maps/search/?api=1&query=Isla+de+Tabarca" },

  // ── Marcas y cadenas comerciales
  { aliases: ["mcdonalds", "mc donalds", "macdonalds"],
    reply: "Abriendo McDonald's en Alicante.",
    external: "https://www.google.com/maps/search/?api=1&query=McDonalds+Alicante" },
  { aliases: ["burger king"],
    reply: "Abriendo Burger King en Alicante.",
    external: "https://www.google.com/maps/search/?api=1&query=Burger+King+Alicante" },
  { aliases: ["zara"],
    reply: "Abriendo Zara en Alicante.",
    external: "https://www.google.com/maps/search/?api=1&query=Zara+Alicante" },
  { aliases: ["el corte ingles", "corte ingles"],
    reply: "Abriendo El Corte Inglés.",
    external: "https://www.google.com/maps/search/?api=1&query=El+Corte+Ingles+Alicante" },
  { aliases: ["mercadona"],
    reply: "Abriendo Mercadona.",
    external: "https://www.google.com/maps/search/?api=1&query=Mercadona+Alicante" },
  { aliases: ["carrefour"],
    reply: "Abriendo Carrefour.",
    external: "https://www.google.com/maps/search/?api=1&query=Carrefour+Alicante" },
  { aliases: ["ikea"],
    reply: "Abriendo IKEA.",
    external: "https://www.google.com/maps/search/?api=1&query=IKEA+San+Vicente+del+Raspeig" },

  // ── Centros comerciales
  { aliases: ["plaza mar 2", "plaza mar dos", "plaza mar"],
    reply: "Abriendo Centro Comercial Plaza Mar 2.",
    external: "https://www.google.com/maps/search/?api=1&query=Plaza+Mar+2+Alicante" },
  { aliases: ["gran via alicante", "centro comercial gran via"],
    reply: "Abriendo C.C. Gran Vía.",
    external: "https://www.google.com/maps/search/?api=1&query=Gran+Via+Alicante+centro+comercial" },
];

function matchNamedEntity(query: string): NamedEntity | null {
  let best: NamedEntity | null = null;
  let bestLen = 0;
  for (const e of NAMED_ENTITIES) {
    for (const a of e.aliases) {
      const n = normalizeSpeech(a);
      if (n && query.includes(n) && n.length > bestLen) {
        best = e;
        bestLen = n.length;
      }
    }
  }
  return best;
}

const EMPTY_ROUTING_CATALOG: AgenteRoutingCatalog = { intents: [], subcategories: {} };

function hasPhrase(text: string, phrase: string): boolean {
  const n = normalizeSpeech(phrase);
  if (!n || n.length < 4) return false;
  if (n.includes(" ")) return text.includes(n);
  return new RegExp(`(^|\\s)${n.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(\\s|$)`).test(text);
}

function matchExistingSubcategory(query: string, items: AgenteSubcategory[] = []): AgenteSubcategory | null {
  let best: AgenteSubcategory | null = null;
  let bestLen = 0;
  for (const item of items) {
    for (const alias of [item.label, item.route.split("/").filter(Boolean).at(-1)?.replace(/-/g, " "), ...(item.aliases ?? [])]) {
      if (!alias) continue;
      const n = normalizeSpeech(alias);
      if (hasPhrase(query, n) && n.length > bestLen) {
        best = item;
        bestLen = n.length;
      }
    }
  }
  return best;
}

function findSubcategoryByTarget(target: string | undefined, catalog: AgenteRoutingCatalog): AgenteSubcategory | null {
  if (!target) return null;
  const cleanTarget = target.split("?")[0];
  for (const item of Object.values(catalog.subcategories).flat()) {
    const route = item.route.split("?")[0];
    if (cleanTarget === route || cleanTarget.startsWith(`${route}/`)) return item;
  }
  return null;
}

function matchDbIntent(
  query: string,
  dbIntents: AgenteIntentRow[],
): { intent: AgenteIntentRow; len: number } | null {
  let best: AgenteIntentRow | null = null;
  let bestLen = 0;
  for (const it of dbIntents) {
    for (const kw of it.keywords ?? []) {
      const n = normalizeSpeech(kw);
      // Exigimos longitud mínima 4 para evitar que palabras sueltas muy
      // cortas ("ir", "ver"…) disparen un dominio entero.
      if (n.length < 4) continue;
      if (query.includes(n) && n.length > bestLen) {
        best = it;
        bestLen = n.length;
      }
    }
  }
  return best ? { intent: best, len: bestLen } : null;
}

type LocalResult = {
  reply: string;
  path?: string;
  audio: VoiceClip;
  pendingDomain?: string | null;
  forwardPrompt?: string;
  openSubmenu?: string;
};

function localResolve(
  text: string,
  currentDomain?: string | null,
  catalog: AgenteRoutingCatalog = EMPTY_ROUTING_CATALOG,
): LocalResult {
  const query = normalizeSpeech(text);

  // 1) Follow-up dentro de un dominio activo: resolvemos sub-destino.
  if (currentDomain) {
    const d = DOMAINS.find((x) => x.id === currentDomain);
    const subcategory = matchExistingSubcategory(query, catalog.subcategories[currentDomain]);
    if (subcategory) {
      return {
        reply: `Te llevo a ${subcategory.label}.`,
        path: subcategory.route,
        audio: d?.audio ?? "fallback",
        pendingDomain: null,
      };
    }
    if (d) {
      const fuPath = matchFollowup(query, d);
      if (fuPath) {
        const intent = INTENTS.find((it) => it.path === fuPath);
        return {
          reply: intent?.reply ?? "Te llevo allí.",
          path: fuPath,
          audio: intent?.audio ?? d.audio,
          pendingDomain: null,
        };
      }
    }
  }

  // 2) PRIORIDAD 0 — ENTIDAD CONCRETA NOMBRADA (hotel, monumento, marca,
  //    lugar específico). Si el usuario nombra algo concreto, NUNCA preguntamos
  //    ni mostramos dominio: abrimos directo. Mayor prioridad que keywords,
  //    dominios y BD. Búsqueda flexible (acentos, mayúsculas, variantes).
  const entity = matchNamedEntity(query);
  if (entity) {
    return {
      reply: entity.reply,
      path: entity.external ?? entity.path,
      audio: "fallback",
      pendingDomain: null,
    };
  }

  // 3) ARQUITECTURA POR CAPAS (regla del producto):
  //    PRIORIDAD 1 → entidad/destino EXACTO (frase específica, len >= 8)
  //    PRIORIDAD 2 → dominio general (frase ambigua → preguntar antes)
  //    PRIORIDAD 3 → keyword / DB intent (solo si no hay dominio en juego)
  //
  //    Frases ambiguas ("me duele", "tengo hambre", "me aburro") NUNCA
  //    pueden abrir destinos específicos, especialistas ni fichas.
  const domainMatch = matchDomain(query);
  const keyMatch = bestKeyIntent(query);

  // 2a) PRIORIDAD 1 — entidad exacta de alta confianza (>=8 chars) gana
  //     incluso sobre el dominio. Ej: "farmacia", "hospital", "aeropuerto",
  //     "cartelera"… son peticiones explícitas, no ambigüedades.
  if (keyMatch && keyMatch.len >= 8 && (!domainMatch || keyMatch.len > domainMatch.len)) {
    return {
      reply: keyMatch.intent.reply,
      path: keyMatch.intent.path,
      audio: keyMatch.intent.audio,
      pendingDomain: null,
    };
  }

  // 2b) PRIORIDAD 2 — si hay dominio, SIEMPRE preguntar antes de derivar.
  if (domainMatch) {
    const { domain } = domainMatch;
    return {
      reply: domain.question,
      audio: domain.audio,
      pendingDomain: domain.id,
    };
  }

  // 2c) PRIORIDAD 3 — keyword corto (4–7 chars) sin dominio en juego.
  if (keyMatch && keyMatch.len >= 4) {
    return {
      reply: keyMatch.intent.reply,
      path: keyMatch.intent.path,
      audio: keyMatch.intent.audio,
      pendingDomain: null,
    };
  }

  // 3) DB Intents (agente_intents): semántica rica desde Supabase.
  //    Si el intent de BD pertenece a un dominio con clarificación,
  //    SIEMPRE preguntamos primero (nunca abrimos especialista directo).
  const dbMatch = matchDbIntent(query, catalog.intents);
  if (dbMatch) {
    const { intent } = dbMatch;
    const domainId = DB_KEY_TO_DOMAIN[intent.key];
    if (domainId) {
      const d = DOMAINS.find((x) => x.id === domainId);
      if (d) {
        return {
          reply: d.question,
          audio: d.audio,
          pendingDomain: d.id,
        };
      }
    }
    // Si la ruta del intent BD apunta a un sub-destino específico
    // (ej. /salud/<categoria>, /ocio/<algo>), exigimos que el keyword
    // coincidente sea suficientemente explícito (>= 8 chars).
    const isSpecificSubpath =
      intent.route && /^\/[^/]+\/[^/]+/.test(intent.route);
    if (isSpecificSubpath && dbMatch.len < 8) {
      // Ambiguo → no abrimos destino concreto. Pedimos aclaración genérica.
      return {
        reply: "¿Puedes concretar un poco más qué necesitas?",
        audio: "fallback",
        pendingDomain: null,
      };
    }
    if (intent.action === "logout") {
      return {
        reply: "Cerrando sesión…",
        audio: "fallback",
        pendingDomain: null,
      };
    }
    return {
      reply: `Te llevo a ${intent.label.toLowerCase()}.`,
      path: intent.route ?? undefined,
      audio: "fallback",
      pendingDomain: null,
    };
  }

  // 4) Context match específico de un intent concreto.
  const ctx = bestContextIntent(query);
  if (ctx) {
    return {
      reply: ctx.reply,
      path: ctx.path,
      audio: ctx.audio,
      pendingDomain: null,
    };
  }

  return {
    reply: "No te he entendido. ¿Puedes repetirlo?",
    audio: "fallback",
  };
}

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "voice" | "text";
const STORAGE_KEY = "va:agente-msgs";
const audioSrc = (clip: AgentAudioClip) =>
  VOICE_ASSETS[`../assets/agent-voice/${clip}.mp3`] ?? `/agent-voice/${clip}.mp3`;
function getGreetingClip(): GreetingClip {
  return new Date().getHours() < 14 ? "greeting_morning" : "greeting_afternoon";
}
function getGreetingText() {
  const h = new Date().getHours();
  const saludo = h < 14 ? "Buenos días" : "Buenas tardes";
  return `${saludo}, Leopoldo, ¿qué vamos a hacer hoy?`;
}
function makeGreeting(): Msg {
  return { role: "assistant", content: getGreetingText() };
}

function loadMsgs(): Msg[] {
  if (typeof window === "undefined") return [makeGreeting()];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [makeGreeting()];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  return [makeGreeting()];
}

function plainText(md: string): string {
  return md
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\*\*?([^*]+)\*\*?/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[#>\-*]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .trim();
}

const ECHO_STOPWORDS = new Set([
  "a",
  "al",
  "de",
  "del",
  "el",
  "en",
  "la",
  "leopoldo",
  "los",
  "me",
  "o",
  "para",
  "que",
  "te",
  "un",
  "una",
  "y",
]);

function meaningfulSpeechTokens(text: string) {
  return normalizeSpeech(text)
    .split(" ")
    .filter((token) => token.length > 2 && !ECHO_STOPWORDS.has(token));
}

function isLikelyAgentEcho(transcript: string, assistantMessages: string[]) {
  const heard = normalizeSpeech(transcript);
  const heardTokens = meaningfulSpeechTokens(transcript);
  if (heardTokens.length < 2) return false;

  return assistantMessages.some((message) => {
    const spoken = normalizeSpeech(plainText(message));
    if (!spoken) return false;
    if (spoken.includes(heard) || heard.includes(spoken)) return true;

    const spokenTokens = meaningfulSpeechTokens(message);
    if (spokenTokens.length < 2) return false;
    const overlap = heardTokens.filter((token) => spokenTokens.includes(token)).length;
    const ratio = overlap / Math.min(heardTokens.length, spokenTokens.length);
    return overlap >= 3 && ratio >= 0.6;
  });
}

function collapseRepeatedTokenRuns(text: string) {
  const tokens = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (tokens.length < 2) return tokens.join(" ");
  let changed = true;
  while (changed) {
    changed = false;
    for (let size = Math.floor(tokens.length / 2); size >= 1; size--) {
      for (let i = 0; i + size * 2 <= tokens.length; i++) {
        const left = tokens
          .slice(i, i + size)
          .map(normalizeSpeech)
          .join(" ");
        const right = tokens
          .slice(i + size, i + size * 2)
          .map(normalizeSpeech)
          .join(" ");
        if (left && left === right) {
          tokens.splice(i + size, size);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return tokens.join(" ");
}

function compactRecognitionText(parts: string[]) {
  const compact: string[] = [];
  for (const raw of parts.map((p) => p.trim()).filter(Boolean)) {
    const current = normalizeSpeech(raw);
    if (!current) continue;
    const last = compact[compact.length - 1];
    const previous = last ? normalizeSpeech(last) : "";
    if (previous && (current === previous || previous.endsWith(` ${current}`))) continue;
    if (previous && (current.startsWith(`${previous} `) || current.startsWith(previous))) {
      compact[compact.length - 1] = raw;
    } else {
      compact.push(raw);
    }
  }
  return collapseRepeatedTokenRuns(compact.join(" "));
}

function isAgentSpeechOutputActive() {
  if (typeof window === "undefined") return Boolean(__vaActiveAudio || __vaActiveUtterance);
  const synth = window.speechSynthesis;
  return Boolean(__vaActiveAudio || __vaActiveUtterance || synth?.speaking || synth?.pending);
}

function hasMobileSpeechDuplicationBug() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Android/i.test(ua) && /Chrome|CriOS/i.test(ua);
}

type SR = any;
function getSpeechRecognition(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

// Set true by the FAB after speaking the greeting synchronously (inside the
// click handler — required by browser autoplay rules). The panel reads it to
// avoid double-greeting.
let __vaGreetingSpoken = false;
export const __vaGetGreetingSpoken = () => __vaGreetingSpoken;
export const __vaSetGreetingSpoken = (v: boolean) => {
  __vaGreetingSpoken = v;
};
let __vaActiveUtterance: SpeechSynthesisUtterance | null = null;
let __vaActiveAudio: HTMLAudioElement | null = null;
let __vaActiveAudioStartedAt = 0;
const __vaPrimedUtterances: SpeechSynthesisUtterance[] = [];
let __vaSpeechUnlocked = false;
let __vaVoicesLoggingAttached = false;
const POST_SPEECH_LISTEN_DELAY_MS = 140;

function pickSpanishVoice(synth: SpeechSynthesis) {
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("es-es")) ||
    voices.find((v) => v.lang?.toLowerCase().startsWith("es")) ||
    voices.find((v) => v.lang?.toLowerCase().includes("es")) ||
    voices[0] ||
    null
  );
}

function extractSpeechText(respuesta: unknown) {
  if (typeof respuesta === "string") return respuesta;
  if (respuesta && typeof respuesta === "object") {
    const obj = respuesta as Record<string, unknown>;
    const value = obj.text ?? obj.message ?? obj.content;
    return value == null ? "" : String(value);
  }
  return respuesta == null ? "" : String(respuesta);
}

function waitVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = synth.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }
    let done = false;
    const finish = (voices: SpeechSynthesisVoice[]) => {
      if (done) return;
      done = true;
      resolve(voices);
    };
    synth.onvoiceschanged = () => finish(synth.getVoices());
    // Fallback por si onvoiceschanged nunca dispara (algunos Android).
    setTimeout(() => finish(synth.getVoices()), 1500);
  });
}

async function hablar(
  texto: unknown,
  opts: { onStart?: () => void; onEnd?: () => void } = {},
) {
  const { onStart, onEnd } = opts;
  const respuesta = plainText(extractSpeechText(texto));
  console.log("RESPUESTA:", texto);
  if (!respuesta || typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  const voices = await waitVoices(synth);
  console.log("VOICES:", voices);
  synth.cancel();
  synth.resume();
  const utterance = new SpeechSynthesisUtterance(String(respuesta));
  utterance.lang = "es-ES";
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;
  const voice = pickSpanishVoice(synth);
  if (voice) {
    utterance.voice = voice;
    console.log("VOICE PICKED:", voice.name, voice.lang);
  } else {
    console.warn("No hay voces disponibles para TTS.");
  }
  __vaActiveUtterance = utterance;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (__vaActiveUtterance === utterance) __vaActiveUtterance = null;
    onEnd?.();
  };
  utterance.onstart = () => {
    console.log("VOICE START");
    onStart?.();
  };
  utterance.onend = () => {
    console.log("VOICE END");
    finish();
  };
  utterance.onerror = (e) => {
    console.log("VOICE ERROR", e);
    finish();
  };
  synth.speak(utterance);
}

if (typeof window !== "undefined") {
  (window as any).hablar = hablar;
}

function iniciarAudio() {
  if (typeof window === "undefined" || __vaSpeechUnlocked || !window.speechSynthesis) return;
  try {
    const unlock = new SpeechSynthesisUtterance(" ");
    window.speechSynthesis.speak(unlock);
    window.speechSynthesis.resume();
    __vaSpeechUnlocked = true;
  } catch {
    // Ignore unlock failures; the next user tap can retry.
  }
}

function configureSpanishUtterance(u: SpeechSynthesisUtterance, text: string) {
  u.text = plainText(text);
  u.lang = "es-ES";
  u.rate = 1.05;
  u.pitch = 1;
  const synth = window.speechSynthesis;
  const voice = synth ? pickSpanishVoice(synth) : null;
  if (voice) u.voice = voice;
  __vaActiveUtterance = u;
  return u;
}

function reserveSpanishUtterance() {
  if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return null;
  const u = __vaPrimedUtterances.shift() || new SpeechSynthesisUtterance("");
  u.text = "";
  u.lang = "es-ES";
  u.rate = 1.05;
  u.pitch = 1;
  const synth = window.speechSynthesis;
  const voice = synth ? pickSpanishVoice(synth) : null;
  if (voice) u.voice = voice;
  return u;
}

function makeSpanishUtterance(text: string, fresh = false) {
  const u = fresh
    ? new SpeechSynthesisUtterance("")
    : __vaPrimedUtterances.shift() || new SpeechSynthesisUtterance("");
  return configureSpanishUtterance(u, text);
}

function keepSpeechSynthesisAwake(synth: SpeechSynthesis) {
  [0, 120, 450, 900].forEach((delay) => {
    window.setTimeout(() => {
      try {
        synth.resume();
      } catch {
        // Speech engines can be unavailable while the browser is restoring audio.
      }
    }, delay);
  });
}

function unlockSpeechFromUserGesture() {
  iniciarAudio();
}

function primeSpanishUtterances(count = 8) {
  if (typeof window === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return;
  while (__vaPrimedUtterances.length < count) {
    const u = new SpeechSynthesisUtterance("");
    u.lang = "es-ES";
    u.rate = 1.05;
    u.pitch = 1;
    __vaPrimedUtterances.push(u);
  }
}

export function AgenteVamosPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>(loadMsgs);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("voice");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const askAgent = useServerFn(agenteVamosChat);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recogRef = useRef<SR | null>(null);

  // Refs to avoid stale closures inside speech callbacks
  const modeRef = useRef(mode);
  const pausedRef = useRef(paused);
  const mutedRef = useRef(muted);
  const loadingRef = useRef(loading);
  const speakingRef = useRef(speaking);
  const assistantSpeechMemoryRef = useRef<string[]>([getGreetingText()]);
  const openRef = useRef(open);
  const wasOpenRef = useRef(open);
  const turnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recognitionRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressRecognitionUntilRef = useRef(0);
  // Máquina de estados del SpeechRecognition para evitar bloqueos en Android
  // (start/stop simultáneos dejan al motor en "Preparando..." infinito).
  // Transiciones válidas:
  //   idle → listening (start)
  //   listening → stopping (stop / onend / onerror)
  //   stopping → idle (tras ~300ms de gracia)
  const voiceStateRef = useRef<"idle" | "listening" | "stopping">("idle");
  const voiceStateResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setVoiceState = (next: "idle" | "listening" | "stopping") => {
    voiceStateRef.current = next;
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("VOICE STATE:", next);
    }
  };
  const scheduleVoiceIdle = (delay = 300) => {
    if (voiceStateResetTimerRef.current) clearTimeout(voiceStateResetTimerRef.current);
    voiceStateResetTimerRef.current = setTimeout(() => {
      voiceStateResetTimerRef.current = null;
      setVoiceState("idle");
    }, delay);
  };
  // Acuse "Voy a por ello…" mientras carga el Dashboard tras una navegación.
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Marca que estamos esperando un resumen externo (vamos:food-summary).
  const awaitingSummaryRef = useRef(false);
  // Dominio activo de la conversación (jerarquía de intent): cuando el
  // usuario expresa un dominio general ambiguo ("tengo dolor"), guardamos
  // "salud" aquí y el siguiente mensaje se resuelve dentro de ese dominio.
  const pendingDomainRef = useRef<string | null>(null);
  // Cache de agente_intents cargados desde Supabase (fuente semántica real).
  const routingCatalogRef = useRef<AgenteRoutingCatalog>(EMPTY_ROUTING_CATALOG);
  const loadCatalog = useServerFn(loadAgenteRoutingCatalog);

  const IDLE_MS = 15_000;
  const bumpIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (!openRef.current) return;
    idleTimerRef.current = setTimeout(() => {
      // Sólo cerramos si no hay actividad en curso
      if (speakingRef.current || loadingRef.current) {
        bumpIdle();
        return;
      }
      // Cierre con despedida hablada (C6)
      speakFarewellRef.current();
    }, IDLE_MS);
  }, []);
  // Forward ref para la despedida (definida más abajo) — evita ciclos de deps.
  const speakFarewellRef = useRef<() => void>(() => {});
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Carga catálogo real de intents + subcategorías existentes la primera vez que se abre el panel.
  useEffect(() => {
    if (!open) return;
    if (routingCatalogRef.current.intents.length > 0) return;
    loadCatalog()
      .then((catalog: AgenteRoutingCatalog) => {
        routingCatalogRef.current = catalog ?? EMPTY_ROUTING_CATALOG;
        console.log(`[Agente] Catálogo cargado desde BD: ${routingCatalogRef.current.intents.length}`);
      })
      .catch((err: unknown) => {
        console.warn("[Agente] No se pudo cargar el catálogo de routing", err);
      });
  }, [open, loadCatalog]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs));
      } catch {}
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const stopListening = useCallback(() => {
    if (turnTimerRef.current) {
      clearTimeout(turnTimerRef.current);
      turnTimerRef.current = null;
    }
    if (recognitionRestartTimerRef.current) {
      clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
    setInterim("");
    const activeRec = recogRef.current;
    if (activeRec) {
      activeRec.onresult = null;
      activeRec.onspeechend = null;
      activeRec.onerror = null;
      activeRec.onend = null;
    }
    const wasListening = voiceStateRef.current === "listening";
    if (wasListening || activeRec) {
      setVoiceState("stopping");
      try {
        activeRec?.abort?.();
      } catch {}
      try {
        activeRec?.stop?.();
      } catch {}
      // Espera de gracia antes de volver a IDLE: Android necesita ~300ms
      // entre stop() y un eventual start() para no quedarse colgado.
      scheduleVoiceIdle(300);
    } else {
      setVoiceState("idle");
    }
    recogRef.current = null;
    setListening(false);
  }, []);


  const stopSpeaking = useCallback(() => {
    try {
      __vaActiveAudio?.pause();
      if (__vaActiveAudio) __vaActiveAudio.currentTime = 0;
    } catch {}
    __vaActiveAudio = null;
    __vaActiveAudioStartedAt = 0;
    try {
      window.speechSynthesis?.cancel();
    } catch {}
    __vaActiveUtterance = null;
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  const shouldAutoListen = useCallback(() => {
    return (
      openRef.current &&
      modeRef.current === "voice" &&
      !pausedRef.current &&
      !loadingRef.current &&
      !speakingRef.current &&
      !isAgentSpeechOutputActive() &&
      Date.now() >= suppressRecognitionUntilRef.current
    );
  }, []);

  // Forward declaration via ref so callbacks can call latest startListening
  const startListeningRef = useRef<() => void>(() => {});
  const resumeListeningAfterEcho = useCallback(
    (delay = POST_SPEECH_LISTEN_DELAY_MS) => {
      if (recognitionRestartTimerRef.current) clearTimeout(recognitionRestartTimerRef.current);
      // Si el panel ya no está abierto, no reabrimos el micro (evita que el
      // indicador de grabación vuelva a aparecer tras cerrar).
      if (!openRef.current) return;
      recognitionRestartTimerRef.current = setTimeout(() => {
        recognitionRestartTimerRef.current = null;
        if (!openRef.current) return;
        const remaining = suppressRecognitionUntilRef.current - Date.now();
        if (remaining > 0) {
          resumeListeningAfterEcho(remaining + POST_SPEECH_LISTEN_DELAY_MS);
          return;
        }
        if (shouldAutoListen()) startListeningRef.current();
      }, delay);
    },
    [shouldAutoListen],
  );

  const playAudioClip = useCallback(
    (clip: AgentAudioClip, text: string, onEnd?: () => void) => {
      if (typeof window === "undefined" || mutedRef.current) {
        assistantSpeechMemoryRef.current = [text, ...assistantSpeechMemoryRef.current].slice(0, 6);
        onEnd?.();
        resumeListeningAfterEcho();
        return true;
      }
      try {
        __vaActiveAudio?.pause();
        const audio = new Audio(audioSrc(clip));
        audio.preload = "auto";
        audio.volume = 1;
        __vaActiveAudio = audio;
        __vaActiveAudioStartedAt = Date.now();
        assistantSpeechMemoryRef.current = [text, ...assistantSpeechMemoryRef.current].slice(0, 6);
        speakingRef.current = true;
        setSpeaking(true);
        const finish = () => {
          if (__vaActiveAudio === audio) __vaActiveAudio = null;
          __vaActiveAudioStartedAt = 0;
          suppressRecognitionUntilRef.current = Date.now() + POST_SPEECH_LISTEN_DELAY_MS;
          speakingRef.current = false;
          setSpeaking(false);
          onEnd?.();
          resumeListeningAfterEcho();
        };
        audio.onended = finish;
        audio.onerror = () => {
          if (__vaActiveAudio === audio) __vaActiveAudio = null;
          __vaActiveAudioStartedAt = 0;
          suppressRecognitionUntilRef.current = Date.now() + POST_SPEECH_LISTEN_DELAY_MS;
          speakingRef.current = false;
          setSpeaking(false);
          onEnd?.();
          resumeListeningAfterEcho();
        };
        const started = audio.play();
        if (started && typeof started.catch === "function") {
          started.catch(() => {
            if (__vaActiveAudio === audio) __vaActiveAudio = null;
            __vaActiveAudioStartedAt = 0;
            suppressRecognitionUntilRef.current = Date.now() + POST_SPEECH_LISTEN_DELAY_MS;
            speakingRef.current = false;
            setSpeaking(false);
            onEnd?.();
            resumeListeningAfterEcho();
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [resumeListeningAfterEcho],
  );

  const speak = useCallback(
    (text: string, _audio?: AgentAudioClip, onEnd?: () => void, _reservedUtterance?: SpeechSynthesisUtterance | null) => {
      // Anti-eco: cortamos escucha activa antes de hablar.
      assistantSpeechMemoryRef.current = [text, ...assistantSpeechMemoryRef.current].slice(0, 6);
      suppressRecognitionUntilRef.current = Date.now() + 1200;
      setInterim("");
      try {
        if (recogRef.current) {
          recogRef.current.onresult = null;
          recogRef.current.onspeechend = null;
          recogRef.current.onerror = null;
          recogRef.current.onend = null;
        }
        recogRef.current?.abort?.();
      } catch {
        // Ignore
      }
      recogRef.current = null;
      setListening(false);

      if (mutedRef.current || typeof window === "undefined" || !window.speechSynthesis) {
        onEnd?.();
        resumeListeningAfterEcho();
        return;
      }

      try {
        speakingRef.current = true;
        setSpeaking(true);
        hablar(text, {
          onStart: () => {
            speakingRef.current = true;
            setSpeaking(true);
          },
          onEnd: () => {
            suppressRecognitionUntilRef.current = Date.now() + POST_SPEECH_LISTEN_DELAY_MS;
            speakingRef.current = false;
            setSpeaking(false);
            onEnd?.();
            resumeListeningAfterEcho();
          },
        });
      } catch {
        onEnd?.();
        resumeListeningAfterEcho();
      }
    },
    [resumeListeningAfterEcho],
  );

  const speakExternalSummary = useCallback(
    (text: string) => {
      // Cancela el acuse "Voy a por ello…" si estaba programado y reinicia
      // el estado de espera.
      if (ackTimerRef.current) {
        clearTimeout(ackTimerRef.current);
        ackTimerRef.current = null;
      }
      awaitingSummaryRef.current = false;
      setLoading(false);
      setMsgs((m) => {
        const last = m[m.length - 1];
        if (
          last?.role === "assistant" &&
          (/^Abro el Dashboard/i.test(last.content) ||
            /^Te he conseguido/i.test(last.content) ||
            /^No tengo restaurantes/i.test(last.content) ||
            /^Ahora mismo no encuentro/i.test(last.content))
        ) {
          return m.map((msg, i) => (i === m.length - 1 ? { ...msg, content: text } : msg));
        }
        return [...m, { role: "assistant", content: text }];
      });
      speak(text);
    },
    [speak],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      if (window.sessionStorage.getItem("afp:voiceFoodSummaryPending") !== "1") return;
      window.setTimeout(() => window.sessionStorage.removeItem("afp:voiceFoodSummaryPending"), 0);
      const detail = (e as CustomEvent).detail as
        | { count: number; openCount: number; label: string }
        | undefined;
      if (!detail) return;
      const rawLabel = detail.label.toLowerCase().trim();
      const categoryLabel = rawLabel
        .replace(/^comida\s+/, "")
        .replace(/^cocina\s+/, "")
        .trim();
      const foodLabel = `comida ${categoryLabel || rawLabel}`;
      // B5: cerrar el turno con una invitación al siguiente paso.
      const text =
        detail.openCount > 0
          ? `Te he conseguido ${detail.openCount} restaurantes abiertos de ${foodLabel}. ¿Te abro el primero o probamos otra cocina?`
          : detail.count > 0
            ? `No tengo restaurantes abiertos de ${foodLabel} ahora mismo, pero te dejo los ${detail.count} del listado. ¿Probamos otra categoría?`
            : `Ahora mismo no encuentro restaurantes de ${foodLabel} cercanos. ¿Probamos otra categoría?`;
      speakExternalSummary(text);
    };
    window.addEventListener("vamos:food-summary", handler as EventListener);
    return () => window.removeEventListener("vamos:food-summary", handler as EventListener);
  }, [speakExternalSummary]);

  // C6: despedida hablada al cerrar por inactividad.
  const speakFarewell = useCallback(() => {
    if (!openRef.current) return;
    const text = "Si necesitas algo más, vuélveme a llamar.";
    setMsgs((m) => [...m, { role: "assistant", content: text }]);
    if (mutedRef.current || typeof window === "undefined" || !window.speechSynthesis) {
      setTimeout(() => onClose(), 1500);
      return;
    }
    speak(text, undefined, () => {
      setTimeout(() => onClose(), 200);
    });
  }, [speak, onClose]);
  useEffect(() => {
    speakFarewellRef.current = speakFarewell;
  }, [speakFarewell]);

  const send = useCallback(
    async (text: string, viaVoice = false) => {
      const clean = text.trim();
      if (!clean || loadingRef.current) return;
      bumpIdle();
      stopListening();
      const reservedReplyUtterance = viaVoice ? reserveSpanishUtterance() : null;

      // C8: despedida del usuario — responde local, habla y cierra.
      if (
        /^(gracias|graci[ao]s|nada m[aá]s|adi[oó]s|hasta luego|chao|chau|hasta otra|me voy)\b/i.test(
          clean,
        )
      ) {
        setMsgs((m) => [
          ...m,
          { role: "user", content: clean },
          { role: "assistant", content: "Hasta luego, Leopoldo." },
        ]);
        setInput("");
        setInterim("");
        speak("Hasta luego, Leopoldo.", undefined, () => {
          setTimeout(() => onClose(), 200);
        }, reservedReplyUtterance);
        return;
      }

      const next = [...msgs, { role: "user" as const, content: clean }];
      setMsgs(next);
      setInput("");
      setInterim("");
      setLoading(true);
      try {
        // Limpia estado obsoleto de la llamada anterior para que ninguna
        // categoría se contamine con un forwardPrompt/openSubmenu antiguo.
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.removeItem("afp:fwdPrompt");
            window.sessionStorage.removeItem("afp:openSubmenu");
          } catch {}
        }
        const fallback = localResolve(clean, pendingDomainRef.current, routingCatalogRef.current);
        let reply = fallback.reply;
        let target: string | undefined = fallback.path;
        let forwardPrompt: string | undefined =
          fallback.path === "/" && fallback.reply.includes("Dashboard Nocturno")
            ? clean
            : undefined;
        if (forwardPrompt && typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("afp:fwdPrompt", forwardPrompt);
          } catch {}
        }

        // Si el resolver local activa un DOMINIO (pregunta aclaratoria sin
        // path), saltamos el servidor para no pisar la pregunta con una
        // navegación agresiva. Actualizamos el dominio activo y respondemos.
        const isClarifying = fallback.pendingDomain != null && !fallback.path;
        if (isClarifying) {
          pendingDomainRef.current = fallback.pendingDomain ?? null;
        } else if (fallback.pendingDomain === null) {
          // Resolución concreta → cerramos el dominio activo.
          pendingDomainRef.current = null;
        }

        if (!isClarifying) {
          try {
            const res = await askAgent({
              data: {
                messages: next.map((m) => ({ role: m.role, content: m.content })),
                path,
              },
            });
            if (res && (res as any).ok) {
              const ai = res as {
                ok: true;
                content: string;
                navigate: string | null;
                forwardPrompt?: string;
                openSubmenu?: string;
              };
              if (ai.content && ai.content.trim()) reply = ai.content.trim();
              if (ai.navigate) target = ai.navigate;
              if (ai.forwardPrompt && typeof window !== "undefined") {
                forwardPrompt = ai.forwardPrompt;
                try {
                  window.sessionStorage.setItem("afp:fwdPrompt", ai.forwardPrompt);
                } catch {}
              }
              if (ai.openSubmenu && typeof window !== "undefined") {
                try {
                  window.sessionStorage.setItem("afp:openSubmenu", ai.openSubmenu);
                } catch {}
              }
            }
          } catch {
            // si falla el servidor, nos quedamos con la respuesta local
          }
        }

        // ─── HARD-BLOCK · destinos específicos desde frases ambiguas ─────
        // Regla: NUNCA abrir un destino específico (especialista, ficha,
        // subcategoría) si el mensaje del usuario es ambiguo. Solo abrimos
        // sub-destinos cuando la frase contiene una mención EXPLÍCITA del
        // destino (entidad exacta o palabra de alta confianza, >=8 chars).
        if (target && /^\/[^/]+\/[^/?#]+/.test(target)) {
          const cleanNorm = normalizeSpeech(clean);
          // 1) ¿la frase activa un dominio ambiguo?
          const ambiguousDomain = matchDomain(cleanNorm);
          // 2) ¿la frase contiene una mención explícita del último segmento
          //    de la ruta destino? Ej. /salud/dermatologia → "dermatolog".
          const lastSeg = target.split("?")[0].split("/").filter(Boolean).at(-1) ?? "";
          const segNorm = normalizeSpeech(lastSeg.replace(/-/g, " "));
          const segStems = segNorm.split(" ").filter((w) => w.length >= 6);
          const SPECIALTY_STEMS = [
            "traumatolog", "trauma", "dermatolog", "pediatr", "cardiolog",
            "oftalmolog", "ocular", "odontolog", "dentista", "psicolog",
            "psiquiatr", "ginec", "matron", "nutricion", "dietista",
            "estetic", "audiolog", "audifon", "rehabilit", "fisiotera",
            "vacun", "veterinari", "optic", "salud mental", "analitica",
            "analisis", "radiolog", "diagnostico por imagen", "ecograf",
            "centro de salud", "ambulatorio", "sip", "urgenc",
          ];
          const explicitFromStems =
            segStems.some((s) => cleanNorm.includes(s)) ||
            SPECIALTY_STEMS.some((s) => cleanNorm.includes(s));
          if (ambiguousDomain && !explicitFromStems) {
            // Forzamos al hub del dominio y abrimos el flujo aclaratorio.
            const hub = ambiguousDomain.domain.hubPath ?? "/";
            target = hub;
            reply = ambiguousDomain.domain.question;
            pendingDomainRef.current = ambiguousDomain.domain.id;
            forwardPrompt = undefined;
            if (typeof window !== "undefined") {
              try {
                window.sessionStorage.removeItem("afp:fwdPrompt");
                window.sessionStorage.removeItem("afp:openSubmenu");
              } catch {}
            }
          }
        }

        const pendingSubmenu =
          typeof window !== "undefined" ? window.sessionStorage.getItem("afp:openSubmenu") : null;
        const navigatingToDashboard = Boolean(forwardPrompt || pendingSubmenu);

        // B3: cuando vamos a un Dashboard, NO insertamos el placeholder
        // "Abro el Dashboard…" — mantenemos el indicador "pensando…" hasta
        // que llegue el resumen real vía vamos:food-summary.
        if (!navigatingToDashboard) {
          setMsgs((m) => [...m, { role: "assistant", content: reply }]);
        }

        // CRÍTICO: hablar SIEMPRE la respuesta del agente en cuanto llega,
        // sin depender de eventos posteriores (food-summary sólo existe
        // para comida; cine, vuelos, hoteles… no dispararían voz nunca).
        console.log("RESPUESTA AGENTE:", reply);
        speak(reply, undefined, undefined, reservedReplyUtterance);

        // Navegación tolerante: acepta paths con query string y rutas dinámicas
        // de BD (p.ej. /hotel/<uuid>, /vuelos?destino=amsterdam). Si TanStack
        // falla, caemos a window.location para no quedarnos atascados.
        const goTo = (raw: string) => {
          try {
            // Sentinel: abrir el picker de buses urbanos en el Inicio.
            if (raw === "action:bus-picker") {
              navigate({ to: "/" });
              setTimeout(() => {
                try {
                  window.dispatchEvent(new Event("agent:open-bus-picker"));
                } catch {
                  /* noop */
                }
              }, 60);
              return;
            }
            // URL externa (Google Maps, web oficial de una entidad concreta):
            // abrimos en nueva pestaña para no perder el contexto del agente.
            if (/^https?:\/\//i.test(raw)) {
              try {
                window.open(raw, "_blank", "noopener,noreferrer");
              } catch {
                window.location.assign(raw);
              }
              return;
            }
            const qIdx = raw.indexOf("?");
            const pathname = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
            const search: Record<string, string> = {};
            if (qIdx >= 0) {
              const sp = new URLSearchParams(raw.slice(qIdx + 1));
              sp.forEach((v, k) => (search[k] = v));
            }
            const hotelMatch = pathname.match(/^\/hotel\/([^/]+)$/);
            const restMatch = pathname.match(/^\/restaurants\/([^/]+)$/);
            const vueloMatch = pathname.match(/^\/vuelos\/([^/]+)$/);
            if (hotelMatch) {
              return navigate({ to: "/hotel/$id", params: { id: hotelMatch[1] } });
            }
            if (restMatch) {
              return navigate({ to: "/restaurants/$placeId", params: { placeId: restMatch[1] } });
            }
            if (vueloMatch) {
              return navigate({
                to: "/vuelos/$iata",
                params: { iata: vueloMatch[1] },
                search: search as any,
              });
            }
            if (Object.keys(search).length > 0) {
              return navigate({ to: pathname as any, search: search as any });
            }
            return navigate({ to: pathname as any });
          } catch {
            try {
              window.location.assign(raw);
            } catch {}
          }
        };

        if (navigatingToDashboard) {
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem("afp:voiceFoodSummaryPending", "1");
            } catch {}
          }
          // Mantenemos loading=true hasta que llegue el resumen real con
          // los datos del Dashboard. El agente NO habla hasta entonces, para
          // sincronizar voz y datos en pantalla.
          awaitingSummaryRef.current = true;
          if (ackTimerRef.current) {
            clearTimeout(ackTimerRef.current);
            ackTimerRef.current = null;
          }
          // Seguridad: si el resumen nunca llega, libera el spinner a los 8s.
          setTimeout(() => {
            if (awaitingSummaryRef.current) {
              awaitingSummaryRef.current = false;
              setLoading(false);
            }
          }, 8000);
          setTimeout(() => {
            try {
              const done = target && target !== path ? goTo(target) : undefined;
              Promise.resolve(done).finally(() => {
                if (forwardPrompt) {
                  window.dispatchEvent(
                    new CustomEvent("afp:forward-prompt", { detail: { text: forwardPrompt } }),
                  );
                }
                if (pendingSubmenu) {
                  window.dispatchEvent(
                    new CustomEvent("afp:open-submenu", { detail: { path: pendingSubmenu } }),
                  );
                }
              });
            } catch {}
          }, 350);
          // No tocamos loading aquí — lo limpia speakExternalSummary o el timeout.
          return;
        } else if (target && target !== path) {
          setTimeout(() => {
            goTo(target);
          }, 350);
        }
        // La voz ya se ha lanzado arriba con speak(reply). Aquí sólo
        // gestionamos navegación tardía si procede.
      } finally {
        if (!awaitingSummaryRef.current) setLoading(false);
      }
    },
    [msgs, path, navigate, speak, stopListening, bumpIdle, askAgent, onClose],
  );

  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const startListening = useCallback(() => {
    if (!openRef.current || modeRef.current !== "voice") return;
    // Máquina de estados: SOLO arrancamos si estamos en IDLE.
    // Cualquier otro estado (listening, stopping) se ignora — esto evita
    // que Android entre en bloqueo de "Preparando..." por start/stop
    // simultáneos.
    if (voiceStateRef.current !== "idle") {
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.log("VOICE STATE: skip start (not idle ->", voiceStateRef.current, ")");
      }
      // Si estamos en "stopping", reintentamos cuando vuelva a idle.
      if (voiceStateRef.current === "stopping") {
        resumeListeningAfterEcho(400);
      }
      return;
    }
    if (
      pausedRef.current ||
      loadingRef.current ||
      speakingRef.current ||
      isAgentSpeechOutputActive()
    ) {
      if (isAgentSpeechOutputActive()) resumeListeningAfterEcho();
      return;
    }
    const remainingEchoGuard = suppressRecognitionUntilRef.current - Date.now();
    if (remainingEchoGuard > 0) {
      resumeListeningAfterEcho(remainingEchoGuard + POST_SPEECH_LISTEN_DELAY_MS);
      return;
    }
    const SRClass = getSpeechRecognition();
    if (!SRClass) {
      setVoiceError("Tu navegador no soporta reconocimiento de voz. Cambia a modo texto.");
      return;
    }
    // No debería existir una instancia previa si el estado es IDLE; por
    // seguridad limpiamos handlers sin volver a llamar a stop() (ya lo hizo
    // quien dejó el estado en IDLE).
    const previousRec = recogRef.current;
    if (previousRec) {
      previousRec.onresult = null;
      previousRec.onspeechend = null;
      previousRec.onerror = null;
      previousRec.onend = null;
    }
    recogRef.current = null;

    try {
      const rec = new SRClass();
      rec.lang = "es-ES";
      rec.continuous = !hasMobileSpeechDuplicationBug();
      // Solo procesar frases finales. Los transcripts parciales rompen
      // el routing semántico ("me siento" en lugar de "me siento mal").
      rec.interimResults = false;
      let finalText = "";
      let lastTranscript = "";
      let prevTranscript = "";
      let handled = false;
      let maxTurnTimer: ReturnType<typeof setTimeout> | null = null;
      const clearMaxTimer = () => {
        if (maxTurnTimer) {
          clearTimeout(maxTurnTimer);
          maxTurnTimer = null;
        }
      };
      rec.onresult = (e: any) => {
        // Anti-eco: si el agente está hablando o cargando, descarta lo
        // captado por el micro (es el propio TTS realimentándose).
        if (
          speakingRef.current ||
          loadingRef.current ||
          isAgentSpeechOutputActive() ||
          Date.now() < suppressRecognitionUntilRef.current
        ) {
          finalText = "";
          lastTranscript = "";
          prevTranscript = "";
          setInterim("");
          if (turnTimerRef.current) {
            clearTimeout(turnTimerRef.current);
            turnTimerRef.current = null;
          }
          clearMaxTimer();
          return;
        }
        const finals: string[] = [];
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          if (result.isFinal) finals.push(result[0].transcript);
        }
        if (!finals.length) return;
        const incoming = compactRecognitionText(finals);
        if (!incoming.trim()) return;
        finalText = compactRecognitionText([finalText, incoming].filter(Boolean));
        lastTranscript = finalText.trim();
        // Si el texto no ha cambiado (Android sigue emitiendo el mismo chunk),
        // NO reiniciamos el debounce — dejamos que dispare.
        if (lastTranscript === prevTranscript) return;
        prevTranscript = lastTranscript;
        setInterim("");
        bumpIdle();
        if (turnTimerRef.current) {
          clearTimeout(turnTimerRef.current);
        }
        // Debounce: si llega texto NUEVO en los próximos 900ms, lo unimos.
        turnTimerRef.current = setTimeout(() => {
          turnTimerRef.current = null;
          finishTurn();
        }, 900);
        // Fallback máximo: pase lo que pase, procesa a los 4s desde
        // el primer chunk, aunque Android siga emitiendo ruido.
        if (!maxTurnTimer) {
          maxTurnTimer = setTimeout(() => {
            maxTurnTimer = null;
            if (lastTranscript) finishTurn();
          }, 4000);
        }
      };
      const finishTurn = () => {
        if (handled) return true;
        if (turnTimerRef.current) {
          clearTimeout(turnTimerRef.current);
          turnTimerRef.current = null;
        }
        clearMaxTimer();
        const t = compactRecognitionText([finalText || lastTranscript]);
        if (!t) return false;
        if (isLikelyAgentEcho(t, assistantSpeechMemoryRef.current)) {
          finalText = "";
          lastTranscript = "";
          prevTranscript = "";
          setInterim("");
          suppressRecognitionUntilRef.current = Date.now() + 700;
          resumeListeningAfterEcho();
          return false;
        }
        handled = true;
        setInterim("");
        // Transición a STOPPING antes de invocar stop() para evitar carreras.
        if (voiceStateRef.current === "listening") {
          setVoiceState("stopping");
          scheduleVoiceIdle(300);
        }
        try {
          rec.stop?.();
        } catch {}
        sendRef.current(t, true);
        return true;
      };
      rec.onspeechend = () => {
        if (
          speakingRef.current ||
          loadingRef.current ||
          isAgentSpeechOutputActive() ||
          Date.now() < suppressRecognitionUntilRef.current
        ) {
          finalText = "";
          lastTranscript = "";
          setInterim("");
          return;
        }
        if (!finalText.trim()) return;
        finishTurn();
      };
      rec.onerror = (e: any) => {
        setListening(false);
        // El reconocimiento ha muerto: transiciona a STOPPING y luego IDLE
        // antes de cualquier reintento (evita "Preparando..." en Android).
        if (voiceStateRef.current !== "idle") {
          setVoiceState("stopping");
          scheduleVoiceIdle(300);
        }
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") {
          setVoiceError(null);
          resumeListeningAfterEcho(900);
        } else if (e?.error === "no-speech" || e?.error === "aborted") {
          // benign — will auto-restart on end if conditions allow
        }
      };
      rec.onend = () => {
        setListening(false);
        // Transición de estado: listening → stopping → (300ms) → idle.
        if (voiceStateRef.current !== "idle") {
          setVoiceState("stopping");
          scheduleVoiceIdle(300);
        }
        if (
          speakingRef.current ||
          loadingRef.current ||
          isAgentSpeechOutputActive() ||
          Date.now() < suppressRecognitionUntilRef.current
        ) {
          finalText = "";
          lastTranscript = "";
          setInterim("");
          return;
        }
        if (finishTurn()) {
          return;
        }
        // Silence — restart listening automatically (con margen para que
        // la máquina de estados vuelva a IDLE).
        resumeListeningAfterEcho(Math.max(POST_SPEECH_LISTEN_DELAY_MS, 400));
      };
      recogRef.current = rec;
      setVoiceError(null);
      setListening(true);
      // Marcamos LISTENING justo antes de start() para que cualquier
      // start() concurrente quede bloqueado por la máquina de estados.
      setVoiceState("listening");
      try {
        rec.start();
      } catch (startErr) {
        // Android puede lanzar "InvalidStateError" si todavía está cerrando
        // una instancia previa. Volvemos a IDLE y reintentamos con margen.
        setListening(false);
        recogRef.current = null;
        setVoiceState("stopping");
        scheduleVoiceIdle(400);
        resumeListeningAfterEcho(600);
        return;
      }
    } catch (err) {
      setListening(false);
      setVoiceError(null);
      if (voiceStateRef.current !== "idle") {
        setVoiceState("stopping");
        scheduleVoiceIdle(300);
      }
      resumeListeningAfterEcho(900);
    }
  }, [resumeListeningAfterEcho, shouldAutoListen]);


  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      stopListening();
      stopSpeaking();
      setPaused(false);
      setInterim("");
      setLoading(false);
      awaitingSummaryRef.current = false;
      assistantSpeechMemoryRef.current = [getGreetingText()];
      if (recognitionRestartTimerRef.current) {
        clearTimeout(recognitionRestartTimerRef.current);
        recognitionRestartTimerRef.current = null;
      }
      if (ackTimerRef.current) {
        clearTimeout(ackTimerRef.current);
        ackTimerRef.current = null;
      }
      // Limpia caché del diálogo: el próximo se abre desde cero.
      if (typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(STORAGE_KEY);
          window.sessionStorage.removeItem("afp:fwdPrompt");
          window.sessionStorage.removeItem("afp:openSubmenu");
          window.sessionStorage.removeItem("afp:voiceFoodSummaryPending");
        } catch {}
      }
      setMsgs([makeGreeting()]);
    }
  }, [open, stopListening, stopSpeaking]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setMode("voice");
      setMuted(false); // A2: voz por defecto al abrir → no muted
      setPaused(false);
      setVoiceError(null);
      bumpIdle();
    }
    if (!open && wasOpenRef.current) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    }
    wasOpenRef.current = open;
  }, [open, bumpIdle]);

  // Hands-free bootstrap: when opening in voice mode, ensure we end up listening.
  // The greeting is spoken synchronously by the FAB onClick (so the browser
  // accepts it as a user-gesture action). Here we just kick off listening
  // once any in-flight speech finishes.
  const greetedRef = useRef(__vaGetGreetingSpoken());
  const bootSpeechWasActiveRef = useRef(false);
  useEffect(() => {
    if (!open || mode !== "voice") return;
    if (__vaGetGreetingSpoken()) greetedRef.current = true;
    const SRClass = getSpeechRecognition();
    if (!SRClass) {
      setVoiceError("Tu navegador no soporta reconocimiento de voz. Cambia a modo texto.");
      return;
    }
    const synth = window.speechSynthesis;
    let cancelled = false;

    const tryStart = () => {
      if (cancelled) return;
      // Si el agente aún está hablando (saludo TTS), NO arrancamos el
      // reconocedor: evitamos el bucle de eco donde el micro capta nuestra
      // propia voz y la reenvía como mensaje de usuario.
      const stillSpeaking = Boolean(
        (synth && (synth.speaking || synth.pending || __vaActiveUtterance)) || __vaActiveAudio,
      );
      speakingRef.current = stillSpeaking;
      setSpeaking(stillSpeaking);
      if (stillSpeaking) {
        bootSpeechWasActiveRef.current = true;
        setTimeout(tryStart, 300);
        return;
      }
      if (bootSpeechWasActiveRef.current) {
        bootSpeechWasActiveRef.current = false;
        suppressRecognitionUntilRef.current = Date.now() + POST_SPEECH_LISTEN_DELAY_MS;
        resumeListeningAfterEcho();
        return;
      }
      if (shouldAutoListen()) startListening();
    };

    // Arrancamos en el siguiente tick para no pisar el gesto de click.
    const t = setTimeout(tryStart, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  if (!open) return null;
  const isVoice = true;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex justify-center px-3">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur">
        <div
          className={cn(
            "relative grid h-12 w-12 place-items-center rounded-full text-primary-foreground transition",
            paused
              ? "bg-muted text-muted-foreground"
              : listening
                ? "bg-red-500 ring-4 ring-red-500/30 animate-pulse"
                : speaking
                  ? "bg-orange-500 ring-4 ring-orange-500/30"
                  : loading
                    ? "bg-primary ring-2 ring-primary/30"
                    : "bg-gradient-to-br from-primary to-orange-500 ring-2 ring-primary/20",
          )}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : paused ? (
            <MicOff className="h-5 w-5" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-foreground">
            {paused
              ? "en pausa"
              : speaking
                ? "hablando…"
                : listening
                  ? "te escucho"
                  : loading
                    ? "pensando…"
                    : "preparando…"}
          </p>
          {interim && (
            <p className="truncate text-[11px] italic text-muted-foreground">"{interim}…"</p>
          )}
        </div>

        <button
          onClick={() => {
            iniciarAudio();
            if (paused) {
              primeSpanishUtterances();
              setVoiceError(null);
              setPaused(false);
              setTimeout(() => startListeningRef.current(), POST_SPEECH_LISTEN_DELAY_MS);
            } else {
              setPaused(true);
              stopListening();
              stopSpeaking();
            }
          }}
          aria-label={paused ? "Reanudar" : "Pausar"}
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted"
        >
          {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button
          onClick={() =>
            setMuted((v) => {
              if (!v) stopSpeaking();
              return !v;
            })
          }
          aria-label={muted ? "Activar voz" : "Silenciar voz"}
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <button
          onClick={() => {
            stopListening();
            stopSpeaking();
            onClose();
          }}
          aria-label="Cerrar"
          className="flex h-9 w-9 items-center justify-center rounded-full border bg-background text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>

        <div ref={scrollRef} className="hidden" />
      </div>
    </div>
  );

}

export function AgenteVamosFab() {
  const [open, setOpen] = useState(false);
  const voiceBootStartedRef = useRef(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    ["/login", "/magic", "/welcome"].includes(path) || path.startsWith("/business/login");
  if (hidden) return null;

  const playGreetingAfterPermission = () => {
    try {
      const greetText = getGreetingText();
      unlockSpeechFromUserGesture();
      const greetAudio = new Audio(audioSrc(getGreetingClip()));
      greetAudio.preload = "auto";
      greetAudio.volume = 1;
      __vaActiveAudio = greetAudio;
      __vaActiveAudioStartedAt = Date.now();
      __vaSetGreetingSpoken(true);
      greetAudio.onended = () => {
        if (__vaActiveAudio === greetAudio) __vaActiveAudio = null;
        __vaActiveAudioStartedAt = 0;
      };
      greetAudio.onerror = () => {
        if (__vaActiveAudio === greetAudio) __vaActiveAudio = null;
        __vaActiveAudioStartedAt = 0;
      };
      const audioStarted = greetAudio.play();
      if (audioStarted && typeof audioStarted.catch === "function") {
        audioStarted.catch(() => {
          if (__vaActiveAudio === greetAudio) __vaActiveAudio = null;
          __vaActiveAudioStartedAt = 0;
          const synth = window.speechSynthesis;
          if (!synth) return;
          const u = new SpeechSynthesisUtterance(greetText);
          u.lang = "es-ES";
          u.rate = 1.05;
          u.pitch = 1;
          const voice = pickSpanishVoice(synth);
          if (voice) u.voice = voice;
          __vaActiveUtterance = u;
          u.onend = () => {
            __vaActiveUtterance = null;
          };
          u.onerror = () => {
            __vaActiveUtterance = null;
          };
          synth.cancel();
          synth.resume();
          synth.speak(u);
        });
      }
      if (window.speechSynthesis) window.speechSynthesis.resume();
      primeSpanishUtterances();
    } catch {
      /* noop */
    }
  };

  const startGreetingFromUserGesture = () => {
    if (voiceBootStartedRef.current) return;
    voiceBootStartedRef.current = true;
    playGreetingAfterPermission();
  };

  // Permitir abrir el agente desde otros botones (p.ej. el micro del chat)
  // El listener corre síncrono dentro del click handler externo, así que
  // sigue siendo un gesto de usuario válido para getUserMedia.
  useEffect(() => {
    const handler = () => {
      if (!voiceBootStartedRef.current) startGreetingFromUserGesture();
      setOpen(true);
    };
    window.addEventListener("vamos:open", handler);
    return () => window.removeEventListener("vamos:open", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AgenteVamosPanel
        open={open}
        onClose={() => {
          voiceBootStartedRef.current = false;
          setOpen(false);
        }}
      />
    </>
  );
}
