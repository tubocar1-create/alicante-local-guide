import { createFileRoute, Link, useServerFn } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bus, CalendarDays } from "lucide-react";
import { getAlsaSchedule, type AlsaScheduleItem } from "@/lib/alsa.functions";

type Search = { dir?: "S" | "L" };

const SLUG_META: Record<string, { from: string; to: string }> = {
  "alicante-madrid": { from: "Alicante", to: "Madrid" },
};

export const Route = createFileRoute("/buses_/alsa/$slug")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    dir: s.dir === "L" ? "L" : "S",
  }),
  head: ({ params }) => {
    const meta = SLUG_META[params.slug];
    const title = meta
      ? `Buses ${meta.from} ↔ ${meta.to} — 30 días`
      : "Buses ALSA";
    return {
      meta: [
        { title: title.slice(0, 60) },
        {
          name: "description",
          content: meta
            ? `Horarios de buses ALSA entre ${meta.from} y ${meta.to}. Próximos 30 días.`
            : "Horarios de ALSA.",
        },
      ],
    };
  },
  component: AlsaSchedulePage,
});

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fmtDate(iso: string) {
  const d = new Date(iso + "T12:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function durLabel(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function busColor(t: string | null): string {
  switch (t) {
    case "SUPRA": return "#f59e0b";
    case "DOBLE PISO": return "#8b5cf6";
    case "COMFORT": return "#06b6d4";
    default: return "#94a3b8";
  }
}

function AlsaSchedulePage() {
  const { slug } = Route.useParams();
  const { dir = "S" } = Route.useSearch();
  const meta = SLUG_META[slug];
  const fetchSchedule = useServerFn(getAlsaSchedule);

  const { data, isLoading, error } = useQuery({
    queryKey: ["alsa", slug, dir],
    queryFn: () => fetchSchedule({ data: { slug, direction: dir } }),
    staleTime: 10 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const firstDate = items[0]?.service_date;
  const lastDate = items[items.length - 1]?.service_date;

  // agrupar por fecha
  const groups: Array<{ date: string; items: AlsaScheduleItem[] }> = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.date === it.service_date) last.items.push(it);
    else groups.push({ date: it.service_date, items: [it] });
  }

  const titleFrom = dir === "S" ? meta?.from ?? "Alicante" : meta?.to ?? "Madrid";
  const titleTo = dir === "S" ? meta?.to ?? "Madrid" : meta?.from ?? "Alicante";

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
            to="/buses_/$code"
            params={{ code: "ALC-BUS" }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-sky-500/50 hover:text-sky-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </Link>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
            <Bus className="h-3 w-3" /> ALSA
          </span>
        </header>

        <div className="mb-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">
            {dir === "S" ? "Ficha de destino" : "Ficha de origen"}
          </p>
          <h1 className="mt-0.5 text-base font-semibold leading-tight md:text-lg">
            Buses ALSA {titleFrom} → {titleTo}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-sky-300">
            <CalendarDays className="h-3 w-3" />
            Próximos 30 días
            {firstDate && lastDate ? ` (${fmtDate(firstDate)} – ${fmtDate(lastDate)})` : ""}
          </p>
        </div>

        {/* Toggle dirección */}
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border-2 border-slate-700 bg-slate-900/60 p-1.5">
          <Link
            from={Route.fullPath}
            search={{ dir: "S" }}
            replace
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wider transition ${
              dir === "S"
                ? "bg-gradient-to-br from-sky-500/30 to-cyan-500/20 text-sky-100 ring-1 ring-sky-400/40"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            Salidas
            <span className="text-[9px] font-medium normal-case opacity-80">
              {meta?.from} → {meta?.to}
            </span>
          </Link>
          <Link
            from={Route.fullPath}
            search={{ dir: "L" }}
            replace
            className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 text-sm font-bold uppercase tracking-wider transition ${
              dir === "L"
                ? "bg-gradient-to-br from-sky-500/30 to-cyan-500/20 text-sky-100 ring-1 ring-sky-400/40"
                : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200"
            }`}
          >
            Llegadas
            <span className="text-[9px] font-medium normal-case opacity-80">
              {meta?.to} → {meta?.from}
            </span>
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500/20 text-[10px] font-bold text-sky-300">
              1
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">Servicios disponibles</h2>
              <p className="text-[10px] text-slate-500">
                {isLoading ? "Cargando horarios…" : `${items.length} servicios`}
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[11px] text-red-300">
              No se pudieron cargar los horarios. {(error as Error).message}
            </div>
          )}

          {!isLoading && !error && items.length === 0 && (
            <div className="rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-center text-[11px] text-slate-400">
              Sin servicios para esta ruta.
            </div>
          )}

          {groups.length > 0 && (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.date}>
                  <div className="sticky top-0 z-10 -mx-3 mb-2 flex items-end justify-between border-b border-sky-500/20 bg-slate-950/90 px-3 py-2 backdrop-blur md:-mx-0 md:px-0">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-sky-400/70">
                        {dir === "S" ? "Salidas" : "Llegadas"}
                      </p>
                      <h3 className="font-mono text-sm font-bold text-slate-100">
                        {fmtDate(g.date)}
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      {g.items.length} {g.items.length === 1 ? "bus" : "buses"}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {g.items.map((t) => {
                      const color = busColor(t.bus_type);
                      const label = t.bus_type ?? "ALSA";
                      return (
                        <div
                          key={t.id}
                          className="group relative block rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1.5 transition hover:border-sky-500/40 hover:bg-slate-900/70"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="shrink-0 w-16 text-center rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{ background: color + "1f", color }}
                            >
                              {label}
                            </span>

                            <div className="flex flex-col items-start">
                              <p className="font-mono text-base font-bold tabular-nums leading-none text-slate-100">
                                {t.departure_time}
                              </p>
                              <p className="mt-0.5 max-w-[7rem] truncate text-[8px] font-bold uppercase tracking-wider text-slate-500">
                                {t.origin_station}
                              </p>
                            </div>

                            <div className="flex flex-1 flex-col items-center min-w-0">
                              <span className="font-mono text-[9px] text-sky-400/80 leading-none">
                                {durLabel(t.duration_minutes)}
                              </span>
                              <div className="relative my-0.5 h-px w-full bg-gradient-to-r from-slate-700 via-sky-500/30 to-slate-700">
                                <span className="absolute -top-[2px] left-0 h-1 w-1 rounded-full border border-slate-700 bg-slate-900" />
                                <span className="absolute -top-[2px] right-0 h-1 w-1 rounded-full bg-sky-400" />
                              </div>
                              <span className="text-[8px] text-slate-600 leading-none">
                                {t.service_date}
                              </span>
                            </div>

                            <div className="flex flex-col items-end">
                              <p className="font-mono text-base font-bold tabular-nums leading-none text-slate-100">
                                {t.arrival_time}
                              </p>
                              <p className="mt-0.5 max-w-[7rem] truncate text-right text-[8px] font-bold uppercase tracking-wider text-slate-500">
                                {t.destination_station}
                              </p>
                            </div>
                          </div>
                          {t.observations.length > 0 && (
                            <p className="mt-1 truncate text-[9px] italic text-slate-500">
                              {t.observations.join(" · ")}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-2 text-center text-[10px] text-slate-500">
            Datos extraídos de alsa.com
            {data?.generatedAt && (
              <> · Snapshot del {new Date(data.generatedAt).toLocaleDateString("es-ES")}</>
            )}
          </p>
        </section>
      </div>
    </div>
  );
}
