import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

export const Route = createFileRoute("/bus-webview-test")({
  component: BusWebviewTest,
});

type Tiempo = { linea: string; destino: string; min: number; lat: number; lng: number; bus: string };

function parseTiempos(raw: string): Tiempo[] {
  const re = /Linea\s+(\d+[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min\.?\s*:\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*:\s*([^\n;]+)/gi;
  const out: Tiempo[] = [];
  for (const m of raw.matchAll(re)) {
    out.push({
      linea: String(parseInt(m[1], 10)),
      destino: m[2].trim(),
      min: parseInt(m[3], 10),
      lat: Number(m[4]),
      lng: Number(m[5]),
      bus: m[6].trim(),
    });
  }
  return out;
}

function BusWebviewTest() {
  const [stop, setStop] = useState("5110");
  const [stopInput, setStopInput] = useState("5110");
  const [data, setData] = useState<{
    ok: boolean;
    status: number;
    ms: number;
    raw: string;
    json: Record<string, unknown> | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`/api/public/bus-datos?stop=${encodeURIComponent(stop)}`);
        const j = await r.json();
        if (alive) setData(j);
      } catch (e) {
        if (alive) setErr(String(e));
      } finally {
        if (alive) setLoading(false);
      }
    };
    fetchOnce();
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [stop, tick]);

  const tiempos = useMemo(() => {
    const t = (data?.json as { tiempos?: string } | null)?.tiempos ?? "";
    return parseTiempos(t);
  }, [data]);

  const meta = data?.json as
    | { nparada?: string; parada?: string; p_loc?: string; tiempo_recarga?: number; avisos?: string }
    | null
    | undefined;

  const iframeSrc = `https://movilidad.vectalia.es/QR/Alicante/consulta.aspx?p=${encodeURIComponent(stop)}`;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-lg font-semibold">WebView test · parada {stop}</h1>
        <input
          value={stopInput}
          onChange={(e) => setStopInput(e.target.value)}
          className="ml-auto w-24 rounded border border-border bg-card px-2 py-1 text-sm"
          placeholder="código"
        />
        <button
          onClick={() => setStop(stopInput.trim())}
          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          Cargar
        </button>
        <button
          onClick={() => setTick((t) => t + 1)}
          className="rounded border border-border px-3 py-1 text-sm"
        >
          Refrescar
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* WebView */}
        <div className="rounded border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            iframe: {iframeSrc}
          </div>
          <iframe
            src={iframeSrc}
            className="h-[600px] w-full"
            title="consulta.aspx"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>

        {/* datos.aspx captura */}
        <div className="rounded border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <span>datos.aspx vía ScrapingBee</span>
            <span>
              {loading
                ? "cargando…"
                : data
                  ? `HTTP ${data.status} · ${data.ms}ms`
                  : err
                    ? "error"
                    : "—"}
            </span>
          </div>
          <div className="p-3 text-sm">
            {err && <div className="text-destructive">{err}</div>}
            {meta && (
              <div className="mb-3 space-y-1 text-xs">
                <div>
                  <b>parada:</b> {meta.nparada} — {meta.parada}
                </div>
                <div>
                  <b>p_loc:</b> {meta.p_loc}
                </div>
                <div>
                  <b>recarga:</b> {meta.tiempo_recarga}ms
                </div>
                {meta.avisos && (
                  <div>
                    <b>avisos:</b> {meta.avisos}
                  </div>
                )}
              </div>
            )}
            {tiempos.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="text-left">Línea</th>
                    <th className="text-left">Destino</th>
                    <th className="text-right">min</th>
                    <th className="text-left">Bus</th>
                    <th className="text-left">Coords</th>
                  </tr>
                </thead>
                <tbody>
                  {tiempos.map((t, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="py-1 font-medium">{t.linea}</td>
                      <td>{t.destino}</td>
                      <td className="text-right">{t.min}</td>
                      <td className="font-mono">{t.bus}</td>
                      <td className="font-mono text-[10px]">
                        {t.lat.toFixed(5)},{t.lng.toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-xs text-muted-foreground">Sin tiempos parseados.</div>
            )}

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                JSON crudo
              </summary>
              <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-2 text-[10px]">
                {data?.raw ?? ""}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
