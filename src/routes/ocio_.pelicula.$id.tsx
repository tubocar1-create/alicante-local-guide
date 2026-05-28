import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, Clock, Film as FilmIcon, Ticket } from "lucide-react";
import { getFilmWithShowtimes } from "@/lib/ocio.functions";

const ACCENT = "#f472b6";

export const Route = createFileRoute("/ocio_/pelicula/$id")({
  loader: async ({ params }) => {
    try {
      const res = await getFilmWithShowtimes({ data: { slug: params.id } });
      return { film: res.film };
    } catch {
      return { film: null };
    }
  },
  head: ({ params, loaderData }) => {
    const film = loaderData?.film ?? null;
    const url = `https://vamosalicante.com/ocio/pelicula/${params.id}`;
    const rawTitle = film?.title?.trim();
    const title = rawTitle
      ? `${rawTitle} — Cartelera Alicante`.slice(0, 60)
      : "Película · Cartelera Alicante";
    const baseDesc = rawTitle
      ? `${rawTitle}${film?.director ? `, dirigida por ${film.director}` : ""}: horarios y entradas en los cines de Alicante (Kinepolis, Yelmo, Aana, Odeon).`
      : "Detalles de la película, horarios y compra de entradas en los cines de Alicante.";
    const description = baseDesc.length > 160 ? baseDesc.slice(0, 157) + "…" : baseDesc;
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "video.movie" },
    ];
    if (film?.poster_url) {
      meta.push({ property: "og:image", content: film.poster_url });
      meta.push({ name: "twitter:image", content: film.poster_url });
    }
    const scripts = film
      ? [
          {
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Movie",
              name: film.title,
              image: film.poster_url ?? undefined,
              director: film.director
                ? { "@type": "Person", name: film.director }
                : undefined,
              genre: film.genre ?? undefined,
              duration: film.duration_min ? `PT${film.duration_min}M` : undefined,
              description: film.synopsis ?? undefined,
              url,
            }),
          },
        ]
      : undefined;
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      ...(scripts ? { scripts } : {}),
    };
  },
  component: FilmDetail,
});

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Madrid",
  });
}

