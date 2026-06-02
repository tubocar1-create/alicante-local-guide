// Server functions para snapshot realtime de Vectalia.
// Filosofía (post-refactor): Vectalia es la ÚNICA fuente de verdad. Nada se
// inventa, nada se extrapola. Solo se cachean por 5 min para no martillear
// el origen, y se devuelven al cliente para interpolación VISUAL (no operativa).

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// ---------- Tipos públicos ----------

export type RealtimeStopEta = {
  stopCode: string;
  stopName: string;
  direction: 1 | 2;
  seq: number;
  etaMinutes: number[]; // ordenado asc, puede estar vacío
  capturedAt: string; // ISO
  ageSec: number;
  stale: boolean; // > 5 min
  frozen: boolean; // > 10 min
};

export type RealtimeLineState = {
  lineCode: string;
  fetchedAt: string;
  capturedAt: string | null; // captured_at más antiguo de los devueltos
  ageSec: number | null;
  stale: boolean;
  frozen: boolean;
  stops: RealtimeStopEta[];
};

// ---------- Fetch a Vectalia (igual lógica que /api/public/bus-eta) ----------

const BASE = "http://www.subus.es/QR/Alicante";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const ARRIVAL_RE = /Linea\s+(\d{1,3}[A-Za-z]?)\s+([^:]+?)\s*:\s*(\d+)\s*min/gi;
const FETCH_TIMEOUT_MS = 5_000;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
const STALE_MS = 5 * 60 * 1000;
const FROZEN_MS = 10 * 60 * 1000;

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

// Devuelve todas las líneas detectadas en la parada: { lineCode -> minutos[] }
async function fetchAllLinesForStop(stop: string): Promise<Map<string, number[]> | null> {
  const result = new Map<string, number[]>();
  const consultaUrl = `${BASE}/consulta.aspx?p=${encodeURIComponent(stop)}`;

  let raw = "";
  try {
    const page = await fetchWithTimeout(consultaUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "es-ES,es;q=0.9",
      },
    });
    if (!page.ok) return null;
    raw = await page.text();
  } catch {
    return null;
  }

  if (!raw) return result;
  for (const m of raw.matchAll(ARRIVAL_RE)) {
    const lineKey = normalizeLine(m[1]);
    const mins = parseInt(m[3], 10);
    if (!Number.isFinite(mins)) continue;
    const arr = result.get(lineKey) ?? [];
    arr.push(mins);
    result.set(lineKey, arr);
  }
  for (const arr of result.values()) arr.sort((a, b) => a - b);
  return result;
}

// ---------- Cache helpers ----------

type SnapRow = {
  stop_code: string;
  line_code: string;
  direction: number | null;
  eta_minutes: number[];
  captured_at: string;
};

async function readSnapshotsForStops(stopCodes: string[]): Promise<Map<string, SnapRow[]>> {
  const out = new Map<string, SnapRow[]>();
  if (stopCodes.length === 0) return out;
  const { data } = await supabaseAdmin
    .from("bus_realtime_snapshots")
    .select("stop_code,line_code,direction,eta_minutes,captured_at")
    .in("stop_code", stopCodes);
  for (const r of (data ?? []) as SnapRow[]) {
    const arr = out.get(r.stop_code) ?? [];
    arr.push(r);
    out.set(r.stop_code, arr);
  }
  return out;
}

async function upsertSnapshots(
  rows: Array<{ stop_code: string; line_code: string; direction: number | null; eta_minutes: number[] }>,
): Promise<void> {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({
    stop_code: r.stop_code,
    line_code: r.line_code,
    direction: r.direction,
    eta_minutes: r.eta_minutes,
    captured_at: now,
    source: "vectalia",
  }));
  await supabaseAdmin
    .from("bus_realtime_snapshots")
    .upsert(payload, { onConflict: "stop_code,line_code" });
}

function isFresh(capturedAt: string, now: number): boolean {
  return now - Date.parse(capturedAt) < CACHE_TTL_MS;
}

// Concurrencia limitada
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

// ---------- Server fn principal: estado realtime de una línea ----------

