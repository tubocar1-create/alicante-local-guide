import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { X, Film as FilmIcon } from "lucide-react";
import { listCartelera } from "@/lib/ocio.functions";

const ACCENT = "#f472b6";

export const Route = createFileRoute("/ocio_/cartelera")({
  head: () => {
    const title = "Cartelera de cines · Alicante";
    const description =
      "Cartelera completa de los cines de Alicante: Kinepolis, Yelmo, Aana y Odeon. Horarios y compra de entradas.";
    const url = "https://vamosalicante.com/ocio/cartelera";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  component: CarteleraPage,
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

function CarteleraPage() {
  const fetchList = useServerFn(listCartelera);
  const { data, isLoading } = useQuery({
    queryKey: ["cartelera"],
    queryFn: () => fetchList(),
  });

  const items = data?.items ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
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
            Cartelera global
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Cartelera{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${ACCENT}, #ffffff)`,
              }}
            >
              de Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Todas las películas en cartel.{" "}
            <Link
              to="/ocio/cines"
              className="underline underline-offset-2 hover:text-white"
            >
              Ver por cine →
            </Link>
          </p>
        </div>

        {isLoading ? (
          <p className="py-12 text-center text-sm text-white/60">Cargando…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm text-white/60">
            Aún no hay películas en cartelera. El scraping diario actualizará
            los pases automáticamente.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((f) => (
              <Link
                key={f.id}
                to="/ocio/pelicula/$id"
                params={{ id: f.slug }}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-xl transition hover:border-white/30 hover:bg-white/[0.08]"
              >
                <div className="relative aspect-[2/3] w-full bg-black/40">
                  {f.poster_url ? (
                    <img
                      src={f.poster_url}
                      alt={f.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-4xl">
                      <FilmIcon className="h-10 w-10 text-white/30" />
                    </div>
                  )}
                  {f.age_rating && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      +{f.age_rating}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-2.5">
                  <h3 className="line-clamp-2 text-[12px] font-semibold leading-tight text-white group-hover:underline">
                    {f.title}
                  </h3>
                  <p className="text-[10px] text-white/55">
                    {[
                      f.duration_min ? `${f.duration_min} min` : null,
                      f.genre,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-auto flex items-center justify-end gap-1 pt-1 text-[9px] uppercase tracking-wider">
                    <span className="text-white/50">
                      {f.cinema_count}{" "}
                      {f.cinema_count === 1 ? "cine" : "cines"}
                    </span>
                  </div>
                  {f.next_show_at && (
                    <p className="text-[9px] text-white/40">
                      Próx: {fmtDay(f.next_show_at)}
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
