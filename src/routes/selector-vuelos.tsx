import { createFileRoute, Link } from "@tanstack/react-router";
import { X, ArrowRight, PlaneTakeoff, PlaneLanding, Sparkles, Globe, Wifi } from "lucide-react";
import vuelosAvionIcon from "@/assets/vuelos-avion.png";

const VIP_URL =
  "https://www.salasvip.com/?ref=zdbjzwya&utm_source=leopoldocadavid&utm_medium=affiliate";

const VIP_PHOTOS = [
  "https://www.viplounges.com/wp-content/uploads/2025/03/1420x500px-ALC-SalaVip-CostaBlanca.jpg",
  "https://www.viplounges.com/wp-content/uploads/2025/03/costa-blanca-vip-lounge.jpg",
  "https://www.viplounges.com/wp-content/uploads/2025/03/790x541px-ALC-SalaVip-CostaBlanca-1.jpg",
  "https://www.viplounges.com/wp-content/uploads/2025/03/790x541px-ALC-SalaVip-CostaBlanca-2.jpg",
  "https://www.viplounges.com/wp-content/uploads/2025/03/790x541px-ALC-SalaVip-CostaBlanca-3.jpg",
  "https://www.viplounges.com/wp-content/uploads/2025/03/790x541px-ALC-SalaVip-CostaBlanca-4.jpg",
  "https://www.viplounges.com/wp-content/uploads/2025/03/790x541px-ALC-SalaVip-CostaBlanca-5.jpg",
];

const GLOBELY_URL =
  "https://www.globely.com/?ref=zdbjzwyq&utm_source=leopoldocadavid&utm_medium=affiliate";

const GLOBELY_PHOTOS = [
  "https://www.globely.com/assets/home-animated-slider/place_1.webp",
  "https://www.globely.com/assets/home-animated-slider/place_2.webp",
  "https://www.globely.com/assets/home-animated-slider/place_3.webp",
  "https://www.globely.com/assets/home-animated-slider/place_4.webp",
  "https://www.globely.com/assets/images/globely-imagery-9-tourists.webp",
  "https://www.globely.com/assets/images/globely-imagery-6-nomads.webp",
  "https://www.globely.com/assets/images/globely-imagery-8-executives.webp",
  "https://www.globely.com/assets/images/globely-imagery-7-students.webp",
];

const ROAMIC_URL =
  "https://roamic.com/?ref=zdbjzwy5&utm_source=leopoldocadavid&utm_medium=affiliate";

const ROAMIC_PHOTOS = [
  "https://roamic.com/cdn/shop/files/roamic-hero_p.png?v=1779268534&width=717",
  "https://roamic.com/cdn/shop/files/roamic-hero.png?v=1779268824&width=500",
  "https://roamic.com/cdn/shop/files/Image_430x_36373837-f192-4b4b-9970-20935c757c92.webp?v=1766506730&width=492",
];


export const Route = createFileRoute("/selector-vuelos")({
  head: () => ({
    meta: [
      { title: "Vuelos en Alicante — Salidas y llegadas (ALC)" },
      {
        name: "description",
        content:
          "Elige si quieres ver los vuelos que salen desde Alicante o los que llegan al aeropuerto de Alicante-Elche (ALC).",
      },
      { property: "og:title", content: "Vuelos en Alicante (ALC)" },
      {
        property: "og:description",
        content: "Selecciona vuelos desde o hacia Alicante.",
      },
      { property: "og:url", content: "https://vamosalicante.com/selector-vuelos" },
    ],
    links: [{ rel: "canonical", href: "https://vamosalicante.com/selector-vuelos" }],
  }),
  component: SelectorVuelos,
});

type Sector = {
  to: string;
  search: { type: "S" | "L" };
  label: string;
  description: string;
  accent: string;
  accent2: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
};

const SECTORS: Sector[] = [
  {
    to: "/vuelos",
    search: { type: "S" },
    label: "Vuelos desde Alicante",
    description: "Salidas del aeropuerto ALC en vivo",
    accent: "#7dd3fc",
    accent2: "#38bdf8",
    Icon: PlaneTakeoff,
  },
  {
    to: "/vuelos",
    search: { type: "L" },
    label: "Vuelos hacia Alicante",
    description: "Llegadas al aeropuerto ALC en vivo",
    accent: "#f0abfc",
    accent2: "#c026d3",
    Icon: PlaneLanding,
  },
];

