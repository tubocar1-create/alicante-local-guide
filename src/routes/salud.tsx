import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";

export const Route = createFileRoute("/salud")({
  head: () => ({
    meta: [
      { title: "Salud en Alicante — Dashboard sanitario completo" },
      {
        name: "description",
        content:
          "Acceso rápido a hospitales públicos y privados, centros de salud, urgencias, farmacias, odontología, ópticas, psicología y más servicios sanitarios en Alicante.",
      },
      { property: "og:title", content: "Salud en Alicante" },
      {
        property: "og:description",
        content: "Dashboard completo de servicios sanitarios y médicos en Alicante.",
      },
    ],
  }),
  component: SaludDashboard,
});

type Tile = {
  emoji: string;
  label: string;
  sublabel?: string;
  href?: string;
  external?: string;
  categoria?: string;
  accent: string; // hex
};

const PUBLIC_SYSTEM: Tile[] = [
  { emoji: "🏥", label: "Hospitales", sublabel: "Públicos + ficha técnica", href: "/hospitales", accent: "#34d399" },
  { emoji: "🏨", label: "Centros de salud", sublabel: "Atención primaria", categoria: "centros-salud", accent: "#10b981" },
  { emoji: "🩺", label: "Especialidades", sublabel: "Consultas externas", categoria: "especialidades", accent: "#38bdf8" },
  { emoji: "🚑", label: "Urgencias", sublabel: "SAMU 112, PAC, PAS, hospitales", categoria: "urgencias", accent: "#ef4444" },
  { emoji: "🧠", label: "Salud mental", sublabel: "USM y unidades especializadas", categoria: "salud-mental", accent: "#a78bfa" },
  { emoji: "📋", label: "Administración SIP", sublabel: "Cita previa, tarjeta sanitaria", categoria: "admin-sip", accent: "#eab308" },
];

const PRIVATE_AND_OTHERS: Tile[] = [
  { emoji: "💊", label: "Farmacias", sublabel: "Cercanas y de guardia", href: "/farmacias", accent: "#86efac" },
  { emoji: "🏥", label: "Hospitales privados", sublabel: "Vithas, Quirón, HLA, IMED", categoria: "hospitales-privados", accent: "#f472b6" },
  { emoji: "🦷", label: "Odontología", sublabel: "Dentistas y clínicas dentales", categoria: "odontologia", accent: "#22d3ee" },
  { emoji: "👓", label: "Ópticas", sublabel: "Gafas, lentes, revisiones", categoria: "opticas", accent: "#818cf8" },
  { emoji: "🤸", label: "Rehabilitación", sublabel: "Fisioterapia y recuperación", categoria: "rehabilitacion", accent: "#fb923c" },
  { emoji: "🧠", label: "Psicología", sublabel: "Consultas privadas", categoria: "psicologia", accent: "#c084fc" },
  { emoji: "👨‍👩‍👧", label: "Terapia familiar", sublabel: "Pareja, familia, mediación", categoria: "terapia-familiar", accent: "#f9a8d4" },
  { emoji: "👶", label: "Pediatría privada", sublabel: "Pediatras y clínicas infantiles", categoria: "pediatria-privada", accent: "#fbbf24" },
  { emoji: "🤰", label: "Ginecología", sublabel: "Obstetricia y salud de la mujer", categoria: "ginecologia", accent: "#fb7185" },
  { emoji: "💉", label: "Análisis clínicos", sublabel: "Laboratorios y extracciones", categoria: "analisis-clinicos", accent: "#5eead4" },
  { emoji: "🩻", label: "Diagnóstico por imagen", sublabel: "Radiología, RMN, ecografías", categoria: "diagnostico-imagen", accent: "#60a5fa" },
  { emoji: "🦻", label: "Audiología", sublabel: "Audífonos y otorrinos", categoria: "audiologia", accent: "#bef264" },
  { emoji: "🥗", label: "Nutrición y dietética", sublabel: "Dietistas-nutricionistas", categoria: "nutricion", accent: "#86efac" },
  { emoji: "💆", label: "Estética médica", sublabel: "Dermoestética y medicina estética", categoria: "estetica-medica", accent: "#f9a8d4" },
  { emoji: "🦴", label: "Traumatología privada", sublabel: "Lesiones, cirugía ortopédica", categoria: "traumatologia", accent: "#fbbf24" },
  { emoji: "❤️", label: "Cardiología privada", sublabel: "Pruebas y consultas", categoria: "cardiologia", accent: "#f87171" },
  { emoji: "👁️", label: "Oftalmología", sublabel: "Cirugía ocular y revisiones", categoria: "oftalmologia", accent: "#93c5fd" },
  { emoji: "💉", label: "Vacunación", sublabel: "Centros de vacunación internacional", categoria: "vacunacion", accent: "#2dd4bf" },
  { emoji: "🐾", label: "Veterinarios", sublabel: "Clínicas y urgencias 24h", categoria: "veterinarios", accent: "#fbbf24" },
];

