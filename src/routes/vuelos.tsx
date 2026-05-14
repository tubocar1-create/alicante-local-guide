import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plane, Clock, X, Sparkles, Building2, TrendingUp, Calendar } from "lucide-react";
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
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Plus, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/vuelos")({
  head: () => ({
    meta: [
      { title: "Mapa de destinos desde Alicante" },
      {
        name: "description",
        content:
          "Mapa interactivo con todos los destinos directos desde el aeropuerto de Alicante-Elche. Selecciona una ciudad para ver sus métricas.",
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
  SZG: [13.0, 47.79],
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
  INN: [11.34, 47.26],
};

// Map projection — vista inicial amplia: la ruta ALC → TLV arranca en esta escala
// y el zoom mínimo queda bloqueado en esta misma posición.
const VIEW_W = 1000;
const VIEW_H = 562;
const LON_MIN = -125;
const LON_MAX = 125;
const LAT_MIN = -55;
const LAT_MAX = 75;

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

// ---------------- Airline palette ----------------
const AIRLINE_COLORS: Record<string, string> = {
  FR: "#FFD400", VY: "#FF6FB0", IB: "#E2261C", I2: "#E2261C", UX: "#9F2A6A",
  U2: "#FF6900", EJU: "#FF6900", W6: "#C6017E", HV: "#1F9CFF", TO: "#1F9CFF",
  KL: "#00A1DE", AF: "#0F2D5F", LH: "#FFCC00", EW: "#9B1E48", BA: "#1B3A6B",
  AY: "#0073CF", SK: "#003F87", DY: "#D81E27", TP: "#02916E", AZ: "#0F8A4A",
  LX: "#E10718", OS: "#CC0000", TK: "#C70A0C", EI: "#0F8A4A", PC: "#FFD400",
  XQ: "#0099D8", XC: "#FF8C00", SU: "#0066B3",
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

const FREQ_TIERS: { min: number; max: number; color: string; width: number }[] = [
  { min: 25, max: Infinity, color: "#FF3B3B", width: 4.2 },
  { min: 18, max: 25, color: "#FF7A1A", width: 3.6 },
  { min: 12, max: 18, color: "#FFD400", width: 3.0 },
  { min: 8, max: 12, color: "#34D399", width: 2.4 },
  { min: 5, max: 8, color: "#22D3EE", width: 1.9 },
  { min: 3, max: 5, color: "#60A5FA", width: 1.5 },
  { min: 2, max: 3, color: "#A78BFA", width: 1.2 },
  { min: 1, max: 2, color: "#F472B6", width: 1 },
];

function freqTier(total: number) {
  return (
    FREQ_TIERS.find((t) => total >= t.min && total < t.max) ??
    FREQ_TIERS[FREQ_TIERS.length - 1]
  );
}

// ---------------- Component ----------------

type CityAgg = {
  iata: string;
  ciudad: string;
  total: number;
  airlines: Map<string, number>;
  days: Set<string>;
};

function VuelosDashboard() {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

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

  const cities = useMemo<CityAgg[]>(() => {
    const map = new Map<string, CityAgg>();
    for (const f of flights7d) {
      const key = f.iataOtro;
      let entry = map.get(key);
      if (!entry) {
        entry = { iata: key, ciudad: f.ciudad, total: 0, airlines: new Map(), days: new Set() };
        map.set(key, entry);
      }
      entry.total += 1;
      entry.days.add(f.fecha);
      const a = f.iataCompania || "??";
      entry.airlines.set(a, (entry.airlines.get(a) ?? 0) + 1);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [flights7d]);

  const dayCount = useMemo(() => {
    const set = new Set(flights7d.map((f) => f.fecha));
    return set.size || 1;
  }, [flights7d]);

  const selectedCityData = selectedCity === "TLV"
    ? cities.find((c) => c.iata === "TLV") ?? {
        iata: "TLV",
        ciudad: "Tel Aviv",
        total: 1,
        airlines: new Map([["--", 1]]),
        days: new Set(["radio"]),
      }
    : null;

  const telAvivFlights = flights7d.filter((f) => f.iataOtro === "TLV");
  const totalFlights = telAvivFlights.length || 1;

  return (
    <div
      className="min-h-screen text-slate-100"
      style={{
        background:
          "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
      }}
    >
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-cyan-500/[0.06] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[24rem] w-[24rem] rounded-full bg-violet-500/[0.05] blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-3 pb-10 pt-5 md:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link
            to="/"
            className="text-[11px] uppercase tracking-[0.25em] text-slate-500 transition hover:text-cyan-300"
          >
            ← Inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/80">
              Live · ALC
            </span>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/70">
              Aviation Intelligence
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-4xl">
              Alicante{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                → Tel Aviv
              </span>
            </h1>
            <p className="mt-1 text-xs text-slate-500 md:text-sm">
              Mapa reducido al radio máximo de vuelos desde Alicante.
            </p>
          </div>
          {!loading && !error && (
            <div className="flex gap-2">
              <MiniStat label="Ruta" value="ALC·TLV" />
              <MiniStat label="Vuelos / 7d" value={totalFlights} accent />
            </div>
          )}
        </div>

        {false && loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center text-sm text-slate-400">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
            Cargando mapa…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-900/50 bg-red-950/30 p-6 text-sm text-red-300">
            No hay datos disponibles ahora mismo.
          </div>
        )}

        {!loading && (
          <ConnectivityMap
            cities={cities}
            selectedCity={selectedCity}
            onSelectCity={(c) => setSelectedCity(c)}
          />
        )}
      </div>

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

// ---------------- Map ----------------

function ConnectivityMap({
  cities,
  selectedCity,
  onSelectCity,
}: {
  cities: CityAgg[];
  selectedCity: string | null;
  onSelectCity: (iata: string) => void;
}) {
  const alc = project(COORDS.ALC);
  const telAvivOnly = useMemo<CityAgg>(() => {
    const live = cities.find((c) => c.iata === "TLV");
    return (
      live ?? {
        iata: "TLV",
        ciudad: "Tel Aviv",
        total: 1,
        airlines: new Map([["--", 1]]),
        days: new Set(["radio"]),
      }
    );
  }, [cities]);

  const [countries, setCountries] = useState<Feature<Geometry>[] | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch("https://unpkg.com/world-atlas@2/countries-110m.json")
      .then((r) => r.json())
      .then((topo: Topology) => {
        if (cancel) return;
        const obj = topo.objects.countries;
        if (!obj) return;
        const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry>;
        setCountries(fc.features);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, []);

  const drawn = useMemo(() => [telAvivOnly], [telAvivOnly]);

  const cleanCityName = (raw: string) => {
    const first = raw.split("/")[0].trim();
    return first
      .toLowerCase()
      .split(" ")
      .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  };

  const labelFor = (c: CityAgg) => {
    const [lon] = COORDS[c.iata];
    const right = lon >= -0.5;
    return { anchor: right ? "start" : "end", dx: right ? 4 : -4 };
  };

  const [hoverCity, setHoverCity] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; city: CityAgg } | null>(
    null,
  );

  const focusCity = hoverCity ?? selectedCity;

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/[0.06] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)]"
      style={{
        background:
          "radial-gradient(ellipse at center, #06122a 0%, #030917 60%, #01060f 100%)",
      }}
    >
      <div className="relative aspect-[16/9] w-full">
        <TransformWrapper
          initialScale={1}
          minScale={1}
          maxScale={6}
          wheel={{ step: 0.15 }}
          doubleClick={{ mode: "zoomIn", step: 0.6 }}
          panning={{ velocityDisabled: true }}
          limitToBounds={true}
        >
          {({ zoomIn, resetTransform }) => {
            return (
            <>
              <TransformComponent
                wrapperClass="!h-full !w-full"
                contentClass="!h-full !w-full"
              >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="seaGrad" cx="50%" cy="50%" r="75%">
              <stop offset="0%" stopColor="#08162e" />
              <stop offset="60%" stopColor="#030a18" />
              <stop offset="100%" stopColor="#01060f" />
            </radialGradient>
            <radialGradient id="alcGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.7" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#000" stopOpacity="0" />
              <stop offset="70%" stopColor="#000" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
            </radialGradient>
            <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" />
            </filter>
            <clipPath id="mapClip">
              <rect x={0} y={0} width={VIEW_W} height={VIEW_H} />
            </clipPath>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill="url(#seaGrad)" />

          {countries && (
            <g clipPath="url(#mapClip)">
              {countries.map((f, i) => {
                const d = GEOPATH(f);
                if (!d) return null;
                const [[x0, y0], [x1, y1]] = GEOPATH.bounds(f);
                if (x1 < 0 || y1 < 0 || x0 > VIEW_W || y0 > VIEW_H) return null;
                return (
                  <path
                    key={i}
                    d={d}
                    fill="#0c1a33"
                    stroke="#1d3358"
                    strokeWidth={0.4}
                    opacity={0.95}
                  />
                );
              })}
            </g>
          )}

          {/* Routes */}
          <g clipPath="url(#mapClip)">
          {drawn.map((c) => {
            const [x2, y2] = project(COORDS[c.iata]);
            const [x1, y1] = alc;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = -dy / dist;
            const ny = dx / dist;
            const lift = Math.min(dist * 0.22, 80);
            const cx = mx + nx * lift;
            const cy = my + ny * lift;
            const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
            const tier = freqTier(c.total);
            const isFocus = focusCity === c.iata;
            const dim = focusCity && !isFocus;
            const opacity = dim ? 0.08 : isFocus ? 1 : 0.85;

            return (
              <g key={c.iata} style={{ color: tier.color }}>
                {/* outer halo */}
                <path
                  d={path}
                  fill="none"
                  stroke={tier.color}
                  strokeWidth={tier.width + 4}
                  opacity={opacity * 0.18}
                  filter="url(#softGlow)"
                  strokeLinecap="round"
                />
                {/* core line */}
                <path
                  d={path}
                  fill="none"
                  stroke={tier.color}
                  strokeWidth={tier.width}
                  opacity={opacity}
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 ${isFocus ? 6 : 3}px ${tier.color})`,
                  }}
                />
                {/* animated dash overlay */}
                <path
                  d={path}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={Math.max(0.6, tier.width * 0.4)}
                  opacity={opacity * 0.55}
                  strokeLinecap="round"
                  strokeDasharray="4 10"
                  style={{
                    animation: "dashFlow 6s linear infinite",
                  }}
                />
              </g>
            );
          })}
          </g>

          {/* Destination nodes */}
          {drawn.map((c) => {
            const [x, y] = project(COORDS[c.iata]);
            const isSel = selectedCity === c.iata;
            const isHover = hoverCity === c.iata;
            const isFocus = isSel || isHover;
            const dim = focusCity && !isFocus;
            const tier = freqTier(c.total);
            return (
              <g
                key={c.iata}
                onClick={() => onSelectCity(c.iata)}
                onMouseEnter={(e) => {
                  setHoverCity(c.iata);
                  const r = (
                    e.currentTarget.ownerSVGElement as SVGSVGElement
                  )?.getBoundingClientRect();
                  if (r) {
                    setTip({
                      x: ((x / VIEW_W) * r.width),
                      y: ((y / VIEW_H) * r.height),
                      city: c,
                    });
                  }
                }}
                onMouseLeave={() => {
                  setHoverCity(null);
                  setTip(null);
                }}
                style={{ cursor: "pointer" }}
                opacity={dim ? 0.35 : 1}
              >
                <circle cx={x} cy={y} r={14} fill="transparent" />
                {isFocus && (
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    fill={tier.color}
                    opacity={0.25}
                    style={{ filter: `drop-shadow(0 0 6px ${tier.color})` }}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isFocus ? 2.6 : 1.7}
                  fill="#e2e8f0"
                  opacity={0.95}
                  style={{
                    filter: `drop-shadow(0 0 ${isFocus ? 5 : 2}px ${tier.color})`,
                  }}
                />
                {/* persistent tiny IATA label */}
                {(() => {
                  const lab = labelFor(c);
                  return (
                    <text
                      x={x + lab.dx}
                      y={y + 1.2}
                      fill={isFocus ? "#ffffff" : "#9fb4d6"}
                      fontSize={3.4}
                      fontWeight={600}
                      textAnchor={lab.anchor as "start" | "end"}
                      style={{
                        pointerEvents: "none",
                        letterSpacing: "0.08em",
                        textShadow: "0 0 3px rgba(0,0,0,0.9)",
                      }}
                    >
                      {c.iata}
                    </text>
                  );
                })()}
                {isFocus && (
                  <text
                    x={x}
                    y={y - 6}
                    fill="#ffffff"
                    fontSize={4.8}
                    fontWeight={700}
                    textAnchor="middle"
                    style={{
                      pointerEvents: "none",
                      letterSpacing: "0.04em",
                      textShadow: "0 0 4px rgba(0,0,0,0.9)",
                    }}
                  >
                    {cleanCityName(c.ciudad).toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}

          {/* Alicante hub */}
          <g style={{ pointerEvents: "none" }}>
            <circle cx={alc[0]} cy={alc[1]} r={28} fill="url(#alcGlow)" />
            <circle
              cx={alc[0]}
              cy={alc[1]}
              r={4}
              fill="#ffffff"
              style={{
                filter:
                  "drop-shadow(0 0 6px #ffffff) drop-shadow(0 0 14px #3b82f6)",
              }}
            >
              <animate
                attributeName="r"
                values="3.6;4.6;3.6"
                dur="2.4s"
                repeatCount="indefinite"
              />
            </circle>
            <text
              x={alc[0]}
              y={alc[1] + 9}
              fill="#ffffff"
              fontSize={4.5}
              fontWeight={800}
              textAnchor="middle"
              style={{ letterSpacing: "0.18em" }}
            >
              ALICANTE
            </text>
          </g>

          {/* cinematic vignette */}
          <rect
            width={VIEW_W}
            height={VIEW_H}
            fill="url(#vignette)"
            style={{ pointerEvents: "none" }}
          />
        </svg>
              </TransformComponent>

              {/* Tooltip */}
              {tip && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-white/10 bg-black/80 px-3 py-2 text-[11px] text-slate-100 shadow-2xl backdrop-blur-md"
                  style={{
                    left: tip.x,
                    top: tip.y - 14,
                  }}
                >
                  <div className="font-semibold text-white">
                    {cleanCityName(tip.city.ciudad)}{" "}
                    <span className="font-mono text-[10px] text-slate-400">
                      {tip.city.iata}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-slate-300">
                    <span style={{ color: freqTier(tip.city.total).color }}>
                      ●
                    </span>
                    {tip.city.total} vuelos · {tip.city.airlines.size} aerolíneas
                  </div>
                </div>
              )}

              {/* Top-left header chip */}
              <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-300 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                ALC → TLV
              </div>

              {/* Frequency legend */}
              <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-2xl border border-white/[0.08] bg-[rgba(8,12,20,0.75)] px-3 py-2 backdrop-blur-xl">
                <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">
                  Radio máximo · Tel Aviv en borde
                </p>
              </div>

              {/* Zoom controls — solo acercar (la vista inicial está bloqueada) */}
              <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-xl border border-white/10 bg-black/50 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => zoomIn()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-cyan-300"
                  aria-label="Acercar"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => resetTransform()}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-cyan-300"
                  aria-label="Vista inicial"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-white/5 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-400 backdrop-blur-sm">
                Pellizca · arrastra · toca
              </div>
            </>
            );
          }}
        </TransformWrapper>
      </div>

      <style>{`
        @keyframes dashFlow {
          to { stroke-dashoffset: -140; }
        }
      `}</style>
    </div>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-[rgba(10,15,25,0.7)] px-3 py-2 backdrop-blur-xl">
      <p className="text-[9px] uppercase tracking-[0.25em] text-slate-500">
        {label}
      </p>
      <p
        className={`text-xl font-bold tabular-nums ${
          accent
            ? "bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-transparent"
            : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------- City Dashboard ----------------

function CityDetail({
  city,
  flights,
  dayCount,
  onClose,
}: {
  city: CityAgg;
  flights: Flight[];
  dayCount: number;
  onClose: () => void;
}) {
  const perDayCity = city.total / dayCount;
  const freq = inferFreqLabel(perDayCity);
  const airlineList = [...city.airlines.entries()].sort((a, b) => b[1] - a[1]);

  // per-day distribution for this city
  const perDay = useMemo(() => {
    const map = new Map<string, { date: string; total: number; weekday: string }>();
    for (const f of flights) {
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
  }, [flights]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-cyan-500/20 bg-gradient-to-b from-[#0a1224] to-[#040814] p-5 shadow-2xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
              Dashboard de ruta
            </p>
            <h2 className="mt-0.5 text-2xl font-semibold">{city.ciudad}</h2>
            <p className="font-mono text-[11px] text-slate-500">
              ALC → {city.iata}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-slate-700 p-1.5 text-slate-400 hover:border-cyan-500/50 hover:text-cyan-300"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <Stat icon={<Plane className="h-3 w-3" />} label="Vuelos / 7d" value={city.total.toString()} color="cyan" />
          <Stat icon={<TrendingUp className="h-3 w-3" />} label="Promedio/día" value={perDayCity.toFixed(1)} color="violet" />
          <Stat icon={<Building2 className="h-3 w-3" />} label="Aerolíneas" value={airlineList.length.toString()} color="emerald" />
        </div>

        <div className="mb-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider ${freq.cls}`}
          >
            <Sparkles className="h-3 w-3" /> Patrón: {freq.label}
          </span>
        </div>

        {perDay.length > 1 && (
          <div className="mb-4 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-cyan-300" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                Por día de la semana
              </p>
            </div>
            <div className="h-32">
              <ResponsiveContainer>
                <BarChart data={perDay}>
                  <defs>
                    <linearGradient id="cityBar" x1="0" y1="0" x2="0" y2="1">
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
                  <Bar dataKey="total" fill="url(#cityBar)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {airlineList.length > 1 && (
          <div className="mb-4 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
              Reparto por aerolínea
            </p>
            <div className="h-36">
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={airlineList.map(([code, value], i) => ({
                      name: code,
                      value,
                      fill: airlineColor(code, i),
                    }))}
                    dataKey="value"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                    stroke="#040814"
                    strokeWidth={2}
                  >
                    {airlineList.map(([code], i) => (
                      <Cell key={code} fill={airlineColor(code, i)} />
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
        )}

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
                  style={{ background: color, boxShadow: `0 0 6px ${color}` }}
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

function Stat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "cyan" | "violet" | "emerald";
}) {
  const cls = {
    cyan: "text-cyan-300",
    violet: "text-violet-300",
    emerald: "text-emerald-300",
  }[color];
  return (
    <div className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-2.5">
      <div className={`mb-1 flex items-center gap-1 ${cls}`}>
        {icon}
        <p className="text-[9px] uppercase tracking-wider opacity-80">{label}</p>
      </div>
      <p className={`text-lg font-semibold ${cls}`}>{value}</p>
    </div>
  );
}
