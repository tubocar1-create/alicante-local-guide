import { createFileRoute } from "@tanstack/react-router";
import FoodSelector, { type FoodItem } from "@/components/FoodSelector";

export const Route = createFileRoute("/selectordecomidas_/comida-rapida")({
  head: () => ({
    meta: [
      { title: "Comida rápida — Alicante Friend" },
      {
        name: "description",
        content:
          "Elige tu comida rápida en Alicante: hamburguesas, pizza, kebab, pollo frito, mexicano, bocadillos, hot dogs o asiático rápido.",
      },
      { property: "og:title", content: "Comida rápida — Alicante Friend" },
      { property: "og:description", content: "Comida rápida abierta ahora en Alicante." },
    ],
  }),
  component: ComidaRapidaPage,
});

const CATEGORIES: FoodItem[] = [
  { label: "Hamburguesas", emoji: "🍔", prompt: "Quiero una buena hamburguesa abierta ahora en Alicante" },
  { label: "Pizza", emoji: "🍕", prompt: "Quiero pizza abierta ahora en Alicante" },
  { label: "Kebab / Doner", emoji: "🌯", prompt: "Quiero kebab o doner abierto ahora en Alicante" },
  { label: "Pollo frito", emoji: "🍗", prompt: "Quiero pollo frito abierto ahora en Alicante" },
  { label: "Mexicano", emoji: "🌮", prompt: "Quiero mexicano (tacos, burritos) abierto ahora en Alicante" },
  { label: "Bocadillos / Montaditos", emoji: "🥖", prompt: "Quiero bocadillos o montaditos abiertos ahora en Alicante" },
  { label: "Hot dogs", emoji: "🌭", prompt: "Quiero hot dogs abiertos ahora en Alicante" },
  { label: "Asiático rápido", emoji: "🍜", prompt: "Quiero asiático rápido (wok, poke, ramen) abierto ahora en Alicante" },
];

const FAST_KEYS = [
  "burger", "hamburg", "fast", "rápida", "rapida", "kebab", "kebap", "doner",
  "hot dog", "fried chicken", "pollo frito", "pizza", "pizzer", "mexican", "mejican",
  "taco", "wok", "poke", "ramen", "bocadill", "montadit", "sandwich",
];

const BADGES = [
  { keys: ["burger", "hamburg"], label: "Hamburguesas", emoji: "🍔" },
  { keys: ["pizza", "pizzer"], label: "Pizza", emoji: "🍕" },
  { keys: ["kebab", "kebap", "doner"], label: "Kebab", emoji: "🌯" },
  { keys: ["pollo frito", "fried chicken"], label: "Pollo frito", emoji: "🍗" },
  { keys: ["mexican", "mejican", "taco"], label: "Mexicano", emoji: "🌮" },
  { keys: ["bocadill", "montadit", "sandwich"], label: "Bocadillos", emoji: "🥖" },
  { keys: ["hot dog"], label: "Hot dogs", emoji: "🌭" },
  { keys: ["wok", "poke", "ramen", "asian", "asiát", "asiat"], label: "Asiático rápido", emoji: "🍜" },
];

function ComidaRapidaPage() {
  return (
    <FoodSelector
      title="Comida rápida en Alicante"
      categories={CATEGORIES}
      cuisineKeys={FAST_KEYS}
      badgeCategories={BADGES}
      backTo="/selectordecomidas"
    />
  );
}
