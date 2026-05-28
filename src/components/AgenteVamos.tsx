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
import { logAgentInteraction } from "@/lib/agent/agent-runtime.functions";
import { listAgenteRespuestas } from "@/lib/agente-respuestas.functions";
import {
  loadAgenteRoutingCatalog,
  type AgenteIntentRow,
  type AgenteRoutingCatalog,
  type AgenteSubcategory,
} from "@/lib/agente-intents.functions";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

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
    path: "/nocturno",
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
    reply: "Aquí tienes el mapa interactivo de playas. Llámame luego si quieres más información.",
    path: "/playas/mapa",
    audio: "beach_map",
  },

  {
    keys: [
      "planificar ruta", "planificador", "como llego", "como voy a", "llegar a",
      "ir a", "llevarme a", "ruta hasta", "trayecto",
    ],
    reply: "Te llevo al selector de transporte para elegir el medio adecuado.",
    path: "/transporte",
    audio: "planner",
  },
  {
    keys: [
      "bus", "buses", "emt", "autobus", "autobuses", "transporte publico",
      "linea de bus", "parada",
    ],
    reply: "Te llevo al selector de transporte.",
    path: "/transporte",
    audio: "bus",
  },
  // (vuelos se gestiona como dominio para abrir el submenú "Vuelos" en
  // pantalla, en vez de saltar directo al dashboard de salidas)

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
    reply: "Te abro la cartelera de cines. Si ya sabes la película que quieres ver, podemos buscar la sala y la hora. Si aún no has decidido cuál película ver, aquí tienes la cartelera: la puedes revisar y, posteriormente, me avisas y buscamos la sala de cine y la hora.",
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
  // Si está presente, al enrutar al hub abrimos también este submenú de
  // la pantalla destino (sincroniza el selector con la decisión del agente).
  openSubmenuKey?: string;
  followups: { keys: string[]; path: string; label?: string }[];
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
    question: "Te abro la sección de salud para que elijas en pantalla.",
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
      "sitio para comer", "algo de comer", "me apetece comer", "me apetece",
      "donde como", "donde ceno", "donde almuerzo", "donde desayuno",
      "donde puedo comer", "donde puedo cenar", "donde puedo almorzar",
      "quiero comer", "quiero cenar", "quiero almorzar", "quiero desayunar",
      "quiero picar", "quiero tapear",
      "ir a cenar", "ir a comer", "ir a desayunar",
      "salir a comer", "salir a cenar", "salir a tapear",
      "necesito comer", "tengo antojo", "se me antoja",
      "buen sitio para comer", "buen sitio para cenar",
      "recomienda restaurante", "recomiendame un restaurante", "recomiéndame un restaurante",
      "comer", "comida", "hambre", "almuerzo", "almorzar",
      "desayuno", "desayunar", "brunch", "merienda", "merendar",
      "cena", "cenar", "tapeo", "tapear", "tapas", "picar algo",
      "restaurante", "restaurantes", "bocata", "bocadillo",
      // platos y cocinas frecuentes — disparan dominio comer
      "arroz", "arroces", "paella", "fideua", "fideuá",
      "pescado", "marisco", "mariscada",
      "pizza", "pizzas", "pasta", "italiano",
      "sushi", "ramen", "japones", "japonés", "asiatico", "asiático",
      "hamburguesa", "hamburguesas", "burger",
      "kebab", "tacos", "mexicano", "hindu", "hindú", "indio",
      "cafe", "café", "cafeteria", "cafetería",
    ],
    question: "Te llevo a la sección para comer; elige el tipo en pantalla.",
    audio: "eat",
    openSubmenuKey: "comer",
    followups: [
      { keys: ["restaurante", "restaurantes", "cenar", "almorzar", "desayunar"], path: "/" },
      { keys: ["tapas", "tapeo", "picar"], path: "/" },
      { keys: ["paella", "arroz"], path: "/" },
      { keys: ["rapido", "fast", "hamburguesa", "pizza"], path: "/" },
    ],
  },
  {
    id: "transporte",
    hubPath: "/transporte",
    triggers: [
      "quiero moverme", "necesito moverme", "como me muevo", "quiero desplazarme",
      "tengo que ir", "necesito ir", "como llego", "como voy",
      "como puedo ir", "como puedo llegar", "como se llega", "como se va",
      "quiero ir", "voy a ", "voy al ", "tengo que ir a", "tengo que ir al",
      "ir a ", "ir al ", "ir hasta", "llegar a ", "llegar al ", "llegar hasta",
      "ir hacia", "desplazarme", "moverme",
      "ir en bus", "ir en tram", "ir en tranvia", "ir en tranvía",
      "ir en autobus", "ir en autobús", "ir en tren", "ir en taxi", "ir en coche",
      "coger el tram", "coger tram", "tomar el tram", "tomar tram",
      "coger el tranvia", "coger el tranvía", "tomar el tranvia", "tomar el tranvía",
      "coger un taxi", "pedir un taxi", "coger el tren", "tomar el tren",
      "quiero coger el tram", "quiero coger tram", "quiero tomar el tram",
      "como llegar", "que bus", "qué bus", "que tram", "qué tram",
      // medios de transporte (incluye los aún no desarrollados)
      "tren", "trenes", "renfe", "cercanias", "cercanías", "ave",
      "taxi", "taxis", "uber", "cabify", "vtc",
      "metro", "tranvia", "tranvía", "tram",
      "alquilar coche", "rent a car", "rentacar",
      "alsa", "autocar", "autocares",
      // destinos típicos que implican transporte (sin aeropuerto)
      "estacion de tren", "estación de tren",
      "playa san juan", "san juan playa",
      "universidad", "campus", "hospital general",
      "transporte", "transporte publico", "transporte público",
    ],
    question: "Te abro el menú de transporte; elige el medio en pantalla.",
    audio: "bus",
    followups: [],
  },
  {
    id: "vuelos",
    hubPath: "/vuelos",
    triggers: [
      "vuelo", "vuelos", "aeropuerto", "aena", "avion", "aviones", "avión", "alc",
      "salida de vuelo", "llegada de vuelo", "salidas de vuelos", "llegadas de vuelos",
      "facturar", "facturacion", "facturación", "check in", "check-in", "checkin",
      "el altet", "al altet", "al aeropuerto", "ir al aeropuerto", "ir en avion", "ir en avión",
      "volar", "quiero volar", "tomar un vuelo", "coger un vuelo", "coger un avion", "coger un avión",
      "viajar en avion", "viajar en avión", "viajar por avion", "viajar por avión",
      "viaje en avion", "viaje en avión", "billete de avion", "billete de avión",
      "pasaje de avion", "pasaje de avión", "salir en avion", "salir en avión",
      "llegar en avion", "llegar en avión", "terminal", "puerta de embarque", "embarque", "aerolinea", "aerolínea",
    ],
    question: "Te abro el menú de vuelos; elige en pantalla.",
    audio: "flights",
    followups: [],
  },

  {
    id: "transporte_bus",
    hubPath: "/transporte",
    triggers: [
      "bus", "buses", "autobus", "autobuses", "emt", "vectalia",
      "linea de bus", "parada", "parada de bus", "bus urbano", "buses urbanos",
    ],
    question: "Te abro el selector de transporte multimodal; elige el medio en pantalla.",
    audio: "bus",
    followups: [],
  },

  {
    id: "bus_known",
    hubPath: "action:bus-picker",
    triggers: [],
    question: "Te abro el selector de líneas de bus.",
    audio: "bus",
    followups: [
      { keys: ["no se", "no sé", "ayuda", "ayudame", "ayúdame", "no lo se", "no lo sé"], path: "action:bus-picker" },
    ],
  },
  {
    id: "tram_pick",
    hubPath: "/tram",
    triggers: [],
    question: "Te abro el TRAM; elige la estación en pantalla.",
    audio: "bus",
    followups: [
      { keys: [
          "no se", "no sé", "no lo se", "no lo sé", "ni idea", "ns",
          "no estoy seguro", "no estoy segura", "no sabria", "no sabría",
          "ayuda", "ayudame", "ayúdame", "no sabria decirte", "cualquiera",
          "no se a donde", "no sé a dónde", "no se a donde ir", "no sé a dónde ir",
          "no se donde ir", "no sé dónde ir", "donde puedo ir", "dónde puedo ir",
          "que opciones", "qué opciones", "opciones", "sugiere", "sugiéreme", "sugiereme",
        ], path: "action:tram-quick-destinations" },
    ],
  },
  {
    id: "tram_origin_confirm",
    hubPath: "/tram",
    triggers: [],
    question: "Confirma la parada de origen en pantalla.",
    audio: "bus",
    followups: [
      { keys: [
          "si", "sí", "vale", "ok", "okay", "perfecto", "claro", "dale",
          "desde ahi", "desde ahí", "desde esa", "esa", "esa misma",
          "esa esta bien", "esa está bien", "esa me sirve", "me sirve",
          "confirmo", "confirmar", "ahi", "ahí",
          "afirmativo", "afirmativa", "correcto", "exacto",
        ], path: "action:tram-confirm-suggested" },
      { keys: [
          "otra", "otra estacion", "otra estación", "otra parada",
          "prefiero otra", "cambiar", "cambiar origen", "diferente",
          "no", "mejor otra", "elegir otra",
        ], path: "action:tram-pick-origin" },
    ],
  },
  {
    id: "fiestas",
    hubPath: "/fiestas",
    triggers: [
      "quiero fiesta", "ir de fiesta", "salir de fiesta",
      "fiesta", "fiestas", "hoguera", "hogueras", "san juan",
      "moros y cristianos", "moros", "cristianos", "fogueres",
      "porrate", "porraet", "porratés",
      "programa de fiestas", "programa fiestas", "que se celebra", "qué se celebra",
      "agenda festiva", "fiesta popular", "fiestas populares",
      "verbena", "verbenas", "procesion", "procesión",
    ],
    question: "Te abro fiestas; elige la categoría en pantalla.",
    audio: "leisure",
    followups: [
      { keys: ["hoguera", "hogueras", "san juan", "fogueres"], path: "/fiestas" },
      { keys: ["moros", "cristianos", "moros y cristianos"], path: "/fiestas" },
      { keys: ["programa", "agenda"], path: "/fiestas" },
    ],
  },
  {
    id: "tomar_algo",
    hubPath: "/nocturno",
    triggers: [
      // Bailar / discoteca
      "bailar", "ir a bailar", "salir a bailar", "irnos a bailar", "vamos a bailar", "baile", "bailoteo", "bailongo",
      "discoteca", "discotecas", "disco", "club", "clubs", "club nocturno", "antro", "antros",
      "boliche", "boliches", "boite", "after", "afters", "afterhours",
      "reguetón", "reggaeton", "electrónica", "electronica", "techno", "salsa", "bachata",
      "sesión", "sesion", "sessions", "dj", "pista", "pista de baile",
      // Vida nocturna / fiesta
      "vida nocturna", "noche", "esta noche", "salir esta noche", "salir de noche", "noche alicantina", "noche loca",
      "fiesta", "fiestón", "fiestas", "fiesta nocturna", "salir de fiesta", "irse de fiesta", "party", "partiendo",
      "marcha", "de marcha", "irse de marcha", "salir de marcha", "movida", "movidón",
      "ambiente", "ambientazo", "ambiente nocturno", "ambiente de noche",
      "juerga", "juerguearse", "farra", "farrear", "parranda", "parrandear",
      "rumba", "rumbear", "carrete", "pachanga", "jarana", "peda", "reventón", "reventon", "reventar",
      "desmadre", "descontrol", "descontrolarse",
      // Beber / copas
      "tomar algo", "tomarse algo", "tomarnos algo", "salir a tomar", "ir a tomar", "quedar para tomar algo",
      "tomar una copa", "tomar unas copas", "una copa", "unas copas",
      "irme de copas", "irnos de copas", "salir de copas", "ir de copas",
      "cerveza", "cervezas", "una cerveza", "unas cervezas", "cerveza fría", "cerveza fria",
      "birra", "birras", "chela", "chelas", "pola", "polas", "fría", "frias", "frías", "una fría",
      "caña", "cañas", "una caña", "una caña fría", "unas cañas", "tercio", "tercios", "quinto", "quintos",
      "jarra", "jarra de cerveza", "pinta", "pintas",
      "vermut", "vermú", "vermouth", "vino", "vinos", "copa de vino", "vinoteca",
      "tinto", "blanco", "rosado", "cava", "champán", "champan", "champagne",
      "cóctel", "coctel", "cócteles", "cocteles", "coctelería", "cocteleria", "coctelerías",
      "gin tonic", "gintonic", "mojito", "mojitos", "daiquiri", "margarita", "caipirinha",
      "sangría", "sangria", "tinto de verano", "kalimotxo", "calimocho",
      "chupito", "chupitos", "shot", "shots", "trago", "tragos",
      "cubata", "cubatas", "combinado", "combinados", "copazo", "palo", "palos",
      // Lugares
      "bar", "bares", "bar de copas", "pub", "pubs", "taberna", "tabernas", "tasca", "tascas", "cantina", "cantinas",
      "cervecería", "cerveceria", "cervecerías", "brewery", "beer garden", "cocktail bar",
      "terraza", "terrazas", "rooftop", "azotea", "chiringuito", "chiringuitos", "beach club", "beach bar",
      "karaoke", "pub karaoke", "bar de tapas y copas", "gastropub", "speakeasy",
      // Estados / intención
      "emborracharse", "borrachera", "borracho", "borrachos", "pedo", "ciego",
      "mamado", "mamarse", "ponerse pedo", "ponerse ciego", "ponerse las botas",
      "liarla", "liarse", "liarse la manta", "desfasar", "desfase",
      // Genéricos
      "beber", "bebida", "bebidas", "alcohol", "botellón", "botellon", "música en vivo", "musica en vivo",
    ],
    question: "Te abro el Dashboard Nocturno; elige el ambiente en pantalla.",
    audio: "leisure",
    followups: [
      { keys: ["terraza", "terrazas", "azotea", "rooftop"], path: "/nocturno" },
      { keys: ["pub", "pubs", "bar", "bares", "cerveza", "cervezas", "copa", "copas", "birra", "birras"], path: "/nocturno" },
      { keys: ["discoteca", "discotecas", "club", "clubs", "disco"], path: "/nocturno" },
      { keys: ["musica en vivo", "música en vivo", "concierto", "directo", "live"], path: "/ocio/conciertos" },
    ],
  },
  {
    id: "ocio",
    hubPath: "/ocio",
    triggers: [
      "quiero salir", "quiero hacer algo", "me aburro", "estoy aburrido",
      "estoy aburrida", "no se que hacer", "no sé qué hacer", "algo divertido",
      "que hago hoy", "qué hago hoy", "que hago esta tarde", "qué hago esta tarde",
      "que hacemos esta noche", "qué hacemos esta noche",
      "que puedo hacer", "qué puedo hacer", "diversion", "diversión", "divertirme",
      "plan", "planes", "que ver", "qué ver", "que visitar", "qué visitar",
      "ocio", "tiempo libre", "actividades", "panorama",
      // sub-temas genéricos que activan el hub ocio (no específicos: cine, teatro,
      // conciertos y fiestas tienen su propio intent directo arriba y no deben
      // pasar por la pregunta de desambiguación)
      "exposicion", "exposición", "museo", "museos", "cultura",
    ],
    question: "Te abro ocio; elige la categoría en pantalla.",
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
      "tomar el sol", "nadar en el mar", "ir a la playa", "ir a las playas",
      "playa", "playas", "arena", "calita", "calitas", "cala", "calas",
      "playas cerca", "playa cercana", "mejor playa", "mejores playas",
      "bandera azul", "playa con duchas", "playa accesible",
      "postiguet", "san juan", "san gabriel", "albufereta", "almadraba",
      "que playa", "qué playa", "playa para hoy",
    ],
    question: "Te abro playas; elige carrusel o mapa en pantalla.",
    audio: "beaches",
    followups: [
      { keys: ["mapa", "mapa interactivo", "interactivo", "ver en mapa", "abrir mapa"], path: "/playas/mapa", label: "mapa" },
      { keys: [
          "carrusel", "carousel", "scroll", "fotos", "deslizar", "desliza",
          "listado", "lista", "todas", "cuales", "cuáles", "playas", "playa",
          "si", "sí", "vale", "ok", "okay", "perfecto", "claro", "correcto",
          "exacto", "afirmativo", "afirmativa", "de acuerdo", "dale", "confirmo",
        ], path: "/playas?focus=carrusel", label: "carrusel" },
    ],
  },

  {
    id: "dormir",
    hubPath: "/donde-dormir",
    triggers: [
      "pasar la noche", "necesito cama", "busco cama", "sitio para dormir",
      "donde duermo", "dónde duermo", "donde me quedo", "dónde me quedo",
      "donde dormir", "dónde dormir", "donde puedo dormir",
      "necesito alojamiento", "busco alojamiento", "alojamiento",
      "hotel", "hoteles", "hostal", "hostales", "hostel", "hostels",
      "apartamento", "apartamentos", "airbnb", "bnb",
      "pension", "pensión", "pensiones", "albergue", "albergues",
      "habitacion", "habitación", "reservar hotel", "buscar hotel",
      "donde alojarme", "dónde alojarme", "alojarme",
    ],
    question: "Te abro alojamiento; elige el tipo en pantalla.",
    audio: "hotel",
    followups: [
      { keys: ["hotel", "hoteles"], path: "/donde-dormir" },
      { keys: ["hostal", "hostel"], path: "/donde-dormir" },
      { keys: ["apartamento", "airbnb"], path: "/donde-dormir" },
    ],
  },
  {
    id: "compras",
    hubPath: "/comprar",
    triggers: [
      "quiero comprar", "ir de compras", "necesito comprar", "tengo que comprar",
      "comprar", "compras", "compra", "tiendas", "tienda", "comercio", "comercios",
      "centro comercial", "centros comerciales", "shopping", "shoppear",
      "adquirir", "quiero adquirir", "necesito adquirir",
      "boutique", "boutiques", "mercado", "mercadillo",
      "donde comprar", "dónde comprar",
    ],
    question: "Te abro compras; elige el sector en pantalla.",
    audio: "fallback",
    followups: [],
  },
  {
    id: "mapa",
    hubPath: "/playas/mapa",
    triggers: [
      "mapa", "ver mapa", "abrir mapa", "mapa de alicante",
      "mapa interactivo", "mapa de playas", "mapa de la ciudad",
      "mapa playa", "mapa playas",
    ],
    question: "Te abro el mapa interactivo.",
    audio: "beaches",
    followups: [],
  },


  {
    id: "clima",
    hubPath: "/clima",
    triggers: [
      "clima", "tiempo", "que tiempo hace", "qué tiempo hace",
      "como esta el tiempo", "cómo está el tiempo",
      "como esta el clima", "cómo está el clima",
      "llueve", "va a llover", "lluvia", "esta lloviendo", "está lloviendo",
      "sol", "hace sol", "calor", "hace calor", "frio", "frío", "hace frio", "hace frío",
      "temperatura", "grados", "humedad", "viento", "tormenta",
      "pronostico", "pronóstico", "pronostico del tiempo", "pronóstico del tiempo",
      "previsión", "prevision", "previsión meteorológica",
    ],
    question: "🌤️ Te llevo al clima de Alicante.",
    audio: "fallback",
    followups: [],

  },
  {
    id: "perfil",
    hubPath: "/perfil",
    triggers: [
      "perfil", "mi perfil", "mi cuenta", "mi usuario", "mis datos",
      "mis favoritos", "favoritos", "mis reservas", "mis ajustes", "ajustes",
      "configuracion", "configuración", "preferencias",
      "cerrar sesion", "cerrar sesión", "logout", "iniciar sesion", "iniciar sesión", "login",
    ],
    question: "👤 Te llevo a tu perfil.",
    audio: "fallback",
    followups: [],
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

// =================== TRAM stops (catálogo en memoria) ===================
type TramStopEntry = { stop_id: string; stop_name: string; norm: string; lat?: number; lng?: number };
let TRAM_STOPS_CACHE: TramStopEntry[] = [];
function setTramStopsCache(stops: Array<{ stop_id: string; stop_name: string; stop_lat?: number; stop_lon?: number }>) {
  TRAM_STOPS_CACHE = stops
    .map((s) => ({
      stop_id: s.stop_id,
      stop_name: s.stop_name,
      norm: normalizeSpeech(s.stop_name),
      lat: typeof s.stop_lat === "number" ? s.stop_lat : undefined,
      lng: typeof s.stop_lon === "number" ? s.stop_lon : undefined,
    }))
    .filter((s) => s.norm.length >= 3)
    .sort((a, b) => b.norm.length - a.norm.length);
}

// Distancia haversine en km entre dos puntos (lat/lng).
function tramDistanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Lee las últimas coords cacheadas por el hook de geolocalización.
function readCachedCoords(): { lat: number; lng: number } | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const parsed = JSON.parse(localStorage.getItem("geo:last-coords") ?? "null") as
      | { lat?: number; lng?: number; savedAt?: number }
      | null;
    if (!parsed || typeof parsed.lat !== "number" || typeof parsed.lng !== "number") return null;
    if (parsed.savedAt && Date.now() - parsed.savedAt > 12 * 60 * 60 * 1000) return null;
    return { lat: parsed.lat, lng: parsed.lng };
  } catch {
    return null;
  }
}
const TRAM_TRIGGER_RE = /\b(tram|tranvia|tranvias)\b/;
const TRAM_ALIAS_STOPS: Array<{ aliases: string[]; stop_id: string; stop_name: string }> = [
  { aliases: ["benidorm"], stop_id: "33", stop_name: "Benidorm" },
  { aliases: ["playa san juan", "playa de san juan", "san juan playa"], stop_id: "108", stop_name: "Av. Benidorm / Platja de San Joan" },
  { aliases: ["luceros", "plaza luceros"], stop_id: "2", stop_name: "Alicante - Luceros" },
  { aliases: ["mercado"], stop_id: "3", stop_name: "Mercado" },
  { aliases: ["marq", "castillo"], stop_id: "4", stop_name: "MARQ - CASTILLO" },
  { aliases: ["hospital"], stop_id: "117", stop_name: "Hospital" },
  { aliases: ["universidad", "universitat"], stop_id: "123", stop_name: "Universitat" },
  { aliases: ["san vicente", "san vicente del raspeig", "sant vicent"], stop_id: "124", stop_name: "Sant Vicent del Raspeig" },
  { aliases: ["albufereta"], stop_id: "7", stop_name: "Albufereta" },
  { aliases: ["muchavista"], stop_id: "12", stop_name: "Muchavista" },
  { aliases: ["campello", "el campello"], stop_id: "17", stop_name: "El Campello" },
  { aliases: ["villajoyosa", "la vila joiosa", "vila joiosa"], stop_id: "27", stop_name: "La Vila Joiosa" },
  { aliases: ["puerta del mar", "porta del mar"], stop_id: "101", stop_name: "Porta del Mar" },
];

