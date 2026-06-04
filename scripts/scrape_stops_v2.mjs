import { writeFileSync, mkdirSync } from 'fs';

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

async function fcScrape(url) {
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${FC_KEY}`,'Content-Type':'application/json' },
    body: JSON.stringify({ url, formats:['rawHtml'], onlyMainContent:false }),
  });
  if (!r.ok) throw new Error(`FC ${r.status}: ${(await r.text()).slice(0,200)}`);
  return (await r.json()).data || {};
}

// Match objects like: "name":"2602-...","created":"...","modified":"...","code":"2602","coordinates":"LAT,LNG"
const RE = /"name":"([^"]+)","created":"[^"]*","modified":"[^"]*","code":"([^"]+)","coordinates":"([0-9.\-]+),([0-9.\-]+)"/g;

const stopMap = new Map(); // code -> {name, lat, lng, lines:Set}

for (const [code, slug] of LINES) {
  console.log(`\n=== Línea ${code} ===`);
  try {
    const ex = await fcScrape(`${BASE}/linea/${slug}/`);
    const html = ex.rawHtml || ex.html || '';
    let n=0;
    for (const m of html.matchAll(RE)) {
      const [, name, stopCode, lat, lng] = m;
      const la = Number(lat), ln = Number(lng);
      if (!Number.isFinite(la) || !Number.isFinite(ln)) continue;
      if (!stopMap.has(stopCode)) stopMap.set(stopCode, { name, lat: la, lng: ln, lines: new Set() });
      stopMap.get(stopCode).lines.add(code);
      n++;
    }
    console.log(`  ${n} stop entries`);
  } catch (e) {
    console.log('  ERR', e.message.slice(0,150));
  }
}

const flat = [...stopMap.entries()].map(([code,v])=>({ code, name:v.name, lat:v.lat, lng:v.lng, lines:[...v.lines] }));
writeFileSync('/mnt/documents/bus-stops-kml/_all_stops_v2.json', JSON.stringify(flat,null,2));
console.log('\nTotal unique stop codes:', flat.length);
