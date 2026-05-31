import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, MapPin, Phone, Star, Clock, Globe } from "lucide-react";
import { getShopBusiness, type ShopBusinessDetail } from "@/lib/comprar.functions";

export const Route = createFileRoute("/comprar_/tienda/$id")({
  loader: ({ params }) => getShopBusiness({ data: { id: params.id } }),
  head: ({ params, loaderData }) => {
    const name = loaderData?.name ?? "Tienda en Alicante";
    const zone = loaderData?.zone?.name ?? "Alicante";
    const title = `${name} — ${zone}`.slice(0, 60);
    const baseDesc = loaderData
      ? `${name} en ${zone}${loaderData.address ? ` (${loaderData.address})` : ""}: horarios, fotos, valoraciones y cómo llegar. Guía de comercios de Vamos Alicante.`
      : "Ficha de comercio en Alicante: horarios, fotos, valoraciones y cómo llegar. Guía de tiendas locales en Vamos Alicante.";
    const description = baseDesc.slice(0, 160);
    const url = `https://vamosalicante.com/comprar/tienda/${params.id}`;
    const image = loaderData?.photo_ref
      ? `https://vamosalicante.com/api/public/shop-photo/${loaderData.photo_ref}?w=1200`
      : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        ...(image
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: loaderData
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Store",
                name,
                url,
                image: image ?? undefined,
                address: loaderData.address
                  ? {
                      "@type": "PostalAddress",
                      streetAddress: loaderData.address,
                      addressLocality: zone,
                      addressCountry: "ES",
                    }
                  : undefined,
                telephone: (loaderData as any).phone ?? undefined,
                geo:
                  loaderData.lat && loaderData.lng
                    ? {
                        "@type": "GeoCoordinates",
                        latitude: loaderData.lat,
                        longitude: loaderData.lng,
                      }
                    : undefined,
              }),
            },
          ]
        : undefined,
    };
  },
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

  const shopPhotoUrl = (ref: string, w: number) =>
    /^https?:\/\//i.test(ref) ? ref : `/api/public/shop-photo/${ref}?w=${w}`;
  const heroSrc = biz.photo_ref ? shopPhotoUrl(biz.photo_ref, 1200) : null;
  const gallery = biz.photos_refs.slice(1, 5);
  const mapsUrl = biz.google_place_id
    ? `https://www.google.com/maps/place/?q=place_id:${biz.google_place_id}`
    : biz.lat && biz.lng
      ? `https://www.google.com/maps/search/?api=1&query=${biz.lat},${biz.lng}`
      : null;

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-background text-foreground">
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
        ) : biz.logo_url ? (
          <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-2xl border bg-white sm:h-72">
            <img
              src={biz.logo_url}
              alt={`Logotipo ${biz.name}`}
              className="h-full w-full object-contain p-6 sm:p-8"
              loading="eager"
            />
            {biz.subsector?.name && (
              <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-2.5 py-1 text-[11px] font-medium text-background shadow">
                {biz.subsector.name}
              </span>
            )}
          </div>
        ) : (
          <div className="relative flex h-56 items-center justify-center overflow-hidden rounded-2xl border bg-gradient-to-br from-muted via-muted/60 to-background sm:h-72">
            <span className="select-none text-[7rem] leading-none opacity-80 sm:text-[9rem]" aria-hidden>
              {biz.subsector?.emoji ?? "🏬"}
            </span>
            <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-white shadow">
              Foto no disponible
            </span>
            {biz.subsector?.name && (
              <span className="absolute left-3 top-3 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-medium text-foreground shadow">
                {biz.subsector.name}
              </span>
            )}
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
            <h3 className="mb-2 flex items-center justify-between gap-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Horario
              </span>
              {biz.hours_assumed && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Estimado · pendiente confirmar
                </span>
              )}
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
                  src={shopPhotoUrl(p, 600)}
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
