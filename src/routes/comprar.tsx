import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Sparkles, Loader2, ShoppingBag, Star, MapPin } from "lucide-react";
import {
  classifyShopIntent,
  getShopTree,
  listShopBusinesses,
  type ShopBusinessSummary,
  type ShopTree,
} from "@/lib/comprar.functions";


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

type Sector = ShopTree["sectors"][number];
type Subsector = Sector["subsectors"][number];
type Subsubsector = Subsector["subsubsectors"][number];
type Intent = Subsubsector["intents"][number];

type Classification = Awaited<ReturnType<typeof classifyShopIntent>>;

function ComprarPage() {
  const tree = Route.useLoaderData() as ShopTree;
  const sector: Sector | undefined = tree.sectors[0]; // "Comercio y Servicios"
  const classify = useServerFn(classifyShopIntent);


  const [subsector, setSubsector] = useState<Subsector | null>(null);
  const [subsubsector, setSubsubsector] = useState<Subsubsector | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<Classification | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSubsector(null);
    setSubsubsector(null);
    setSelectedIntent(null);
    setAiResult(null);
  }

  async function ask() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setError(null);
    setAiResult(null);
    try {
      const r = await classify({ data: { query: q } });
      setAiResult(r);
      // Auto-navigate to matched subsubsector
      if (r.subsector && r.subsubsector) {
        const sub = sector?.subsectors.find((x) => x.id === r.subsector!.id) ?? null;
        const sss = sub?.subsubsectors.find((x) => x.id === r.subsubsector!.id) ?? null;
        setSubsector(sub);
        setSubsubsector(sss);
        if (r.intent && sss) {
          setSelectedIntent(sss.intents.find((i) => i.id === r.intent!.id) ?? null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }

  if (!sector) {
    return <div className="p-6">No hay sectores configurados.</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
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

      <main className="mx-auto max-w-3xl px-4 py-5 space-y-6">
        {/* Smart search */}
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
                <p className="text-xs italic text-muted-foreground">
                  {aiResult.clarifying_question}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {aiResult.sector?.name} · {aiResult.subsector?.name} ·{" "}
                {aiResult.subsubsector?.name}
                {typeof aiResult.confidence === "number" && (
                  <> · confianza {(aiResult.confidence * 100).toFixed(0)}%</>
                )}
              </p>
            </div>
          )}
        </section>

        {/* Breadcrumb */}
        <nav className="text-sm text-muted-foreground">
          <button onClick={reset} className="hover:underline">
            {sector.emoji} {sector.short_label || sector.name}
          </button>
          {subsector && (
            <>
              {" / "}
              <button
                onClick={() => {
                  setSubsubsector(null);
                  setSelectedIntent(null);
                }}
                className="hover:underline"
              >
                {subsector.emoji} {subsector.name}
              </button>
            </>
          )}
          {subsubsector && (
            <>
              {" / "}
              <span className="text-foreground">
                {subsubsector.emoji} {subsubsector.name}
              </span>
            </>
          )}
        </nav>

        {/* Manual navigation */}
        {!subsector && (
          <Grid>
            {sector.subsectors.map((ss) => (
              <Tile
                key={ss.id}
                emoji={ss.emoji}
                label={ss.name}
                onClick={() => setSubsector(ss)}
              />
            ))}
          </Grid>
        )}

        {subsector && !subsubsector && (
          <Grid>
            {subsector.subsubsectors.map((sx) => (
              <Tile
                key={sx.id}
                emoji={sx.emoji}
                label={sx.name}
                onClick={() => setSubsubsector(sx)}
              />
            ))}
          </Grid>
        )}

        {subsubsector && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              ¿Qué necesitas exactamente?
            </h2>
            <ul className="space-y-2">
              {subsubsector.intents.map((it) => (
                <li key={it.id}>
                  <button
                    onClick={() => setSelectedIntent(it)}
                    className={`w-full rounded-xl border bg-card p-3 text-left text-sm shadow-sm transition hover:border-primary/50 ${
                      selectedIntent?.id === it.id ? "border-primary ring-2 ring-primary/30" : ""
                    }`}
                  >
                    <div className="font-medium">{it.label}</div>
                    {it.keywords.length > 0 && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {it.keywords.slice(0, 4).join(" · ")}
                      </div>
                    )}
                  </button>
                </li>
              ))}
              {subsubsector.intents.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Sin intenciones aún para esta categoría.
                </li>
              )}
            </ul>

            {selectedIntent?.verbal_recommendation && (
              <div className="rounded-2xl border bg-primary/5 p-4 text-sm leading-relaxed">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Recomendación
                </div>
                {selectedIntent.verbal_recommendation}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>;
}

function Tile({
  emoji,
  label,
  onClick,
}: {
  emoji: string | null;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow"
    >
      <span className="text-3xl">{emoji ?? "•"}</span>
      <span className="text-xs font-medium leading-tight">{label}</span>
    </button>
  );
}

