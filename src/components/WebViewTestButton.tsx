import { useState } from "react";
import { Bug, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { subusInspect, type SubusInspectResult } from "@/lib/subus-fetch.functions";

// Panel de debug: ejecuta un fetch server-side a consulta.aspx y
// datos.aspx (sin iframe, sin scrapingbee) y muestra los bodies
// interceptados en pantalla. Equivalente web al "WebView oculto +
// inject JS" de React Native.

type InspectResult = SubusInspectResult;

export function WebViewTestButton() {
  const [open, setOpen] = useState(false);
  const [stop, setStop] = useState("5110");
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<InspectResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inspect = useServerFn(subusInspect);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = (await inspect({ data: { stop } })) as InspectResult;
      setHistory((h) => [res, ...h].slice(0, 10));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Test SUBUS"
        title="Test fetch SUBUS"
        className="fixed left-3 top-[calc(env(safe-area-inset-top)+8px)] z-[60] flex items-center gap-1.5 rounded-full border-2 border-orange-500 bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg active:scale-95"
      >
        <Bug className="h-3.5 w-3.5" />
        SUBUS test
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">SUBUS fetch test</span>
            <input
              value={stop}
              onChange={(e) => setStop(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-20 rounded border border-border bg-card px-2 py-1 text-sm"
              placeholder="parada"
              inputMode="numeric"
            />
            <button
              onClick={run}
              disabled={loading || !stop}
              className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
            >
              {loading && <Loader2 className="h-3 w-3 animate-spin" />}
              Fetch
            </button>
            <button
              onClick={() => setHistory([])}
              className="rounded border border-border px-2 py-1 text-xs"
            >
              Limpiar
            </button>
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar"
              className="ml-auto rounded-full p-1 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground">
            Server fetch directo (no iframe, no scrapingbee) a
            <code className="ml-1">consulta.aspx</code> y
            <code className="ml-1">datos.aspx</code>.
          </div>

          {error && (
            <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {history.length === 0 && !loading && (
              <div className="text-xs text-muted-foreground">
                Sin resultados. Pulsa <b>Fetch</b> para interceptar las llamadas.
              </div>
            )}
            {history.map((res, i) => (
              <div key={i} className="rounded border border-border bg-card">
                <div className="border-b border-border px-2 py-1.5 text-[11px] text-muted-foreground">
                  {res.ts} · parada {res.stop}
                </div>
                {res.requests.map((req, j) => (
                  <div key={j} className="border-b border-border last:border-b-0 p-2 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono ${
                          req.ok
                            ? "bg-green-500/15 text-green-700 dark:text-green-400"
                            : "bg-red-500/15 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {req.type} · {req.status || "ERR"} · {req.ms}ms
                      </span>
                      {"bodyLength" in req && (
                        <span className="text-muted-foreground">
                          {req.bodyLength} bytes
                        </span>
                      )}
                    </div>
                    <div className="break-all text-[10px] text-muted-foreground">
                      {req.url}
                    </div>
                    {"error" in req && req.error && (
                      <div className="text-[11px] text-destructive">{req.error}</div>
                    )}
                    {"json" in req && req.json != null && (
                      <pre className="max-h-64 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight">
                        {JSON.stringify(req.json, null, 2)}
                      </pre>
                    )}
                    {"bodyPreview" in req && req.bodyPreview && req.json == null && (
                      <pre className="max-h-64 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight whitespace-pre-wrap break-all">
                        {req.bodyPreview}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
