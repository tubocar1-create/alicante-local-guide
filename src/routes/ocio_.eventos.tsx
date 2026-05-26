import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X, Drama, Calendar, Ticket, MapPin } from "lucide-react";
import { listVenues } from "@/lib/eventos.functions";

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

function EventosLanding() {
  const list = useServerFn(listVenues);
  const { data, isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: () => list(),
  });
  const venues = data ?? [];

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

      <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-5 md:px-6">
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

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link
            to="/ocio/eventos/agenda"
            className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.05] p-4 backdrop-blur-xl transition hover:border-white/30 hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-full"
                style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, color: ACCENT }}
              >
                <Calendar className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">Cronograma</div>
                <div className="text-[11px] text-white/55">
                  Todos los eventos por fecha y lugar
                </div>
              </div>
            </div>
          </Link>

          <Link
            to="/ocio/eventos/cartelera"
            className="group relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.05] p-4 backdrop-blur-xl transition hover:border-white/30 hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-3">
              <div
                className="grid h-11 w-11 place-items-center rounded-full"
                style={{ background: `${ACCENT}22`, border: `1px solid ${ACCENT}55`, color: ACCENT }}
              >
                <Ticket className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">Cartelera</div>
                <div className="text-[11px] text-white/55">
                  Pósters y fichas visuales
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 backdrop-blur-xl md:p-4">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-[12px] font-semibold text-white">
              {isLoading
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
            {!isLoading && venues.length === 0 && (
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
