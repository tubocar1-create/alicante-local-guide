import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, Clock, MapPin, Ticket, Drama } from "lucide-react";
import { getEventoWithShowtimes } from "@/lib/eventos.functions";

const ACCENT = "#a78bfa";

export const Route = createFileRoute("/ocio_/eventos/$id")({
  head: () => ({
    meta: [{ title: "Evento · Agenda Alicante" }],
  }),
  component: EventoDetail,
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
    year: "numeric",
    timeZone: "Europe/Madrid",
  });
}
function fmtPrice(min: number | null, max: number | null, currency: string | null): string {
  if (min == null && max == null) return "n/d";
  const c = currency === "EUR" || !currency ? "€" : ` ${currency}`;
  if (min != null && max != null && min !== max) return `${min}–${max}${c}`;
  return `${min ?? max}${c}`;
}

function EventoDetail() {
  const { id } = Route.useParams();
  const fetchEvento = useServerFn(getEventoWithShowtimes);
  const { data, isLoading } = useQuery({
    queryKey: ["evento", id],
    queryFn: () => fetchEvento({ data: { slug: id } }),
  });

  const evento = data?.evento ?? null;
  const showtimes = data?.showtimes ?? [];
  const venues = data?.venues ?? [];
  const venueById = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);

  const byVenue = useMemo(() => {
    const m = new Map<string, Map<string, typeof showtimes>>();
    for (const s of showtimes) {
      if (!m.has(s.venue_id)) m.set(s.venue_id, new Map());
      const days = m.get(s.venue_id)!;
      const d = dayKey(s.starts_at);
      if (!days.has(d)) days.set(d, []);
      days.get(d)!.push(s);
    }
    return m;
  }, [showtimes]);

  if (!isLoading && !evento) throw notFound();

  return (
    <div
      className="fixed inset-0 z-40 overflow-y-auto"
      style={{
        background:
          "linear-gradient(160deg, #1e1235 0%, #3b1f5e 45%, #100820 100%)",
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
            to="/ocio/eventos/cartelera"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Cartelera
          </Link>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white"
            style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}22` }}
          >
            🎟️ Evento
          </span>
        </header>

        {isLoading || !evento ? (
          <p className="py-12 text-center text-sm text-white/70">
            {isLoading ? "Cargando ficha…" : "No encontrado."}
          </p>
        ) : (
          <>
            <div className="mb-4 grid gap-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl md:grid-cols-[140px_1fr]">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                {evento.poster_url ? (
                  <img
                    src={evento.poster_url}
                    alt={evento.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-48 w-full place-items-center text-4xl">🎭</div>
                )}
              </div>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: ACCENT }}
                >
                  {evento.category}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                  {evento.title}
                </h1>
                {evento.artist && (
                  <p className="mt-0.5 text-[12px] italic text-white/60">{evento.artist}</p>
                )}
                <p className="mt-2 text-[11px] text-white/70">
                  {[
                    evento.duration_min ? `${evento.duration_min} min` : null,
                    evento.age_rating ? `+${evento.age_rating}` : null,
                    evento.genre,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "n/d"}
                </p>
                {evento.description && (
                  <p className="mt-2 line-clamp-5 text-[12px] leading-relaxed text-white/80">
                    {evento.description}
                  </p>
                )}
                {evento.source_url && (
                  <a
                    href={evento.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[11px] underline underline-offset-2"
                    style={{ color: ACCENT }}
                  >
                    Fuente oficial →
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: ACCENT }}
              >
                Pases
              </p>
              <h2 className="mt-1 font-display text-lg font-bold text-white">Dónde y cuándo</h2>

              {byVenue.size === 0 ? (
                <p className="mt-3 text-sm text-white/60">
                  Sin pases vigentes — n/d.
                </p>
              ) : (
                <div className="mt-3 space-y-4">
                  {Array.from(byVenue.entries()).map(([venueId, days]) => {
                    const v = venueById.get(venueId);
                    if (!v) return null;
                    const dirHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                      `${v.name} ${v.address ?? ""}`,
                    )}&travelmode=driving`;
                    return (
                      <div
                        key={venueId}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <Link
                            to="/ocio/eventos/venue/$id"
                            params={{ id: v.slug }}
                            className="flex items-center gap-1.5 text-sm font-semibold text-white hover:underline"
                          >
                            <Drama className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                            {v.name}
                          </Link>
                          <a
                            href={dirHref}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold text-white hover:bg-white/20"
                          >
                            <Car className="h-3 w-3" />
                            Ir
                          </a>
                        </div>
                        {v.address && (
                          <p className="mb-2 flex items-center gap-1 text-[11px] text-white/55">
                            <MapPin className="h-3 w-3" />
                            {v.address}
                          </p>
                        )}
                        <div className="space-y-1.5">
                          {Array.from(days.entries()).map(([d, shows]) => (
                            <div key={d} className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/60">
                                <Clock className="h-3 w-3" />
                                {d}
                              </span>
                              {shows.map((s) => {
                                const price = fmtPrice(s.price_min, s.price_max, s.currency);
                                const btn = (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20">
                                    <span className="font-mono">{fmtTime(s.starts_at)}</span>
                                    <span
                                      className="text-[9px] uppercase tracking-wider"
                                      style={{ color: ACCENT }}
                                    >
                                      {price}
                                    </span>
                                  </span>
                                );
                                return s.ticket_url ? (
                                  <a key={s.id} href={s.ticket_url} target="_blank" rel="noreferrer">
                                    {btn}
                                  </a>
                                ) : (
                                  <span key={s.id}>{btn}</span>
                                );
                              })}
                            </div>
                          ))}
                        </div>
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
