import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/bus-cors-test")({
  component: BusCorsTestPage,
});

const TARGETS = [
  "https://movilidad.vectalia.es/QR/Alicante/consulta.aspx?p=5110",
  "http://www.subus.es/QR/Alicante/consulta.aspx?p=5110",
  "https://qr.vectalia.es/Alicante/lib/request.aspx?p=5110&l=",
];

type Result = {
  url: string;
  status: string;
  ok: boolean | null;
  body: string;
  error: string | null;
  ms: number;
};

function BusCorsTestPage() {
  const [results, setResults] = useState<Result[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults([]);
    const out: Result[] = [];
    for (const url of TARGETS) {
      const t0 = performance.now();
      try {
        const r = await fetch(url, { method: "GET", mode: "cors", credentials: "omit" });
        const body = await r.text();
        out.push({
          url,
          status: `${r.status} ${r.statusText}`,
          ok: r.ok,
          body: body.slice(0, 600),
          error: null,
          ms: Math.round(performance.now() - t0),
        });
      } catch (e) {
        out.push({
          url,
          status: "FETCH ERROR",
          ok: null,
          body: "",
          error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
          ms: Math.round(performance.now() - t0),
        });
      }
      setResults([...out]);
    }
    setRunning(false);
  };

  return (
    <div style={{ padding: 16, fontFamily: "system-ui, sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, marginBottom: 8 }}>Bus CORS test — parada 5110</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
        Abre esta página desde tu móvil (con datos móviles, no por el sandbox) y pulsa el botón.
        Si alguno responde HTTP 200 y devuelve HTML/texto, esa URL es viable desde el cliente.
      </p>
      <button
        onClick={run}
        disabled={running}
        style={{
          padding: "10px 16px",
          background: "#111",
          color: "#fff",
          border: 0,
          borderRadius: 8,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {running ? "Probando…" : "Probar 3 URLs"}
      </button>

      <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {results.map((r, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 10,
              background: r.ok ? "#e9fbe9" : r.error ? "#fde9e9" : "#fff8e1",
            }}
          >
            <div style={{ fontSize: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{r.url}</div>
            <div style={{ marginTop: 6, fontSize: 13 }}>
              <b>{r.status}</b> · {r.ms}ms
              {r.error && <span style={{ color: "#b00", marginLeft: 6 }}>{r.error}</span>}
            </div>
            {r.body && (
              <pre
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  background: "#fafafa",
                  padding: 8,
                  borderRadius: 6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  maxHeight: 200,
                  overflow: "auto",
                }}
              >
                {r.body}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
