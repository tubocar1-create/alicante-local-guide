import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Train } from "lucide-react";
import { STATIONS } from "./trenes";

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
  OUIGO: "#ec4899",
  IRYO:  "#ef4444",
};

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// ---------- Generador de horarios placeholder ----------
// Cuando se conecte GTFS, esta función se sustituye por la lectura real.
type TrainTrip = {
  id: string;
  date: Date;
  operator: "RENFE" | "OUIGO" | "IRYO";
  product: string;     // AVE, AVLO, OUIGO, IRYO, Intercity…
  trainNumber: string;
  departure: string;   // HH:MM
  arrival: string;     // HH:MM
  durationLabel: string;
  origin: string;
  destination: string;
};

function generatePlaceholderTrips(stationCode: string, dir: "S" | "L"): TrainTrip[] {
  const st = STATIONS.find((s) => s.code === stationCode);
  if (!st) return [];

  const baseSlots: Array<{ op: "RENFE" | "OUIGO" | "IRYO"; product: string; prefix: string; dep: string; durMin: number }> = [];
  if (st.operators.includes("RENFE")) {
    baseSlots.push(
      { op: "RENFE", product: "AVE",       prefix: "057", dep: "07:35", durMin: 140 },
      { op: "RENFE", product: "Intercity", prefix: "014", dep: "10:55", durMin: 245 },
      { op: "RENFE", product: "AVE",       prefix: "057", dep: "16:25", durMin: 135 },
      { op: "RENFE", product: "AVLO",      prefix: "061", dep: "19:10", durMin: 138 },
    );
  }
  if (st.operators.includes("OUIGO")) {
    baseSlots.push(
      { op: "OUIGO", product: "OUIGO", prefix: "OG", dep: "07:51", durMin: 145 },
      { op: "OUIGO", product: "OUIGO", prefix: "OG", dep: "18:00", durMin: 145 },
      { op: "OUIGO", product: "OUIGO", prefix: "OG", dep: "20:58", durMin: 145 },
    );
  }
  if (st.operators.includes("IRYO")) {
    baseSlots.push(
      { op: "IRYO", product: "IRYO", prefix: "IR", dep: "08:40", durMin: 142 },
      { op: "IRYO", product: "IRYO", prefix: "IR", dep: "17:30", durMin: 142 },
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const trips: TrainTrip[] = [];
  for (let day = 0; day < 30; day++) {
    const d = new Date(today);
    d.setDate(d.getDate() + day);
    baseSlots.forEach((slot, idx) => {
      // Variación leve: domingos menos servicios
      if (d.getDay() === 0 && idx % 2 === 1) return;
      const [h, m] = slot.dep.split(":").map(Number);
      const arrMin = h * 60 + m + slot.durMin;
      const ah = Math.floor((arrMin % 1440) / 60);
      const am = arrMin % 60;
      const arrival = `${String(ah).padStart(2, "0")}:${String(am).padStart(2, "0")}`;
      const dh = Math.floor(slot.durMin / 60);
      const dm = slot.durMin % 60;
      trips.push({
        id: `${slot.op}-${slot.prefix}${1000 + idx * 7}-${d.toISOString().slice(0, 10)}`,
        date: d,
        operator: slot.op,
        product: slot.product,
        trainNumber: `${slot.prefix}${1000 + idx * 7 + (day % 5)}`,
        departure: dir === "S" ? slot.dep : arrival,
        arrival: dir === "S" ? arrival : slot.dep,
        durationLabel: `${dh}h ${String(dm).padStart(2, "0")}m`,
        origin: dir === "S" ? "ALC" : st.code,
        destination: dir === "S" ? st.code : "ALC",
      });
    });
  }
  trips.sort((a, b) => a.date.getTime() - b.date.getTime() || a.departure.localeCompare(b.departure));
  return trips;
}

function fmtDate(d: Date) {
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function TrenSchedule() {
  const { code } = Route.useParams();
  const { dir = "S" } = Route.useSearch();
  const st = STATIONS.find((s) => s.code === code);
  const [visible, setVisible] = useState(20);

  const trips = useMemo(() => generatePlaceholderTrips(code, dir), [code, dir]);

  if (!st) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
          Estación no encontrada.
        </div>
      </Shell>
    );
  }

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
            ? ` (${firstDate.getDate()} ${MONTHS[firstDate.getMonth()]} – ${lastDate.getDate()} ${MONTHS[lastDate.getMonth()]})`
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
            <p className="text-[10px] text-slate-500">Ordenados por fecha y hora · {trips.length} servicios</p>
          </div>
        </div>

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
              <Link
                key={t.id}
                to="/trenes/viaje/$id"
                params={{ id: t.id }}
                search={{ dir }}
                className="grid cursor-pointer grid-cols-[auto_auto_auto_auto_auto_auto_auto] items-center gap-x-2 px-2 py-1.5 text-[11px] transition hover:bg-fuchsia-500/10"
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
                <span className="font-mono text-[10px] text-slate-300">{t.trainNumber}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-fuchsia-300">
                  {t.origin} → {t.destination}
                </span>
                <span className="font-mono text-slate-200">{t.departure}</span>
                <span className="font-mono text-slate-400">{t.arrival}</span>
                <span className="font-mono text-slate-400">{t.durationLabel}</span>
              </Link>
            ))}
          </div>
        </div>

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
          * Horarios provisionales. Se rellenarán con GTFS oficial de Renfe, OUIGO e IRYO.
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