function matchTramQuery(query: string): {
  destId: string; destName: string; originId?: string; originName?: string;
} | null {
  if (!TRAM_TRIGGER_RE.test(query)) return null;
  const hits: Array<(TramStopEntry & { idx: number }) | { stop_id: string; stop_name: string; norm: string; idx: number }> = [];
  for (const s of TRAM_STOPS_CACHE) {
    const idx = query.indexOf(s.norm);
    if (idx < 0) continue;
    if (hits.some((h) => idx < h.idx + h.norm.length && idx + s.norm.length > h.idx)) continue;
    hits.push({ ...s, idx });
  }
  for (const s of TRAM_ALIAS_STOPS) {
    for (const alias of s.aliases) {
      const norm = normalizeSpeech(alias);
      const idx = query.indexOf(norm);
      if (idx < 0 || hits.some((h) => h.stop_id === s.stop_id)) continue;
      if (hits.some((h) => idx < h.idx + h.norm.length && idx + norm.length > h.idx)) continue;
      hits.push({ stop_id: s.stop_id, stop_name: s.stop_name, norm, idx });
    }
  }
  if (!hits.length) return null;
  hits.sort((a, b) => a.idx - b.idx);
  if (hits.length === 1) return { destId: hits[0].stop_id, destName: hits[0].stop_name };
  let origin = hits[0];
  let dest = hits[1];
  const desdeIdx = query.indexOf("desde");
  if (desdeIdx >= 0) {
    const sorted = [...hits].sort((a, b) => Math.abs(a.idx - desdeIdx) - Math.abs(b.idx - desdeIdx));
    origin = sorted[0];
    dest = hits.find((h) => h.stop_id !== origin.stop_id) ?? hits[1];
  }
  return {
    destId: dest.stop_id, destName: dest.stop_name,
    originId: origin.stop_id, originName: origin.stop_name,
  };
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

function domainFromPath(pathname: string): string | null {
  const cleanPath = pathname.split("?")[0];
  const domain = DOMAINS.find((d) => {
    if (!d.hubPath || d.hubPath === "/" || d.hubPath.startsWith("action:")) return false;
    return cleanPath === d.hubPath || cleanPath.startsWith(`${d.hubPath}/`);
  });
  return domain?.id ?? null;
}

const ACTIVE_DOMAIN_KEY = "va:active-domain";
const ACTIVE_DOMAIN_TS_KEY = "va:active-domain-ts";
const ACTIVE_DOMAIN_TTL_MS = 10 * 60 * 1000;

function readStoredActiveDomain(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const domain = window.sessionStorage.getItem(ACTIVE_DOMAIN_KEY);
    const ts = Number(window.sessionStorage.getItem(ACTIVE_DOMAIN_TS_KEY) ?? "0");
    if (!domain || !DOMAINS.some((d) => d.id === domain)) return null;
    if (ts && Date.now() - ts > ACTIVE_DOMAIN_TTL_MS) {
      window.sessionStorage.removeItem(ACTIVE_DOMAIN_KEY);
      window.sessionStorage.removeItem(ACTIVE_DOMAIN_TS_KEY);
      return null;
    }
    return domain;
  } catch {
    return null;
  }
}

