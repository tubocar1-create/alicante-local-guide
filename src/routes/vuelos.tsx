import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plane,
  Activity,
  Calendar,
  Building2,
  TrendingUp,
  Clock,
  MapPin,
  X,
  Sparkles,
  Globe2,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from "recharts";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export const Route = createFileRoute("/vuelos")({
  head: () => ({
    meta: [
      { title: "Conectividad aérea Alicante (ALC) — Smart Mobility" },
      {
        name: "description",
        content:
          "Dashboard inteligente de conectividad aérea desde el aeropuerto de Alicante-Elche. Vuelos, aerolíneas, frecuencia y patrones de los próximos 7 días.",
      },
    ],
  }),
  component: VuelosDashboard,
});

// ---------------- Types ----------------

type Flight = {
  numVuelo: string;
  fecha: string; // dd/mm/yyyy
  horaProgramada: string;
  iataOtro: string;
  ciudad: string;
  compania?: string;
  iataCompania?: string;
};

// ---------------- City coords (lon, lat) ----------------
// Basic atlas of common European/North-African IATA destinations from ALC.
const COORDS: Record<string, [number, number]> = {
  ALC: [-0.56, 38.28],
  // España
  MAD: [-3.56, 40.49], BCN: [2.08, 41.3], PMI: [2.74, 39.55], TFN: [-16.34, 28.48],
  TFS: [-16.57, 28.04], LPA: [-15.39, 27.93], BIO: [-2.91, 43.3], SCQ: [-8.41, 42.9],
  VGO: [-8.62, 42.23], SVQ: [-5.89, 37.42], AGP: [-4.49, 36.67], IBZ: [1.37, 38.87],
  MAH: [4.22, 39.86], LCG: [-8.37, 43.3], OVD: [-6.03, 43.56], VLL: [-4.85, 41.7],
  MLN: [-2.95, 35.28], GRX: [-3.78, 37.19], XRY: [-6.06, 36.74],
  // UK / Irlanda
  STN: [0.23, 51.88], LGW: [-0.19, 51.15], LTN: [-0.37, 51.87], LHR: [-0.45, 51.47],
  LCY: [0.05, 51.5], MAN: [-2.27, 53.35], BHX: [-1.74, 52.45], LBA: [-1.66, 53.87],
  EDI: [-3.37, 55.95], GLA: [-4.43, 55.87], NCL: [-1.69, 55.04], LPL: [-2.85, 53.33],
  BRS: [-2.72, 51.38], EMA: [-1.33, 52.83], BFS: [-6.21, 54.66], SNN: [-8.92, 52.7],
  DUB: [-6.27, 53.42], ORK: [-8.49, 51.84], LDY: [-7.16, 55.04], BOH: [-1.84, 50.78],
  EXT: [-3.42, 50.73], NWI: [1.28, 52.67], CWL: [-3.34, 51.4],
  // Francia
  CDG: [2.55, 49.01], ORY: [2.36, 48.72], BVA: [2.11, 49.45], NCE: [7.21, 43.66],
  LYS: [5.08, 45.72], MRS: [5.22, 43.43], TLS: [1.36, 43.63], NTE: [-1.61, 47.15],
  BOD: [-0.71, 44.83], BIQ: [-1.52, 43.47],
  // Bélgica / NL / Lux
  BRU: [4.48, 50.9], CRL: [4.45, 50.46], AMS: [4.76, 52.31], EIN: [5.37, 51.45],
  RTM: [4.43, 51.95], LUX: [6.21, 49.62],
  // Alemania
  FRA: [8.55, 50.03], MUC: [11.78, 48.35], BER: [13.5, 52.36], DUS: [6.76, 51.28],
  HAM: [9.99, 53.63], CGN: [7.14, 50.87], STR: [9.22, 48.69], HHN: [7.27, 49.95],
  NRN: [6.14, 51.6], FMM: [10.24, 47.99],
  // Suiza / Austria
  ZRH: [8.55, 47.46], GVA: [6.11, 46.23], BSL: [7.53, 47.59], VIE: [16.57, 48.11],
  SZG: [13.0, 47.79],
  // Italia
  FCO: [12.25, 41.8], CIA: [12.6, 41.8], MXP: [8.72, 45.63], LIN: [9.28, 45.45],
  BGY: [9.7, 45.67], VCE: [12.35, 45.51], TSF: [12.19, 45.65], NAP: [14.29, 40.88],
  BLQ: [11.29, 44.53], PSA: [10.39, 43.69], TRN: [7.65, 45.2], CTA: [15.06, 37.47],
  PMO: [13.1, 38.18], BRI: [16.76, 41.14], CAG: [9.05, 39.25],
  // Portugal
  LIS: [-9.13, 38.77], OPO: [-8.68, 41.24], FAO: [-7.97, 37.01], FNC: [-16.78, 32.69],
  // Escandinavia
  CPH: [12.65, 55.62], OSL: [11.1, 60.19], TRF: [10.26, 59.18], ARN: [17.92, 59.65],
  GOT: [12.29, 57.67], BMA: [17.94, 59.35], NYO: [16.95, 58.79], HEL: [24.97, 60.32],
  BLL: [9.15, 55.74], AAL: [9.85, 57.09], BGO: [5.22, 60.29],
  // Centro/Este Europa
  WAW: [20.97, 52.17], WMI: [20.65, 52.45], KRK: [19.78, 50.08], GDN: [18.47, 54.38],
  WRO: [16.89, 51.1], POZ: [16.83, 52.42], PRG: [14.26, 50.1], BUD: [19.26, 47.43],
  OTP: [26.09, 44.57], SOF: [23.41, 42.7], ATH: [23.94, 37.94], SKG: [22.97, 40.52],
  RHO: [28.09, 36.41], HER: [25.18, 35.34], TIA: [19.72, 41.41], BEG: [20.31, 44.82],
  ZAG: [16.07, 45.74], LJU: [14.46, 46.22], TLL: [24.83, 59.41], RIX: [23.97, 56.92],
  VNO: [25.29, 54.64], KUN: [24.08, 54.96],
  // Norte de África / Mediterráneo
  RAK: [-8.03, 31.61], CMN: [-7.59, 33.37], TNG: [-5.92, 35.73], NDR: [-3.03, 35.15],
  AHU: [-5.36, 35.18], FEZ: [-4.97, 34.08], OUD: [-1.93, 34.78], TTU: [-5.32, 35.59],
  AGA: [-9.41, 30.32], MLA: [14.48, 35.86], LCA: [33.62, 34.88], PFO: [32.49, 34.72],
  TLV: [34.89, 32.01],
  // Suiza extra / otros
  INN: [11.34, 47.26],
};

