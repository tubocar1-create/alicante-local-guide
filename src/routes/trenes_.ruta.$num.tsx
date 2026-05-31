import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, X, Train, ExternalLink, MapPin } from "lucide-react";
import { getTrainRoute } from "@/lib/trenes/route-lookup";

type SearchParams = { date?: string; dir?: "S" | "L" };

export const Route = createFileRoute("/trenes_/ruta/$num")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    date: typeof search.date === "string" ? search.date : undefined,
    dir: search.dir === "L" ? "L" : "S",
  }),
  head: ({ params }) => ({
    meta: [
      { title: `Ruta del tren ${params.num} — Alicante`.slice(0, 60) },
      {
        name: "description",
        content: `Estaciones y horarios programados de la ruta del tren ${params.num} desde/hacia Alicante-Terminal.`,
      },
    ],
  }),
  component: TrainRoutePage,
});

const OPERATOR_INFO: Record<string, { name: string; color: string; url: string }> = {
  RENFE: { name: "Renfe", color: "#a855f7", url: "https://www.renfe.com" },
  AVLO:  { name: "AVLO",  color: "#22d3ee", url: "https://www.renfe.com/es/es/avlo" },
  OUIGO: { name: "OUIGO", color: "#ec4899", url: "https://www.ouigo.com/es" },
  IRYO:  { name: "iryo",  color: "#ef4444", url: "https://iryo.eu" },
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtFecha(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function todayISO() {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(d);
}

function TrainRoutePage() {
  const { num } = Route.useParams();
  const { date, dir = "S" } = Route.useSearch();
  const effectiveDate = date || todayISO();

  const { data, isLoading } = useQuery({
    queryKey: ["train-route", num, effectiveDate],
    queryFn: () => getTrainRoute(num, effectiveDate),
    staleTime: 10 * 60 * 1000,
  });

  const op = data ? OPERATOR_INFO[data.operator] : null;
  const fallbackOp = OPERATOR_INFO.RENFE;
  const opInfo = op ?? fallbackOp;

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

        <div
          className="overflow-hidden rounded-2xl border border-slate-700/60 bg-gradient-to-br from-[#1e2a44] via-[#243352] to-[#2d2a4a] p-5 shadow-2xl"
        >
          <div className="mb-4 flex items-center gap-3">
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl border"
              style={{ background: `${opInfo.color}22`, borderColor: `${opInfo.color}66` }}
            >
              <Train className="h-6 w-6" style={{ color: opInfo.color }} />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold leading-tight">
                {data ? data.toName : "Ruta del tren"}{" "}
                <span className="font-mono text-sm text-slate-400">({num})</span>
              </h1>
              <p className="text-xs text-slate-400">
                {data ? `${data.fromName} → ${data.toName}` : "Buscando recorrido…"}
              </p>
            </div>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-cyan-500/20 bg-slate-950/40 p-3 text-[12px] text-slate-200">
            <Field label="Tren" value={data?.number ?? num} mono />
            <Field
              label="Ruta"
              value={data ? `${shortName(data.fromName)} → ${shortName(data.toName)}` : "—"}
              accent="text-cyan-300"
              mono
            />
            <Field label="Fecha" value={fmtFecha(effectiveDate)} bold />
            <Field
              label="Operador"
              value={opInfo.name}
              accentColor={opInfo.color}
              bold
            />
            <Field label="Salida" value={data?.departure ?? "—:—"} mono />
            <Field label="Llegada" value={data?.arrival ?? "—:—"} mono />
            <div className="col-span-2">
              <p className="text-[9px] uppercase tracking-wider text-cyan-300/70">Duración estimada</p>
              <p className="mt-0.5 font-mono font-semibold text-white">{data?.durationLabel ?? "—"}</p>
            </div>
          </div>

          {/* Recorrido */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-950/30 p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
              <MapPin className="h-3 w-3" />
              Recorrido y horarios
            </div>

            {isLoading && (
              <p className="text-[12px] text-slate-400">Cargando paradas…</p>
            )}

            {!isLoading && (!data || data.stops.length === 0) && (
              <p className="text-[12px] text-slate-400">
                No tenemos el recorrido detallado para este tren. Consulta el horario oficial del operador.
              </p>
            )}

            {data && data.stops.length > 0 && (
              <ol className="relative space-y-0">
                {data.stops.map((s, i) => {
                  const isFirst = i === 0;
                  const isLast = i === data.stops.length - 1;
                  const time = isFirst ? s.dep : isLast ? s.arr : (s.arr || s.dep);
                  return (
                    <li key={i} className="relative flex items-start gap-3 py-1.5">
                      <div className="flex flex-col items-center pt-1">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            isFirst || isLast ? "bg-cyan-400" : "bg-slate-500"
                          }`}
                          style={isFirst || isLast ? { boxShadow: `0 0 0 3px ${opInfo.color}33` } : undefined}
                        />
                        {!isLast && <span className="mt-0.5 h-6 w-px bg-slate-700" />}
                      </div>
                      <div className="flex flex-1 items-baseline justify-between gap-3">
                        <span
                          className={`text-[12px] ${
                            isFirst || isLast ? "font-semibold text-white" : "text-slate-300"
                          }`}
                        >
                          {s.name}
                        </span>
                        <span className="font-mono text-[12px] font-bold tabular-nums text-cyan-200">
                          {time}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {(() => {
            const operator = data?.operator;
            const showRenfe = operator === "RENFE" || operator === "AVLO";
            const showOuigo = operator === "OUIGO";
            const showIryo  = operator === "IRYO";
            return (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {showRenfe && (
                  <a
                    href="https://www.renfe.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#7b1f9a] px-3 py-2 text-[11px] font-semibold text-white transition hover:opacity-90"
                  >
                    Renfe
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                )}
                {showOuigo && (
                  <a
                    href="https://www.ouigo.com/es"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#ec4899] px-3 py-2 text-[11px] font-semibold text-white transition hover:opacity-90"
                  >
                    OUIGO
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                )}
                {showIryo && (
                  <a
                    href="https://iryo.eu"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#ef4444] px-3 py-2 text-[11px] font-semibold text-white transition hover:opacity-90"
                  >
                    iryo
                    <ExternalLink className="h-3 w-3 opacity-70" />
                  </a>
                )}
                <a
                  href="https://www.trenes.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#3b82f6] px-3 py-2 text-[11px] font-semibold text-white transition hover:opacity-90"
                >
                  trenes.com
                  <ExternalLink className="h-3 w-3 opacity-70" />
                </a>
              </div>
            );
          })()}


        </div>
      </div>
    </div>
  );
}

function shortName(n: string) {
  // "Madrid Chamartín — Clara Campoamor" -> "Madrid Chamartín"
  return n.split(/[—-]/)[0].trim();
}

function Field({
  label, value, mono, bold, accent, accentColor,
}: {
  label: string; value: string; mono?: boolean; bold?: boolean; accent?: string; accentColor?: string;
}) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-cyan-300/70">{label}</p>
      <p
        className={[
          "mt-0.5",
          mono ? "font-mono" : "",
          bold ? "font-semibold" : "",
          accent ?? "text-white",
        ].join(" ")}
        style={accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </p>
    </div>
  );
}
