import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ShopTree = {
  sectors: Array<{
    id: string;
    slug: string;
    name: string;
    short_label: string | null;
    emoji: string | null;
    subsectors: Array<{
      id: string;
      slug: string;
      name: string;
      emoji: string | null;
      subsubsectors: Array<{
        id: string;
        slug: string;
        name: string;
        emoji: string | null;
        intents: Array<{
          id: string;
          label: string;
          keywords: string[];
          verbal_recommendation: string | null;
        }>;
      }>;
    }>;
  }>;
};

export const getShopTree = createServerFn({ method: "GET" }).handler(async (): Promise<ShopTree> => {
  const sb = admin();
  const [sec, sub, sss, intents] = await Promise.all([
    sb.from("shop_sectors").select("*").eq("active", true).order("sort_order"),
    sb.from("shop_subsectors").select("*").eq("active", true).order("sort_order"),
    sb.from("shop_subsubsectors").select("*").eq("active", true).order("sort_order"),
    sb
      .from("shop_intents")
      .select("id,subsubsector_id,label,keywords,verbal_recommendation,priority")
      .eq("active", true)
      .order("priority"),
  ]);
  if (sec.error) throw new Error(sec.error.message);
  const sectors = (sec.data ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    short_label: s.short_label,
    emoji: s.emoji,
    subsectors: (sub.data ?? [])
      .filter((x) => x.sector_id === s.id)
      .map((ss) => ({
        id: ss.id,
        slug: ss.slug,
        name: ss.name,
        emoji: ss.emoji,
        subsubsectors: (sss.data ?? [])
          .filter((x) => x.subsector_id === ss.id)
          .map((sx) => ({
            id: sx.id,
            slug: sx.slug,
            name: sx.name,
            emoji: sx.emoji,
            intents: (intents.data ?? [])
              .filter((i) => i.subsubsector_id === sx.id)
              .map((i) => ({
                id: i.id,
                label: i.label,
                keywords: (i.keywords ?? []) as string[],
                verbal_recommendation: i.verbal_recommendation,
              })),
          })),
      })),
  }));
  return { sectors };
});