export const getLineRealtimeState = createServerFn({ method: "GET" })
  .inputValidator((input: { lineCode: string }) =>
    z.object({ lineCode: z.string().min(1).max(8).regex(/^[0-9A-Za-z]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<RealtimeLineState> => {
    const lineCode = normalizeLine(data.lineCode);
    const fetchedAt = new Date().toISOString();

    // 1) Paradas de la línea
    const { data: stopsRaw } = await supabaseAdmin
      .from("bus_line_stops")
      .select("line_code,direction,seq,stop_code,stop_name")
      .eq("line_code", lineCode)
      .order("direction")
      .order("seq");

    const stops = (stopsRaw ?? []).filter(
      (s): s is { line_code: string; direction: number; seq: number; stop_code: string; stop_name: string } =>
        typeof s.stop_code === "string" && s.stop_code.length > 0,
    );
    if (stops.length === 0) {
      return {
        lineCode,
        fetchedAt,
        capturedAt: null,
        ageSec: null,
        stale: true,
        frozen: true,
        stops: [],
      };
    }

    const uniqueStopCodes = Array.from(new Set(stops.map((s) => s.stop_code)));

    // 2) Lee snapshots cacheados
    const now = Date.now();
    const cached = await readSnapshotsForStops(uniqueStopCodes);

    // Paradas que necesitan refresh
    const stopsToFetch: string[] = [];
    for (const code of uniqueStopCodes) {
      const rows = cached.get(code) ?? [];
      const ours = rows.find((r) => r.line_code === lineCode);
      if (!ours || !isFresh(ours.captured_at, now)) stopsToFetch.push(code);
    }

    // 3) Fetch Vectalia para paradas obsoletas (concurrencia limitada)
    const newSnapshots: Array<{ stop_code: string; line_code: string; direction: number | null; eta_minutes: number[] }> = [];
    if (stopsToFetch.length > 0) {
      await mapLimit(stopsToFetch, 6, async (stopCode) => {
        const byLine = await fetchAllLinesForStop(stopCode);
        // Guarda TODAS las líneas vistas en esta parada (para reusar en otras consultas)
        for (const [lc, mins] of byLine.entries()) {
          newSnapshots.push({
            stop_code: stopCode,
            line_code: lc,
            direction: null,
            eta_minutes: mins,
          });
        }
        // Si no se vio nuestra línea concreta en esta parada, persistir vacío para no refetch
        if (!byLine.has(lineCode)) {
          newSnapshots.push({
            stop_code: stopCode,
            line_code: lineCode,
            direction: null,
            eta_minutes: [],
          });
        }
      });
      await upsertSnapshots(newSnapshots);
    }

    // 4) Re-lee snapshots actualizados (solo nuestra línea)
    const { data: freshRows } = await supabaseAdmin
      .from("bus_realtime_snapshots")
      .select("stop_code,line_code,direction,eta_minutes,captured_at")
      .eq("line_code", lineCode)
      .in("stop_code", uniqueStopCodes);

    const bySnap = new Map<string, SnapRow>();
    for (const r of (freshRows ?? []) as SnapRow[]) bySnap.set(r.stop_code, r);

    // 5) Compone resultado por parada+dirección
    const result: RealtimeStopEta[] = [];
    let oldestCapturedMs: number | null = null;
    for (const s of stops) {
      const snap = bySnap.get(s.stop_code);
      const capturedAtIso = snap?.captured_at ?? fetchedAt;
      const capturedMs = Date.parse(capturedAtIso);
      if (oldestCapturedMs == null || capturedMs < oldestCapturedMs) oldestCapturedMs = capturedMs;
      const ageMs = now - capturedMs;
      result.push({
        stopCode: s.stop_code,
        stopName: s.stop_name,
        direction: s.direction === 2 ? 2 : 1,
        seq: s.seq,
        etaMinutes: snap?.eta_minutes ?? [],
        capturedAt: capturedAtIso,
        ageSec: Math.max(0, Math.round(ageMs / 1000)),
        stale: ageMs > STALE_MS,
        frozen: ageMs > FROZEN_MS,
      });
    }

    const ageSec = oldestCapturedMs == null ? null : Math.max(0, Math.round((now - oldestCapturedMs) / 1000));
    return {
      lineCode,
      fetchedAt,
      capturedAt: oldestCapturedMs == null ? null : new Date(oldestCapturedMs).toISOString(),
      ageSec,
      stale: ageSec == null ? true : ageSec * 1000 > STALE_MS,
      frozen: ageSec == null ? true : ageSec * 1000 > FROZEN_MS,
      stops: result,
    };
  });

// ---------- Server fn: estado realtime para UNA parada (todas sus líneas) ----------

export const getStopRealtimeState = createServerFn({ method: "GET" })
  .inputValidator((input: { stopCode: string }) =>
    z.object({ stopCode: z.string().min(1).max(16).regex(/^[0-9A-Za-z]+$/) }).parse(input),
  )
  .handler(
    async ({ data }): Promise<{
      stopCode: string;
      fetchedAt: string;
      capturedAt: string | null;
      ageSec: number | null;
      stale: boolean;
      frozen: boolean;
      lines: Array<{ lineCode: string; etaMinutes: number[] }>;
    }> => {
      const stopCode = data.stopCode;
      const fetchedAt = new Date().toISOString();
      const now = Date.now();

      const cached = await readSnapshotsForStops([stopCode]);
      const rows = cached.get(stopCode) ?? [];
      const stale = rows.length === 0 || rows.some((r) => !isFresh(r.captured_at, now));

      if (stale) {
        const byLine = await fetchAllLinesForStop(stopCode);
        const toUpsert: Array<{ stop_code: string; line_code: string; direction: number | null; eta_minutes: number[] }> = [];
        for (const [lc, mins] of byLine.entries()) {
          toUpsert.push({ stop_code: stopCode, line_code: lc, direction: null, eta_minutes: mins });
        }
        await upsertSnapshots(toUpsert);
      }

      const { data: freshRows } = await supabaseAdmin
        .from("bus_realtime_snapshots")
        .select("stop_code,line_code,eta_minutes,captured_at")
        .eq("stop_code", stopCode);

      const lines: Array<{ lineCode: string; etaMinutes: number[] }> = [];
      let oldestMs: number | null = null;
      for (const r of (freshRows ?? []) as SnapRow[]) {
        lines.push({ lineCode: r.line_code, etaMinutes: r.eta_minutes ?? [] });
        const t = Date.parse(r.captured_at);
        if (oldestMs == null || t < oldestMs) oldestMs = t;
      }

      const ageSec = oldestMs == null ? null : Math.max(0, Math.round((now - oldestMs) / 1000));
      return {
        stopCode,
        fetchedAt,
        capturedAt: oldestMs == null ? null : new Date(oldestMs).toISOString(),
        ageSec,
        stale: ageSec == null ? true : ageSec * 1000 > STALE_MS,
        frozen: ageSec == null ? true : ageSec * 1000 > FROZEN_MS,
        lines,
      };
    },
  );

// ---------- Compat shims (legacy callers) ----------
// Mantienen la forma antigua para no romper bus-realtime-client.ts y
// StopRealtimeSheet. Internamente usan el mismo fetch+cache que arriba.

type LegacyArrival = {
  line: string;
  destination: string;
  etaMin: number;
  lat: number | null;
  lng: number | null;
};

async function buildArrivalsForStop(
  stopCode: string,
  filterLine?: string | null,
): Promise<LegacyArrival[]> {
  const now = Date.now();
  const cached = await readSnapshotsForStops([stopCode]);
  let rows = cached.get(stopCode) ?? [];
  const anyStale = rows.length === 0 || rows.some((r) => !isFresh(r.captured_at, now));
  if (anyStale) {
    const byLine = await fetchAllLinesForStop(stopCode);
    const toUpsert: Array<{ stop_code: string; line_code: string; direction: number | null; eta_minutes: number[] }> = [];
    for (const [lc, mins] of byLine.entries()) {
      toUpsert.push({ stop_code: stopCode, line_code: lc, direction: null, eta_minutes: mins });
    }
    await upsertSnapshots(toUpsert);
    const re = await readSnapshotsForStops([stopCode]);
    rows = re.get(stopCode) ?? [];
  }

  const wanted = filterLine ? normalizeLine(filterLine) : null;
  const lineCodes = rows.map((r) => r.line_code);
  // Destinos por línea: último stop_name por dirección
  const { data: destStops } = lineCodes.length
    ? await supabaseAdmin
        .from("bus_line_stops")
        .select("line_code,direction,seq,stop_name")
        .in("line_code", lineCodes)
    : { data: [] as Array<{ line_code: string; direction: number; seq: number; stop_name: string }> };
  const destByLineDir = new Map<string, string>();
  if (destStops) {
    const grouped = new Map<string, { seq: number; name: string }>();
    for (const s of destStops) {
      const k = `${s.line_code}|${s.direction}`;
      const prev = grouped.get(k);
      if (!prev || s.seq > prev.seq) grouped.set(k, { seq: s.seq, name: s.stop_name });
    }
    for (const [k, v] of grouped.entries()) destByLineDir.set(k, v.name);
  }

  const out: LegacyArrival[] = [];
  for (const r of rows) {
    if (wanted && normalizeLine(r.line_code) !== wanted) continue;
    const destA = destByLineDir.get(`${r.line_code}|1`) ?? "";
    const destB = destByLineDir.get(`${r.line_code}|2`) ?? "";
    const destination = destA || destB || "";
    for (const m of r.eta_minutes ?? []) {
      out.push({ line: r.line_code, destination, etaMin: m, lat: null, lng: null });
    }
  }
  out.sort((a, b) => a.etaMin - b.etaMin);
  return out;
}

export const getStopRealtime = createServerFn({ method: "GET" })
  .inputValidator((input: { stopCode: string }) =>
    z.object({ stopCode: z.string().min(1).max(16).regex(/^[0-9A-Za-z]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ arrivals: LegacyArrival[]; fetchedAt: number }> => {
    const arrivals = await buildArrivalsForStop(data.stopCode);
    return { arrivals, fetchedAt: Date.now() };
  });

export const getStopsRealtimeBatch = createServerFn({ method: "POST" })
  .inputValidator((input: { stopCodes: string[]; line?: string }) =>
    z
      .object({
        stopCodes: z.array(z.string().min(1).max(16).regex(/^[0-9A-Za-z]+$/)).min(1).max(20),
        line: z.string().min(1).max(8).regex(/^[0-9A-Za-z]+$/).optional(),
      })
      .parse(input),
  )
  .handler(
    async ({ data }): Promise<{ stops: Record<string, LegacyArrival[]>; fetchedAt: number }> => {
      const stops: Record<string, LegacyArrival[]> = {};
      await mapLimit(data.stopCodes, 6, async (code) => {
        stops[code] = await buildArrivalsForStop(code, data.line ?? null);
      });
      return { stops, fetchedAt: Date.now() };
    },
  );