function TileButton({ t }: { t: Tile }) {
  const content = (
    <div
      className="group flex h-full w-44 flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left backdrop-blur-xl transition-all hover:border-white/25 hover:bg-white/[0.07] active:scale-[0.98]"
      style={{ boxShadow: `0 6px 20px -12px ${t.accent}66` }}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-xl"
        style={{
          background: `${t.accent}22`,
          color: t.accent,
          border: `1px solid ${t.accent}55`,
        }}
      >
        <span aria-hidden>{t.emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight text-white">
          {t.label}
        </div>
        {t.sublabel ? (
          <div className="mt-0.5 line-clamp-2 text-[11px] text-white/55">
            {t.sublabel}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (t.categoria) {
    return (
      <Link
        to="/salud/$categoria"
        params={{ categoria: t.categoria }}
        className="block shrink-0"
      >
        {content}
      </Link>
    );
  }
  if (t.href) {
    return (
      <Link to={t.href} className="block shrink-0">
        {content}
      </Link>
    );
  }
  return (
    <a
      href={t.external}
      target="_blank"
      rel="noopener noreferrer"
      className="block shrink-0"
    >
      {content}
    </a>
  );
}

function ScrollSection({
  kicker,
  title,
  description,
  tiles,
  accent,
}: {
  kicker: string;
  title: string;
  description: string;
  tiles: Tile[];
  accent: string;
}) {
  return (
    <section className="space-y-3 rounded-3xl border border-white/10 bg-black/30 p-3 backdrop-blur-xl">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-[0.25em]"
            style={{ color: accent }}
          >
            {kicker}
          </div>
          <h2 className="mt-0.5 font-display text-lg font-bold text-white">
            {title}
          </h2>
          <p className="text-xs text-white/60">{description}</p>
        </div>
        <span
          className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-white/80"
          style={{ borderColor: `${accent}55`, color: accent }}
        >
          {tiles.length}
        </span>
      </div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        <div className="flex gap-2">
          {tiles.map((t) => (
            <TileButton key={t.label} t={t} />
          ))}
        </div>
      </div>
    </section>
  );
}

function SaludDashboard() {
  return (
    <div
      className="fixed inset-0 z-[60] lg:relative lg:inset-auto lg:z-auto lg:min-h-[60vh] overflow-y-auto text-white"
      style={{
        background:
          "linear-gradient(180deg, #0a1f1a 0%, #0c2340 50%, #07101f 100%)",
      }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-emerald-400/[0.10] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-sky-400/[0.08] blur-3xl" />
      </div>

      <main className="relative mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-5">
        <header className="mb-1 flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-white/60 transition hover:text-white"
          >
            ← Volver al inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-300">
              Live · ALC
            </span>
            <Link
              to="/"
              aria-label="Cerrar"
              className="ml-2 rounded-full border border-white/20 p-1.5 text-white/70 hover:border-white/40 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/90">
            Dashboard sanitario
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-white md:text-4xl">
            Salud{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-white to-sky-300 bg-clip-text text-transparent">
              en Alicante
            </span>
          </h1>
          <p className="mt-1 text-xs text-white/70 md:text-sm">
            Público y privado · desliza para explorar las categorías.
          </p>
        </div>

        <ScrollSection
          kicker="Público · SNS"
          title="Sistema sanitario público"
          description="Hospitales, centros de salud, urgencias y administración SIP"
          tiles={PUBLIC_SYSTEM}
          accent="#34d399"
        />
        <ScrollSection
          kicker="Privado · Otros"
          title="Farmacias y servicios privados"
          description="Clínicas, especialidades y profesionales en Alicante"
          tiles={PRIVATE_AND_OTHERS}
          accent="#f472b6"
        />

        <p className="px-1 pt-2 text-[11px] leading-relaxed text-white/55">
          Cada categoría abre un dashboard con fichas técnicas por centro. En
          caso de urgencia vital llama al{" "}
          <a href="tel:112" className="font-semibold text-white underline">
            112
          </a>
          .
        </p>
      </main>
    </div>
  );
}
