import { useMemo, useState } from "react";
import { Loader2, RefreshCw, X, Footprints, Clock, Navigation } from "lucide-react";
import {
  useUserLocation,
  distanceKm,
  estimateMinutes,
  type Coords,
} from "@/hooks/useUserLocation";

// Official Spanish parking sign (S-17): blue rounded square with white "P".
function ParkingSign({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <rect x="4" y="4" width="92" height="92" rx="16" fill="#0a51c4" />
      <rect x="4" y="4" width="92" height="92" rx="16" fill="none" stroke="#ffffff" strokeWidth="3" />
      <text
        x="50"
        y="50"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Helvetica, Arial, sans-serif"
        fontWeight="900"
        fontSize="78"
        fill="#ffffff"
      >
        P
      </text>
    </svg>
  );
}

const ENDPOINT = "https://movilidad.alicante.es/asmpois";

type RawPoi = Record<string, unknown> & {
  id?: string | number;
  title?: string;
  name?: string;
  content_type?: string;
  icono?: string;
  popup?: { content?: string };
  lat?: number | string;
  lng?: number | string;
  lon?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  position?: { lat?: number; lng?: number; lon?: number };
  geo?: { lat?: number; lng?: number; lon?: number };
  coordinates?: number[] | { lat?: number; lng?: number };
};

type Status = "green" | "yellow" | "red" | "unknown";

type ParkingRow = {
  id: string;
  name: string;
  status: Status;
  free?: number;
  total?: number;
  occupancyPct?: number;
  availablePct?: number;
  coords?: Coords;
  popupText?: string;
};

function flattenPois(payload: unknown): RawPoi[] {
  const out: RawPoi[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const obj = v as Record<string, unknown>;
      if ("content_type" in obj || "icono" in obj || "popup" in obj) out.push(obj as RawPoi);
      Object.values(obj).forEach(visit);
    }
  };
  visit(payload);
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = String(p.id ?? JSON.stringify(p).slice(0, 80));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function statusFromIcono(icono?: string): Status {
  if (!icono) return "unknown";
  const i = icono.toLowerCase();
  if (i.includes("green") || i.includes("verde")) return "green";
  if (i.includes("yellow") || i.includes("amber") || i.includes("orange") || i.includes("amarillo")) return "yellow";
  if (i.includes("red") || i.includes("rojo")) return "red";
  return "unknown";
}

function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFreeTotal(text: string): { free?: number; total?: number } {
  const slash = text.match(/(\d{1,4})\s*\/\s*(\d{1,4})/);
  if (slash) return { free: Number(slash[1]), total: Number(slash[2]) };
  const de = text.match(/(\d{1,4})\s+de\s+(\d{1,4})/i);
  if (de) return { free: Number(de[1]), total: Number(de[2]) };
  const libres = text.match(/(?:libres?\s*[:\-]?\s*)(\d{1,4})/i) || text.match(/(\d{1,4})\s*libres?/i);
  const total = text.match(/(?:total|plazas|capacidad)\s*[:\-]?\s*(\d{1,4})/i);
  return {
    free: libres ? Number(libres[1]) : undefined,
    total: total ? Number(total[1]) : undefined,
  };
}

function extractCoords(p: RawPoi): Coords | undefined {
  const toNum = (v: unknown) => (v == null ? NaN : Number(v));
  const tryPair = (lat: unknown, lng: unknown): Coords | undefined => {
    const la = toNum(lat);
    const ln = toNum(lng);
    if (Number.isFinite(la) && Number.isFinite(ln) && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
      return { lat: la, lng: ln };
    }
    return undefined;
  };
  return (
    tryPair(p.lat, p.lng ?? p.lon) ||
    tryPair(p.latitude, p.longitude) ||
    tryPair(p.position?.lat, p.position?.lng ?? p.position?.lon) ||
    tryPair(p.geo?.lat, p.geo?.lng ?? p.geo?.lon) ||
    (Array.isArray(p.coordinates)
      ? tryPair(p.coordinates[1], p.coordinates[0])
      : p.coordinates && typeof p.coordinates === "object"
        ? tryPair((p.coordinates as any).lat, (p.coordinates as any).lng)
        : undefined)
  );
}

function extractNameFromPopup(html: string, fallback: string): string {
  if (!html) return fallback;
  // Try headings / strong first
  const h = html.match(/<h\d[^>]*>([\s\S]*?)<\/h\d>/i);
  if (h) {
    const t = htmlToText(h[1]);
    if (t) return t;
  }
  const strong = html.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i);
  if (strong) {
    const t = htmlToText(strong[1]);
    if (t && !/^\d/.test(t)) return t;
  }
  // First non-empty line of plain text
  const plain = htmlToText(html);
  const first = plain.split(/[.·•\-–|]/)[0]?.trim();
  if (first && first.length > 2 && first.length < 60 && !/^\d/.test(first)) return first;
  return fallback;
}

