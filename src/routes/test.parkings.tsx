import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/test/parkings")({
  component: TestParkings,
});

type Result = {
  label: string;
  ok: boolean;
  status?: number;
  ms?: number;
  bytes?: number;
  contentType?: string;
  preview?: string;
  error?: string;
};

const TARGETS = [
  { label: "GET /parkings (HTML)", url: "https://movilidad.alicante.es/parkings" },
  { label: "GET /asmpois (JSON)", url: "https://movilidad.alicante.es/asmpois" },
  { label: "GET / (home)", url: "https://movilidad.alicante.es/" },
];

function TestParkings() {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  async function run(mode: "cors" | "no-cors") {
    setRunning(true);
    setResults([]);
    const out: Result[] = [];
    for (const t of TARGETS) {
      const t0 = performance.now();
      try {
        const r = await fetch(t.url, { mode, credentials: "omit" });
        const ms = Math.round(performance.now() - t0);
        if (mode === "no-cors") {
          out.push({
            label: `${t.label} [no-cors]`,
            ok: true,
            ms,
            preview: "respuesta opaca (no-cors): el navegador no permite leer el cuerpo, pero la petición salió",
          });
        } else {
          const text = await r.text();
          out.push({
            label: t.label,
            ok: r.ok,
            status: r.status,
            ms,
            bytes: text.length,
            contentType: r.headers.get("content-type") || "",
            preview: text.slice(0, 400),
          });
        }
      } catch (e: any) {
        const ms = Math.round(performance.now() - t0);
        out.push({ label: `${t.label} [${mode}]`, ok: false, ms, error: String(e?.message || e) });
      }
      setResults([...out]);
    }
    setRunning(false);
  }

  return (
    <div style={{ padding: 16, fontFamily: "system-ui", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Test cliente → movilidad.alicante.es</h1>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
        Ejecuta las peticiones desde TU navegador (no el servidor). Si estás en España con IP residencial,
        deberían pasar el WAF. Si CORS bloquea la lectura, el modo no-cors confirma al menos que la red llega.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button
          disabled={running}
          onClick={() => run("cors")}
          style={{ padding: "10px 14px", background: "#0a7", color: "#fff", border: 0, borderRadius: 8 }}
        >
          {running ? "Ejecutando…" : "Test CORS (leer cuerpo)"}
        </button>
        <button
          disabled={running}
          onClick={() => run("no-cors")}
          style={{ padding: "10px 14px", background: "#06c", color: "#fff", border: 0, borderRadius: 8 }}
        >
          Test no-cors (solo conectividad)
        </button>
      </div>
      {results.map((r, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
            background: r.ok ? "#f4fff7" : "#fff4f4",
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</div>
          <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>
            {r.status != null && <>status: <b>{r.status}</b> · </>}
            {r.ms != null && <>tiempo: {r.ms}ms · </>}
            {r.bytes != null && <>bytes: {r.bytes} · </>}
            {r.contentType && <>ct: {r.contentType}</>}
          </div>
          {r.error && (
            <pre style={{ fontSize: 12, color: "#a00", whiteSpace: "pre-wrap", marginTop: 6 }}>{r.error}</pre>
          )}
          {r.preview && (
            <pre
              style={{
                fontSize: 11,
                background: "#fafafa",
                padding: 8,
                borderRadius: 6,
                marginTop: 6,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 200,
                overflow: "auto",
              }}
            >
              {r.preview}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
