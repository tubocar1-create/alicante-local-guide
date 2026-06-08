// Descarga el GTFS oficial de Renfe (NAP fichero 1098), filtra el corredor
// Alicante-Terminal y construye un snapshot de 30 días que se persiste en
// `train_schedule_snapshot`. Cron diario (02:15 UTC ≈ 04:15 Madrid).
//
// MEMORIA: el worker de Cloudflare tiene ~128 MB. El GTFS Renfe trae un
// stop_times.txt de decenas de MB (en JS string llega a ~120 MB porque las
// strings son UTF-16). Por eso aquí:
//   1) Descomprimimos sólo los CSVs pequeños con unzipSync + filter.
//   2) stop_times.txt se procesa con la API de streaming `Unzip` de fflate
//      en chunks Uint8Array, parseando línea-a-línea sobre bytes (ASCII)
//      sin materializar nunca el fichero entero.

import { createFileRoute } from "@tanstack/react-router";
import { unzipSync, strFromU8, Unzip, UnzipInflate } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const NAP_URL = "https://nap.transportes.gob.es/api/Fichero/download/1098";
const DAYS = 30;
const SNAPSHOT_ID = "alicante";

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function csv(u8: Uint8Array | undefined): Record<string, string>[] {
  if (!u8) return [];
  const txt = strFromU8(u8);
  const lines = txt.split(/\r?\n/);
  if (!lines.length) return [];
  const head = lines[0].replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let li = 1; li < lines.length; li++) {
    const l = lines[li];
    if (!l) continue;
    const cols = parseCsvLine(l);
    const o: Record<string, string> = {};
    for (let i = 0; i < head.length; i++) o[head[i]] = cols[i] ?? "";
    out.push(o);
  }
  return out;
}

function parseCsvLine(l: string): string[] {
  const cols: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) {
      if (c === '"') {
        if (l[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") { cols.push(cur); cur = ""; }
      else cur += c;
    }
  }
  cols.push(cur);
  return cols;
}

const STATION_PATTERNS: RegExp[] = [
  /villena/i, /albacete/i, /cuenca/i, /ciudad\s*real/i, /puertollano/i, /chamart/i,
  /sorolla/i, /val[èe]ncia.*nord|valencia.*nord/i, /x[àa]tiva|j[áa]tiva/i,
  /castell[óo]/i, /camp\s*de\s*tarragona/i, /^tarragona$/i, /barcelona.*sants|^barcelona$/i,
  /zaragoza/i, /segovia/i, /valladolid/i, /palencia/i, /burgos/i, /^le[óo]n/i,
  /ourense/i, /coru[ñn]a/i, /vigo/i, /oviedo/i, /gij[óo]n/i,
  /sant\s*gabriel|san\s*gabriel/i, /torrellano/i, /elx.*parc|elche.*parque/i,
  /elx.*carr[úu]s|elche.*carr[úu]s/i, /crevillent/i, /albatera|catral/i,
  /callosa.*segura|cox/i, /orihuela/i, /beniel/i, /murcia.*carmen|^murcia$/i,
  /balsicas|mar\s*menor/i, /torre.*pacheco/i, /cartagena/i,
  /alcantarilla/i, /librilla/i, /alhama/i, /totana/i, /lorca/i,
  /universidad.*alicante|universitat/i, /sant\s*vicent.*centre|san\s*vicente.*centro/i,
];

function ymd(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function ymdCompact(d: Date) { return ymd(d).replace(/-/g, ""); }
function parseGtfsDate(s: string) {
  return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
}

// ---- Streaming stop_times.txt: parser línea-a-línea sobre Uint8Array ----
//
// Renfe GTFS usa ASCII puro en stop_times. Procesamos byte-a-byte buscando
// '\n' (0x0A). Para cada línea decodificamos sólo esos bytes a string
// (poco coste) y aplicamos parseCsvLine. Mantenemos un buffer de "resto"
// cuando un chunk corta una línea por la mitad.
type Row = { id: string; seq: number; arr: string; dep: string };
type StopTimesState = {
  leftover: Uint8Array | null;
  headerParsed: boolean;
  iTrip: number; iSeq: number; iStop: number; iArr: number; iDep: number;
  totalLines: number;
  decoder: TextDecoder;
};
function newStopTimesState(): StopTimesState {
  return {
    leftover: null,
    headerParsed: false,
    iTrip: -1, iSeq: -1, iStop: -1, iArr: -1, iDep: -1,
    totalLines: 0,
    decoder: new TextDecoder("utf-8"),
  };
}
function processChunk(
  state: StopTimesState,
  chunk: Uint8Array,
  terminalIds: Set<string>,
  relevantStops: Map<string, string>,
  tripStops: Map<string, Row[]>,
  tripHasTerminal: Set<string>,
  flush: boolean,
) {
  // Combinar con leftover.
  let buf: Uint8Array;
  if (state.leftover && state.leftover.length) {
    buf = new Uint8Array(state.leftover.length + chunk.length);
    buf.set(state.leftover, 0);
    buf.set(chunk, state.leftover.length);
    state.leftover = null;
  } else {
    buf = chunk;
  }
  let start = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a /* \n */) {
      let end = i;
      if (end > start && buf[end - 1] === 0x0d /* \r */) end--;
      handleLine(state, buf.subarray(start, end), terminalIds, relevantStops, tripStops, tripHasTerminal);
      start = i + 1;
    }
  }
  if (start < buf.length) {
    if (flush) {
      handleLine(state, buf.subarray(start), terminalIds, relevantStops, tripStops, tripHasTerminal);
    } else {
      // Guardar resto para el próximo chunk.
      state.leftover = buf.slice(start);
    }
  }
}
function handleLine(
  state: StopTimesState,
  bytes: Uint8Array,
  terminalIds: Set<string>,
  relevantStops: Map<string, string>,
  tripStops: Map<string, Row[]>,
  tripHasTerminal: Set<string>,
) {
  if (bytes.length === 0) return;
  const line = state.decoder.decode(bytes);
  if (!state.headerParsed) {
    const head = line.replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
    const idx: Record<string, number> = {};
    for (let i = 0; i < head.length; i++) idx[head[i]] = i;
    state.iTrip = idx["trip_id"];
    state.iSeq = idx["stop_sequence"];
    state.iStop = idx["stop_id"];
    state.iArr = idx["arrival_time"];
    state.iDep = idx["departure_time"];
    state.headerParsed = true;
    return;
  }
  const cols = parseCsvLine(line);
  const tripId = cols[state.iTrip];
  const stopId = cols[state.iStop];
  if (!tripId || !stopId) return;
  if (terminalIds.has(stopId)) tripHasTerminal.add(tripId);
  if (relevantStops.has(stopId)) {
    let arr = tripStops.get(tripId);
    if (!arr) { arr = []; tripStops.set(tripId, arr); }
    arr.push({
      id: stopId,
      seq: Number(cols[state.iSeq]),
      arr: (cols[state.iArr] || "").trim(),
      dep: (cols[state.iDep] || "").trim(),
    });
  }
  state.totalLines++;
}

