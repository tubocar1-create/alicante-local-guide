import { useMemo, useState } from "react";
import { Car, Loader2, RefreshCw, X, MapPin, Navigation, Footprints, LayoutGrid, Crosshair } from "lucide-react";
import {
  useUserLocation,
  distanceKm,
  estimateMinutes,
  type Coords,
} from "@/hooks/useUserLocation";

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
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  const s = STYLES[status];
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={r} stroke="currentColor" strokeWidth="6" className="text-white/10" fill="none" />
        <circle
          cx="32"
          cy="32"
          r={r}
          stroke="currentColor"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={s.ring}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={`text-[14px] font-extrabold ${s.donutText}`}>{pct != null ? `${pct}%` : "—"}</span>
        <span className="mt-0.5 text-[8px] text-white/50">disponible</span>
      </div>
    </div>
  );
}

type Filter = "all" | "green" | "yellow" | "red" | "near";

export function ParkingsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParkingRow[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const { state: locState, request: requestLocation } = useUserLocation();
  const userCoords = locState.status === "ready" ? locState.coords : null;

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(ENDPOINT, { method: "GET", cache: "no-store" });
      const text = await res.text();
      const json = JSON.parse(text);
      setRows(extractParkings(json));
      setUpdatedAt(Date.now());
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar los parkings");
    } finally {
      setLoading(false);
    }
  }

  function openAndLoad() {
    setOpen(true);
    if (!rows) void load();
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

  const sorted = useMemo(() => {
    if (!enriched) return null;
    return [...enriched].sort((a, b) => {
      const da = a.dist ?? Number.POSITIVE_INFINITY;
      const db = b.dist ?? Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [enriched]);

  const filtered = useMemo(() => {
    if (!sorted) return null;
    let list = sorted;
    if (filter === "near") {
      list = sorted.filter((r) => r.dist != null);
    } else if (filter !== "all") {
      list = sorted.filter((r) => r.status === filter);
    }
    return list.slice(0, 6);
  }, [sorted, filter]);

  const counts = useMemo(() => {
    const c = { green: 0, yellow: 0, red: 0 };
    enriched?.slice(0, 6).forEach((r) => {
      if (r.status === "green") c.green++;
      else if (r.status === "yellow") c.yellow++;
      else if (r.status === "red") c.red++;
    });
    return c;
  }, [enriched]);

  const secondsAgo = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null;

  return (
    <>
      <button
        onClick={openAndLoad}
        aria-label="Parkings de Alicante"
        className="flex h-9 items-center gap-1.5 rounded-full bg-white/70 px-2.5 ring-1 ring-border/60 active:scale-95 transition lg:h-10 lg:px-3"
      >
        <Car className="h-4 w-4 text-[oklch(0.55_0.18_255)] lg:h-5 lg:w-5" />
        <span className="text-[12px] font-bold leading-tight text-foreground lg:text-[14px]">P</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[92vh] overflow-hidden rounded-t-3xl bg-[#0b1220] text-slate-100 shadow-2xl ring-1 ring-white/5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <header className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex-1">
                <div className="flex items-center justify-center gap-2">
                  <Car className="h-5 w-5 text-white" />
                  <h2 className="text-[18px] font-extrabold tracking-tight">Parkings Alicante</h2>
                </div>
                <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
                  En tiempo real
                  {secondsAgo != null && <span>· Actualizado hace {secondsAgo} seg</span>}
                </p>
              </div>
              <div className="absolute right-3 top-3 flex items-center gap-1">
                <button
                  onClick={load}
                  disabled={loading}
                  aria-label="Recargar"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/10 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            {/* Filter chips */}
            <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {([
                { id: "all", label: "Todos", icon: LayoutGrid, color: "bg-emerald-500" },
                { id: "green", label: "Libres", icon: null, color: "bg-emerald-500" },
                { id: "yellow", label: "Medios", icon: null, color: "bg-amber-500" },
                { id: "red", label: "Llenos", icon: null, color: "bg-red-500" },
                { id: "near", label: "Cerca de mí", icon: Navigation, color: "bg-sky-500" },
              ] as { id: Filter; label: string; icon: any; color: string }[]).map((f) => {
                const active = filter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={[
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition active:scale-95",
                      active
                        ? "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.4)]"
                        : "bg-white/5 text-slate-300 ring-1 ring-white/10",
                    ].join(" ")}
                  >
                    {f.icon ? (
                      <f.icon className="h-3 w-3" />
                    ) : (
                      <span className={`inline-block h-2 w-2 rounded-full ${f.color}`} />
                    )}
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto px-3 pb-4" style={{ maxHeight: "calc(92vh - 130px)" }}>
              {locState.status !== "ready" && (
                <button
                  onClick={requestLocation}
                  className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-sky-500/10 px-3 py-2 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/30 active:scale-[0.99]"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {locState.status === "loading" ? "Obteniendo tu ubicación…" : "Activar mi ubicación para ver distancias"}
                </button>
              )}

              {error && (
                <div className="mb-3 rounded-xl bg-red-500/10 px-3 py-2 text-[12px] text-red-300 ring-1 ring-red-500/30">{error}</div>
              )}

              {loading && !rows && (
                <div className="flex items-center justify-center py-10 text-slate-400">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}

              {filtered && filtered.length > 0 && (
                <ul className="space-y-2.5">
                  {filtered.map((r) => {
                    const s = STYLES[r.status];
                    return (
                      <li
                        key={r.id}
                        className="rounded-2xl bg-[#111a2e] p-3 ring-1 ring-white/5"
                      >
                        <div className="flex items-start gap-3">
                          {/* P badge */}
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.badgeBg} text-white font-extrabold text-[16px] shadow-lg`}
                          >
                            P
                          </div>

                          {/* Name + meta */}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-extrabold leading-tight text-white">{r.name}</p>
                            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Alicante
                              </span>
                              {r.walkMin != null && (
                                <span className="flex items-center gap-1">
                                  <Footprints className="h-3 w-3" />
                                  {r.walkMin} min andando
                                </span>
                              )}
                            </div>
                            <span
                              className={`mt-1.5 inline-flex rounded-md px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide ${s.pillBg} ${s.pillText}`}
                            >
                              {s.label}
                            </span>
                          </div>

                          {/* Big number */}
                          <div className="flex shrink-0 flex-col items-end leading-none">
                            <span className={`font-mono text-[28px] font-extrabold ${s.num}`}>
                              {r.free != null ? r.free : "—"}
                            </span>
                            <span className="mt-0.5 text-[10px] text-slate-400">libres</span>
                          </div>

                          {/* Donut */}
                          <Donut pct={r.availablePct} status={r.status} />
                        </div>

                        {/* Progress bar */}
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className={`font-mono text-[11px] font-bold ${s.num}`}>
                            {r.free ?? "—"}
                          </span>
                          <span className="text-[10px] text-slate-500">/ {r.total ?? "—"} plazas</span>
                          <div className="ml-1 h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className={`h-full ${s.bar} transition-all`}
                              style={{ width: `${r.availablePct ?? 0}%` }}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {filtered && filtered.length === 0 && (
                <p className="py-8 text-center text-[12px] text-slate-400">
                  Ningún parking en este filtro.
                </p>
              )}

              {/* Summary footer */}
              {enriched && enriched.length > 0 && (
                <div className="mt-3 flex items-center gap-2 rounded-2xl bg-[#111a2e] px-3 py-2.5 ring-1 ring-white/5">
                  <SummaryChip color="emerald" icon={<Car className="h-4 w-4 text-emerald-400" />} value={counts.green} label="Fáciles" />
                  <SummaryChip color="amber" icon={<Car className="h-4 w-4 text-amber-400" />} value={counts.yellow} label="Medios" />
                  <SummaryChip color="red" icon={<Car className="h-4 w-4 text-red-400" />} value={counts.red} label="Llenos" />
                  {userCoords && (
                    <div className="ml-auto flex items-center gap-1 text-[10px] text-slate-400">
                      <Crosshair className="h-3 w-3 text-sky-400" />
                      Tu ubicación
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SummaryChip({ icon, value, label }: { color: string; icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5">
      {icon}
      <div className="leading-none">
        <p className="font-mono text-[15px] font-extrabold text-white">{value}</p>
        <p className="text-[9px] text-slate-400">{label}</p>
      </div>
    </div>
  );
}
