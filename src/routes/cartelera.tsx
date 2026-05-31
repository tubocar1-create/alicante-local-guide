import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCartelera, type CarteleraTrain, type CarteleraResponse } from "@/lib/cartelera.functions";
import { Suspense, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Train,
  Download,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

export const Route = createFileRoute("/cartelera")({
  head: () => ({
    meta: [
      { title: "Cartelera tiempo real · Alicante Terminal · ADIF" },
      {
        name: "description",
        content:
          "Salidas, llegadas e incidencias en tiempo real de Alicante Terminal. Datos ADIF.",
      },
    ],
  }),
  component: CarteleraPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6">
      <h1 className="text-xl font-semibold mb-2">No se pudo cargar la cartelera</h1>
      <p className="text-sm text-slate-500">{error.message}</p>
    </div>
  ),
});

function CarteleraPage() {
  return (
    <div className="h-[100dvh] overflow-y-auto overscroll-contain bg-slate-50 text-slate-900">
      <Suspense fallback={<Loading />}>
        <Board />
      </Suspense>
    </div>
  );
}

function Loading() {
  return <div className="p-6 text-sm text-slate-500">Cargando ADIF…</div>;
}

const carteleraOpts = (fn: () => Promise<CarteleraResponse>) =>
  queryOptions({
    queryKey: ["cartelera", "alicante-terminal", "v2"],
    queryFn: fn,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

// ---------- Operator detection ----------
function detectOperator(t: CarteleraTrain): "AVE" | "AVLO" | "OUIGO" | "IRYO" | "CERCANIAS" | "MD" {
  const op = (t.operator || "").toUpperCase();
  const num = (t.trainNumber || "").toUpperCase();
  if (op.includes("OUIGO") || num.includes("OUIGO")) return "OUIGO";
  if (op.includes("IRYO") || num.includes("IRYO")) return "IRYO";
  if (op.includes("AVLO") || num.includes("AVLO")) return "AVLO";
  if (op.includes("CERCAN") || /^C\d/.test(num)) return "CERCANIAS";
  if (op.includes("AVE") || num.startsWith("AVE")) return "AVE";
  return "MD";
}

const OPERATOR_LABEL: Record<string, string> = {
  AVE: "AVE",
  AVLO: "AVLO",
  OUIGO: "OUIGO",
  IRYO: "IRYO",
  CERCANIAS: "Cercanías",
  MD: "MD",
};

const OPERATOR_COLOR: Record<string, string> = {
  AVE: "text-purple-700",
  AVLO: "text-fuchsia-600",
  OUIGO: "text-pink-500",
  IRYO: "text-red-500",
  CERCANIAS: "text-rose-600",
  MD: "text-slate-600",
};

function Board() {
  const fetchFn = useServerFn(getCartelera);
  const { data } = useSuspenseQuery(carteleraOpts(() => fetchFn({}) as Promise<CarteleraResponse>));
  const [filter, setFilter] = useState<string>("TODAS");

  const all = useMemo(() => [...data.salidas, ...data.llegadas], [data]);

  // KPI counts
  const counts = useMemo(() => {
    let enHora = 0,
      retraso = 0,
      incidencia = 0;
    for (const t of all) {
      if (t.status === "RETRASO") retraso++;
      else if (t.status === "CANCELADO" || t.status === "CAMBIO") incidencia++;
      else if (t.status === "EN_HORA") enHora++;
    }
    const total = all.length || 1;
    return {
      enHora,
      retraso,
      incidencia,
      total: all.length,
      pctEnHora: Math.round((enHora / total) * 100),
      pctRetraso: Math.round((retraso / total) * 100),
      pctIncidencia: Math.round((incidencia / total) * 100),
    };
  }, [all]);

  const operatorsCount = useMemo(() => {
    const set = new Set<string>();
    for (const t of all) set.add(detectOperator(t));
    return set.size;
  }, [all]);


  const filteredSalidas = useMemo(() => {
    let list = data.salidas;
    if (filter !== "TODAS") list = list.filter((t) => detectOperator(t) === filter);
    return list;
  }, [data.salidas, filter]);

  const llegadas = data.llegadas;

  const updatedAgo = Math.max(
    0,
    Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 1000),
  );

  return (
    <div className="mx-auto max-w-3xl px-3 pb-10 pt-4 space-y-3">
      {/* Header */}
      <header className="flex items-center justify-between">
        <Link
          to="/trenes"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Trenes
        </Link>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          22°C Soleado
        </div>
      </header>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
          <Train className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold leading-tight text-slate-900">
            Alicante Terminal
          </h1>
          <p className="text-[11px] text-slate-500">
            Información en tiempo real · ADIF
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-500">
          Actualizado hace {updatedAgo}s
          <RefreshCw className="inline h-3 w-3 ml-1" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-2">
        <Kpi
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
          value={counts.enHora}
          label="En hora"
          accent="text-emerald-600"
          extra={`${counts.pctEnHora}%`}
        />
        <Kpi
          icon={<Clock className="h-4 w-4 text-amber-500" />}
          value={counts.retraso}
          label="Con retraso"
          accent="text-amber-600"
          extra={`${counts.pctRetraso}%`}
        />
        <Kpi
          icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
          value={counts.incidencia}
          label="Incidencia"
          accent="text-rose-600"
          extra={`${counts.pctIncidencia}%`}
        />
        <Kpi
          icon={<Train className="h-4 w-4 text-slate-500" />}
          value={counts.total}
          label="Trenes hoy"
          accent="text-slate-700"
          extra={`${operatorsCount} ops`}
        />
      </div>

      {/* Tabla CRUDA ADIF — todos los campos */}
      <Card>
        <CardHeader
          icon={<Train className="h-4 w-4 text-slate-500" />}
          title={`Datos crudos ADIF (${data.raw.length})`}
        />
        <RawAdifTable rows={data.raw} />
      </Card>


      {/* Próximas salidas */}
      <Card>
        <CardHeader
          icon={<Download className="h-4 w-4 text-sky-500 rotate-180" />}
          title="Próximas salidas"
          right={<span className="text-[11px] text-sky-600">Ver todas</span>}
        />

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {["TODAS", "AVE", "AVLO", "OUIGO", "IRYO", "CERCANIAS"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition ${
                filter === f
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
              }`}
            >
              {f === "TODAS" ? "Todas" : OPERATOR_LABEL[f] ?? f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-3 px-3">
          <div className="min-w-[520px]">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 grid grid-cols-[60px_1fr_90px_36px_70px_14px] gap-2 px-1 py-1 border-b border-slate-100">
              <span>Hora</span>
              <span>Destino</span>
              <span>Tren/Op.</span>
              <span className="text-center">Vía</span>
              <span>Estado</span>
              <span />
            </div>
            {filteredSalidas.length === 0 && (
              <p className="text-sm text-slate-500 py-4 text-center">Sin trenes.</p>
            )}
            <ul>
              {filteredSalidas.map((t, i) => (
                <TrainRow key={i} t={t} kind="SALIDA" />
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Próximas llegadas */}
      <Card>
        <CardHeader
          icon={<Download className="h-4 w-4 text-emerald-500" />}
          title="Próximas llegadas"
        />
        {llegadas.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">Sin datos.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {llegadas.map((t, i) => (
              <LlegadaRow key={i} t={t} />
            ))}
          </ul>
        )}
      </Card>

      <p className="text-center text-[10px] text-slate-400 pt-2">
        Los horarios son estimados y pueden cambiar. Consulta antes de viajar.
      </p>
    </div>
  );
}

// ---------- Subcomponents ----------

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {children}
    </section>
  );
}

function CardHeader({
  icon,
  title,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        {icon}
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

function Kpi({
  icon,
  value,
  label,
  accent,
  extra,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
  extra: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="h-7 w-7 rounded-full bg-slate-50 flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xl font-bold text-slate-900 tabular-nums">
          {value}
        </span>
      </div>
      <div className="mt-1 text-[10px] font-medium text-slate-600 leading-tight">
        {label}
      </div>
      <div className={`text-[10px] font-semibold ${accent}`}>{extra}</div>
    </div>
  );
}

function RawAdifTable({ rows }: { rows: Array<Record<string, any>> }) {
  const columns = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) for (const k of Object.keys(r)) set.add(k);
    // Stable order: direction & trafficType first, then alphabetical
    const rest = [...set].filter((k) => k !== "direction" && k !== "trafficType").sort();
    return ["direction", "trafficType", ...rest];
  }, [rows]);

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-3">Sin datos crudos.</p>;
  }

  return (
    <div className="overflow-x-auto -mx-3 px-3">
      <table className="min-w-full text-[11px] border-collapse">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
            {columns.map((c) => (
              <th key={c} className="px-2 py-1.5 font-semibold whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 align-top hover:bg-slate-50">
              {columns.map((c) => {
                const v = r[c];
                const str =
                  v == null
                    ? ""
                    : typeof v === "object"
                    ? JSON.stringify(v)
                    : String(v);
                return (
                  <td
                    key={c}
                    className="px-2 py-1.5 whitespace-nowrap max-w-[260px] overflow-hidden text-ellipsis font-mono text-slate-700"
                    title={str}
                    dangerouslySetInnerHTML={{ __html: str }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrainRow({ t, kind }: { t: CarteleraTrain; kind: "SALIDA" | "LLEGADA" }) {
  const opKey = detectOperator(t);
  const dest = kind === "SALIDA" ? t.destination : t.origin;
  const opColor = OPERATOR_COLOR[opKey];
  return (
    <li className="grid grid-cols-[60px_1fr_90px_36px_70px_14px] gap-2 items-center py-2 border-b border-slate-50 last:border-0">
      <div className="text-xs tabular-nums leading-tight">
        <div className="font-bold text-slate-900">{t.scheduled}</div>
        {t.estimated !== t.scheduled && (
          <div
            className={
              t.delayMin > 0 ? "text-amber-600 text-[11px]" : "text-emerald-600 text-[11px]"
            }
          >
            {t.estimated}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-900 truncate">{dest}</div>
        <div className="text-[11px] text-slate-500 truncate">
          {t.observation || (t.platform ? "Directo" : "Directo")}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-800 truncate">
          {t.trainNumber}
        </div>
        <div className={`text-[11px] font-semibold uppercase truncate ${opColor}`}>
          {OPERATOR_LABEL[opKey]}
        </div>
      </div>
      <div className="text-center text-sm font-bold text-slate-700 tabular-nums">
        {t.platform || "—"}
      </div>
      <StatusCell t={t} />
      <ChevronRight className="h-3 w-3 text-slate-300" />
    </li>
  );
}

function LlegadaRow({ t }: { t: CarteleraTrain }) {
  const opKey = detectOperator(t);
  return (
    <li className="grid grid-cols-[52px_1fr_60px_auto] gap-2 items-center py-2 text-xs">
      <div className="tabular-nums leading-tight">
        <div className="font-bold text-slate-900">{t.scheduled}</div>
        {t.estimated !== t.scheduled && (
          <div
            className={
              t.delayMin > 0 ? "text-amber-600 text-[11px]" : "text-emerald-600 text-[11px]"
            }
          >
            {t.estimated}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-slate-900 truncate">{t.origin}</div>
        <div className={`text-[10px] font-semibold uppercase truncate ${OPERATOR_COLOR[opKey]}`}>
          {OPERATOR_LABEL[opKey]} · {t.trainNumber}
        </div>
      </div>
      <div className="text-center font-bold text-slate-700">{t.platform || "—"}</div>
      <StatusCell t={t} compact />
    </li>
  );
}

function StatusCell({ t, compact }: { t: CarteleraTrain; compact?: boolean }) {
  if (t.status === "CANCELADO") {
    return (
      <div className={compact ? "text-[11px] font-bold text-rose-600" : "text-xs font-bold text-rose-600 leading-tight"}>
        Cancelado
      </div>
    );
  }
  if (t.status === "RETRASO") {
    return (
      <div className="leading-tight">
        <div className="text-xs font-bold text-amber-600">+{t.delayMin} min</div>
        {!compact && <div className="text-[10px] text-amber-600">Retraso</div>}
      </div>
    );
  }
  if (t.status === "CAMBIO") {
    return (
      <div className="text-[11px] font-semibold text-violet-600 leading-tight">
        Cambio vía
      </div>
    );
  }
  return (
    <div className="leading-tight flex items-center gap-1">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span className="text-xs font-semibold text-emerald-600">En hora</span>
    </div>
  );
}