async function buildSnapshot() {
  const KEY = process.env.NAP_API_KEY;
  if (!KEY) throw new Error("Falta NAP_API_KEY");

  console.log("[refresh-renfe] descargando GTFS…");
  const r = await fetch(NAP_URL, { headers: { ApiKey: KEY } });
  if (!r.ok) throw new Error(`NAP HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  console.log(`[refresh-renfe] ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);

  // --- Paso 1: descomprimir SÓLO los CSVs pequeños ---
  const small = unzipSync(buf, {
    filter: (f) =>
      f.name === "stops.txt" ||
      f.name === "routes.txt" ||
      f.name === "trips.txt" ||
      f.name === "calendar.txt" ||
      f.name === "calendar_dates.txt",
  });
  const stops = csv(small["stops.txt"]);
  const routes = csv(small["routes.txt"]);
  const trips = csv(small["trips.txt"]);
  const calendar = csv(small["calendar.txt"]);
  const calDates = csv(small["calendar_dates.txt"]);
  // Liberar el dict.
  for (const k of Object.keys(small)) delete (small as any)[k];
  console.log(`[refresh-renfe] stops=${stops.length} trips=${trips.length}`);

  const alicante = stops.filter((s) => {
    const n = norm(s.stop_name);
    return (n.includes("alicante") || n.includes("alacant")) && n.includes("terminal");
  });
  if (!alicante.length) throw new Error("Sin Alicante-Terminal en GTFS");
  const terminalIds = new Set(alicante.map((s) => s.stop_id));

  const relevantStops = new Map<string, string>();
  for (const s of stops) {
    if (terminalIds.has(s.stop_id) || STATION_PATTERNS.some((re) => re.test(s.stop_name))) {
      relevantStops.set(s.stop_id, s.stop_name);
    }
  }

  const tripsById = new Map(trips.map((t) => [t.trip_id, t]));
  const routesById = new Map(routes.map((r2) => [r2.route_id, r2]));

  // --- Paso 2: stream stop_times.txt en chunks (NO se carga entero) ---
  const tripStops = new Map<string, Row[]>();
  const tripHasTerminal = new Set<string>();
  const state = newStopTimesState();

  await new Promise<void>((resolve, reject) => {
    try {
      const unzipper = new Unzip();
      unzipper.register(UnzipInflate);
      unzipper.onfile = (file) => {
        if (file.name !== "stop_times.txt") {
          // Saltar el resto: no llamamos a start(), por lo que fflate lo ignora.
          return;
        }
        file.ondata = (err, chunk, final) => {
          if (err) { reject(err); return; }
          try {
            processChunk(state, chunk, terminalIds, relevantStops, tripStops, tripHasTerminal, final);
            if (final) resolve();
          } catch (e) { reject(e as any); }
        };
        file.start();
      };
      // Alimentar el ZIP completo (es sólo 0.72 MB; el grande es el descomprimido).
      unzipper.push(buf, true);
    } catch (e) { reject(e as any); }
  });

  console.log(`[refresh-renfe] stop_times procesados=${state.totalLines} trips_terminal=${tripHasTerminal.size}`);

  // --- Calendario + dates ---
  const calById = new Map(calendar.map((c) => [c.service_id, c]));
  const calDatesByService = new Map<string, Record<string, string>[]>();
  for (const c of calDates) {
    let a = calDatesByService.get(c.service_id);
    if (!a) { a = []; calDatesByService.set(c.service_id, a); }
    a.push(c);
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setUTCDate(horizon.getUTCDate() + DAYS);

  const datesCache = new Map<string, string[]>();
  function datesFor(serviceId: string): string[] {
    const hit = datesCache.get(serviceId);
    if (hit) return hit;
    const cal = calById.get(serviceId);
    const exc = calDatesByService.get(serviceId) || [];
    const removed = new Set(exc.filter((e) => e.exception_type === "2").map((e) => e.date));
    const out: string[] = [];
    if (cal) {
      const start = parseGtfsDate(cal.start_date);
      const end = parseGtfsDate(cal.end_date);
      const from = start > today ? start : today;
      const to = end < horizon ? end : horizon;
      const dows = [cal.sunday, cal.monday, cal.tuesday, cal.wednesday, cal.thursday, cal.friday, cal.saturday];
      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        if (removed.has(ymdCompact(d))) continue;
        if (dows[d.getUTCDay()] === "1") out.push(ymd(d));
      }
    }
    for (const cd of exc) {
      if (cd.exception_type !== "1") continue;
      const d = parseGtfsDate(cd.date);
      if (d < today || d > horizon) continue;
      const iso = ymd(d);
      if (!out.includes(iso)) out.push(iso);
    }
    out.sort();
    datesCache.set(serviceId, out);
    return out;
  }

  const outTrips: any[] = [];
  const usedStops = new Set<string>();
  for (const tripId of tripHasTerminal) {
    const t = tripsById.get(tripId);
    if (!t) continue;
    const dates = datesFor(t.service_id);
    if (!dates.length) continue;
    const route = routesById.get(t.route_id);
    const product = (route?.route_short_name || route?.route_long_name || "RENFE").toUpperCase();
    const sts = (tripStops.get(tripId) || []).slice().sort((a, b) => a.seq - b.seq);
    if (sts.length < 2) continue;
    const terminalStop = sts.find((st) => terminalIds.has(st.id));
    if (!terminalStop) continue;
    for (const st of sts) usedStops.add(st.id);
    outTrips.push({
      id: tripId,
      number: t.trip_short_name || tripId,
      product,
      terminalId: terminalStop.id,
      dates,
      stops: sts,
    });
  }
  const stopsOut: Record<string, string> = {};
  for (const sid of usedStops) stopsOut[sid] = relevantStops.get(sid)!;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    horizonDays: DAYS,
    source: "Renfe GTFS (NAP 1098)",
    stops: stopsOut,
    trips: outTrips,
  };

  const dateStart = ymd(today);
  const dateEnd = ymd(horizon);

  const { error } = await supabaseAdmin
    .from("train_schedule_snapshot")
    .upsert({
      id: SNAPSHOT_ID,
      generated_at: snapshot.generatedAt,
      date_start: dateStart,
      date_end: dateEnd,
      payload: snapshot,
      source: "gtfs-renfe-nap",
      trips_count: outTrips.length,
    });
  if (error) throw new Error(`Supabase upsert: ${error.message}`);

  console.log(`[refresh-renfe] OK trips=${outTrips.length} ${dateStart}→${dateEnd}`);
  return { trips: outTrips.length, dateStart, dateEnd };
}

export const Route = createFileRoute("/api/public/hooks/refresh-renfe-snapshot")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await buildSnapshot();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          console.error("[refresh-renfe] error", e);
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          const result = await buildSnapshot();
          return Response.json({ ok: true, ...result });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message ?? "unknown" }, { status: 500 });
        }
      },
    },
  },
});