function extractParkings(payload: unknown): ParkingRow[] {
  return flattenPois(payload)
    .filter((p) => String(p.content_type ?? "").toLowerCase().includes("parking"))
    .map((p) => {
      const popupHtml = p.popup?.content ?? "";
      const popupText = htmlToText(popupHtml);
      const { free, total } = extractFreeTotal(popupText);
      let availablePct: number | undefined;
      let occupancyPct: number | undefined;
      if (free != null && total != null && total > 0) {
        availablePct = Math.max(0, Math.min(100, Math.round((free / total) * 100)));
        occupancyPct = 100 - availablePct;
      }
      const fallbackName = String(p.title ?? p.name ?? "Parking");
      const name = extractNameFromPopup(popupHtml, fallbackName);
      return {
        id: String(p.id ?? name ?? Math.random()),
        name,
        status: statusFromIcono(p.icono),
        free,
        total,
        availablePct,
        occupancyPct,
        coords: extractCoords(p),
        popupText: popupText || undefined,
      };
    });
}


function statusFromPct(availablePct?: number, fallback: Status = "unknown"): Status {
  if (availablePct == null) return fallback;
  if (availablePct <= 10) return "red";
  if (availablePct <= 30) return "yellow";
  return "green";
}

type StyleSet = {
  num: string;
  badgeBg: string;
  pillBg: string;
  pillText: string;
  bar: string;
  ring: string; // donut stroke color (uses currentColor)
  donutText: string;
  label: string;
  shortLabel: string;
  dotBg: string;
};

const STYLES: Record<Status, StyleSet> = {
  green: {
    num: "text-emerald-400",
    badgeBg: "bg-emerald-500",
    pillBg: "bg-emerald-500/15",
    pillText: "text-emerald-300",
    bar: "bg-emerald-500",
    ring: "text-emerald-400",
    donutText: "text-emerald-400",
    label: "FÁCIL APARCAR",
    shortLabel: "Libre",
    dotBg: "bg-emerald-500",
  },
  yellow: {
    num: "text-amber-400",
    badgeBg: "bg-amber-500",
    pillBg: "bg-amber-500/15",
    pillText: "text-amber-300",
    bar: "bg-amber-500",
    ring: "text-amber-400",
    donutText: "text-amber-400",
    label: "OCUPACIÓN MEDIA",
    shortLabel: "Medio",
    dotBg: "bg-amber-500",
  },
  red: {
    num: "text-red-400",
    badgeBg: "bg-red-500",
    pillBg: "bg-red-500/15",
    pillText: "text-red-300",
    bar: "bg-red-500",
    ring: "text-red-400",
    donutText: "text-red-400",
    label: "CASI COMPLETO",
    shortLabel: "Lleno",
    dotBg: "bg-red-500",
  },
  unknown: {
    num: "text-slate-300",
    badgeBg: "bg-slate-500",
    pillBg: "bg-slate-500/15",
    pillText: "text-slate-300",
    bar: "bg-slate-500",
    ring: "text-slate-400",
    donutText: "text-slate-300",
    label: "SIN DATOS",
    shortLabel: "—",
    dotBg: "bg-slate-500",
  },
};

function Donut({ pct, status }: { pct?: number; status: Status }) {
  const value = pct ?? 0;
  const r = 22;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const s = STYLES[status];
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={r} stroke="currentColor" strokeWidth="5" className="text-white/10" fill="none" />
        <circle
          cx="28"
          cy="28"
          r={r}
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={s.ring}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center leading-none">
        <span className={`text-[11px] font-extrabold ${s.donutText}`}>{pct != null ? `${pct}%` : "—"}</span>
      </div>
    </div>
  );
}


// In-memory cache (single-use, brief). Persists across reopens within a few minutes.
const CACHE_TTL_MS = 3 * 60 * 1000;
let cache: { rows: ParkingRow[]; updatedAt: number } | null = null;

