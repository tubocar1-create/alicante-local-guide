import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Train } from "lucide-react";
import { STATIONS } from "./trenes";
import { getStationSchedule, type StationTrip } from "@/lib/trenes/snapshot-client";

type SearchParams = { dir?: "S" | "L" };

export const Route = createFileRoute("/trenes_/$code")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    dir: search.dir === "L" ? "L" : "S",
  }),
  head: ({ params }) => {
    const st = STATIONS.find((s) => s.code === params.code);
    const title = st
      ? `Trenes Alicante ↔ ${st.city} — 30 días`
      : "Trenes desde Alicante";
    return {
      meta: [
        { title: title.slice(0, 60) },
        {
          name: "description",
          content: st
            ? `Horarios reales de trenes entre Alicante-Terminal y ${st.station} (${st.city}). Próximos 30 días.`
            : "Horarios de trenes desde Alicante.",
        },
      ],
    };
  },
  component: TrenSchedule,
});

const OPERATOR_COLORS: Record<string, string> = {
  RENFE: "#a855f7",
  AVLO:  "#7c3aed",
  OUIGO: "#ec4899",
  IRYO:  "#ef4444",
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function TrenSchedule() {
  const { code } = Route.useParams();
  const { dir = "S" } = Route.useSearch();
  const st = STATIONS.find((s) => s.code === code);
  const [visible, setVisible] = useState(20);

  const { data, isLoading, error } = useQuery({
    queryKey: ["trenes", code, dir],
    queryFn: () => getStationSchedule(code, dir),
    enabled: !!st,
    staleTime: 5 * 60 * 1000,
  });

  if (!st) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
          Estación no encontrada.
        </div>
      </Shell>
    );
  }

  const trips: StationTrip[] = data?.trips ?? [];
  const firstDate = trips[0]?.date;
  const lastDate = trips[trips.length - 1]?.date;

  return (
    <Shell>
      <div className="mb-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-300/80">
          {dir === "S" ? "Ficha de destino" : "Ficha de origen"}
        </p>
        <h1 className="mt-0.5 text-base font-semibold leading-tight md:text-lg">
          {dir === "S"
            ? `Trenes desde Alicante-Terminal a ${st.city} (${st.station})`
            : `Trenes hacia Alicante-Terminal desde ${st.city} (${st.station})`}
        </h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fuchsia-300">
          <CalendarDays className="h-3 w-3" />
          Próximos 30 días{firstDate && lastDate
            ? ` (${fmtDate(firstDate)} – ${fmtDate(lastDate)})`
            : ""}
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-500/20 text-[10px] font-bold text-fuchsia-300">
            1
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">Trenes disponibles</h2>
            <p className="text-[10px] text-slate-500">
              {isLoading
                ? "Cargando horarios…"
                : `Ordenados por fecha y hora · ${trips.length} servicios`}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-300">
            No se pudieron cargar los horarios. {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && trips.length === 0 && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-center text-[11px] text-slate-400">
            Sin servicios para esta estación en los próximos 30 días.
            <br />
            <span className="text-slate-500">
              {data?.generatedAt
                ? `Snapshot del ${new Date(data.generatedAt).toLocaleDateString("es-ES")}`
                : "Snapshot GTFS aún no generado."}
            </span>
          </div>
        )}

        {trips.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto] gap-x-2 border-b border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[9px] uppercase tracking-wider text-slate-500">
              <span>Fecha</span>
              <span>Operador</span>
              <span>Tren</span>
              <span>Ruta</span>
              <span>Salida</span>
              <span>Llegada</span>
              <span>Duración</span>
            </div>
            <div className="divide-y divide-slate-800/60">
              {trips.slice(0, visible).map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[auto_auto_auto_auto_auto_auto_auto] items-center gap-x-2 px-2 py-1.5 text-[11px]"
                >
                  <span className="text-slate-300">{fmtDate(t.date)}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      background: (OPERATOR_COLORS[t.operator] ?? "#64748b") + "22",
                      color: OPERATOR_COLORS[t.operator] ?? "#94a3b8",
                    }}
                  >
                    {t.product}
                  </span>
                  <span className="font-mono text-[10px] text-slate-300">{t.number}</span>
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-300">
                    {t.origin} → {t.destination}
                  </span>
                  <span className="font-mono text-slate-200">{t.departure}</span>
                  <span className="font-mono text-slate-400">{t.arrival}</span>
                  <span className="font-mono text-slate-400">{t.durationLabel}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {trips.length > visible && (
          <button
            type="button"
            onClick={() => setVisible((n) => n + 20)}
            className="mt-2 w-full rounded-lg border border-fuchsia-400/30 bg-fuchsia-400/5 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-fuchsia-300 transition hover:bg-fuchsia-400/10"
          >
            Ver más ({Math.min(20, trips.length - visible)})
          </button>
        )}

        <p className="mt-2 text-center text-[10px] text-slate-500">
          GTFS oficial Renfe + reglas fijas OUIGO / IRYO.
          {data?.generatedAt && (
            <> · Snapshot del {new Date(data.generatedAt).toLocaleDateString("es-ES")}</>
          )}
        </p>
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain text-slate-100 lg:min-h-screen lg:h-auto lg:overflow-visible"
      style={{
        background: "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div className="relative mx-auto max-w-7xl px-3 pb-6 pt-3 md:px-6">
        <header className="mb-2 flex items-center justify-between">
          <Link
            to="/trenes"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-fuchsia-500/50 hover:text-fuchsia-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al listado
          </Link>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
            <Train className="h-3 w-3" /> Alicante-Terminal
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