// Map projection — equirectangular tuned for Europe + Mediterráneo
const VIEW_W = 1000;
const VIEW_H = 720;
const LON_MIN = -12;
const LON_MAX = 36;
const LAT_MIN = 28;
const LAT_MAX = 62;

const PROJ = geoEquirectangular().fitExtent(
  [
    [0, 0],
    [VIEW_W, VIEW_H],
  ],
  {
    type: "Polygon",
    coordinates: [
      [
        [LON_MIN, LAT_MIN],
        [LON_MAX, LAT_MIN],
        [LON_MAX, LAT_MAX],
        [LON_MIN, LAT_MAX],
        [LON_MIN, LAT_MIN],
      ],
    ],
  } as Geometry,
);
const GEOPATH = geoPath(PROJ);

function project([lon, lat]: [number, number]): [number, number] {
  const p = PROJ([lon, lat]);
  return p ? [p[0], p[1]] : [0, 0];
}

// World inset projection (whole globe in tiny box)
const WORLD_W = 220;
const WORLD_H = 110;
const WORLD_PROJ = geoEquirectangular().fitExtent(
  [
    [0, 0],
    [WORLD_W, WORLD_H],
  ],
  {
    type: "Polygon",
    coordinates: [
      [
        [-180, -60],
        [180, -60],
        [180, 80],
        [-180, 80],
        [-180, -60],
      ],
    ],
  } as Geometry,
);
const WORLD_GEOPATH = geoPath(WORLD_PROJ);


