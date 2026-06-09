import { useEffect, useRef, useState } from "react";
import { Bus, Loader2, Play, RefreshCw } from "lucide-react";
import { extractStopFromPage, type BusStopData, type ExtractResult } from "@/lib/bus-stop-parser";
import { supabase } from "@/integrations/supabase/client";

const PAGE_BASE = "https://movilidad.alicante.es/paradas-de-bus?page=";
type EtaDelta = "up" | "down" | "same" | "new";

export function BusStopExtractor() {
  const [stopIdText, setStopIdText] = useState<string>("5110");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [resolvedPage, setResolvedPage] = useState<number | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const prevRef = useRef<BusStopData | null>(null);
  const [deltas, setDeltas] = useState<Record<string, EtaDelta>>({});

  const stopId = stopIdText.trim();

  async function run() {
    if (!stopId) return;
    setLoading(true);
    setResolveError(null);
    setResolvedPage(null);

    const { data, error } = await supabase
      .from("bus_stop_catalog")
      .select("page_number, source_url")
      .eq("stop_id", stopId)
      .maybeSingle();

    if (error || !data) {
      setResolveError(
        error?.message ??
          `Parada ${stopId} no está en el catálogo. Indéxala primero con el constructor.`,
      );
      setResult(null);
      setLoading(false);
      return;
    }

    const pageUrl = data.source_url || `${PAGE_BASE}${data.page_number}`;
    setResolvedPage(data.page_number);

    const r = await extractStopFromPage(pageUrl, stopId);
    if (r.stop && prevRef.current && prevRef.current.stopId === r.stop.stopId) {
      const d: Record<string, EtaDelta> = {};
      r.stop.arrivals.forEach((a, i) => {
        const key = `${a.line}|${a.destination}|${i}`;
        const prev = prevRef.current!.arrivals[i];
        if (!prev) d[key] = "new";
        else if (a.etaMinutes == null || prev.etaMinutes == null) d[key] = "same";
        else if (a.etaMinutes > prev.etaMinutes) d[key] = "up";
        else if (a.etaMinutes < prev.etaMinutes) d[key] = "down";
        else d[key] = "same";
      });
      setDeltas(d);
    } else {
      setDeltas({});
    }
    prevRef.current = r.stop;
    setResult(r);
    setLoading(false);
  }

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void run(), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, stopId]);

  const stop = result?.stop ?? null;
  const dbg = result?.debug;

  return (
    <div className="mb-3 rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 p-3 backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <Bus className="h-4 w-4 text-cyan-400" />
        <h3 className="text-[12px] font-bold tracking-wide">Extractor de parada</h3>
      </div>

      <div className="flex items-center gap-1">
        <input
          type="number"
          inputMode="numeric"
          value={stopId}
          onChange={(e) => setStopId(parseInt(e.target.value || "0", 10) || 0)}
          placeholder="5110"
          className="h-8 w-24 min-w-0 rounded-lg border border-cyan-500/30 bg-background/60 px-2 text-[12px] font-mono font-bold"
        />
        <button
          onClick={run}
          disabled={loading || !stopId}
          className="flex h-8 items-center gap-1 rounded-lg bg-cyan-500 px-3 text-[11px] font-bold text-black ring-1 ring-cyan-700/40 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          EXTRAER
        </button>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={`flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold ring-1 ${
            autoRefresh
              ? "bg-teal-500 text-black ring-teal-700/40"
              : "bg-background/60 text-muted-foreground ring-border"
          }`}
          title="Refresca cada 60s"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${autoRefresh ? "animate-spin-slow" : ""}`} />
          AUTO
        </button>
      </div>

      {dbg && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          ⏱ {dbg.fetchMs}ms · 📦 {(dbg.htmlBytes / 1024).toFixed(1)}KB · 🚌 {dbg.arrivalsFound} llegadas
          {dbg.error && <span className="text-destructive"> · {dbg.error}</span>}
        </div>
      )}

      {result && !stop && !dbg?.error && (
        <div className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
          Parada {stopId} no encontrada en esta página.
        </div>
      )}

      {stop && (
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/10 to-teal-500/10 p-3 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <span className="text-base">🚌</span>
              <div>
                <div className="text-[11px] font-mono font-bold text-cyan-300">{stop.stopId}</div>
                <div className="text-[13px] font-bold leading-tight">{stop.stopName || "—"}</div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            {stop.arrivals.length === 0 && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Sin llegadas disponibles.
              </div>
            )}
            {stop.arrivals.map((a, i) => {
              const key = `${a.line}|${a.destination}|${i}`;
              const d = deltas[key];
              return (
                <div
                  key={key}
                  className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/60 p-2 backdrop-blur-sm"
                >
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-cyan-500 px-2 text-[12px] font-black text-black">
                    {a.line || "?"}
                  </span>
                  <span className="text-[11px]">→</span>
                  <span className="flex-1 truncate text-[12px] font-semibold">{a.destination}</span>
                  <span className="rounded-full bg-teal-500/20 px-2 py-0.5 text-[11px] font-bold text-teal-300 ring-1 ring-teal-400/30">
                    {a.etaMinutes != null ? `${a.etaMinutes} min` : a.etaText}
                  </span>
                  {d && d !== "same" && (
                    <span className="text-[12px]" title={d}>
                      {d === "up" ? "⬆️" : d === "down" ? "⬇️" : "🆕"}
                    </span>
                  )}
                  {d === "same" && <span className="text-[12px]" title="sin cambios">⏱</span>}
                </div>
              );
            })}
          </div>

          <details>
            <summary className="cursor-pointer text-[10px] font-bold text-muted-foreground">JSON</summary>
            <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-muted/60 p-2 text-[10px] leading-tight">
{JSON.stringify(stop, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
