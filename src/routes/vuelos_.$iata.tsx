import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plane,
  Armchair,
  CalendarDays,
  TrendingUp,
  Bus,
  ArrowLeft,
} from "lucide-react";

// ---------- Tipos ----------
type Flight = {
  numVuelo: string;
  fecha: string; // dd/mm/yyyy
  horaProgramada: string;
  horaEstimada?: string;
  iataOtro: string;
  ciudad: string;
  compania?: string;
  iataCompania?: string;
};

// ---------- Datos compartidos (subset, autosuficiente) ----------
const COORDS: Record<string, [number, number]> = {
  ALC: [-0.56, 38.28],
  MAD: [-3.56, 40.49], BCN: [2.08, 41.3], PMI: [2.74, 39.55], TFN: [-16.34, 28.48],
  TFS: [-16.57, 28.04], LPA: [-15.39, 27.93], BIO: [-2.91, 43.3], SCQ: [-8.41, 42.9],
  VGO: [-8.62, 42.23], SVQ: [-5.89, 37.42], AGP: [-4.49, 36.67], IBZ: [1.37, 38.87],
  MAH: [4.22, 39.86], LCG: [-8.37, 43.3], OVD: [-6.03, 43.56], VLL: [-4.85, 41.7],
  MLN: [-2.95, 35.28], GRX: [-3.78, 37.19], XRY: [-6.06, 36.74],
  STN: [0.23, 51.88], LGW: [-0.19, 51.15], LTN: [-0.37, 51.87], LHR: [-0.45, 51.47],
  LCY: [0.05, 51.5], MAN: [-2.27, 53.35], BHX: [-1.74, 52.45], LBA: [-1.66, 53.87],
  EDI: [-3.37, 55.95], GLA: [-4.43, 55.87], NCL: [-1.69, 55.04], LPL: [-2.85, 53.33],
  BRS: [-2.72, 51.38], EMA: [-1.33, 52.83], BFS: [-6.21, 54.66], SNN: [-8.92, 52.7],
  DUB: [-6.27, 53.42], ORK: [-8.49, 51.84], LDY: [-7.16, 55.04], BOH: [-1.84, 50.78],
  EXT: [-3.42, 50.73], NWI: [1.28, 52.67], CWL: [-3.34, 51.4],
  CDG: [2.55, 49.01], ORY: [2.36, 48.72], BVA: [2.11, 49.45], NCE: [7.21, 43.66],
  LYS: [5.08, 45.72], MRS: [5.22, 43.43], TLS: [1.36, 43.63], NTE: [-1.61, 47.15],
  BOD: [-0.71, 44.83], BIQ: [-1.52, 43.47],
  BRU: [4.48, 50.9], CRL: [4.45, 50.46], AMS: [4.76, 52.31], EIN: [5.37, 51.45],
  RTM: [4.43, 51.95], LUX: [6.21, 49.62],
  FRA: [8.55, 50.03], MUC: [11.78, 48.35], BER: [13.5, 52.36], DUS: [6.76, 51.28],
  HAM: [9.99, 53.63], CGN: [7.14, 50.87], STR: [9.22, 48.69], HHN: [7.27, 49.95],
  NRN: [6.14, 51.6], FMM: [10.24, 47.99],
  ZRH: [8.55, 47.46], GVA: [6.11, 46.23], BSL: [7.53, 47.59], VIE: [16.57, 48.11],
  SZG: [13.0, 47.79], INN: [11.34, 47.26],
  FCO: [12.25, 41.8], CIA: [12.6, 41.8], MXP: [8.72, 45.63], LIN: [9.28, 45.45],
  BGY: [9.7, 45.67], VCE: [12.35, 45.51], TSF: [12.19, 45.65], NAP: [14.29, 40.88],
  BLQ: [11.29, 44.53], PSA: [10.39, 43.69], TRN: [7.65, 45.2], CTA: [15.06, 37.47],
  PMO: [13.1, 38.18], BRI: [16.76, 41.14], CAG: [9.05, 39.25],
  LIS: [-9.13, 38.77], OPO: [-8.68, 41.24], FAO: [-7.97, 37.01], FNC: [-16.78, 32.69],
  CPH: [12.65, 55.62], OSL: [11.1, 60.19], TRF: [10.26, 59.18], ARN: [17.92, 59.65],
  GOT: [12.29, 57.67], BMA: [17.94, 59.35], NYO: [16.95, 58.79], HEL: [24.97, 60.32],
  BLL: [9.15, 55.74], AAL: [9.85, 57.09], BGO: [5.22, 60.29],
  WAW: [20.97, 52.17], WMI: [20.65, 52.45], KRK: [19.78, 50.08], GDN: [18.47, 54.38],
  WRO: [16.89, 51.1], POZ: [16.83, 52.42], PRG: [14.26, 50.1], BUD: [19.26, 47.43],
  OTP: [26.09, 44.57], SOF: [23.41, 42.7], ATH: [23.94, 37.94], SKG: [22.97, 40.52],
  RHO: [28.09, 36.41], HER: [25.18, 35.34], TIA: [19.72, 41.41], BEG: [20.31, 44.82],
  ZAG: [16.07, 45.74], LJU: [14.46, 46.22], TLL: [24.83, 59.41], RIX: [23.97, 56.92],
  VNO: [25.29, 54.64], KUN: [24.08, 54.96],
  RAK: [-8.03, 31.61], CMN: [-7.59, 33.37], TNG: [-5.92, 35.73], NDR: [-3.03, 35.15],
  AHU: [-5.36, 35.18], FEZ: [-4.97, 34.08], OUD: [-1.93, 34.78], TTU: [-5.32, 35.59],
  AGA: [-9.41, 30.32], MLA: [14.48, 35.86], LCA: [33.62, 34.88], PFO: [32.49, 34.72],
  TLV: [34.89, 32.01],
};

