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
  "fast_food",
  "fast_food:burger",
  "fast_food:pizza",
  "fast_food:kebab",
  "fast_food:chicken",
  "fast_food:mexican",
  "fast_food:montaditos",
];

const BADGES = [
  { keys: ["fast_food:burger"], label: "Hamburguesas", emoji: "🍔" },
  { keys: ["fast_food:pizza"], label: "Pizza", emoji: "🍕" },
  { keys: ["fast_food:kebab"], label: "Kebab / Doner", emoji: "🌯" },
  { keys: ["fast_food:chicken"], label: "Pollo frito", emoji: "🍗" },
  { keys: ["fast_food:mexican"], label: "Mexicano", emoji: "🌮" },
  { keys: ["fast_food:montaditos"], label: "Bocadillos / Montaditos", emoji: "🥖" },
];

function ComidaRapidaPage() {
  return (
    <FoodSelector
      title="Comida rápida en Alicante"
      categories={CATEGORIES}
      cuisineKeys={FAST_KEYS}
      badgeCategories={BADGES}
      backTo="/selectordecomidas"
      bgClass="bg-[#f3e3c2]"
    />
  );
}
