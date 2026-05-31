import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'entity-photos';
const STORAGE_PREFIX = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function fetchBytes(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'image/*,*/*;q=0.8', 'Referer': 'https://www.google.com/' },
      redirect: 'follow',
    });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 1024) return null;
    let ext = ct.split('/')[1].split(';')[0].replace('jpeg','jpg');
    if (!['jpg','png','webp','gif','avif'].includes(ext)) ext = 'jpg';
    return { buf, ext, ct };
  } catch { return null; }
}

async function uploadAndGetUrl(table, id, url) {
  const got = await fetchBytes(url);
  if (!got) return null;
  const hash = crypto.createHash('sha1').update(got.buf).digest('hex').slice(0, 16);
  const path = `migrated/${table}/${id}/${hash}.${got.ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, got.buf, { contentType: got.ct, upsert: true });
  if (error) return null;
  return STORAGE_PREFIX + path;
}

const isStorage = u => typeof u === 'string' && u.startsWith(STORAGE_PREFIX);
const stats = { hotels_ok: 0, hotels_fail: 0, shops_ok: 0, shops_fail: 0 };

// --- HOTELS: main_image ---
{
  const { data: rows } = await sb.from('hotels_static')
    .select('id, name, main_image, scraped_photos')
    .not('main_image', 'is', null);
  for (const h of rows || []) {
    if (isStorage(h.main_image)) continue;
    // Prefer first storage URL from scraped_photos
    let target = (h.scraped_photos || []).find(isStorage);
    if (!target) {
      target = await uploadAndGetUrl('hotels_static', h.id, h.main_image);
    }
    if (target) {
      await sb.from('hotels_static').update({ main_image: target }).eq('id', h.id);
      stats.hotels_ok++;
    } else {
      stats.hotels_fail++;
    }
  }
}

// --- SHOPS: photos jsonb array ---
{
  const { data: rows } = await sb.from('shop_businesses')
    .select('id, name, photos')
    .not('photos', 'is', null);
  for (const s of rows || []) {
    const arr = Array.isArray(s.photos) ? s.photos : [];
    if (arr.length === 0) continue;
    let changed = false;
    const out = [];
    for (const u of arr) {
      if (typeof u !== 'string') { out.push(u); continue; }
      if (isStorage(u)) { out.push(u); continue; }
      const newU = await uploadAndGetUrl('shop_businesses', s.id, u);
      if (newU) { out.push(newU); changed = true; stats.shops_ok++; }
      else { stats.shops_fail++; /* drop the dead url */ changed = true; }
    }
    if (changed) {
      await sb.from('shop_businesses').update({ photos: out }).eq('id', s.id);
    }
  }
}

console.log(JSON.stringify(stats, null, 2));
