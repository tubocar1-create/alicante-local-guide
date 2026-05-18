import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LITEAPI_BASE = "https://api.liteapi.travel/v3.0";
const ALICANTE_LAT = 38.3452;
const ALICANTE_LNG = -0.481;

function liteHeaders() {
  const key = process.env.LITEAPI_KEY;
  if (!key) throw new Error("LITEAPI_KEY not configured");
  return { "X-API-Key": key, accept: "application/json", "content-type": "application/json" };
}

function normalize(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Naive name similarity via token overlap (Jaccard)
function nameScore(a: string, b: string) {
  const ta = new Set(normalize(a).split(" ").filter((w) => w.length > 2));
  const tb = new Set(normalize(b).split(" ").filter((w) => w.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => tb.has(t) && inter++);
  return inter / Math.min(ta.size, tb.size);
}

/** Fetch all LiteAPI hotels in Alicante area */
async function fetchLiteApiHotels() {
  const url = new URL(`${LITEAPI_BASE}/data/hotels`);
  url.searchParams.set("countryCode", "ES");
  url.searchParams.set("cityName", "Alicante");
  url.searchParams.set("limit", "1000");
  const res = await fetch(url, { headers: liteHeaders() });
  if (!res.ok) throw new Error(`LiteAPI hotels ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: any[] };
  return json.data ?? [];
}

/** Match Google-sourced hotels to LiteAPI hotels and persist the liteapi_id */
export async function matchHotelsToLiteApiImpl() {
  const liteHotels = await fetchLiteApiHotels();
  if (liteHotels.length === 0) return { matched: 0, candidates: 0 };

  const { data: locals } = await supabaseAdmin
    .from("hotels_static")
    .select("id, name, lat, lng, liteapi_id");

  let matched = 0;
  const updates: Array<{ id: string; liteapi_id: string }> = [];

  for (const local of locals ?? []) {
    if (local.liteapi_id) continue;
    if (local.lat == null || local.lng == null) continue;

    let best: { id: string; score: number; dist: number } | null = null;
    for (const lh of liteHotels) {
      const lat = Number(lh.latitude ?? lh.lat);
      const lng = Number(lh.longitude ?? lh.lng);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      const dist = haversineKm(local.lat, local.lng, lat, lng);
      if (dist > 0.3) continue; // 300 m radius
      const score = nameScore(local.name, lh.name || "");
      if (score < 0.5) continue;
      if (!best || score > best.score || (score === best.score && dist < best.dist)) {
        best = { id: String(lh.id), score, dist };
      }
    }
    if (best) {
      updates.push({ id: local.id, liteapi_id: best.id });
      matched++;
    }
  }

  // Apply updates one by one (unique constraint protects against collisions)
  for (const u of updates) {
    await supabaseAdmin
      .from("hotels_static")
      .update({ liteapi_id: u.liteapi_id })
      .eq("id", u.id);
  }

  return { matched, candidates: liteHotels.length, locals: locals?.length ?? 0 };
}

/** Refresh availability/pricing for all matched hotels (tomorrow → +1 night, 2 adults) */
export async function refreshDynamicHotelsImpl() {
  const { data: matchedRows } = await supabaseAdmin
    .from("hotels_static")
    .select("id, liteapi_id")
    .not("liteapi_id", "is", null);

  const rows = matchedRows ?? [];
  if (rows.length === 0) return { refreshed: 0, hit: 0 };

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const dayAfter = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const checkin = tomorrow.toISOString().slice(0, 10);
  const checkout = dayAfter.toISOString().slice(0, 10);

  const liteapiIds = rows.map((r) => r.liteapi_id!).filter(Boolean);

  // Bulk rates – chunk by 200 to stay safe
  const idToData: Record<string, any> = {};
  for (let i = 0; i < liteapiIds.length; i += 200) {
    const chunk = liteapiIds.slice(i, i + 200);
    const res = await fetch(`${LITEAPI_BASE}/hotels/rates`, {
      method: "POST",
      headers: liteHeaders(),
      body: JSON.stringify({
        hotelIds: chunk,
        checkin,
        checkout,
        currency: "EUR",
        guestNationality: "ES",
        occupancies: [{ adults: 2 }],
      }),
    });
    if (!res.ok) {
      console.error("LiteAPI rates error", res.status, (await res.text()).slice(0, 200));
      continue;
    }
    const json = (await res.json()) as { data?: any[] };
    for (const item of json.data ?? []) {
      const hid = String(item.hotelId ?? item.id ?? "");
      if (hid) idToData[hid] = item;
    }
  }

  const ratePrice = (r: any): number | null => {
    const p =
      r?.retailRate?.total?.[0]?.amount ??
      r?.retailRate?.total?.amount ??
      r?.totalPrice ??
      r?.price ??
      null;
    return p != null ? Number(p) : null;
  };
  const rateCurrency = (r: any): string =>
    r?.retailRate?.total?.[0]?.currency ??
    r?.retailRate?.total?.currency ??
    r?.currency ??
    "EUR";
  const hasBreakfast = (r: any) => {
    const board = `${r?.boardName ?? ""} ${r?.boardType ?? ""}`.toLowerCase();
    return /breakfast|desayuno/.test(board) || /^(bb|hb|fb|ai)$/i.test(r?.boardType ?? "");
  };
  const isRefundable = (r: any) => {
    const tag = r?.cancellationPolicies?.refundableTag;
    if (tag === "RFN") return true;
    const infos = r?.cancellationPolicies?.cancelPolicyInfos ?? [];
    return infos.some((i: any) => Number(i?.amount ?? 0) === 0);
  };

  const upserts = rows.map((r) => {
    const item = idToData[r.liteapi_id!];
    const allRates: any[] = [];
    for (const rt of item?.roomTypes ?? []) {
      for (const rate of rt?.rates ?? []) allRates.push(rate);
    }
    for (const rate of item?.rates ?? []) allRates.push(rate);

    let cheapest: any = null;
    let cheapestPrice = Infinity;
    let anyBreakfast = false;
    let anyRefundable = false;
    for (const rate of allRates) {
      const p = ratePrice(rate);
      if (p != null && p < cheapestPrice) {
        cheapestPrice = p;
        cheapest = rate;
      }
      if (hasBreakfast(rate)) anyBreakfast = true;
      if (isRefundable(rate)) anyRefundable = true;
    }

    return {
      hotel_id: r.id,
      available: !!cheapest,
      current_price: cheapest ? cheapestPrice : null,
      currency: cheapest ? rateCurrency(cheapest) : "EUR",
      breakfast_included: anyBreakfast,
      free_cancellation: anyRefundable,
      rooms_available: item?.roomTypes?.length ?? null,
      raw: item ?? null,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabaseAdmin
    .from("hotels_dynamic")
    .upsert(upserts, { onConflict: "hotel_id" });
  if (error) throw new Error(`Dynamic upsert failed: ${error.message}`);

  return {
    refreshed: upserts.length,
    hit: Object.keys(idToData).length,
    checkin,
    checkout,
  };
}

/** Live check for a single hotel (no cache) */
export async function liveCheckHotelImpl(hotelId: string, checkin: string, checkout: string) {
  const { data: row } = await supabaseAdmin
    .from("hotels_static")
    .select("liteapi_id, booking_url")
    .eq("id", hotelId)
    .maybeSingle();
  if (!row?.liteapi_id) return { ok: false as const, error: "No LiteAPI match", booking_url: row?.booking_url };

  const res = await fetch(`${LITEAPI_BASE}/hotels/rates`, {
    method: "POST",
    headers: liteHeaders(),
    body: JSON.stringify({
      hotelIds: [row.liteapi_id],
      checkin,
      checkout,
      currency: "EUR",
      guestNationality: "ES",
      occupancies: [{ adults: 2 }],
    }),
  });
  if (!res.ok) return { ok: false as const, error: `LiteAPI ${res.status}` };
  const json = (await res.json()) as { data?: any[] };
  const item = json.data?.[0];
  return { ok: true as const, item, booking_url: row.booking_url };
}
