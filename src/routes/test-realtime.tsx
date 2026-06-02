import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/test-realtime")({
  component: TestRealtimePage,
});

const TARGET_URL = "https://qr.vectalia.es/Alicante/consulta.aspx?p=5110";

type Result = {
  ok: boolean;
  status?: number;
  statusText?: string;
  bodyPreview?: string;
  error?: string;
  durationMs: number;
  mode: RequestMode;
};

function TestRealtimePage() {
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  async function runTest(mode: RequestMode) {
    setLoading(true);
    const started = performance.now();
    try {
      const res = await fetch(TARGET_URL, {
        method: "GET",
        mode,
        credentials: "omit",
        redirect: "follow",
      });
      let bodyPreview = "";
      try {
        const text = await res.text();
        bodyPreview = text.slice(0, 400);
      } catch {
        bodyPreview = "(no body readable — opaque response)";
      }
      setResults((r) => [
        {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          bodyPreview,
          durationMs: Math.round(performance.now() - started),
          mode,
        },
        ...r,
      ]);
    } catch (e) {
      setResults((r) => [
        {
          ok: false,
          error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
          durationMs: Math.round(performance.now() - started),
          mode,
        },
        ...r,
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-background p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold">Test realtime — fetch directo desde navegador</h1>
        <p className="text-sm text-muted-foreground break-all">
          URL: <code>{TARGET_URL}</code>
        </p>
        <p className="text-xs text-muted-foreground">
          Sin backend, sin proxy, sin server functions. La petición sale del navegador del usuario.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => runTest("cors")}
            disabled={loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Test (mode: cors)
          </button>
          <button
            onClick={() => runTest("no-cors")}
            disabled={loading}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Test (mode: no-cors)
          </button>
          <button
            onClick={() => setResults([])}
            disabled={loading}
            className="rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Limpiar
          </button>
        </div>

        <div className="space-y-3">
          {results.map((r, i) => (
            <div
              key={i}
              className={`rounded-md border p-3 text-sm ${
                r.ok ? "border-green-500/40 bg-green-500/10" : "border-destructive/40 bg-destructive/10"
              }`}
            >
              <div className="font-mono text-xs">
                mode={r.mode} · {r.durationMs}ms
              </div>
              {r.error ? (
                <div className="mt-1">
                  <div className="font-semibold text-destructive">FAIL (network/CORS)</div>
                  <div className="font-mono text-xs break-all">{r.error}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Un fallo aquí (TypeError: Failed to fetch) suele indicar CORS bloqueado por el navegador
                    o bloqueo de red. Abre DevTools → Network para ver el código real.
                  </div>
                </div>
              ) : (
                <div className="mt-1">
                  <div className="font-semibold">
                    {r.ok ? "SUCCESS" : "HTTP error"} · {r.status} {r.statusText}
                  </div>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-background/60 p-2 text-xs">
                    {r.bodyPreview}
                  </pre>
                </div>
              )}
            </div>
          ))}
          {results.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin resultados todavía. Pulsa un botón.</p>
          )}
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p className="font-semibold">Notas:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code>mode: cors</code> — si Vectalia no envía cabeceras CORS, el navegador bloquea la respuesta y verás "Failed to fetch".</li>
            <li><code>mode: no-cors</code> — la petición sale pero la respuesta es opaca (no se puede leer el body desde JS). Útil sólo para verificar que la red llega.</li>
            <li>Abre DevTools → Network para ver el status HTTP real aunque CORS bloquee.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
