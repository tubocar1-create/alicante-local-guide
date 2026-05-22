// Catálogo de "banners" informativos. Ya no son anuncios comerciales:
// son tarjetitas de clima y datos útiles sobre Alicante generados por IA.

export type BannerKind =
  | "weather"
  | "info"
  | "marine"
  | "parkings"
  | "traffic"
  | "air"
  | "agenda"
  | "flights"
  | "flights_tomorrow"
  | "trains"
  | "buses"
  | "regional_agenda"
  | "mercadillos"
  | "news"
  | "alicante_press"
  | "incidencias";


export type Advertiser = {
  id: string;
  name: string; // etiqueta corta arriba del banner
  tagline: string;
  category: string;
  kind: BannerKind;
  ctaLabel: string;
  ctaUrl: string;
  theme: {
    bg: string;
    fg: string;
    accent: string;
    emoji: string;
  };
  brief: string;
};

const ADVERTISERS_RAW: Advertiser[] = [
  {
    id: "clima-alicante",
    name: "Clima Alicante",
    tagline: "El tiempo que hace ahora mismo",
    category: "Meteorología",
    kind: "weather",
    ctaLabel: "Ver más",
    ctaUrl: "https://www.aemet.es/es/eltiempo/prediccion/municipios/alicante-alacant-id03014",
    theme: {
      bg: "bg-gradient-to-r from-sky-100 via-cyan-200 to-blue-200",
      fg: "text-slate-800",
      accent: "bg-white text-sky-700",
      emoji: "☀️",
    },
    brief:
      "Banner meteorológico para residentes y visitantes de Alicante. Tono cercano y útil: si llueve, aviso amable; si pega el sol, recordatorio de hidratarse o crema; si hace levante, aviso de mar movido. Nunca alarmista.",
  },
  {
    id: "mar-alicante",
    name: "Mar y playa",
    tagline: "Estado del mar en el Postiguet",
    category: "Mar",
    kind: "marine",
    ctaLabel: "Ver mar",
    ctaUrl: "https://www.puertos.es/es-es/oceanografia/Paginas/portus.aspx",
    theme: {
      bg: "bg-gradient-to-r from-teal-100 via-cyan-200 to-blue-200",
      fg: "text-slate-800",
      accent: "bg-white text-teal-700",
      emoji: "🌊",
    },
    brief:
      "Tarjeta sobre el estado del mar en Alicante (Postiguet/San Juan). Tono cercano y útil: temperatura del agua, altura de ola, si es buen día para baño, paddle surf o mejor pasear por el paseo marítimo.",
  },
  {
    id: "info-alicante",
    name: "¿Sabías que…?",
    tagline: "Datos curiosos y consejos locales",
    category: "Información local",
    kind: "info",
    ctaLabel: "Saber más",
    ctaUrl: "https://es.wikipedia.org/wiki/Alicante",
    theme: {
      bg: "bg-gradient-to-r from-amber-100 via-orange-200 to-rose-200",
      fg: "text-slate-800",
      accent: "bg-white text-orange-700",
      emoji: "💡",
    },
    brief:
      "Tarjeta informativa con datos reales sobre Alicante extraídos de Wikipedia.",
  },
  {
    id: "parkings-alicante",
    name: "Parkings centro",
    tagline: "Plazas libres en tiempo real",
    category: "Movilidad",
    kind: "parkings",
    ctaLabel: "Ver parkings",
    ctaUrl: "https://movilidad.alicante.es/parkings",
    theme: {
      bg: "bg-gradient-to-r from-violet-100 via-purple-200 to-fuchsia-200",
      fg: "text-slate-800",
      accent: "bg-white text-violet-700",
      emoji: "🅿️",
    },
    brief:
      "Estado en vivo de los parkings públicos del centro de Alicante (datos del Ayuntamiento). Indica cuál tiene más plazas libres y cuál está más lleno.",
  },
  {
    id: "trafico-alicante",
    name: "Tráfico Alicante",
    tagline: "Cómo está la circulación",
    category: "Movilidad",
    kind: "traffic",
    ctaLabel: "Ver mapa",
    ctaUrl: "https://movilidad.alicante.es/",
    theme: {
      bg: "bg-gradient-to-r from-rose-100 via-red-200 to-orange-200",
      fg: "text-slate-800",
      accent: "bg-white text-rose-700",
      emoji: "🚦",
    },
    brief:
      "Estado del tráfico en Alicante (datos en vivo del Ayuntamiento): tramos fluidos vs densos, incidencias y cortes activos.",
  },
  {
    id: "aire-alicante",
    name: "Calidad del aire",
    tagline: "Estaciones medioambientales",
    category: "Medio ambiente",
    kind: "air",
    ctaLabel: "Ver estaciones",
    ctaUrl: "https://movilidad.alicante.es/estaciones-medioambientales",
    theme: {
      bg: "bg-gradient-to-r from-emerald-100 via-green-200 to-lime-200",
      fg: "text-slate-800",
      accent: "bg-white text-emerald-700",
      emoji: "🌿",
    },
    brief:
      "Estado real de la calidad del aire en Alicante según las estaciones del Ayuntamiento (verde = bueno, amarillo = aceptable, rojo = malo).",
  },
  {
    id: "agenda-alicante",
    name: "Agenda cultural",
    tagline: "Qué hacer hoy en Alicante",
    category: "Cultura",
    kind: "agenda",
    ctaLabel: "Ver agenda",
    ctaUrl: "https://www.alicante.es/es/agenda",
    theme: {
      bg: "bg-gradient-to-r from-fuchsia-100 via-pink-200 to-rose-200",
      fg: "text-slate-800",
      accent: "bg-white text-fuchsia-700",
      emoji: "🎭",
    },
    brief:
      "Eventos culturales reales publicados en la agenda oficial del Ayuntamiento de Alicante: exposiciones, conciertos, rutas, etc.",
  },
  {
    id: "vuelos-alicante",
    name: "Vuelos en vivo",
    tagline: "Tráfico aéreo cerca del aeropuerto",
    category: "Aeropuerto",
    kind: "flights",
    ctaLabel: "Ver vuelos",
    ctaUrl: "https://www.aena.es/es/aeropuerto-alicante-elche/index.html",
    theme: {
      bg: "bg-gradient-to-r from-slate-100 via-blue-200 to-indigo-200",
      fg: "text-slate-800",
      accent: "bg-white text-blue-700",
      emoji: "✈️",
    },
    brief:
      "Tráfico aéreo en vivo alrededor del aeropuerto de Alicante-Elche (ALC/LEAL) usando OpenSky Network: aviones en vuelo cerca, en pista, callsign, altitud y país.",
  },
  {
    id: "vuelos-manana-alicante",
    name: "Vuelos mañana",
    tagline: "Salidas programadas Alicante-Elche",
    category: "Aeropuerto",
    kind: "flights_tomorrow",
    ctaLabel: "Ver vuelos",
    ctaUrl: "https://www.aena.es/es/aeropuerto-alicante-elche/vuelos.html",
    theme: {
      bg: "bg-gradient-to-r from-sky-100 via-blue-200 to-indigo-200",
      fg: "text-slate-800",
      accent: "bg-white text-sky-700",
      emoji: "🛫",
    },
    brief:
      "Salidas programadas para mañana en el aeropuerto de Alicante-Elche (ALC), fuente oficial AENA Infovuelos. Se rotan aleatoriamente y se actualizan cada día.",
  },
  {
    id: "trenes-alicante",
    name: "Trenes Alicante",
    tagline: "Próximas llegadas y salidas",
    category: "Tren",
    kind: "trains",
    ctaLabel: "Ver horarios",
    ctaUrl: "https://www.renfe.com/es/es/cercanias/cercanias-murcia-alicante",
    theme: {
      bg: "bg-gradient-to-r from-purple-100 via-indigo-200 to-blue-200",
      fg: "text-slate-800",
      accent: "bg-white text-indigo-700",
      emoji: "🚆",
    },
    brief:
      "Próximas llegadas y salidas programadas en Alicante-Terminal según el horario oficial de Renfe Cercanías (núcleo Murcia/Alicante). Líneas C-1 (Murcia/Orihuela) y C-3 (Sant Vicent).",
  },
  {
    id: "buses-alicante",
    name: "Buses Alicante",
    tagline: "Próximas llegadas en paradas céntricas",
    category: "Transporte",
    kind: "buses",
    ctaLabel: "Ver en mapa",
    ctaUrl: "https://alibus.es/",
    theme: {
      bg: "bg-gradient-to-r from-emerald-100 via-teal-200 to-cyan-200",
      fg: "text-slate-800",
      accent: "bg-white text-teal-700",
      emoji: "🚌",
    },
    brief:
      "Próximas llegadas en tiempo real de buses urbanos (Vectalia/Masatusa) en paradas céntricas de Alicante: Luceros, Mercado, Puerta del Mar, Estación-Maisonnave y Rambla. Datos de AliBus.",
  },
  {
    id: "mercadillos-alicante",
    name: "Mercadillos hoy",
    tagline: "Qué mercadillo toca hoy en Alicante",
    category: "Comercio",
    kind: "mercadillos",
    ctaLabel: "Ver mercados",
    ctaUrl: "https://www.alicante.es/es/estructura-politica/concejalia-mercados",
    theme: {
      bg: "bg-gradient-to-r from-amber-100 via-orange-200 to-red-200",
      fg: "text-slate-800",
      accent: "bg-white text-amber-700",
      emoji: "🧺",
    },
    brief:
      "Mercadillos municipales de Alicante que están activos hoy según el calendario oficial de la Concejalía de Mercados.",
  },
  {
    id: "teatro-principal",
    name: "Teatro Principal",
    tagline: "Próximas funciones",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver cartelera",
    ctaUrl: "https://www.teatroprincipaldealicante.com/programacion-actual/",
    theme: {
      bg: "bg-gradient-to-r from-red-100 via-rose-200 to-pink-200",
      fg: "text-slate-800",
      accent: "bg-white text-red-700",
      emoji: "🎭",
    },
    brief: "Cartelera del Teatro Principal de Alicante.",
  },
  {
    id: "plaza-toros",
    name: "Plaza de Toros",
    tagline: "Conciertos y eventos",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver eventos",
    ctaUrl: "https://plazatorosalicante.com/conciertos-y-eventos/",
    theme: {
      bg: "bg-gradient-to-r from-yellow-100 via-amber-200 to-orange-200",
      fg: "text-slate-800",
      accent: "bg-white text-amber-800",
      emoji: "🎤",
    },
    brief: "Conciertos y eventos en la Plaza de Toros de Alicante.",
  },
  {
    id: "adda-alicante",
    name: "ADDA",
    tagline: "Programación del Auditorio",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver programa",
    ctaUrl: "https://addaalicante.es/programacion/",
    theme: {
      bg: "bg-gradient-to-r from-stone-100 via-zinc-200 to-neutral-200",
      fg: "text-slate-800",
      accent: "bg-white text-stone-800",
      emoji: "🎼",
    },
    brief: "Programación del Auditorio de la Diputación de Alicante (ADDA).",
  },
  {
    id: "stereo-alicante",
    name: "Stereo Alicante",
    tagline: "Conciertos en Stereo",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver agenda",
    ctaUrl: "https://stereoalicante.es",
    theme: {
      bg: "bg-gradient-to-r from-violet-100 via-purple-200 to-fuchsia-200",
      fg: "text-slate-800",
      accent: "bg-white text-violet-700",
      emoji: "🎸",
    },
    brief: "Conciertos en directo de la sala Stereo Alicante.",
  },
  {
    id: "sala-one",
    name: "Sala One",
    tagline: "Programación Sala One",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver agenda",
    ctaUrl: "https://salaone.com",
    theme: {
      bg: "bg-gradient-to-r from-pink-100 via-rose-200 to-red-200",
      fg: "text-slate-800",
      accent: "bg-white text-pink-700",
      emoji: "🎧",
    },
    brief: "Conciertos y sesiones de la Sala One de Alicante.",
  },
  {
    id: "muelle-live",
    name: "Muelle Live",
    tagline: "Conciertos en el puerto",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver agenda",
    ctaUrl: "https://muellelive.com",
    theme: {
      bg: "bg-gradient-to-r from-blue-100 via-indigo-200 to-slate-200",
      fg: "text-slate-800",
      accent: "bg-white text-blue-700",
      emoji: "⚓",
    },
    brief: "Conciertos en Muelle Live, puerto de Alicante.",
  },
  {
    id: "spring-alicante",
    name: "Spring",
    tagline: "Programación Spring Alicante",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver agenda",
    ctaUrl: "https://springalicante.es",
    theme: {
      bg: "bg-gradient-to-r from-emerald-100 via-teal-200 to-cyan-200",
      fg: "text-slate-800",
      accent: "bg-white text-emerald-700",
      emoji: "🌱",
    },
    brief: "Programación de la sala Spring Alicante.",
  },
  {
    id: "rabasa-alicante",
    name: "Rabasa / Área 12",
    tagline: "Grandes conciertos en Rabasa",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver cartel",
    ctaUrl: "https://area12alicante.es/",
    theme: {
      bg: "bg-gradient-to-r from-orange-100 via-red-200 to-rose-200",
      fg: "text-slate-800",
      accent: "bg-white text-orange-700",
      emoji: "🎪",
    },
    brief: "Conciertos del ciclo Área 12 en el Multiespacio Rabasa de Alicante (formato grande: Black Crowes, Dani Martín, Viva Suecia, Hombres G…).",
  },
  {
    id: "rocanrola-alicante",
    name: "Rocanrola",
    tagline: "Festival de hip-hop en Alicante",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver cartel",
    ctaUrl: "https://area12alicante.es/",
    theme: {
      bg: "bg-gradient-to-r from-zinc-100 via-neutral-200 to-stone-200",
      fg: "text-slate-800",
      accent: "bg-white text-zinc-900",
      emoji: "🎤",
    },
    brief: "Festival Rocanrola en Alicante: hip-hop y rap en español (Kase.O, Nach, Delaossa, Hijos de la Ruina, Fernandocosta, Lia Kali).",
  },
  {
    id: "songkick-alicante",
    name: "Conciertos cercanos",
    tagline: "Próximos directos en Alicante",
    category: "Cultura",
    kind: "regional_agenda",
    ctaLabel: "Ver en Songkick",
    ctaUrl: "https://www.songkick.com/es/metro-areas/34604-spain-alicante",
    theme: {
      bg: "bg-gradient-to-r from-rose-100 via-pink-200 to-purple-200",
      fg: "text-slate-800",
      accent: "bg-white text-rose-700",
      emoji: "🎟️",
    },
    brief: "Próximos conciertos en el área metropolitana de Alicante según la API oficial de Songkick.",
  },
  {
    id: "prensa-alicante",
    name: "Prensa local",
    tagline: "Titulares de hoy en Alicante",
    category: "Actualidad",
    kind: "news",
    ctaLabel: "Ver noticias",
    ctaUrl: "https://news.google.com/search?q=Alicante&hl=es-ES&gl=ES&ceid=ES:es",
    theme: {
      bg: "bg-gradient-to-r from-neutral-100 via-stone-200 to-amber-200",
      fg: "text-slate-800",
      accent: "bg-white text-neutral-900",
      emoji: "📰",
    },
    brief:
      "Titulares destacados de la prensa alicantina de hoy (Google News). Filtramos política y tragedias; nos centramos en contexto urbano, eventos, cultura, gastronomía, deporte y ciencia/tecnología.",
  },
  {
    id: "alicante-press",
    name: "Alicante Press",
    tagline: "Titulares de Alicante Press",
    category: "Actualidad",
    kind: "alicante_press",
    ctaLabel: "Leer en Alicante Press",
    ctaUrl: "https://alicantepress.com/",
    theme: {
      bg: "bg-gradient-to-r from-slate-100 via-zinc-200 to-stone-200",
      fg: "text-slate-900",
      accent: "bg-white text-slate-900",
      emoji: "🗞️",
    },
    brief:
      "Titulares en directo de alicantepress.com. Selección de noticias urbanas, culturales, deportivas y económicas; filtramos política partidista y sucesos.",
  },
  {
    id: "incidencias-alicante",
    name: "Incidencias hoy",
    tagline: "Avisos del Ayuntamiento para hoy",
    category: "Movilidad",
    kind: "incidencias",
    ctaLabel: "Ver incidencias",
    ctaUrl: "https://movilidad.alicante.es/incidencias",
    theme: {
      bg: "bg-gradient-to-r from-amber-200 via-orange-300 to-red-300",
      fg: "text-slate-900",
      accent: "bg-white text-red-700",
      emoji: "⚠️",
    },
    brief:
      "Incidencias activas hoy publicadas por movilidad.alicante.es (cortes, obras, eventos que afectan la circulación). Tono claro y útil, sin alarmismo.",
  },
];