function writeStoredActiveDomain(domain: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!domain) {
      window.sessionStorage.removeItem(ACTIVE_DOMAIN_KEY);
      window.sessionStorage.removeItem(ACTIVE_DOMAIN_TS_KEY);
      return;
    }
    window.sessionStorage.setItem(ACTIVE_DOMAIN_KEY, domain);
    window.sessionStorage.setItem(ACTIVE_DOMAIN_TS_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}

// ─── DETECCIÓN DE DICOTOMÍA DE CONTEXTO ───────────────────────────────
// Cuando la frase del usuario mezcla un verbo de movimiento ("ir a",
// "voy a", "llévame"...) con otro dominio (comer/playas/dormir/...) o
// con una entidad nombrada, NO decidimos por él: repreguntamos.
const TRANSPORT_VERB_HINTS = [
  "ir a ", "ir al ", "ir hasta", "ir hacia",
  "voy a ", "voy al ", "vamos a ", "vamos al ",
  "llevame", "llévame", "llevarme", "llévarme",
  "llegar a ", "llegar al ", "llegar hasta",
  "moverme", "desplazarme",
  "como llego", "cómo llego", "como voy", "cómo voy",
  "tengo que ir", "necesito ir", "quiero ir",
];
function hasTransportVerb(q: string): boolean {
  return TRANSPORT_VERB_HINTS.some((v) => q.includes(normalizeSpeech(v)));
}
const EXPLICIT_TRANSPORT_MODE_RE = /(^|\s)(tram|tranv\w*|bus|buses|autobus\w*|autobús\w*|metro|taxi|tren|renfe|emt|alsa|vectalia)(\s|$)/;
const OTHER_DOMAIN_HINTS: Array<{ id: string; label: string; keys: string[] }> = [
  { id: "comer", label: "comer", keys: ["comer", "comida", "restaurante", "restaurantes", "tapas", "almorzar", "cenar", "desayunar", "tapear"] },
  { id: "dormir", label: "alojarte", keys: ["dormir", "hotel", "hoteles", "alojamiento", "hospedaje", "alojarme", "hostal"] },
  { id: "playas", label: "playa", keys: ["playa", "playas", "cala", "calas", "arena"] },
  { id: "compras", label: "comprar", keys: ["comprar", "tienda", "tiendas", "mercado", "centro comercial"] },
  { id: "ocio", label: "ocio", keys: ["cine", "cines", "teatro", "concierto", "ocio", "pelicula", "película"] },
  { id: "fiestas", label: "fiestas", keys: ["fiesta", "fiestas", "hogueras", "mascleta"] },
  { id: "tomar_algo", label: "tomar algo", keys: ["copa", "copas", "cerveza", "tomar algo", "bar", "bares", "pub", "pubs"] },
  { id: "salud", label: "salud", keys: ["farmacia", "farmacias", "hospital", "hospitales", "medico", "médico", "urgencias"] },
];
function findOtherDomainHint(q: string): { id: string; label: string } | null {
  for (const d of OTHER_DOMAIN_HINTS) {
    for (const k of d.keys) {
      const n = normalizeSpeech(k);
      if (!n) continue;
      const re = n.includes(" ")
        ? new RegExp(n)
        : new RegExp(`(^|\\s)${n}(\\s|$)`);
      if (re.test(q)) return { id: d.id, label: d.label };
    }
  }
  return null;
}
function explicitlySwitchesAwayFromTram(q: string): boolean {
  return /\b(comer|comida|restaurante|restaurantes|cenar|almorzar|desayunar|hotel|hoteles|alojamiento|alojarme|dormir|playa|playas|cala|calas|turismo|visitar|cine|teatro|farmacia|comprar|tienda|fiesta|concierto|copa|cerveza)\b/.test(q);
}
function detectAmbiguity(query: string): LocalResult | null {
  if (EXPLICIT_TRANSPORT_MODE_RE.test(query)) return null;
  if (!hasTransportVerb(query)) return null;
  const other = findOtherDomainHint(query);
  const entity = matchNamedEntity(query);
  if (other?.id === "compras" && !entity) {
    const comprasDomain = DOMAINS.find((d) => d.id === "compras");
    return {
      reply: comprasDomain?.question ?? "Te abro compras.",
      path: comprasDomain?.hubPath ?? "/comprar",
      audio: comprasDomain?.audio ?? "fallback",
      pendingDomain: null,
    };
  }
  if (!other && !entity) return null;
  const opts: string[] = [];
  if (entity) {
    const name = entity.aliases[0] ?? "ese sitio";
    opts.push(`abrirte ese sitio concreto (${name})`);
  }
  if (other && (!entity || other.id !== "dormir")) {
    opts.push(`ver opciones de ${other.label}`);
  }
  opts.push("decirte cómo llegar (bus o TRAM)");
  return {
    reply: `He notado varias intenciones en tu mensaje. ¿Qué prefieres: ${opts.join("; o ")}?`,
    audio: "fallback",
    pendingDomain: null,
  };
}

function matchFollowup(query: string, domain: DomainSpec): { path: string; label?: string } | null {
  let best: { path: string; label?: string } | null = null;
  let bestLen = 0;
  for (const f of domain.followups) {
    for (const k of f.keys) {
      const n = normalizeSpeech(k);
      const matches = n.includes(" ") || n.length > 3
        ? query.includes(n)
        : new RegExp(`(^|\\s)${n}(\\s|$)`).test(query);
      if (n && matches && n.length > bestLen) {
        best = { path: f.path, label: f.label };
        bestLen = n.length;
      }
    }
  }
  return best;
}

function isAffirmativeResponse(query: string): boolean {
  return /^(si|sí|s[ií] claro|vale|ok|okay|perfecto|claro|correcto|exacto|afirmativo|afirmativa|de acuerdo|dale|confirmo)$/i.test(query.trim());
}

// ─── DB Intents (agente_intents) ──────────────────────────────────────
// Mapa: cuando un intent de BD coincida y SU dominio tenga clarificación
// definida en DOMAINS, en vez de navegar directo abrimos la pregunta
// aclaratoria (regla del usuario: conversar antes de derivar).
const DB_KEY_TO_DOMAIN: Record<string, string> = {
  salud: "salud",
  comer: "comer",
  transporte: "transporte",
  vuelos: "vuelos",
  playas: "playas",
  dormir: "dormir",
  comprar: "compras",
  compras: "compras",
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

const SPOKEN_UNITS: Record<string, string> = {
  cero: "0", un: "1", uno: "1", una: "1", dos: "2", tres: "3", cuatro: "4", cinco: "5",
  seis: "6", siete: "7", ocho: "8", nueve: "9",
};

const SPOKEN_NUMBERS: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
  treinta: 30, cuarenta: 40, cincuenta: 50,
};

function parseBusLineCode(segment: string): string | null {
  const tokens = normalizeSpeech(segment).split(" ").filter(Boolean);
  const meaningful = tokens.filter((t) => !["linea", "line", "bus", "autobus", "el", "la", "numero", "num"].includes(t));
  if (meaningful.length === 0) return null;

  const digitParts: string[] = [];
  for (const token of meaningful) {
    const m = token.match(/^([0-9]{1,3})([a-z]?)$/i);
    if (m) {
      digitParts.push(m[1]);
      if (m[2]) return `${digitParts.join("")}${m[2].toUpperCase()}`;
      if (digitParts.join("").length >= 3) break;
      continue;
    }
    if ((token === "n" || token === "ene") && digitParts.length > 0) return `${digitParts.join("")}N`;
    break;
  }
  if (digitParts.length > 0) return digitParts.join("");

  const first = meaningful[0];
  const unitAfterY = meaningful[1] === "y" ? meaningful[2] : meaningful[1];
  if (first === "veinti" && SPOKEN_UNITS[meaningful[1]]) {
    const suffix = meaningful.includes("n") || meaningful.includes("ene") ? "N" : "";
    return `${20 + Number(SPOKEN_UNITS[meaningful[1]])}${suffix}`;
  }
  if (["veinte", "treinta", "cuarenta", "cincuenta"].includes(first) && unitAfterY && SPOKEN_UNITS[unitAfterY]) {
    const suffix = meaningful.includes("n") || meaningful.includes("ene") ? "N" : "";
    return `${(SPOKEN_NUMBERS[first] ?? 0) + Number(SPOKEN_UNITS[unitAfterY])}${suffix}`;
  }
  if (SPOKEN_NUMBERS[first] != null) {
    let value = SPOKEN_NUMBERS[first];
    const suffix = meaningful.includes("n") || meaningful.includes("ene") ? "N" : "";
    return `${value}${suffix}`;
  }

  const spokenDigits = meaningful.map((t) => SPOKEN_UNITS[t]).filter(Boolean).join("");
  if (spokenDigits) {
    const suffix = meaningful.includes("n") || meaningful.includes("ene") ? "N" : "";
    return `${spokenDigits.slice(0, 3)}${suffix}`;
  }
  return null;
}

function matchBusLineDashboard(query: string, allowBareNumber = false): string | null {
  const explicit =
    query.match(/\b(?:linea|line|bus|autobus)\s*([0-9a-zñ][0-9a-zñ\s-]{0,24})/i) ||
    query.match(/\bl\s*([0-9][0-9\s-]{0,5}\s*[a-z]?)/i) ||
    query.match(/\bel\s+([0-9a-zñ][0-9a-zñ\s-]{0,24})/i);
  const code = parseBusLineCode(explicit?.[1] ?? (allowBareNumber ? query : ""))?.toUpperCase();
  return code && /^\d{1,3}[A-Z]?$/.test(code) ? `/bus/dashboard/${code}` : null;
}

function matchDbIntent(
  query: string,
  dbIntents: AgenteIntentRow[],
): { intent: AgenteIntentRow; len: number } | null {
  let best: AgenteIntentRow | null = null;
  let bestLen = 0;
  for (const it of dbIntents) {
    const canRoute = Boolean(it.route || it.action);
    if (!canRoute) continue;
    for (const kw of it.keywords ?? []) {
      const n = normalizeSpeech(kw);
      // Exigimos longitud mínima 4 para evitar que palabras sueltas muy
      // cortas ("ir", "ver"…) disparen un dominio entero.
      if (n.length < 4) continue;
      const betterTie = n.length === bestLen && !best?.route && Boolean(it.route);
      if (query.includes(n) && (n.length > bestLen || betterTie)) {
        best = it;
        bestLen = n.length;
      }
    }
  }
  return best ? { intent: best, len: bestLen } : null;
}

