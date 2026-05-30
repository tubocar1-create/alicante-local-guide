import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Saca fotos de la web oficial de fichas que NO tienen foto en BD.
// - places (restaurantes, bares, cafés, drinks, típica, etc.): rellena
//   `scraped_photos text[]`.
// - shop_businesses (tiendas con web): rellena `photos jsonb`.
// Procesa lotes pequeños por llamada para no exceder el límite del Worker.
// El panel admin llama en bucle hasta agotar candidatos.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const MAX_PHOTOS_PER_PLACE = 8;
const BATCH = 6; // por invocación
const PER_SITE_TIMEOUT_MS = 20_000;

type Source = "places" | "shops";

async function scrapeImages(url: string): Promise<string[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");

  const res = await fetch(FIRECRAWL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      onlyMainContent: false,
      timeout: PER_SITE_TIMEOUT_MS,
      formats: ["html", "links"],
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: { html?: string; metadata?: Record<string, unknown> };
  };
  const html = json.data?.html ?? "";
  const meta = json.data?.metadata ?? {};

  const found: string[] = [];

  // og:image / twitter:image desde metadata
  const metaCandidates = [
    meta["ogImage"],
    meta["og:image"],
    meta["twitter:image"],
    meta["twitterImage"],
  ];
  for (const c of metaCandidates) {
    if (typeof c === "string") found.push(c);
  }

  // <img src="..."> y srcset
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) found.push(m[1]);

  const srcsetRe = /<img[^>]+srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html)) !== null) {
    const first = m[1].split(",")[0]?.trim().split(/\s+/)[0];
    if (first) found.push(first);
  }

  // background-image: url(...)
  const bgRe = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((m = bgRe.exec(html)) !== null) found.push(m[1]);

  const base = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  })();

  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    let u = raw.trim();
    if (!u) continue;
    if (u.startsWith("//")) u = "https:" + u;
    else if (u.startsWith("/")) {
      if (!base) continue;
      u = base + u;
    } else if (!/^https?:\/\//i.test(u)) {
      continue;
    }
    // descartar pixeles, sprites, iconos
    if (/data:image|sprite|spinner|loader|pixel|placeholder|favicon|logo\.svg/i.test(u)) continue;
    if (/\.svg(\?|$)/i.test(u)) continue;
    // dedupe sin querystring
    const key = u.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_PHOTOS_PER_PLACE) break;
  }
  return out;
}

async function processPlaces(): Promise<{ done: number; remaining: number }> {
  const { data: rows, error } = await supabaseAdmin
    .from("places")
    .select("id, website")
    .not("website", "is", null)
    .neq("website", "")
    .is("photo_scrape_status", null)
    .limit(BATCH);
  if (error) throw error;

  let done = 0;
  for (const row of rows ?? []) {
    let status: "done" | "empty" | "error" = "empty";
    let photos: string[] = [];
    try {
      photos = await scrapeImages(row.website as string);
      status = photos.length > 0 ? "done" : "empty";
    } catch (e) {
      console.error("scrape places error", row.id, e);
      status = "error";
    }
    await supabaseAdmin
      .from("places")
      .update({
        scraped_photos: photos.length > 0 ? photos : null,
        photo_scrape_status: status,
        photo_scrape_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    done++;
  }

  const { count } = await supabaseAdmin
    .from("places")
    .select("id", { count: "exact", head: true })
    .not("website", "is", null)
    .neq("website", "")
    .is("photo_scrape_status", null);

  return { done, remaining: count ?? 0 };
}

async function processShops(): Promise<{ done: number; remaining: number }> {
  const { data: rows, error } = await supabaseAdmin
    .from("shop_businesses")
    .select("id, website, photos")
    .not("website", "is", null)
    .neq("website", "")
    .is("photo_scrape_status", null)
    .limit(BATCH);
  if (error) throw error;

  let done = 0;
  for (const row of rows ?? []) {
    const existing = Array.isArray(row.photos) ? (row.photos as unknown[]) : [];
    if (existing.length > 0) {
      // ya tenía fotos, marcar como hecho sin scrapear
      await supabaseAdmin
        .from("shop_businesses")
        .update({ photo_scrape_status: "done", photo_scrape_at: new Date().toISOString() })
        .eq("id", row.id);
      done++;
      continue;
    }
    let status: "done" | "empty" | "error" = "empty";
    let photos: string[] = [];
    try {
      photos = await scrapeImages(row.website as string);
      status = photos.length > 0 ? "done" : "empty";
    } catch (e) {
      console.error("scrape shops error", row.id, e);
      status = "error";
    }
    await supabaseAdmin
      .from("shop_businesses")
      .update({
        photos: photos.length > 0 ? photos : null,
        photo_scrape_status: status,
        photo_scrape_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    done++;
  }

  const { count } = await supabaseAdmin
    .from("shop_businesses")
    .select("id", { count: "exact", head: true })
    .not("website", "is", null)
    .neq("website", "")
    .is("photo_scrape_status", null);

  return { done, remaining: count ?? 0 };
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const source = (url.searchParams.get("source") || "places") as Source;
  try {
    const result =
      source === "shops" ? await processShops() : await processPlaces();
    return Response.json({ ok: true, source, ...result });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/public/hooks/scrape-web-photos")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
