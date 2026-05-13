// Catálogo de "banners" informativos. Ya no son anuncios comerciales:
// son tarjetitas de clima y datos útiles sobre Alicante generados por IA.

export type BannerKind =
  | "weather"
  | "info"
  | "marine"
  | "parkings"
  | "traffic"
  | "air"
  | "agenda";

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
];
export function getAdvertiser(id: string): Advertiser | undefined {
  return ADVERTISERS.find((a) => a.id === id);
}