// ---------------- Airline palette ----------------
const AIRLINE_COLORS: Record<string, string> = {
  FR: "#FFD400", // Ryanair
  VY: "#FF6FB0", // Vueling
  IB: "#E2261C", // Iberia
  I2: "#E2261C", // Iberia Express
  UX: "#9F2A6A", // Air Europa
  U2: "#FF6900", // easyJet
  EJU: "#FF6900",
  W6: "#C6017E", // Wizz
  HV: "#1F9CFF", // Transavia
  TO: "#1F9CFF", // Transavia France
  KL: "#00A1DE", // KLM
  AF: "#0F2D5F", // Air France
  LH: "#FFCC00", // Lufthansa
  EW: "#9B1E48", // Eurowings
  BA: "#1B3A6B", // British
  AY: "#0073CF", // Finnair
  SK: "#003F87", // SAS
  DY: "#D81E27", // Norwegian
  TP: "#02916E", // TAP
  AZ: "#0F8A4A", // ITA
  LX: "#E10718", // Swiss
  OS: "#CC0000", // Austrian
  TK: "#C70A0C", // Turkish
  EI: "#0F8A4A", // Aer Lingus
  WF: "#A4DDED",
  PC: "#FFD400",
  XQ: "#0099D8",
  XC: "#FF8C00",
  SU: "#0066B3",
};

const PALETTE_FALLBACK = [
  "#22D3EE", "#A78BFA", "#F472B6", "#34D399", "#FBBF24", "#F87171",
  "#60A5FA", "#FB923C", "#4ADE80", "#E879F9", "#2DD4BF", "#F59E0B",
];

function airlineColor(code: string | undefined, idx: number): string {
  if (code && AIRLINE_COLORS[code]) return AIRLINE_COLORS[code];
  return PALETTE_FALLBACK[idx % PALETTE_FALLBACK.length];
}

// ---------------- Helpers ----------------

function parseDate(d: string): Date {
  const [dd, mm, yyyy] = d.split("/").map((n) => parseInt(n, 10));
  return new Date(yyyy, mm - 1, dd);
}

const WEEKDAYS = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];

