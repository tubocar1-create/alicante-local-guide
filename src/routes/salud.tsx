import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

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
  search?: Record<string, string>;
  external?: string;
  bg: string;
  fg: string;
};

const PUBLIC_SYSTEM: Tile[] = [
  { emoji: "🏥", label: "Hospitales", sublabel: "Públicos y privados + ubicación", href: "/hospitales", bg: "oklch(0.94 0.06 25)", fg: "oklch(0.50 0.18 25)" },
  { emoji: "🏨", label: "Centros de salud", sublabel: "Atención primaria", href: "/sistema-sanitario", search: { cat: "primaria" }, bg: "oklch(0.94 0.07 145)", fg: "oklch(0.45 0.15 150)" },
  { emoji: "🩺", label: "Especialidades", sublabel: "Cardio, traumato, dermato…", href: "/sistema-sanitario", search: { cat: "especialidades" }, bg: "oklch(0.94 0.07 220)", fg: "oklch(0.48 0.16 230)" },
  { emoji: "🚑", label: "Urgencias", sublabel: "SAMU 112, PAC, hospitales", href: "/sistema-sanitario", search: { cat: "urgencias" }, bg: "oklch(0.93 0.10 28)", fg: "oklch(0.50 0.20 28)" },
  { emoji: "🧠", label: "Salud mental", sublabel: "USM y unidades especializadas", href: "/sistema-sanitario", search: { cat: "mental" }, bg: "oklch(0.93 0.07 290)", fg: "oklch(0.48 0.16 290)" },
  { emoji: "📋", label: "Administración SIP", sublabel: "Cita previa, tarjeta sanitaria", href: "/sistema-sanitario", search: { cat: "admin" }, bg: "oklch(0.94 0.05 80)", fg: "oklch(0.45 0.12 80)" },
];

