#!/usr/bin/env node
// Lee /mnt/documents/bus-shapes/linea-*.geojson, dedupe por geometría,
// elige la ruta canónica (más corta) por dirección, upsert a bus_line_shapes
// y recalcula bus_line_stop_distances.
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SHAPES_DIR = "/mnt/documents/bus-shapes";
const SKIP_CODES = new Set(["12"]); // ya procesada antes

const url = process.env.SUPABASE_URL || "https://htzatsqihojttrwsawis.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const supa = createClient(url, key);

// ---------- geometría ----------
function haversine(a, b) {
  const R = 6371000, toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function polylineLength(poly) {
  let t=0; for (let i=1;i<poly.length;i++) t += haversine({lat:poly[i-1][1],lng:poly[i-1][0]},{lat:poly[i][1],lng:poly[i][0]}); return t;
}
function projectOn(point, poly) {
  let best = { d: 0, off: Infinity }, cum = 0;
  for (let i=0;i<poly.length-1;i++) {
    const a=poly[i], b=poly[i+1];
    const dx=b[0]-a[0], dy=b[1]-a[1], len2=dx*dx+dy*dy;
    let t = len2===0?0:((point.lng-a[0])*dx + (point.lat-a[1])*dy)/len2;
    t = Math.max(0, Math.min(1,t));
    const snap = { lat:a[1]+t*dy, lng:a[0]+t*dx };
    const off = haversine(point, snap);
    const segLen = haversine({lat:a[1],lng:a[0]},{lat:b[1],lng:b[0]});
    if (off < best.off) best = { d: cum + segLen*t, off };
    cum += segLen;
  }
  return best;
}

// ---------- dedupe + canónica ----------
function hashCoords(coords) {
  // hash rápido: primer/último/largo
  const a = coords[0], b = coords[coords.length-1];
  return `${coords.length}|${a[0].toFixed(5)},${a[1].toFixed(5)}|${b[0].toFixed(5)},${b[1].toFixed(5)}`;
}
function canonicalShapes(features) {
  // dedupe
  const seen = new Map();
  for (const f of features) {
    const h = hashCoords(f.geometry.coordinates);
    if (!seen.has(h)) seen.set(h, f);
  }
  const unique = [...seen.values()];
  // agrupar por dirección
  const byDir = { 1: [], 2: [] };
  for (const f of unique) {
    const dir = f.properties.direction === "IDA" ? 1 : 2;
    byDir[dir].push(f);
  }
  // canónica = la más corta por dirección
  const out = {};
  for (const dir of [1,2]) {
    if (byDir[dir].length === 0) continue;
    byDir[dir].sort((a,b)=>a.properties.length_m - b.properties.length_m);
    out[dir] = byDir[dir][0];
  }
  return out;
}

// ---------- main ----------
async function main() {
  const files = fs.readdirSync(SHAPES_DIR).filter(f=>f.startsWith("linea-")&&f.endsWith(".geojson"));
  const report = [];
  for (const file of files.sort()) {
    const code = file.replace("linea-","").replace(".geojson","");
    if (SKIP_CODES.has(code)) { report.push({code, skipped:"línea 12 ya procesada"}); continue; }
    const fc = JSON.parse(fs.readFileSync(path.join(SHAPES_DIR,file),"utf8"));
    const canon = canonicalShapes(fc.features);
    const lineReport = { code, dirs: {} };

    for (const dirStr of ["1","2"]) {
      const dir = Number(dirStr);
      const f = canon[dir];
      if (!f) { lineReport.dirs[dir] = "sin shape"; continue; }
      const coords = f.geometry.coordinates;
      const totalLen = polylineLength(coords);

      // upsert shape
      const { error: e1 } = await supa.from("bus_line_shapes").upsert({
        line_code: code,
        direction: dir,
        source: "vectalia_kmz",
        source_line_id: f.properties.sourceId ?? null,
        geometry: { type:"LineString", coordinates: coords },
        total_length_m: Math.round(totalLen),
        point_count: coords.length,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "line_code,direction" });
      if (e1) { lineReport.dirs[dir] = `ERROR shape: ${e1.message}`; continue; }

      // paradas
      const { data: stops, error: e2 } = await supa
        .from("bus_line_stops")
        .select("seq, stop_code, stop_name, bus_stops!inner(lat,lng)")
        .eq("line_code", code).eq("direction", dir).order("seq");
      if (e2) { lineReport.dirs[dir] = `ERROR stops: ${e2.message}`; continue; }
      if (!stops || stops.length < 2) { lineReport.dirs[dir] = `paradas insuficientes (${stops?.length||0})`; continue; }

      // proyectar
      const projs = [];
      let lastCum = 0;
      for (const s of stops) {
        const p = projectOn({lat:s.bus_stops.lat,lng:s.bus_stops.lng}, coords);
        const cum = Math.max(p.d, lastCum);
        projs.push({ seq:s.seq, stop_code:s.stop_code, cum, off:p.off });
        lastCum = cum;
      }

      // construir filas de distancia entre paradas consecutivas
      const rows = [];
      let cumulative = 0;
      for (let i=0;i<projs.length-1;i++) {
        const a = projs[i], b = projs[i+1];
        const dist = Math.max(0, b.cum - a.cum);
        cumulative += dist;
        rows.push({
          line_code: code, direction: dir,
          from_seq: a.seq, to_seq: b.seq,
          from_stop_code: a.stop_code, to_stop_code: b.stop_code,
          distance_m: Math.round(dist*100)/100,
          cumulative_m: Math.round(cumulative*100)/100,
          snap_offset_from_m: Math.round(a.off*100)/100,
          snap_offset_to_m: Math.round(b.off*100)/100,
        });
      }
      // borrar y reinsertar
      await supa.from("bus_line_stop_distances").delete().eq("line_code",code).eq("direction",dir);
      if (rows.length) {
        const { error: e3 } = await supa.from("bus_line_stop_distances").insert(rows);
        if (e3) { lineReport.dirs[dir] = `ERROR dist: ${e3.message}`; continue; }
      }

      const maxOff = Math.max(...projs.map(p=>p.off));
      lineReport.dirs[dir] = `OK len=${(totalLen/1000).toFixed(2)}km pts=${coords.length} stops=${stops.length} cum=${(cumulative/1000).toFixed(2)}km maxOff=${maxOff.toFixed(0)}m`;
    }
    report.push(lineReport);
    console.log(JSON.stringify(lineReport));
  }
  fs.writeFileSync("/mnt/documents/bus-shapes/_ingest_report.json", JSON.stringify(report,null,2));
  console.log("\nReporte completo escrito en /mnt/documents/bus-shapes/_ingest_report.json");
}
main().catch(e=>{console.error(e);process.exit(1);});
