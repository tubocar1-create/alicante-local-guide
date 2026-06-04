#!/usr/bin/env node
// Ingesta v2: asigna shapes a direcciones por COSTE de snap a paradas
// (ignora etiqueta IDA/VUELTA del KMZ, que no coincide con nuestro convenio).
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SHAPES_DIR = "/mnt/documents/bus-shapes";
const SKIP_CODES = new Set(["12"]);

const url = process.env.SUPABASE_URL || "https://htzatsqihojttrwsawis.supabase.co";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) { console.error("Falta SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const supa = createClient(url, key);

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
function hashCoords(c) { const a=c[0],b=c[c.length-1]; return `${c.length}|${a[0].toFixed(5)},${a[1].toFixed(5)}|${b[0].toFixed(5)},${b[1].toFixed(5)}`; }

function uniqueShapes(features) {
  const seen = new Map();
  for (const f of features) {
    const h = hashCoords(f.geometry.coordinates);
    if (!seen.has(h)) seen.set(h, { coords: f.geometry.coordinates, len: f.properties.length_m, sourceId: f.properties.sourceId });
  }
  // ordenar por longitud (ascendente) — preferimos rutas base
  return [...seen.values()].sort((a,b)=>a.len-b.len);
}

function snapStops(stops, coords) {
  const projs = []; let lastCum = 0; let sumOff = 0; let maxOff = 0;
  for (const s of stops) {
    const p = projectOn({lat:s.lat,lng:s.lng}, coords);
    const cum = Math.max(p.d, lastCum);
    projs.push({ seq:s.seq, stop_code:s.stop_code, cum, off:p.off });
    lastCum = cum; sumOff += p.off; if (p.off>maxOff) maxOff = p.off;
  }
  return { projs, sumOff, maxOff };
}

async function getStops(code, dir) {
  const { data, error } = await supa.from("bus_line_stops")
    .select("seq, stop_code, bus_stops(lat,lng)")
    .eq("line_code", code).eq("direction", dir).order("seq");
  if (error) throw error;
  return (data||[]).map(s=>({
    seq:s.seq, stop_code:s.stop_code,
    lat:s.bus_stops?.lat ?? null, lng:s.bus_stops?.lng ?? null,
    hasCoord: s.bus_stops?.lat != null && s.bus_stops?.lng != null,
  }));
}

async function main() {
  const files = fs.readdirSync(SHAPES_DIR).filter(f=>f.startsWith("linea-")&&f.endsWith(".geojson"));
  const report = [];

  for (const file of files.sort()) {
    const code = file.replace("linea-","").replace(".geojson","");
    if (SKIP_CODES.has(code)) { report.push({code, skipped:true}); continue; }
    const fc = JSON.parse(fs.readFileSync(path.join(SHAPES_DIR,file),"utf8"));
    const shapes = uniqueShapes(fc.features);
    if (shapes.length === 0) { report.push({code, error:"sin shapes"}); continue; }

    const stops1 = await getStops(code, 1);
    const stops2 = await getStops(code, 2);

    // Calcular coste de cada shape para cada dirección (sólo top-2 más cortos para velocidad)
    const candidates = shapes.slice(0, Math.min(4, shapes.length));
    const cost = candidates.map((sh,idx)=>({
      idx,
      c1: stops1.length ? snapStops(stops1, sh.coords).sumOff/stops1.length : Infinity,
      c2: stops2.length ? snapStops(stops2, sh.coords).sumOff/stops2.length : Infinity,
    }));

    // Asignación: para dir 1 y 2 elegir shape con menor coste, evitando colisión
    let pick1 = null, pick2 = null;
    if (stops1.length && stops2.length) {
      // probar todas las combinaciones (i,j) i!=j
      let best = { score: Infinity };
      for (const a of cost) for (const b of cost) {
        if (a.idx===b.idx) continue;
        const s = a.c1 + b.c2;
        if (s < best.score) best = { score:s, i1:a.idx, i2:b.idx };
      }
      // también permitir mismo shape si solo hay 1
      if (candidates.length === 1) { pick1 = pick2 = 0; }
      else { pick1 = best.i1; pick2 = best.i2; }
    } else if (stops1.length) {
      pick1 = cost.sort((a,b)=>a.c1-b.c1)[0].idx;
    } else if (stops2.length) {
      pick2 = cost.sort((a,b)=>a.c2-b.c2)[0].idx;
    }

    const dirReport = {};
    for (const [dir, pickIdx, stops] of [[1,pick1,stops1],[2,pick2,stops2]]) {
      if (pickIdx === null || !stops.length) { dirReport[dir] = "sin asignación"; continue; }
      const sh = candidates[pickIdx];
      const totalLen = polylineLength(sh.coords);
      const { projs, maxOff } = snapStops(stops, sh.coords);

      const { error: e1 } = await supa.from("bus_line_shapes").upsert({
        line_code: code, direction: dir, source: "vectalia_kmz",
        source_line_id: sh.sourceId ?? null,
        geometry: { type:"LineString", coordinates: sh.coords },
        total_length_m: Math.round(totalLen),
        point_count: sh.coords.length,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "line_code,direction" });
      if (e1) { dirReport[dir] = `ERR shape: ${e1.message}`; continue; }

      const rows = []; let cumulative = 0;
      for (let i=0;i<projs.length-1;i++) {
        const a=projs[i], b=projs[i+1];
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
      await supa.from("bus_line_stop_distances").delete().eq("line_code",code).eq("direction",dir);
      if (rows.length) {
        const { error: e3 } = await supa.from("bus_line_stop_distances").insert(rows);
        if (e3) { dirReport[dir] = `ERR dist: ${e3.message}`; continue; }
      }
      dirReport[dir] = `OK ${(totalLen/1000).toFixed(2)}km pts=${sh.coords.length} stops=${stops.length} cum=${(cumulative/1000).toFixed(2)}km maxOff=${maxOff.toFixed(0)}m`;
    }
    const out = { code, candidates: candidates.length, dirs: dirReport };
    report.push(out);
    console.log(JSON.stringify(out));
  }
  fs.writeFileSync("/mnt/documents/bus-shapes/_ingest_report_v2.json", JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
