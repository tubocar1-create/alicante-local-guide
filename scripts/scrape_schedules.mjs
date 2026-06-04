// Scrape de horarios oficiales de Vectalia para 20 líneas urbanas Alicante.
// Salida: /mnt/documents/bus_schedules.json (para revisión antes de insertar).
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
  ['12','linea-12-puerta-del-mar-juan-pablo-ii'], // posible slug; si 404, probaremos alternativas
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

mkdirSync('/mnt/documents', { recursive: true });

async function fcScrape(url) {
  const r = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method:'POST',
    headers:{ Authorization:`Bearer ${FC_KEY}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ url, formats:['html'], waitFor: 4000, onlyMainContent:false }),
  });
  if (!r.ok) throw new Error(`FC ${r.status}: ${(await r.text()).slice(0,200)}`);
  const j = await r.json();
  return (j.data || j).html || '';
}

function decode(s) {
  return s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&aacute;/g,'á')
    .replace(/&eacute;/g,'é').replace(/&iacute;/g,'í').replace(/&oacute;/g,'ó')
    .replace(/&uacute;/g,'ú').replace(/&ntilde;/g,'ñ').replace(/&Aacute;/g,'Á')
    .replace(/&Eacute;/g,'É').replace(/&Iacute;/g,'Í').replace(/&Oacute;/g,'Ó')
    .replace(/&Uacute;/g,'Ú').replace(/&Ntilde;/g,'Ñ').replace(/&#?\w+;/g,' ');
}

function parseTable(tableHtml) {
  // Extract rows of cells (text only).
  const rows = [];
  const trMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/g) || [];
  for (const tr of trMatches) {
    const cells = [];
    const cellMatches = tr.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/g) || [];
    for (const c of cellMatches) {
      const inner = c.replace(/<[^>]+>/g,' ');
      cells.push(decode(inner).replace(/\s+/g,' ').trim());
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function findScheduleTables(html) {
  const tables = html.match(/<table[\s\S]*?<\/table>/g) || [];
  return tables.filter(t => /HORARIO/i.test(t) && /\d:\d\d/.test(t));
}

const TIME_RE = /^[0-2]?\d:[0-5]\d$/;

function structureSchedule(rows) {
  // Find the row that lists day types (LABORABLE, SÁBADO, FESTIVO, etc.)
  // and the row that lists terminal names. Then collect time rows.
  const DAY_TYPES = ['LABORABLE','LABORABLES','SÁBADO','SABADO','SÁBADOS','SABADOS','DOMINGO','DOMINGOS','FESTIVO','FESTIVOS','VIERNES'];
  let dayRowIdx = -1, termRowIdx = -1;
  for (let i=0;i<rows.length;i++){
    const joined = rows[i].join('|').toUpperCase();
    if (DAY_TYPES.some(d => joined.includes(d))) {
      dayRowIdx = i;
      // terminal row is the next non-empty row that has no times
      for (let j=i+1;j<rows.length;j++){
        const allTimes = rows[j].every(c => TIME_RE.test(c) || c==='');
        if (!allTimes && rows[j].length>=2) { termRowIdx = j; break; }
        if (allTimes && rows[j].some(c=>TIME_RE.test(c))) break;
      }
      break;
    }
  }
  if (dayRowIdx === -1) return null;
  // Build column → {day_type, terminal} mapping by walking the header row.
  // Day-type header cells often span multiple columns; rely on terminal row length.
  const dayCells = rows[dayRowIdx];
  const termCells = termRowIdx >= 0 ? rows[termRowIdx] : [];
  // Heuristic: terminal row length = number of data columns.
  const nCols = termCells.length || dayCells.length;
  // Map columns: each pair of terminals = 1 day type. Expand day labels.
  const dayLabels = [];
  for (const d of dayCells) {
    const up = d.toUpperCase();
    if (DAY_TYPES.some(x=>up.includes(x))) dayLabels.push(up);
  }
  // Distribute day labels across columns: assume terminals appear as alternating pairs.
  // Build columns[i] = { day, terminal }
  const colsPerDay = nCols / Math.max(dayLabels.length,1);
  const columns = [];
  for (let i=0;i<nCols;i++){
    const dayIdx = Math.floor(i / colsPerDay);
    columns.push({ day: dayLabels[dayIdx] || `COL${i}`, terminal: termCells[i] || '' });
  }
  // Collect time rows.
  const timeRows = [];
  for (let i = (termRowIdx>=0?termRowIdx+1:dayRowIdx+1); i<rows.length; i++){
    const r = rows[i];
    if (!r.length) continue;
    // Pad/truncate to nCols
    const padded = [];
    for (let k=0;k<nCols;k++) padded.push(r[k] || '');
    if (padded.some(c => TIME_RE.test(c))) timeRows.push(padded);
  }
  return { columns, timeRows };
}

const out = {};
for (const [code, slug] of LINES) {
  const url = `${BASE}/linea/${slug}/`;
  process.stderr.write(`[${code}] ${url}\n`);
  try {
    const html = await fcScrape(url);
    const tables = findScheduleTables(html);
    if (!tables.length) { out[code] = { url, error: 'no schedule table found', htmlLen: html.length }; continue; }
    // First schedule table is the canonical one (T2 dup is mobile).
    const rows = parseTable(tables[0]);
    const structured = structureSchedule(rows);
    if (!structured) { out[code] = { url, error: 'could not structure', rawRows: rows.slice(0,8) }; continue; }
    out[code] = { url, ...structured };
    process.stderr.write(`  cols=${structured.columns.length} timeRows=${structured.timeRows.length}\n`);
  } catch (e) {
    out[code] = { url, error: String(e) };
    process.stderr.write(`  ERR ${e}\n`);
  }
  await new Promise(r=>setTimeout(r,400));
}

writeFileSync('/mnt/documents/bus_schedules.json', JSON.stringify(out, null, 2));
console.log('Done. Lines:', Object.keys(out).length);
console.log('Saved to /mnt/documents/bus_schedules.json');
