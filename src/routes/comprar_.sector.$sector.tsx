import { createFileRoute, Link, useRouter, useNavigate, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  getSectorDashboard,
  type SectorDashboardData,
  type SectorDashboardItem,
} from "@/lib/comprar.functions";
import { computeOpenStatus, todayCloseLabel, type OpeningHours } from "@/lib/opening-status";
import { useUserLocation, distanceKm, type Coords } from "@/hooks/useUserLocation";

export const Route = createFileRoute("/comprar_/sector/$sector")({
  loader: async ({ params }) => {
    const data = await getSectorDashboard({ data: { sector_slug: params.sector } });
    if (!data) throw notFound();
    return data as SectorDashboardData;
  },
  head: ({ loaderData }) => {
    const ld = loaderData as SectorDashboardData | undefined;
    return {
      meta: [
        {
          title: ld ? `${ld.sector.name} en Alicante · Dashboard` : "Dashboard · Comprar",
        },
        {
          name: "description",
          content: ld
            ? `Todos los comercios del sector ${ld.sector.name} en Alicante: estado, horario y distancia.`
            : "Dashboard de comercios en Alicante.",
        },
      ],
    };
  },
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 space-y-3 text-sm">
        <p className="text-destructive">No se pudo cargar: {error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="rounded-xl border px-3 py-2"
        >
          Reintentar
        </button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6 text-sm">Sector no encontrado.</div>,
  component: SectorDashboard,
});

const ALICANTE: Coords = { lat: 38.3452, lng: -0.481 };
const ACCENT = "#f6a734"; // ámbar cálido al estilo Tradición

function shopPhotoUrl(ref: string, w: number) {
  return /^https?:\/\//i.test(ref) ? ref : `/api/public/shop-photo/${ref}?w=${w}`;
}

function fmtDist(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "—";
  const m = Math.round(km * 1000);
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

function SectorDashboard() {
  const data = Route.useLoaderData() as SectorDashboardData;
  const navigate = useNavigate();
  const load = useServerFn(getSectorDashboard);
  const { data: live } = useQuery({
    queryKey: ["sector-dashboard", data.sector.slug],
    queryFn: () => load({ data: { sector_slug: data.sector.slug } }),
    initialData: data,
    refetchOnWindowFocus: false,
  });

  const items: SectorDashboardItem[] = live?.items ?? data.items;
  const { state: locState, request: requestLocation } = useUserLocation();
  const origin: Coords = locState.status === "ready" ? locState.coords : ALICANTE;
  const hasGeo = locState.status === "ready";

  const ranked = useMemo(() => {
    const hour = new Date().getHours();
    const prioritizeOpen = hour >= 20 || hour < 2;
    return items
      .map((p) => {
        const d =
          p.lat != null && p.lng != null
            ? distanceKm(origin, { lat: p.lat, lng: p.lng })
            : null;
        const status = computeOpenStatus(p.opening_hours as OpeningHours);
        return { p, d, status };
      })
      .sort((a, b) => {
        if (prioritizeOpen) {
          const ao = a.status === "open" ? 0 : 1;
          const bo = b.status === "open" ? 0 : 1;
          if (ao !== bo) return ao - bo;
        }
        const cat = (a.p.subsubsector_name ?? "").localeCompare(b.p.subsubsector_name ?? "", "es", { sensitivity: "base" });
        if (cat !== 0) return cat;
        if (a.d != null && b.d != null) return a.d - b.d;
        if (a.d != null) return -1;
        if (b.d != null) return 1;
        return a.p.name.localeCompare(b.p.name);
      });
  }, [items, origin]);

  const carouselItems = useMemo(
    () => ranked.filter(({ p }) => p.photo_ref).slice(0, 60),
    [ranked],
  );

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #1a0f04 0%, #2a1707 45%, #160a02 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-25 blur-3xl"
          style={{ background: ACCENT }}
        />
        <div
          className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full opacity-10 blur-3xl"
          style={{ background: ACCENT }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-12 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/comprar"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver al menú
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ background: ACCENT }}
              />
              <span
                className="relative inline-flex h-2 w-2 rounded-full"
                style={{ background: ACCENT }}
              />
            </span>
            <span
              className="text-[10px] uppercase tracking-[0.25em]"
              style={{ color: ACCENT }}
            >
              Live · ALC
            </span>
            <Link
              to="/comprar"
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
            style={{ color: ACCENT }}
          >
            Dashboard {data.sector.short_label || data.sector.name}
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            {data.sector.name}{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${ACCENT}, #ffffff)`,
              }}
            >
              en Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
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

        {carouselItems.length > 0 && (
          <section className="mb-3 shrink-0">
            <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 no-scrollbar md:-mx-6 md:px-6">
              {carouselItems.map(({ p, d }) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate({ to: "/comprar/tienda/$id", params: { id: p.id } })}
                  className="relative h-44 w-44 shrink-0 snap-start overflow-hidden rounded-md border-2 border-white/10 bg-black/30 text-left transition active:scale-[0.98] hover:shadow-md"
                >
                  <img
                    src={shopPhotoUrl(p.photo_ref!, 800)}
                    alt={p.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-2 pt-7 text-white">
                    <div className="line-clamp-2 text-sm font-semibold leading-tight">{p.name}</div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-white/85">
                      <span className="truncate">{p.subsubsector_emoji ?? "•"} {p.subsubsector_name}</span>
                      <span className="shrink-0 font-mono">{fmtDist(d)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-white">
              {ranked.length} {ranked.length === 1 ? "sitio" : "sitios"}
            </p>
            <p
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{ color: `${ACCENT}cc` }}
            >
              estado · cierre · dist.
            </p>
          </div>

          <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px] text-white">
            <colgroup>
              <col className="w-[78px]" />
              <col />
              <col className="w-[52px]" />
              <col className="w-[44px]" />
              <col className="w-[48px]" />
            </colgroup>
            <thead>
              <tr
                className="text-[9px] uppercase tracking-[0.12em]"
                style={{ color: `${ACCENT}99` }}
              >
                <th className="px-1 py-1 font-medium">Categoría</th>
                <th className="px-1 py-1 font-medium">Comercio · Dirección</th>
                <th className="px-1 py-1 text-center font-medium">Estado</th>
                <th className="px-1 py-1 text-center font-medium">Cierra</th>
                <th className="px-1 py-1 text-right font-medium">Dist.</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ p, d }) => {
                const oh = p.opening_hours as OpeningHours;
                const status = computeOpenStatus(oh);
                const close = todayCloseLabel(oh);
                const statusStyle =
                  status === "open"
                    ? "bg-emerald-400/15 text-emerald-300"
                    : status === "closed"
                    ? "bg-rose-400/15 text-rose-300"
                    : "bg-white/5 text-white/40";
                const statusLabel =
                  status === "open" ? "Abre" : status === "closed" ? "Cerr" : "—";
                return (
                  <tr
                    key={p.id}
                    onClick={() => navigate({ to: "/comprar/tienda/$id", params: { id: p.id } })}
                    role="link"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate({ to: "/comprar/tienda/$id", params: { id: p.id } });
                      }
                    }}
                    className="cursor-pointer bg-white/[0.03] transition hover:bg-white/[0.08]"
                  >
                    <td
                      className="rounded-l-md px-1.5 py-1.5 align-middle text-[9px] uppercase tracking-[0.12em]"
                      style={{ color: `${ACCENT}cc` }}
                    >
                      <span className="flex items-start gap-1">
                        <span aria-hidden className="text-[12px] leading-none">
                          {p.subsubsector_emoji ?? "•"}
                        </span>
                        <span className="line-clamp-2 leading-tight">
                          {p.subsubsector_name}
                        </span>
                      </span>
                    </td>
                    <td className="px-1.5 py-1.5 align-middle">
                      <span className="block truncate text-[11px] font-medium text-white">
                        {p.name}
                      </span>
                      {p.address && (
                        <span className="block truncate text-[10px] text-white/55">
                          {p.address}
                        </span>
                      )}
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
                    <td className="px-1 py-1 text-center align-middle font-mono text-[11px] tabular-nums text-white/80">
                      {close ?? "—"}
                    </td>
                    <td className="rounded-r-md px-1 py-1 text-right align-middle font-mono text-[11px] font-semibold tabular-nums text-white">
                      {fmtDist(d)}
                    </td>
                  </tr>
                );
              })}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-6 text-center text-xs text-white/50">
                    Aún no hay comercios cargados para este sector.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
