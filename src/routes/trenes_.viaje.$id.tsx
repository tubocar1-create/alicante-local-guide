import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Train, ExternalLink, X } from "lucide-react";
import { STATIONS } from "./trenes";

type SearchParams = { dir?: "S" | "L" };

export const Route = createFileRoute("/trenes_/viaje/$id")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    dir: search.dir === "L" ? "L" : "S",
  }),
  head: () => ({
    meta: [
      { title: "Detalle del viaje en tren — Alicante" },
      {
        name: "description",
        content: "Detalle de tu viaje en tren desde/hacia Alicante-Terminal.",
      },
    ],
  }),
  component: TripDetail,
});

// id pattern: "OPERATOR-PREFIXNNN-YYYY-MM-DD" (ver generador en trenes_.$code.tsx)
function parseId(id: string): {
  operator: string;
  trainNumber: string;
  date: Date | null;
} {
  const parts = id.split("-");
  if (parts.length < 5) return { operator: id, trainNumber: "—", date: null };
  const operator = parts[0];
  const trainNumber = parts[1];
  const dateStr = parts.slice(2).join("-");
  const date = new Date(dateStr);
  return { operator, trainNumber, date: isNaN(date.getTime()) ? null : date };
}

const OPERATOR_INFO: Record<string, { name: string; color: string; url: string }> = {
  RENFE: { name: "Renfe",  color: "#a855f7", url: "https://www.renfe.com" },
  OUIGO: { name: "OUIGO",  color: "#ec4899", url: "https://www.ouigo.com/es" },
  IRYO:  { name: "iryo",   color: "#ef4444", url: "https://iryo.eu" },
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function TripDetail() {
  const { id } = Route.useParams();
  const { dir = "S" } = Route.useSearch();
  const { operator, trainNumber, date } = parseId(id);
  const op = OPERATOR_INFO[operator] ?? { name: operator, color: "#64748b", url: "#" };

  // El código de la estación destino/origen no viene en el id; en la versión GTFS lo cargaremos del backend.
  // Por ahora dejamos placeholders y un selector visual.
  const station = STATIONS[0];

  const fechaStr = date
    ? `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
    : "—";

  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain text-slate-100 lg:min-h-screen lg:h-auto lg:overflow-visible"
      style={{
        background: "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="relative mx-auto max-w-2xl px-3 pb-10 pt-3 md:px-6">
        <header className="mb-3 flex items-center justify-between">
          <Link
            to="/trenes"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-fuchsia-500/50 hover:text-fuchsia-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </Link>
          <Link
            to="/trenes"
            aria-label="Cerrar"
            className="rounded-full border border-slate-700 bg-slate-900/60 p-1.5 text-slate-400 hover:border-fuchsia-500/50 hover:text-fuchsia-300"
          >
            <X className="h-4 w-4" />
          </Link>
        </header>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <div className="mb-4 flex items-center gap-3">
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl border"
              style={{
                background: `${op.color}22`,
                borderColor: `${op.color}66`,
              }}
            >
              <Train className="h-6 w-6" style={{ color: op.color }} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold leading-tight">
                {station.city}{" "}
                <span className="font-mono text-sm text-slate-400">({station.code})</span>
              </h1>
              <p className="text-xs text-slate-400">{station.station}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs">
            <Field label="Tren" value={trainNumber} mono />
            <Field
              label="Ruta"
              value={dir === "S" ? `ALC → ${station.code}` : `${station.code} → ALC`}
              accent="text-fuchsia-300"
              mono
            />
            <Field label="Fecha" value={fechaStr} bold />
            <Field label="Operador" value={op.name} accentColor={op.color} bold />
            <Field label="Salida" value="—:—" mono />
            <Field label="Llegada" value="—:—" mono />
            <Field label="Duración estimada" value="— h — m" />
            <Field label="Vía / Andén" value="—" />
          </div>

          <p className="mt-3 rounded-xl border border-slate-800 bg-slate-950/40 p-3 text-[12px] leading-relaxed text-slate-300">
            Los datos exactos de salida, llegada, duración, andén y precio se cargarán
            desde el GTFS oficial de {op.name} cuando conectemos el backend.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href={op.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow"
              style={{ background: op.color }}
            >
              <Train className="h-4 w-4" />
              {op.name}
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(`${op.name} ${trainNumber} Alicante ${station.city}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-400"
            >
              Buscar billete
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  bold,
  accent,
  accentColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
  accent?: string;
  accentColor?: string;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={[
          "mt-0.5",
          mono ? "font-mono" : "",
          bold ? "font-semibold" : "",
          accent ?? "text-slate-100",
        ].join(" ")}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