function FilmDetail() {
  const { id } = Route.useParams();
  const fetchFilm = useServerFn(getFilmWithShowtimes);
  const { data, isLoading } = useQuery({
    queryKey: ["film", id],
    queryFn: () => fetchFilm({ data: { slug: id } }),
  });

  const film = data?.film ?? null;
  const showtimes = data?.showtimes ?? [];
  const cinemas = data?.cinemas ?? [];
  const cinemaById = useMemo(
    () => new Map(cinemas.map((c) => [c.id, c])),
    [cinemas],
  );

  // Agrupar por cine → día
  const byCinema = useMemo(() => {
    const m = new Map<string, Map<string, typeof showtimes>>();
    for (const s of showtimes) {
      if (!m.has(s.cinema_id)) m.set(s.cinema_id, new Map());
      const days = m.get(s.cinema_id)!;
      const d = dayKey(s.starts_at);
      if (!days.has(d)) days.set(d, []);
      days.get(d)!.push(s);
    }
    return m;
  }, [showtimes]);

  // (acciones por cine se gestionan dentro de cada tarjeta)


  if (!isLoading && !film) throw notFound();

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto"
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
            to="/ocio/cartelera"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cartelera
          </Link>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white"
            style={{
              borderColor: `${ACCENT}55`,
              background: `${ACCENT}22`,
            }}
          >
            🎬 Película
          </span>
        </header>

        {isLoading || !film ? (
          <p className="py-12 text-center text-sm text-white/70">
            {isLoading ? "Cargando ficha…" : "No encontrada."}
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl md:grid-cols-[140px_1fr]">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {film.poster_url ? (
                  <img
                    src={film.poster_url}
                    alt={film.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-48 w-full place-items-center text-4xl">
                    🎬
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: ACCENT }}
                >
                  Ficha de película
                </p>
                <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
                  <h1 className="min-w-0 flex-1 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                    {film.title}
                  </h1>
                  {cinemas.length > 0 && (
                    <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
                      {cinemas.map((c) => (
                        <Link
                          key={c.id}
                          to="/ocio/cines/$id/cartelera"
                          params={{ id: c.slug }}
                          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-white/10"
                          style={{
                            borderColor: `${ACCENT}55`,
                            background: `${ACCENT}18`,
                          }}
                        >
                          <FilmIcon className="h-2.5 w-2.5" style={{ color: ACCENT }} />
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                {film.original_title &&
                  film.original_title !== film.title && (
                    <p className="mt-0.5 text-[12px] italic text-white/60">
                      {film.original_title}
                    </p>
                  )}
                <p className="mt-2 text-[11px] text-white/70">
                  {[
                    film.duration_min ? `${film.duration_min} min` : null,
                    film.age_rating ? `+${film.age_rating}` : null,
                    film.genre,
                    film.language,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {film.director && (
                  <p className="mt-1 text-[11px] text-white/60">
                    <span className="text-white/40">Dirección: </span>
                    {film.director}
                  </p>
                )}
                {film.cast_list.length > 0 && (
                  <p className="mt-1 text-[11px] text-white/60">
                    <span className="text-white/40">Reparto: </span>
                    {film.cast_list.slice(0, 4).join(", ")}
                  </p>
                )}
              </div>
            </div>



            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: ACCENT }}
              >
                Sesiones
              </p>
              <h2 className="mt-1 font-display text-lg font-bold text-white">
                Dónde y cuándo
              </h2>

              {byCinema.size === 0 ? (
                <p className="mt-3 text-sm text-white/60">
                  No hay sesiones programadas próximamente.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  {Array.from(byCinema.entries()).map(([cinemaId, days]) => {
                    const c = cinemaById.get(cinemaId);
                    if (!c) return null;
                    const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      `${c.name} ${c.address ?? ""}`,
                    )}&travelmode=driving`;
                    return (
                      <div
                        key={cinemaId}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Link
                            to="/ocio/cines/$id/cartelera"
                            params={{ id: c.slug }}
                            className="flex items-center gap-1.5 text-sm font-semibold text-white hover:underline"
                          >
                            <FilmIcon
                              className="h-3.5 w-3.5"
                              style={{ color: ACCENT }}
                            />
                            {c.name}
                          </Link>
                          <div className="flex gap-1">
                            <a
                              href={dirHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/20"
                            >
                              <Car className="h-3 w-3" />
                              Ir en coche
                            </a>
                            {c.ticket_url && (
                              <a
                                href={c.ticket_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 px-2 py-1 text-[10px] font-semibold text-white"
                              >
                                <Ticket className="h-3 w-3" />
                                Comprar
                              </a>
                            )}
                          </div>
                        </div>
                        {c.address && (
                          <p className="mb-2 text-[11px] text-white/55">
                            {c.address}
                          </p>
                        )}
                        {(() => {
                          const todayKey = dayKey(new Date().toISOString());
                          const entries = Array.from(days.entries());
                          const todayEntries = entries.filter(([d]) => d === todayKey);
                          const laterEntries = entries.filter(([d]) => d !== todayKey);
                          const renderDay = (day: string, shows: typeof showtimes) => (
                            <div
                              key={day}
                              className="flex flex-wrap items-center gap-1.5"
                            >
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                                <Clock className="h-3 w-3" />
                                {day}
                              </span>
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
                                  >
                                    {btn}
                                  </a>
                                ) : (
                                  <span key={s.id}>{btn}</span>
                                );
                              })}
                            </div>
                          );
                          return (
                            <div className="space-y-1.5">
                              {todayEntries.length > 0 ? (
                                todayEntries.map(([d, s]) => renderDay(d, s))
                              ) : (
                                <p className="text-[11px] italic text-yellow-300">
                                  Hoy no quedan funciones disponibles.
                                </p>
                              )}
                              {laterEntries.length > 0 && (
                                <details className="group mt-2 border-t border-white/10 pt-2">
                                  <summary className="flex cursor-pointer list-none items-center justify-between rounded-md bg-white/[0.04] px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/70 hover:bg-white/[0.08]">
                                    <span>Próximos días ({laterEntries.length})</span>
                                    <span
                                      className="transition-transform group-open:rotate-180"
                                      style={{ color: ACCENT }}
                                    >
                                      ▾
                                    </span>
                                  </summary>
                                  <div
                                    className="mt-2 space-y-1.5 overflow-y-scroll rounded-md border border-white/10 bg-black/20 p-2"
                                    style={{
                                      maxHeight: "10rem",
                                      scrollbarWidth: "thin",
                                      scrollbarColor: `${ACCENT} transparent`,
                                    }}
                                  >
                                    {laterEntries.map(([d, s]) => renderDay(d, s))}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
