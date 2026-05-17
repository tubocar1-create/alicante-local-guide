import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, MapPin, Phone, Star, X } from "lucide-react";
import { getCategory } from "@/lib/health-categories";
import {
  listHealthProviders,
  type HealthProviderDTO,
} from "@/lib/health.functions";

export const Route = createFileRoute("/salud_/$categoria")({
  beforeLoad: ({ params }) => {
    if (!getCategory(params.categoria)) throw notFound();
  },
  head: ({ params }) => {
    const c = getCategory(params.categoria);
    return {
      meta: [
        {
          title: c
            ? `${c.label} en Alicante · ${c.description}`
            : "Salud · Alicante",
        },
        {
          name: "description",
          content: c
            ? `${c.label} en Alicante. ${c.description}. Dirección, teléfono, web, valoraciones y cómo llegar.`
            : "Servicios de salud en Alicante.",
        },
      ],
    };
  },
  component: CategoryDashboard,
});

function CategoryDashboard() {
  const { categoria } = Route.useParams();
  const cat = getCategory(categoria)!;
  const list = useServerFn(listHealthProviders);
  const { data, isLoading } = useQuery({
    queryKey: ["health-providers", categoria],
    queryFn: () => list({ data: { category: categoria } }),
  });

  const items: HealthProviderDTO[] = data ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{
        background: `linear-gradient(160deg, ${cat.gradFrom} 0%, ${cat.gradVia} 45%, ${cat.gradTo} 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: cat.accent }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/salud"
            className="text-[11px] uppercase tracking-[0.25em] text-white/70 transition hover:text-white"
          >
            ← Volver a Salud
          </Link>
          <Link
            to="/salud"
            aria-label="Cerrar"
            className="rounded-full border border-white/20 p-1.5 text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        <div className="mb-5 flex items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl shadow-lg"
            style={{ background: cat.bg, color: cat.fg }}
          >
            <span aria-hidden>{cat.emoji}</span>
          </div>
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.3em]"
              style={{ color: cat.accent }}
            >
              Salud · {cat.group === "publico" ? "Público" : "Privado"}
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
              {cat.label}
            </h1>
            <p className="mt-1 text-xs text-white/70 md:text-sm">
              {isLoading
                ? "Cargando…"
                : `${items.length} ${items.length === 1 ? "centro" : "centros"} · ${cat.description}`}
            </p>
          </div>
        </div>

        {items.length === 0 && !isLoading && (
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-6 text-center text-sm text-white/70 backdrop-blur-xl">
            Aún no hay datos para esta categoría.
            <br />
            <Link
              to="/admin/salud"
              className="mt-2 inline-block text-[11px] uppercase tracking-widest underline"
              style={{ color: cat.accent }}
            >
              Poblar desde admin
            </Link>
          </div>
        )}

        <ul className="space-y-2">
          {items.map((p) => {
            const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
              `${p.name} ${p.address ?? ""}`,
            )}&travelmode=driving`;
            return (
              <li
                key={p.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl transition hover:bg-white/[0.07]"
              >
                <Link
                  to="/salud/$categoria/$id"
                  params={{ categoria, id: p.id }}
                  className="block"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span aria-hidden className="shrink-0 text-lg">
                        {cat.emoji}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white underline-offset-2 hover:underline">
                        {p.name}
                      </span>
                    </div>
                    {p.rating != null && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-1.5 py-0.5 font-mono text-[10px] text-amber-200">
                        <Star className="h-2.5 w-2.5 fill-amber-300" />
                        {p.rating.toFixed(1)}
                        {p.user_ratings_total != null && (
                          <span className="opacity-70">
                            ({p.user_ratings_total})
                          </span>
                        )}
                      </span>
                    )}
                  </div>

                  {p.address && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] text-white/70">
                      <MapPin
                        className="mt-0.5 h-3 w-3 shrink-0"
                        style={{ color: cat.accent }}
                      />
                      <span className="line-clamp-2">{p.address}</span>
                    </p>
                  )}
                </Link>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <a
                    href={dirHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Cómo llegar a ${p.name}`}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-black shadow-sm transition active:scale-95"
                    style={{ background: cat.accent }}
                  >
                    <Car className="h-2.5 w-2.5" />
                    Ir
                  </a>
                  {p.phone && (
                    <a
                      href={`tel:${p.phone.replace(/\s/g, "")}`}
                      aria-label={`Llamar a ${p.name}`}
                      className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-950 shadow-sm transition active:scale-95"
                    >
                      <Phone className="h-2.5 w-2.5" />
                      {p.phone}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