const IATA_COUNTRY: Record<string, string> = {
  MAD: "ES", BCN: "ES", PMI: "ES", TFN: "ES", TFS: "ES", LPA: "ES", BIO: "ES",
  SCQ: "ES", VGO: "ES", SVQ: "ES", AGP: "ES", IBZ: "ES", MAH: "ES", LCG: "ES",
  OVD: "ES", VLL: "ES", MLN: "ES", GRX: "ES", XRY: "ES",
  STN: "GB", LGW: "GB", LTN: "GB", LHR: "GB", LCY: "GB", MAN: "GB", BHX: "GB",
  LBA: "GB", EDI: "GB", GLA: "GB", NCL: "GB", LPL: "GB", BRS: "GB", EMA: "GB",
  BFS: "GB", BOH: "GB", EXT: "GB", NWI: "GB", CWL: "GB",
  SNN: "IE", DUB: "IE", ORK: "IE", LDY: "IE",
  CDG: "FR", ORY: "FR", BVA: "FR", NCE: "FR", LYS: "FR", MRS: "FR", TLS: "FR",
  NTE: "FR", BOD: "FR", BIQ: "FR",
  BRU: "BE", CRL: "BE",
  AMS: "NL", EIN: "NL", RTM: "NL", LUX: "LU",
  FRA: "DE", MUC: "DE", BER: "DE", DUS: "DE", HAM: "DE", CGN: "DE", STR: "DE",
  HHN: "DE", NRN: "DE", FMM: "DE",
  ZRH: "CH", GVA: "CH", BSL: "CH",
  VIE: "AT", SZG: "AT", INN: "AT",
  FCO: "IT", CIA: "IT", MXP: "IT", LIN: "IT", BGY: "IT", VCE: "IT", TSF: "IT",
  NAP: "IT", BLQ: "IT", PSA: "IT", TRN: "IT", CTA: "IT", PMO: "IT", BRI: "IT", CAG: "IT",
  LIS: "PT", OPO: "PT", FAO: "PT", FNC: "PT",
  CPH: "DK", BLL: "DK", AAL: "DK", OSL: "NO", TRF: "NO", BGO: "NO",
  ARN: "SE", GOT: "SE", BMA: "SE", NYO: "SE", HEL: "FI",
  WAW: "PL", WMI: "PL", KRK: "PL", GDN: "PL", WRO: "PL", POZ: "PL",
  PRG: "CZ", BUD: "HU", OTP: "RO", SOF: "BG",
  ATH: "GR", SKG: "GR", RHO: "GR", HER: "GR",
  TIA: "AL", BEG: "RS", ZAG: "HR", LJU: "SI",
  TLL: "EE", RIX: "LV", VNO: "LT", KUN: "LT",
  RAK: "MA", CMN: "MA", TNG: "MA", NDR: "MA", AHU: "MA", FEZ: "MA", OUD: "MA",
  TTU: "MA", AGA: "MA", MLA: "MT", LCA: "CY", PFO: "CY", TLV: "IL",
};

