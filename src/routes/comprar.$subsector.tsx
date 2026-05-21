import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { getSubsectorPage } from "@/lib/comprar.functions";

export const Route = createFileRoute("/comprar/$subsector")({
  loader: ({ params }) => getSubsectorPage({ data: { slug: params.subsector } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.name} — Comprar en Alicante` : "Comprar" },
      {
        name: "description",
        content: loaderData
          ? `Categorías de ${loaderData.name.toLowerCase()} en Alicante.`
          : "Comprar en Alicante",
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

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <nav className="text-sm text-muted-foreground">
          <Link to="/comprar" className="hover:underline">
            {data.sector?.short_label || data.sector?.name || "Comprar"}
          </Link>
          {" / "}
          <span className="text-foreground">{data.name}</span>
        </nav>

        <h2 className="text-sm font-semibold text-muted-foreground">
          ¿Qué tipo de {data.name.toLowerCase()} buscas?
        </h2>

        {data.subsubsectors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin subcategorías todavía.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {data.subsubsectors.map((sx: { id: string; slug: string; name: string; emoji: string | null }) => (
              <Link
                key={sx.id}
                to="/comprar/$subsector/$subsubsector"
                params={{ subsector: data.slug, subsubsector: sx.slug }}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow"
              >
                <span className="text-3xl">{sx.emoji ?? "•"}</span>
                <span className="text-xs font-medium leading-tight">{sx.name}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
