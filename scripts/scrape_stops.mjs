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

mkdirSync('/mnt/documents/bus-stops-kml', { recursive: true });

function parseStops(kml) {
  const placemarks = [...kml.matchAll(/<Placemark[\s\S]*?<\/Placemark>/g)].map(m=>m[0]);
  const out = [];
  for (const pm of placemarks) {
    const coordsM = pm.match(/<Point[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordsM) continue;
    const nameM = pm.match(/<name>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/);
    // Try to find code: often in description or ExtendedData
    const descM = pm.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const [lng,lat] = coordsM[1].trim().split(',').map(Number);
    if (!Number.isFinite(lng)||!Number.isFinite(lat)) continue;
    out.push({
      name: nameM ? nameM[1].trim() : '',
      desc: descM ? descM[1].trim().slice(0,300) : '',
      lng, lat,
    });
  }
  return out;
}

async function fcScrape(url, body) {
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${FC_KEY}`,'Content-Type':'application/json' },
    body: JSON.stringify({ url, ...body }),
  });
  if (!r.ok) throw new Error(`FC ${r.status}: ${(await r.text()).slice(0,200)}`);
  return (await r.json()).data || {};
}

const allStops = {}; // key: normalized name -> {names:Set, lat, lng, codes:Set, lines:Set}
function norm(s){ return s.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]+/g,' ').trim(); }

const summary = [];

for (const [code, slug] of LINES) {
  const pageUrl = `${BASE}/linea/${slug}/`;
  console.log(`\n=== Línea ${code} ===`);
  try {
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
      formats:['markdown'], onlyMainContent:false,
      actions:[
        { type:'wait', milliseconds: 1500 },
        { type:'executeJavascript', script: js },
        { type:'wait', milliseconds: 500 },
      ],
    });
    const md = ex.markdown || '';
    const i = md.indexOf('###JSON###');
    if (i<0) { summary.push({code, ok:false, err:'no_js_output'}); continue; }
    const cleaned = md.slice(i+10).replace(/\\([\[\]_*()\\])/g,'$1');
    const payload = JSON.parse(cleaned);
    let stopsLine = [];
    for (const r of payload.results) {
      if (!r.b64) continue;
      try {
        const files = unzipSync(new Uint8Array(Buffer.from(r.b64,'base64')));
        const kmlName = Object.keys(files).find(n=>n.toLowerCase().endsWith('.kml'));
        if (!kmlName) continue;
        const kml = strFromU8(files[kmlName]);
        const sts = parseStops(kml);
        stopsLine.push(...sts);
      } catch {}
    }
    writeFileSync(`/mnt/documents/bus-stops-kml/linea-${code}.json`, JSON.stringify(stopsLine,null,2));
    for (const s of stopsLine) {
      const k = norm(s.name);
      if (!k) continue;
      if (!allStops[k]) allStops[k] = { names:new Set(), lat:s.lat, lng:s.lng, lines:new Set(), samples:[] };
      allStops[k].names.add(s.name);
      allStops[k].lines.add(code);
      if (allStops[k].samples.length < 3) allStops[k].samples.push({line:code, lat:s.lat, lng:s.lng});
    }
    console.log(`  ${stopsLine.length} stops`);
    summary.push({code, ok:true, stops: stopsLine.length});
  } catch (e) {
    console.log('  ERR', e.message.slice(0,150));
    summary.push({code, ok:false, err:e.message.slice(0,120)});
  }
}

const flat = Object.entries(allStops).map(([k,v])=>({
  norm:k, names:[...v.names], lat:v.lat, lng:v.lng, lines:[...v.lines]
}));
writeFileSync('/mnt/documents/bus-stops-kml/_all_stops.json', JSON.stringify(flat,null,2));
console.log('\n=== RESUMEN ===');
console.table(summary);
console.log('Total unique stops:', flat.length);
