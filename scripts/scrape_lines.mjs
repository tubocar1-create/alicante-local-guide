import { writeFileSync, mkdirSync } from 'fs';
import { unzipSync, strFromU8 } from 'fflate';

const FC_KEY = process.env.FIRECRAWL_API_KEY;
const BASE = 'https://alicante.vectalia.es';

async function fcScrape(url, body) {
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${FC_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, ...body }),
  });
  if (!r.ok) throw new Error(`FC ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.data || j;
}

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
function lengthM(coords){ let t=0; for(let i=1;i<coords.length;i++) t+=haversine(coords[i-1],coords[i]); return t; }

const summary = [];

for (const [code, slug] of LINES) {
  const url = `${BASE}/linea/${slug}/`;
  try {
    console.log(`\n=== Línea ${code} ===`);
    const scraped = await fcScrape(url, { formats: ['html'], onlyMainContent: false });
    const html = scraped.html || '';
    const m = html.match(/line-kml[^"']*[?&]id=(\d+)/);
    if (!m) { console.log('  NO id KML'); summary.push({code, ok:false, err:'no_id'}); continue; }
    const lineId = m[1];
    const kmzUrl = `${BASE}/wp-content/plugins/vectalia/inc/line-kml.kmz.php?id=${lineId}`;
    console.log(`  id=${lineId}`);

    // Try direct fetch
    let kmzBuf = null;
    try {
      const r = await fetch(kmzUrl, { headers: {'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'} });
      if (r.ok) {
        const ab = await r.arrayBuffer();
        if (ab.byteLength > 500) kmzBuf = Buffer.from(ab);
      }
    } catch {}

    // Fallback: Firecrawl executeJavascript
    if (!kmzBuf) {
      const js = `const r=await fetch(${JSON.stringify(kmzUrl)});const ab=await r.arrayBuffer();const u=new Uint8Array(ab);let s='';for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);document.body.innerText=btoa(s);`;
      const ex = await fcScrape(BASE, {
        formats: ['markdown'],
        actions: [{ type:'executeJavascript', script: js }, { type:'wait', milliseconds: 800 }],
      });
      const md = (ex.markdown || '').replace(/\s/g,'');
      if (md.length > 100) {
        try { kmzBuf = Buffer.from(md, 'base64'); } catch {}
      }
    }

    if (!kmzBuf || kmzBuf.length < 500) { console.log('  KMZ vacío'); summary.push({code, ok:false, err:'empty_kmz'}); continue; }

    const files = unzipSync(new Uint8Array(kmzBuf));
    const kmlName = Object.keys(files).find(n => n.toLowerCase().endsWith('.kml'));
    if (!kmlName) { console.log('  sin KML'); summary.push({code, ok:false, err:'no_kml'}); continue; }
    const kml = strFromU8(files[kmlName]);
    const shapes = parseKml(kml);
    if (shapes.length === 0) { console.log('  sin LineString'); summary.push({code, ok:false, err:'no_linestring'}); continue; }

    const geojson = {
      type: 'FeatureCollection',
      meta: { lineCode: code, lineId, source: 'vectalia_kmz', fetched_at: new Date().toISOString() },
      features: shapes.map((s,i) => ({
        type:'Feature',
        properties:{ name: s.name, direction: i===0?'IDA':'VUELTA', length_m: Math.round(lengthM(s.coords)), point_count: s.coords.length },
        geometry:{ type:'LineString', coordinates: s.coords },
      })),
    };
    const path = `/mnt/documents/bus-shapes/linea-${code}.geojson`;
    writeFileSync(path, JSON.stringify(geojson));
    const lens = geojson.features.map(f => (f.properties.length_m/1000).toFixed(2)+'km');
    console.log(`  OK ${shapes.length} shapes (${lens.join(' / ')})`);
    summary.push({code, ok:true, shapes: shapes.length, lengths: lens.join(' / ')});
  } catch (e) {
    console.log('  ERROR:', e.message.slice(0,200));
    summary.push({code, ok:false, err: e.message.slice(0,100)});
  }
}

console.log('\n=== RESUMEN ===');
console.table(summary);
writeFileSync('/mnt/documents/bus-shapes/_summary.json', JSON.stringify(summary, null, 2));
