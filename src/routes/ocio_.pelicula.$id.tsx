import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, Clock, Film as FilmIcon, Ticket } from "lucide-react";
import { getFilmWithShowtimes } from "@/lib/ocio.functions";

const ACCENT = "#f472b6";

export const Route = createFileRoute("/ocio_/pelicula/$id")({
  head: () => ({
    meta: [{ title: "Película · Cartelera Alicante" }],
  }),
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

  // Diálogo de IA y sinopsis
  const [aiOpen, setAiOpen] = useState(false);
  const [synopsisOpen, setSynopsisOpen] = useState(false);
  const fetchSynopsis = useServerFn(getFilmSynopsis);
  const { data: synData, isLoading: synLoading } = useQuery({
    queryKey: ["film-synopsis", film?.slug],
    queryFn: () => fetchSynopsis({ data: { slug: film!.slug } }),
    enabled: !!film,
    staleTime: 1000 * 60 * 60,
  });
  const synopsisText = synData?.synopsis ?? film?.synopsis ?? null;

  const fetchAI = useServerFn(getFilmAIInsight);
  const { data: aiData, isLoading: aiLoading, error: aiError } = useQuery({
    queryKey: ["film-ai", film?.id, synopsisText],
    queryFn: () =>
      fetchAI({
        data: {
          title: film!.title,
          originalTitle: film!.original_title,
          director: film!.director,
          cast: film!.cast_list,
          genre: film!.genre,
          synopsis: synopsisText,
        },
      }),
    enabled: aiOpen && !!film,
    staleTime: 1000 * 60 * 60,
  });

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

            {/* Acciones rápidas */}
            <div className="mb-4 grid gap-2">
              <button
                type="button"
                onClick={() => setSynopsisOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.06] px-4 py-3 text-white shadow-sm transition hover:bg-white/[0.12] active:scale-[0.98]"
              >
                <FilmIcon className="h-4 w-4" style={{ color: ACCENT }} />
                <span className="text-sm font-bold">Sinopsis</span>
              </button>
              <button
                type="button"
                onClick={() => setAiOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-amber-300 to-pink-400 px-4 py-3 text-amber-950 shadow-lg transition active:scale-[0.98]"
              >
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-bold">Nuestra opinión</span>
              </button>
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
                                <p className="text-[11px] italic text-white/45">
                                  Hoy no quedan sesiones disponibles.
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

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent
          className="max-w-lg border-white/15 text-white"
          style={{
            background:
              "linear-gradient(160deg, #2a0a2e 0%, #4a1238 50%, #1a0820 100%)",
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span
                className="grid h-8 w-8 place-items-center rounded-full"
                style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, color: ACCENT }}
              >
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p
                  className="text-[9px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: ACCENT }}
                >
                  Nuestra opinión · producción, reparto y acogida
                </p>
                <DialogTitle className="truncate text-base font-bold text-white">
                  {film?.title ?? "Película"}
                </DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1 text-[13px] leading-relaxed text-white/85">
            {aiLoading && (
              <p className="py-6 text-center text-white/60">
                Consultando referencias…
              </p>
            )}
            {aiError && (
              <p className="rounded-md border border-rose-400/30 bg-rose-400/10 p-3 text-[12px] text-rose-200">
                No se pudo generar la ficha IA. Inténtalo de nuevo en unos
                segundos.
              </p>
            )}
            {!aiLoading && aiData?.text && (
              <div className="space-y-3 whitespace-pre-wrap">
                {aiData.text.trim()}
              </div>
            )}
          </div>
          <p className="mt-3 text-[9px] uppercase tracking-[0.2em] text-white/40">
            Información generada por IA. Puede contener imprecisiones.
          </p>
        </DialogContent>
      </Dialog>

      <Dialog open={synopsisOpen} onOpenChange={setSynopsisOpen}>
        <DialogContent
          className="max-w-lg border-white/15 text-white"
          style={{
            background:
              "linear-gradient(160deg, #2a0a2e 0%, #4a1238 50%, #1a0820 100%)",
          }}
        >
          <DialogHeader>
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.3em]"
              style={{ color: ACCENT }}
            >
              Sinopsis
            </p>
            <DialogTitle className="truncate text-base font-bold text-white">
              {film?.title ?? "Película"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto pr-1 text-[13px] leading-relaxed text-white/85">
            {synLoading && !synopsisText
              ? "Cargando sinopsis…"
              : synopsisText ?? "Sin sinopsis disponible."}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
