import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Car, ExternalLink, MapPin, Ticket } from "lucide-react";
import { getVenueWithEvents } from "@/lib/eventos.functions";

const ACCENT = "#a78bfa";

export const Route = createFileRoute("/ocio_/eventos_/venue/$id")({
  head: () => ({
    meta: [{ title: "Recinto · Agenda Alicante" }],
  }),
  component: VenueDetail,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}
function fmtPrice(min: number | null, max: number | null, currency: string | null): string {
  if (min == null && max == null) return "n/d";
  const c = currency === "EUR" || !currency ? "€" : ` ${currency}`;
  if (min != null && max != null && min !== max) return `${min}–${max}${c}`;
  return `${min ?? max}${c}`;
}

function VenueDetail() {
  const { id } = Route.useParams();
  const fetchVenue = useServerFn(getVenueWithEvents);
  const { data, isLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => fetchVenue({ data: { slug: id } }),
  });
  const venue = data?.venue ?? null;
  const showtimes = data?.showtimes ?? [];
  const events = data?.events ?? [];
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  if (!isLoading && !venue) throw notFound();

  const dirHref = venue
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${venue.name} ${venue.address ?? ""}`,
      )}&travelmode=driving`
    : null;

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
            to="/ocio/eventos"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Recintos
          </Link>
        </header>

        {isLoading || !venue ? (
          <p className="py-12 text-center text-sm text-white/70">
            {isLoading ? "Cargando…" : "No encontrado."}
          </p>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: ACCENT }}
              >
                {venue.kind}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-white md:text-3xl">
                {venue.name}
              </h1>
              {venue.address && (
                <p className="mt-1 flex items-center gap-1 text-[12px] text-white/70">
                  <MapPin className="h-3 w-3" />
                  {venue.address}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {dirHref && (
                  <a
                    href={dirHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
                  >
                    <Car className="h-3 w-3" />
                    Ir en coche
                  </a>
                )}
                {venue.website && (
                  <a
                    href={venue.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white"
                    style={{ background: `${ACCENT}44` }}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Web oficial
                  </a>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: ACCENT }}
              >
                Próximos eventos
              </p>
              {showtimes.length === 0 ? (
                <p className="mt-3 text-sm text-white/60">
                  Sin programación cargada — n/d.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {showtimes.map((s) => {
                    const e = eventById.get(s.event_id);
                    if (!e) return null;
                    return (
                      <li
                        key={s.id}
                        className="flex items-center gap-2 rounded-md bg-white/[0.03] p-2"
                      >
                        <span className="w-[110px] shrink-0 font-mono text-[10px] text-white/80">
                          {fmtDate(s.starts_at)}
                        </span>
                        <Link
                          to="/ocio/eventos/$id"
                          params={{ id: e.slug }}
                          className="min-w-0 flex-1 truncate text-[12px] font-medium text-white hover:underline"
                        >
                          {e.title}
                        </Link>
                        <span className="w-[64px] text-right font-mono text-[11px] tabular-nums text-white/80">
                          {fmtPrice(s.price_min, s.price_max, s.currency)}
                        </span>
                        {s.ticket_url ? (
                          <a
                            href={s.ticket_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                            style={{ background: `${ACCENT}33`, color: ACCENT }}
                          >
                            <Ticket className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="w-6 text-center text-[10px] text-white/30">n/d</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