function dbIntentToResult(intent: AgenteIntentRow): LocalResult {
  if (intent.action === "logout") {
    return {
      reply: "Cerrando sesión…",
      audio: "fallback",
      pendingDomain: null,
      source: "trained",
    };
  }
  // Respuesta hablada entrenada en BD (spoken_reply) tiene prioridad
  // absoluta: refleja la doctrina curada por el CPA.
  const trainedReply = (intent.spoken_reply ?? "").trim();
  const domainId = DB_KEY_TO_DOMAIN[normalizeSpeech(intent.key)];
  const d = domainId ? DOMAINS.find((x) => x.id === domainId) : undefined;

  // PRIORIDAD DOCTRINAL: si el intent en BD tiene `route` explícita, esa ruta
  // manda sobre el hubPath del DOMAIN. La BD es la fuente única de verdad
  // para enrutamiento; el DOMAIN sólo aporta audio, openSubmenu y followups.
  if (intent.route) {
    return {
      reply: trainedReply || selectorReplyFor(intent.route, `Te llevo a ${intent.label.toLowerCase()}.`),
      path: intent.route,
      audio: d?.audio ?? "fallback",
      pendingDomain: null,
      source: "trained",
      openSubmenu: d?.openSubmenuKey,
    };
  }

  // Sin ruta en BD → caemos al comportamiento del DOMAIN (clarificación o hub).
  if (d) {
    if (d.followups.length === 0 && d.hubPath && !d.hubPath.startsWith("action:")) {
      return { reply: trainedReply || d.question, path: d.hubPath, audio: d.audio, pendingDomain: null, source: "trained", openSubmenu: d.openSubmenuKey };
    }
    if (d.openSubmenuKey && d.hubPath && !d.hubPath.startsWith("action:")) {
      return { reply: trainedReply || d.question, path: d.hubPath, audio: d.audio, pendingDomain: null, source: "trained", openSubmenu: d.openSubmenuKey };
    }
    if (d.followups.length > 0) {
      return { reply: trainedReply || d.question, audio: d.audio, pendingDomain: d.id, source: "trained" };
    }
  }

  return {
    reply: trainedReply || `Te llevo a ${intent.label.toLowerCase()}.`,
    audio: "fallback",
    pendingDomain: null,
    source: "trained",
  };
}


type LocalResult = {
  reply: string;
  path?: string;
  audio: VoiceClip;
  pendingDomain?: string | null;
  forwardPrompt?: string;
  openSubmenu?: string;
  source?: "trained";
};

// ─── MOTOR CONTEXTUAL URBANO ──────────────────────────────────────────
// Hard-block sanitario: si el mensaje contiene un síntoma o estado de
// "no encontrarse bien", el dominio salud_general gana SIEMPRE, por
// encima de keywords, DB intents y entidades nombradas. Nunca se navega
// directo a especialista/hospital/traumatología.
const HEALTH_HARD_BLOCK = [
  "dolor", "duele", "duelen", "fiebre", "decimas", "mareo", "mareos",
  "mareado", "mareada", "nausea", "nauseas", "vomito", "vomitos",
  "diarrea", "herida", "heridas", "sangra", "sangrado", "sangre",
  "ardor", "picor", "picores", "molestia", "molestias",
  "enfermo", "enferma", "enfermedad", "sintoma", "sintomas",
  "cansado", "cansada", "agotado", "agotada", "debil",
  "me siento mal", "me encuentro mal", "no me encuentro bien",
  "no me siento bien", "estoy fatal", "estoy malito", "estoy malita",
  "tengo fiebre", "tengo dolor", "me he caido", "me he cortado",
  "no puedo respirar", "me cuesta respirar", "malestar",
  "tos", "gripe", "catarro", "resfriado", "resfriada",
];
function hasHealthHardBlock(query: string): boolean {
  return HEALTH_HARD_BLOCK.some((t) => {
    const n = normalizeSpeech(t);
    if (!n) return false;
    return n.includes(" ") ? query.includes(n) : new RegExp(`(^|\\s)${n}(\\s|$)`).test(query);
  });
}

function isShoppingRequest(query: string): boolean {
  return /(^|\s)(comprar|compras|compra|tienda|tiendas|comercio|comercios|shopping|mercado|mercadillo|boutique|boutiques)(\s|$)/.test(query) ||
    query.includes("ir de compras") ||
    query.includes("quiero adquirir") ||
    query.includes("necesito adquirir") ||
    query.includes("centro comercial") ||
    query.includes("centros comerciales") ||
    query.includes("donde comprar");
}

// ─── RAMAS DEL SELECTOR POR CATEGORÍA (DOCTRINA CPA) ─────────────────
// Al enrutar a una categoría, el agente DEBE enumerar las MISMAS ramas
// que ofrece el selector/submenú de esa pantalla. Nunca "Te llevo a X."
// a secas. Estas frases reflejan literalmente el selector visible.
const SELECTOR_REPLIES: Record<string, string> = {
  "/": "Te llevo al inicio. ¿Buscas comer, tomar algo, ocio nocturno o un sitio concreto?",
  "/salud": "Te llevo a Salud. ¿Farmacia de guardia, hospital/urgencias, centro de salud o info del sistema sanitario?",
  "/farmacias": "Aquí tienes las farmacias de guardia más cercanas. Pulsa una para ver dirección y horario.",
  "/hospitales": "Estos son los hospitales y urgencias. ¿Quieres el más cercano o uno concreto?",
  "/sistema-sanitario": "Info del sistema sanitario. ¿Tarjeta sanitaria, cita previa o derechos del paciente?",
  "/ocio": "Te llevo a Ocio. ¿Cartelera de cines, cines, teatros, conciertos o salir de noche?",
  "/ocio/cartelera": "Aquí tienes la cartelera. ¿Filtramos por sala u hora de la película?",
  "/ocio/cines": "Estos son los cines de Alicante. Dime cuál te interesa.",
  "/ocio/teatros": "Cartel de teatros. ¿Algún género o sala en concreto?",
  "/ocio/conciertos": "Conciertos próximos. ¿Te oriento por fecha o por artista?",
  "/playas": "Te llevo a Playas. ¿Postiguet, San Juan, Albufereta, El Campello, Tabarca o calas escondidas? También puedo abrirte el mapa.",
  "/playas/mapa": "Mapa interactivo de playas. Pulsa una para ver fotos y reseñas.",
  "/donde-dormir": "Te llevo a Alojamientos. ¿Por zona, por precio o por estilo (hotel, apartamento, hostal)?",
  "/comprar": "Te llevo a Comprar. ¿Centro comercial, tiendas del centro, mercados o algo concreto?",
  "/explore": "Te llevo a Explorar. ¿Centro histórico, museos, rutas o mapa general?",
  "/vuelos": "Te llevo a Vuelos del ALC. ¿Llegadas o salidas?",
  "/clima": "Previsión del tiempo en Alicante. ¿Hoy, mañana o la semana?",
  "/fiestas": "Te llevo a Fiestas. ¿Hogueras de San Juan, Moros y Cristianos, mascletà o agenda general?",
  "/threads": "Tus hilos abiertos con negocios.",
  "/perfil": "Tu perfil. ¿Datos personales, preferencias o cerrar sesión?",
};

function selectorReplyFor(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  if (SELECTOR_REPLIES[path]) return SELECTOR_REPLIES[path];
  // Rutas con parámetro → usar el padre si lo tenemos catalogado.
  const parent = path.split("/").slice(0, -1).join("/") || "/";
  if (SELECTOR_REPLIES[parent]) return SELECTOR_REPLIES[parent];
  return fallback;
}

// Adapta el tono del texto según el modo del asistente. Solo retoca
// registro/longitud: nunca cambia el destino ni inventa información.
function formatReply(mode: AssistantMode, base: string): string {
  switch (mode) {
    case "operativo":
      return base; // frases cortas, sin floritura
    case "empatico":
      return base.startsWith("Tranquilo") || base.startsWith("Entiendo")
        ? base
        : `Tranquilo. ${base}`;
    case "social":
      return base.startsWith("¡") ? base : `¡Vamos! ${base}`;
    case "inspiracional":
      return base.startsWith("Genial") ? base : `Genial. ${base}`;
    case "practico":
      return base;
    default:
      return base;
  }
}

type AssistantMode =
  | "operativo" | "empatico" | "inspiracional" | "social" | "practico" | "neutro";
function pickAssistantMode(domain: string | null): AssistantMode {
  switch (domain) {
    case "transporte":
    case "transporte_bus":
    case "tram_pick":
    case "tram_origin_confirm":
    case "bus_known": return "operativo";
    case "salud":
    case "salud_general": return "empatico";
    case "playas": return "inspiracional";
    case "fiestas":
    case "tomar_algo":
    case "ocio": return "social";
    case "comer":
    case "dormir":
    case "compras":
    case "clima":
    case "mapa":
    case "perfil": return "practico";

    default: return "neutro";
  }
}

function logDecision(opts: {
  input: string;
  domain: string | null;
  confidence: number;
  uiAction: "openDomain" | "openSubmenu" | "openEndpoint" | "askClarification" | "none";
  result: LocalResult;
}) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-console
  console.debug("[Agente] decision", {
    input: opts.input,
    domain: opts.domain,
    intentConfidence: Number(opts.confidence.toFixed(2)),
    assistantMode: pickAssistantMode(opts.domain),
    uiAction: opts.uiAction,
    path: opts.result.path ?? null,
  });
}

