import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/selectordecomidas")({
  head: () => ({
    meta: [
      { title: "Selector de comidas — Alicante Friend" },
      {
        name: "description",
        content:
          "Elige qué te apetece comer en Alicante: cocina típica, arroces, italiano, japonés, vegano, brunch, postres, comida rápida, barato o internacional.",
      },
      { property: "og:title", content: "Selector de comidas — Alicante Friend" },
      {
        property: "og:description",
        content: "Elige qué te apetece comer hoy en Alicante.",
      },
    ],
  }),
  component: SelectorDeComidasPage,
});

type Item = { label: string; prompt?: string; submenu?: Item[] };

const CATEGORIES: Item[] = [
  { label: "🥘 Cocina típica", prompt: "Recomiéndame un sitio de cocina típica alicantina tradicional abierto ahora" },
  { label: "🍤 Arroces y pescado", prompt: "Quiero un buen arroz, paella o pescado fresco, ¿dónde voy ahora?" },
  { label: "🍕 Italiano", prompt: "Apetece italiano (pizza, pasta), ¿dónde puedo ir ahora?" },
  {
    label: "🍔 Comida rápida",
    submenu: [
      { label: "🍔 Hamburguesas", prompt: "Una buena hamburguesería abierta ahora (McDonald's, Burger King, TGB, Goiko, Five Guys…)" },
      { label: "🍕 Pizzas", prompt: "Una pizzería abierta ahora (Telepizza, Domino's…)" },
      { label: "🥖 Montaditos", prompt: "Un sitio de montaditos abierto ahora (100 Montaditos, Lizarrán…)" },
      { label: "🌯 Kebaps", prompt: "Un buen kebap abierto ahora" },
      { label: "🍗 Pollo frito", prompt: "Un sitio de pollo frito o pollos asados abierto ahora (KFC, Popeyes…)" },
      { label: "🌮 Comida mexicana", prompt: "Un mexicano abierto ahora (Taco Bell, tacos, burritos…)" },
    ],
  },
  { label: "🍣 Japonés / Asiático", prompt: "Un japonés o asiático rico abierto ahora" },
  { label: "🌱 Vegano / Saludable", prompt: "Un sitio vegano o saludable abierto ahora" },
  { label: "🥐 Desayuno / Brunch", prompt: "Necesito un buen desayuno o brunch en Alicante abierto ahora" },
  { label: "🍰 Postres / Cafetería", prompt: "Una cafetería con postres ricos abierta ahora" },
  { label: "💸 Barato y rico", prompt: "Algo barato y rico para comer ya, abierto ahora" },
  { label: "🌍 Internacional", prompt: "Quiero comida internacional (hindú, libanés, peruano, mexicano, latino, árabe…), ¿dónde voy ahora?" },
];

function SelectorDeComidasPage() {
  const navigate = useNavigate();

  const goWithPrompt = (prompt: string) => {
    try {
      window.sessionStorage.setItem("afp:pendingFoodPrompt", prompt);
    } catch {}
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-6">
        <header className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold leading-tight">🍽️ Comer</h1>
            <p className="text-sm text-muted-foreground mt-1">
              ¿Qué te apetece ahora mismo en Alicante?
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="text-sm text-primary underline underline-offset-2"
          >
            ← Volver
          </button>
        </header>

        <Grid items={CATEGORIES} onPick={goWithPrompt} />
      </div>
    </div>
  );
}

function Grid({ items, onPick }: { items: Item[]; onPick: (prompt: string) => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <CategoryButton key={it.label} item={it} onPick={onPick} />
        ))}
      </div>
    </div>
  );
}

function CategoryButton({ item, onPick }: { item: Item; onPick: (prompt: string) => void }) {
  const hasSubmenu = !!item.submenu?.length;
  const handle = () => {
    if (item.prompt) onPick(item.prompt);
  };

  if (!hasSubmenu) {
    return (
      <button
        type="button"
        onClick={handle}
        className="flex items-center gap-2 px-3 py-3 rounded-2xl border bg-background hover:bg-accent/40 active:scale-[0.98] text-left"
      >
        <span className="text-sm font-medium leading-tight">{item.label}</span>
      </button>
    );
  }

  return (
    <details className="col-span-2 rounded-2xl border bg-background overflow-hidden">
      <summary className="flex items-center justify-between px-3 py-3 cursor-pointer list-none">
        <span className="text-sm font-medium leading-tight">{item.label}</span>
        <span className="text-xs text-muted-foreground">Ver opciones ▾</span>
      </summary>
      <div className="grid grid-cols-2 gap-2 p-2 border-t bg-muted/30">
        {item.submenu!.map((sub) => (
          <button
            key={sub.label}
            type="button"
            onClick={() => sub.prompt && onPick(sub.prompt)}
            className="flex items-center gap-2 px-3 py-3 rounded-xl border bg-background hover:bg-accent/40 active:scale-[0.98] text-left"
          >
            <span className="text-sm font-medium leading-tight">{sub.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}
