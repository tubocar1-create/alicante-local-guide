import { createFileRoute } from "@tanstack/react-router";
import { unzipSync, strFromU8 } from "fflate";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Descarga el GTFS oficial del TRAM d'Alacant desde el NAP (Punto de Acceso
// Nacional de Transportes) y vuelca todas las tablas a Supabase. Pensado
// para ejecutarse semanalmente vía cron.

const NAP_URL = "https://nap.transportes.gob.es/api/Fichero/download/1167";
const SOURCE_LABEL = "NAP file 1167 (TRAM d'Alacant / FGV)";

function parseCsv(text: string): Record<string, string>[] {
  // GTFS CSV: cabecera + filas. Soporta comillas dobles y comas dentro.
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

const n = (v: string | undefined) => (v && v !== "" ? Number(v) : null);
const s = (v: string | undefined) => (v && v !== "" ? v : null);
const b = (v: string | undefined) => v === "1";

async function batchInsert(table: string, rows: any[], chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await supabaseAdmin.from(table).insert(slice);
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
  await supabaseAdmin.from("tram_stop_times").delete().not("trip_id", "is", null);
  await supabaseAdmin.from("tram_shapes").delete().not("shape_id", "is", null);
  await supabaseAdmin.from("tram_trips").delete().not("trip_id", "is", null);
  await supabaseAdmin.from("tram_calendar_dates").delete().not("service_id", "is", null);
  await supabaseAdmin.from("tram_calendar").delete().not("service_id", "is", null);
  await supabaseAdmin.from("tram_routes").delete().not("route_id", "is", null);
  await supabaseAdmin.from("tram_stops").delete().not("stop_id", "is", null);
  await supabaseAdmin.from("tram_agencies").delete().not("agency_id", "is", null);

  await batchInsert("tram_agencies", agencies.map((a) => ({
    agency_id: a.agency_id || "default",
    agency_name: a.agency_name,
    agency_url: s(a.agency_url),
    agency_timezone: s(a.agency_timezone) ?? "Europe/Madrid",
    agency_lang: s(a.agency_lang),
    agency_phone: s(a.agency_phone),
  })));

  await batchInsert("tram_routes", routes.map((r) => ({
    route_id: r.route_id,
    agency_id: s(r.agency_id) ?? agencies[0]?.agency_id ?? "default",
    route_short_name: s(r.route_short_name),
    route_long_name: s(r.route_long_name),
    route_desc: s(r.route_desc),
    route_type: n(r.route_type),
    route_url: s(r.route_url),
    route_color: s(r.route_color),
    route_text_color: s(r.route_text_color),
  })));

  await batchInsert("tram_stops", stops.map((st) => ({
    stop_id: st.stop_id,
    stop_code: s(st.stop_code),
    stop_name: st.stop_name,
    stop_desc: s(st.stop_desc),
    stop_lat: n(st.stop_lat),
    stop_lon: n(st.stop_lon),
    zone_id: s(st.zone_id),
    stop_url: s(st.stop_url),
    location_type: n(st.location_type),
    parent_station: s(st.parent_station),
    wheelchair_boarding: n(st.wheelchair_boarding),
  })));

  await batchInsert("tram_calendar", calendar.map((c) => ({
    service_id: c.service_id,
    monday: b(c.monday), tuesday: b(c.tuesday), wednesday: b(c.wednesday),
    thursday: b(c.thursday), friday: b(c.friday), saturday: b(c.saturday), sunday: b(c.sunday),
    start_date: c.start_date,
    end_date: c.end_date,
  })));

  await batchInsert("tram_calendar_dates", calDates.map((c) => ({
    service_id: c.service_id,
    date: c.date,
    exception_type: Number(c.exception_type),
  })));

  await batchInsert("tram_trips", trips.map((t) => ({
    trip_id: t.trip_id,
    route_id: t.route_id,
    service_id: t.service_id,
    trip_headsign: s(t.trip_headsign),
    trip_short_name: s(t.trip_short_name),
    direction_id: n(t.direction_id),
    block_id: s(t.block_id),
    shape_id: s(t.shape_id),
    wheelchair_accessible: n(t.wheelchair_accessible),
    bikes_allowed: n(t.bikes_allowed),
  })));

  await batchInsert("tram_stop_times", stopTimes.map((r) => ({
    trip_id: r.trip_id,
    arrival_time: r.arrival_time,
    departure_time: r.departure_time,
    stop_id: r.stop_id,
    stop_sequence: Number(r.stop_sequence),
    stop_headsign: s(r.stop_headsign),
    pickup_type: n(r.pickup_type),
    drop_off_type: n(r.drop_off_type),
    shape_dist_traveled: n(r.shape_dist_traveled),
  })), 1000);

  await batchInsert("tram_shapes", shapes.map((sh) => ({
    shape_id: sh.shape_id,
    shape_pt_lat: Number(sh.shape_pt_lat),
    shape_pt_lon: Number(sh.shape_pt_lon),
    shape_pt_sequence: Number(sh.shape_pt_sequence),
    shape_dist_traveled: n(sh.shape_dist_traveled),
  })), 1000);

  const summary = {
    agencies: agencies.length,
    routes: routes.length,
    stops: stops.length,
    trips: trips.length,
    stop_times: stopTimes.length,
    shapes: shapes.length,
  };

  await supabaseAdmin.from("tram_feed_versions").insert({
    source_url: NAP_URL,
    source_label: SOURCE_LABEL,
    file_size_bytes: buf.byteLength,
    counts: summary,
    status: "ok",
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
          await supabaseAdmin.from("tram_feed_versions").insert({
            source_url: NAP_URL, source_label: SOURCE_LABEL, status: "error", error_message: message,
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