// Classify a free-text user query into Sector/Subsector/Subsubsector/Intent.
// Uses Lovable AI for semantic classification. Logs every call into shop_intent_learning.
export const classifyShopIntent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        query: z.string().min(1).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const sb = admin();
    const normalized = normalize(data.query);

    // Load compact catalogue for the model
    const [{ data: sectors }, { data: subs }, { data: ssubs }, { data: intents }] = await Promise.all([
      sb.from("shop_sectors").select("id,slug,name").eq("active", true),
      sb.from("shop_subsectors").select("id,slug,name,sector_id").eq("active", true),
      sb.from("shop_subsubsectors").select("id,slug,name,subsector_id").eq("active", true),
      sb
        .from("shop_intents")
        .select("id,label,keywords,verbal_recommendation,subsubsector_id")
        .eq("active", true),
    ]);

    const catalog = (sectors ?? []).map((s) => ({
      sector: s.name,
      sector_id: s.id,
      subsectors: (subs ?? [])
        .filter((x) => x.sector_id === s.id)
        .map((ss) => ({
          subsector: ss.name,
          subsector_id: ss.id,
          subsubsectors: (ssubs ?? [])
            .filter((x) => x.subsector_id === ss.id)
            .map((sx) => ({
              subsubsector: sx.name,
              subsubsector_id: sx.id,
              intents: (intents ?? [])
                .filter((i) => i.subsubsector_id === sx.id)
                .map((i) => ({
                  intent_id: i.id,
                  label: i.label,
                  keywords: (i.keywords ?? []) as string[],
                })),
            })),
        })),
    }));

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `Eres un clasificador de intenciones de comercio urbano en Alicante.
Recibes una frase del usuario y debes clasificarla en la mejor rama del catálogo.
Devuelves SIEMPRE la mejor coincidencia, aunque la confianza sea baja.
Si no encaja con ninguna intención existente, devuelve la subsubsector más cercana e intent_id null.
Sugieres 2-4 keywords nuevas si la consulta aporta vocabulario nuevo.
También devuelves una recomendación verbal corta (1-2 frases), natural, urbana, sin listar tiendas concretas, sólo orientación de zona/contexto en Alicante.
Si la consulta es ambigua, propón una pregunta breve para afinar.`;

    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Consulta: "${data.query}"\n\nCATALOGO:\n${JSON.stringify(catalog)}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "classify",
            description: "Clasificación de la consulta",
            parameters: {
              type: "object",
              properties: {
                sector_id: { type: "string" },
                subsector_id: { type: "string" },
                subsubsector_id: { type: "string" },
                intent_id: { type: ["string", "null"] },
                confidence: { type: "number", description: "0..1" },
                suggested_keywords: { type: "array", items: { type: "string" } },
                verbal_response: { type: "string" },
                clarifying_question: { type: ["string", "null"] },
              },
              required: [
                "sector_id",
                "subsector_id",
                "subsubsector_id",
                "confidence",
                "verbal_response",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "classify" } },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI gateway ${res.status}: ${txt}`);
    }
    const j = await res.json();
    const call = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!call) throw new Error("No classification returned");
    const parsed = JSON.parse(call) as {
      sector_id: string;
      subsector_id: string;
      subsubsector_id: string;
      intent_id: string | null;
      confidence: number;
      suggested_keywords?: string[];
      verbal_response: string;
      clarifying_question?: string | null;
    };

    // Persist learning row
    const needsReview = !parsed.intent_id || parsed.confidence < 0.55;
    await sb.from("shop_intent_learning").insert({
      user_query: data.query,
      normalized_query: normalized,
      matched_sector_id: parsed.sector_id || null,
      matched_subsector_id: parsed.subsector_id || null,
      matched_subsubsector_id: parsed.subsubsector_id || null,
      matched_intent_id: parsed.intent_id || null,
      confidence: parsed.confidence,
      ai_suggested_keywords: parsed.suggested_keywords ?? [],
      ai_response: parsed.verbal_response,
      needs_review: needsReview,
    });

    // Bump hits on matched intent
    if (parsed.intent_id) {
      const { data: cur } = await sb
        .from("shop_intents")
        .select("hits")
        .eq("id", parsed.intent_id)
        .single();
      await sb
        .from("shop_intents")
        .update({ hits: (cur?.hits ?? 0) + 1 })
        .eq("id", parsed.intent_id);
    }

    // Enrich response with names for client navigation
    const sec = sectors?.find((x) => x.id === parsed.sector_id);
    const sub = subs?.find((x) => x.id === parsed.subsector_id);
    const sss = ssubs?.find((x) => x.id === parsed.subsubsector_id);
    const intent = intents?.find((x) => x.id === parsed.intent_id);

    return {
      sector: sec ? { id: sec.id, slug: sec.slug, name: sec.name } : null,
      subsector: sub ? { id: sub.id, slug: sub.slug, name: sub.name } : null,
      subsubsector: sss ? { id: sss.id, slug: sss.slug, name: sss.name } : null,
      intent: intent
        ? { id: intent.id, label: intent.label, verbal: intent.verbal_recommendation }
        : null,
      confidence: parsed.confidence,
      verbal_response: parsed.verbal_response,
      clarifying_question: parsed.clarifying_question ?? null,
      suggested_keywords: parsed.suggested_keywords ?? [],
      needs_review: needsReview,
    };
  });

// --------- Businesses (tienda detail + listings) ---------

export type ShopBusinessSummary = {
  id: string;
  name: string;
  address: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  price_level: number | null;
  zone: { id: string; name: string; slug: string } | null;
  photo_ref: string | null;
  google_types: string[];
  open_now: boolean | null;
};

export type ShopBusinessDetail = ShopBusinessSummary & {
  phone: string | null;
  website: string | null;
  google_place_id: string | null;
  lat: number | null;
  lng: number | null;
  weekday_descriptions: string[];
  hours_assumed: boolean;
  subsector: { name: string; emoji: string | null } | null;
  photos_refs: string[];
  logo_url: string | null;
};

// Map subsubsector slug → google place types we consider relevant.
const TYPE_MAP: Record<string, string[]> = {
  calzado: ["shoe_store"],
  ropa: ["clothing_store", "womens_clothing_store", "mens_clothing_store"],
  "ropa-mujer": ["womens_clothing_store", "clothing_store"],
  "ropa-hombre": ["mens_clothing_store", "clothing_store"],
  lenceria: ["lingerie_store", "clothing_store"],
  cosmetica: ["beauty_supply_store", "cosmetics_store"],
  perfumeria: ["beauty_supply_store", "cosmetics_store"],
  telefonia: ["cell_phone_store", "electronics_store"],
  electronica: ["electronics_store"],
  supermercado: ["supermarket", "grocery_or_supermarket"],
  alimentacion: ["supermarket", "grocery_or_supermarket", "market"],
  regalos: ["gift_shop"],
  deporte: ["sporting_goods_store"],
};

function pickPhotoRef(photos: unknown): string | null {
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const first = photos[0] as { name?: string } | string;
  if (typeof first === "string") return first;
  return first?.name ?? null;
}

export const listShopBusinesses = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        subsubsector_slug: z.string().optional(),
        zone_slug: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(40),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = admin();

    let subsubsectorId: string | null = null;
    if (data.subsubsector_slug) {
      const { data: sx } = await sb
        .from("shop_subsubsectors")
        .select("id")
        .eq("slug", data.subsubsector_slug)
        .maybeSingle();
      subsubsectorId = sx?.id ?? null;
    }

    let q = sb
      .from("shop_businesses")
      .select(
        "id,name,address,rating,user_ratings_total,price_level,google_types,opening_hours,photos,zone_id,subsubsector_id,shop_zones(id,name,slug)",
      )
      .neq("status", "duplicate")
      .order("rating", { ascending: false, nullsFirst: false })
      .limit(data.limit);

    if (data.zone_slug) {
      const { data: z } = await sb.from("shop_zones").select("id").eq("slug", data.zone_slug).maybeSingle();
      if (z?.id) q = q.eq("zone_id", z.id);
    }

    const wantedTypes = data.subsubsector_slug ? TYPE_MAP[data.subsubsector_slug] : undefined;
    if (subsubsectorId && wantedTypes && wantedTypes.length) {
      q = q.or(
        `subsubsector_id.eq.${subsubsectorId},google_types.ov.{${wantedTypes.join(",")}}`,
      );
    } else if (subsubsectorId) {
      q = q.eq("subsubsector_id", subsubsectorId);
    } else if (wantedTypes && wantedTypes.length) {
      q = q.overlaps("google_types", wantedTypes);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    return (rows ?? []).map<ShopBusinessSummary>((r: any) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      rating: r.rating,
      user_ratings_total: r.user_ratings_total,
      price_level: r.price_level,
      zone: r.shop_zones
        ? { id: r.shop_zones.id, name: r.shop_zones.name, slug: r.shop_zones.slug }
        : null,
      photo_ref: pickPhotoRef(r.photos),
      google_types: (r.google_types ?? []) as string[],
      open_now: r.opening_hours?.openNow ?? null,
    }));
  });

export const getShopBusiness = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<ShopBusinessDetail | null> => {
    const sb = admin();
    const { data: r, error } = await sb
      .from("shop_businesses")
      .select(
        "id,name,address,phone,website,logo_url,google_place_id,lat,lng,rating,user_ratings_total,price_level,google_types,opening_hours,photos,zone_id,shop_zones(id,name,slug),shop_subsubsectors(name,emoji,shop_subsectors(name,emoji))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return null;
    const photos = Array.isArray(r.photos) ? r.photos : [];
    const photo_refs = photos
      .map((p: any) => (typeof p === "string" ? p : p?.name))
      .filter(Boolean) as string[];
    const oh: any = r.opening_hours ?? {};
    const sss: any = (r as any).shop_subsubsectors;
    const sec: any = sss?.shop_subsectors;
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      website: r.website,
      logo_url: (r as any).logo_url ?? null,
      google_place_id: r.google_place_id,
      lat: r.lat,
      lng: r.lng,
      rating: r.rating,
      user_ratings_total: r.user_ratings_total,
      price_level: r.price_level,
      google_types: (r.google_types ?? []) as string[],
      open_now: oh.openNow ?? null,
      weekday_descriptions: Array.isArray(oh.weekdayDescriptions) ? oh.weekdayDescriptions : [],
      hours_assumed: oh.assumed === true,
      subsector: sec ? { name: sec.name, emoji: sec.emoji ?? sss?.emoji ?? null } : sss ? { name: sss.name, emoji: sss.emoji ?? null } : null,
      photo_ref: photo_refs[0] ?? null,
      photos_refs: photo_refs,
      zone: (r as any).shop_zones
        ? {
            id: (r as any).shop_zones.id,
            name: (r as any).shop_zones.name,
            slug: (r as any).shop_zones.slug,
          }
        : null,
    };
  });

// Fetch a single subsector page (with its subsubsectors) by slug.
export const getSubsectorPage = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const sb = admin();
    const { data: ss, error } = await sb
      .from("shop_subsectors")
      .select("id,slug,name,emoji,sector_id,shop_sectors(slug,name,emoji,short_label)")
      .eq("slug", data.slug)
      .eq("active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ss) return null;
    const { data: sxs } = await sb
      .from("shop_subsubsectors")
      .select("id,slug,name,emoji")
      .eq("subsector_id", ss.id)
      .eq("active", true)
      .order("sort_order");
    const ids = (sxs ?? []).map((x) => x.id);
    const counts: Record<string, number> = {};
    if (ids.length) {
      const { data: biz } = await sb
        .from("shop_businesses")
        .select("subsubsector_id")
        .in("subsubsector_id", ids)
        .neq("status", "duplicate");
      for (const r of biz ?? []) {
        const k = (r as { subsubsector_id: string | null }).subsubsector_id;
        if (k) counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return {
      id: ss.id,
      slug: ss.slug,
      name: ss.name,
      emoji: ss.emoji,
      sector: (ss as any).shop_sectors ?? null,
      subsubsectors: (sxs ?? []).map((x) => ({ ...x, business_count: counts[x.id] ?? 0 })),
    };

  });

// Fetch a single subsubsector page (with its intents + parents) by slugs.
export const getSubsubsectorPage = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ subsector_slug: z.string(), slug: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const sb = admin();
    const { data: parent } = await sb
      .from("shop_subsectors")
      .select("id,slug,name,emoji,shop_sectors(slug,name,emoji,short_label)")
      .eq("slug", data.subsector_slug)
      .maybeSingle();
    if (!parent) return null;
    const { data: sx, error } = await sb
      .from("shop_subsubsectors")
      .select("id,slug,name,emoji")
      .eq("slug", data.slug)
      .eq("subsector_id", parent.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sx) return null;
    const { data: intents } = await sb
      .from("shop_intents")
      .select("id,label,keywords,verbal_recommendation,priority")
      .eq("subsubsector_id", sx.id)
      .eq("active", true)
      .order("priority");
    return {
      id: sx.id,
      slug: sx.slug,
      name: sx.name,
      emoji: sx.emoji,
      subsector: { id: parent.id, slug: parent.slug, name: parent.name, emoji: parent.emoji },
      sector: (parent as any).shop_sectors ?? null,
      intents: (intents ?? []).map((i: any) => ({
        id: i.id,
        label: i.label,
        keywords: (i.keywords ?? []) as string[],
        verbal_recommendation: i.verbal_recommendation,
      })),
    };
  });

// --------- Sector dashboard listing ---------
export type SectorDashboardItem = {
  id: string;
  name: string;
  address: string | null;
  photo_ref: string | null;
  subsector_name: string;
  subsubsector_name: string;
  subsubsector_emoji: string | null;
  opening_hours: {
    periods?: Array<{
      open?: { day?: number; hour?: number; minute?: number };
      close?: { day?: number; hour?: number; minute?: number };
    }>;
    weekdayDescriptions?: string[];
    openNow?: boolean;
  } | null;
  lat: number | null;
  lng: number | null;
};

export type SectorDashboardData = {
  sector: { id: string; slug: string; name: string; short_label: string | null; emoji: string | null };
  items: SectorDashboardItem[];
};

export const getSectorDashboard = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ sector_slug: z.string() }).parse(input))
  .handler(async ({ data }): Promise<SectorDashboardData | null> => {
    const sb = admin();
    const { data: sec } = await sb
      .from("shop_sectors")
      .select("id,slug,name,short_label,emoji")
      .eq("slug", data.sector_slug)
      .eq("active", true)
      .maybeSingle();

    let subs: { id: string; name: string }[] = [];
    let header: { id: string; slug: string; name: string; short_label: string | null; emoji: string | null } | null = null;

    if (sec) {
      header = sec as any;
      const { data: ss } = await sb
        .from("shop_subsectors")
        .select("id,name")
        .eq("sector_id", sec.id);
      subs = ss ?? [];
    } else {
      const { data: sub } = await sb
        .from("shop_subsectors")
        .select("id,slug,name,emoji")
        .eq("slug", data.sector_slug)
        .maybeSingle();
      if (!sub) return null;
      header = { id: sub.id, slug: sub.slug, name: sub.name, short_label: sub.name, emoji: sub.emoji ?? null };
      subs = [{ id: sub.id, name: sub.name }];
    }

    const subIds = subs.map((s) => s.id);
    if (subIds.length === 0) return { sector: header as any, items: [] };
    const { data: sss } = await sb
      .from("shop_subsubsectors")
      .select("id,name,emoji,subsector_id")
      .in("subsector_id", subIds);
    const sssIds = (sss ?? []).map((x) => x.id);
    if (sssIds.length === 0) return { sector: header as any, items: [] };
    const { data: biz } = await sb
      .from("shop_businesses")
      .select("id,name,address,opening_hours,photos,lat,lng,subsubsector_id")
      .in("subsubsector_id", sssIds)
      .neq("status", "duplicate")
      .limit(1000);
    const subMap = new Map(subs.map((s) => [s.id, s.name]));
    const sssMap = new Map((sss ?? []).map((x) => [x.id, x]));
    const items: SectorDashboardItem[] = (biz ?? []).map((b: any) => {
      const sx = sssMap.get(b.subsubsector_id);
      return {
        id: b.id,
        name: b.name,
        address: b.address,
        photo_ref: pickPhotoRef(b.photos),
        subsubsector_name: sx?.name ?? "",
        subsubsector_emoji: sx?.emoji ?? null,
        subsector_name: sx ? (subMap.get(sx.subsector_id) ?? "") : "",
        opening_hours: b.opening_hours,
        lat: b.lat,
        lng: b.lng,
      };
    });
    return { sector: header as any, items };
  });

// Random shop businesses with photos for the Comprar carousel.
export type RandomShop = {
  id: string;
  name: string;
  photo_ref: string;
  subsector_name: string | null;
  subsector_emoji: string | null;
};

export const getRandomShopsWithPhotos = createServerFn({ method: "GET" })
  .inputValidator((data: { subsectorSlug?: string } | undefined) =>
    z.object({ subsectorSlug: z.string().min(1).max(120).optional() }).parse(data ?? {}),
  )
  .handler(async ({ data }): Promise<RandomShop[]> => {
    const sb = admin();
    let subsubsectorIds: string[] | null = null;
    if (data.subsectorSlug) {
      const { data: ss } = await sb
        .from("shop_subsectors")
        .select("id")
        .eq("slug", data.subsectorSlug)
        .maybeSingle();
      if (!ss) return [];
      const { data: sxs } = await sb
        .from("shop_subsubsectors")
        .select("id")
        .eq("subsector_id", ss.id);
      subsubsectorIds = (sxs ?? []).map((x: any) => x.id);
      if (subsubsectorIds.length === 0) return [];
    }
    let q = sb
      .from("shop_businesses")
      .select("id,name,photos,shop_subsubsectors(name,emoji,shop_subsectors(name,emoji))")
      .neq("status", "duplicate")
      .not("photos", "is", null)
      .limit(400);
    if (subsubsectorIds) q = q.in("subsubsector_id", subsubsectorIds);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const withPhoto = (rows ?? [])
      .map((r: any) => {
        const ref = pickPhotoRef(r.photos);
        if (!ref) return null;
        const sss: any = r.shop_subsubsectors;
        const sec: any = sss?.shop_subsectors;
        return {
          id: r.id,
          name: r.name as string,
          photo_ref: ref,
          subsector_name: (sec?.name ?? sss?.name ?? null) as string | null,
          subsector_emoji: (sec?.emoji ?? sss?.emoji ?? null) as string | null,
        };
      })
      .filter(Boolean) as RandomShop[];
    for (let i = withPhoto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [withPhoto[i], withPhoto[j]] = [withPhoto[j], withPhoto[i]];
    }
    return withPhoto.slice(0, 20);

  },
);
