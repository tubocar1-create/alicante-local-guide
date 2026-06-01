import { useState } from "react";
import { Bug, X, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { subusInspect, type SubusInspectResult, type SubusStep } from "@/lib/subus-fetch.functions";

// Panel de debug: ejecuta el flujo real del navegador (consulta.aspx →
// captura cookies → datos.aspx con X-Vectalia-App) en el servidor y
// muestra status, headers, cookies, body y campos clave.

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
            <span className="text-sm font-semibold">SUBUS flow test</span>
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
              Run flow
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
            1) GET <code>consulta.aspx</code> · captura cookies → 2) GET{" "}
            <code>datos.aspx</code> con <code>X-Vectalia-App: qr-alicante</code>
          </div>

          {error && (
            <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {history.length === 0 && !loading && (
              <div className="text-xs text-muted-foreground">
                Sin resultados. Pulsa <b>Run flow</b>.
              </div>
            )}

            {history.map((res, i) => (
              <div key={i} className="rounded border border-border bg-card">
                <div className="border-b border-border px-2 py-1.5 text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>{res.ts} · parada {res.stop}</span>
                </div>

                {/* Diagnóstico clave */}
                <div className="border-b border-border bg-muted/30 px-2 py-2 text-[11px] space-y-1">
                  <div className="font-semibold text-foreground">Campos clave (datos.aspx)</div>
                  <DiagRow label="nparada" value={res.diagnostic.nparada} />
                  <DiagRow label="parada" value={res.diagnostic.parada} />
                  <DiagRow label="tiempos" value={res.diagnostic.tiempos} />
                </div>

                {res.steps.map((step, j) => (
                  <StepBlock key={j} step={step} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function DiagRow({ label, value }: { label: string; value: unknown }) {
  const present = value !== undefined;
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-0.5 inline-block rounded px-1 text-[10px] font-mono ${
          present
            ? "bg-green-500/15 text-green-700 dark:text-green-400"
            : "bg-red-500/15 text-red-700 dark:text-red-400"
        }`}
      >
        {label}
      </span>
      <code className="flex-1 break-all text-[10px] text-muted-foreground">
        {present ? JSON.stringify(value).slice(0, 300) : "— (ausente)"}
      </code>
    </div>
  );
}

function StepBlock({ step }: { step: SubusStep }) {
  const [tab, setTab] = useState<"body" | "req" | "res" | "cookies">("body");
  return (
    <div className="border-b border-border last:border-b-0 p-2 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span
          className={`rounded px-1.5 py-0.5 font-mono ${
            step.ok
              ? "bg-green-500/15 text-green-700 dark:text-green-400"
              : "bg-red-500/15 text-red-700 dark:text-red-400"
          }`}
        >
          {step.type} · {step.status || "ERR"} {step.statusText} · {step.ms}ms · {step.bodyLength}B
        </span>
      </div>
      <div className="break-all text-[10px] text-muted-foreground">{step.url}</div>
      {step.error && <div className="text-[11px] text-destructive">{step.error}</div>}

      <div className="flex gap-1 text-[10px]">
        {(["body", "req", "res", "cookies"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-1.5 py-0.5 ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "body" && (
        <pre className="max-h-80 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight whitespace-pre-wrap break-all">
          {step.json !== undefined
            ? JSON.stringify(step.json, null, 2)
            : step.body || "(vacío)"}
        </pre>
      )}
      {tab === "req" && (
        <pre className="max-h-64 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight">
          {JSON.stringify(step.requestHeaders, null, 2)}
        </pre>
      )}
      {tab === "res" && (
        <pre className="max-h-64 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight">
          {JSON.stringify(step.responseHeaders, null, 2)}
        </pre>
      )}
      {tab === "cookies" && (
        <div className="space-y-2">
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground mb-1">
              Set-Cookie ({step.setCookie.length})
            </div>
            <pre className="max-h-40 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight whitespace-pre-wrap break-all">
              {step.setCookie.length ? step.setCookie.join("\n") : "—"}
            </pre>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-muted-foreground mb-1">
              Cookie jar tras este paso
            </div>
            <pre className="max-h-40 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight whitespace-pre-wrap break-all">
              {Object.keys(step.cookieJar).length
                ? JSON.stringify(step.cookieJar, null, 2)
                : "—"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
