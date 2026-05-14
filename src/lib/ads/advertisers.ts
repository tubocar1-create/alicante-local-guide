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
  | "mercadillos";

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

export const ADVERTISERS: Advertiser[] = [
  {
    id: "clima-alicante",
    name: "Clima Alicante",
    tagline: "El tiempo que hace ahora mismo",
    category: "Meteorología",
    kind: "weather",
    ctaLabel: "Ver más",
    ctaUrl: "https://www.aemet.es/es/eltiempo/prediccion/municipios/alicante-alacant-id03014",
    theme: {
      bg: "bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-500",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-teal-500 via-cyan-600 to-blue-600",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-rose-500 via-red-500 to-orange-500",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-emerald-500 via-green-500 to-lime-500",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-500",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-slate-700 via-blue-700 to-indigo-700",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-sky-700 via-blue-700 to-indigo-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-amber-600 via-orange-600 to-red-600",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-red-700 via-rose-700 to-pink-700",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-yellow-600 via-amber-700 to-orange-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-stone-700 via-zinc-700 to-neutral-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-violet-700 via-purple-800 to-fuchsia-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-pink-700 via-rose-800 to-red-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-orange-700 via-red-700 to-rose-800",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-zinc-800 via-neutral-900 to-stone-900",
      fg: "text-white",
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
      bg: "bg-gradient-to-r from-rose-600 via-pink-700 to-purple-800",
      fg: "text-white",
      accent: "bg-white text-rose-700",
      emoji: "🎟️",
    },
    brief: "Próximos conciertos en el área metropolitana de Alicante según la API oficial de Songkick.",
  },
];
export function getAdvertiser(id: string): Advertiser | undefined {
  return ADVERTISERS.find((a) => a.id === id);
}
