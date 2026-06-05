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
  { label: "Hamburguesas", emoji: "🍔", prompt: "Una hamburguesería abierta ahora (Goiko, Five Guys, TGB, smash burger…)" },
  { label: "Pizza", emoji: "🍕", prompt: "Una pizzería abierta ahora (Telepizza, Domino's…)" },
  { label: "Kebab / Doner", emoji: "🌯", prompt: "Un kebab o döner abierto ahora" },
  { label: "Pollo frito", emoji: "🍗", prompt: "Pollo frito abierto ahora (KFC, Popeyes, pollos asados…)" },
  { label: "Mexicano", emoji: "🌮", prompt: "Un mexicano abierto ahora (Taco Bell, tacos, burritos…)" },
  { label: "Bocadillos / Montaditos", emoji: "🥖", prompt: "Bocadillos o montaditos abiertos ahora (100 Montaditos, Lizarrán…)" },
  { label: "Hot dogs", emoji: "🌭", prompt: "Hot dogs abiertos ahora en Alicante" },
  { label: "Asiático rápido", emoji: "🍜", prompt: "Un asiático rápido abierto ahora (ramen, wok, sushi para llevar…)" },
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
      bgClass="bg-[#e6f4fb]"
    />
  );
}
