import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X, Drama, Ticket, MapPin } from "lucide-react";
import { listVenues, listAgenda } from "@/lib/eventos.functions";

const ACCENT = "#a78bfa";

export const Route = createFileRoute("/ocio_/eventos")({
  head: () => ({
    meta: [
      { title: "Teatro, conciertos y eventos · Alicante" },
      {
        name: "description",
        content:
          "Agenda de teatro, conciertos, ópera, festivales y eventos culturales en Alicante. Programación de Teatro Principal, ADDA, Plaza de Toros, Área 12 y más.",
      },
    ],
  }),
  component: EventosLanding,
});

function fmtDate(iso: string): string {
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

function EventosLanding() {
  const listV = useServerFn(listVenues);
  const fetchAgenda = useServerFn(listAgenda);

  const { data: venuesData, isLoading: vLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => listV(),
  });
  const { data: agendaData, isLoading: aLoading } = useQuery({
    queryKey: ["eventos-agenda"],
    queryFn: () => fetchAgenda(),
  });

  const venues = venuesData ?? [];
  const rows = agendaData ?? [];

  const [cat, setCat] = useState<string>("all");
  const categorias = useMemo(() => {
    const set = new Set(rows.map((r) => r.event.category));
    return Array.from(set).sort();
  }, [rows]);
  const filtered = useMemo(
    () => (cat === "all" ? rows : rows.filter((r) => r.event.category === cat)),
    [rows, cat],
  );

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #1e1235 0%, #3b1f5e 50%, #100820 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: ACCENT }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-4 pb-32 pt-5 md:px-6">
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

        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.3em]"
              style={{ color: ACCENT }}
            >
              Agenda cultural
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
              Teatro, conciertos{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, #ffffff)` }}
              >
                y eventos
              </span>
            </h1>
            <p className="mt-1 text-xs text-white/70 md:text-sm">
              Programación de los principales recintos de Alicante hasta diciembre 2026.
            </p>
          </div>
          <Link
            to="/ocio/eventos/cartelera"
            className="hidden shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-white/[0.12] sm:inline-flex"
          >
            <Ticket className="h-3.5 w-3.5" style={{ color: ACCENT }} />
            Cartelera
          </Link>
        </div>

        <Link
          to="/ocio/eventos/cartelera"
          className="mb-3 flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition hover:bg-white/[0.12] sm:hidden"
        >
          <Ticket className="h-3.5 w-3.5" style={{ color: ACCENT }} />
          Ver cartelera visual
        </Link>

        {categorias.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setCat("all")}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                cat === "all" ? "bg-white text-violet-900" : "bg-white/10 text-white/70"
              }`}
            >
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                  cat === c ? "bg-white text-violet-900" : "bg-white/10 text-white/70"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-2 backdrop-blur-xl md:p-3">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
            <p className="text-[12px] font-semibold text-white">Cronograma</p>
            <p
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{ color: `${ACCENT}cc` }}
            >
              fecha · lugar
            </p>
          </div>

          {aLoading ? (
            <p className="py-8 text-center text-sm text-white/60">Cargando agenda…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-white/60">
              Aún no hay eventos vigentes. El scraping mensual los incorporará.
            </p>
          ) : (
            <table className="w-full table-fixed border-separate border-spacing-y-0.5 text-left text-[11px]">
              <colgroup>
                <col className="w-[88px]" />
                <col />
                <col className="w-[26%]" />
                <col className="w-[60px]" />
                <col className="w-[32px]" />
              </colgroup>
              <thead>
                <tr
                  className="text-[9px] uppercase tracking-[0.12em]"
                  style={{ color: `${ACCENT}99` }}
                >
                  <th className="px-1 py-1 font-medium">Fecha</th>
                  <th className="px-1 py-1 font-medium">Evento</th>
                  <th className="px-1 py-1 font-medium">Lugar</th>
                  <th className="px-1 py-1 text-right font-medium">Precio</th>
                  <th className="px-1 py-1 text-center font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ showtime, event, venue }) => (
                  <tr key={showtime.id} className="bg-white/[0.03]">
                    <td className="rounded-l-md px-1.5 py-1.5 align-middle font-mono text-[10px] text-white/80">
                      {fmtDate(showtime.starts_at)}
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <Link
                        to="/ocio/eventos/$id"
                        params={{ id: event.slug }}
                        className="block truncate text-[11px] font-medium text-white hover:underline"
                      >
                        {event.title}
                      </Link>
                      <span
                        className="text-[9px] uppercase tracking-wider"
                        style={{ color: `${ACCENT}aa` }}
                      >
                        {event.category}
                      </span>
                    </td>
                    <td className="px-1 py-1 align-middle">
                      <Link
                        to="/ocio/eventos/venue/$id"
                        params={{ id: venue.slug }}
                        className="block truncate text-[11px] text-white/80 hover:text-white hover:underline"
                      >
                        {venue.name}
                      </Link>
                    </td>
                    <td className="px-1 py-1 text-right align-middle font-mono text-[11px] tabular-nums text-white">
                      {fmtPrice(showtime.price_min, showtime.price_max, showtime.currency)}
                    </td>
                    <td className="rounded-r-md px-1 py-1 text-center align-middle">
                      {showtime.ticket_url ? (
                        <a
                          href={showtime.ticket_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Comprar entrada"
                          className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ background: `${ACCENT}33`, color: ACCENT }}
                        >
                          <Ticket className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-[10px] text-white/30">n/d</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-white">
              {vLoading
                ? "Cargando…"
                : `${venues.length} ${venues.length === 1 ? "recinto" : "recintos"}`}
            </p>
            <p
              className="text-[9px] uppercase tracking-[0.18em]"
              style={{ color: `${ACCENT}cc` }}
            >
              recinto · tipo
            </p>
          </div>

          <ul className="space-y-1">
            {venues.map((v) => (
              <li key={v.id}>
                <Link
                  to="/ocio/eventos/venue/$id"
                  params={{ id: v.slug }}
                  className="flex items-center gap-2 rounded-md bg-white/[0.03] px-2 py-1.5 transition hover:bg-white/[0.08]"
                >
                  <Drama className="h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-white">
                    {v.name}
                  </span>
                  {v.address && (
                    <span className="hidden items-center gap-1 truncate text-[10px] text-white/45 sm:inline-flex">
                      <MapPin className="h-2.5 w-2.5" />
                      {v.address}
                    </span>
                  )}
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                    style={{ background: `${ACCENT}18`, color: ACCENT }}
                  >
                    {v.kind}
                  </span>
                </Link>
              </li>
            ))}
            {!vLoading && venues.length === 0 && (
              <li className="py-4 text-center text-xs text-white/50">
                Aún no hay recintos cargados.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
