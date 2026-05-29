import { createFileRoute, Link, Outlet, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getCategory } from "@/lib/health-categories";
import {
  listHealthProviders,
  type HealthProviderDTO,
} from "@/lib/health.functions";
import { computeOpenStatus } from "@/lib/opening-status";
import {
  useUserLocation,
  distanceKm,
  type Coords,
} from "@/hooks/useUserLocation";

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
            ? `${c.label} en Alicante. ${c.description}. Dirección, teléfono, valoraciones y cómo llegar.`
            : "Servicios de salud en Alicante.",
        },
      ],
    };
  },
  component: CategoryDashboard,
});

const ALICANTE: Coords = { lat: 38.3452, lng: -0.481 };

function fmtDist(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "—";
  const m = Math.round(km * 1000);
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

function CategoryDashboard() {
  const { categoria } = Route.useParams();
  const cat = getCategory(categoria)!;
  const list = useServerFn(listHealthProviders);
  const { data, isLoading } = useQuery({
    queryKey: ["health-providers", categoria],
    queryFn: () => list({ data: { category: categoria } }),
  });
  const { state: locState, request: requestLocation } = useUserLocation({ watch: true });

  const origin: Coords =
    locState.status === "ready" ? locState.coords : ALICANTE;
  const hasGeo = locState.status === "ready";

  const items: HealthProviderDTO[] = data ?? [];
  const ranked = useMemo(() => {
    return items
      .map((p) => {
        const d =
          p.lat != null && p.lng != null
            ? distanceKm(origin, { lat: p.lat, lng: p.lng })
            : null;
        return { p, d };
      })
      .sort((a, b) => {
        if (a.d != null && b.d != null) return a.d - b.d;
        if (a.d != null) return -1;
        if (b.d != null) return 1;
        return (b.p.rating ?? 0) - (a.p.rating ?? 0);
      });
  }, [items, origin]);

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background: `linear-gradient(180deg, ${cat.gradFrom} 0%, ${cat.gradVia} 50%, ${cat.gradTo} 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: cat.accent }}
        />
        <div
          className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full opacity-10 blur-3xl"
          style={{ background: cat.accent }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/salud"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver a Salud
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: cat.accent }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: cat.accent }}
              />
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.25em]"
              style={{ color: cat.accent }}
            >
              Live · ALC
            </span>
            <Link
              to="/salud"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-5">
          <p
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{ color: cat.accent }}
          >
            Dashboard sanitario
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            {cat.label}{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${cat.accent}, #ffffff)`,
              }}
            >
              en Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            {cat.description} ·{" "}
            {hasGeo
              ? "ordenados por cercanía a tu ubicación."
              : "ordenados por cercanía al centro de Alicante."}{" "}
            {!hasGeo && (
              <button
                type="button"
                onClick={requestLocation}
                className="underline underline-offset-2"
              >
                Usar mi ubicación
              </button>
            )}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-white">
              {isLoading
                ? "Cargando…"
                : `${ranked.length} ${ranked.length === 1 ? "centro" : "centros"}`}
            </p>
            <p
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{ color: `${cat.accent}cc` }}
            >
              local · estado · dirección · dist.
            </p>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] text-white">
            <colgroup>
              <col />
              <col className="w-[44px]" />
              <col className="w-[48px]" />
            </colgroup>
            <thead>
              <tr
                className="text-[9px] uppercase tracking-[0.12em]"
                style={{ color: `${cat.accent}99` }}
              >
                <th className="px-1 py-1 font-medium">Local · Dirección</th>
                <th className="px-1 py-1 text-center font-medium">Est.</th>
                <th className="px-1 py-1 text-right font-medium">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ p, d }) => {
                const status = computeOpenStatus(p.opening_hours);
                const statusStyle =
                  status === "open"
                    ? "bg-emerald-400/15 text-emerald-300"
                    : status === "closed"
                    ? "bg-rose-400/15 text-rose-300"
                    : "bg-white/5 text-white/40";
                const statusLabel =
                  status === "open"
                    ? "Abto"
                    : status === "closed"
                    ? "Cerr"
                    : "—";
                return (
                  <tr key={p.id} className="bg-white/[0.03]">
                    <td className="rounded-l-md px-1.5 py-1.5 align-middle">
                      <Link
                        to="/salud/$categoria/$id"
                        params={{ categoria, id: p.id }}
                        className="flex items-start gap-1.5 hover:opacity-80"
                      >
                        <span aria-hidden className="mt-0.5 text-[13px] leading-none">
                          {cat.emoji}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[11px] font-medium text-white">
                            {p.name}
                          </span>
                          {p.address && (
                            <span className="block truncate text-[10px] text-white/55">
                              {p.address}
                            </span>
                          )}
                        </span>
                      </Link>
                    </td>
                    <td className="px-1 py-1 text-center align-middle">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusStyle}`}
                      >
                        <span
                          aria-hidden
                          className={`h-1.5 w-1.5 rounded-full ${
                            status === "open"
                              ? "bg-emerald-400"
                              : status === "closed"
                              ? "bg-rose-400"
                              : "bg-white/30"
                          }`}
                        />
                        {statusLabel}
                      </span>
                    </td>
                    <td className="rounded-r-md px-1 py-1 text-right align-middle font-mono text-[11px] font-semibold tabular-nums text-white">
                      {fmtDist(d)}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && ranked.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-2 py-6 text-center text-xs text-white/50"
                  >
                    Aún no hay datos para esta categoría.
                    <br />
                    <Link
                      to="/admin/salud"
                      className="mt-2 inline-block text-[11px] uppercase tracking-widest underline"
                      style={{ color: cat.accent }}
                    >
                      Poblar desde admin
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