function inferFreqLabel(perDay: number): { label: string; cls: string } {
  if (perDay >= 1.5) return { label: "Casi diaria", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
  if (perDay >= 0.85) return { label: "Diaria", cls: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30" };
  if (perDay >= 0.4) return { label: "Alta", cls: "text-violet-300 bg-violet-500/10 border-violet-500/30" };
  if (perDay >= 0.2) return { label: "Media", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
  return { label: "Baja", cls: "text-slate-300 bg-slate-500/10 border-slate-500/30" };
}

// ---------------- Component ----------------

function VuelosDashboard() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/api/public/aena-flights?airport=ALC&type=S")
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        if (d.error) setError(d.error);
        setFlights(d.flights ?? []);
      })
      .catch((e) => !cancel && setError(String(e)))
      .finally(() => !cancel && setLoading(false));
    return () => {
      cancel = true;
    };
  }, []);

  // Filter to next 7 days from earliest available date
  const flights7d = useMemo(() => {
    if (!flights.length) return [];
    const dates = [...new Set(flights.map((f) => f.fecha))]
      .map(parseDate)
      .sort((a, b) => a.getTime() - b.getTime());
    if (!dates.length) return flights;
    const start = dates[0];
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return flights.filter((f) => {
      const d = parseDate(f.fecha);
      return d >= start && d < end;
    });
  }, [flights]);

  // Per-city aggregation
  const cities = useMemo(() => {
    const map = new Map<
      string,
      {
        iata: string;
        ciudad: string;
        total: number;
        airlines: Map<string, number>;
        days: Set<string>;
      }
    >();
    for (const f of flights7d) {
      const key = f.iataOtro;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          iata: key,
          ciudad: f.ciudad,
          total: 0,
          airlines: new Map(),
          days: new Set(),
        };
        map.set(key, entry);
      }
      entry.total += 1;
      entry.days.add(f.fecha);
      const a = f.iataCompania || "??";
      entry.airlines.set(a, (entry.airlines.get(a) ?? 0) + 1);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [flights7d]);

  // Airline aggregation
  const airlines = useMemo(() => {
    const map = new Map<
      string,
      { code: string; name: string; total: number; cities: Set<string> }
    >();
    for (const f of flights7d) {
      const code = f.iataCompania || "??";
      let entry = map.get(code);
      if (!entry) {
        entry = {
          code,
          name: f.compania || code,
          total: 0,
          cities: new Set(),
        };
        map.set(code, entry);
      }
      entry.total += 1;
      entry.cities.add(f.iataOtro);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [flights7d]);

  // Per-day aggregation
  const perDay = useMemo(() => {
    const map = new Map<string, { date: string; total: number; weekday: string }>();
    for (const f of flights7d) {
      let entry = map.get(f.fecha);
      if (!entry) {
        const d = parseDate(f.fecha);
        entry = { date: f.fecha, total: 0, weekday: WEEKDAYS[d.getDay()] };
        map.set(f.fecha, entry);
      }
      entry.total += 1;
    }
    return [...map.values()].sort(
      (a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime(),
    );
  }, [flights7d]);

  const dayCount = perDay.length || 1;
  const totalFlights = flights7d.length;
  const avgPerDay = totalFlights / dayCount;
  const destinationCount = cities.length;
  const airlineCount = airlines.length;

  // Filtered cities (when an airline is selected)
  const visibleCities = useMemo(() => {
    if (!selectedAirline) return cities;
    return cities.filter((c) => c.airlines.has(selectedAirline));
  }, [cities, selectedAirline]);

  const selectedCityData = selectedCity
    ? cities.find((c) => c.iata === selectedCity)
    : null;

  return (
    <div className="min-h-screen bg-[#040814] text-slate-100">
      {/* Background grid + glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,211,238,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,0.5) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-60 right-0 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="text-xs uppercase tracking-[0.2em] text-slate-400 hover:text-cyan-300"
          >
            ← Inicio
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/5 px-2.5 py-1 text-[10px] uppercase tracking-widest text-cyan-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            Live
          </div>
        </header>

        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/80">
            Aviation Intelligence
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-4xl">
            Conectividad aérea{" "}
            <span className="bg-gradient-to-r from-cyan-300 via-cyan-100 to-violet-300 bg-clip-text text-transparent">
              Alicante (ALC)
            </span>
          </h1>
          <p className="mt-1 text-xs text-slate-400 md:text-sm">
            Próximos 7 días
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-400">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
            Cargando programación…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-sm text-red-300">
            No hay datos de programación disponibles ahora mismo.
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Top metrics */}
            <section className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
              <MetricCard
                icon={<Plane className="h-3.5 w-3.5" />}
                label="Vuelos totales"
                value={totalFlights.toString()}
                accent="cyan"
              />
              <MetricCard
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Días con vuelos"
                value={`${dayCount}`}
                sub={`de 7`}
                accent="violet"
              />
              <MetricCard
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Aerolíneas"
                value={airlineCount.toString()}
                accent="emerald"
              />
              <MetricCard
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                label="Vuelos/día"
                value={avgPerDay.toFixed(1)}
                accent="amber"
              />
              <MetricCard
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Destinos"
                value={destinationCount.toString()}
                accent="pink"
              />
              <MetricCard
                icon={<Activity className="h-3.5 w-3.5" />}
                label="Cobertura"
                value={`${Math.round((dayCount / 7) * 100)}%`}
                sub="semanal"
                accent="cyan"
              />
            </section>

            {/* Map */}
            <section className="mb-6 overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950 to-[#050a18]">
              <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                    Network Map
                  </p>
                  <p className="text-sm font-medium">Rutas activas</p>
                </div>
                {selectedAirline && (
                  <button
                    onClick={() => setSelectedAirline(null)}
                    className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-2.5 py-1 text-[10px] text-slate-300 hover:border-cyan-500/50"
                  >
                    Mostrando {selectedAirline} <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <ConnectivityMap
                cities={visibleCities}
                airlines={airlines}
                selectedCity={selectedCity}
                onSelectCity={(c) => setSelectedCity(c)}
              />
            </section>

            {/* Airline distribution */}
            <section className="mb-6 grid gap-4 lg:grid-cols-5">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 lg:col-span-2">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                  Share
                </p>
                <p className="mb-3 text-sm font-medium">Distribución por aerolínea</p>
                <div className="h-48">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={airlines.slice(0, 8).map((a, i) => ({
                          name: a.code,
                          value: a.total,
                          fill: airlineColor(a.code, i),
                        }))}
                        dataKey="value"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                        stroke="#040814"
                        strokeWidth={2}
                      >
                        {airlines.slice(0, 8).map((a, i) => (
                          <Cell key={a.code} fill={airlineColor(a.code, i)} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#0a1224",
                          border: "1px solid #1e293b",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4 lg:col-span-3">
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                  Operators
                </p>
                <p className="mb-3 text-sm font-medium">Aerolíneas operando</p>
                <ul className="space-y-1.5">
                  {airlines.slice(0, 8).map((a, i) => {
                    const pct = (a.total / totalFlights) * 100;
                    const active = selectedAirline === a.code;
                    return (
                      <li key={a.code}>
                        <button
                          onClick={() =>
                            setSelectedAirline(active ? null : a.code)
                          }
                          className={`flex w-full items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition ${
                            active
                              ? "border-cyan-400/60 bg-cyan-500/5"
                              : "border-slate-800/60 bg-slate-900/30 hover:border-slate-700"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_8px_currentColor]"
                            style={{ color: airlineColor(a.code, i), background: airlineColor(a.code, i) }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {a.name}
                              </span>
                              <span className="font-mono text-xs text-slate-400">
                                {a.code}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                              <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: airlineColor(a.code, i),
                                    boxShadow: `0 0 8px ${airlineColor(a.code, i)}`,
                                  }}
                                />
                              </div>
                              <span className="w-16 text-right text-[10px] text-slate-400">
                                {a.total} · {pct.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>

            {/* Per-day distribution */}
            <section className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-950/60 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                    Weekly
                  </p>
                  <p className="text-sm font-medium">Distribución por día</p>
                </div>
                <span className="text-[10px] text-slate-500">
                  pico {Math.max(...perDay.map((d) => d.total))} vuelos
                </span>
              </div>
              <div className="h-44">
                <ResponsiveContainer>
                  <BarChart data={perDay}>
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.6} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="weekday"
                      tick={{ fill: "#64748b", fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: "#1e293b" }}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(34,211,238,0.06)" }}
                      contentStyle={{
                        background: "#0a1224",
                        border: "1px solid #1e293b",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ""}
                    />
                    <Bar dataKey="total" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Destinations table */}
            <section className="mb-6 rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="flex items-center justify-between border-b border-slate-800/60 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                    Routes
                  </p>
                  <p className="text-sm font-medium">
                    Destinos {selectedAirline && `· ${selectedAirline}`}
                  </p>
                </div>
                <span className="text-[10px] text-slate-500">
                  {visibleCities.length} ciudades
                </span>
              </div>
              <ul className="divide-y divide-slate-800/60">
                {visibleCities.map((c) => {
                  const perDayCity = c.total / dayCount;
                  const freq = inferFreqLabel(perDayCity);
                  const topAirlines = [...c.airlines.entries()]
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4);
                  return (
                    <li key={c.iata}>
                      <button
                        onClick={() => setSelectedCity(c.iata)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-cyan-500/5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-medium text-slate-100">
                              {c.ciudad}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {c.iata}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {topAirlines.map(([code], i) => (
                              <span
                                key={code}
                                className="rounded-md border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 font-mono text-[9px] text-slate-300"
                                style={{
                                  borderColor: `${airlineColor(code, i)}50`,
                                  color: airlineColor(code, i),
                                }}
                              >
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-slate-100">
                            {c.total}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider text-slate-500">
                            vuelos / 7d
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider ${freq.cls}`}
                        >
                          {freq.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Insights */}
            <section className="mb-6 rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 via-slate-950/50 to-violet-950/20 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
                <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                  IA Insights
                </p>
              </div>
              <div className="grid gap-2.5 md:grid-cols-2">
                <Insight
                  title="Conectividad alta"
                  body={`${destinationCount} destinos en ${dayCount} días con ${airlineCount} aerolíneas operando.`}
                />
                <Insight
                  title="Perfil low-cost"
                  body={
                    airlines[0]
                      ? `${airlines[0].name} concentra ${Math.round(
                          (airlines[0].total / totalFlights) * 100,
                        )}% de la oferta semanal.`
                      : "—"
                  }
                />
                <Insight
                  title="Estabilidad operativa"
                  body={
                    cities.filter((c) => c.total / dayCount >= 0.85).length +
                    " rutas casi diarias detectadas."
                  }
                />
                <Insight
                  title="Intensidad ruta líder"
                  body={
                    cities[0]
                      ? `${cities[0].ciudad}: ${cities[0].total} vuelos en 7 días (${(cities[0].total / dayCount).toFixed(1)}/día).`
                      : "—"
                  }
                />
              </div>
            </section>
          </>
        )}
      </div>

      {/* City detail sheet */}
      {selectedCityData && (
        <CityDetail
          city={selectedCityData}
          flights={flights7d.filter((f) => f.iataOtro === selectedCityData.iata)}
          dayCount={dayCount}
          onClose={() => setSelectedCity(null)}
        />
      )}
    </div>
  );
}

// ---------------- Subcomponents ----------------

function MetricCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: "cyan" | "violet" | "emerald" | "amber" | "pink";
}) {
  const glow = {
    cyan: "from-cyan-500/10 text-cyan-300",
    violet: "from-violet-500/10 text-violet-300",
    emerald: "from-emerald-500/10 text-emerald-300",
    amber: "from-amber-500/10 text-amber-300",
    pink: "from-pink-500/10 text-pink-300",
  }[accent];
  return (
    <div className={`group relative overflow-hidden rounded-xl border border-slate-800/80 bg-gradient-to-br ${glow} to-slate-950/80 p-3`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] opacity-80">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl font-semibold tracking-tight text-slate-50 md:text-2xl">
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px] text-slate-500">{sub}</div>
      )}
    </div>
  );
}

function Insight({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-3">
      <p className="text-[10px] uppercase tracking-wider text-cyan-300/80">
        {title}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-300">{body}</p>
    </div>
  );
}

function ConnectivityMap({
  cities,
  airlines,
  selectedCity,
  onSelectCity,
}: {
  cities: { iata: string; ciudad: string; total: number; airlines: Map<string, number> }[];
  airlines: { code: string; total: number }[];
  selectedCity: string | null;
  onSelectCity: (iata: string) => void;
}) {
  const alc = project(COORDS.ALC);
  const maxTotal = Math.max(...cities.map((c) => c.total), 1);

  const airlineIdx = useMemo(() => {
    const m = new Map<string, number>();
    airlines.forEach((a, i) => m.set(a.code, i));
    return m;
  }, [airlines]);

  return (
    <div className="relative aspect-[4/3] w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="alcGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#22D3EE" stopOpacity="0" />
          </radialGradient>
          <filter id="neonBlur">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
        </defs>

        {/* lat/lon grid */}
        <g stroke="rgba(34,211,238,0.06)" strokeWidth="1">
          {[35, 40, 45, 50, 55].map((lat) => {
            const [, y] = project([0, lat]);
            return <line key={lat} x1="0" x2={VIEW_W} y1={y} y2={y} />;
          })}
          {[-10, 0, 10, 20, 30].map((lon) => {
            const [x] = project([lon, 0]);
            return <line key={lon} y1="0" y2={VIEW_H} x1={x} x2={x} />;
          })}
        </g>

        {/* Arcs */}
        {cities.map((c) => {
          const coords = COORDS[c.iata];
          if (!coords) return null;
          const [x2, y2] = project(coords);
          const [x1, y1] = alc;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const dist = Math.sqrt(dx * dx + dy * dy);
          // perpendicular offset for arc
          const nx = -dy / dist;
          const ny = dx / dist;
          const lift = Math.min(dist * 0.25, 90);
          const cx = mx + nx * lift;
          const cy = my + ny * lift;
          const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

          // Top airline color for this city
          const topAirline = [...c.airlines.entries()].sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0];
          const color = airlineColor(
            topAirline,
            airlineIdx.get(topAirline ?? "") ?? 0,
          );
          const strokeWidth = 0.6 + (c.total / maxTotal) * 2.4;
          const isActive = !selectedCity || selectedCity === c.iata;
          const opacity = isActive ? 0.85 : 0.12;

          return (
            <g key={c.iata} style={{ cursor: "pointer" }}>
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth + 1.5}
                opacity={opacity * 0.4}
                filter="url(#neonBlur)"
              />
              <path
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={strokeWidth}
                opacity={opacity}
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* City dots + labels */}
        {cities.map((c) => {
          const coords = COORDS[c.iata];
          if (!coords) return null;
          const [x, y] = project(coords);
          const isActive = !selectedCity || selectedCity === c.iata;
          const isSel = selectedCity === c.iata;
          const r = 2 + Math.min(c.total / maxTotal, 1) * 4;
          const topAirline = [...c.airlines.entries()].sort(
            (a, b) => b[1] - a[1],
          )[0]?.[0];
          const color = airlineColor(
            topAirline,
            airlineIdx.get(topAirline ?? "") ?? 0,
          );
          return (
            <g
              key={c.iata}
              onClick={() => onSelectCity(c.iata)}
              style={{ cursor: "pointer" }}
              opacity={isActive ? 1 : 0.25}
            >
              <circle cx={x} cy={y} r={r + 4} fill={color} opacity="0.15" />
              <circle
                cx={x}
                cy={y}
                r={r}
                fill={color}
                stroke="#040814"
                strokeWidth="1"
              />
              {(c.total >= maxTotal * 0.25 || isSel) && (
                <text
                  x={x + r + 3}
                  y={y + 3}
                  fill={isSel ? "#22D3EE" : "#cbd5e1"}
                  fontSize={isSel ? 13 : 10}
                  fontWeight={isSel ? 600 : 500}
                  style={{ pointerEvents: "none" }}
                >
                  {c.iata}
                </text>
              )}
            </g>
          );
        })}

        {/* ALC marker */}
        <g>
          <circle cx={alc[0]} cy={alc[1]} r="40" fill="url(#alcGlow)" />
          <circle
            cx={alc[0]}
            cy={alc[1]}
            r="6"
            fill="#22D3EE"
            stroke="#040814"
            strokeWidth="2"
          >
            <animate
              attributeName="r"
              values="6;8;6"
              dur="2.5s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x={alc[0] + 12}
            y={alc[1] + 4}
            fill="#22D3EE"
            fontSize="14"
            fontWeight="700"
          >
            ALC
          </text>
        </g>
      </svg>
    </div>
  );
}

function CityDetail({
  city,
  flights,
  dayCount,
  onClose,
}: {
  city: { iata: string; ciudad: string; total: number; airlines: Map<string, number> };
  flights: Flight[];
  dayCount: number;
  onClose: () => void;
}) {
  const perDayCity = city.total / dayCount;
  const freq = inferFreqLabel(perDayCity);
  const airlineList = [...city.airlines.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1224] to-[#040814] p-5 shadow-2xl md:rounded-3xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
              Route detail
            </p>
            <h2 className="mt-0.5 text-xl font-semibold">{city.ciudad}</h2>
            <p className="font-mono text-[11px] text-slate-500">
              ALC → {city.iata}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">
              Vuelos / 7d
            </p>
            <p className="text-lg font-semibold text-cyan-300">{city.total}</p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">
              Promedio/día
            </p>
            <p className="text-lg font-semibold text-violet-300">
              {perDayCity.toFixed(1)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-2.5">
            <p className="text-[9px] uppercase tracking-wider text-slate-500">
              Aerolíneas
            </p>
            <p className="text-lg font-semibold text-emerald-300">
              {airlineList.length}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${freq.cls}`}
          >
            <Sparkles className="h-3 w-3" /> Patrón: {freq.label}
          </span>
        </div>

        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
          Aerolíneas operando
        </p>
        <ul className="mb-4 space-y-1.5">
          {airlineList.map(([code, count], i) => {
            const pct = (count / city.total) * 100;
            const color = airlineColor(code, i);
            return (
              <li
                key={code}
                className="flex items-center gap-2 rounded-lg border border-slate-800/60 bg-slate-900/40 px-2.5 py-2"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: color,
                    boxShadow: `0 0 6px ${color}`,
                  }}
                />
                <span className="font-mono text-xs text-slate-200">{code}</span>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-slate-400">{count} vuelos</span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
          Próximas salidas
        </p>
        <ul className="space-y-1">
          {flights.slice(0, 12).map((f, i) => (
            <li
              key={`${f.numVuelo}-${f.fecha}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-slate-800/40 bg-slate-950/40 px-2.5 py-1.5 text-xs"
            >
              <Clock className="h-3 w-3 text-slate-500" />
              <span className="font-mono text-slate-300">{f.fecha}</span>
              <span className="font-mono font-semibold text-cyan-300">
                {f.horaProgramada}
              </span>
              <span className="ml-auto font-mono text-[10px] text-slate-500">
                {f.numVuelo}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
