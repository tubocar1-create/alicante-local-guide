import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X, Film as FilmIcon, Clapperboard } from "lucide-react";
import { listCinemas } from "@/lib/ocio.functions";
import { computeOpenStatus } from "@/lib/opening-status";
import {
  useUserLocation,
  distanceKm,
  type Coords,
} from "@/hooks/useUserLocation";

export const Route = createFileRoute("/ocio_/cines")({
  head: () => ({
    meta: [
      { title: "Cines en Alicante · Cartelera y horarios" },
      {
        name: "description",
        content:
          "Cines de Alicante: Kinepolis Plaza Mar 2, Yelmo Puerta de Alicante, Aana Cinemas. Cartelera, horarios y compra de entradas.",
      },
    ],
  }),
  component: CinemasPage,
});

const ALICANTE: Coords = { lat: 38.3452, lng: -0.481 };
const ACCENT = "#f472b6";

function fmtDist(km: number | null): string {
  if (km == null || !Number.isFinite(km)) return "—";
  const m = Math.round(km * 1000);
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

function CinemasPage() {
  const list = useServerFn(listCinemas);
  const { data, isLoading } = useQuery({
    queryKey: ["cinemas"],
    queryFn: () => list(),
  });
  const { state: locState, request: requestLocation } = useUserLocation();
  const origin: Coords =
    locState.status === "ready" ? locState.coords : ALICANTE;
  const hasGeo = locState.status === "ready";

  const items = data ?? [];
  const ranked = useMemo(() => {
    return items
      .map((p) => ({
        p,
        d:
          p.lat != null && p.lng != null
            ? distanceKm(origin, { lat: p.lat, lng: p.lng })
            : null,
      }))
      .sort((a, b) => {
        if (a.d != null && b.d != null) return a.d - b.d;
        if (a.d != null) return -1;
        if (b.d != null) return 1;
        return 0;
      });
  }, [items, origin]);

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #2a0a2e 0%, #4a1238 50%, #1a0820 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: ACCENT }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/ocio"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver a Ocio
          </Link>
          <Link
            to="/ocio"
            aria-label="Cerrar"
            className="rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        <div className="mb-5">
          <p
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{ color: ACCENT }}
          >
            Dashboard de cines
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Cines{" "}
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
            Cartelera, horarios y compra online ·{" "}
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
          <Link
            to="/ocio/cartelera"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:bg-white/10"
            style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
          >
            🎞️ Ver cartelera completa →
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-white">
              {isLoading
                ? "Cargando…"
                : `${ranked.length} ${ranked.length === 1 ? "cine" : "cines"}`}
            </p>
            <p
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{ color: `${ACCENT}cc` }}
            >
              cine · estado · dist.
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
                style={{ color: `${ACCENT}99` }}
              >
                <th className="px-1 py-1 font-medium">Cine · Dirección</th>
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
                        to="/ocio/cines/$id"
                        params={{ id: p.slug }}
                        className="flex items-start gap-1.5 hover:opacity-80"
                      >
                        <FilmIcon
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          style={{ color: ACCENT }}
                        />
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
                    Aún no hay cines disponibles.
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
