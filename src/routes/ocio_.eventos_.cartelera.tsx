import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X, Drama as DramaIcon } from "lucide-react";
import { listEventosCartelera } from "@/lib/eventos.functions";

const ACCENT = "#a78bfa";

export const Route = createFileRoute("/ocio_/eventos_/cartelera")({
  head: () => ({
    meta: [
      { title: "Cartelera de eventos · Alicante" },
      {
        name: "description",
        content:
          "Cartelera visual de teatro, conciertos, ópera y festivales en Alicante. Pósters, fechas y compra de entradas.",
      },
    ],
  }),
  component: CarteleraEventosPage,
});

function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

const CAT_EMOJI: Record<string, string> = {
  teatro: "🎭",
  concierto: "🎤",
  opera: "🎼",
  danza: "💃",
  musical: "🎵",
  festival: "🎪",
  humor: "😄",
  otro: "✨",
};

function CarteleraEventosPage() {
  const fetchList = useServerFn(listEventosCartelera);
  const { data, isLoading } = useQuery({
    queryKey: ["eventos-cartelera"],
    queryFn: () => fetchList(),
  });
  const items = data ?? [];

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

      <div className="relative mx-auto max-w-5xl px-4 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/ocio/eventos"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver
          </Link>
          <Link
            to="/ocio/eventos"
            aria-label="Cerrar"
            className="rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: ACCENT }}>
            Cartelera visual
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Eventos{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(90deg, ${ACCENT}, #ffffff)` }}
            >
              de Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Pósters, fechas y recintos.{" "}
            <Link to="/ocio/eventos/agenda" className="underline underline-offset-2 hover:text-white">
              Ver cronograma →
            </Link>
          </p>
        </div>

        {isLoading ? (
          <p className="py-12 text-center text-sm text-white/60">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-white/60">
            Aún no hay eventos en cartelera. El scraping mensual actualizará la agenda automáticamente.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((e) => (
              <Link
                key={e.id}
                to="/ocio/eventos/$id"
                params={{ id: e.slug }}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                <div className="relative aspect-[2/3] w-full bg-black/40">
                  {e.poster_url ? (
                    <img
                      src={e.poster_url}
                      alt={e.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className="grid h-full w-full place-items-center text-5xl"
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(167,139,250,0.25), rgba(244,114,182,0.15))",
                      }}
                    >
                      {CAT_EMOJI[e.category] ?? "🎟️"}
                    </div>
                  )}
                  <span
                    className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                    style={{ background: `${ACCENT}cc` }}
                  >
                    {e.category}
                  </span>
                  {e.age_rating && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      +{e.age_rating}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <h3 className="line-clamp-2 text-[12px] font-semibold leading-tight text-white group-hover:underline">
                    {e.title}
                  </h3>
                  <p className="text-[10px] text-white/55">
                    {[e.duration_min ? `${e.duration_min} min` : null, e.genre]
                      .filter(Boolean)
                      .join(" · ") || (e.artist ?? "")}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-1 pt-1 text-[9px] uppercase tracking-wider">
                    <span className="text-white/50">
                      {e.venue_count} {e.venue_count === 1 ? "lugar" : "lugares"}
                    </span>
                    {e.next_price_min != null && (
                      <span style={{ color: ACCENT }}>desde {e.next_price_min}€</span>
                    )}
                  </div>
                  {e.next_show_at && (
                    <p className="text-[9px] text-white/40">Próx: {fmtDay(e.next_show_at)}</p>
                  )}
                  {e.next_venue_name && (
                    <p className="line-clamp-1 text-[9px] text-white/40">
                      <DramaIcon className="mr-0.5 inline h-2 w-2" />
                      {e.next_venue_name}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
