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
  { keys: ["typical"], label: "Cocina típica", emoji: "🥘" },
  { keys: ["rice_fish"], label: "Arroces y pescado", emoji: "🍤" },
  { keys: ["italian", "pizzas"], label: "Italiano", emoji: "🍕" },
  { keys: ["asian"], label: "Japonés / Asiático", emoji: "🍣" },
  { keys: ["vegan"], label: "Vegano / Saludable", emoji: "🌱" },
  { keys: ["brunch"], label: "Desayuno / Brunch", emoji: "🥐" },
  { keys: ["fast_food", "fast_food:burger", "fast_food:pizza", "fast_food:kebab", "fast_food:chicken", "fast_food:mexican", "fast_food:montaditos"], label: "Comida rápida", emoji: "🍔" },
  { keys: ["desserts"], label: "Postres / Cafetería", emoji: "🍰" },
  { keys: ["cheap"], label: "Barato y rico", emoji: "💸" },
  { keys: ["international"], label: "Internacional", emoji: "🌍" },
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
