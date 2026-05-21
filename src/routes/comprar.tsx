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
  const subsectors = tree.sectors.flatMap((s) =>
    s.subsectors
      .filter((ss) => !HIDDEN_SUBSECTORS.has(ss.slug))
      .map((ss) => ({ ...ss, sectorName: s.short_label || s.name })),
  );
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

  if (subsectors.length === 0) return <div className="p-6">No hay sectores configurados.</div>;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black text-white">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <Link to="/" className="rounded-full p-1.5 hover:bg-muted" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4" />
            <h1 className="text-sm font-semibold">Comprar en Alicante</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-2 overflow-hidden px-2 py-2">
        <section className="rounded-xl border bg-card p-2 shadow-sm">
          <div className="flex gap-1.5">
            <Sparkles className="mt-2 h-3.5 w-3.5 shrink-0 text-primary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="¿Qué buscas? Ej. zapatos cómodos"
              className="flex-1 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={ask}
              disabled={loading || !query.trim()}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ir"}
            </button>
          </div>
          {error && <p className="mt-1 text-[10px] text-destructive">{error}</p>}
          {aiResult && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{aiResult.verbal_response}</p>
          )}
        </section>

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5 sm:grid-cols-4">
          {subsectors.map((ss) => (
            <Link
              key={ss.id}
              to="/comprar/sector/$sector"
              params={{ sector: ss.slug }}
              aria-label={`Abrir dashboard de ${ss.name}`}
              className="flex min-h-0 flex-col items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 p-1 text-center shadow-sm transition hover:border-primary/60"
            >
              <span className="text-5xl leading-none">{ss.emoji ?? "•"}</span>
              <span className="text-[9px] font-semibold uppercase tracking-tight leading-[1.05] text-white/80 line-clamp-2 max-w-full">
                {ss.name}
              </span>


            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}


