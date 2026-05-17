import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Car,
  Clock,
  Globe,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { LEAFLET_HEAD_LINK } from "@/lib/leaflet-head";
import { getCategory } from "@/lib/health-categories";
import { getHealthProvider } from "@/lib/health.functions";
import { getAiReview } from "@/lib/ai-review.functions";

const PlaceLocationMap = lazy(() => import("@/components/PlaceLocationMap"));

export const Route = createFileRoute("/salud_/$categoria/$id")({
  beforeLoad: ({ params }) => {
    if (!getCategory(params.categoria)) throw notFound();
  },
  head: () => ({
    meta: [{ title: "Ficha · Salud Alicante" }],
    links: [LEAFLET_HEAD_LINK],
  }),
  component: ProviderDetailPage,
});

function toDial(p: string) {
  const digits = p.replace(/[^\d+]/g, "");
  return digits;
}

function ProviderDetailPage() {
  const { categoria, id } = Route.useParams();
  const cat = getCategory(categoria)!;
  const get = useServerFn(getHealthProvider);
  const fetchAiReview = useServerFn(getAiReview);
  const { data: p, isLoading } = useQuery({
    queryKey: ["health-provider", id],
    queryFn: () => get({ data: { id } }),
  });

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewText, setReviewText] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewErr, setReviewErr] = useState<string | null>(null);

  async function openReview() {
    setReviewOpen(true);
    if (reviewText || reviewLoading) return;
    setReviewLoading(true);
    setReviewErr(null);
    try {
      const r = await fetchAiReview({
        data: {
          name: p?.name ?? "",
          kind: cat.label,
          address: p?.address ?? null,
        },
      });
      setReviewText(r.text);
    } catch (e) {
      setReviewErr(String((e as Error)?.message ?? e));
    } finally {
      setReviewLoading(false);
    }
  }

  if (!isLoading && !p) throw notFound();

  const dirHref = p
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${p.name} ${p.address ?? ""}`,
      )}&travelmode=driving`
    : "#";
  const mapsHref = p
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${p.name} ${p.address ?? ""}`,
      )}`
    : "#";
  const telHref = p?.phone ? `tel:${toDial(p.phone)}` : "";
  const hoursList =
    (p?.opening_hours as { weekdayDescriptions?: string[] } | null)
      ?.weekdayDescriptions ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto"
      style={{
        background: `linear-gradient(160deg, ${cat.gradFrom} 0%, ${cat.gradVia} 45%, ${cat.gradTo} 100%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
          style={{ background: cat.accent }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-12 pt-5">
        <header className="mb-4 flex items-center justify-between">
          <Link
            to="/salud/$categoria"
            params={{ categoria }}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{
              borderColor: `${cat.accent}55`,
              background: `${cat.accent}22`,
              color: "white",
            }}
          >
            <span aria-hidden>{cat.emoji}</span>
            {cat.label}
          </span>
        </header>

        {isLoading || !p ? (
          <p className="py-12 text-center text-sm text-white/70">
            {isLoading ? "Cargando ficha…" : "No encontrado."}
          </p>
        ) : (
          <>
            <div className="mb-4 rounded-2xl border border-white/15 bg-white/[0.04] p-4 backdrop-blur-xl">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                style={{ color: cat.accent }}
              >
                Ficha técnica
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                {p.name}
              </h1>

              {cat.group === "privado" && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <a
                    href={
                      p.google_place_id
                        ? `https://search.google.com/local/reviews?placeid=${p.google_place_id}`
                        : `https://www.google.com/search?q=${encodeURIComponent(`${p.name} ${p.address ?? "Alicante"} reseñas`)}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-[11px] font-semibold text-white/85 hover:bg-white/[0.08]"
                  >
                    <MessageSquare className="h-4 w-4 text-cyan-300" />
                    Google
                  </a>
                  <a
                    href={`https://www.tripadvisor.es/Search?q=${encodeURIComponent(`${p.name} Alicante`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5 text-[11px] font-semibold text-white/85 hover:bg-white/[0.08]"
                  >
                    <MessageSquare className="h-4 w-4 text-emerald-300" />
                    TripAdvisor
                  </a>
                  <button
                    type="button"
                    onClick={openReview}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border border-amber-300/30 bg-amber-400/10 px-2 py-2.5 text-[11px] font-semibold text-amber-100 hover:bg-amber-400/20"
                  >
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    Nuestra reseña
                  </button>
                </div>
              )}
            </div>

            {p.photos.length > 0 && (
              <div className="mb-4 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="flex snap-x snap-mandatory gap-2">
                  {p.photos.slice(0, 10).map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block h-44 w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-white/15 md:h-56 md:w-80"
                    >
                      <img
                        src={src}
                        alt={`${p.name} - foto ${i + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                      />
                      <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                        {i + 1}/{Math.min(p.photos.length, 10)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4 grid grid-cols-2 gap-2">
              <a
                href={dirHref}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-3 text-black shadow-lg transition active:scale-95"
                style={{ background: cat.accent }}
              >
                <Car className="h-5 w-5" />
                <span className="text-[11px] font-bold">Cómo llegar</span>
              </a>
              {p.phone ? (
                <a
                  href={telHref}
                  className="flex flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-3 text-amber-950 shadow-lg transition active:scale-95"
                  aria-label={`Llamar a ${p.name}`}
                >
                  <Phone className="h-5 w-5" />
                  <span className="text-[11px] font-bold">Llamar</span>
                  <span className="font-mono text-[9px] opacity-80">
                    {p.phone}
                  </span>
                </a>
              ) : (
                <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] text-[11px] text-white/40">
                  Sin teléfono
                </div>
              )}
            </div>

            <div className="mb-4 space-y-2 rounded-2xl border border-white/15 bg-white/[0.04] p-3 backdrop-blur-xl">
              {p.address && (
                <Row icon={MapPin} label="Dirección" accent={cat.accent}>
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-white underline-offset-2 hover:underline"
                  >
                    {p.address}
                  </a>
                </Row>
              )}
              {p.phone && (
                <Row icon={Phone} label="Teléfono" accent={cat.accent}>
                  <a href={telHref} className="font-mono text-white">
                    {p.phone}
                  </a>
                </Row>
              )}
              {p.website && (
                <Row icon={Globe} label="Web" accent={cat.accent}>
                  <a
                    href={p.website}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-white underline-offset-2 hover:underline"
                  >
                    {p.website}
                  </a>
                </Row>
              )}
              {hoursList.length > 0 && (
                <Row icon={Clock} label="Horario" accent={cat.accent}>
                  <ul className="space-y-0.5 text-[12px] text-white/90">
                    {hoursList.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </Row>
              )}
            </div>

            {p.lat != null && p.lng != null && (
              <div className="mb-4">
                <Suspense
                  fallback={
                    <div className="h-56 rounded-2xl border border-white/10 bg-white/[0.04]" />
                  }
                >
                  <PlaceLocationMap
                    lat={p.lat}
                    lng={p.lng}
                    name={p.name}
                    address={p.address}
                  />
                </Suspense>
              </div>
            )}
          </>
        )}
      </div>

      {reviewOpen && p && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setReviewOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setReviewOpen(false)}
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-slate-300 hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/15 text-amber-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-amber-100">Nuestra reseña</h3>
                <p className="text-[11px] text-slate-400">{p.name}</p>
              </div>
            </div>
            <div className="min-h-[8rem] text-sm leading-relaxed text-slate-200">
              {reviewLoading && (
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Pensando en {p.name}…
                </div>
              )}
              {reviewErr && !reviewLoading && (
                <p className="text-rose-300">No pudimos generar la reseña: {reviewErr}</p>
              )}
              {reviewText && !reviewLoading && (
                <p className="whitespace-pre-wrap">{reviewText}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  accent,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-[12px]">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: accent }} />
      <div className="min-w-0 flex-1">
        <p
          className="text-[9px] font-semibold uppercase tracking-widest"
          style={{ color: accent }}
        >
          {label}
        </p>
        <div className="text-white/90">{children}</div>
      </div>
    </div>
  );
}
