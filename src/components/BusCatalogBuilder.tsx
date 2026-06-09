import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, Circle, Rocket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type PageState = "idle" | "loading" | "success" | "error";

type PageStatus = {
  state: PageState;
  count?: number;
  error?: string;
  stops?: { stop_id: string; stop_name: string }[];
};

const TOTAL_PAGES = 35; // 0..34

function pageUrl(page: number): string {
  return page === 0
    ? "https://movilidad.alicante.es/paradas-de-bus"
    : `https://movilidad.alicante.es/paradas-de-bus?page=${page}`;
}

function detectStops(html: string): { stop_id: string; stop_name: string }[] {
  const re = /(\d{3,5})\s*:\s*([A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9\s\-.·'/]{2,80})/g;
  const seen = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const id = m[1].trim();
    const name = m[2].replace(/\s+/g, " ").trim().replace(/[\s.,;:-]+$/, "");
    if (!seen.has(id) && name.length >= 3) seen.set(id, name);
  }
  return [...seen.entries()].map(([stop_id, stop_name]) => ({ stop_id, stop_name }));
}

export function BusCatalogBuilder() {
  const [statuses, setStatuses] = useState<Record<number, PageStatus>>({});
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  async function indexPage(page: number): Promise<number> {
    setStatuses((s) => ({ ...s, [page]: { state: "loading" } }));
    const url = pageUrl(page);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      // Strip tags for cleaner regex matches
      const text = html.replace(/<[^>]+>/g, " ");
      const stops = detectStops(text);

      if (stops.length > 0) {
        const rows = stops.map((s) => ({
          stop_id: s.stop_id,
          stop_name: s.stop_name,
          page_number: page,
          source_url: url,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase
          .from("bus_stop_catalog")
          .upsert(rows, { onConflict: "stop_id" });
        if (error) throw error;
      }

      setStatuses((s) => ({
        ...s,
        [page]: { state: "success", count: stops.length, stops },
      }));
      setSelected(page);
      return stops.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatuses((s) => ({ ...s, [page]: { state: "error", error: msg } }));
      return 0;
    }
  }

  async function indexAll() {
    if (running) return;
    setRunning(true);
    try {
      for (let p = 0; p < TOTAL_PAGES; p++) {
        await indexPage(p);
        const delay = 800 + Math.floor(Math.random() * 1200);
        await new Promise((r) => setTimeout(r, delay));
      }
    } finally {
      setRunning(false);
    }
  }

  const totalFound = Object.values(statuses).reduce(
    (acc, s) => acc + (s.count ?? 0),
    0
  );
  const sel = selected !== null ? statuses[selected] : undefined;

  return (
    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/10 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-cyan-300">
          🗂 Constructor de catálogo
        </h3>
        <button
          onClick={indexAll}
          disabled={running}
          className="flex items-center gap-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-2.5 py-1 text-xs font-semibold text-white"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Rocket className="h-3.5 w-3.5" />
          )}
          INDEXAR TODO
        </button>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5">
        {Array.from({ length: TOTAL_PAGES }, (_, i) => {
          const st = statuses[i];
          const state = st?.state ?? "idle";
          const base =
            "relative flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[10px] font-mono border transition";
          const cls =
            state === "success"
              ? "border-green-500/60 bg-green-900/30 text-green-300"
              : state === "error"
              ? "border-red-500/60 bg-red-900/30 text-red-300"
              : state === "loading"
              ? "border-yellow-500/60 bg-yellow-900/30 text-yellow-300"
              : "border-cyan-500/40 bg-cyan-900/20 text-cyan-200 hover:bg-cyan-800/40";
          return (
            <button
              key={i}
              onClick={() => !running && indexPage(i)}
              disabled={running}
              className={`${base} ${cls}`}
              title={pageUrl(i)}
            >
              {state === "loading" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : state === "success" ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : state === "error" ? (
                <XCircle className="h-3 w-3" />
              ) : (
                <Circle className="h-3 w-3 opacity-50" />
              )}
              P{i}
              {st?.count !== undefined && (
                <span className="opacity-70">·{st.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-cyan-200/80">
        Total guardado en esta sesión:{" "}
        <span className="font-mono text-cyan-100">{totalFound}</span> paradas
      </div>

      {sel && sel.state === "success" && sel.stops && (
        <div className="rounded border border-cyan-500/30 bg-black/30 p-2 max-h-64 overflow-auto">
          <div className="text-xs text-cyan-300 mb-1">
            📄 Página {selected} — {sel.count} paradas
          </div>
          <ul className="text-[11px] font-mono text-cyan-100 space-y-0.5">
            {sel.stops.map((s) => (
              <li key={s.stop_id}>
                <span className="text-cyan-400">{s.stop_id}</span> — {s.stop_name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {sel && sel.state === "error" && (
        <div className="text-[11px] text-red-300">
          ❌ Página {selected}: {sel.error}
        </div>
      )}
    </div>
  );
}
