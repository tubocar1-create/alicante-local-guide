import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCartelera, type CarteleraTrain, type CarteleraResponse } from "@/lib/cartelera.functions";
import { Suspense, useEffect, useMemo, useState } from "react";
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
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const todayLabel = useMemo(() => {
    if (!mounted) return "";
    const d = new Date();
    return d.toLocaleDateString("es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, [mounted]);


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

  const updatedAgo = mounted
    ? Math.max(0, Math.round((Date.now() - new Date(data.generatedAt).getTime()) / 1000))
    : null;


  return (
    <div className="mx-auto max-w-3xl px-3 pb-2 pt-2 flex flex-col gap-2 h-[100dvh]">
      {/* Header */}
      <header className="flex items-center justify-between shrink-0">
        <Link
          to="/trenes"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Trenes
        </Link>
        <div className="text-right text-[10px] text-slate-500">
          Actualizado hace {updatedAgo}s
          <RefreshCw className="inline h-3 w-3 ml-1" />
        </div>
      </header>

      {/* Salidas ADIF */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-sky-300 bg-sky-100">
        <CardHeader
          icon={<Download className="h-4 w-4 text-sky-600 rotate-180" />}
          title={`Salidas programadas para ${todayLabel} (${data.raw.filter((r) => r.direction === "SALIDA").length})`}
          right={<HeaderClock />}
        />
        <RawAdifTable rows={data.raw.filter((r) => r.direction === "SALIDA")} kind="SALIDA" />
      </Card>

      {/* Llegadas ADIF */}
      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-amber-300 bg-amber-100">
        <CardHeader
          icon={<Download className="h-4 w-4 text-amber-600" />}
          title={`Llegadas programadas para ${todayLabel} (${data.raw.filter((r) => r.direction !== "SALIDA").length})`}
          right={<HeaderClock />}
        />
        <RawAdifTable rows={data.raw.filter((r) => r.direction !== "SALIDA")} kind="LLEGADA" />
      </Card>
    </div>
  );
}

// ---------- Subcomponents ----------

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${className || ""}`}>
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

function HeaderClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-bold tabular-nums text-white">
      <Clock className="h-3 w-3" />
      {hh}
    </div>
  );
}

function useNowHHMM() {
  const fmt = () =>
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  const [hhmm, setHhmm] = useState(fmt);
  useEffect(() => {
    const id = setInterval(() => setHhmm(fmt()), 30_000);
    return () => clearInterval(id);
  }, []);
  return hhmm;
}

function RawAdifTable({ rows, kind }: { rows: Array<Record<string, any>>; kind: "SALIDA" | "LLEGADA" }) {
  const nowHHMM = useNowHHMM();
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500 py-3">Sin datos.</p>;
  }

  const stripHtml = (s: any) =>
    typeof s === "string" ? s.replace(/<[^>]+>/g, "").trim() : "";

  const serviceBadge = (r: Record<string, any>) => {
    const tren = stripHtml(r.tren).toUpperCase();
    const op = stripHtml(r.trenDatosOp).toUpperCase();
    const tt = (r.trafficType || "").toLowerCase();
    const mC = tren.match(/^C\d+/);
    if (tt === "cercanias" || mC) return { code: mC ? mC[0] : "C", label: "CERCANÍAS", cls: "text-rose-600" };
    if (op.includes("OUIGO") || tren.includes("OUIGO")) return { code: tren, label: "OUIGO", cls: "text-pink-500" };
    if (op.includes("IRYO") || tren.includes("IRYO")) return { code: tren, label: "IRYO", cls: "text-red-500" };
    if (op.includes("AVLO") || tren.includes("AVLO")) return { code: tren, label: "AVLO", cls: "text-violet-500" };
    if (op.includes("AVE") || tren.includes("AVE")) return { code: tren, label: "AVE", cls: "text-violet-600" };
    if (op.includes("ALVIA")) return { code: tren, label: "ALVIA", cls: "text-violet-600" };
    if (op.includes("INTERCITY")) return { code: tren, label: "INTERCITY", cls: "text-blue-600" };
    if (op.includes("MD") || op.includes("MEDIA")) return { code: tren, label: "MD", cls: "text-slate-700" };
    return { code: tren, label: op || "MD", cls: "text-slate-700" };
  };

  const statusLabel = (mc: string) => {
    if (mc === "suppressed") return { txt: "Cancelado", cls: "text-rose-600" };
    if (mc === "audited") return { txt: "Modificado", cls: "text-amber-600" };
    if (mc === "delayed") return { txt: "Con retraso", cls: "text-amber-600" };
    return { txt: "En hora", cls: "text-emerald-600" };
  };

  // Operador efectivo: ADIF deja vacío trenDatosOp en cercanías → mostramos Renfe
  const effectiveOperator = (r: Record<string, any>, sbLabel: string) => {
    const raw = stripHtml(r.trenDatosOp);
    if (raw) return raw;
    if (sbLabel === "CERCANÍAS") return "Renfe";
    return "—";
  };

  // ¿Ya pasó pero ADIF aún no lo ha retirado? Aplica a salidas y llegadas en hora.
  const isDeparted = (r: Record<string, any>) => {
    if (r.markupColor === "suppressed") return false;
    const hora = (r.hora || "").trim();
    const horaEst = (r.horaEstado || "").trim();
    if (!hora) return false;
    if (horaEst && horaEst !== hora) return false;
    return hora < nowHHMM;
  };

  const destLabel = kind === "SALIDA" ? "Destino" : "Origen";

  return (
    <div className="overflow-x-auto overflow-y-auto -mx-3 px-3 flex-1 min-h-0">
      <table className="min-w-[860px] w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-700 border-b border-slate-400 bg-slate-300">

            <th className="px-2 py-2 font-semibold">Hora</th>
            <th className="px-2 py-2 font-semibold">Estado</th>
            <th className="px-2 py-2 font-semibold">{destLabel}</th>
            <th className="px-2 py-2 font-semibold">Tren</th>
            <th className="px-2 py-2 font-semibold">Servicio</th>
            <th className="px-2 py-2 font-semibold">Operador</th>
            <th className="px-2 py-2 font-semibold text-center">Vía</th>
            <th className="px-2 py-2 font-semibold">Observación</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const estacion = stripHtml(r.estacion);
            const hora = (r.hora || "").trim();
            const horaEst = (r.horaEstado || "").trim();
            const obs = (r.observation || "").trim() || "Directo";
            const via = (r.via || "").trim();
            const sb = serviceBadge(r);
            const st = statusLabel(r.markupColor);
            const cancelled = r.markupColor === "suppressed";
            const delayed = horaEst && horaEst !== hora;
            const departed = isDeparted(r);
            const op = effectiveOperator(r, sb.label);
            const zebra = i % 2 === 0 ? "bg-slate-100" : "bg-slate-200";
            const trainNum = stripHtml(r.tren).trim();
            const today = new Intl.DateTimeFormat("en-CA", {
              timeZone: "Europe/Madrid",
              year: "numeric", month: "2-digit", day: "2-digit",
            }).format(new Date());

            const rowMuted = departed ? "opacity-50" : "";
            const strike = cancelled || departed ? "line-through" : "";
            const timeColor = cancelled
              ? "text-slate-400"
              : departed
              ? "text-slate-500"
              : "text-slate-900";

            return (
              <tr
                key={i}
                className={`align-top transition ${zebra} ${rowMuted} ${trainNum ? "cursor-pointer hover:bg-slate-300/70" : ""}`}
                onClick={() => {
                  if (!trainNum) return;
                  window.location.href = `/trenes/ruta/${encodeURIComponent(trainNum)}?date=${today}&dir=${kind === "SALIDA" ? "S" : "L"}`;
                }}
              >
                <td className="px-2 py-1.5 tabular-nums leading-tight whitespace-nowrap">
                  <div className={`text-sm font-bold ${strike} ${timeColor}`}>
                    {hora || "—"}
                  </div>
                  {delayed && (
                    <div className="text-[11px] font-semibold text-amber-700">{horaEst}</div>
                  )}
                  {departed && !delayed && !cancelled && (
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500 no-underline">
                      {kind === "SALIDA" ? "Salido" : "Llegado"}
                    </div>
                  )}
                </td>
                <td className={`px-2 py-1.5 font-semibold whitespace-nowrap ${st.cls} ${strike}`}>{st.txt}</td>
                <td className={`px-2 py-1.5 font-semibold text-slate-900 ${strike}`}>{estacion || "—"}</td>
                <td className={`px-2 py-1.5 font-medium text-slate-900 tabular-nums whitespace-nowrap underline decoration-dotted ${strike}`}>{sb.code || "—"}</td>
                <td className={`px-2 py-1.5 font-bold tracking-wide whitespace-nowrap ${sb.cls} ${strike}`}>{sb.label}</td>
                <td className={`px-2 py-1.5 text-slate-600 whitespace-nowrap ${strike}`}>{op}</td>
                <td className={`px-2 py-1.5 text-center font-bold text-slate-700 tabular-nums ${strike}`}>{via || "—"}</td>
                <td className={`px-2 py-1.5 text-slate-600 max-w-[260px] truncate ${strike}`} title={obs}>{obs}</td>
              </tr>
            );
          })}
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
