import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getSubsectorPage,
  getRandomShopsWithPhotos,
  type RandomShop,
} from "@/lib/comprar.functions";

function shopPhotoUrl(ref: string, w: number) {
  return /^https?:\/\//i.test(ref) ? ref : `/api/public/shop-photo/${ref}?w=${w}`;
}

export const Route = createFileRoute("/comprar_/$subsector")({
  loader: ({ params }) => getSubsectorPage({ data: { slug: params.subsector } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} — Comprar en Alicante` : "Categoría de compras — Vamos Alicante" },
      {
        name: "description",
        content: loaderData
          ? `Descubre las mejores tiendas y categorías de ${loaderData.name.toLowerCase()} en Alicante. Guía local con direcciones, horarios y recomendaciones.`
          : "Explora categorías de compras en Alicante: tiendas locales, comercios y marcas con guía, mapa y recomendaciones de Vamos Alicante.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">No se pudo cargar la categoría: {error.message}</p>
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
  notFoundComponent: () => <div className="p-6 text-sm">Categoría no encontrada.</div>,
  component: SubsectorPage,
});

function SubsectorPage() {
  const data = Route.useLoaderData();
  const { subsector } = Route.useParams();
  const navigate = useNavigate();
  const fetchRandom = useServerFn(getRandomShopsWithPhotos);
  const [populares, setPopulares] = useState<RandomShop[] | null>(null);

  useEffect(() => {
    let cancel = false;
    fetchRandom({ data: { subsectorSlug: subsector } })
      .then((items) => {
        if (!cancel) setPopulares(items);
      })
      .catch(() => {
        if (!cancel) setPopulares([]);
      });
    return () => {
      cancel = true;
    };
  }, [fetchRandom, subsector]);

  if (!data) return <div className="p-6 text-sm">Categoría no encontrada.</div>;

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/comprar" className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-base font-semibold">
            {data.emoji} {data.name}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-4">
        <nav className="text-sm text-muted-foreground">
          <Link to="/comprar" className="hover:underline">
            {data.sector?.short_label || data.sector?.name || "Comprar"}
          </Link>
          {" / "}
          <span className="text-foreground">{data.name}</span>
        </nav>

        {/* Carrusel de tiendas destacadas del subsector */}
        {populares === null ? (
          <div className="-mx-4 flex h-56 gap-2 overflow-x-auto px-4 no-scrollbar">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] h-full shrink-0 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        ) : populares.length > 0 ? (
          <section>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
              Tiendas destacadas
            </h2>
            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 no-scrollbar">
              {populares.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    navigate({ to: "/comprar/tienda/$id", params: { id: r.id } })
                  }
                  className="relative w-[85vw] h-[85vw] max-w-[420px] max-h-[420px] shrink-0 snap-center overflow-hidden rounded-2xl border-2 border-border bg-black/30 text-left transition hover:shadow-md active:scale-[0.98]"
                >
                  <img
                    src={shopPhotoUrl(r.photo_ref, 800)}
                    alt={r.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 text-white">
                    <div className="line-clamp-2 text-sm font-semibold leading-tight">
                      {r.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <h2 className="text-sm font-semibold text-muted-foreground">
          ¿Qué tipo de {data.name.toLowerCase()} buscas?
        </h2>

        {data.subsubsectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin subcategorías todavía.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.subsubsectors.map((sx: { id: string; slug: string; name: string; emoji: string | null; business_count?: number }) => {
              const unavailable = (sx.business_count ?? 0) === 0;
              return (
                <Link
                  key={sx.id}
                  to="/comprar/$subsector/$subsubsector"
                  params={{ subsector: data.slug, subsubsector: sx.slug }}
                  className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow ${unavailable ? "opacity-70" : ""}`}
                >
                  <span className="text-3xl">{sx.emoji ?? "•"}</span>
                  <span className="text-xs font-medium leading-tight">{sx.name}</span>
                  {unavailable && (
                    <span className="absolute right-1 top-1 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      No disp.
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
