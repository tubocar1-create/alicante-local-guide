import { useState } from "react";
import { Car, Loader2, RefreshCw, X } from "lucide-react";

const ENDPOINT = "https://movilidad.alicante.es/asmpois";

// Los 6 parkings públicos de Alicante (Smart Parking municipal)
const TARGET_PARKINGS = [
  "Mercado",
  "Plaza Mar",
  "Cervantes",
  "Séneca",
  "Campoamor",
  "Portal de Elche",
];

type RawPoi = Record<string, unknown> & {
  name?: string;
  title?: string;
  content_type?: string;
  type?: string;
  free?: number | string;
  total?: number | string;
  occupation?: number | string;
};

type ParkingRow = {
  raw: RawPoi;
  name: string;
  free?: number;
  total?: number;
  pct?: number;
};

function pickNumber(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return undefined;
}

function extractParkings(payload: unknown): ParkingRow[] {
  // Encuentra array de POIs en cualquier nivel
  const arrays: RawPoi[][] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) {
      if (v.length && typeof v[0] === "object" && v[0] !== null) arrays.push(v as RawPoi[]);
      else v.forEach(visit);
    } else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(visit);
    }
  };
  visit(payload);

  const all: RawPoi[] = arrays.flat();
  // Filtra los que parecen parking
  const isParking = (p: RawPoi) => {
    const blob = JSON.stringify(p).toLowerCase();
    return (
      blob.includes("parking") ||
      blob.includes("aparcam") ||
      blob.includes("smart_parking") ||
      blob.includes("smartparking")
    );
  };
  const parkings = all.filter(isParking);

  // Mapea a filas
  const rows: ParkingRow[] = parkings.map((p) => {
    const name = String(p.name ?? p.title ?? "Parking");
    const free = pickNumber(p.free) ?? pickNumber((p as any).libres) ?? pickNumber((p as any).available);
    const total = pickNumber(p.total) ?? pickNumber((p as any).plazas) ?? pickNumber((p as any).capacity);
    const pct =
      free != null && total && total > 0 ? Math.round((free / total) * 100) : pickNumber((p as any).occupation);
    return { raw: p, name, free, total, pct };
  });

  return rows;
}

export function ParkingsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParkingRow[] | null>(null);
  const [meta, setMeta] = useState<{ ms: number; bytes: number; total: number } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setRows(null);
    setMeta(null);
    const t0 = performance.now();
    try {
      const res = await fetch(ENDPOINT, { method: "GET", cache: "no-store" });
      const text = await res.text();
      const ms = Math.round(performance.now() - t0);
      const bytes = new Blob([text]).size;
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`Respuesta no es JSON (HTTP ${res.status})`);
      }
      const all = extractParkings(json);
      setMeta({ ms, bytes, total: all.length });
      setRows(all);
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  function openAndLoad() {
    setOpen(true);
    void load();
  }

  return (
    <>
      <button
        onClick={openAndLoad}
        aria-label="Prueba parkings"
        className="flex h-9 items-center gap-1.5 rounded-full bg-amber-400 px-3 text-[11px] font-bold text-black ring-1 ring-amber-600/50 shadow-sm active:scale-95"
      >
        <Car className="h-3.5 w-3.5" />
        Parkings (test)
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md max-h-[85vh] overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Car className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Parkings — test en vivo</h2>
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

            <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(85vh - 56px)" }}>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Llamada directa desde tu navegador a <code className="font-mono">movilidad.alicante.es/asmpois</code>.
                Sin proxy. Sin caché.
              </p>

              {meta && (
                <div className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                  ⏱ {meta.ms} ms · 📦 {(meta.bytes / 1024).toFixed(1)} KB · 🅿️ {meta.total} parkings detectados
                </div>
              )}

              {error && (
                <div className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</div>
              )}

              {loading && !rows && (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}

              {rows && (
                <>
                  {/* Resumen de los 6 objetivo */}
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Los 6 parkings municipales
                  </h3>
                  <ul className="mb-4 space-y-1.5">
                    {TARGET_PARKINGS.map((target) => {
                      const match = rows.find((r) =>
                        r.name.toLowerCase().includes(target.toLowerCase()),
                      );
                      return (
                        <li
                          key={target}
                          className="flex items-center justify-between rounded-lg border border-border/60 bg-card px-3 py-2"
                        >
                          <span className="text-[13px] font-semibold">{target}</span>
                          {match ? (
                            <span className="text-[12px] font-mono tabular-nums">
                              {match.free != null && match.total != null ? (
                                <>
                                  <span className="font-bold text-green-600">{match.free}</span>
                                  <span className="text-muted-foreground">/{match.total}</span>
                                </>
                              ) : (
                                <span className="text-muted-foreground">sin datos numéricos</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">no encontrado</span>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Lista completa filtrada */}
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    Crudo ({rows.length})
                  </h3>
                  <ul className="space-y-2">
                    {rows.map((r, i) => (
                      <li key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-semibold truncate">{r.name}</span>
                          {r.free != null && r.total != null && (
                            <span className="text-[11px] font-mono tabular-nums">
                              {r.free}/{r.total}
                            </span>
                          )}
                        </div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-muted-foreground">Ver raw</summary>
                          <pre className="mt-1 overflow-x-auto rounded bg-background/80 p-2 text-[10px] leading-tight">
                            {JSON.stringify(r.raw, null, 2)}
                          </pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