const COUNTRY_NAME: Record<string, string> = {
  ES: "España", GB: "Reino Unido", IE: "Irlanda", FR: "Francia", BE: "Bélgica",
  NL: "Países Bajos", LU: "Luxemburgo", DE: "Alemania", CH: "Suiza", AT: "Austria",
  IT: "Italia", PT: "Portugal", DK: "Dinamarca", NO: "Noruega", SE: "Suecia",
  FI: "Finlandia", PL: "Polonia", CZ: "Chequia", HU: "Hungría", RO: "Rumanía",
  BG: "Bulgaria", GR: "Grecia", AL: "Albania", RS: "Serbia", HR: "Croacia",
  SI: "Eslovenia", EE: "Estonia", LV: "Letonia", LT: "Lituania", MA: "Marruecos",
  MT: "Malta", CY: "Chipre", IL: "Israel",
};

const AIRLINE_NAMES: Record<string, string> = {
  FR: "Ryanair", VY: "Vueling", IB: "Iberia", I2: "Iberia Express", UX: "Air Europa",
  U2: "easyJet", EJU: "easyJet Europe", W6: "Wizz Air", HV: "Transavia", TO: "Transavia France",
  KL: "KLM", AF: "Air France", LH: "Lufthansa", EW: "Eurowings", BA: "British Airways",
  AY: "Finnair", SK: "SAS", DY: "Norwegian", TP: "TAP Portugal", AZ: "ITA Airways",
  LX: "Swiss", OS: "Austrian", TK: "Turkish Airlines", EI: "Aer Lingus", PC: "Pegasus",
  XQ: "SunExpress", XC: "Corendon", SU: "Aeroflot", LS: "Jet2.com", BY: "TUI",
  TB: "TUI fly", X3: "TUI fly Deutschland", QR: "Qatar Airways", DL: "Delta",
};

const AIRLINE_COLORS: Record<string, string> = {
  FR: "#FFD400", VY: "#FF6FB0", IB: "#E2261C", I2: "#E2261C", UX: "#9F2A6A",
  U2: "#FF6900", EJU: "#FF6900", W6: "#C6017E", HV: "#1F9CFF", TO: "#1F9CFF",
  KL: "#00A1DE", AF: "#0F2D5F", LH: "#FFCC00", EW: "#9B1E48", BA: "#1B3A6B",
  AY: "#0073CF", SK: "#003F87", DY: "#D81E27", TP: "#02916E", AZ: "#0F8A4A",
  LX: "#E10718", OS: "#CC0000", TK: "#C70A0C", EI: "#0F8A4A",
};
const PALETTE = ["#22D3EE", "#A78BFA", "#F472B6", "#34D399", "#FBBF24", "#F87171"];
function colorFor(code: string, idx: number) {
  return AIRLINE_COLORS[code] ?? PALETTE[idx % PALETTE.length];
}
function airlineName(code: string) {
  return AIRLINE_NAMES[code] ?? code;
}
function flagEmoji(iata: string) {
  const cc = IATA_COUNTRY[iata];
  if (!cc) return "🏳️";
  return String.fromCodePoint(
    ...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}
function cleanCity(raw: string) {
  return raw
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/(^|\s|-)([a-záéíóúñ])/g, (_, p, c) => p + c.toUpperCase());
}

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function estimateDuration(iata: string): { mins: number; label: string } {
  const dest = COORDS[iata];
  if (!dest) return { mins: 0, label: "—" };
  const km = haversineKm(COORDS.ALC, dest);
  // ~780 km/h promedio + 25 min taxi
  const mins = Math.round((km / 780) * 60 + 25);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { mins, label: `${h}h ${String(m).padStart(2, "0")}m` };
}

