import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Star, MapPin } from "lucide-react";
import {
  getSubsubsectorPage,
  listShopBusinesses,
  type ShopBusinessSummary,
} from "@/lib/comprar.functions";

export const Route = createFileRoute("/comprar_/$subsector_/$subsubsector")({
  loader: ({ params }) =>
    getSubsubsectorPage({
      data: { subsector_slug: params.subsector, slug: params.subsubsector },
    }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} en Alicante — Comprar` : "Categoría de compras — Vamos Alicante" },
      {
        name: "description",
        content: loaderData
          ? `Tiendas de ${loaderData.name.toLowerCase()} en Alicante: direcciones, horarios, reseñas y enlaces para llegar fácil. Guía local de Vamos Alicante.`
          : "Listado de tiendas y comercios por categoría en Alicante con mapa, horarios y reseñas. Guía local de Vamos Alicante.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">No se pudo cargar: {error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="rounded-xl border px-3 py-2 text-sm"
        >
          Reintentar
        </button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6 text-sm">Subcategoría no encontrada.</div>,
  component: SubsubsectorPage,
});

type Intent = {
  id: string;
  label: string;
  keywords: string[];
  verbal_recommendation: string | null;
};

function SubsubsectorPage() {
  const data = Route.useLoaderData();
  const listBiz = useServerFn(listShopBusinesses);
  const [businesses, setBusinesses] = useState<ShopBusinessSummary[] | null>(null);
  const [bizLoading, setBizLoading] = useState(false);
  const [selectedIntent, setSelectedIntent] = useState<Intent | null>(null);

  const slug = data?.slug;
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setBizLoading(true);
    listBiz({ data: { subsubsector_slug: slug, limit: 40 } })
      .then((rows) => !cancelled && setBusinesses(rows))
      .catch(() => !cancelled && setBusinesses([]))
      .finally(() => !cancelled && setBizLoading(false));
    return () => {
      cancelled = true;
    };
  }, [slug, listBiz]);

  if (!data) return <div className="p-6 text-sm">Subcategoría no encontrada.</div>;

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            to="/comprar/$subsector"
            params={{ subsector: data.subsector.slug }}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-base font-semibold">
            {data.emoji} {data.name}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <nav className="text-sm text-muted-foreground">
          <Link to="/comprar" className="hover:underline">
            {data.sector?.short_label || data.sector?.name || "Comprar"}
          </Link>
          {" / "}
          <Link
            to="/comprar/$subsector"
            params={{ subsector: data.subsector.slug }}
            className="hover:underline"
          >
            {data.subsector.name}
          </Link>
          {" / "}
          <span className="text-foreground">{data.name}</span>
        </nav>

        {data.intents.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              ¿Qué necesitas exactamente?
            </h2>
            <ul className="space-y-2">
              {data.intents.map((it: Intent) => (
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

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tiendas</h3>
            {bizLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>

          {!bizLoading && businesses && businesses.length === 0 && (
            <p className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
              Todavía no tenemos comercios cargados para esta categoría. Lo iremos ampliando.
            </p>
          )}

          {businesses && businesses.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {businesses.map((b) => (
                <li key={b.id}>
                  <Link
                    to="/comprar/tienda/$id"
                    params={{ id: b.id }}
                    className="group block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow"
                  >
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                      {b.photo_ref ? (
                        <img
                          src={`/api/public/shop-photo/${b.photo_ref}?w=600`}
                          alt={b.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                          Sin foto
                        </div>
                      )}
                      {b.open_now != null && (
                        <span
                          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium shadow ${
                            b.open_now ? "bg-emerald-500/95 text-white" : "bg-zinc-800/90 text-white"
                          }`}
                        >
                          {b.open_now ? "Abierto" : "Cerrado"}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{b.name}</span>
                        {b.rating != null && (
                          <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {b.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      {b.zone && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {b.zone.name}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
