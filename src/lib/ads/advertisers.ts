// Catálogo de anunciantes. Plastiahorro entra como prototipo.
// El brief alimenta a la IA para generar variantes de copy.

export type Advertiser = {
  id: string;
  name: string;
  tagline: string;
  category: string;
  ctaLabel: string;
  ctaUrl: string;
  // Estilo visual del banner (tokens semánticos / tailwind)
  theme: {
    bg: string;
    fg: string;
    accent: string;
    emoji: string;
  };
  // Brief para la IA (en español, tono cercano)
  brief: string;
};

export const ADVERTISERS: Advertiser[] = [
  {
    id: "plastiahorro",
    name: "Plastiahorro",
    tagline: "Tu tienda de envases y menaje al mejor precio",
    category: "Hogar y envases",
    ctaLabel: "Ver tienda",
    ctaUrl: "https://www.plastiahorro.com",
    theme: {
      bg: "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500",
      fg: "text-white",
      accent: "bg-white text-emerald-700",
      emoji: "🛍️",
    },
    brief:
      "Plastiahorro es una cadena de tiendas de envases, menaje, hogar y bazar con precios muy competitivos. Vende tuppers, cristalería, plástico de cocina, productos de limpieza, organizadores, decoración y útiles de hostelería. Tono cercano, alegre, con guiño práctico (ahorrar en lo del día a día). Pensado para residentes y hosteleros de Alicante. Evita lenguaje agresivo de venta.",
  },
];

export function getAdvertiser(id: string): Advertiser | undefined {
  return ADVERTISERS.find((a) => a.id === id);
}