function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const total = h * 60 + m + mins;
  const hh = Math.floor((total % 1440) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseDate(d: string) {
  const [dd, mm, yyyy] = d.split("/").map((n) => parseInt(n, 10));
  return new Date(yyyy, mm - 1, dd);
}

const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const WEEKDAYS_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const WEEKDAYS_PRETTY = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ---------- Route ----------

export const Route = createFileRoute("/vuelos_/$iata")({
  head: ({ params }) => ({
    meta: [
      {
        title: `Vuelos · Alicante ↔ ${params.iata.toUpperCase()} · Dashboard`,
      },
    ],
  }),
  component: DestinationDashboard,
});

function DestinationDashboard() {
  const { iata } = Route.useParams();
  const code = iata.toUpperCase();
  const flightType =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("type") === "L"
      ? "L"
      : "S";
  const isArrival = flightType === "L";
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch(`/api/public/aena-flights?airport=ALC&type=${flightType}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        if (d.error) setError(d.error);
        setFlights((d.flights ?? []).filter((f: Flight) => f.iataOtro === code));
      })
      .catch((e) => !cancel && setError(String(e)))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, [code, flightType]);

  // Ventana semanal (7 días) desde hoy. Se recalcula cada día con los datos del backend.
  const window14 = useMemo(() => {
    if (!flights.length) return { start: null as Date | null, end: null as Date | null, flights: [] as Flight[] };
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return {
      start,
      end,
      flights: flights
        .filter((f) => {
          const d = parseDate(f.fecha);
          return d >= start && d < end;
        })
        .sort((a, b) => {
          const da = parseDate(a.fecha).getTime() - parseDate(b.fecha).getTime();
          if (da !== 0) return da;
          return a.horaProgramada.localeCompare(b.horaProgramada);
        }),
    };
  }, [flights]);

  const ciudad = useMemo(() => {
    const f = flights[0];
    return f ? cleanCity(f.ciudad) : code;
  }, [flights, code]);
  const pais = COUNTRY_NAME[IATA_COUNTRY[code] ?? ""] ?? "—";

  const window14Flights = window14.flights;
  const total = window14Flights.length;

  // Aerolíneas
  const airlinesAgg = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of window14Flights) {
      const c = f.iataCompania || "??";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [window14Flights]);

  // Días con vuelos / sin vuelos
  const daysSet = useMemo(() => new Set(window14Flights.map((f) => f.fecha)), [window14Flights]);
  const daysWith = daysSet.size;
  const avgPerDay = total > 0 ? total / 7 : 0;

  // Calendario 7 días
  const calendar = useMemo(() => {
    if (!window14.start) return [] as { date: Date; airlines: string[] }[];
    const out: { date: Date; airlines: string[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(window14.start);
      d.setDate(d.getDate() + i);
      const key = `${String(d.getDate()).padStart(2, "0")}/${String(
        d.getMonth() + 1,
      ).padStart(2, "0")}/${d.getFullYear()}`;
      const dayFlights = window14Flights.filter((f) => f.fecha === key);
      out.push({ date: d, airlines: dayFlights.map((f) => f.iataCompania || "??") });
    }
    return out;
  }, [window14, window14Flights]);
  const week1 = calendar;
  const daysWithoutList = calendar.filter((d) => d.airlines.length === 0);

  const dur = estimateDuration(code);

  // Donut
  const donut = useMemo(() => {
    const radius = 54;
    const inner = 34;
    const cx = 70;
    const cy = 70;
    const sum = airlinesAgg.reduce((s, [, n]) => s + n, 0) || 1;
    let acc = 0;
    return airlinesAgg.map(([airline, n], i) => {
      const start = (acc / sum) * Math.PI * 2 - Math.PI / 2;
      acc += n;
      const end = (acc / sum) * Math.PI * 2 - Math.PI / 2;
      const large = end - start > Math.PI ? 1 : 0;
      const x1 = cx + radius * Math.cos(start);
      const y1 = cy + radius * Math.sin(start);
      const x2 = cx + radius * Math.cos(end);
      const y2 = cy + radius * Math.sin(end);
      const xi2 = cx + inner * Math.cos(end);
      const yi2 = cy + inner * Math.sin(end);
      const xi1 = cx + inner * Math.cos(start);
      const yi1 = cy + inner * Math.sin(start);
      const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${inner} ${inner} 0 ${large} 0 ${xi1} ${yi1} Z`;
      return { d, color: colorFor(airline, i), airline, n, pct: Math.round((n / sum) * 100) };
    });
  }, [airlinesAgg]);


  if (loading) {
    return (
      <Shell>
        <div className="flex h-[60vh] items-center justify-center text-sm text-slate-500">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
        </div>
      </Shell>
    );
  }
  if (error || total === 0) {
    return (
      <Shell>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
          No hay vuelos directos disponibles desde Alicante a {code} en los próximos días.
        </div>
      </Shell>
    );
  }

  const startStr = window14.start
    ? `${window14.start.getDate()} ${MONTHS_LONG[window14.start.getMonth()]}`
    : "";
  const endDate = window14.end ? new Date(window14.end.getTime() - 86400000) : null;
  const endStr = endDate
    ? `${endDate.getDate()} ${MONTHS_LONG[endDate.getMonth()]} ${endDate.getFullYear()}`
    : "";

  return (
    <Shell>
      {/* HEADER + KPIs */}
      <div className="mb-2 grid gap-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div>
          <h1 className="text-base font-semibold leading-tight md:text-lg">
            Vuelos desde Alicante (ALC) a {ciudad} ({pais})
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-cyan-300">
            <CalendarDays className="h-3 w-3" />
            Semana ({startStr} – {endStr})
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Kpi icon={<Plane className="h-3.5 w-3.5" />} value={total} label="vuelos / 7d" />
          <Kpi icon={<Armchair className="h-3.5 w-3.5" />} value={airlinesAgg.length} label="aerolíneas / 7d" />
          <Kpi icon={<CalendarDays className="h-3.5 w-3.5" />} value={daysWith} label="días con vuelos" />
          <Kpi
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            value={avgPerDay.toFixed(1).replace(".", ",")}
            label="vuelos/día"
          />
        </div>
      </div>

      {/* TRES TARJETAS */}
      <div className="grid gap-2 lg:grid-cols-3">
        {/* 1. Resumen por aerolínea */}
        <Card index={1} title="Resumen por aerolínea" subtitle="Semana (7 días)">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <svg width="110" height="110" viewBox="0 0 140 140">
                {donut.map((s, i) => (
                  <path key={i} d={s.d} fill={s.color} />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-xl font-bold leading-none text-white">{total}</div>
                <div className="text-[8px] uppercase tracking-wider text-slate-400">vuelos / 7d</div>
              </div>
            </div>
            <div className="flex-1 text-xs">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-2 border-b border-slate-800 pb-1 text-[9px] uppercase tracking-wider text-slate-500">
                <span>Aerolínea</span>
                <span className="text-right">Vuelos</span>
                <span className="text-right">%</span>
              </div>
              <div className="mt-1 space-y-1">
                {airlinesAgg.map(([code, n], i) => {
                  const pct = Math.round((n / total) * 100);
                  return (
                    <div key={code} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="h-2 w-2 rounded-full" style={{ background: colorFor(code, i) }} />
                        <span className="truncate text-slate-200">{airlineName(code)}</span>
                      </div>
                      <span className="text-right font-mono text-slate-300">{n}</span>
                      <span className="text-right font-mono text-slate-500">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* 2. Calendario */}
        <Card index={2} title="Vuelos por día" subtitle="Distribución semanal (7 días)">
          <div className="grid grid-cols-7 gap-1 text-center text-[9px] uppercase tracking-wider text-slate-500">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <WeekRange week={week1} />
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px]">
            {airlinesAgg.map(([code, _n], i) => (
              <div key={code} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: colorFor(code, i) }} />
                <span className="text-slate-300">{airlineName(code)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-950/40 p-2 text-center">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Días con vuelos</div>
              <div className="font-mono text-base font-bold text-emerald-300">{daysWith}<span className="text-[10px] text-slate-500"> / 7</span></div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-slate-500">Días sin vuelos</div>
              <div className="font-mono text-base font-bold text-slate-300">{7 - daysWith}<span className="text-[10px] text-slate-500"> / 7</span></div>
            </div>
          </div>
          {daysWithoutList.length > 0 && daysWithoutList.length < 7 && (
            <p className="mt-2 text-center text-[10px] text-slate-500">
              ⓘ Los días sin vuelos directos son{" "}
              {daysWithoutList
                .map((d) => `${d.date.getDate()} ${MONTHS_LONG[d.date.getMonth()].slice(0, 3)}`)
                .join(", ")}
              .
            </p>
          )}
        </Card>

        {/* 3. Vuelos disponibles */}
        <Card index={3} title="Vuelos disponibles" subtitle="Ordenados por fecha y hora">
          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="grid grid-cols-[auto_auto_auto_auto_auto_auto] gap-x-2 border-b border-slate-800 bg-slate-950/60 px-2 py-1.5 text-[9px] uppercase tracking-wider text-slate-500">
              <span>Fecha</span>
              <span>Aerolínea</span>
              <span>Ruta</span>
              <span>Salida</span>
              <span>Llegada</span>
              <span>Duración</span>
            </div>
            <div className="max-h-[220px] divide-y divide-slate-800/60 overflow-y-auto">
              {window14Flights.map((f, i) => {
                const d = parseDate(f.fecha);
                const day = `${WEEKDAYS_PRETTY[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()].slice(0, 3)}`;
                const ac = f.iataCompania || "??";
                const llegada = addMinutes(f.horaProgramada, dur.mins);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[auto_auto_auto_auto_auto_auto] items-center gap-x-2 px-2 py-1.5 text-[11px]"
                  >
                    <span className="text-slate-300">{day}</span>
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                      style={{
                        background: colorFor(ac, airlinesAgg.findIndex(([c]) => c === ac)) + "22",
                        color: colorFor(ac, airlinesAgg.findIndex(([c]) => c === ac)),
                      }}
                    >
                      {airlineName(ac).split(" ")[0]}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                      {code}
                    </span>
                    <span className="font-mono text-slate-200">{f.horaProgramada}</span>
                    <span className="font-mono text-slate-400">{llegada}</span>
                    <span className="font-mono text-slate-400">{dur.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">
            * Llegada y duración estimadas. Datos de salida en tiempo real (AENA).
          </p>
        </Card>
      </div>

      <p className="mt-3 text-center text-[10px] text-slate-600">
        Fuente: AENA · Actualizado:{" "}
        {new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
      </p>
    </Shell>
  );
}

// ---------- UI atoms ----------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen text-slate-100"
      style={{
        background: "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
      }}
    >
      <div className="relative mx-auto max-w-7xl px-3 pb-6 pt-3 md:px-6">
        <header className="mb-2 flex items-center justify-between">
          <Link
            to="/vuelos"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] text-slate-300 transition hover:border-cyan-500/50 hover:text-cyan-300"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver al mapa
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}

function Kpi({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-cyan-300">
        {icon}
        <span className="font-mono text-sm font-bold text-white">{value}</span>
      </div>
      <div className="mt-0.5 text-[8px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function Card({
  index,
  title,
  subtitle,
  children,
}: {
  index: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 text-[10px] font-bold text-cyan-300">
          {index}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-[10px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function WeekRange({ week }: { week: { date: Date; airlines: string[] }[] }) {
  if (!week.length) return null;
  const first = week[0].date;
  const last = week[week.length - 1].date;
  return (
    <div className="mt-2">
      <div className="mb-1 text-center text-[10px] font-semibold text-cyan-300">
        {first.getDate()} {MONTHS[first.getMonth()]} – {last.getDate()} {MONTHS[last.getMonth()]}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {week.map((d, i) => (
          <div
            key={i}
            className="rounded-md border border-slate-800 bg-slate-950/40 p-1 text-center"
          >
            <div className="text-[8px] uppercase tracking-wider text-slate-500">
              {d.date.getDate()} {MONTHS[d.date.getMonth()]}
            </div>
            <div className="my-0.5 font-mono text-sm font-bold text-slate-100">
              {d.airlines.length || "—"}
            </div>
            <div className="flex flex-wrap justify-center gap-0.5">
              {d.airlines.map((a, j) => (
                <span
                  key={j}
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: colorFor(a, j) }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
