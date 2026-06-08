import { useState } from "react";
import { Car, Loader2, RefreshCw, X } from "lucide-react";

const ENDPOINT = "https://movilidad.alicante.es/asmpois";

type RawPoi = Record<string, unknown> & {
  id?: string;
  title?: string;
  name?: string;
  content_type?: string;
  icono?: string;
  popup?: { content?: string };
};

type Status = "green" | "yellow" | "red" | "unknown";

type ParkingRow = {
  raw: RawPoi;
  id: string;
  name: string;
  status: Status;
  free?: number;
  total?: number;
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
  // dedupe by id
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
  if (i.includes("green")) return "green";
  if (i.includes("yellow") || i.includes("amber") || i.includes("orange")) return "yellow";
  if (i.includes("red")) return "red";
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
  // Patrones típicos: "123 libres", "Libres: 45", "45 / 200", "45 de 200"
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

function extractParkings(payload: unknown): ParkingRow[] {
  return flattenPois(payload)
    .filter((p) => String(p.content_type ?? "").toLowerCase().includes("parking"))
    .map((p) => {
      const popupHtml = p.popup?.content ?? "";
      const popupText = htmlToText(popupHtml);
      const { free, total } = extractFreeTotal(popupText);
      return {
        raw: p,
        id: String(p.id ?? ""),
        name: String(p.title ?? p.name ?? "Parking"),
        status: statusFromIcono(p.icono),
        free,
        total,
        popupText: popupText || undefined,
      };
    });
}

const STATUS_LABEL: Record<Status, string> = {
  green: "Libre",
  yellow: "Lleno parcial",
  red: "Completo",
  unknown: "—",
};

const STATUS_DOT: Record<Status, string> = {
  green: "bg-green-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
  unknown: "bg-muted-foreground/40",
};

export function ParkingsButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ParkingRow[] | null>(null);
  const [meta, setMeta] = useState<{ ms: number; bytes: number; total: number } | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const t0 = performance.now();
    try {
      const res = await fetch(ENDPOINT, { method: "GET", cache: "no-store" });
      const text = await res.text();
      const ms = Math.round(performance.now() - t0);
      const bytes = new Blob([text]).size;
      const json = JSON.parse(text);
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
              </p>

              {meta && (
                <div className="mb-3 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                  ⏱ {meta.ms} ms · 📦 {(meta.bytes / 1024).toFixed(1)} KB · 🅿️ {meta.total} parkings
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
                <ul className="space-y-2">
                  {rows.map((r) => (
                    <li key={r.id || r.name} className="rounded-xl border border-border/60 bg-card p-3">
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1 inline-block h-3 w-3 shrink-0 rounded-full ${STATUS_DOT[r.status]}`}
                          aria-label={STATUS_LABEL[r.status]}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-bold leading-tight">{r.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Estado: <b>{STATUS_LABEL[r.status]}</b>
                            {r.free != null && (
                              <>
                                {" · "}
                                <span className="font-mono tabular-nums">
                                  <b className="text-green-600">{r.free}</b>
                                  {r.total != null && <span>/{r.total}</span>} libres
                                </span>
                              </>
                            )}
                          </p>
                          {r.popupText && (
                            <details className="mt-1.5">
                              <summary className="cursor-pointer text-[10px] text-muted-foreground">
                                Texto del popup
                              </summary>
                              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{r.popupText}</p>
                            </details>
                          )}
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[10px] text-muted-foreground">Raw JSON</summary>
                            <pre className="mt-1 overflow-x-auto rounded bg-muted/60 p-2 text-[10px] leading-tight">
                              {JSON.stringify(r.raw, null, 2)}
                            </pre>
                          </details>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
