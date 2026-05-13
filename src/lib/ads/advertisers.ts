// Catálogo de "banners" informativos. Ya no son anuncios comerciales:
// son tarjetitas de clima y datos útiles sobre Alicante generados por IA.

export type BannerKind = "weather" | "info" | "marine" | "parkings" | "traffic";

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
];

export function getAdvertiser(id: string): Advertiser | undefined {
  return ADVERTISERS.find((a) => a.id === id);
}
