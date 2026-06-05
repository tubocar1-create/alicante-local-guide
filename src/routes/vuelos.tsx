import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plane, Clock, X, Sparkles, Building2, TrendingUp, Calendar, ExternalLink } from "lucide-react";
import { getDestinationComment } from "@/lib/destination-comment.functions";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Plus, Maximize2 } from "lucide-react";
import { trackPageView } from "@/lib/gtag";
import kiwiLogo from "@/assets/kiwi-logo.png.asset.json";
import aviasalesLogo from "@/assets/aviasales-logo.png.asset.json";


export const Route = createFileRoute("/vuelos")({
  head: () => ({
    meta: [
      { title: "Mapa de vuelos · Alicante-Elche" },
      {
        name: "description",
        content:
          "Mapa interactivo con destinos y orígenes del aeropuerto de Alicante-Elche. Selecciona una ciudad para ver sus métricas semanales.",
      },
      { property: "og:title", content: "Mapa de vuelos del aeropuerto de Alicante-Elche" },
      { property: "og:description", content: "Destinos y orígenes en tiempo real del aeropuerto ALC con métricas semanales por ciudad." },
      { property: "og:url", content: "https://vamosalicante.com/vuelos" }
    ],
  links: [
      { rel: "canonical", href: "https://vamosalicante.com/vuelos" },
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

// Map projection — Mercator centrada en Europa, viewBox grande para nitidez.
const VIEW_W = 2000;
const VIEW_H = 1400;
const LON_MIN = -15;
const LON_MAX = 50;
const LAT_MIN = 28;
const LAT_MAX = 62;

const PROJ = geoMercator().fitExtent(
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

// ---------------- Country mapping (IATA → ISO2) ----------------
const IATA_COUNTRY: Record<string, string> = {
  ALC: "ES", MAD: "ES", BCN: "ES", PMI: "ES", TFN: "ES", TFS: "ES", LPA: "ES",
  BIO: "ES", SCQ: "ES", VGO: "ES", SVQ: "ES", AGP: "ES", IBZ: "ES", MAH: "ES",
  LCG: "ES", OVD: "ES", VLL: "ES", MLN: "ES", GRX: "ES", XRY: "ES",
  STN: "GB", LGW: "GB", LTN: "GB", LHR: "GB", LCY: "GB", MAN: "GB", BHX: "GB",
  LBA: "GB", EDI: "GB", GLA: "GB", NCL: "GB", LPL: "GB", BRS: "GB", EMA: "GB",
  BFS: "GB", BOH: "GB", EXT: "GB", NWI: "GB", CWL: "GB",
  SNN: "IE", DUB: "IE", ORK: "IE", LDY: "IE",
  CDG: "FR", ORY: "FR", BVA: "FR", NCE: "FR", LYS: "FR", MRS: "FR", TLS: "FR",
  NTE: "FR", BOD: "FR", BIQ: "FR",
  BRU: "BE", CRL: "BE",
  AMS: "NL", EIN: "NL", RTM: "NL",
  LUX: "LU",
  FRA: "DE", MUC: "DE", BER: "DE", DUS: "DE", HAM: "DE", CGN: "DE", STR: "DE",
  HHN: "DE", NRN: "DE", FMM: "DE",
  ZRH: "CH", GVA: "CH", BSL: "CH",
  VIE: "AT", SZG: "AT", INN: "AT",
  FCO: "IT", CIA: "IT", MXP: "IT", LIN: "IT", BGY: "IT", VCE: "IT", TSF: "IT",
  NAP: "IT", BLQ: "IT", PSA: "IT", TRN: "IT", CTA: "IT", PMO: "IT", BRI: "IT", CAG: "IT",
  LIS: "PT", OPO: "PT", FAO: "PT", FNC: "PT",
  CPH: "DK", BLL: "DK", AAL: "DK",
  OSL: "NO", TRF: "NO", BGO: "NO",
  ARN: "SE", GOT: "SE", BMA: "SE", NYO: "SE",
  HEL: "FI",
  WAW: "PL", WMI: "PL", KRK: "PL", GDN: "PL", WRO: "PL", POZ: "PL",
  PRG: "CZ", BUD: "HU", OTP: "RO", SOF: "BG",
  ATH: "GR", SKG: "GR", RHO: "GR", HER: "GR",
  TIA: "AL", BEG: "RS", ZAG: "HR", LJU: "SI",
  TLL: "EE", RIX: "LV", VNO: "LT", KUN: "LT",
  RAK: "MA", CMN: "MA", TNG: "MA", NDR: "MA", AHU: "MA", FEZ: "MA", OUD: "MA",
  TTU: "MA", AGA: "MA",
  MLA: "MT", LCA: "CY", PFO: "CY", TLV: "IL",
};

function flagEmoji(iata: string): string {
  const cc = IATA_COUNTRY[iata];
  if (!cc) return "🏳️";
  return String.fromCodePoint(
    ...cc.toUpperCase().split("").map((c) => 0x1f1e6 + c.charCodeAt(0) - 65),
  );
}

const COUNTRY_NAME: Record<string, string> = {
  ES: "España", GB: "Reino Unido", IE: "Irlanda", FR: "Francia", BE: "Bélgica",
  NL: "Países Bajos", LU: "Luxemburgo", DE: "Alemania", CH: "Suiza", AT: "Austria",
  IT: "Italia", PT: "Portugal", DK: "Dinamarca", NO: "Noruega", SE: "Suecia",
  FI: "Finlandia", PL: "Polonia", CZ: "Chequia", HU: "Hungría", RO: "Rumanía",
  BG: "Bulgaria", GR: "Grecia", AL: "Albania", RS: "Serbia", HR: "Croacia",
  SI: "Eslovenia", EE: "Estonia", LV: "Letonia", LT: "Lituania", MA: "Marruecos",
  MT: "Malta", CY: "Chipre", IL: "Israel",
};

// ---------------- Airline palette ----------------
const AIRLINE_COLORS: Record<string, string> = {
  FR: "#FFD400", VY: "#FF6FB0", IB: "#E2261C", I2: "#E2261C", UX: "#9F2A6A",
  U2: "#FF6900", EJU: "#FF6900", W6: "#C6017E", HV: "#1F9CFF", TO: "#1F9CFF",
  KL: "#00A1DE", AF: "#0F2D5F", LH: "#FFCC00", EW: "#9B1E48", BA: "#1B3A6B",
  AY: "#0073CF", SK: "#003F87", DY: "#D81E27", TP: "#02916E", AZ: "#0F8A4A",
  LX: "#E10718", OS: "#CC0000", TK: "#C70A0C", EI: "#0F8A4A", PC: "#FFD400",
  XQ: "#0099D8", XC: "#FF8C00", SU: "#0066B3",
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

function airlineName(code: string): string {
  return AIRLINE_NAMES[code] ?? code;
}

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
const DASHBOARD_REFRESH_MS = 30 * 60 * 1000;

function inferFreqLabel(perDay: number): { label: string; cls: string } {
  if (perDay >= 1.5) return { label: "Casi diaria", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" };
  if (perDay >= 0.85) return { label: "Diaria", cls: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30" };
  if (perDay >= 0.4) return { label: "Alta", cls: "text-violet-300 bg-violet-500/10 border-violet-500/30" };
  if (perDay >= 0.2) return { label: "Media", cls: "text-amber-300 bg-amber-500/10 border-amber-500/30" };
  return { label: "Baja", cls: "text-slate-300 bg-slate-500/10 border-slate-500/30" };
}

const FREQ_TIERS: { min: number; max: number; color: string; width: number }[] = [
  { min: 25, max: Infinity, color: "#FF3B3B", width: 1.4 },
  { min: 18, max: 25, color: "#FF7A1A", width: 1.2 },
  { min: 12, max: 18, color: "#FFD400", width: 1.05 },
  { min: 8, max: 12, color: "#34D399", width: 0.95 },
  { min: 5, max: 8, color: "#22D3EE", width: 0.85 },
  { min: 3, max: 5, color: "#60A5FA", width: 0.75 },
  { min: 2, max: 3, color: "#A78BFA", width: 0.7 },
  { min: 1, max: 2, color: "#F472B6", width: 0.65 },
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
  useEffect(() => { trackPageView("vuelos"); }, []);


  const flightType = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("type") === "L" ? "L" : "S";

  const [isWeb, setIsWeb] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsWeb(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancel = false;
    const loadFlights = () => {
      setLoading(true);
      fetch(`/api/public/aena-flights?airport=ALC&type=${flightType}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancel) return;
          if (d.error) setError(d.error);
          else setError(null);
          setFlights(d.flights ?? []);
        })
        .catch((e) => !cancel && setError(String(e)))
        .finally(() => !cancel && setLoading(false));
    };

    loadFlights();
    const interval = window.setInterval(loadFlights, DASHBOARD_REFRESH_MS);
    return () => {
      cancel = true;
      window.clearInterval(interval);
    };
  }, [flightType]);

  const flights7d = useMemo(() => {
    if (!flights.length) return [];
    // Ventana deslizante: desde hoy hasta hoy + 7 días (inclusive).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return flights.filter((f) => {
      const d = parseDate(f.fecha);
      return d >= today && d <= end;
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
    // Asegurar que Tel Aviv (TLV) siempre aparezca en el mapa de salidas, aunque no haya vuelos en la ventana.
    if (flightType === "S" && !map.has("TLV")) {
      map.set("TLV", {
        iata: "TLV",
        ciudad: "Tel Aviv",
        total: 0,
        airlines: new Map(),
        days: new Set(),
      });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [flights7d, flightType]);

  const dayCount = useMemo(() => {
    const set = new Set(flights7d.map((f) => f.fecha));
    return set.size || 1;
  }, [flights7d]);



  const weekRange = useMemo(() => {
    if (!flights7d.length) return { start: "", end: "" };
    const dates = [...new Set(flights7d.map((f) => f.fecha))]
      .map(parseDate)
      .sort((a, b) => a.getTime() - b.getTime());
    const fmt = (d: Date) =>
      `${d.getDate()} ${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][d.getMonth()]}`;
    return { start: fmt(dates[0]), end: fmt(dates[dates.length - 1]) };
  }, [flights7d]);

  const selectedCityData = selectedCity
    ? cities.find((c) => c.iata === selectedCity) ??
      (selectedCity === "TLV"
        ? {
            iata: "TLV",
            ciudad: "Tel Aviv",
            total: 1,
            airlines: new Map([["--", 1]]),
            days: new Set(["radio"]),
          }
        : null)
    : null;

  // Métricas globales para los paneles laterales
  const totalFlights = flights7d.length;
  const destinationsCount = cities.filter((c) => c.iata !== "ALC" && c.total > 0).length;
  const airlinesAgg = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flights7d) {
      const code = f.iataCompania || "??";
      m.set(code, (m.get(code) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [flights7d]);
  const airlinesCount = airlinesAgg.length;
  const topCities = cities.filter((c) => c.total > 0);
  const topDestino = topCities[0];
  const topCountryISO = topDestino ? IATA_COUNTRY[topDestino.iata] : undefined;
  const principalRegion = topCountryISO ? COUNTRY_NAME[topCountryISO] ?? "Europa" : "Europa";

  return (
    <div
      className="h-dvh overflow-y-auto overscroll-contain text-slate-100 lg:min-h-screen lg:h-auto lg:overflow-visible"
      style={{
        background:
          "linear-gradient(180deg, #020617 0%, #06111f 50%, #020617 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >

      {/* Scrollbar doble de ancho — sólo web */}
      <style>{`
        @media (min-width: 1024px) {
          html { scrollbar-width: auto; scrollbar-color: rgba(34,211,238,0.45) rgba(0,0,0,0.25); }
          html::-webkit-scrollbar, body::-webkit-scrollbar { width: 24px; }
          html::-webkit-scrollbar-track, body::-webkit-scrollbar-track { background: rgba(0,0,0,0.25); }
          html::-webkit-scrollbar-thumb, body::-webkit-scrollbar-thumb {
            background: rgba(34,211,238,0.45);
            border-radius: 12px;
            border: 4px solid transparent;
            background-clip: padding-box;
          }
          html::-webkit-scrollbar-thumb:hover, body::-webkit-scrollbar-thumb:hover {
            background: rgba(34,211,238,0.7);
            background-clip: padding-box;
            border: 4px solid transparent;
          }
        }
      `}</style>
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

        <div className="mb-5 lg:flex lg:items-start lg:justify-between lg:gap-6">
          <div className="lg:flex-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/70">
              {flightType === "L" ? "Dashboard de llegadas" : "Dashboard de salidas"}
            </p>
            {/* Single responsive h1 (mobile/desktop variants via spans) */}
            <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-4xl">
              <span className="lg:hidden">
                {flightType === "L" ? "Vuelos de llegada " : "Vuelos de salida "}
                <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                  {flightType === "L" ? "hacia Alicante" : "desde Alicante"}
                </span>
              </span>
              <span className="hidden lg:inline">
                {flightType === "L" ? "De donde vienen" : "A donde ir"}{" "}
                <span className="bg-gradient-to-r from-cyan-300 via-white to-violet-300 bg-clip-text text-transparent">
                  {flightType === "L" ? "a Alicante" : "desde Alicante"}
                </span>
                <span className="ml-3 align-middle text-base font-normal text-cyan-300/80">
                  ({cities.filter((c) => c.total > 0).length}) ciudades
                </span>
              </span>
            </h1>
            <p className="mt-1 text-xs text-cyan-300/80 md:text-sm lg:hidden">
              {flightType === "L"
                ? "Métricas semanales (7 días) de vuelos que aterrizan en Alicante-Elche (ALC), agrupados por ciudad de origen."
                : "Métricas semanales (7 días) de vuelos que despegan de Alicante-Elche (ALC), agrupados por ciudad de destino."}
            </p>
          </div>
          {/* Manual city autocomplete — web only */}
          <CityAutocomplete
            cities={cities.filter((c) => c.total > 0).map((c) => ({ iata: c.iata, ciudad: cleanCityNamePublic(c.ciudad) }))}
            flightType={flightType}
          />
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
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
              <div className="order-2 lg:order-1">
                <ConnectivityMap
                  cities={cities}
                  selectedCity={selectedCity}
                  flightType={flightType}
                  lockZoom={true}
                  onSelectCity={(c) => {
                    if (typeof window !== "undefined") {
                      window.open(`/vuelos/${c}?type=${flightType}`, "_blank", "noopener,noreferrer");
                    }
                  }}
                />
              </div>
              <div className="order-1 lg:order-2">
                <InfoPanel
                  cities={topCities}
                  airlines={airlinesAgg.slice(0, 9)}
                  destinos={destinationsCount}
                  aerolineas={airlinesCount}
                  vuelos={totalFlights}
                  region={principalRegion}
                  weekStart={weekRange.start}
                  weekEnd={weekRange.end}
                  flightType={flightType}
                  pageSize={isWeb ? 12 : 15}
                  hideAirlines={isWeb}
                />
              </div>
            </div>

            {/* Full-width airlines + footer stats — web only */}
            {isWeb && (
              <div className="mt-4 hidden lg:block">
                <AirlinesFullPanel
                  airlines={airlinesAgg}
                  destinos={destinationsCount}
                  aerolineas={airlinesCount}
                  vuelos={totalFlights}
                  region={principalRegion}
                  flightType={flightType}
                />
              </div>
            )}
          </>
        )}
      </div>

      {selectedCityData && (
        <CityDetail
          city={selectedCityData}
          flights={flights7d.filter((f) => f.iataOtro === selectedCityData.iata)}
          dayCount={dayCount}
          flightType={flightType}
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
  flightType,
  lockZoom = false,
}: {
  cities: CityAgg[];
  selectedCity: string | null;
  onSelectCity: (iata: string) => void;
  flightType: "S" | "L";
  lockZoom?: boolean;
}) {
  const alc = project(COORDS.ALC);

  const [countries, setCountries] = useState<Feature<Geometry>[] | null>(null);
  useEffect(() => {
    let cancel = false;
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
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

  const drawn = useMemo(
    () => cities.filter((c) => c.iata !== "ALC" && COORDS[c.iata]),
    [cities],
  );

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

  const wrapRef = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trRef = useRef<any>(null);

  // Centra la vista inicial en Europa central (lon 12, lat 50) con un zoom suave.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const el = wrapRef.current;
      const tr = trRef.current;
      if (!el || !tr) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const c = project([10, 44]);
      const fx = c[0] / VIEW_W;
      const fy = c[1] / VIEW_H;
      const s = 5.7;
      const x = w / 2 - fx * s * w;
      const y = h / 2 - fy * s * h;
      tr.setTransform(x, y, s, 0);
    }, 60);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/[0.06] shadow-[0_30px_120px_-20px_rgba(0,0,0,0.9)]"
      style={{
        background:
          "radial-gradient(ellipse at center, #06122a 0%, #030917 60%, #01060f 100%)",
      }}
    >
      <div ref={wrapRef} className="relative h-[55vh] w-full sm:aspect-[16/9] sm:h-auto lg:aspect-auto lg:h-[82vh]" style={lockZoom ? { touchAction: "pan-y" } : undefined}>
        <TransformWrapper
          ref={trRef}
          initialScale={5.7}
          minScale={5.7}
          maxScale={lockZoom ? 5.7 : 10}
          wheel={{ step: 0.15, disabled: lockZoom }}
          doubleClick={{ mode: "zoomIn", step: 0.6, disabled: lockZoom }}
          pinch={{ disabled: lockZoom }}
          panning={{ velocityDisabled: true, disabled: lockZoom }}
          limitToBounds={true}
        >
          {({ zoomIn, resetTransform }) => {
            return (
            <>
              <TransformComponent
                wrapperClass="!h-full !w-full"
                contentClass="!h-full !w-full"
                wrapperStyle={lockZoom ? { touchAction: "pan-y" } : undefined}
              >

        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <radialGradient id="seaGrad" cx="50%" cy="50%" r="75%">
              <stop offset="0%" stopColor="#0b2540" />
              <stop offset="60%" stopColor="#071a30" />
              <stop offset="100%" stopColor="#040f1f" />
            </radialGradient>
            <linearGradient id="landGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4a2f1c" />
              <stop offset="100%" stopColor="#2b1a0e" />
            </linearGradient>
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
                    fill="url(#landGrad)"
                    stroke="#6b4226"
                    strokeWidth={0.5}
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
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
            // Curva con dirección y magnitud variable por destino para
            // separar rutas que de otro modo se superpondrían.
            const angle = Math.atan2(dy, dx); // -π..π, dirección desde ALC
            // Norte (angle < 0) → curva a la izquierda; Sur → derecha.
            const sign = angle < 0 ? -1 : 1;
            // Variación pseudoaleatoria estable basada en el código IATA.
            const hash = (c.iata.charCodeAt(0) * 31 + c.iata.charCodeAt(1) * 7 + c.iata.charCodeAt(2)) % 100;
            const jitter = 0.6 + (hash / 100) * 0.9; // 0.6..1.5
            const lift = sign * Math.min(dist * 0.28 * jitter, 260);
            const nx = -dy / dist;
            const ny = dx / dist;
            const cx = mx + nx * lift;
            const cy = my + ny * lift;
            const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
            const tier = freqTier(c.total);
            const isFocus = focusCity === c.iata;
            const dim = focusCity && !isFocus;
            const opacity = dim ? 0.03 : isFocus ? 0.45 : 0.22;

            return (
              <g key={c.iata} style={{ color: tier.color }}>
                {/* core line — sin halo, sin glow */}
                <path
                  d={path}
                  fill="none"
                  stroke={tier.color}
                  strokeWidth={tier.width}
                  opacity={opacity}
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          </g>

          {/* Destination nodes */}
          {[...drawn]
            .sort((a, b) => {
              // Render hovered/selected last so it sits on top and reliably captures clicks
              const aFocus = a.iata === hoverCity || a.iata === selectedCity ? 1 : 0;
              const bFocus = b.iata === hoverCity || b.iata === selectedCity ? 1 : 0;
              return aFocus - bFocus;
            })
            .map((c) => {
            const [x, y] = project(COORDS[c.iata]);
            const isSel = selectedCity === c.iata;
            const isHover = hoverCity === c.iata;
            const isFocus = isSel || isHover;
            const dim = focusCity && !isFocus;
            const tier = freqTier(c.total);
            return (
              <g
                key={c.iata}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCity(c.iata);
                }}
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
                <circle cx={x} cy={y} r={10} fill="transparent" />
                {isFocus && (
                  <circle
                    cx={x}
                    cy={y}
                    r={11}
                    fill={tier.color}
                    opacity={0.25}
                    style={{ filter: `drop-shadow(0 0 12px ${tier.color})` }}
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isFocus ? 3 : 2}
                  fill="#e2e8f0"
                  opacity={0.95}
                  style={{
                    filter: `drop-shadow(0 0 ${isFocus ? 6 : 2}px ${tier.color})`,
                  }}
                />
                {/* persistent full city name label */}
                {(() => {
                  const lab = labelFor(c);
                  return (
                    <text
                      x={x + lab.dx * 1.5}
                      y={y + 1.4}
                      fill={isFocus ? "#ffffff" : "#cdd9ee"}
                      fontSize={isFocus ? 5.2 : 4.4}
                      fontWeight={isFocus ? 700 : 600}
                      textAnchor={lab.anchor as "start" | "end"}
                      style={{
                        pointerEvents: "none",
                        letterSpacing: "0.04em",
                        textShadow: "0 0 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.95)",
                      }}
                    >
                      {cleanCityName(c.ciudad)}
                    </text>
                  );
                })()}

              </g>
            );
          })}

          {/* Alicante hub */}
          <g style={{ pointerEvents: "none" }}>
            <circle cx={alc[0]} cy={alc[1]} r={28} fill="url(#alcGlow)" />
            <circle
              cx={alc[0]}
              cy={alc[1]}
              r={3.5}
              fill="#ffffff"
              style={{
                filter:
                  "drop-shadow(0 0 6px #ffffff) drop-shadow(0 0 14px #3b82f6)",
              }}
            />
            <text
              x={alc[0]}
              y={alc[1] + 8}
              fill="#ffffff"
              fontSize={5.2}
              fontWeight={800}
              textAnchor="middle"
              style={{ letterSpacing: "0.14em" }}
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
              <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-cyan-400/30 bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-cyan-200 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
                {flightType === "L" ? "Mapa de llegadas · seleccione su origen" : "Mapa interactivo · seleccione su destino"}
              </div>

              {/* Frequency legend */}
              <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-2xl border border-white/[0.08] bg-[rgba(8,12,20,0.75)] px-3 py-2 backdrop-blur-xl">
                <p className="text-[9px] uppercase tracking-[0.25em] text-slate-400">
                  {flightType === "L" ? "Red completa de orígenes directos" : "Red completa de destinos directos"}
                </p>
              </div>

              {/* Zoom controls — ocultos cuando el zoom está bloqueado (web) */}
              {!lockZoom && (
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
              )}

              {!lockZoom && (
                <div className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-md border border-white/5 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-widest text-slate-400 backdrop-blur-sm">
                  Pellizca · arrastra · toca
                </div>
              )}
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

// ---------------- Side panels (Top destinos, Aerolíneas, Footer stats) ----------------

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[rgba(8,12,22,0.7)] p-4 backdrop-blur-xl">
      <p className="mb-3 text-sm font-semibold text-slate-100">{title}</p>
      {children}
    </div>
  );
}

function cleanCityNamePublic(raw: string) {
  const first = raw.split("/")[0].trim();
  return first
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function TopDestinosPanel({ cities }: { cities: CityAgg[] }) {
  return (
    <PanelCard title="Top 10 destinos por frecuencia">
      <ul className="space-y-1.5">
        {cities.map((c, i) => (
          <li
            key={c.iata}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 odd:bg-white/[0.02]"
          >
            <span className="w-4 text-right font-mono text-[11px] text-slate-500">
              {i + 1}
            </span>
            <span className="text-base leading-none">{flagEmoji(c.iata)}</span>
            <span className="flex-1 truncate">
              {cleanCityNamePublic(c.ciudad)}{" "}
              <span className="font-mono text-[10px] text-slate-500">
                ({c.iata})
              </span>
            </span>
            <span className="font-mono tabular-nums text-slate-300">
              {c.total}
            </span>
          </li>
        ))}
        {cities.length === 0 && (
          <li className="text-xs text-slate-500">Sin datos disponibles.</li>
        )}
      </ul>
    </PanelCard>
  );
}

function AerolineasPanel({ airlines }: { airlines: [string, number][] }) {
  return (
    <PanelCard title="Aerolíneas por número de vuelos">
      <ul className="space-y-1.5">
        {airlines.map(([code, count], i) => {
          const color = airlineColor(code, i);
          return (
            <li
              key={code}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-slate-200 odd:bg-white/[0.02]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="flex-1 truncate">
                <span className="font-semibold" style={{ color }}>
                  {airlineName(code)}
                </span>{" "}
                <span className="font-mono text-[10px] text-slate-500">
                  {code}
                </span>
              </span>
              <span className="font-mono tabular-nums text-slate-300">
                {count.toLocaleString("es-ES")}
              </span>
            </li>
          );
        })}
        {airlines.length === 0 && (
          <li className="text-xs text-slate-500">Sin datos disponibles.</li>
        )}
      </ul>
    </PanelCard>
  );
}

function FooterStatsRow({
  destinos,
  aerolineas,
  vuelos,
  region,
}: {
  destinos: number;
  aerolineas: number;
  vuelos: number;
  region: string;
}) {
  const items = [
    { icon: "✈", value: `+${destinos}`, label: "Destinos" },
    { icon: "🛫", value: `${aerolineas}+`, label: "Aerolíneas" },
    { icon: "✓", value: vuelos.toLocaleString("es-ES"), label: "Vuelos / 7d" },
    { icon: "🌍", value: region, label: "Principal destino" },
  ];
  return (
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-white/[0.08] bg-[rgba(8,12,22,0.7)] p-4 backdrop-blur-xl sm:grid-cols-4">
      {items.map((it) => (
        <div key={it.label} className="flex flex-col items-center text-center">
          <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 text-cyan-300">
            <span className="text-base leading-none">{it.icon}</span>
          </div>
          <p className="text-base font-bold text-white">{it.value}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
            {it.label}
          </p>
        </div>
      ))}
    </div>
  );
}

function InfoPanel({
  cities,
  airlines,
  destinos,
  aerolineas,
  vuelos,
  region,
  weekStart,
  weekEnd,
  flightType,
  pageSize = 20,
  hideAirlines = false,
}: {
  cities: CityAgg[];
  airlines: [string, number][];
  destinos: number;
  aerolineas: number;
  vuelos: number;
  region: string;
  weekStart: string;
  weekEnd: string;
  flightType: "S" | "L";
  pageSize?: number;
  hideAirlines?: boolean;
}) {
  const isArrivals = flightType === "L";
  const noun = isArrivals ? "Orígenes" : "Destinos";
  const nounLower = isArrivals ? "orígenes" : "destinos";
  const items = [
    { icon: "✈", value: `${destinos}`, label: `${noun} / 7d` },
    { icon: "🛫", value: `${aerolineas}`, label: "Aerolíneas / 7d" },
    { icon: "✓", value: vuelos.toLocaleString("es-ES"), label: "Vuelos / 7d" },
    { icon: "🌍", value: region, label: isArrivals ? "Principal origen" : "Principal" },
  ];
  const [visibleCount, setVisibleCount] = useState(pageSize);
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize]);
  const visibleCities = cities.slice(0, visibleCount);
  const hasMore = cities.length > visibleCount;
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[rgba(8,12,22,0.7)] p-4 backdrop-blur-xl">
      {/* Mobile / PWA title (sin cambios) */}
      <p className="text-sm font-semibold text-slate-100 lg:hidden">
        {weekStart && weekEnd
          ? `${noun} de la semana del ${weekStart} al ${weekEnd}`
          : `${noun} de la semana`}
      </p>
      <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-cyan-400/70 lg:hidden">
        {cities.length} {nounLower} · clic para abrir el dashboard
      </p>
      {/* Web title */}
      <p className="hidden lg:block text-base font-semibold text-slate-100">
        {isArrivals ? "De donde vienen a Alicante" : "A donde ir desde Alicante"}
      </p>
      <p className="mb-3 hidden lg:block text-[11px] text-cyan-300/80">
        ({cities.length}) Ciudades{weekStart && weekEnd ? ` en la semana del ${weekStart} al ${weekEnd}` : ""}
      </p>
      <ul className="mb-3 space-y-1">
        {visibleCities.map((c, i) => {
          const country = COUNTRY_NAME[IATA_COUNTRY[c.iata] ?? ""] ?? "";
          return (
            <li key={c.iata} className="odd:bg-white/[0.02] rounded-lg">
              <Link
                to="/vuelos/$iata"
                params={{ iata: c.iata }}
                search={{ type: flightType }}
                className="flex items-center gap-2 px-2 py-1 text-[12px] text-slate-200 transition hover:text-cyan-300"
              >
                <span className="w-4 text-right font-mono text-[11px] text-slate-500">
                  {i + 1}
                </span>
                <span className="text-base leading-none">{flagEmoji(c.iata)}</span>
                <span className="flex-1 truncate">
                  {cleanCityNamePublic(c.ciudad)}{" "}
                  <span className="font-mono text-[10px] text-slate-500">
                    ({c.iata})
                  </span>
                  {country && (
                    <span className="hidden lg:inline text-slate-400"> - {country}</span>
                  )}
                </span>
                <span className="font-mono tabular-nums text-slate-300">
                  {c.total}
                </span>
              </Link>
            </li>
          );
        })}
        {cities.length === 0 && (
          <li className="text-xs text-slate-500">Sin datos disponibles.</li>
        )}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((n) => n + pageSize)}
          className="mb-5 w-full rounded-lg border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-300 transition hover:bg-cyan-400/10"
        >
          Ver más ({Math.min(pageSize, cities.length - visibleCount)} de {cities.length - visibleCount} restantes)
        </button>
      )}

      {!hideAirlines && (
        <>
          <p className="mb-3 text-sm font-semibold text-slate-100">
            Aerolíneas por número de vuelos
          </p>
      <ul className="mb-5 space-y-1">
        {airlines.map(([code, count], i) => {
          const color = airlineColor(code, i);
          return (
            <li
              key={code}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-[12px] text-slate-200 odd:bg-white/[0.02]"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="flex-1 truncate">
                <span className="font-semibold" style={{ color }}>
                  {airlineName(code)}
                </span>{" "}
                <span className="font-mono text-[10px] text-slate-500">
                  {code}
                </span>
              </span>
              <span className="font-mono tabular-nums text-slate-300">
                {count.toLocaleString("es-ES")}
              </span>
            </li>
          );
        })}
        {airlines.length === 0 && (
          <li className="text-xs text-slate-500">Sin datos disponibles.</li>
        )}
      </ul>

      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col items-center text-center">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full border border-cyan-400/30 text-cyan-300">
              <span className="text-sm leading-none">{it.icon}</span>
            </div>
            <p className="text-sm font-bold text-white">{it.value}</p>
            <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500">
              {it.label}
            </p>
          </div>
        ))}
      </div>
        </>
      )}
    </div>
  );
}

function AirlinesFullPanel({
  airlines,
  destinos,
  aerolineas,
  vuelos,
  region,
  flightType,
}: {
  airlines: [string, number][];
  destinos: number;
  aerolineas: number;
  vuelos: number;
  region: string;
  flightType: "S" | "L";
}) {
  const isArrivals = flightType === "L";
  const noun = isArrivals ? "Orígenes" : "Destinos";
  const items = [
    { icon: "✈", value: `${destinos}`, label: `${noun} / 7d` },
    { icon: "🛫", value: `${aerolineas}`, label: "Aerolíneas / 7d" },
    { icon: "✓", value: vuelos.toLocaleString("es-ES"), label: "Vuelos / 7d" },
    { icon: "🌍", value: region, label: isArrivals ? "Principal origen" : "Principal" },
  ];
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[rgba(8,12,22,0.7)] p-5 backdrop-blur-xl">
      <p className="mb-4 text-base font-semibold text-slate-100">
        Aerolíneas por número de vuelos
      </p>
      <ul className="mb-5 grid grid-cols-2 gap-x-6 gap-y-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {airlines.map(([code, count], i) => {
          const color = airlineColor(code, i);
          return (
            <li
              key={code}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12.5px] text-slate-200"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
              <span className="flex-1 truncate">
                <span className="font-semibold" style={{ color }}>
                  {airlineName(code)}
                </span>{" "}
                <span className="font-mono text-[10px] text-slate-500">
                  {code}
                </span>
              </span>
              <span className="font-mono tabular-nums text-slate-300">
                {count.toLocaleString("es-ES")}
              </span>
            </li>
          );
        })}
        {airlines.length === 0 && (
          <li className="text-xs text-slate-500">Sin datos disponibles.</li>
        )}
      </ul>

      <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col items-center text-center">
            <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-cyan-400/30 text-cyan-300">
              <span className="text-base leading-none">{it.icon}</span>
            </div>
            <p className="text-base font-bold text-white">{it.value}</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {it.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CityDetail({
  city,
  flights,
  dayCount,
  flightType,
  onClose,
}: {
  city: CityAgg;
  flights: Flight[];
  dayCount: number;
  flightType: "S" | "L";
  onClose: () => void;
}) {
  const perDayCity = city.total / dayCount;
  const freq = inferFreqLabel(perDayCity);
  const airlineList = [...city.airlines.entries()].sort((a, b) => b[1] - a[1]);
  const topAirline = airlineList[0]?.[0] ?? "";
  const countryName = COUNTRY_NAME[IATA_COUNTRY[city.iata] ?? ""] ?? "—";

  // AI comment del destino
  const fetchComment = useServerFn(getDestinationComment);
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(true);
  const [aiError, setAiError] = useState<string | null>(null);
  useEffect(() => {
    const key = `dest-comment:${city.iata}`;
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(key) : null;
    if (cached) {
      setAiText(cached);
      setAiLoading(false);
      return;
    }
    let cancel = false;
    setAiLoading(true);
    setAiError(null);
    fetchComment({
      data: {
        city: cleanCityNamePublic(city.ciudad),
        country: countryName,
        iata: city.iata,
      },
    })
      .then((r) => {
        if (cancel) return;
        setAiText(r.text);
        try { sessionStorage.setItem(key, r.text); } catch {}
      })
      .catch((e) => !cancel && setAiError(String(e?.message ?? e)))
      .finally(() => !cancel && setAiLoading(false));
    return () => { cancel = true; };
  }, [city.iata, city.ciudad, countryName, fetchComment]);


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
              {flightType === "L" ? `${city.iata} → ALC` : `ALC → ${city.iata}`}
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

        {/* AI destination comment + links */}
        <div className="mb-4 rounded-xl border border-slate-700/60 bg-gradient-to-br from-[#1e2a44] via-[#243352] to-[#2d2a4a] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-cyan-300" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/80">
              Sobre {cleanCityNamePublic(city.ciudad)}
            </p>
          </div>
          <div className="min-h-[60px] text-[12.5px] leading-relaxed text-slate-100">
            {aiLoading && (
              <div className="flex items-center gap-2 text-slate-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
                Preparando recomendación…
              </div>
            )}
            {aiError && <p className="text-rose-300">No se pudo cargar el comentario.</p>}
            {!aiLoading && !aiError && <p>{aiText}</p>}
          </div>
          {(() => {
            const dates = Array.from(city.days)
              .filter((d) => /^\d{2}\/\d{2}\/\d{4}$/.test(d))
              .sort((a, b) => {
                const pa = a.split("/"), pb = b.split("/");
                return (
                  new Date(+pa[2], +pa[1] - 1, +pa[0]).getTime() -
                  new Date(+pb[2], +pb[1] - 1, +pb[0]).getTime()
                );
              });
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const next = dates.find((d) => {
              const p = d.split("/");
              return new Date(+p[2], +p[1] - 1, +p[0]).getTime() >= today.getTime();
            }) ?? dates[0];
            const origin = flightType === "L" ? city.iata : "ALC";
            const dest = flightType === "L" ? "ALC" : city.iata;
            const isUK = IATA_COUNTRY[origin] === "GB" || IATA_COUNTRY[dest] === "GB";
            let aviasalesUrl = "https://aviasales.tpo.mx/RkEQT2AP";
            const kiwiBase = "https://c111.travelpayouts.com/click?shmarker=732656&promo_id=3791&source_type=customlink&type=click&custom_url=";
            let kiwiDeep = `https://www.kiwi.com/deep?from=${origin}&to=${dest}`;
            if (next) {
              const dd = next.slice(0, 2);
              const mm = next.slice(3, 5);
              const yyyy = next.slice(6, 10);
              const inner = `https://www.aviasales.com/search/${origin}${dd}${mm}${dest}1`;
              aviasalesUrl = `https://tp.media/r?marker=732656&p=4114&u=${encodeURIComponent(inner)}&campaign_id=100`;
              kiwiDeep = `https://www.kiwi.com/deep?from=${origin}&to=${dest}&departure=${yyyy}-${mm}-${dd}`;
            }
            const kiwiUrl = kiwiBase + encodeURIComponent(kiwiDeep);
            return (
              <>
                <a
                  href={aviasalesUrl}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                >
                  <span>Reservar por</span>
                  <img src={aviasalesLogo.url} alt="Aviasales" className="h-5 w-auto object-contain" />
                </a>
                {isUK && (
                  <a
                    href={kiwiUrl}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2.5 text-[13px] font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100"
                  >
                    <span>Reservar por</span>
                    <img src={kiwiLogo.url} alt="Kiwi.com" className="h-5 w-auto object-contain" />
                  </a>
                )}
              </>
            );
          })()}
        </div>

        {perDay.length > 1 && (
          <div className="mb-4 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-cyan-300" />
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
                Por día de la semana
              </p>
            </div>
            <div className="flex h-32 items-end gap-1.5 px-1">
              {(() => {
                const max = Math.max(...perDay.map((d) => d.total), 1);
                return perDay.map((d) => (
                  <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={`${d.date}: ${d.total}`}>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-gradient-to-b from-cyan-400/95 to-violet-600/60"
                        style={{ height: `${(d.total / max) * 100}%`, minHeight: 2 }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-500">{d.weekday}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {airlineList.length > 1 && (
          <div className="mb-4 rounded-xl border border-slate-800/60 bg-slate-950/60 p-3">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-cyan-400/70">
              Reparto por aerolínea
            </p>
            {(() => {
              const total = airlineList.reduce((s, [, v]) => s + v, 0) || 1;
              return (
                <>
                  <div className="flex h-3 w-full overflow-hidden rounded-full border border-slate-800">
                    {airlineList.map(([code, value], i) => (
                      <div
                        key={code}
                        title={`${code}: ${value}`}
                        style={{
                          width: `${(value / total) * 100}%`,
                          background: airlineColor(code, i),
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                    {airlineList.map(([code, value], i) => (
                      <div key={code} className="flex items-center gap-1.5 text-[10px] text-slate-300">
                        <span
                          className="inline-block h-2 w-2 rounded-sm"
                          style={{ background: airlineColor(code, i) }}
                        />
                        <span className="font-mono">{code}</span>
                        <span className="text-slate-500">
                          {Math.round((value / total) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
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
          Próximos vuelos
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

function CityAutocomplete({
  cities,
  flightType,
}: {
  cities: { iata: string; ciudad: string }[];
  flightType: "S" | "L";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    const sorted = cities
      .slice()
      .sort((a, b) => a.ciudad.localeCompare(b.ciudad, "es"));
    if (!q) return sorted.slice(0, 8);
    return sorted
      .filter(
        (c) =>
          norm(c.ciudad).includes(q) || norm(c.iata).includes(q),
      )
      .slice(0, 8);
  }, [cities, query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, []);

  const go = (iata: string) => {
    if (typeof window !== "undefined") {
      window.open(
        `/vuelos/${iata}?type=${flightType}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
    setQuery("");
    setOpen(false);
  };

  return (
    <div
      ref={wrapRef}
      className="relative mt-3 hidden rounded-2xl border border-cyan-400/30 bg-cyan-400/5 px-3 py-2 lg:mt-0 lg:flex lg:items-center lg:gap-2"
    >
      <label className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/70">
        Tu ciudad:
      </label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = suggestions[highlight];
              if (pick) go(pick.iata);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Escribe tu ciudad…"
          className="w-56 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white placeholder:text-white/40 focus:border-cyan-400/60 focus:outline-none"
          autoComplete="off"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-cyan-400/30 bg-slate-900/95 py-1 text-sm shadow-2xl backdrop-blur">
            {suggestions.map((c, i) => (
              <li key={c.iata}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(c.iata);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={`block w-full px-3 py-1.5 text-left text-white transition ${
                    i === highlight ? "bg-cyan-400/20" : "hover:bg-white/5"
                  }`}
                >
                  {c.ciudad} <span className="text-cyan-300/70">({c.iata})</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {open && query.trim() && suggestions.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-xs text-white/60 backdrop-blur">
            Sin resultados
          </div>
        )}
      </div>
    </div>
  );
}