// Rotación del carrusel. El orden definitivo se baraja en AdBanner; aquí solo
// declaramos qué anunciantes participan y cuántas posiciones ocupa cada uno.
// "incidencias-alicante" aparece x3 (triple frecuencia) cuando hay aviso activo.
const DISPLAY_ORDER: string[] = [
  "incidencias-alicante",
  "clima-alicante",
  "incidencias-alicante",
  "teatro-principal",
  "teatro-principal",
  "mar-alicante",
  "muelle-live",
  "parkings-alicante",
  "incidencias-alicante",
  "plaza-toros",
  "trafico-alicante",
  "adda-alicante",
  "info-alicante",
  "prensa-alicante",
  "rabasa-alicante",
  "aire-alicante",
  "stereo-alicante",
  "vuelos-alicante",
  "spring-alicante",
  "trenes-alicante",
  "sala-one",
  "agenda-alicante",
  "rocanrola-alicante",
  "buses-alicante",
  "songkick-alicante",
  "vuelos-manana-alicante",
  "alicante-press",
  "mercadillos-alicante",
];

export const ADVERTISERS: Advertiser[] = (() => {
  const byId = new Map(ADVERTISERS_RAW.map((a) => [a.id, a]));
  const ordered: Advertiser[] = [];
  const used = new Set<string>();
  for (const id of DISPLAY_ORDER) {
    const a = byId.get(id);
    if (a) {
      ordered.push(a);
      used.add(id);
    }
  }
  // Cualquier anunciante nuevo que no esté en DISPLAY_ORDER va al final.
  for (const [id, a] of byId.entries()) {
    if (!used.has(id)) ordered.push(a);
  }
  return ordered;
})();

export function getAdvertiser(id: string): Advertiser | undefined {
  return ADVERTISERS.find((a) => a.id === id);
}
