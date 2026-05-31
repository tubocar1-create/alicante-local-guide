// Sync diario GTFS Renfe → snapshot slim de trenes que tocan Alicante-Terminal.
// Edge Function (Deno). Descompresión y parseo de stop_times.txt en STREAMING
// para no exceder la memoria (256 MB). Dos pasadas re-descargando el zip.

import { Unzip, UnzipInflate } from "https://esm.sh/fflate@0.8.2";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const NAP_URLS = [
  { id: "renfe-ld", url: "https://nap.transportes.gob.es/api/Fichero/download/1098" },
];
const DAYS_AHEAD = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Stop = { stop_id: string; stop_name: string };
type Trip = { trip_id: string; route_id: string; service_id: string; trip_short_name?: string };
type Route = { route_id: string; route_short_name?: string; route_long_name?: string };
type Cal = {
  service_id: string;
  monday: string; tuesday: string; wednesday: string; thursday: string;
  friday: string; saturday: string; sunday: string;
  start_date: string; end_date: string;
};
type CalDate = { service_id: string; date: string; exception_type: string };

function parseCsv<T = Record<string, string>>(text: string): T[] {
  const lines = text.split(/\r?\n/);
  if (!lines.length) return [];
  const head = lines[0].replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
  const out: T[] = [];
  for (let li = 1; li < lines.length; li++) {
    const l = lines[li];
    if (!l) continue;
    out.push(rowToObj(head, splitCsvLine(l)) as T);
  }
  return out;
}
function rowToObj(head: string[], cols: string[]): Record<string, string> {
  const o: Record<string, string> = {};
  for (let i = 0; i < head.length; i++) o[head[i]] = cols[i] ?? "";
  return o;
}
function splitCsvLine(l: string): string[] {
  const cols: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (q) { if (c === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ",") { cols.push(cur); cur = ""; } else cur += c; }
  }
  cols.push(cur);
  return cols;
}

