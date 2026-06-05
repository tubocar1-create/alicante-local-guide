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
  { label: "Hamburguesas", emoji: "🍔", to: "/restaurants_/categoria/fast_food:burger" },
  { label: "Pizza", emoji: "🍕", to: "/restaurants_/categoria/fast_food:pizza" },
  { label: "Kebab / Doner", emoji: "🌯", to: "/restaurants_/categoria/fast_food:kebab" },
  { label: "Pollo frito", emoji: "🍗", to: "/restaurants_/categoria/fast_food:chicken" },
  { label: "Mexicano", emoji: "🌮", to: "/restaurants_/categoria/fast_food:mexican" },
  { label: "Bocadillos / Montaditos", emoji: "🥖", to: "/restaurants_/categoria/fast_food:montaditos" },
  { label: "Hot dogs", emoji: "🌭", to: "/restaurants_/categoria/fast_food:hotdog" },
  { label: "Asiático rápido", emoji: "🍜", to: "/restaurants_/categoria/fast_food:asian" },
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
