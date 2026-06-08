import { useEffect, useState } from "react";
import { Car, Loader2, RefreshCw, X, MapPin } from "lucide-react";
import {
  useUserLocation,
  distanceKm,
  formatDistance,
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
      ? // GeoJSON convention: [lng, lat]
        tryPair(p.coordinates[1], p.coordinates[0])
      : p.coordinates && typeof p.coordinates === "object"
        ? tryPair((p.coordinates as any).lat, (p.coordinates as any).lng)
        : undefined)
  );
}

function extractParkings(payload: unknown): ParkingRow[] {
  return flattenPois(payload)
    .filter((p) => String(p.content_type ?? "").toLowerCase().includes("parking"))
    .map((p) => {
      const popupHtml = p.popup?.content ?? "";
      const popupText = htmlToText(popupHtml);
      const { free, total } = extractFreeTotal(popupText);
      const occupancyPct =
        free != null && total != null && total > 0
          ? Math.max(0, Math.min(100, Math.round(((total - free) / total) * 100)))
          : undefined;
      return {
        id: String(p.id ?? p.title ?? Math.random()),
        name: String(p.title ?? p.name ?? "Parking"),
        status: statusFromIcono(p.icono),
        free,
        total,
        occupancyPct,
        coords: extractCoords(p),
        popupText: popupText || undefined,
      };
    });
}

function statusFromOccupancy(pct?: number, fallback: Status = "unknown"): Status {
  if (pct == null) return fallback;
  if (pct >= 90) return "red";
  if (pct >= 70) return "yellow";
  return "green";
}

const STATUS_STYLES: Record<Status, { bar: string; chip: string; text: string; ring: string; dot: string; label: string }> = {
  green: {
    bar: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    text: "text-emerald-600",
    ring: "ring-emerald-500/40",
    dot: "bg-emerald-500",
    label: "Libre",
  },
  yellow: {
    bar: "bg-amber-500",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    text: "text-amber-600",
    ring: "ring-amber-500/40",
    dot: "bg-amber-500",
    label: "Casi lleno",
  },
  red: {
    bar: "bg-red-500",
    chip: "bg-red-500/15 text-red-700 dark:text-red-300",
    text: "text-red-600",
    ring: "ring-red-500/40",
    dot: "bg-red-500",
    label: "Completo",
  },
  unknown: {
    bar: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    ring: "ring-border",
    dot: "bg-muted-foreground/40",
    label: "Sin datos",
  },
};

export function ParkingsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParkingRow[] | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

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

  // Order: distance ASC (if available), then by occupancy
  const sorted = rows
    ? [...rows]
        .map((r) => ({
          ...r,
          _dist:
            userCoords && r.coords ? distanceKm(userCoords, r.coords) : Number.POSITIVE_INFINITY,
        }))
        .sort((a, b) => a._dist - b._dist)
    : null;

  // Limit to 6 main parkings
  const displayed = sorted?.slice(0, 6);

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
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[88vh] overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                  <Car className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold leading-tight">Parkings Alicante</h2>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    {updatedAt ? `Actualizado ${new Date(updatedAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}` : "En vivo"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={load}
                  disabled={loading}
                  aria-label="Recargar"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="overflow-y-auto px-3 py-3" style={{ maxHeight: "calc(88vh - 64px)" }}>
              {locState.status !== "ready" && (
                <button
                  onClick={requestLocation}
                  className="mb-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary active:scale-[0.99]"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {locState.status === "loading" ? "Obteniendo tu ubicación…" : "Activar mi ubicación para ver distancias"}
                </button>
              )}

              {error && (
                <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</div>
              )}

              {loading && !rows && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}

              {displayed && (
                <ul className="grid grid-cols-1 gap-2">
                  {displayed.map((r) => {
                    const status = statusFromOccupancy(r.occupancyPct, r.status);
                    const s = STATUS_STYLES[status];
                    const pct = r.occupancyPct;
                    return (
                      <li
                        key={r.id}
                        className={`rounded-2xl border border-border/60 bg-card p-3 ring-1 ${s.ring}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${s.dot} shadow-[0_0_8px_currentColor]`} />
                              <p className="truncate text-[13px] font-extrabold leading-tight">{r.name}</p>
                            </div>
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${s.chip}`}>
                            {s.label}
                          </span>
                        </div>

                        {/* Status / occupancy bar */}
                        <div className="mt-2.5">
                          <div className="flex items-baseline justify-between text-[10px] text-muted-foreground">
                            <span>Ocupación</span>
                            <span className={`font-mono text-[11px] font-bold ${s.text}`}>
                              {pct != null ? `${pct}%` : "—"}
                            </span>
                          </div>
                          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full ${s.bar} transition-all`}
                              style={{ width: `${pct ?? 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Metrics row */}
                        <div className="mt-2.5 grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Plazas libres</p>
                            <p className={`font-mono text-[15px] font-extrabold leading-none ${s.text}`}>
                              {r.free != null ? r.free : "—"}
                              {r.total != null && (
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {" "}/ {r.total}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 px-2 py-1.5">
                            <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Distancia</p>
                            <p className="font-mono text-[15px] font-extrabold leading-none text-foreground">
                              {userCoords && r.coords && Number.isFinite((r as any)._dist)
                                ? formatDistance((r as any)._dist)
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {rows && rows.length === 0 && !loading && (
                <p className="py-8 text-center text-[12px] text-muted-foreground">
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
