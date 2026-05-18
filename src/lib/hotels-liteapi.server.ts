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

const ROOM_ORDER = ["single", "double", "triple", "quadruple", "suite", "other"] as const;
type RoomCat = (typeof ROOM_ORDER)[number];

function classifyRoom(name: string): RoomCat {
  const s = normalize(name);
  if (/\bsuite|junior\b/.test(s)) return "suite";
  if (/\btriple|tres |3 pax\b/.test(s)) return "triple";
  if (/\bquad|cuadrupl|family|familiar|4 pax\b/.test(s)) return "quadruple";
  if (/\bdoubl|doble|twin|matrim/.test(s)) return "double";
  if (/\bsingl|individual|sencill|1 pax\b/.test(s)) return "single";
  return "other";
}

const ROOM_LABELS: Record<RoomCat, string> = {
  single: "Sencilla",
  double: "Doble",
  triple: "Triple",
  quadruple: "Cuádruple",
  suite: "Suite",
  other: "Otra",
};
export { ROOM_LABELS };

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
    return /breakfast|desayuno/.test(board) || /^(bb|bi|hb|fb|ai)$/i.test(r?.boardType ?? "");
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
      for (const rate of rt?.rates ?? []) allRates.push({ rate, roomName: rt?.name ?? rate?.name });
    }
    for (const rate of item?.rates ?? []) allRates.push({ rate, roomName: rate?.name });

    let cheapest: any = null;
    let cheapestPrice = Infinity;
    let anyBreakfast = false;
    let anyRefundable = false;
    const byType: Record<string, { price: number; currency: string; label: string }> = {};
    for (const { rate, roomName } of allRates) {
      const p = ratePrice(rate);
      if (p != null && p < cheapestPrice) {
        cheapestPrice = p;
        cheapest = rate;
      }
      if (hasBreakfast(rate)) anyBreakfast = true;
      if (isRefundable(rate)) anyRefundable = true;
      const cat = classifyRoom(roomName ?? "");
      if (p != null) {
        const cur = rateCurrency(rate);
        if (!byType[cat] || p < byType[cat].price) {
          byType[cat] = { price: p, currency: cur, label: roomName ?? cat };
        }
      }
    }
    const room_types = ROOM_ORDER.flatMap((k) =>
      byType[k] ? [{ type: k, price: byType[k].price, currency: byType[k].currency, label: byType[k].label }] : [],
    );

    return {
      hotel_id: r.id,
      available: !!cheapest,
      current_price: cheapest ? cheapestPrice : null,
      currency: cheapest ? rateCurrency(cheapest) : "EUR",
      breakfast_included: anyBreakfast,
      free_cancellation: anyRefundable,
      rooms_available: item?.roomTypes?.length ?? null,
      room_types,
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

/** Fetch (or refresh from cache) a month of nightly availability for a hotel.
 *  Returns 30 nights starting at `startDate` (YYYY-MM-DD). Uses 24h cache. */
export async function fetchHotelCalendarImpl(hotelId: string, startDate: string) {
  const { data: row } = await supabaseAdmin
    .from("hotels_static")
    .select("liteapi_id")
    .eq("id", hotelId)
    .maybeSingle();

  const start = new Date(startDate + "T00:00:00Z");
  const days: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    days.push(d.toISOString().slice(0, 10));
  }
  const endDate = days[days.length - 1];

  // Read existing cache rows
  const { data: cached } = await supabaseAdmin
    .from("hotels_calendar")
    .select("date, available, price_double, price_min, currency, updated_at")
    .eq("hotel_id", hotelId)
    .gte("date", startDate)
    .lte("date", endDate);

  const cacheMap: Record<string, any> = {};
  for (const c of cached ?? []) cacheMap[c.date as string] = c;

  const STALE_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const missing = days.filter((d) => {
    const c = cacheMap[d];
    if (!c) return true;
    return now - new Date(c.updated_at).getTime() > STALE_MS;
  });

  if (row?.liteapi_id && missing.length > 0) {
    // Fetch in parallel but cap concurrency
    const CONCURRENCY = 6;
    const upserts: any[] = [];
    let idx = 0;
    async function worker() {
      while (idx < missing.length) {
        const day = missing[idx++];
        const checkout = new Date(new Date(day + "T00:00:00Z").getTime() + 86400000)
          .toISOString()
          .slice(0, 10);
        try {
          const res = await fetch(`${LITEAPI_BASE}/hotels/rates`, {
            method: "POST",
            headers: liteHeaders(),
            body: JSON.stringify({
              hotelIds: [row!.liteapi_id],
              checkin: day,
              checkout,
              currency: "EUR",
              guestNationality: "ES",
              occupancies: [{ adults: 2 }],
            }),
          });
          if (!res.ok) {
            upserts.push({ hotel_id: hotelId, date: day, available: false, updated_at: new Date().toISOString() });
            continue;
          }
          const json = (await res.json()) as { data?: any[] };
          const item = json.data?.[0];
          let minPrice = Infinity;
          let doublePrice: number | null = null;
          let currency = "EUR";
          for (const rt of item?.roomTypes ?? []) {
            const cat = classifyRoom(rt?.name ?? "");
            for (const rate of rt?.rates ?? []) {
              const p =
                rate?.retailRate?.total?.[0]?.amount ??
                rate?.retailRate?.total?.amount ??
                rate?.totalPrice ??
                rate?.price ??
                null;
              if (p == null) continue;
              const np = Number(p);
              currency =
                rate?.retailRate?.total?.[0]?.currency ??
                rate?.retailRate?.total?.currency ??
                rate?.currency ??
                "EUR";
              if (np < minPrice) minPrice = np;
              if (cat === "double" && (doublePrice == null || np < doublePrice)) {
                doublePrice = np;
              }
            }
          }
          const available = isFinite(minPrice);
          upserts.push({
            hotel_id: hotelId,
            date: day,
            available,
            price_double: doublePrice,
            price_min: available ? minPrice : null,
            currency,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          upserts.push({ hotel_id: hotelId, date: day, available: false, updated_at: new Date().toISOString() });
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    if (upserts.length > 0) {
      await supabaseAdmin.from("hotels_calendar").upsert(upserts, { onConflict: "hotel_id,date" });
      for (const u of upserts) cacheMap[u.date] = u;
    }
  }

  return {
    hotel_id: hotelId,
    days: days.map((d) => {
      const c = cacheMap[d];
      return {
        date: d,
        available: !!c?.available,
        price_double: c?.price_double ?? null,
        price_min: c?.price_min ?? null,
        currency: c?.currency ?? "EUR",
      };
    }),
  };
}
