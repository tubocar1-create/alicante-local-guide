import { writeFileSync, mkdirSync } from 'fs';
import { unzipSync, strFromU8 } from 'fflate';

const FC_KEY = process.env.FIRECRAWL_API_KEY;
const BASE = 'https://alicante.vectalia.es';

const LINES = [
  ['1','linea-01-san-gabriel-ciudad-elegida'],
  ['2','linea-02-la-florida-sagrada-familia'],
  ['3','linea-03-ciudad-de-asis-colonia-requena'],
  ['4','linea-04-cementerio-barrio-tombola'],
  ['5','linea-05-rambla-san-agustin'],
  ['6','linea-06-estacion-de-autobuses-juan-xxiii-2o-sector'],
  ['7','linea-07-avda-oscar-espla-el-rebolledo'],
  ['8A','linea-08a-explanada-virgen-del-remedio'],
  ['9','linea-09-avda-oscar-espla-playa-san-juan-avda-de-las-naciones'],
  ['13','linea-13-explanada-virgen-del-remedio-villafranqueza'],
  ['13N','13n-plaza-de-espana-virgen-del-remedio-villafranqueza'],
  ['14','linea14-plaza-la-vina-denida-jesuitas'],
  ['22','22-alicante-cabo-de-la-huerta-playa-san-juan-3'],
  ['22N','22n-alicante-plaza-puerta-del-mar-cabo-de-las-huertas-playa-san-juan'],
  ['24','linea-24-alicantee-autobuses-universidad-de-alicante-san-vicente-del-raspeig'],
  ['27','27-alicante-urbanova'],
  ['28','linea28-h-san-juan-camino-del-faro'],
  ['39','39-explanada-centro-de-tecnificacion'],
  ['3N','03n-urbanova-puerta-del-mar'],
];

mkdirSync('/mnt/documents/bus-shapes', { recursive: true });

function parseKml(kml) {
  const placemarks = [...kml.matchAll(/<Placemark[\s\S]*?<\/Placemark>/g)].map(m => m[0]);
  const shapes = [];
  for (const pm of placemarks) {
    const nameM = pm.match(/<name>([\s\S]*?)<\/name>/);
    const coordsM = pm.match(/<LineString[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordsM) continue;
    const coords = coordsM[1].trim().split(/\s+/).map(t => {
      const [lng,lat] = t.split(',').map(Number);
      return [lng,lat];
    }).filter(c => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (coords.length >= 2) shapes.push({ name: nameM ? nameM[1].trim() : '', coords });
  }
  return shapes;
}
function haversine(a,b){
  const R=6371000, toR=d=>d*Math.PI/180;
  const dLat=toR(b[1]-a[1]), dLng=toR(b[0]-a[0]);
  const s=Math.sin(dLat/2)**2+Math.cos(toR(a[1]))*Math.cos(toR(b[1]))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
function lengthM(c){ let t=0; for(let i=1;i<c.length;i++) t+=haversine(c[i-1],c[i]); return t; }

async function fcScrape(url, body) {
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${FC_KEY}`,'Content-Type':'application/json' },
    body: JSON.stringify({ url, ...body }),
  });
  if (!r.ok) throw new Error(`FC ${r.status}: ${(await r.text()).slice(0,200)}`);
  return (await r.json()).data || {};
}

const summary = [];

for (const [code, slug] of LINES) {
  const pageUrl = `${BASE}/linea/${slug}/`;
  console.log(`\n=== Línea ${code} ===`);
  try {
    // Step 1: load page, extract ids, then fetch each KMZ from inside the browser as base64
    const js = `(async()=>{
      const html = document.documentElement.outerHTML;
      const ids = [...new Set([...html.matchAll(/line-kml[^"']*?id%3D(\\d+)/g)].map(m=>m[1]))];
      const results = [];
      for (const id of ids) {
        const u = '/ajax/data/line-kml?lang=es&__internal__=1&type=line&id='+id+'&_=1&idx=0&vrs=5.7.593';
        try {
          const r = await fetch(u, {credentials:'include'});
          const ab = await r.arrayBuffer();
          const u8 = new Uint8Array(ab);
          let s=''; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]);
          results.push({id, status:r.status, b64: btoa(s)});
        } catch(e) { results.push({id, err: String(e)}); }
      }
      document.body.innerText='###JSON###'+JSON.stringify({ids,results});})();
    `;
    const ex = await fcScrape(pageUrl, {
      formats: ['markdown'],
      onlyMainContent: false,
      actions: [
        { type:'wait', milliseconds: 1500 },
        { type:'executeJavascript', script: js },
        { type:'wait', milliseconds: 500 },
      ],
    });
    const md = ex.markdown || '';
    const i = md.indexOf('###JSON###');
    if (i < 0) { console.log('  no JSON output'); summary.push({code, ok:false, err:'no_js_output'}); continue; }
    const payload = JSON.parse(md.slice(i+10).replace(/\([\[\]_*()\\])/g, '$1'));
    console.log('  ids:', payload.ids);
    const shapes = [];
    for (const r of payload.results) {
      if (!r.b64) { console.log(`  id ${r.id}: ${r.err||r.status}`); continue; }
      const buf = Buffer.from(r.b64, 'base64');
      try {
        const files = unzipSync(new Uint8Array(buf));
        const kmlName = Object.keys(files).find(n => n.toLowerCase().endsWith('.kml'));
        if (!kmlName) { console.log(`  id ${r.id}: sin .kml`); continue; }
        const kml = strFromU8(files[kmlName]);
        const sh = parseKml(kml);
        for (const s of sh) shapes.push({ ...s, sourceId: r.id });
      } catch (e) {
        console.log(`  id ${r.id} unzip err:`, e.message);
      }
    }
    if (shapes.length === 0) { console.log('  sin shapes'); summary.push({code, ok:false, err:'no_shapes'}); continue; }

    const geojson = {
      type:'FeatureCollection',
      meta:{ lineCode: code, sourceIds: payload.ids, source:'vectalia_kml', fetched_at: new Date().toISOString() },
      features: shapes.map((s,i)=>({
        type:'Feature',
        properties:{ name: s.name, sourceId: s.sourceId, direction: i===0?'IDA':'VUELTA', length_m: Math.round(lengthM(s.coords)), point_count: s.coords.length },
        geometry:{ type:'LineString', coordinates: s.coords },
      })),
    };
    const path = `/mnt/documents/bus-shapes/linea-${code}.geojson`;
    writeFileSync(path, JSON.stringify(geojson));
    const lens = geojson.features.map(f=>(f.properties.length_m/1000).toFixed(2)+'km');
    console.log(`  OK ${shapes.length} shapes (${lens.join(' / ')})`);
    summary.push({code, ok:true, shapes: shapes.length, lengths: lens.join(' / ')});
  } catch (e) {
    console.log('  ERROR:', e.message.slice(0,200));
    summary.push({code, ok:false, err: e.message.slice(0,120)});
  }
}

console.log('\n=== RESUMEN ===');
console.table(summary);
writeFileSync('/mnt/documents/bus-shapes/_summary.json', JSON.stringify(summary, null, 2));