function localResolve(
  text: string,
  currentDomain?: string | null,
  catalog: AgenteRoutingCatalog = EMPTY_ROUTING_CATALOG,
): LocalResult {
  const query = normalizeSpeech(text);

  const flightDomain = DOMAINS.find((d) => d.id === "vuelos");
  const matchedDomain = matchDomain(query);
  const hasGroundTransportMode = EXPLICIT_TRANSPORT_MODE_RE.test(query);
  const hasFlightTravelIntent = /(^|\s)(vuelo|vuelos|volar|avion|aviones|aena|facturar|facturacion|check\s?in|terminal|embarque|aerolinea|aeropuerto|altet|alc)(\s|$)/.test(query);
  if (matchedDomain?.domain.id === "vuelos" && !hasGroundTransportMode && hasFlightTravelIntent && flightDomain?.hubPath) {
    return {
      reply: flightDomain.question,
      path: flightDomain.hubPath,
      audio: flightDomain.audio,
      pendingDomain: null,
      openSubmenu: flightDomain.openSubmenuKey,
    };
  }

  const transportDomain = DOMAINS.find((d) => d.id === "transporte");
  const transportLike = transportDomain
    ? matchedDomain?.domain.id === "transporte" || matchedDomain?.domain.id === "transporte_bus" || hasGroundTransportMode
    : false;
  if (transportLike && transportDomain?.hubPath) {
    return {
      reply: transportDomain.question,
      path: transportDomain.hubPath,
      audio: transportDomain.audio,
      pendingDomain: null,
      openSubmenu: transportDomain.openSubmenuKey,
    };
  }

  // 0) Correcciones aprobadas en el CPA. Si una frase fue entrenada como
  // alias de un intent, debe ganar sobre heurísticas antiguas del cliente
  // (incluida la intro genérica de compras), para que subsectores como
  // "comprar_moda" o "comprar_tecnologia" se resuelvan al endpoint exacto.
  const trainedMatch = matchDbIntent(query, catalog.intents);
  const isComprarSubsector = trainedMatch?.intent.key.startsWith("comprar_") ?? false;
  if (trainedMatch && (trainedMatch.len >= 8 || isComprarSubsector)) {
    return dbIntentToResult(trainedMatch.intent);
  }


  // Las peticiones de compras se resuelven vía el dominio "compras" en
  // matchDomain — no devolvemos aquí ninguna respuesta hardcodeada que
  // enumere sectores; dejamos que el selector de /comprar guíe al usuario.




  // Dominio activo = prioridad máxima sobre entidades/keywords aisladas.
  // Si el agente acaba de preguntar por TRAM/transporte, respuestas cortas
  // como “Benidorm” se resuelven como destino TRAM antes de llegar a turismo.
  if (currentDomain === "transporte") {
    const transportDomain = DOMAINS.find((x) => x.id === "transporte");
    const tramFollowup = transportDomain ? matchFollowup(query, transportDomain) : null;
    if (tramFollowup?.path === "action:tram-pick") {
      const tPick = DOMAINS.find((x) => x.id === "tram_pick");
      return {
        reply: tPick?.question ?? "¿Hacia qué estación del TRAM quieres ir?",
        path: "/tram",
        audio: "bus",
        pendingDomain: "tram_pick",
      };
    }
  }
  if (currentDomain === "tram_pick" && !explicitlySwitchesAwayFromTram(query)) {
    const tramHit = matchTramQuery(`tram ${query}`);
    if (tramHit) {
      const params = new URLSearchParams();
      params.set("tram_dest", tramHit.destId);
      if (tramHit.originId) params.set("tram_origin", tramHit.originId);
      if (typeof window !== "undefined" && !tramHit.originId) {
        try {
          window.sessionStorage.setItem("tram:pending-dest-id", tramHit.destId);
          window.sessionStorage.setItem("tram:pending-dest-name", tramHit.destName);
          window.sessionStorage.removeItem("tram:suggested-origin-id");
          window.sessionStorage.removeItem("tram:suggested-origin-name");
        } catch { /* noop */ }
      }
      return {
        reply: tramHit.originId
          ? `¡Voy! TRAM de ${tramHit.originName} a ${tramHit.destName}.`
          : `🎯 Destino: ${tramHit.destName}. Calculando la parada más cercana…`,
        path: `/tram?${params.toString()}`,
        audio: "bus",
        pendingDomain: tramHit.originId ? null : "tram_origin_confirm",
      };
    }
  }

  // 0) HARD-BLOCK SANITARIO — gana sobre todo lo demás excepto el follow-up
  //    dentro del propio dominio salud (donde el usuario ya eligió opción).
  if (hasHealthHardBlock(query) && currentDomain !== "salud") {
    const saludDomain = DOMAINS.find((d) => d.id === "salud");
    if (saludDomain) {
      const result: LocalResult = {
        reply: saludDomain.question,
        audio: saludDomain.audio,
        pendingDomain: saludDomain.id,
      };
      logDecision({
        input: text, domain: "salud_general", confidence: 0.95,
        uiAction: "askClarification", result,
      });
      return result;
    }
  }

  // 0.5) TRAM directo: si el usuario menciona TRAM/tranvía + paradas,
  //      abrimos el Inicio con destino (y origen si se infiere) precargados.
  const tramHit = matchTramQuery(query);
  if (tramHit) {
    const params = new URLSearchParams();
    params.set("tram_dest", tramHit.destId);
    if (tramHit.originId) params.set("tram_origin", tramHit.originId);
    if (!tramHit.originId && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("tram:pending-dest-id", tramHit.destId);
        window.sessionStorage.setItem("tram:pending-dest-name", tramHit.destName);
        window.sessionStorage.removeItem("tram:suggested-origin-id");
        window.sessionStorage.removeItem("tram:suggested-origin-name");
      } catch { /* noop */ }
    }
    const reply = tramHit.originId
      ? `¡Voy! TRAM de ${tramHit.originName} a ${tramHit.destName}.`
      : `¡Voy! TRAM con destino ${tramHit.destName}.`;
    return {
      reply,
      path: `/tram?${params.toString()}`,
      audio: "fallback",
      pendingDomain: tramHit.originId ? null : "tram_origin_confirm",
    };
  }
  if (TRAM_TRIGGER_RE.test(query) && !currentDomain) {
    const tPick = DOMAINS.find((x) => x.id === "tram_pick");
    return {
      reply: tPick?.question ?? "¿Hacia qué estación del TRAM quieres ir?",
      path: "/tram",
      audio: "bus",
      pendingDomain: "tram_pick",
    };
  }

  // 0.7) DICOTOMÍA DE CONTEXTO — frase con verbo de movimiento + otro
  //      dominio o entidad nombrada → repreguntamos en vez de adivinar.
  //      Solo si el usuario NO está dentro de un follow-up activo.
  if (!currentDomain) {
    const ambiguity = detectAmbiguity(query);
    if (ambiguity) {
      logDecision({
        input: text, domain: null, confidence: 0.4,
        uiAction: "askClarification", result: ambiguity,
      });
      return ambiguity;
    }
  }

  // 1) Follow-up dentro de un dominio activo: resolvemos sub-destino.
  if (currentDomain) {
    const d = DOMAINS.find((x) => x.id === currentDomain);

    // 1.bis) Caso especial: estamos esperando que el usuario diga la línea
    // de bus que quiere tomar. Si la frase contiene un código de línea
    // válido (1–3 dígitos opcionalmente con "N" o letra), saltamos directos
    // al Dashboard de esa línea.
    if (currentDomain === "bus_known") {
      const dashboardPath = matchBusLineDashboard(query, true);
      if (dashboardPath) {
        const code = dashboardPath.split("/").pop();
        return {
          reply: `¡Voy! Abro el Dashboard de la línea ${code}.`,
          path: dashboardPath,
          audio: "bus",
          pendingDomain: null,
        };
      }
    }
    // 1.ter) En el dominio tram_pick aceptamos paradas aunque el usuario
    // no diga la palabra "tram" (ya está en el flujo).
  if (currentDomain === "tram_pick" && !explicitlySwitchesAwayFromTram(query)) {
      const tramHit2 = matchTramQuery(`tram ${query}`);
      if (tramHit2) {
        const params = new URLSearchParams();
        params.set("tram_dest", tramHit2.destId);
        if (tramHit2.originId) params.set("tram_origin", tramHit2.originId);
        if (tramHit2.originId) {
          return {
            reply: `¡Voy! TRAM de ${tramHit2.originName} a ${tramHit2.destName}.`,
            path: `/tram?${params.toString()}`,
            audio: "bus",
            pendingDomain: null,
          };
        }
        // Solo destino → guardamos para enriquecer con la parada más cercana
        // y pedimos confirmación en el siguiente turno.
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("tram:pending-dest-id", tramHit2.destId);
            window.sessionStorage.setItem("tram:pending-dest-name", tramHit2.destName);
            window.sessionStorage.removeItem("tram:suggested-origin-id");
            window.sessionStorage.removeItem("tram:suggested-origin-name");
          } catch { /* noop */ }
        }
        return {
          reply: `🎯 Destino: ${tramHit2.destName}. Calculando la parada más cercana…`,
          path: `/tram?${params.toString()}`,
          audio: "bus",
          pendingDomain: "tram_origin_confirm",
        };
      }
    }
    // 1.quater) En tram_origin_confirm aceptamos también una parada nombrada
    // como nuevo origen (sin necesidad de decir "tram").
    if (currentDomain === "tram_origin_confirm") {
      const tramHit3 = matchTramQuery(`tram ${query}`);
      if (tramHit3 && tramHit3.destId && typeof window !== "undefined") {
        // El usuario puede decir solo el nombre de una parada → tratarla como origen
        // hacia el destino pendiente.
        const pendingDestId = window.sessionStorage.getItem("tram:pending-dest-id");
        const pendingDestName = window.sessionStorage.getItem("tram:pending-dest-name");
        if (pendingDestId && pendingDestName) {
          const params = new URLSearchParams();
          params.set("tram_dest", pendingDestId);
          params.set("tram_origin", tramHit3.destId);
          try {
            window.sessionStorage.removeItem("tram:pending-dest-id");
            window.sessionStorage.removeItem("tram:pending-dest-name");
            window.sessionStorage.removeItem("tram:suggested-origin-id");
            window.sessionStorage.removeItem("tram:suggested-origin-name");
          } catch { /* noop */ }
          return {
            reply: `¡Voy! TRAM de ${tramHit3.destName} a ${pendingDestName}.`,
            path: `/tram?${params.toString()}`,
            audio: "bus",
            pendingDomain: null,
          };
        }
      }
    }
    const subcategory = matchExistingSubcategory(query, catalog.subcategories[currentDomain]);
    if (subcategory) {
      return {
        reply: selectorReplyFor(subcategory.route, `Te llevo a ${subcategory.label}.`),
        path: subcategory.route,
        audio: d?.audio ?? "fallback",
        pendingDomain: null,
      };
    }
    if (d) {
      const fuMatch = matchFollowup(query, d);
      if (fuMatch) {
        const fuPath = fuMatch.path;
        // Sentinel especial: el usuario dice "sí, conozco mi bus" estando
        // en el dominio "transporte". En vez de navegar, activamos el
        // subdominio "bus_known" y preguntamos la línea, sin abrir picker.
        if (fuPath === "action:bus-known-line") {
          const busKnown = DOMAINS.find((x) => x.id === "bus_known");
          return {
            reply: busKnown?.question ?? "¿Cuál es la línea que quieres tomar?",
            audio: "bus",
            pendingDomain: "bus_known",
          };
        }
        if (fuPath === "action:transporte-bus") {
          const tBus = DOMAINS.find((x) => x.id === "transporte_bus");
          return {
            reply: tBus?.question ?? "¿Ya sabes qué bus tomar?",
            audio: "bus",
            pendingDomain: "transporte_bus",
          };
        }
        if (fuPath === "action:tram-confirm-suggested") {
          if (typeof window !== "undefined") {
            const destId = window.sessionStorage.getItem("tram:pending-dest-id");
            const destName = window.sessionStorage.getItem("tram:pending-dest-name");
            const originId = window.sessionStorage.getItem("tram:suggested-origin-id");
            const originName = window.sessionStorage.getItem("tram:suggested-origin-name");
            if (destId && originId) {
              const params = new URLSearchParams();
              params.set("tram_dest", destId);
              params.set("tram_origin", originId);
              try {
                window.sessionStorage.removeItem("tram:pending-dest-id");
                window.sessionStorage.removeItem("tram:pending-dest-name");
                window.sessionStorage.removeItem("tram:suggested-origin-id");
                window.sessionStorage.removeItem("tram:suggested-origin-name");
              } catch { /* noop */ }
              return {
                reply: `¡Voy! TRAM de ${originName ?? "tu parada"} a ${destName ?? "tu destino"}.`,
                path: `/tram?${params.toString()}`,
                audio: "bus",
                pendingDomain: null,
              };
            }
          }
          return {
            reply: "Necesito que primero me digas el destino. ¿A qué estación del TRAM quieres ir?",
            audio: "bus",
            pendingDomain: "tram_pick",
          };
        }
        if (fuPath === "action:tram-pick-origin") {
          return {
            reply: "Vale, dime desde qué estación del TRAM sales (por ejemplo: «desde Mercado»).",
            audio: "bus",
            pendingDomain: "tram_origin_confirm",
          };
        }
        if (fuPath === "action:tram-pick") {
          const tPick = DOMAINS.find((x) => x.id === "tram_pick");
          return {
            reply: tPick?.question ?? "¿A qué estación del TRAM quieres ir?",
            path: "/tram",
            audio: "bus",
            pendingDomain: "tram_pick",
          };
        }
        if (fuPath === "action:tram-quick-destinations") {
          return {
            reply: "Sin problema. Echa un vistazo a los botones de destino rápido (Playa, MARQ, Luceros, Hospital…) en la pantalla del TRAM y elige el que te encaje.",
            path: "/tram",
            audio: "bus",
            pendingDomain: "tram_pick",
          };
        }
        const intent = INTENTS.find((it) => it.path === fuPath);
        // Despedida especial para el dominio playas: el agente entrega el
        // carrusel o el mapa interactivo y se despide antes de cerrar.
        let reply: string;
        if (d.id === "playas") {
          const what = fuMatch.label === "mapa" ? "el mapa interactivo de playas" : "el carrusel de playas";
          reply = `Aquí tienes ${what}. Llámame luego si quieres más información.`;
        } else {
          reply = fuMatch.label
            ? `Te puedo dirigir a ${fuMatch.label}.`
            : (intent?.reply ?? "Te llevo allí.");
        }
        return {
          reply,
          path: fuPath,
          audio: intent?.audio ?? d.audio,
          pendingDomain: null,
          // Si el followup nos devuelve al hub "/" (caso comer), señalamos
          // al ChatScreen que debe abrir el submenú correspondiente; si no
          // lo hacemos, el usuario aterriza en la home sin selector visible.
          openSubmenu: fuPath === "/" && d.id === "comer" ? "comer" : undefined,
        };
      }

      if (d.hubPath && !d.hubPath.startsWith("action:") && isAffirmativeResponse(query)) {
        return {
          reply: selectorReplyFor(d.hubPath, `Te llevo a ${d.id === "playas" ? "playas" : d.question.toLowerCase()}.`),
          path: d.hubPath,
          audio: d.audio,
          pendingDomain: null,
          openSubmenu: d.hubPath === "/" && d.id === "comer" ? "comer" : undefined,
        };
      }
    }
  }

  const directBusDashboard = matchBusLineDashboard(query);
  if (directBusDashboard) {
    const code = directBusDashboard.split("/").pop();
    return {
      reply: `¡Voy! Abro el Dashboard de la línea ${code}.`,
      path: directBusDashboard,
      audio: "bus",
      pendingDomain: null,
    };
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

  // 2b) PRIORIDAD 2 — si hay dominio, preguntar antes de derivar.
  //     Excepción: dominios sin followups (clima, perfil, …) navegan directos.
  if (domainMatch) {
    const { domain } = domainMatch;
    if (!domain.followups.length && domain.hubPath && !domain.hubPath.startsWith("action:")) {
      return {
        reply: domain.question,
        path: domain.hubPath,
        audio: domain.audio,
        pendingDomain: null,
        openSubmenu: domain.openSubmenuKey,
      };
    }
    // Dominio con openSubmenuKey: navegamos al hub y abrimos el selector
    // de la pantalla destino, sin esperar a una segunda respuesta del usuario.
    if (domain.openSubmenuKey && domain.hubPath && !domain.hubPath.startsWith("action:")) {
      return {
        reply: domain.question,
        path: domain.hubPath,
        audio: domain.audio,
        pendingDomain: null,
        openSubmenu: domain.openSubmenuKey,
      };
    }
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
        if (!d.followups.length && d.hubPath && !d.hubPath.startsWith("action:")) {
          return {
            reply: d.question,
            path: d.hubPath,
            audio: d.audio,
            pendingDomain: null,
          };
        }
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
      reply: selectorReplyFor(intent.route ?? undefined, `Te llevo a ${intent.label.toLowerCase()}.`),
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
function getLoggedUserName(): string {
  if (typeof window === "undefined") return "";
  try {
    // Read display name cached by useAppAuth (best-effort; falls back to empty).
    const cached = localStorage.getItem("va:display-name");
    return (cached || "").toString().trim();
  } catch {
    return "";
  }
}
function getGreetingText() {
  const h = new Date().getHours();
  const saludo = h < 14 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  const name = getLoggedUserName();
  return name
    ? `${saludo} ${name}, ¿en qué te puedo ayudar?`
    : `${saludo}, ¿en qué te puedo ayudar?`;
}

function makeGreeting(): Msg {
  return { role: "assistant", content: getGreetingText() };
}

// ── Saludo contextual de reentrada ───────────────────────────────────────
const VA_LAST_INTERACTION_KEY = "va:last-interaction-ts";
const VA_LAST_TOPIC_KEY = "va:last-topic";
const VA_LAST_REENTRY_KEY = "va:last-reentry";
const VA_LAST_AGENT_ROUTE_KEY = "va:last-agent-route";
const VA_LAST_AGENT_ROUTE_TTL_MS = 10 * 60 * 1000;

type LastAgentRoute = { route: string; reply?: string; at: number };

function rememberAgentRoute(route: string | undefined, reply?: string) {
  if (typeof window === "undefined" || !route) return;
  try {
    window.sessionStorage.setItem(
      VA_LAST_AGENT_ROUTE_KEY,
      JSON.stringify({ route, reply, at: Date.now() } satisfies LastAgentRoute),
    );
  } catch {}
}

function readLastAgentRoute(): LastAgentRoute | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(VA_LAST_AGENT_ROUTE_KEY) ?? "null") as LastAgentRoute | null;
    if (!parsed?.route || Date.now() - parsed.at > VA_LAST_AGENT_ROUTE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function isNavigationFailureReport(query: string): boolean {
  const q = normalizeSpeech(query);
  return /\b(no\s+(abre|abrio|carga|cargo|veo|sale|aparece)|pagina\s+no\s+abre|pantalla\s+en\s+blanco|me\s+lleva\s+pero|no\s+veo\s+nada|se\s+queda|quede\s+esperando|no\s+me\s+(lleva|llevo|abre))\b/.test(q);
}

function navigationRetryReply(route: string, currentPath: string): string {
  if (route === currentPath) return "Perdona, refresco esa sección para que cargue bien.";
  return "Perdona, reintento abrir la sección correcta.";
}

export function markVaInteraction(topic?: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(VA_LAST_INTERACTION_KEY, String(Date.now()));
    if (topic && topic.trim()) {
      window.sessionStorage.setItem(VA_LAST_TOPIC_KEY, topic.trim().slice(0, 80));
    }
  } catch {}
}

function pickDistinct(options: string[], lastKey: string): string {
  if (typeof window === "undefined") return options[0];
  let last = "";
  try { last = window.sessionStorage.getItem(lastKey) ?? ""; } catch {}
  const pool = options.filter((o) => o !== last);
  const arr = pool.length ? pool : options;
  const choice = arr[Math.floor(Math.random() * arr.length)];
  try { window.sessionStorage.setItem(lastKey, choice); } catch {}
  return choice;
}

function getReentryGreeting(): string {
  const h = new Date().getHours();
  const partOfDay = h < 14 ? "Buenos días" : h < 20 ? "Buenas tardes" : "Buenas noches";
  let lastTs = 0;
  let lastTopic = "";
  if (typeof window !== "undefined") {
    try {
      lastTs = Number(window.sessionStorage.getItem(VA_LAST_INTERACTION_KEY) ?? "0") || 0;
      lastTopic = window.sessionStorage.getItem(VA_LAST_TOPIC_KEY) ?? "";
    } catch {}
  }
  const minsSince = lastTs ? Math.round((Date.now() - lastTs) / 60000) : Infinity;

  const name = getLoggedUserName();
  const nameSuffix = name ? `, ${name}` : "";

  // > 30 min: saluda según hora del día
  if (minsSince > 30) {
    return pickDistinct(
      [
        `${partOfDay}${nameSuffix}. Aquí sigo.`,
        `${partOfDay}${nameSuffix}. ¿Seguimos?`,
        `Hola de nuevo${nameSuffix}.`,
      ],
      VA_LAST_REENTRY_KEY,
    );
  }

  // Reentrada reciente con tema previo
  if (lastTopic) {
    const short = lastTopic.length > 40 ? lastTopic.slice(0, 40) + "…" : lastTopic;
    return pickDistinct(
      [
        `Seguimos con lo de "${short}".`,
        `Aquí sigo${nameSuffix}.`,
        `Encontré más opciones sobre "${short}".`,
        `Hola de nuevo, ¿continuamos?`,
      ],
      VA_LAST_REENTRY_KEY,
    );
  }

  // Reentrada genérica
  return pickDistinct(
    [
      `Aquí sigo${nameSuffix}.`,
      `Hola de nuevo.`,
      `¿En qué seguimos?`,
      `Sigo contigo.`,
    ],
    VA_LAST_REENTRY_KEY,
  );
}

// Micro-saludo de continuidad para reentradas DENTRO de la misma sesión
// abierta (cuando el usuario vuelve a interactuar tras un silencio).
// Debe ser muy corto, natural, nunca robótico.
function getContinuityMicroGreeting(): string {
  let lastTopic = "";
  if (typeof window !== "undefined") {
    try {
      lastTopic = window.sessionStorage.getItem(VA_LAST_TOPIC_KEY) ?? "";
    } catch {}
  }
  const generic = [
    "Seguimos.",
    "Te escucho.",
    "Aquí sigo.",
    "Dime.",
    "Vamos con ello.",
    "Sigo contigo.",
  ];
  if (lastTopic) {
    const short = lastTopic.length > 40 ? lastTopic.slice(0, 40) + "…" : lastTopic;
    return pickDistinct(
      [
        `Seguimos con lo de "${short}".`,
        `Te escucho.`,
        `Sigo contigo.`,
        `Dime, ¿continuamos?`,
      ],
      VA_LAST_REENTRY_KEY,
    );
  }
  return pickDistinct(generic, VA_LAST_REENTRY_KEY);
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
let __vaContinuityInFlight = false;
let __vaContinuitySpokenAt = 0;
const POST_SPEECH_LISTEN_DELAY_MS = 30;

/**
 * Saludo sincrónico desde gesto del usuario. DEBE invocarse dentro del
 * onClick (no en handlers asíncronos posteriores) para que el navegador
 * autorice la síntesis de voz. Crea el utterance y llama a speak() sin
 * ningún await previo.
 */
export function speakGreetingFromUserGesture(force = false): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  if (typeof SpeechSynthesisUtterance === "undefined") return false;
  if (__vaGreetingSpoken && !force) return true;
  try {
    const text = getGreetingText();
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VA_VOICE_LANG;
    u.rate = VA_VOICE_RATE;
    u.pitch = VA_VOICE_PITCH;
    u.volume = 1;
    const voice = pickSpanishVoice(synth);
    if (voice) u.voice = voice;
    __vaActiveUtterance = u;
    __vaGreetingSpoken = true;
    __vaSpeechUnlocked = true;
    u.onstart = () => console.log("GREETING VOICE START");
    u.onend = () => {
      console.log("GREETING VOICE END");
      if (__vaActiveUtterance === u) __vaActiveUtterance = null;
    };
    u.onerror = (e) => {
      console.log("GREETING VOICE ERROR", e);
      if (__vaActiveUtterance === u) __vaActiveUtterance = null;
    };
    synth.speak(u);
    try { synth.resume(); } catch {}
    keepSpeechSynthesisAwake(synth);
    return true;
  } catch {
    return false;
  }
}

// Voz unificada del agente: español Estados Unidos (es-US) si está disponible.
const VA_VOICE_LANG = "es-US";
const VA_VOICE_RATE = 0.9;
const VA_VOICE_PITCH = 0.55;


function pickSpanishVoice(synth: SpeechSynthesis) {
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang?.toLowerCase().startsWith("es-us")) ||
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
    // Fallback breve: no bloquea la primera frase si el navegador tarda en listar voces.
    setTimeout(() => finish(synth.getVoices()), 80);
  });
}

