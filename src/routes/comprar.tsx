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
      { property: "og:title", content: "Comprar en Alicante — Guía de compras por intención" },
      { property: "og:description", content: "Descubre dónde comprar en Alicante por categoría: moda, tecnología, hogar, mascotas y más. Guía urbana contextual." },
      { property: "og:url", content: "https://vamosalicante.com/comprar" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/comprar" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Dónde comprar en Alicante",
          description: "Listado de categorías y subsectores de tiendas en Alicante: moda, tecnología, hogar, mascotas y más.",
          url: "https://vamosalicante.com/comprar",
        }),
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
    <div className="flex h-full lg:h-auto lg:min-h-[80vh] flex-col overflow-hidden lg:overflow-visible bg-black lg:rounded-3xl text-white">
      <header className="border-b border-white/10 bg-black">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2">
          <Link to="/" className="rounded-full p-1.5 hover:bg-white/10" aria-label="Volver">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-1.5">
            <ShoppingBag className="h-4 w-4" />
            <h1 className="text-sm font-semibold">Comprar en Alicante</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col overflow-hidden px-2 py-2">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 lg:gap-3 xl:grid-cols-8">
          {subsectors.map((ss) => (
            <Link
              key={ss.id}
              to="/comprar/sector/$sector"
              params={{ sector: ss.slug }}
              aria-label={`Abrir dashboard de ${ss.name}`}
              className="flex min-h-0 flex-col items-center justify-center gap-1 rounded-xl border-2 border-white/30 bg-white/5 p-1 text-center shadow-sm transition hover:border-primary/60"
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


