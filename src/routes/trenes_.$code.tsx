import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
  RENFE: "#5cbdb9", // Ocean Deep teal
  AVLO:  "#2d8a9e", // Ocean Deep cyan
  OUIGO: "#ec4899", // brand pink
  IRYO:  "#ef4444", // brand red
};


const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

// "YYYY-MM-DD|HH:MM" en Europe/Madrid — clave estable por minuto.
function madridNowKey(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const p = fmt.formatToParts(new Date());
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  let hh = g("hour"); if (hh === "24") hh = "00";
  return `${g("year")}-${g("month")}-${g("day")}|${hh}:${g("minute")}`;
}

function filterFresh(list: StationTrip[], nowKey: string): StationTrip[] {
  const [nowDate, nowTime] = nowKey.split("|");
  return list.filter((t) => {
    if (t.date < nowDate) return false;
    if (t.date === nowDate && t.departure <= nowTime) return false;
    return true;
  });
}


function TrenSchedule() {
  const { code } = Route.useParams();
  const { dir = "S" } = Route.useSearch();
  const st = STATIONS.find((s) => s.code === code);
  

  const { data, isLoading, error } = useQuery({
    queryKey: ["trenes", "unfiltered-v2", code, dir],
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

  // Tick cada 30s para que el filtro por minutos descarte trenes ya partidos sin recargar.
  const [nowKey, setNowKey] = useState(() => madridNowKey());
  useEffect(() => {
    const id = setInterval(() => setNowKey(madridNowKey()), 30_000);
    return () => clearInterval(id);
  }, []);

  const allTrips: StationTrip[] = data?.trips ?? [];
  const trips = filterFresh(allTrips, nowKey);
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

        {trips.length > 0 && (() => {
          const shown = trips;
          // Group by date
          const groups: Array<{ date: string; items: StationTrip[] }> = [];
          for (const t of shown) {
            const last = groups[groups.length - 1];
            if (last && last.date === t.date) last.items.push(t);
            else groups.push({ date: t.date, items: [t] });
          }
          return (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.date}>
                  {/* Sticky day header */}
                  <div
                    className="sticky top-0 z-10 -mx-3 mb-2 flex items-end justify-between border-b border-cyan-500/20 bg-slate-950/90 px-3 py-2 backdrop-blur md:-mx-0 md:px-0"
                  >
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-400/70">
                        {dir === "S" ? "Salidas" : "Llegadas"}
                      </p>
                      <h3 className="font-mono text-sm font-bold text-slate-100">
                        {fmtDate(g.date)}
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {g.items.length} {g.items.length === 1 ? "tren" : "trenes"}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-1">
                    {g.items.map((t) => {
                      const opColor = OPERATOR_COLORS[t.operator] ?? "#5cbdb9";
                      return (
                        <div
                          key={t.id}
                          className="group relative rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 transition hover:border-cyan-500/40 hover:bg-slate-900/70"
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Operador */}
                            <span
                              className="shrink-0 w-14 text-center rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{ background: opColor + "1f", color: opColor }}
                            >
                              {t.product}
                            </span>


                            {/* Salida */}
                            <div className="flex flex-col items-start">
                              <p className="font-mono text-base font-bold tabular-nums leading-none text-slate-100">
                                {t.departure}
                              </p>
                              <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                                {t.origin}
                              </p>
                            </div>

                            {/* Línea tiempo */}
                            <div className="flex flex-1 flex-col items-center min-w-0">
                              <span className="font-mono text-[9px] text-cyan-400/80 leading-none">
                                {t.durationLabel}
                              </span>
                              <div className="relative my-0.5 h-px w-full bg-gradient-to-r from-slate-700 via-cyan-500/30 to-slate-700">
                                <span className="absolute -top-[2px] left-0 h-1 w-1 rounded-full border border-slate-700 bg-slate-900" />
                                <span className="absolute -top-[2px] right-0 h-1 w-1 rounded-full bg-cyan-400" />
                              </div>
                              <span className="text-[8px] text-slate-600 leading-none">
                                {t.date}
                              </span>
                            </div>

                            {/* Llegada */}
                            <div className="flex flex-col items-end">
                              <p className="font-mono text-base font-bold tabular-nums leading-none text-slate-100">
                                {t.arrival}
                              </p>
                              <p className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-500">
                                {t.destination}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              ))}
            </div>
          );
        })()}



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