function warmSpeechVoices(synth: SpeechSynthesis) {
  try {
    const voices = synth.getVoices();
    if (voices.length) return;
    synth.onvoiceschanged = () => {
      try {
        synth.getVoices();
      } catch {
        // Ignore voice warm-up failures.
      }
    };
  } catch {
    // Ignore voice warm-up failures.
  }
}

export async function hablar(
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
  warmSpeechVoices(synth);
  synth.cancel();
  synth.resume();
  const utterance = new SpeechSynthesisUtterance(String(respuesta));
  utterance.lang = VA_VOICE_LANG;
  utterance.rate = VA_VOICE_RATE;
  utterance.pitch = VA_VOICE_PITCH;
  utterance.volume = 1;
  const voice = pickSpanishVoice(synth);
  if (voice) {
    utterance.voice = voice;
  }
  __vaActiveUtterance = utterance;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (__vaActiveUtterance === utterance) __vaActiveUtterance = null;
    markVaInteraction();
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

function speakPreparedUtterance(
  texto: unknown,
  utterance: SpeechSynthesisUtterance,
  opts: { onStart?: () => void; onEnd?: () => void } = {},
) {
  const { onStart, onEnd } = opts;
  const respuesta = plainText(extractSpeechText(texto));
  if (!respuesta || typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return;
  }
  const synth = window.speechSynthesis;
  warmSpeechVoices(synth);
  synth.cancel();
  synth.resume();
  configureSpanishUtterance(utterance, respuesta);
  utterance.volume = 1;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (__vaActiveUtterance === utterance) __vaActiveUtterance = null;
    markVaInteraction();
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
  keepSpeechSynthesisAwake(synth);
  synth.speak(utterance);
}

if (typeof window !== "undefined") {
  (window as any).hablar = hablar;
}

function iniciarAudio() {
  if (typeof window === "undefined" || __vaSpeechUnlocked || !window.speechSynthesis) return;
  try {
    warmSpeechVoices(window.speechSynthesis);
    window.speechSynthesis.resume();
    __vaSpeechUnlocked = true;
  } catch {
    // Ignore unlock failures; the next user tap can retry.
  }
}

function configureSpanishUtterance(u: SpeechSynthesisUtterance, text: string) {
  u.text = plainText(text);
  u.lang = VA_VOICE_LANG;
  u.rate = VA_VOICE_RATE;
  u.pitch = VA_VOICE_PITCH;
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
  u.lang = VA_VOICE_LANG;
  u.rate = VA_VOICE_RATE;
  u.pitch = VA_VOICE_PITCH;
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
    u.lang = VA_VOICE_LANG;
    u.rate = VA_VOICE_RATE;
    u.pitch = VA_VOICE_PITCH;
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
  const [llmDisabled, setLlmDisabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem("va:disableLLM") === "1"; } catch { return false; }
  });
  const llmDisabledRef = useRef(llmDisabled);
  useEffect(() => { llmDisabledRef.current = llmDisabled; }, [llmDisabled]);

  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const askAgent = useServerFn(agenteVamosChat);
  // Carga las preguntas de desambiguación desde BD (tabla agente_respuestas).
  // Sobreescribe en sitio el array DOMAINS para que todas las llamadas existentes
  // a d.question devuelvan el texto editable desde admin en vez del fallback.
  const loadRespuestas = useServerFn(listAgenteRespuestas);
  useEffect(() => {
    let cancelled = false;
    loadRespuestas()
      .then(({ items }) => {
        if (cancelled) return;
        const map = new Map(items.map((r) => [r.intent_id, r.question]));
        for (const d of DOMAINS) {
          const q = map.get(d.id);
          if (q && typeof q === "string" && q.trim()) d.question = q;
        }
      })
      .catch(() => { /* fallback silencioso a textos por defecto */ });
    return () => { cancelled = true; };
  }, [loadRespuestas]);
  // Telemetría: registramos cada interacción del agente en
  // agente_learning_log (vía server fn que usa supabaseAdmin).
  // Fire-and-forget: si falla, no rompe la UX.
  const logInteraction = useServerFn(logAgentInteraction);
  // ID estable por apertura del panel para agrupar turnos como una
  // conversación real en /admin/ai/conversations.
  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  );
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
    loadCatalog()
      .then((catalog: AgenteRoutingCatalog) => {
        routingCatalogRef.current = catalog ?? EMPTY_ROUTING_CATALOG;
        console.log(`[Agente] Catálogo cargado desde BD: ${routingCatalogRef.current.intents.length}`);
      })
      .catch((err: unknown) => {
        console.warn("[Agente] No se pudo cargar el catálogo de routing", err);
      });
  }, [open, loadCatalog]);

  // Catálogo de paradas TRAM en memoria para detectar nombres en la voz/chat.
  useEffect(() => {
    if (TRAM_STOPS_CACHE.length) return;
    fetch("/api/public/tram/stations")
      .then((r) => r.json())
      .then((d) => setTramStopsCache((d?.stations ?? []) as Array<{ stop_id: string; stop_name: string; stop_lat?: number; stop_lon?: number }>))
      .catch(() => {});
  }, []);


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

  const speak = useCallback(
    (text: string, _audio?: VoiceClip, onEnd?: () => void, _reservedUtterance?: SpeechSynthesisUtterance | null) => {
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
        const speechOpts = {
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
        };
        if (_reservedUtterance) {
          speakPreparedUtterance(text, _reservedUtterance, speechOpts);
        } else {
          hablar(text, speechOpts);
        }
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
      // Telemetría: marca de inicio y flags para el log final.
      const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
      let serverCalled = false;
      let finalTarget: string | undefined;
      let finalReply: string = "";
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
      markVaInteraction(clean);
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
        const routeDomain = domainFromPath(path);
        const storedDomain = readStoredActiveDomain();
        const activeDomain = pendingDomainRef.current ?? storedDomain ?? routeDomain;
        const priorDomain = activeDomain;
        const catalogForTurn = routingCatalogRef.current;
        const lastAgentRoute = readLastAgentRoute();
        const navigationRetry = isNavigationFailureReport(clean) && lastAgentRoute?.route
          ? lastAgentRoute
          : null;
        const fallback: LocalResult = navigationRetry
          ? {
              reply: navigationRetryReply(navigationRetry.route, path),
              path: navigationRetry.route,
              audio: "fallback" as VoiceClip,
              pendingDomain: null,
            }
          : localResolve(clean, activeDomain, catalogForTurn);
        const replyMode = pickAssistantMode(fallback.pendingDomain ?? pendingDomainRef.current ?? null);
        let reply = formatReply(replyMode, fallback.reply);
        let target: string | undefined = fallback.path;
        const pendingDomainSpec = fallback.pendingDomain
          ? DOMAINS.find((d) => d.id === fallback.pendingDomain)
          : null;
        if (!target && pendingDomainSpec?.hubPath && !pendingDomainSpec.hubPath.startsWith("action:")) {
          target = pendingDomainSpec.hubPath;
        }
        let forwardPrompt: string | undefined =
          fallback.path === "/" && fallback.reply.includes("Dashboard Nocturno")
            ? clean
            : undefined;
        if (forwardPrompt && typeof window !== "undefined") {
          try {
            window.sessionStorage.setItem("afp:fwdPrompt", forwardPrompt);
          } catch {}
        }
        // Si el resolver local pidió abrir un submenú (p.ej. "comer"),
        // lo despachamos tras navegar. NO usamos sessionStorage aquí para
        // no activar el flujo "navigatingToDashboard" que espera resumen.
        const localOpenSubmenu = fallback.openSubmenu ?? null;

        // Enriquecer respuesta TRAM con la parada más cercana cuando hay geo.
        if (fallback.pendingDomain === "tram_origin_confirm" && typeof window !== "undefined") {
          const destId = window.sessionStorage.getItem("tram:pending-dest-id");
          const destName = window.sessionStorage.getItem("tram:pending-dest-name");
          const coords = readCachedCoords();
          if (destId && destName) {
            if (coords) {
              try {
                const res = await fetch(`/api/public/tram/valid-origins?destination=${encodeURIComponent(destId)}`);
                const data = await res.json();
                const groups = (data?.groups ?? []) as Array<{ stops: Array<{ stop_id: string; stop_name: string }> }>;
                const uniq = new Map<string, { stop_id: string; stop_name: string }>();
                for (const g of groups) for (const s of g.stops) if (!uniq.has(s.stop_id)) uniq.set(s.stop_id, s);
                let best: { stop_id: string; stop_name: string; d: number } | null = null;
                for (const s of uniq.values()) {
                  const meta = TRAM_STOPS_CACHE.find((t) => t.stop_id === s.stop_id);
                  if (!meta || meta.lat == null || meta.lng == null) continue;
                  const d = tramDistanceKm(coords, { lat: meta.lat, lng: meta.lng });
                  if (!best || d < best.d) best = { stop_id: s.stop_id, stop_name: s.stop_name, d };
                }
                if (best) {
                  window.sessionStorage.setItem("tram:suggested-origin-id", best.stop_id);
                  window.sessionStorage.setItem("tram:suggested-origin-name", best.stop_name);
                  reply = `📍 Estás cerca de **${best.stop_name}**. ¿Quieres salir desde esa parada o prefieres otra?`;
                } else {
                  reply = `Destino: ${destName}. ¿Desde qué parada del TRAM quieres salir?`;
                }
              } catch {
                reply = `Destino: ${destName}. ¿Desde qué parada del TRAM quieres salir?`;
              }
            } else {
              reply = `Destino: ${destName}. Activa la ubicación para sugerirte la parada más cercana, o dime desde qué parada sales.`;
            }
          }
        }

        // Si el resolver local activa un DOMINIO (pregunta aclaratoria sin
        // path), saltamos el servidor para no pisar la pregunta con una
        // navegación agresiva. Actualizamos el dominio activo y respondemos.
        const isClarifying = fallback.pendingDomain != null;
        if (fallback.pendingDomain != null) {
          pendingDomainRef.current = fallback.pendingDomain ?? null;
          writeStoredActiveDomain(pendingDomainRef.current);
        } else if (fallback.pendingDomain === null) {
          // Resolución concreta → cerramos el dominio activo.
          pendingDomainRef.current = null;
          writeStoredActiveDomain(null);
        }

        const resolvedLineDashboard = /^\/bus\/dashboard\/[^/?#]+$/i.test(fallback.path ?? "");

        // Si la resolución local es el intent específico de cartelera/cine,
        // NO dejamos que el servidor sobreescriba la respuesta con la
        // pregunta del hub de ocio. Honramos el mensaje completo.
        const isCineIntent = fallback.path === "/ocio/cartelera";
        // Si veníamos de un follow-up de dominio (p.ej. compras) y el resolver
        // local ya derivó a una ruta concreta, NO dejamos que el servidor
        // pise esa derivación con una sugerencia de otro dominio.
        const isDomainFollowupResolution = !!priorDomain && !!fallback.path;
        const isTrainedResolution = fallback.source === "trained";
        const isShoppingResolution = fallback.path === "/comprar";

        // El agente local es soberano: si ya resolvió a una ruta concreta
        // (cualquier path que no sea "/"), NO invocamos al LLM. Gemini solo
        // entra cuando el resolver local no encuentra nada (path vacío o "/")
        // y no es un turno de desambiguación.
        const localResolvedConcretely = !!fallback.path && fallback.path !== "/";
        if (!isClarifying && !resolvedLineDashboard && !isCineIntent && !isDomainFollowupResolution && !isTrainedResolution && !isShoppingResolution && !localResolvedConcretely) {
          try {
            serverCalled = true;
            const res = await askAgent({
              data: {
                messages: next.map((m) => ({ role: m.role, content: m.content })),
                path,
                disableLLM: llmDisabledRef.current,
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

        // ─── HARD-BLOCK SANITARIO POST-SERVIDOR ──────────────────────────
        // Si el mensaje original contiene síntomas, ignoramos cualquier
        // navegación devuelta por el servidor: forzamos el dominio salud
        // con su pregunta aclaratoria.
        if (hasHealthHardBlock(normalizeSpeech(clean)) && pendingDomainRef.current !== "salud") {
          const saludDomain = DOMAINS.find((d) => d.id === "salud");
          if (saludDomain) {
            target = saludDomain.hubPath;
            reply = saludDomain.question;
            forwardPrompt = undefined;
            pendingDomainRef.current = "salud";
            writeStoredActiveDomain("salud");
            if (typeof window !== "undefined") {
              try {
                window.sessionStorage.removeItem("afp:fwdPrompt");
                window.sessionStorage.removeItem("afp:openSubmenu");
              } catch {}
            }
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
            writeStoredActiveDomain(pendingDomainRef.current);
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
        finalReply = reply;

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
            const legacyBusLine = raw.match(/^\/bus\/lines\/([^/?#]+)$/i);
            const normalizedTarget = legacyBusLine
              ? `/bus/dashboard/${legacyBusLine[1]}`
              : ["/bus", "/bus/", "/bus/planner", "/buses-en-vivo", "/bus/lines"].includes(raw)
                ? "action:bus-picker"
                : raw;
            // Sentinel legacy: antes abría el picker con una línea preseleccionada;
            // ahora debe ir siempre al Dashboard de la línea.
            const lineSentinel = normalizedTarget.match(/^action:bus-picker:line:([A-Z0-9]+)$/i);
            if (lineSentinel) {
              const lineCode = lineSentinel[1];
              return navigate({ to: "/bus/dashboard/$code", params: { code: lineCode } });
            }
            // Sentinel: abrir el picker de buses urbanos en el Inicio.
            if (normalizedTarget === "action:bus-picker") {
              try {
                window.sessionStorage.setItem("agent:open-bus-picker", "1");
              } catch {
                /* noop */
              }
              navigate({ href: "/?openBusPicker=1", replace: true } as any);
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
            if (/^https?:\/\//i.test(normalizedTarget)) {
              try {
                window.open(normalizedTarget, "_blank", "noopener,noreferrer");
              } catch {
                window.location.assign(normalizedTarget);
              }
              return;
            }
            const qIdx = normalizedTarget.indexOf("?");
            const pathname = qIdx >= 0 ? normalizedTarget.slice(0, qIdx) : normalizedTarget;
            const search: Record<string, string> = {};
            if (qIdx >= 0) {
              const sp = new URLSearchParams(normalizedTarget.slice(qIdx + 1));
              sp.forEach((v, k) => (search[k] = v));
            }
            const hotelMatch = pathname.match(/^\/hotel\/([^/]+)$/);
            const restMatch = pathname.match(/^\/restaurants\/([^/]+)$/);
            const vueloMatch = pathname.match(/^\/vuelos\/([^/]+)$/);
            const busDashboardMatch = pathname.match(/^\/bus\/dashboard\/([^/]+)$/);
            if (hotelMatch) {
              return navigate({ to: "/hotel/$id", params: { id: hotelMatch[1] } });
            }
            if (restMatch) {
              return navigate({ to: "/restaurants/$placeId", params: { placeId: restMatch[1] } });
            }
            if (busDashboardMatch) {
              return navigate({ to: "/bus/dashboard/$code", params: { code: busDashboardMatch[1] } });
            }
            if (vueloMatch) {
              return navigate({
                to: "/vuelos/$iata",
                params: { iata: vueloMatch[1] },
                search: search as any,
              });
            }
            // Doctrina: al llevar al usuario a /playas o /playas/mapa, el
            // agente se despide y cierra para que el usuario decida qué playa.
            // Damos tiempo a que termine de hablar la despedida (~4s).
            if (pathname === "/playas" || pathname === "/playas/mapa") {
              setTimeout(() => { try { onClose(); } catch {} }, 4000);
            }

            if (Object.keys(search).length > 0) {
              return navigate({ to: pathname as any, search: search as any });
            }
            return navigate({ to: pathname as any });
          } catch {
            try {
              const legacyBusLine = raw.match(/^\/bus\/lines\/([^/?#]+)$/i);
              if (legacyBusLine) {
                window.location.assign(`/bus/dashboard/${legacyBusLine[1]}`);
              } else if (["/bus", "/bus/", "/bus/planner", "/buses-en-vivo", "/bus/lines", "action:bus-picker"].includes(raw)) {
                try {
                  window.sessionStorage.setItem("agent:open-bus-picker", "1");
                } catch {
                  /* noop */
                }
                window.location.assign("/?openBusPicker=1");
              } else {
                window.location.assign(raw);
              }
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
          }, 50);
          // No tocamos loading aquí — lo limpia speakExternalSummary o el timeout.
          return;
        } else if (target && target !== path) {
          setTimeout(() => {
            const done = goTo(target);
            Promise.resolve(done).finally(() => {
              if (localOpenSubmenu && typeof window !== "undefined") {
                window.dispatchEvent(
                  new CustomEvent("afp:open-submenu", { detail: { path: localOpenSubmenu } }),
                );
              }
            });
          }, 50);
        } else if (target && target === path && navigationRetry) {
          setTimeout(() => {
            try {
              window.location.assign(target);
            } catch {
              goTo(target);
            }
          }, 50);
        } else if (target && target === path && localOpenSubmenu && typeof window !== "undefined") {
          // Ya estamos en el hub: solo abrimos el submenú.
          window.dispatchEvent(
            new CustomEvent("afp:open-submenu", { detail: { path: localOpenSubmenu } }),
          );
        }
        // La voz ya se ha lanzado arriba con speak(reply). Aquí sólo
        // gestionamos navegación tardía si procede.
        finalTarget = target;
        rememberAgentRoute(finalTarget, finalReply);
      } finally {
        if (!awaitingSummaryRef.current) setLoading(false);
        // Telemetría fire-and-forget: registra la interacción.
        // Nunca bloquea la UX y nunca lanza errores al usuario.
        try {
          const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
          void logInteraction({
            data: {
              rawQuery: clean,
              normalizedQuery: clean.toLowerCase().trim(),
              resolverType: serverCalled ? "intent_ai" : "intent_keyword",
              resolved: !!finalTarget,
              fallbackUsed: serverCalled,
              latencyMs: Math.round(t1 - t0),
              routeOrigin: path ?? null,
              decision: finalTarget ? "navigated" : "answered",
              sessionId: sessionIdRef.current,
              detectedIntent: finalTarget ?? null,
              modelUsed: serverCalled ? "google/gemini-2.5-flash" : "local-resolver",
              notes: (finalReply ?? "").slice(0, 3500),
            },
          }).catch(() => {});
        } catch {
          /* noop */
        }
      }
    },
    [msgs, path, navigate, speak, stopListening, bumpIdle, askAgent, onClose, logInteraction],
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
    // ── Saludo de continuidad (reentrada dentro de la misma sesión) ──
    // Si han pasado >8s desde la última interacción y el panel sigue
    // abierto, hablamos una micro-frase ANTES de abrir el micrófono.
    if (!__vaContinuityInFlight && typeof window !== "undefined") {
      let lastTs = 0;
      try {
        lastTs = Number(
          window.sessionStorage.getItem(VA_LAST_INTERACTION_KEY) ?? "0",
        ) || 0;
      } catch {}
      const now = Date.now();
      const gap = lastTs ? now - lastTs : 0;
      const sinceLastContinuity = now - __vaContinuitySpokenAt;
      const synth = window.speechSynthesis;
      const synthBusy = Boolean(synth && (synth.speaking || synth.pending));
      if (
        lastTs > 0 &&
        gap > 8000 &&
        sinceLastContinuity > 15000 &&
        !synthBusy &&
        !__vaActiveUtterance &&
        !__vaActiveAudio &&
        !mutedRef.current
      ) {
        try {
          const text = getContinuityMicroGreeting();
          const u = new SpeechSynthesisUtterance(text);
          u.lang = VA_VOICE_LANG;
          u.rate = VA_VOICE_RATE;
          u.pitch = VA_VOICE_PITCH;
          u.volume = 1;
          const v = synth ? pickSpanishVoice(synth) : null;
          if (v) u.voice = v;
          __vaActiveUtterance = u;
          __vaContinuityInFlight = true;
          __vaContinuitySpokenAt = now;
          speakingRef.current = true;
          setSpeaking(true);
          const done = () => {
            if (__vaActiveUtterance === u) __vaActiveUtterance = null;
            __vaContinuityInFlight = false;
            speakingRef.current = false;
            setSpeaking(false);
            markVaInteraction();
            suppressRecognitionUntilRef.current =
              Date.now() + POST_SPEECH_LISTEN_DELAY_MS;
            resumeListeningAfterEcho(400);
          };
          u.onend = done;
          u.onerror = done;
          try { synth?.cancel(); } catch {}
          synth?.speak(u);
          return;
        } catch {
          __vaContinuityInFlight = false;
        }
      }
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
          {interim ? (
            <p className="truncate text-[11px] italic text-muted-foreground">"{interim}…"</p>
          ) : (() => {
              const lastAssistant = [...msgs].reverse().find((m) => m.role === "assistant");
              if (!lastAssistant?.content) return null;
              return (
                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                  {lastAssistant.content}
                </p>
              );
            })()}
        </div>

        <button
          onClick={() => {
            setLlmDisabled((v) => {
              const next = !v;
              try { window.localStorage.setItem("va:disableLLM", next ? "1" : "0"); } catch {}
              return next;
            });
          }}
          aria-label={llmDisabled ? "Activar IA externa (Gemini)" : "Desactivar IA externa (Gemini)"}
          title={llmDisabled ? "IA externa OFF · solo aprendizaje" : "IA externa ON · usa Gemini si no hay match"}
          className={`flex h-9 w-9 items-center justify-center rounded-full border ${llmDisabled ? "bg-destructive/15 text-destructive border-destructive/40" : "bg-background text-foreground"} hover:bg-muted`}
        >
          <Sparkles className={`h-4 w-4 ${llmDisabled ? "opacity-50 line-through" : ""}`} />
        </button>

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
  const openedAtRef = useRef(0);
  const voiceBootStartedRef = useRef(false);
  const greetingPlayedRef = useRef(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hidden =
    ["/welcome"].includes(path) ||
    path.startsWith("/auth/") ||
    path.startsWith("/business/login");

  const playGreetingAfterPermission = () => {
    if (greetingPlayedRef.current) return;
    try {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      const synth = window.speechSynthesis;
      try { synth.resume(); } catch {}
      warmSpeechVoices(synth);
      greetingPlayedRef.current = speakGreetingFromUserGesture(true);
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

  const openPanelWithGreeting = () => {
    if (!open) {
      const greetingAlreadyStarted = __vaGetGreetingSpoken() || isAgentSpeechOutputActive();
      greetingPlayedRef.current = greetingAlreadyStarted;
      if (!greetingAlreadyStarted) __vaSetGreetingSpoken(false);
      voiceBootStartedRef.current = false;
    }
    openedAtRef.current = Date.now();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    if (greetingPlayedRef.current || __vaGetGreetingSpoken()) return;
    const t = window.setTimeout(() => {
      if (open && !greetingPlayedRef.current && !__vaGetGreetingSpoken()) {
        playGreetingAfterPermission();
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [open]);

  // Permitir abrir el agente desde otros botones (p.ej. el micro del chat)
  useEffect(() => {
    const primeVoice = () => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      warmSpeechVoices(window.speechSynthesis);
      primeSpanishUtterances();
      try { window.speechSynthesis.resume(); } catch {}
    };
    window.addEventListener("vamos:prime-voice", primeVoice);
    const handler = () => openPanelWithGreeting();
    window.addEventListener("vamos:open", handler);
    return () => {
      window.removeEventListener("vamos:prime-voice", primeVoice);
      window.removeEventListener("vamos:open", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // El saludo SOLO se dispara cuando el usuario pulsa el FAB del agente
  // (openPanelWithGreeting → startGreetingFromUserGesture). No hay autoplay
  // global ni fallback flotante: sin pulsación explícita, el agente calla.
  useEffect(() => {
    if (hidden) return;
    if (typeof window === "undefined") return;
    if (window.speechSynthesis) warmSpeechVoices(window.speechSynthesis);
    primeSpanishUtterances();
    // Pre-warm TTS al primer gesto del usuario (cualquier toque/clic).
    // Desbloquea el motor de voz y carga voces antes de que se necesite
    // hablar, eliminando la latencia inicial en frío (sin caché).
    let primed = false;
    const primeOnce = () => {
      if (primed) return;
      primed = true;
      try {
        iniciarAudio();
        if (window.speechSynthesis) {
          warmSpeechVoices(window.speechSynthesis);
          window.speechSynthesis.resume();
        }
        primeSpanishUtterances();
      } catch { /* noop */ }
      window.removeEventListener("pointerdown", primeOnce, true);
      window.removeEventListener("touchstart", primeOnce, true);
      window.removeEventListener("keydown", primeOnce, true);
    };
    window.addEventListener("pointerdown", primeOnce, true);
    window.addEventListener("touchstart", primeOnce, true);
    window.addEventListener("keydown", primeOnce, true);
    return () => {
      window.removeEventListener("pointerdown", primeOnce, true);
      window.removeEventListener("touchstart", primeOnce, true);
      window.removeEventListener("keydown", primeOnce, true);
    };
  }, [hidden]);

  if (hidden) return null;

  return (
    <>
      <AgenteVamosPanel
        open={open}
        onClose={() => {
          // Evita el cierre fantasma: el click sintético posterior al
          // pointerdown del FAB aterriza sobre "Cerrar" recién montado.
          if (Date.now() - openedAtRef.current < 100) return;
          voiceBootStartedRef.current = false;
          greetingPlayedRef.current = false;
          __vaSetGreetingSpoken(false);
          setOpen(false);
        }}
      />
    </>
  );
}


