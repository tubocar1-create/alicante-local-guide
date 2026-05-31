// Resuelve fotos de Google Places (refs "places/{placeId}/photos/{photoId}")
// via Places Photos API v1, sube a Storage y actualiza la BD.
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!KEY) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1); }

const BUCKET = 'entity-photos';
const STORAGE_PREFIX = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
const isStorage = u => typeof u === 'string' && u.startsWith(STORAGE_PREFIX);

const stats = { hotels_ok: 0, hotels_fail: 0, shops_ok: 0, shops_fail: 0, api_calls: 0 };

// Extrae el ref "places/.../photos/..." de cualquier shape.
function extractRef(v) {
  if (!v) return null;
  if (typeof v === 'object' && typeof v.name === 'string' && v.name.startsWith('places/')) return v.name;
  if (typeof v !== 'string') return null;
  if (v.startsWith('places/')) return v;
  const m = v.match(/places\/[^/?#]+\/photos\/[^/?#]+/);
  return m ? m[0] : null;
}

async function resolveGooglePhoto(ref, table, id) {
  stats.api_calls++;
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
  const path = `gplaces/${table}/${id}/${hash}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: true });
  if (error) return null;
  return STORAGE_PREFIX + path;
}

// --- HOTELS ---
{
  const { data: rows } = await sb.from('hotels_static')
    .select('id, main_image')
    .not('main_image', 'is', null);
  for (const h of rows || []) {
    if (isStorage(h.main_image)) continue;
    const ref = extractRef(h.main_image);
    if (!ref) { stats.hotels_fail++; continue; }
    const newU = await resolveGooglePhoto(ref, 'hotels_static', h.id);
    if (newU) {
      await sb.from('hotels_static').update({ main_image: newU }).eq('id', h.id);
      stats.hotels_ok++;
    } else stats.hotels_fail++;
  }
}

// --- SHOPS ---
{
  const { data: rows } = await sb.from('shop_businesses')
    .select('id, photos')
    .not('photos', 'is', null);
  for (const s of rows || []) {
    const arr = Array.isArray(s.photos) ? s.photos : [];
    if (arr.length === 0) continue;
    let changed = false;
    const out = [];
    for (const p of arr) {
      if (typeof p === 'string' && isStorage(p)) { out.push(p); continue; }
      const ref = extractRef(p);
      if (!ref) {
        // unknown shape: drop
        changed = true;
        stats.shops_fail++;
        continue;
      }
      const newU = await resolveGooglePhoto(ref, 'shop_businesses', s.id);
      if (newU) { out.push(newU); changed = true; stats.shops_ok++; }
      else { changed = true; stats.shops_fail++; }
    }
    if (changed) {
      await sb.from('shop_businesses').update({ photos: out }).eq('id', s.id);
    }
  }
}

console.log(JSON.stringify(stats, null, 2));
