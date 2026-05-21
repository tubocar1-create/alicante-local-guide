import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MapPin, Phone, Star, Clock, Globe } from "lucide-react";
import { getShopBusiness, type ShopBusinessDetail } from "@/lib/comprar.functions";

export const Route = createFileRoute("/comprar/tienda/$id")({
  loader: ({ params }) => getShopBusiness({ data: { id: params.id } }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.name} — ${loaderData.zone?.name ?? "Alicante"}`
          : "Tienda",
      },
      {
        name: "description",
        content: loaderData?.address ?? "Ficha de comercio en Alicante",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">No se pudo cargar la tienda: {error.message}</p>
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
  notFoundComponent: () => <div className="p-6 text-sm">Tienda no encontrada.</div>,
  component: TiendaDetail,
});

function priceLabel(level: number | null) {
  if (level == null) return null;
  return "€".repeat(Math.max(1, Math.min(4, level)));
}

function TiendaDetail() {
  const biz = Route.useLoaderData() as ShopBusinessDetail | null;
  if (!biz) {
    return <div className="p-6 text-sm">Tienda no encontrada.</div>;
  }

  const heroSrc = biz.photo_ref ? `/api/public/shop-photo/${biz.photo_ref}?w=1200` : null;
  const gallery = biz.photos_refs.slice(1, 5);
  const mapsUrl = biz.google_place_id
    ? `https://www.google.com/maps/place/?q=place_id:${biz.google_place_id}`
    : biz.lat && biz.lng
      ? `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`
      : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/comprar" className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="truncate text-base font-semibold">{biz.name}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-10 pt-4">
        {heroSrc ? (
          <div className="relative overflow-hidden rounded-2xl border bg-muted">
            <img
              src={heroSrc}
              alt={biz.name}
              className="h-56 w-full object-cover sm:h-72"
              loading="eager"
            />
            {biz.open_now != null && (
              <span
                className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium shadow ${
                  biz.open_now
                    ? "bg-emerald-500/95 text-white"
                    : "bg-zinc-800/90 text-white"
                }`}
              >
                {biz.open_now ? "Abierto ahora" : "Cerrado"}
              </span>
            )}
          </div>
        ) : (
          <div className="flex h-40 items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground">
            Sin foto disponible
          </div>
        )}

        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {biz.zone && <span className="font-medium text-foreground">{biz.zone.name}</span>}
            {biz.rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {biz.rating.toFixed(1)}
                {biz.user_ratings_total != null && (
                  <span className="text-muted-foreground">({biz.user_ratings_total})</span>
                )}
              </span>
            )}
            {priceLabel(biz.price_level) && <span>{priceLabel(biz.price_level)}</span>}
          </div>
          <h2 className="text-xl font-semibold">{biz.name}</h2>
          {biz.address && (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{biz.address}</span>
            </p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2">
          {biz.phone && (
            <a
              href={`tel:${biz.phone.replace(/\s+/g, "")}`}
              className="flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-medium shadow-sm hover:border-primary/50"
            >
              <Phone className="h-4 w-4" /> Llamar
            </a>
          )}
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-medium shadow-sm hover:border-primary/50"
            >
              <MapPin className="h-4 w-4" /> Cómo llegar
            </a>
          )}
          {biz.website && (
            <a
              href={biz.website}
              target="_blank"
              rel="noreferrer"
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm font-medium shadow-sm hover:border-primary/50"
            >
              <Globe className="h-4 w-4" /> Web oficial
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}
        </section>

        {biz.weekday_descriptions.length > 0 && (
          <section className="rounded-2xl border bg-card p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Clock className="h-4 w-4" /> Horario
            </h3>
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {biz.weekday_descriptions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </section>
        )}

        {gallery.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Fotos</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {gallery.map((p) => (
                <img
                  key={p}
                  src={`/api/public/shop-photo/${p}?w=600`}
                  alt={biz.name}
                  loading="lazy"
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </section>
        )}

        <p className="pt-4 text-center text-[11px] text-muted-foreground">
          Datos públicos vía Google · Ficha en evolución
        </p>
      </main>
    </div>
  );
}
