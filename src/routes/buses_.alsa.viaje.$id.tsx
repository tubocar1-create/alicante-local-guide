import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Bus, ExternalLink, X, MapPin, Clock, CalendarDays } from "lucide-react";
import { getAlsaScheduleItem, type AlsaScheduleItem, type AlsaScheduleResponse } from "@/lib/alsa.functions";

export const Route = createFileRoute("/buses_/alsa/viaje/$id")({
  head: () => ({
    meta: [
      { title: "Detalle del bus ALSA — Alicante" },
      { name: "description", content: "Detalle del servicio de bus ALSA, paradas intermedias y variantes." },
    ],
  }),
  component: BusDetail,
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

type StopKind = "origen" | "recogida" | "intermedia" | "destino";

function kindMeta(k: StopKind): { label: string; color: string } {
  switch (k) {
    case "origen":     return { label: "Origen",   color: "#34d399" };
    case "recogida":   return { label: "Recogida", color: "#38bdf8" };
    case "intermedia": return { label: "Parada",   color: "#94a3b8" };
    case "destino":    return { label: "Destino",  color: "#f472b6" };
  }
}

function BusDetail() {
  const { id } = Route.useParams();
  const numId = Number(id);
  const fetchItem = useServerFn(getAlsaScheduleItem);

  const { data: item, isLoading, error } = useQuery({
    queryKey: ["alsa-item", numId],
    queryFn: () => fetchItem({ data: { id: numId } }),
    enabled: Number.isFinite(numId),
    staleTime: 10 * 60 * 1000,
  });

  const color = busColor(item?.bus_type ?? null);
  const label = item?.bus_type ?? "ALSA";
  const backHref = item ? `/buses/alsa/${item.route_slug}?dir=${item.direction}` : "/buses/ALC-BUS";

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
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-sky-500/50 hover:text-sky-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver
          </a>
          <a
            href={backHref}
            aria-label="Cerrar"
            className="rounded-full border border-slate-700 bg-slate-900/60 p-1.5 text-slate-400 hover:border-sky-500/50 hover:text-sky-300"
          >
            <X className="h-4 w-4" />
          </a>
        </header>

        {isLoading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
            Cargando servicio…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            No se pudo cargar el servicio. {(error as Error).message}
          </div>
        )}

        {!isLoading && !error && !item && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-400">
            Servicio no encontrado.
          </div>
        )}

        {item && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <span
                className="grid h-12 w-12 place-items-center rounded-2xl border"
                style={{ background: `${color}22`, borderColor: `${color}66` }}
              >
                <Bus className="h-6 w-6" style={{ color }} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-300/80">
                  Servicio ALSA · {item.direction === "S" ? "Salida" : "Llegada"}
                </p>
                <h1 className="truncate text-xl font-bold leading-tight">
                  {item.origin_station} → {item.destination_station}
                </h1>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-sky-300">
                  <CalendarDays className="h-3 w-3" />
                  {fmtDate(item.service_date)}
                </p>
              </div>
            </div>

            {/* Itinerario completo (incluye origen, paradas y destino) */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
                  <MapPin className="h-4 w-4 text-sky-400" />
                  Itinerario
                </h2>
                <div className="flex items-center gap-2 text-[11px] text-sky-300">
                  <Clock className="h-3 w-3" />
                  <span className="font-mono">{durLabel(item.duration_minutes)}</span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                    style={{ background: color + "1f", color }}
                  >
                    {label}
                  </span>
                </div>
              </div>
              {(() => {
                const itin = item.stops;
                return (
                  <ol className="relative ml-2 border-l border-slate-700/70 pl-4">
                    {itin.map((s, i: number) => {
                      const meta = kindMeta(s.kind as StopKind);
                      const isLast = i === itin.length - 1;
                      const emphasize = s.kind === "origen" || s.kind === "destino";
                      return (
                        <li key={`${s.time}-${s.name}-${i}`} className={isLast ? "" : "pb-3"}>
                          <span
                            className="absolute -left-[7px] grid h-3.5 w-3.5 place-items-center rounded-full ring-2 ring-slate-950"
                            style={{ background: meta.color }}
                          />
                          <div className="flex items-baseline gap-2">
                            <span
                              className={`font-mono tabular-nums text-slate-100 ${emphasize ? "text-lg font-bold" : "text-sm font-semibold"}`}
                            >
                              {s.time}
                            </span>
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                              style={{ background: meta.color + "22", color: meta.color }}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <p
                            className={`mt-0.5 leading-snug text-slate-200 ${emphasize ? "text-[13px] font-semibold" : "text-[12px]"}`}
                          >
                            {s.name}
                            {s.province && (
                              <span className="ml-1 text-[10px] uppercase tracking-wider text-slate-500">
                                · {s.province}
                              </span>
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ol>
                );
              })()}
              <p className="mt-3 border-t border-slate-800 pt-2 text-[11px] leading-relaxed text-slate-400">
                <span className="font-semibold text-emerald-300">Origen</span> y{" "}
                <span className="font-semibold text-pink-300">Destino</span> son las terminales.{" "}
                <span className="font-semibold text-sky-300">Recogida</span> = parada para subir al bus.
                Las paradas intermedias permiten bajarse durante el trayecto.
              </p>
            </div>



            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <a
                href="https://www.alsa.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow hover:bg-amber-400"
              >
                <Bus className="h-4 w-4" />
                ALSA
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(`ALSA ${item.origin_station} ${item.destination_station} ${item.service_date} ${item.departure_time}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-sky-400"
              >
                Buscar billete
                <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
