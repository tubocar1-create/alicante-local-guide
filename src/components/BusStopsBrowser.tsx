import { useMemo, useState } from "react";
import { Bus, Loader2, Play, ChevronLeft } from "lucide-react";
import {
  detectStopsFromHtml,
  parseStopFromDoc,
  type BusStopData,
  type DetectedStop,
} from "@/lib/bus-stop-parser";

const DEFAULT_PAGE_URL = "https://movilidad.alicante.es/paradas-de-bus?page=32";

type LoadDebug = {
  fetchMs: number;
  parseMs: number;
  htmlBytes: number;
  stopsCount: number;
};

function etaBadgeClass(min: number | null): string {
  if (min == null) return "bg-muted/60 text-muted-foreground ring-border";
  if (min < 5) return "bg-green-500/20 text-green-300 ring-green-400/40";
  if (min <= 15) return "bg-amber-500/20 text-amber-300 ring-amber-400/40";
  return "bg-zinc-500/20 text-zinc-300 ring-zinc-400/40";
}

export function BusStopsBrowser() {
  const [pageUrl, setPageUrl] = useState<string>(DEFAULT_PAGE_URL);
  const [loading, setLoading] = useState(false);
  const [doc, setDoc] = useState<Document | null>(null);
  const [stops, setStops] = useState<DetectedStop[]>([]);
  const [dbg, setDbg] = useState<LoadDebug | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BusStopData | null>(null);
  const [filter, setFilter] = useState("");

  async function loadPage() {
    setLoading(true);
    setError(null);
    setSelected(null);
    setDoc(null);
    setStops([]);
    setDbg(null);
    const t0 = performance.now();
    try {
      const res = await fetch(pageUrl.trim(), { cache: "no-store" });
      const html = await res.text();
      const fetchMs = Math.round(performance.now() - t0);
      const htmlBytes = new Blob([html]).size;
      const t1 = performance.now();
      const { doc: d, stops: s } = detectStopsFromHtml(html);
      const parseMs = Math.round(performance.now() - t1);
      setDoc(d);
      setStops(s);
      setDbg({ fetchMs, parseMs, htmlBytes, stopsCount: s.length });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  function selectStop(stopId: number) {
    if (!doc) return;
    const parsed = parseStopFromDoc(doc, stopId);
    if (parsed) {
      setSelected(parsed);
    } else {
      const fallback = stops.find((s) => s.stopId === stopId);
      setSelected({
        stopId,
        stopName: fallback?.name ?? "",
        arrivals: [],
      });
    }
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return stops;
    return stops.filter(
      (s) => String(s.stopId).includes(q) || s.name.toLowerCase().includes(q)
    );
  }, [stops, filter]);

  return (
    <div className="mb-3 rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/5 to-purple-500/5 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <Bus className="h-4 w-4 text-fuchsia-400" />
        <h3 className="text-[12px] font-bold tracking-wide">
          🚌 Paradas detectadas en esta página
        </h3>
      </div>

      <div className="flex items-center gap-1">
        <input
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          placeholder={DEFAULT_PAGE_URL}
          className="min-w-0 flex-1 rounded-lg border border-fuchsia-500/30 bg-background/60 px-2 py-1.5 text-[11px] font-mono"
        />
        <button
          onClick={loadPage}
          disabled={loading || !pageUrl.trim()}
          className="flex h-8 items-center gap-1 rounded-lg bg-fuchsia-500 px-3 text-[11px] font-bold text-black ring-1 ring-fuchsia-700/40 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          CARGAR
        </button>
      </div>

      {dbg && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          ⏱ {dbg.fetchMs}ms fetch · 🧠 {dbg.parseMs}ms parse · 📦{" "}
          {(dbg.htmlBytes / 1024).toFixed(1)}KB · 🚏 {dbg.stopsCount} paradas
          {selected && (
            <>
              {" "}· 🎯 <span className="font-mono">{selected.stopId}</span>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      {!selected && stops.length > 0 && (
        <>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por id o nombre…"
            className="mt-2 w-full rounded-lg border border-border/60 bg-background/60 px-2 py-1.5 text-[11px]"
          />
          <div className="mt-2 grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto pr-1">
            {visible.map((s) => (
              <button
                key={s.stopId}
                onClick={() => selectStop(s.stopId)}
                className="group rounded-xl border border-fuchsia-400/20 bg-card/60 p-2 text-left backdrop-blur-md transition hover:border-fuchsia-400/60 hover:bg-fuchsia-500/10 hover:shadow-[0_0_20px_-5px_rgba(217,70,239,0.6)] active:scale-[0.98]"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🚌</span>
                  <span className="font-mono text-[12px] font-black text-fuchsia-300">
                    {s.stopId}
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight">
                  {s.name}
                </div>
              </button>
            ))}
            {visible.length === 0 && (
              <div className="col-span-2 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Sin coincidencias.
              </div>
            )}
          </div>
        </>
      )}

      {selected && (
        <div className="mt-3 space-y-2">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-1 text-[11px] font-bold text-fuchsia-300 hover:text-fuchsia-200"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            volver a la lista ({stops.length})
          </button>

          <div className="rounded-xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/10 p-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-base">🚌</span>
              <div>
                <div className="font-mono text-[11px] font-bold text-fuchsia-300">
                  {selected.stopId}
                </div>
                <div className="text-[13px] font-bold leading-tight">
                  {selected.stopName || "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            {selected.arrivals.length === 0 && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Sin llegadas disponibles en el HTML de esta página.
              </div>
            )}
            {selected.arrivals.map((a, i) => (
              <div
                key={`${a.line}|${a.destination}|${i}`}
                className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 p-2 backdrop-blur-sm"
              >
                <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-fuchsia-500 px-2 text-[12px] font-black text-black">
                  {a.line || "?"}
                </span>
                <span className="text-[11px]">→</span>
                <span className="flex-1 truncate text-[12px] font-semibold">
                  {a.destination}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${etaBadgeClass(a.etaMinutes)}`}
                >
                  {a.etaMinutes != null ? `${a.etaMinutes} min` : a.etaText || "—"}
                </span>
              </div>
            ))}
          </div>

          <details>
            <summary className="cursor-pointer text-[10px] font-bold text-muted-foreground">
              JSON
            </summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted/60 p-2 text-[10px] leading-tight">
{JSON.stringify(selected, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
