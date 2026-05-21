import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Sparkles, Loader2, ShoppingBag } from "lucide-react";
import { classifyShopIntent, getShopTree, type ShopTree } from "@/lib/comprar.functions";

export const Route = createFileRoute("/comprar")({
  head: () => ({
    meta: [
      { title: "Comprar en Alicante — orientación por intención" },
      {
        name: "description",
        content:
          "Encuentra a dónde ir según lo que necesitas: moda, tecnología, hogar, mascotas y más. Guía urbana contextual de Alicante.",
      },
    ],
  }),
  loader: () => getShopTree(),
  component: ComprarPage,
});

type Classification = Awaited<ReturnType<typeof classifyShopIntent>>;

function ComprarPage() {
  const tree = Route.useLoaderData() as ShopTree;
  const HIDDEN_SUBSECTORS = new Set([
    "farmacia-salud",
    "clinicas",
    "restauracion",
    "horno-dulces",
    "alojamiento-turistico",
  ]);
  const sectors = tree.sectors
    .map((s) => ({ ...s, subsectors: s.subsectors.filter((ss) => !HIDDEN_SUBSECTORS.has(ss.slug)) }))
    .filter((s) => s.subsectors.length > 0);
  const classify = useServerFn(classifyShopIntent);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Classification | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const r = await classify({ data: { query: q } });
      setAiResult(r);
      if (r.subsector?.slug && r.subsubsector?.slug) {
        navigate({
          to: "/comprar/$subsector/$subsubsector",
          params: {
            subsector: r.subsector.slug,
            subsubsector: r.subsubsector.slug,
          },
        });
      } else if (r.subsector?.slug) {
        navigate({ to: "/comprar/$subsector", params: { subsector: r.subsector.slug } });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (sectors.length === 0) return <div className="p-6">No hay sectores configurados.</div>;

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/" className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" />
            <h1 className="text-base font-semibold">Comprar en Alicante</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-5">
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-primary" />
            ¿Qué estás buscando?
          </label>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ej. zapatos cómodos para diario"
              className="flex-1 rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={ask}
              disabled={loading || !query.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ir"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          {aiResult && (
            <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3 text-sm">
              <p className="leading-relaxed">{aiResult.verbal_response}</p>
              {aiResult.clarifying_question && (
                <p className="text-xs italic text-muted-foreground">{aiResult.clarifying_question}</p>
              )}
            </div>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {sectors.map((sector) => (
            <Link
              key={sector.id}
              to="/comprar/sector/$sector"
              params={{ sector: sector.slug }}
              aria-label={`Abrir dashboard de ${sector.short_label || sector.name}`}
              className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow"
            >
              <span className="text-3xl">{sector.emoji}</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide leading-tight text-muted-foreground">
                {sector.short_label || sector.name}
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

