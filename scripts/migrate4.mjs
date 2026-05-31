// Resuelve cover_photo de los restaurantes/places sin foto.
// Usa raw->photos[0].name si está cacheado; si no, llama Place Details (v1) para obtenerlo.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1); }

const BUCKET = 'entity-photos';
const STORAGE_PREFIX = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const stats = { ok: 0, fail: 0, details_calls: 0, photo_calls: 0 };

async function fetchDetailsPhotos(placeId) {
  stats.details_calls++;
  const url = `https://places.googleapis.com/v1/places/${placeId}?key=${KEY}`;
  try {
    const r = await fetch(url, { headers: { 'X-Goog-FieldMask': 'photos' } });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j.photos) ? j.photos : null;
  } catch { return null; }
}

async function resolvePhoto(ref, id) {
  stats.photo_calls++;
  const url = `https://places.googleapis.com/v1/${ref}/media?maxWidthPx=1200&key=${KEY}&skipHttpRedirect=true`;
  let photoUri;
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    photoUri = j.photoUri;
    if (!photoUri) return null;
  } catch { return null; }
  let buf, ct;
  try {
    const r2 = await fetch(photoUri, { redirect: 'follow' });
    if (!r2.ok) return null;
    ct = r2.headers.get('content-type') || 'image/jpeg';
    buf = Buffer.from(await r2.arrayBuffer());
    if (buf.length < 1024) return null;
  } catch { return null; }
  let ext = ct.split('/')[1].split(';')[0].replace('jpeg','jpg');
  if (!['jpg','png','webp','gif','avif'].includes(ext)) ext = 'jpg';
  const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
  const path = `gplaces/places/${id}/${hash}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: true });
  if (error) return null;
  return STORAGE_PREFIX + path;
}

const { data: rows, error } = await sb
  .from('places')
  .select('id, google_place_id, raw')
  .is('cover_photo', null);
if (error) { console.error(error); process.exit(1); }

console.log(`Procesando ${rows.length} restaurantes…`);
let i = 0;
for (const p of rows) {
  i++;
  let photos = Array.isArray(p.raw?.photos) ? p.raw.photos : null;
  if (!photos || photos.length === 0) {
    photos = await fetchDetailsPhotos(p.google_place_id);
    if (!photos || photos.length === 0) { stats.fail++; continue; }
  }
  const ref = photos[0]?.name;
  if (!ref || !ref.startsWith('places/')) { stats.fail++; continue; }
  const url = await resolvePhoto(ref, p.id);
  if (!url) { stats.fail++; continue; }
  const { error: e2 } = await sb.from('places').update({ cover_photo: url }).eq('id', p.id);
  if (e2) { stats.fail++; continue; }
  stats.ok++;
  if (i % 50 === 0) console.log(`[${i}/${rows.length}]`, stats);
}
console.log('FINAL', JSON.stringify(stats, null, 2));
