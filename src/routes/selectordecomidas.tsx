import { createFileRoute } from "@tanstack/react-router";
import FoodSelector, { type FoodItem } from "@/components/FoodSelector";

export const Route = createFileRoute("/selectordecomidas")({
  head: () => ({
    meta: [
      { title: "Comer — Alicante Friend" },
      {
        name: "description",
        content:
          "Elige qué te apetece comer en Alicante: cocina típica, arroces, italiano, japonés, vegano, brunch, postres, comida rápida, barato o internacional.",
      },
      { property: "og:title", content: "Comer — Alicante Friend" },
      { property: "og:description", content: "Elige qué te apetece comer hoy en Alicante." },
    ],
  }),
  component: SelectorDeComidasPage,
});

const CATEGORIES: FoodItem[] = [
  { label: "Cocina típica", emoji: "🥘", prompt: "Recomiéndame un sitio de cocina típica alicantina tradicional abierto ahora" },
  { label: "Arroces y pescado", emoji: "🍤", prompt: "Quiero un buen arroz, paella o pescado fresco, ¿dónde voy ahora?" },
  { label: "Italiano", emoji: "🍕", prompt: "Apetece italiano (pizza, pasta), ¿dónde puedo ir ahora?" },
  { label: "Japonés / Asiático", emoji: "🍣", prompt: "Un japonés o asiático rico abierto ahora" },
  { label: "Vegano / Saludable", emoji: "🌱", prompt: "Un sitio vegano o saludable abierto ahora" },
  { label: "Desayuno / Brunch", emoji: "🥐", prompt: "Necesito un buen desayuno o brunch en Alicante abierto ahora" },
  { label: "Comida rápida", emoji: "🍔", to: "/selectordecomidas/comida-rapida" },
  { label: "Postres / Cafetería", emoji: "🍰", prompt: "Una cafetería con postres ricos abierta ahora" },
  { label: "Barato y rico", emoji: "💸", prompt: "Algo barato y rico para comer ya, abierto ahora" },
  { label: "Internacional", emoji: "🌍", prompt: "Quiero comida internacional (hindú, libanés, peruano, mexicano, latino, árabe…), ¿dónde voy ahora?" },
];

const BADGES = [
  { keys: ["paella", "arroz", "arrocer", "rice", "seafood", "fish", "pescado", "marisco", "marisquer"], label: "Arroces y pescado", emoji: "🍤" },
  { keys: ["italian", "italiano", "pizza", "pizzer", "pasta"], label: "Italiano", emoji: "🍕" },
  { keys: ["japan", "japon", "sushi", "ramen", "asian", "asiát", "asiat", "chin", "thai", "tailan", "korean", "corean", "vietnam", "wok", "poke"], label: "Japonés / Asiático", emoji: "🍣" },
  { keys: ["vegan", "vegetarian", "healthy", "salad", "ensalad", "saludable", "bowl"], label: "Vegano / Saludable", emoji: "🌱" },
  { keys: ["breakfast", "brunch", "desayuno", "tosta"], label: "Desayuno / Brunch", emoji: "🥐" },
  { keys: ["burger", "hamburg", "fast", "rápida", "rapida", "kebab", "kebap", "doner", "hot dog", "fried chicken", "pollo frito"], label: "Comida rápida", emoji: "🍔" },
  { keys: ["dessert", "postre", "ice cream", "helad", "cafe", "café", "coffee", "cafeter", "bakery", "pasteler", "panader", "chocolat", "gofre", "crep"], label: "Postres / Cafetería", emoji: "🍰" },
  { keys: ["indian", "hindú", "hindu", "lebanese", "líban", "liban", "mexican", "mejican", "peruvian", "peruan", "arab", "árab", "turkish", "turco", "moroccan", "marroqu", "latin", "latino", "venezolan", "argentin", "colomb", "cuban", "brasil"], label: "Internacional", emoji: "🌍" },
  { keys: ["spanish", "español", "espanol", "tapas", "tapeo", "mediterran", "alicant", "valencian", "tradicional", "típica", "tipica", "casera", "tabern", "bodega", "asador", "parrilla", "brasa", "jamón", "jamon", "embutid"], label: "Cocina típica", emoji: "🥘" },
];

function SelectorDeComidasPage() {
  return (
    <FoodSelector
      title="Disfruta la experiencia de comer en Alicante"
      categories={CATEGORIES}
      badgeCategories={BADGES}
    />
  );
}
