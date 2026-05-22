import { createFileRoute } from "@tanstack/react-router";
import { unzipSync, strFromU8 } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Descarga el GTFS oficial del TRAM d'Alacant desde el NAP y vuelca todas las
// tablas a Supabase. Pensado para ejecutarse semanalmente vía cron.

const NAP_URL = "https://nap.transportes.gob.es/api/Fichero/download/1167";

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ""));
  return rows.slice(1)
    .filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      header.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
      return o;
    });
}

const num = (v: string | undefined) => (v && v !== "" ? Number(v) : null);
const str = (v: string | undefined) => (v && v !== "" ? v : null);
const bln = (v: string | undefined) => v === "1";
// "YYYYMMDD" → "YYYY-MM-DD"
const isoDate = (v: string | undefined) => (v && v.length === 8 ? `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}` : null);
// "HH:MM:SS" (puede ser >24h) → segundos desde medianoche
const toSecs = (v: string | undefined): number | null => {
  if (!v) return null;
  const m = v.split(":");
  if (m.length < 2) return null;
  return Number(m[0]) * 3600 + Number(m[1]) * 60 + Number(m[2] ?? 0);
};

async function batchInsert(table: string, rows: any[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await ((supabaseAdmin as any).from(table)).insert(slice);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function runSync() {
  const apiKey = process.env.NAP_API_KEY;
  if (!apiKey) throw new Error("Missing NAP_API_KEY");

  const res = await fetch(NAP_URL, { headers: { ApiKey: apiKey } });
  if (!res.ok) throw new Error(`NAP HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());

  const unzipped = unzipSync(buf);
  const file = (name: string) => {
    const u8 = unzipped[name];
    return u8 ? parseCsv(strFromU8(u8)) : [];
  };

  const agencies = file("agency.txt");
  const routes = file("routes.txt");
  const stops = file("stops.txt");
  const calendar = file("calendar.txt");
  const calDates = file("calendar_dates.txt");
  const trips = file("trips.txt");
  const stopTimes = file("stop_times.txt");
  const shapes = file("shapes.txt");

  // Limpia tablas dependientes primero (FK).
  await (supabaseAdmin.from("tram_stop_times") as any).delete().not("trip_id", "is", null);
  await (supabaseAdmin.from("tram_shapes") as any).delete().not("shape_id", "is", null);
  await (supabaseAdmin.from("tram_trips") as any).delete().not("trip_id", "is", null);
  await (supabaseAdmin.from("tram_calendar_dates") as any).delete().not("service_id", "is", null);
  await (supabaseAdmin.from("tram_calendar") as any).delete().not("service_id", "is", null);
  await (supabaseAdmin.from("tram_routes") as any).delete().not("route_id", "is", null);
  await (supabaseAdmin.from("tram_stops") as any).delete().not("stop_id", "is", null);
  await (supabaseAdmin.from("tram_agencies") as any).delete().not("agency_id", "is", null);

  await batchInsert("tram_agencies", agencies.map((a) => ({
    agency_id: a.agency_id || "default",
    agency_name: a.agency_name,
    agency_url: str(a.agency_url),
    agency_timezone: str(a.agency_timezone) ?? "Europe/Madrid",
    agency_lang: str(a.agency_lang),
    agency_phone: str(a.agency_phone),
    agency_email: str(a.agency_email),
  })));

  await batchInsert("tram_routes", routes.map((r) => ({
    route_id: r.route_id,
    agency_id: str(r.agency_id) ?? agencies[0]?.agency_id ?? "default",
    route_short_name: str(r.route_short_name),
    route_long_name: str(r.route_long_name),
    route_desc: str(r.route_desc),
    route_type: num(r.route_type),
    route_url: str(r.route_url),
    route_color: str(r.route_color),
    route_text_color: str(r.route_text_color),
  })));

  await batchInsert("tram_stops", stops.map((st) => ({
    stop_id: st.stop_id,
    stop_code: str(st.stop_code),
    stop_name: st.stop_name,
    stop_desc: str(st.stop_desc),
    lat: num(st.stop_lat),
    lng: num(st.stop_lon),
    zone_id: str(st.zone_id),
    stop_url: str(st.stop_url),
    location_type: num(st.location_type),
    parent_station: str(st.parent_station),
    wheelchair_boarding: num(st.wheelchair_boarding),
    platform_code: str(st.platform_code),
  })));

  await batchInsert("tram_calendar", calendar.map((c) => ({
    service_id: c.service_id,
    monday: bln(c.monday), tuesday: bln(c.tuesday), wednesday: bln(c.wednesday),
    thursday: bln(c.thursday), friday: bln(c.friday), saturday: bln(c.saturday), sunday: bln(c.sunday),
    start_date: isoDate(c.start_date),
    end_date: isoDate(c.end_date),
  })));

  await batchInsert("tram_calendar_dates", calDates.map((c) => ({
    service_id: c.service_id,
    date: isoDate(c.date),
    exception_type: Number(c.exception_type),
  })));

  await batchInsert("tram_trips", trips.map((t) => ({
    trip_id: t.trip_id,
    route_id: t.route_id,
    service_id: t.service_id,
    trip_headsign: str(t.trip_headsign),
    trip_short_name: str(t.trip_short_name),
    direction_id: num(t.direction_id),
    block_id: str(t.block_id),
    shape_id: str(t.shape_id),
    wheelchair_accessible: num(t.wheelchair_accessible),
    bikes_allowed: num(t.bikes_allowed),
  })));

  await batchInsert("tram_stop_times", stopTimes.map((r) => ({
    trip_id: r.trip_id,
    arrival_seconds: toSecs(r.arrival_time),
    departure_seconds: toSecs(r.departure_time),
    stop_id: r.stop_id,
    stop_sequence: Number(r.stop_sequence),
    stop_headsign: str(r.stop_headsign),
    pickup_type: num(r.pickup_type),
    drop_off_type: num(r.drop_off_type),
    shape_dist_traveled: num(r.shape_dist_traveled),
    timepoint: num(r.timepoint),
  })), 1000);

  await batchInsert("tram_shapes", shapes.map((sh) => ({
    shape_id: sh.shape_id,
    shape_pt_lat: Number(sh.shape_pt_lat),
    shape_pt_lng: Number(sh.shape_pt_lon),
    shape_pt_sequence: Number(sh.shape_pt_sequence),
    shape_dist_traveled: num(sh.shape_dist_traveled),
  })), 1000);

  const summary = {
    agencies: agencies.length, routes: routes.length, stops: stops.length,
    trips: trips.length, stop_times: stopTimes.length, shapes: shapes.length,
  };

  // Rango de fechas de validez del feed.
  const starts = calendar.map((c) => isoDate(c.start_date)).filter(Boolean) as string[];
  const ends = calendar.map((c) => isoDate(c.end_date)).filter(Boolean) as string[];

  await (supabaseAdmin.from("tram_feed_versions") as any).insert({
    source_url: NAP_URL,
    size_bytes: buf.byteLength,
    feed_start_date: starts.sort()[0] ?? null,
    feed_end_date: ends.sort().reverse()[0] ?? null,
    applied_at: new Date().toISOString(),
    notes: JSON.stringify({ status: "ok", ...summary }),
  });

  return summary;
}

export const Route = createFileRoute("/api/public/hooks/tram-sync")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const summary = await runSync();
          return Response.json({ ok: true, summary });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          await (supabaseAdmin.from("tram_feed_versions") as any).insert({
            source_url: NAP_URL,
            notes: JSON.stringify({ status: "error", error: message }),
          });
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async () => Response.json({ ok: true, info: "POST to trigger TRAM GTFS sync" }),
    },
  },
});