const DOW = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
const ymd = (d: Date) =>
  `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
const isoDate = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

function classify(route: Route | undefined): { product: string; operator: string } {
  const all = ((route?.route_long_name || "") + " " + (route?.route_short_name || "")).toUpperCase();
  let product = "Renfe";
  if (all.includes("AVLO")) product = "AVLO";
  else if (all.includes("AVE")) product = "AVE";
  else if (all.includes("ALVIA")) product = "Alvia";
  else if (all.includes("EUROMED")) product = "Euromed";
  else if (all.includes("INTERCITY")) product = "Intercity";
  else if (all.includes("ALTARIA") || all.includes("TALGO")) product = "Larga Distancia";
  else if (all.includes("MD") || all.includes("MEDIA")) product = "Media Distancia";
  else if (all.includes("REGIONAL")) product = "Regional";
  else if (all.includes("CERCAN")) product = "Cercanías";
  else product = route?.route_short_name || "Renfe";
  return { product, operator: "RENFE" };
}

async function downloadZip(url: string, apiKey: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { ApiKey: apiKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Procesa el zip en streaming. Para cada fichero registrado en `wantedSmall` acumula bytes
// y los devuelve como string al final. Para `streamingHandler` llama línea a línea sin acumular.
function streamZip(
  buf: Uint8Array,
  opts: {
    wantedSmall: string[];
    streamFile?: string;
    onLine?: (line: string) => void;
  }
): { small: Record<string, string> } {
  const small: Record<string, Uint8Array[]> = {};
  for (const n of opts.wantedSmall) small[n] = [];

  // Buffer parcial para el fichero streaming.
  let leftover = new Uint8Array(0);
  const decoder = new TextDecoder("utf-8");

  return new Promise<{ small: Record<string, string> }>((resolve, reject) => {
    const unzip = new Unzip((file) => {
      const isStream = opts.streamFile && file.name === opts.streamFile;
      const collectInto = small[file.name];
      if (!isStream && !collectInto) {
        // Ignorar este fichero — no llamamos a file.start(), no se descomprime.
        return;
      }
      file.ondata = (err, chunk, final) => {
        if (err) { reject(err); return; }
        if (collectInto) collectInto.push(chunk);
        if (isStream && opts.onLine) {
          // Pegar leftover + chunk y partir por \n
          const combined = new Uint8Array(leftover.length + chunk.length);
          combined.set(leftover, 0);
          combined.set(chunk, leftover.length);
          let start = 0;
          for (let i = 0; i < combined.length; i++) {
            if (combined[i] === 10) {
              let end = i;
              if (end > start && combined[end - 1] === 13) end--;
              if (end > start) opts.onLine(decoder.decode(combined.subarray(start, end)));
              start = i + 1;
            }
          }
          leftover = combined.subarray(start);
          if (final && leftover.length) {
            let end = leftover.length;
            if (end > 0 && leftover[end - 1] === 13) end--;
            if (end > 0) opts.onLine(decoder.decode(leftover.subarray(0, end)));
            leftover = new Uint8Array(0);
          }
        }
      };
      file.start();
    });
    unzip.register(UnzipInflate);
    try {
      unzip.push(buf, true);
    } catch (e) {
      reject(e); return;
    }
    // Reconstruir strings small
    const out: Record<string, string> = {};
    for (const [n, chunks] of Object.entries(small)) {
      const total = chunks.reduce((a, c) => a + c.length, 0);
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.length; }
      out[n] = new TextDecoder("utf-8").decode(merged);
    }
    resolve({ small: out });
  }) as any;
}

async function buildSnapshot() {
  const apiKey = Deno.env.get("NAP_API_KEY");
  if (!apiKey) throw new Error("Falta NAP_API_KEY");

  const allTrips: any[] = [];
  const allStops: Record<string, string> = {};

  for (const src of NAP_URLS) {
    console.log(`[trenes-sync] descargando ${src.id}…`);
    const buf = await downloadZip(src.url, apiKey);
    console.log(`[trenes-sync] ${src.id}: ${(buf.byteLength / 1024 / 1024).toFixed(2)} MB`);

    // PASADA 1: descomprimir ficheros pequeños + escanear stop_times en streaming
    // para detectar Alicante-Terminal y los trip_ids que pasan por él.
    let headerCols: string[] = [];
    let idxTrip = -1, idxStop = -1;
    let lineCount = 0;
    const tripsTouchTerminal = new Set<string>();
    // Aún no sabemos terminalId, pero stops es pequeño y se decodifica al final del push.
    // Truco: hacer dos sub-pasadas sobre el mismo buffer.

    // 1a) descomprimir solo los pequeños para localizar terminalId
    const { small: small1 } = await streamZip(buf, {
      wantedSmall: ["stops.txt", "routes.txt", "trips.txt", "calendar.txt", "calendar_dates.txt"],
    });
    const stops = parseCsv<Stop>(small1["stops.txt"] || "");
    const routes = parseCsv<Route>(small1["routes.txt"] || "");
    const trips = parseCsv<Trip>(small1["trips.txt"] || "");
    const calendar = parseCsv<Cal>(small1["calendar.txt"] || "");
    const calDates = parseCsv<CalDate>(small1["calendar_dates.txt"] || "");
    console.log(`[trenes-sync] small: stops=${stops.length} routes=${routes.length} trips=${trips.length}`);

    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const terminal = stops.find(
      (s) => /terminal/i.test(s.stop_name) && (norm(s.stop_name).includes("alicante") || norm(s.stop_name).includes("alacant"))
    );
    if (!terminal) { console.warn(`[trenes-sync] ${src.id}: sin Alicante-Terminal`); continue; }
    const terminalId = terminal.stop_id;
    console.log(`[trenes-sync] terminal stop_id=${terminalId} (${terminal.stop_name})`);

    // 1b) escanear stop_times en streaming para detectar trip_ids
    await streamZip(buf, {
      wantedSmall: [],
      streamFile: "stop_times.txt",
      onLine: (line) => {
        if (!headerCols.length) {
          headerCols = line.replace(/^\uFEFF/, "").split(",").map((h) => h.trim());
          idxTrip = headerCols.indexOf("trip_id");
          idxStop = headerCols.indexOf("stop_id");
          return;
        }
        lineCount++;
        if (!line.includes(terminalId)) return;
        const cols = splitCsvLine(line);
        if (cols[idxStop] === terminalId) tripsTouchTerminal.add(cols[idxTrip]);
      },
    });
    console.log(`[trenes-sync] pasada 1: líneas=${lineCount} trips terminal=${tripsTouchTerminal.size}`);

    // PASADA 2: re-descargar zip y extraer stop_times de los trips relevantes.
    const buf2 = await downloadZip(src.url, apiKey);
    const idxArr = headerCols.indexOf("arrival_time");
    const idxDep = headerCols.indexOf("departure_time");
    const idxSeq = headerCols.indexOf("stop_sequence");
    const timesByTrip = new Map<string, Array<{ id: string; seq: number; arr: string; dep: string }>>();
    let headerSeen = false;

    await streamZip(buf2, {
      wantedSmall: [],
      streamFile: "stop_times.txt",
      onLine: (line) => {
        if (!headerSeen) { headerSeen = true; return; }
        const cols = splitCsvLine(line);
        const tid = cols[idxTrip];
        if (!tripsTouchTerminal.has(tid)) return;
        let arr = timesByTrip.get(tid);
        if (!arr) { arr = []; timesByTrip.set(tid, arr); }
        arr.push({ id: cols[idxStop], seq: Number(cols[idxSeq]), arr: cols[idxArr], dep: cols[idxDep] });
      },
    });
    for (const arr of timesByTrip.values()) arr.sort((a, b) => a.seq - b.seq);
    console.log(`[trenes-sync] pasada 2: trips con stop_times=${timesByTrip.size}`);

    // Calendarios + clasificación + construcción del snapshot
    const tripById = new Map(trips.map((t) => [t.trip_id, t]));
    const routeById = new Map(routes.map((r) => [r.route_id, r]));
    const calById = new Map(calendar.map((c) => [c.service_id, c]));
    const calDatesBy = new Map<string, CalDate[]>();
    for (const c of calDates) {
      let arr = calDatesBy.get(c.service_id);
      if (!arr) { arr = []; calDatesBy.set(c.service_id, arr); }
      arr.push(c);
    }
    const serviceRunsOn = (service_id: string, date: Date): boolean => {
      const ymdStr = ymd(date);
      const cal = calById.get(service_id);
      let runs = false;
      if (cal && cal.start_date <= ymdStr && ymdStr <= cal.end_date) {
        runs = (cal as any)[DOW[date.getUTCDay()]] === "1";
      }
      const exc = calDatesBy.get(service_id)?.find((c) => c.date === ymdStr);
      if (exc) { if (exc.exception_type === "1") runs = true; else if (exc.exception_type === "2") runs = false; }
      return runs;
    };

    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const dates: Date[] = [];
    for (let d = 0; d < DAYS_AHEAD; d++) {
      const x = new Date(today); x.setUTCDate(x.getUTCDate() + d); dates.push(x);
    }
    const stopNameById = new Map(stops.map((s) => [s.stop_id, s.stop_name]));

    for (const [trip_id, sts] of timesByTrip) {
      const trip = tripById.get(trip_id);
      if (!trip) continue;
      const cls = classify(routeById.get(trip.route_id));
      const activeDates: string[] = [];
      for (const d of dates) if (serviceRunsOn(trip.service_id, d)) activeDates.push(isoDate(d));
      if (!activeDates.length) continue;
      for (const s of sts) {
        if (!allStops[s.id]) {
          const name = stopNameById.get(s.id);
          if (name) allStops[s.id] = name;
        }
      }
      allTrips.push({
        id: `RENFE-${trip_id}`,
        operator: cls.operator,
        product: cls.product,
        number: trip.trip_short_name || trip_id,
        dates: activeDates,
        stops: sts,
        terminalId,
      });
    }
  }

  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const end = new Date(today); end.setUTCDate(end.getUTCDate() + DAYS_AHEAD - 1);
  const payload = { generated_at: new Date().toISOString(), trips: allTrips, stops: allStops };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { error } = await supabase.from("train_schedule_snapshot").upsert({
    id: "alicante-terminal",
    generated_at: new Date().toISOString(),
    date_start: isoDate(today),
    date_end: isoDate(end),
    payload: payload as any,
    source: "gtfs-renfe-nap",
    trips_count: allTrips.length,
  });
  if (error) throw new Error(`upsert: ${error.message}`);

  return { trips: allTrips.length, stops: Object.keys(allStops).length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const t0 = Date.now();
    const res = await buildSnapshot();
    return new Response(JSON.stringify({ ok: true, ...res, ms: Date.now() - t0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[trenes-sync] error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