const gm = (q: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q + " Alicante")}`;

const PRIVATE_AND_OTHERS: Tile[] = [
  { emoji: "💊", label: "Farmacias", sublabel: "Cercanas y de guardia", href: "/farmacias", bg: "oklch(0.94 0.10 145)", fg: "oklch(0.45 0.18 150)" },
  { emoji: "🏥", label: "Hospitales privados", sublabel: "Vithas, Quirón, HLA, IMED", external: gm("hospital privado"), bg: "oklch(0.94 0.07 340)", fg: "oklch(0.50 0.18 350)" },
  { emoji: "🦷", label: "Odontología", sublabel: "Dentistas y clínicas dentales", external: gm("clínica dental"), bg: "oklch(0.94 0.06 200)", fg: "oklch(0.45 0.14 210)" },
  { emoji: "👓", label: "Ópticas", sublabel: "Gafas, lentes, revisiones", external: gm("óptica"), bg: "oklch(0.94 0.07 250)", fg: "oklch(0.48 0.16 255)" },
  { emoji: "🤸", label: "Rehabilitación", sublabel: "Fisioterapia y recuperación", external: gm("fisioterapia rehabilitación"), bg: "oklch(0.94 0.08 60)", fg: "oklch(0.50 0.16 55)" },
  { emoji: "🧠", label: "Psicología", sublabel: "Consultas privadas", external: gm("psicólogo consulta"), bg: "oklch(0.94 0.06 300)", fg: "oklch(0.48 0.15 300)" },
  { emoji: "👨‍👩‍👧", label: "Terapia familiar", sublabel: "Pareja, familia, mediación", external: gm("terapia familiar pareja"), bg: "oklch(0.94 0.07 320)", fg: "oklch(0.48 0.16 320)" },
  { emoji: "👶", label: "Pediatría privada", sublabel: "Pediatras y clínicas infantiles", external: gm("pediatra privado"), bg: "oklch(0.94 0.08 40)", fg: "oklch(0.55 0.16 40)" },
  { emoji: "🤰", label: "Ginecología", sublabel: "Obstetricia y salud de la mujer", external: gm("ginecólogo clínica"), bg: "oklch(0.94 0.07 350)", fg: "oklch(0.50 0.17 355)" },
  { emoji: "💉", label: "Análisis clínicos", sublabel: "Laboratorios y extracciones", external: gm("laboratorio análisis clínicos"), bg: "oklch(0.94 0.05 180)", fg: "oklch(0.45 0.13 190)" },
  { emoji: "🩻", label: "Diagnóstico por imagen", sublabel: "Radiología, RMN, ecografías", external: gm("centro radiología imagen médica"), bg: "oklch(0.94 0.04 230)", fg: "oklch(0.45 0.12 235)" },
  { emoji: "🦻", label: "Audiología", sublabel: "Audífonos y otorrinos", external: gm("audífonos audiología"), bg: "oklch(0.94 0.05 100)", fg: "oklch(0.48 0.13 100)" },
  { emoji: "🥗", label: "Nutrición / Dietética", sublabel: "Dietistas-nutricionistas", external: gm("nutricionista dietista"), bg: "oklch(0.94 0.09 130)", fg: "oklch(0.48 0.16 135)" },
  { emoji: "💆", label: "Estética médica", sublabel: "Dermoestética y medicina estética", external: gm("medicina estética clínica"), bg: "oklch(0.94 0.07 15)", fg: "oklch(0.50 0.16 15)" },
  { emoji: "🦴", label: "Traumatología privada", sublabel: "Lesiones, cirugía ortopédica", external: gm("traumatólogo clínica"), bg: "oklch(0.94 0.05 50)", fg: "oklch(0.48 0.13 50)" },
  { emoji: "❤️", label: "Cardiología privada", sublabel: "Pruebas y consultas", external: gm("cardiólogo clínica"), bg: "oklch(0.93 0.10 25)", fg: "oklch(0.50 0.20 25)" },
  { emoji: "👁️", label: "Oftalmología", sublabel: "Cirugía ocular y revisiones", external: gm("oftalmólogo clínica"), bg: "oklch(0.94 0.06 240)", fg: "oklch(0.48 0.15 245)" },
  { emoji: "💉", label: "Vacunación", sublabel: "Centros de vacunación internacional", external: gm("vacunación internacional"), bg: "oklch(0.94 0.07 165)", fg: "oklch(0.48 0.15 170)" },
  { emoji: "🩸", label: "Donación de sangre", sublabel: "Centro de Transfusión CV", external: "https://www.donantescv.org/", bg: "oklch(0.92 0.12 25)", fg: "oklch(0.45 0.20 25)" },
  { emoji: "🐾", label: "Veterinarios", sublabel: "Clínicas y urgencias 24h", external: gm("veterinario clínica"), bg: "oklch(0.94 0.07 70)", fg: "oklch(0.48 0.15 70)" },
];

function TileButton({ t }: { t: Tile }) {
  const content = (
    <div className="group flex h-full w-44 flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl"
        style={{ backgroundColor: t.bg, color: t.fg }}
      >
        <span aria-hidden>{t.emoji}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight text-foreground">{t.label}</div>
        {t.sublabel ? (
          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.sublabel}</div>
        ) : null}
      </div>
    </div>
  );

  if (t.href) {
    return (
      <Link to={t.href} search={t.search as never} className="block shrink-0">
        {content}
      </Link>
    );
  }
  return (
    <a href={t.external} target="_blank" rel="noopener noreferrer" className="block shrink-0">
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
    <section
      className="space-y-3 rounded-3xl border border-border p-3"
      style={{ backgroundColor: accent }}
    >
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {kicker}
          </div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-card px-2 py-1 text-[10px] font-semibold text-muted-foreground">
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
    <main className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-4">
      <header className="flex items-center gap-2">
        <Link
          to="/"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-accent"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Salud en Alicante</h1>
          <p className="text-xs text-muted-foreground">
            Público y privado, desliza para explorar
          </p>
        </div>
      </header>

      <ScrollSection
        kicker="Público · SNS"
        title="Sistema sanitario público"
        description="Hospitales, centros de salud, urgencias y administración SIP"
        tiles={PUBLIC_SYSTEM}
        accent="oklch(0.96 0.04 150)"
      />
      <ScrollSection
        kicker="Privado · Otros"
        title="Farmacias y servicios privados"
        description="Clínicas, especialidades y profesionales en Alicante"
        tiles={PRIVATE_AND_OTHERS}
        accent="oklch(0.96 0.03 250)"
      />

      <p className="px-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
        Los enlaces externos abren búsquedas en Google Maps con resultados actualizados de
        clínicas y profesionales en Alicante. En caso de urgencia vital llama al{" "}
        <a href="tel:112" className="font-semibold text-foreground underline">112</a>.
      </p>
    </main>
  );
}
