// Server functions para snapshot realtime de Vectalia.
// Filosofía: la app lee el tiempo real por el bridge HTTPS del proyecto.
// Estos server functions solo:
//   1) sirve metadatos de paradas desde la BBDD
//   2) acepta snapshots ingestados desde el cliente y los persiste
//   3) reconstruye estado de línea/parada leyendo SOLO los snapshots cacheados
// Esto evita Akamai 403 y elimina cualquier dependencia de ScrapingBee/Firecrawl.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// ---------- Tipos públicos ----------

export type RealtimeStopEta = {
  stopCode: string;
  stopName: string;
  direction: 1 | 2;
  seq: number;
  etaMinutes: number[];
  capturedAt: string;
  ageSec: number;
  stale: boolean;
  frozen: boolean;
};

export type RealtimeLineState = {
  lineCode: string;
  fetchedAt: string;
  capturedAt: string | null;
  ageSec: number | null;
  stale: boolean;
  frozen: boolean;
  stops: RealtimeStopEta[];
};

const STALE_MS = 5 * 60 * 1000;
const FROZEN_MS = 10 * 60 * 1000;

function normalizeLine(code: string): string {
  const m = code.trim().toUpperCase().match(/^(\d+)([A-Z]?)$/);
  if (!m) return code.trim().toUpperCase();
  return String(parseInt(m[1], 10)) + m[2];
}

// ---------- Snapshot helpers ----------

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

// ---------- Server fn: meta de paradas de una línea ----------

export const getLineStops = createServerFn({ method: "GET" })
  .inputValidator((input: { lineCode: string }) =>
    z.object({ lineCode: z.string().min(1).max(8).regex(/^[0-9A-Za-z]+$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const lineCode = normalizeLine(data.lineCode);
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
    return { lineCode, stops };
  });

// ---------- Server fn: ingesta de snapshots desde el cliente ----------

export const ingestStopSnapshots = createServerFn({ method: "POST" })
  .inputValidator((input: {
    snapshots: Array<{ stopCode: string; lineCode: string; etaMinutes: number[] }>;
  }) =>
    z
      .object({
        snapshots: z
          .array(
            z.object({
              stopCode: z.string().min(1).max(16).regex(/^[0-9A-Za-z]+$/),
              lineCode: z.string().min(1).max(8).regex(/^[0-9A-Za-z]+$/),
              etaMinutes: z.array(z.number().int().min(0).max(240)).max(10),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const now = new Date().toISOString();
    const payload = data.snapshots.map((s) => ({
      stop_code: s.stopCode,
      line_code: normalizeLine(s.lineCode),
      direction: null,
      eta_minutes: s.etaMinutes,
      captured_at: now,
      source: "vectalia-client",
    }));
    await supabaseAdmin
      .from("bus_realtime_snapshots")
      .upsert(payload, { onConflict: "stop_code,line_code" });
    return { ok: true, count: payload.length };
  });

// ---------- Server fn: estado realtime de una línea (lee SOLO cache) ----------

export const getLineRealtimeState = createServerFn({ method: "GET" })
  .inputValidator((input: { lineCode: string }) =>
    z.object({ lineCode: z.string().min(1).max(8).regex(/^[0-9A-Za-z]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<RealtimeLineState> => {
    const lineCode = normalizeLine(data.lineCode);
    const fetchedAt = new Date().toISOString();

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
      return { lineCode, fetchedAt, capturedAt: null, ageSec: null, stale: true, frozen: true, stops: [] };
    }

    const uniqueStopCodes = Array.from(new Set(stops.map((s) => s.stop_code)));
    const now = Date.now();

    const { data: freshRows } = await supabaseAdmin
      .from("bus_realtime_snapshots")
      .select("stop_code,line_code,direction,eta_minutes,captured_at")
      .eq("line_code", lineCode)
      .in("stop_code", uniqueStopCodes);

    const bySnap = new Map<string, SnapRow>();
    for (const r of (freshRows ?? []) as SnapRow[]) bySnap.set(r.stop_code, r);

    const result: RealtimeStopEta[] = [];
    let oldestCapturedMs: number | null = null;
    for (const s of stops) {
      const snap = bySnap.get(s.stop_code);
      const capturedAtIso = snap?.captured_at ?? fetchedAt;
      const capturedMs = Date.parse(capturedAtIso);
      if (snap && (oldestCapturedMs == null || capturedMs < oldestCapturedMs)) oldestCapturedMs = capturedMs;
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

// ---------- Compat: getStopRealtime / getStopsRealtimeBatch (solo cache) ----------

type LegacyArrival = {
  line: string;
  destination: string;
  etaMin: number;
  lat: number | null;
  lng: number | null;
};

async function buildArrivalsForStopFromCache(
  stopCode: string,
  filterLine?: string | null,
): Promise<LegacyArrival[]> {
  const cached = await readSnapshotsForStops([stopCode]);
  const rows = cached.get(stopCode) ?? [];
  const wanted = filterLine ? normalizeLine(filterLine) : null;
  const lineCodes = rows.map((r) => r.line_code);
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
    const arrivals = await buildArrivalsForStopFromCache(data.stopCode);
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
      for (const code of data.stopCodes) {
        stops[code] = await buildArrivalsForStopFromCache(code, data.line ?? null);
      }
      return { stops, fetchedAt: Date.now() };
    },
  );
