import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag } from "lucide-react";
import {
  getShopTree,
  getRandomShopsWithPhotos,
  type ShopTree,
  type RandomShop,
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
      { property: "og:title", content: "Comprar en Alicante — Guía de compras por intención" },
      { property: "og:description", content: "Descubre dónde comprar en Alicante por categoría: moda, tecnología, hogar, mascotas y más. Guía urbana contextual." },
      { property: "og:url", content: "https://vamosalicante.com/comprar" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/comprar" }],
  }),
  loader: () => getShopTree(),
  component: ComprarPage,
});

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
    s.subsectors.filter((ss) => !HIDDEN_SUBSECTORS.has(ss.slug)),
  );

  const navigate = useNavigate();
  const fetchRandom = useServerFn(getRandomShopsWithPhotos);
  const [populares, setPopulares] = useState<RandomShop[]>([]);

  useEffect(() => {
    let cancel = false;
    fetchRandom()
      .then((items) => {
        if (!cancel) setPopulares(items);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [fetchRandom]);

  if (subsectors.length === 0) return <div className="p-6">No hay sectores configurados.</div>;

  return (
    <div className="h-dvh bg-[#0c2340] text-white flex flex-col overflow-hidden">
      <div className="mx-auto w-full max-w-2xl px-3 pt-2 pb-2 flex-1 flex flex-col min-h-0">
        <header className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShoppingBag className="h-4 w-4 shrink-0" />
            <h1 className="text-sm sm:text-base font-semibold leading-tight truncate">
              Comprar en Alicante
            </h1>
          </div>
          <Link
            to="/"
            className="text-xs text-white/80 underline underline-offset-2 shrink-0"
          >
            ← Volver
          </Link>
        </header>

        <section className="mb-3 shrink-0">
          {populares.length === 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="shrink-0 w-36 h-36 bg-white/10 animate-pulse rounded-2xl"
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 no-scrollbar snap-x">
              {populares.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() =>
                    navigate({ to: "/comprar/tienda/$id", params: { id: r.id } })
                  }
                  className="relative shrink-0 w-36 h-36 snap-start text-left bg-black/30 overflow-hidden hover:shadow-md active:scale-[0.98] transition border-2 border-white/30 rounded-2xl"
                >
                  <img
                    src={`/api/public/shop-photo/${r.photo_ref}?w=600`}
                    alt={r.name}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  {r.subsector_name && (
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-2 py-0.5 bg-black/70 text-white text-[10px] font-semibold shadow-sm rounded-full">
                      {r.subsector_emoji && (
                        <span className="text-sm leading-none">{r.subsector_emoji}</span>
                      )}
                      <span className="line-clamp-1">{r.subsector_name}</span>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-6 text-white">
                    <div className="text-sm font-semibold leading-tight line-clamp-2">
                      {r.name}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="flex-1 min-h-0 grid grid-cols-3 gap-1.5 auto-rows-fr">
          {subsectors.map((ss) => (
            <Link
              key={ss.id}
              to="/comprar/sector/$sector"
              params={{ sector: ss.slug }}
              aria-label={`Abrir ${ss.name}`}
              className="relative flex flex-col items-center justify-center rounded-2xl border-2 border-white/30 bg-white/5 hover:bg-white/10 active:scale-[0.97] text-center shadow-sm w-full h-full overflow-hidden p-1"
            >
              <span className="leading-none" style={{ lineHeight: 1 }}>
                <span style={{ fontSize: "clamp(1.4rem, 6.5vw, 2.5rem)" }}>
                  {ss.emoji ?? "•"}
                </span>
              </span>
              <span className="absolute bottom-1 left-1 right-1 text-[9px] font-semibold uppercase tracking-tight leading-[1.05] text-white/90 line-clamp-2">
                {ss.name}
              </span>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
