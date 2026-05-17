import { createFileRoute, Link, Outlet, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Car,
  Clock,
  Globe,
  MapPin,
  Phone,
  Ticket,
} from "lucide-react";
import { LEAFLET_HEAD_LINK } from "@/lib/leaflet-head";
import { getCinemaWithShowtimes } from "@/lib/ocio.functions";

const PlaceLocationMap = lazy(() => import("@/components/PlaceLocationMap"));

const ACCENT = "#f472b6";

export const Route = createFileRoute("/ocio_/cines/$id")({
  head: () => ({
    meta: [{ title: "Cine · Cartelera Alicante" }],
    links: [LEAFLET_HEAD_LINK],
  }),
  component: CinemaDetail,
});

function toDial(p: string) {
  return p.replace(/[^\d+]/g, "");
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Madrid",
  });
}

function CinemaDetail() {
  const { id } = Route.useParams();
  const fetchCinema = useServerFn(getCinemaWithShowtimes);
  const { data, isLoading } = useQuery({
    queryKey: ["cinema", id],
    queryFn: () => fetchCinema({ data: { slug: id } }),
  });

  const cinema = data?.cinema ?? null;
  const showtimes = data?.showtimes ?? [];
  const films = data?.films ?? [];
  const filmById = useMemo(
    () => new Map(films.map((f) => [f.id, f])),
    [films],
  );

  // Agrupar por día → película
  const grouped = useMemo(() => {
    const byDay = new Map<
      string,
      Map<string, typeof showtimes>
    >();
    for (const s of showtimes) {
      const day = dayKey(s.starts_at);
      if (!byDay.has(day)) byDay.set(day, new Map());
      const filmMap = byDay.get(day)!;
      if (!filmMap.has(s.film_id)) filmMap.set(s.film_id, []);
      filmMap.get(s.film_id)!.push(s);
    }
    return byDay;
  }, [showtimes]);

  if (!isLoading && !cinema) throw notFound();

  const dirHref = cinema
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${cinema.name} ${cinema.address ?? ""}`,
      )}&travelmode=driving`
    : "#";
  const mapsHref = cinema
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${cinema.name} ${cinema.address ?? ""}`,
      )}`
    : "#";
  const telHref = cinema?.phone ? `tel:${toDial(cinema.phone)}` : "";
  const hoursList =
    (cinema?.opening_hours as { weekdayDescriptions?: string[] } | null)
      ?.weekdayDescriptions ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{
        background:
          "linear-gradient(160deg, #2a0a2e 0%, #4a1238 45%, #1a0820 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: ACCENT }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-5">
        <header className="mb-4 flex items-center justify-between">
          <Link
            to="/ocio/cines"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white"
            style={{
              borderColor: `${ACCENT}55`,
              background: `${ACCENT}22`,
            }}
          >
            🎬 Cine
          </span>
        </header>

        {isLoading || !cinema ? (
          <p className="py-12 text-center text-sm text-white/70">
            {isLoading ? "Cargando ficha…" : "No encontrado."}
          </p>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: ACCENT }}
              >
                Ficha técnica
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                {cinema.name}
              </h1>
              {cinema.brand && (
                <p className="mt-0.5 text-[12px] text-white/60">
                  {cinema.brand}
                </p>
              )}
              <Link
                to="/ocio/cines/$id/cartelera"
                params={{ id }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:bg-white/10"
                style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
              >
                🎞️ Ver cartelera de este cine →
              </Link>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2">
              <a
                href={dirHref}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-3 text-black shadow-lg transition active:scale-95"
                style={{ background: ACCENT }}
              >
                <Car className="h-5 w-5" />
                <span className="text-[11px] font-bold">Cómo llegar</span>
              </a>
              {cinema.phone ? (
                <a
                  href={telHref}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-3 text-amber-950 shadow-lg transition active:scale-95"
                >
                  <Phone className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Llamar</span>
                </a>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02]" />
              )}
              {cinema.ticket_url && (
                <a
                  href={cinema.ticket_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-3 py-3 text-white shadow-lg transition active:scale-95"
                >
                  <Ticket className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Comprar</span>
                </a>
              )}
            </div>

            <div className="mb-4 space-y-2 rounded-2xl border border-white/15 bg-white/[0.04] p-3 backdrop-blur-xl">
              {cinema.address && (
                <Row icon={MapPin} label="Dirección">
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline-offset-2 hover:underline"
                  >
                    {cinema.address}
                  </a>
                </Row>
              )}
              {cinema.phone && (
                <Row icon={Phone} label="Teléfono">
                  <a href={telHref} className="font-mono text-white">
                    {cinema.phone}
                  </a>
                </Row>
              )}
              {cinema.website && (
                <Row icon={Globe} label="Web">
                  <a
                    href={cinema.website}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-white underline-offset-2 hover:underline"
                  >
                    {cinema.website}
                  </a>
                </Row>
              )}
              {hoursList.length > 0 && (
                <Row icon={Clock} label="Horario">
                  <ul className="space-y-0.5 text-[12px] text-white/90">
                    {hoursList.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </Row>
              )}
            </div>

            <div className="mb-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: ACCENT }}
              >
                Cartelera
              </p>
              <h2 className="mt-1 font-display text-lg font-bold text-white">
                Próximas sesiones
              </h2>

              {grouped.size === 0 ? (
                <p className="mt-3 text-sm text-white/60">
                  No hay sesiones programadas en este momento.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  {Array.from(grouped.entries()).map(([day, byFilm]) => (
                    <div key={day}>
                      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-widest text-white/70">
                        {day}
                      </h3>
                      <div className="space-y-2">
                        {Array.from(byFilm.entries()).map(([filmId, shows]) => {
                          const f = filmById.get(filmId);
                          if (!f) return null;
                          return (
                            <div
                              key={filmId}
                              className="rounded-xl border border-white/10 bg-white/[0.03] p-2"
                            >
                              <div className="flex gap-3">
                                <Link
                                  to="/ocio/pelicula/$id"
                                  params={{ id: f.slug }}
                                  className="block h-20 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40"
                                >
                                  {f.poster_url ? (
                                    <img
                                      src={f.poster_url}
                                      alt={f.title}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center text-2xl">
                                      🎬
                                    </div>
                                  )}
                                </Link>
                                <div className="min-w-0 flex-1">
                                  <Link
                                    to="/ocio/pelicula/$id"
                                    params={{ id: f.slug }}
                                    className="block text-[13px] font-semibold leading-tight text-white hover:underline"
                                  >
                                    {f.title}
                                  </Link>
                                  <p className="mt-0.5 text-[10px] text-white/55">
                                    {[
                                      f.duration_min
                                        ? `${f.duration_min} min`
                                        : null,
                                      f.age_rating ? `+${f.age_rating}` : null,
                                      f.genre,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {shows.map((s) => {
                                      const tag = [s.format, s.version]
                                        .filter(Boolean)
                                        .join(" ");
                                      const btn = (
                                        <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20">
                                          <span className="font-mono">
                                            {fmtTime(s.starts_at)}
                                          </span>
                                          {tag && (
                                            <span className="text-[9px] uppercase tracking-wider text-white/60">
                                              {tag}
                                            </span>
                                          )}
                                        </span>
                                      );
                                      return s.ticket_url ? (
                                        <a
                                          key={s.id}
                                          href={s.ticket_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          title="Comprar entrada"
                                        >
                                          {btn}
                                        </a>
                                      ) : (
                                        <span key={s.id}>{btn}</span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cinema.lat != null && cinema.lng != null && (
              <div className="mb-4">
                <Suspense
                  fallback={
                    <div className="h-56 rounded-2xl border border-white/10 bg-white/[0.04]" />
                  }
                >
                  <PlaceLocationMap
                    lat={cinema.lat}
                    lng={cinema.lng}
                    name={cinema.name}
                    address={cinema.address}
                  />
                </Suspense>
              </div>
            )}
          </>
        )}
        <Outlet />
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <Icon
        className="mt-0.5 h-3.5 w-3.5 shrink-0"
        style={{ color: ACCENT }}
      />
      <div className="min-w-0 flex-1">
        <p
          className="text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: ACCENT }}
        >
          {label}
        </p>
        <div className="text-white/90">{children}</div>
      </div>
    </div>
  );
}
