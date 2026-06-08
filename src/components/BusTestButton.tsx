import { useState } from "react";
import { Bus, Loader2, RefreshCw, X, Search } from "lucide-react";

const PAGE_URL = "https://movilidad.alicante.es/paradas-de-bus";

type Probe = {
  url: string;
  status: number | "ERR";
  ok: boolean;
  ms: number;
  bytes: number;
  contentType: string;
  preview: string;
  isJson: boolean;
  jsonSample?: unknown;
  error?: string;
};

// Patrones para extraer URLs desde el HTML/JS de la página
function extractCandidateUrls(html: string): string[] {
  const out = new Set<string>();
  // URLs absolutas a movilidad.alicante.es
  for (const m of html.matchAll(/https?:\/\/movilidad\.alicante\.es\/[^\s"'<>()]+/g)) {
    out.add(m[0]);
  }
  // Rutas relativas tipo /asm..., /api/..., /paradas...
  for (const m of html.matchAll(/["'`](\/(?:asm|api|paradas|stops|bus|tiempo|llegadas)[^\s"'`<>()]*)["'`]/gi)) {
    try {
      out.add(new URL(m[1], PAGE_URL).toString());
    } catch {}
  }
  // Filtra basura (assets estáticos)
  return [...out].filter(
    (u) => !/\.(png|jpe?g|webp|svg|css|woff2?|ttf|ico|gif|mp4|map)(\?|$)/i.test(u)
  );
}

async function probe(url: string): Promise<Probe> {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    const text = await res.text();
    const ms = Math.round(performance.now() - t0);
    const contentType = res.headers.get("content-type") || "";
    const bytes = new Blob([text]).size;
    let isJson = false;
    let jsonSample: unknown = undefined;
    try {
      jsonSample = JSON.parse(text);
      isJson = true;
    } catch {}
    return {
      url,
      status: res.status,
      ok: res.ok,
      ms,
      bytes,
      contentType,
      preview: text.slice(0, 300),
      isJson,
      jsonSample,
    };
  } catch (e: any) {
    return {
      url,
      status: "ERR",
      ok: false,
      ms: Math.round(performance.now() - t0),
      bytes: 0,
      contentType: "",
      preview: "",
      isJson: false,
      error: e?.message ?? "fetch failed",
    };
  }
}

export function BusTestButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ ms: number; bytes: number; status: number | "ERR" } | null>(null);
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [customUrl, setCustomUrl] = useState<string>("");

  async function discover() {
    setLoading(true);
    setError(null);
    setProbes([]);
    setCandidates(null);
    setPageMeta(null);
    try {
      setStage("Descargando /paradas-de-bus…");
      const t0 = performance.now();
      const res = await fetch(PAGE_URL, { cache: "no-store" });
      const html = await res.text();
      const ms = Math.round(performance.now() - t0);
      setPageMeta({ ms, bytes: new Blob([html]).size, status: res.status });

      setStage("Buscando endpoints candidatos…");
      const urls = extractCandidateUrls(html).slice(0, 25);
      setCandidates(urls);

      if (urls.length === 0) {
        setStage("Sin candidatos encontrados en el HTML.");
        return;
      }

      setStage(`Probando ${urls.length} endpoints…`);
      const results: Probe[] = [];
      for (const u of urls) {
        const p = await probe(u);
        results.push(p);
        setProbes([...results]);
      }
      setStage("Listo.");
    } catch (e: any) {
      setError(e?.message ?? "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function probeCustom() {
    if (!customUrl.trim()) return;
    setLoading(true);
    setStage(`Probando ${customUrl}…`);
    const p = await probe(customUrl.trim());
    setProbes((prev) => [p, ...prev]);
    setStage("Listo.");
    setLoading(false);
  }

  function openAndRun() {
    setOpen(true);
    void discover();
  }

  return (
    <>
      <button
        onClick={openAndRun}
        aria-label="Prueba buses"
        className="flex h-9 items-center gap-1.5 rounded-full bg-sky-400 px-3 text-[11px] font-bold text-black ring-1 ring-sky-600/50 shadow-sm active:scale-95"
      >
        <Bus className="h-3.5 w-3.5" />
        Buses (test)
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-2xl bg-background shadow-2xl sm:rounded-2xl">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold">Buses — test endpoints</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={discover}
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

            <div className="overflow-y-auto px-4 py-3" style={{ maxHeight: "calc(90vh - 56px)" }}>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Descarga <code className="font-mono">{PAGE_URL}</code>, extrae URLs candidatas y prueba cada una desde tu navegador.
              </p>

              {pageMeta && (
                <div className="mb-2 rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                  HTML página: status {pageMeta.status} · ⏱ {pageMeta.ms} ms · 📦 {(pageMeta.bytes / 1024).toFixed(1)} KB
                </div>
              )}

              {stage && (
                <div className="mb-2 text-[11px] text-muted-foreground italic">{stage}</div>
              )}

              {error && (
                <div className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</div>
              )}

              {/* Probar URL manual */}
              <div className="mb-3 rounded-lg border border-border/60 p-2">
                <label className="text-[10px] font-bold text-muted-foreground">Probar URL manual</label>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://movilidad.alicante.es/..."
                    className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] font-mono"
                  />
                  <button
                    onClick={probeCustom}
                    disabled={loading || !customUrl.trim()}
                    className="flex h-7 items-center gap-1 rounded bg-primary px-2 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                  >
                    <Search className="h-3 w-3" /> GO
                  </button>
                </div>
              </div>

              {candidates && candidates.length > 0 && (
                <details className="mb-3">
                  <summary className="cursor-pointer text-[11px] font-bold">
                    {candidates.length} URLs candidatas en HTML
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {candidates.map((u) => (
                      <li key={u} className="break-all text-[10px] font-mono text-muted-foreground">{u}</li>
                    ))}
                  </ul>
                </details>
              )}

              {probes.length > 0 && (
                <ul className="space-y-2">
                  {probes.map((p, i) => (
                    <li
                      key={`${p.url}-${i}`}
                      className={`rounded-xl border p-2 ${
                        p.isJson ? "border-green-500/60 bg-green-500/5" : "border-border/60 bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                            p.ok && p.isJson ? "bg-green-500" : p.ok ? "bg-amber-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-[11px] font-mono font-bold">{p.status}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {p.ms}ms · {(p.bytes / 1024).toFixed(1)}KB {p.isJson && "· JSON ✓"}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-[10px] font-mono">{p.url}</p>
                      {p.contentType && (
                        <p className="text-[10px] text-muted-foreground">CT: {p.contentType}</p>
                      )}
                      {p.error && <p className="text-[10px] text-destructive">{p.error}</p>}
                      {(p.preview || p.isJson) && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-muted-foreground">
                            {p.isJson ? "JSON" : "Preview"}
                          </summary>
                          <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted/60 p-2 text-[10px] leading-tight">
                            {p.isJson ? JSON.stringify(p.jsonSample, null, 2).slice(0, 4000) : p.preview}
                          </pre>
                        </details>
                      )}
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
