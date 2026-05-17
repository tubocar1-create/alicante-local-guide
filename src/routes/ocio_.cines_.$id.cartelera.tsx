import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Film as FilmIcon, Ticket, X } from "lucide-react";
import { getCinemaWithShowtimes } from "@/lib/ocio.functions";

const ACCENT = "#f472b6";

export const Route = createFileRoute("/ocio_/cines/$id/cartelera")({
  head: () => ({
    meta: [{ title: "Cartelera del cine · Alicante" }],
  }),
  component: CinemaCartelera,
});

function madridParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

function fmtDayChip(key: string, todayKey: string, tomorrowKey: string): string {
  if (key === todayKey) return "Hoy";
  if (key === tomorrowKey) return "Mañana";
  const d = new Date(`${key}T12:00:00Z`);
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Madrid",
  });
}

function CinemaCartelera() {
  const { id } = Route.useParams();
  const fetchCinema = useServerFn(getCinemaWithShowtimes);
  const { data, isLoading } = useQuery({
    queryKey: ["cinema-cartelera", id],
    queryFn: () => fetchCinema({ data: { slug: id } }),
    refetchInterval: 60_000,
  });

  const cinema = data?.cinema ?? null;
  const showtimes = data?.showtimes ?? [];
  const films = data?.films ?? [];
  const filmById = useMemo(
    () => new Map(films.map((f) => [f.id, f])),
    [films],
  );

  const todayKey = useMemo(() => madridParts(new Date().toISOString()), []);
  const tomorrowKey = useMemo(
    () =>
      madridParts(new Date(Date.now() + 24 * 3600_000).toISOString()),
    [],
  );

  // Agrupar por día (Madrid)
  const days = useMemo(() => {
    const map = new Map<string, typeof showtimes>();
    for (const s of showtimes) {
      const k = madridParts(s.starts_at);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [showtimes]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const activeDay = selectedDay ?? days[0]?.[0] ?? todayKey;
  const sessions = days.find(([k]) => k === activeDay)?.[1] ?? [];
  const nowMs = Date.now();
  const filmsToday = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.film_id));
    return Array.from(ids)
      .map((fid) => filmById.get(fid))
      .filter((f): f is NonNullable<typeof f> => Boolean(f));
  }, [sessions, filmById]);

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
            to="/ocio/cines/$id"
            params={{ id }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 hover:border-white/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al cine
          </Link>
          <Link
            to="/ocio/cines"
            aria-label="Cerrar"
            className="rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        <div className="mb-4">
          <p
            className="text-[10px] uppercase tracking-[0.3em]"
            style={{ color: ACCENT }}
          >
            Dashboard de sesiones
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            {cinema?.name ?? "Cartelera"}
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Todas las funciones del día. Las pasadas aparecen atenuadas.
          </p>
        </div>

        {/* Carrusel de días */}
        {days.length > 0 && (
          <div className="mb-3 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {days.map(([k, arr]) => {
              const isActive = k === activeDay;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSelectedDay(k)}
                  className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition"
                  style={{
                    borderColor: isActive ? ACCENT : "rgba(255,255,255,0.18)",
                    background: isActive ? `${ACCENT}22` : "rgba(255,255,255,0.04)",
                    color: isActive ? ACCENT : "rgba(255,255,255,0.75)",
                  }}
                >
                  {fmtDayChip(k, todayKey, tomorrowKey)}
                  <span className="ml-1.5 text-[9px] opacity-70">
                    {arr.length}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Carrusel de películas del día */}
        {filmsToday.length > 0 && (
          <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filmsToday.map((f) => (
              <Link
                key={f.id}
                to="/ocio/pelicula/$id"
                params={{ id: f.slug }}
                className="group w-24 shrink-0"
              >
                <div className="aspect-[2/3] w-full overflow-hidden rounded-lg border border-white/10 bg-black/40">
                  {f.poster_url ? (
                    <img
                      src={f.poster_url}
                      alt={f.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <FilmIcon className="h-6 w-6 text-white/30" />
                    </div>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-white/80 group-hover:text-white">
                  {f.title}
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* Tabla de sesiones (mismo formato que dashboard de cines) */}
        <div className="rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between px-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white">
              {sessions.length} sesiones
            </p>
            <p
              className="text-[9px] uppercase tracking-[0.2em]"
              style={{ color: `${ACCENT}99` }}
            >
              Hora · Película · Sala
            </p>
          </div>

          {isLoading ? (
            <p className="py-12 text-center text-sm text-white/60">Cargando…</p>
          ) : sessions.length === 0 ? (
            <p className="py-10 text-center text-sm text-white/60">
              Sin funciones programadas para este día.
            </p>
          ) : (
            <>
              <style>{`
                @keyframes carteleraScroll {
                  0% { transform: translateY(0); }
                  100% { transform: translateY(-50%); }
                }
                .cartelera-marquee:hover .cartelera-track { animation-play-state: paused; }
              `}</style>
              <div
                className="cartelera-marquee relative overflow-hidden"
                style={{
                  height: "min(70vh, 560px)",
                  maskImage:
                    "linear-gradient(to bottom, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%)",
                }}
              >
                <div
                  className="cartelera-track flex flex-col gap-1"
                  style={{
                    animation: `carteleraScroll ${Math.max(20, sessions.length * 3)}s linear infinite`,
                    animationDirection: "reverse",
                  }}
                >
                  {[0, 1].map((loop) => (
                    <div key={loop} className="flex flex-col gap-1" aria-hidden={loop === 1}>
                      {sessions.map((s) => {
                        const f = filmById.get(s.film_id);
                        const isPast = new Date(s.starts_at).getTime() < nowMs;
                        const tag = [s.format, s.version].filter(Boolean).join(" ");
                        return (
                          <div
                            key={`${loop}-${s.id}`}
                            className="grid grid-cols-[52px_1fr_64px_48px] items-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] text-white"
                            style={{
                              background: isPast ? "rgba(255,255,255,0.015)" : "rgba(255,255,255,0.04)",
                              opacity: isPast ? 0.42 : 1,
                            }}
                          >
                            <span
                              className="inline-flex items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold"
                              style={{
                                borderColor: isPast ? "rgba(255,255,255,0.15)" : `${ACCENT}55`,
                                color: isPast ? "rgba(255,255,255,0.7)" : ACCENT,
                                textDecoration: isPast ? "line-through" : "none",
                              }}
                            >
                              {fmtTime(s.starts_at)}
                            </span>
                            {f ? (
                              <Link
                                to="/ocio/pelicula/$id"
                                params={{ id: f.slug }}
                                className="flex min-w-0 items-start gap-1.5 hover:opacity-80"
                              >
                                <div className="h-8 w-6 shrink-0 overflow-hidden rounded-sm border border-white/10 bg-black/40">
                                  {f.poster_url ? (
                                    <img
                                      src={f.poster_url}
                                      alt={f.title}
                                      loading="lazy"
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="grid h-full w-full place-items-center">
                                      <FilmIcon className="h-3 w-3 text-white/30" />
                                    </div>
                                  )}
                                </div>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[11px] font-medium text-white">
                                    {f.title}
                                  </span>
                                  {(f.duration_min || f.age_rating || s.room) && (
                                    <span className="block truncate text-[9px] text-white/50">
                                      {[
                                        f.duration_min ? `${f.duration_min}'` : null,
                                        f.age_rating ? `+${f.age_rating}` : null,
                                        s.room,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  )}
                                </span>
                              </Link>
                            ) : (
                              <span className="text-white/50">—</span>
                            )}
                            <div className="text-center">
                              {tag ? (
                                <span className="inline-flex rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/80">
                                  {tag}
                                </span>
                              ) : (
                                <span className="text-white/30">—</span>
                              )}
                            </div>
                            <div className="text-right">
                              {s.ticket_url && !isPast ? (
                                <a
                                  href={s.ticket_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label="Comprar entrada"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border transition hover:bg-white/10"
                                  style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
                                >
                                  <Ticket className="h-3 w-3" />
                                </a>
                              ) : isPast ? (
                                <span className="text-[9px] uppercase tracking-wider text-white/40">
                                  Fin
                                </span>
                              ) : (
                                <span className="text-white/30">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