function SelectorVuelos() {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] text-white"
      style={{
        background:
          "linear-gradient(180deg, #0a1428 0%, #0f2547 50%, #060b1c 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-sky-400/[0.10] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-indigo-400/[0.10] blur-3xl" />
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 min-h-0 flex-col gap-3 overflow-y-auto px-3 pb-3 pt-2">
        <header className="flex shrink-0 items-center justify-between">
          <Link
            to="/"
            className="text-[10px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver al inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-sky-300">
              Live · ALC
            </span>
            <Link
              to="/"
              aria-label="Cerrar"
              className="ml-1 rounded-full border border-white/20 p-1 text-white/70 hover:border-white/40 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <div className="flex shrink-0 items-center gap-3 py-1">
          <img
            src={vuelosAvionIcon}
            alt=""
            className="h-12 w-12 shrink-0 drop-shadow-[0_4px_18px_rgba(125,211,252,0.45)]"
          />
          <h1 className="font-display text-[22px] font-bold leading-[1.1] tracking-tight text-white md:text-[34px]">
            Vuelos en{" "}
            <span className="bg-gradient-to-r from-sky-300 via-white to-indigo-300 bg-clip-text text-transparent">
              Alicante (ALC)
            </span>
          </h1>
        </div>

        <div className="grid shrink-0 grid-rows-2 gap-3" style={{ minHeight: "min(60vh, 480px)" }}>
          {SECTORS.map((s) => (
            <Link
              key={s.search.type}
              to={s.to}
              search={s.search}
              className="group relative block overflow-hidden rounded-2xl border-0"
            >
              <div
                className="absolute -inset-0.5 rounded-2xl opacity-60 blur-sm transition duration-500 group-hover:opacity-100"
                style={{
                  background: `linear-gradient(135deg, ${s.accent} 0%, ${s.accent2} 60%, ${s.accent} 100%)`,
                }}
              />
              <div className="relative flex h-full items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] px-4 py-3 backdrop-blur-xl transition-all group-hover:from-white/[0.12] group-hover:to-white/[0.05] active:scale-[0.98]">
                <div className="relative shrink-0">
                  <div
                    className="absolute inset-0 rounded-xl blur-md"
                    style={{ background: s.accent, opacity: 0.35 }}
                  />
                  <div
                    className="relative grid h-16 w-16 place-items-center rounded-2xl border"
                    style={{
                      background: `linear-gradient(135deg, ${s.accent}22, ${s.accent2}22)`,
                      borderColor: `${s.accent}88`,
                      boxShadow: `0 0 20px -4px ${s.accent}66`,
                    }}
                  >
                    <s.Icon
                      className="h-9 w-9 transition-transform duration-500 group-hover:scale-110"
                      strokeWidth={2.4}
                      style={{ color: "#ffffff" }}
                    />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-70" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-300" />
                    </span>
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.2em]"
                      style={{ color: s.accent }}
                    >
                      En vivo
                    </span>
                  </div>
                  <div className="text-[20px] font-bold leading-tight tracking-tight text-white md:text-[22px]">
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-white/60">
                    {s.description}
                  </div>
                </div>

                <div className="shrink-0">
                  <div className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.05] transition-all duration-500 group-hover:border-white/25 group-hover:bg-white/[0.10]">
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-0.5"
                      style={{ color: s.accent }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <section className="mt-2 shrink-0 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-500/[0.08] via-white/[0.03] to-amber-200/[0.05] p-2.5 backdrop-blur-xl">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-300" />
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-amber-200/90">
                Experiencia VIP · ALC
              </span>
            </div>
            <span className="text-[9px] text-amber-200/60">Toca una foto →</span>
          </div>
          <div className="-mx-2.5 overflow-x-auto px-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex snap-x snap-mandatory gap-2 pb-0.5">
              {VIP_PHOTOS.map((src, i) => (
                <a
                  key={src}
                  href={VIP_URL}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="group relative block shrink-0 snap-start overflow-hidden rounded-xl border border-amber-300/30"
                  style={{ width: 200, aspectRatio: "16/9" }}
                >
                  <img
                    src={src}
                    alt={`Costa Blanca VIP Lounge · Aeropuerto Alicante-Elche (foto ${i + 1})`}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                      <span className="text-[11px] font-bold leading-tight text-white">
                        Disfruta una experiencia VIP, en el Aeropuerto Alicante-Elche
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-300 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

      </main>

    </div>
  );
}
