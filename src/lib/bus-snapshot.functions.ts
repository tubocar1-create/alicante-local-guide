import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Snapshot Engine experimental — captura realtime Vectalia para entrenamiento.
// Sólo se dispara manualmente desde el panel admin (preview).
// NO se usa en producción ni en cron.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

function buildMapUrl(line: string, stopCode: string): string {
  // Vectalia espera línea con padding (012, 008, 13N…)
  const norm = /^\d+$/.test(line) ? line.padStart(3, "0") : line.toUpperCase();
  return `https://qr.vectalia.es/Alicante/mapa.aspx?l=${norm}&np=${stopCode}&p=1&pr=1`;
}

type Marker = { lat?: number; lng?: number; kind: "bus" | "stop" | "qr" | "other"; raw?: string };

function parseMarkersFromHtml(html: string): Marker[] {
  const markers: Marker[] = [];
  // Cada bus activo se renderiza como <img ... class="... busito ..." src=".../bus.gif" ...>
  // Las coords vienen en los L.marker([lat,lng], …) generados por el script.
  const reLMarker = /L\.marker\(\s*\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\][^)]*\)[^;]*?(ico_bus|ico_parada|ico_qr|ico_totem)?/gi;
  for (const m of html.matchAll(reLMarker)) {
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    const tag = (m[3] ?? "").toLowerCase();
    if (lat === 0 && lng === 0) continue; // placeholder
    const kind: Marker["kind"] = tag.includes("bus")
      ? "bus"
      : tag.includes("qr")
        ? "qr"
        : tag.includes("parada") || tag.includes("totem")
          ? "stop"
          : "other";
    markers.push({ lat, lng, kind, raw: m[0].slice(0, 200) });
  }
  // Fallback: contar imgs busito si el regex de coords no encontró buses.
  const busImgCount = (html.match(/class="[^"]*busito[^"]*"/gi) ?? []).length;
  const detectedBuses = markers.filter((mk) => mk.kind === "bus").length;
  if (detectedBuses === 0 && busImgCount > 0) {
    for (let i = 0; i < busImgCount; i++) markers.push({ kind: "bus" });
  }
  return markers;
}

async function firecrawlScrape(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: ["rawHtml"],
      onlyMainContent: false,
      waitFor: 8000,
    }),
  });
  if (!res.ok) throw new Error(`Firecrawl ${res.status}: ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { data?: { rawHtml?: string; html?: string } };
  return json.data?.rawHtml ?? json.data?.html ?? "";
}

export const captureLineSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { line: string; stopCode: string; notes?: string }) => {
    const line = String(data?.line ?? "").trim().toUpperCase();
    const stopCode = String(data?.stopCode ?? "").trim();
    if (!/^[0-9A-Z]{1,4}$/.test(line)) throw new Error("invalid line");
    if (!/^\d{3,5}$/.test(stopCode)) throw new Error("invalid stopCode");
    return { line, stopCode, notes: data?.notes?.slice(0, 500) };
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const url = buildMapUrl(data.line, data.stopCode);
    const html = await firecrawlScrape(url);
    const markers = parseMarkersFromHtml(html);
    const buses = markers.filter((m) => m.kind === "bus").length;

    const { data: row, error } = await supabase
      .from("bus_snapshots")
      .insert({
        line: data.line,
        stop_code: data.stopCode,
        buses_count: buses,
        raw_markers: markers as unknown as object,
        source_url: url,
        notes: data.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    return { snapshot: row, buses, markers };
  });

export const listRecentSnapshots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("bus_snapshots")
      .select("id, line, stop_code, buses_count, captured_at, source_url, notes")
      .order("captured_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { snapshots: data ?? [] };
  });