export function ParkingsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParkingRow[] | null>(() =>
    cache && Date.now() - cache.updatedAt < CACHE_TTL_MS ? cache.rows : null,
  );
  const [updatedAt, setUpdatedAt] = useState<number | null>(() =>
    cache && Date.now() - cache.updatedAt < CACHE_TTL_MS ? cache.updatedAt : null,
  );

  const { state: locState, request: requestLocation } = useUserLocation();
  const userCoords = locState.status === "ready" ? locState.coords : null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT, { method: "GET", cache: "no-store" });
      const text = await res.text();
      const json = JSON.parse(text);
      const next = extractParkings(json);
      const now = Date.now();
      cache = { rows: next, updatedAt: now };
      setRows(next);
      setUpdatedAt(now);
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar los parkings");
    } finally {
      setLoading(false);
    }
  }

  function openAndLoad() {
    setOpen(true);
    const fresh = cache && Date.now() - cache.updatedAt < CACHE_TTL_MS;
    if (!fresh) void load();
    if (locState.status === "idle") requestLocation();
  }

  const enriched = useMemo(() => {
    if (!rows) return null;
    return rows.map((r) => {
      const status = statusFromPct(r.availablePct, r.status);
      const dist = userCoords && r.coords ? distanceKm(userCoords, r.coords) : null;
      const walkMin = dist != null ? estimateMinutes(dist, "walking") : null;
      return { ...r, status, dist, walkMin };
    });
  }, [rows, userCoords]);

  const displayed = useMemo(() => {
    if (!enriched) return null;
    return [...enriched]
      .sort((a, b) => (a.dist ?? Number.POSITIVE_INFINITY) - (b.dist ?? Number.POSITIVE_INFINITY))
      .slice(0, 6);
  }, [enriched]);

  const secondsAgo = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;

  return (
    <>
      <button
        onClick={openAndLoad}
        aria-label="Parkings de Alicante"
        className="flex h-9 w-9 items-center justify-center rounded-md active:scale-95 transition lg:h-10 lg:w-10"
      >
        <ParkingSign className="h-8 w-8 lg:h-9 lg:w-9 drop-shadow-sm" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[96vh] overflow-hidden rounded-t-3xl bg-[#0b1220] text-slate-100 shadow-2xl ring-1 ring-white/5 sm:rounded-3xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header — compact */}
            <header className="relative flex items-center justify-center px-4 pt-3 pb-2 shrink-0">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <ParkingSign className="h-4 w-4" />
                  <h2 className="text-[15px] font-extrabold tracking-tight">Parkings Alicante</h2>
                </div>
                <p className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
                  En tiempo real
                  {secondsAgo != null && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      hace {secondsAgo}s
                    </span>
                  )}
                </p>
              </div>
              <div className="absolute right-2 top-2 flex items-center gap-0.5">
                <button
                  onClick={load}
                  disabled={loading}
                  aria-label="Recargar"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-hidden px-3 pb-3">
              {error && (
                <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] text-red-300 ring-1 ring-red-500/30">
                  {error}
                </div>
              )}

              {loading && !rows && (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}

              {displayed && displayed.length > 0 && (
                <ul className="grid h-full grid-rows-6 gap-1.5">
                  {displayed.map((r) => {
                    const s = STYLES[r.status];
                    return (
                    const href = r.coords
                      ? `https://www.google.com/maps/dir/?api=1&destination=${r.coords.lat},${r.coords.lng}&travelmode=driving`
                      : undefined;
                    return (
                      <li key={r.id} className="contents">
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={href ? `Cómo llegar en coche a ${r.name}` : r.name}
                          className="flex items-center gap-2.5 rounded-xl bg-[#111a2e] px-2.5 py-2 ring-1 ring-white/5 hover:bg-[#162041] hover:ring-sky-400/30 active:scale-[0.99] transition"
                        >
                          {/* P badge */}
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${s.badgeBg} text-white font-extrabold text-[13px] shadow-md`}
                          >
                            P
                          </div>

                          {/* Name + status pill + meta */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-extrabold leading-tight text-white">
                              {r.name}
                            </p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-slate-400">
                              <span
                                className={`rounded px-1 py-[1px] text-[8.5px] font-extrabold tracking-wide ${s.pillBg} ${s.pillText}`}
                              >
                                {r.occupancyPct != null ? `${r.occupancyPct}% ocupado` : s.label}
                              </span>
                              {r.walkMin != null && (
                                <span className="flex items-center gap-0.5">
                                  <Footprints className="h-2.5 w-2.5" />
                                  {r.walkMin}′
                                </span>
                              )}
                              <span className="font-mono text-slate-500">
                                {r.free ?? "—"}/{r.total ?? "—"}
                              </span>
                            </div>
                            {/* mini progress bar (ocupación) */}
                            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                              <div
                                className={`h-full ${s.bar} transition-all`}
                                style={{ width: `${r.occupancyPct ?? 0}%` }}
                              />
                            </div>
                          </div>

                          {/* Big number */}
                          <div className="flex shrink-0 flex-col items-end leading-none">
                            <span className={`font-mono text-[20px] font-extrabold ${s.num}`}>
                              {r.free != null ? r.free : "—"}
                            </span>
                            <span className="text-[9px] text-slate-400">libres</span>
                          </div>

                          {/* Donut — % ocupación */}
                          <Donut pct={r.occupancyPct} status={r.status} />
                        </a>
                      </li>
                    );
                    );
                  })}
                </ul>
              )}

              {displayed && displayed.length === 0 && !loading && (
                <p className="py-8 text-center text-[12px] text-slate-400">
                  No hay parkings disponibles ahora mismo.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

