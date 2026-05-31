import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// DRY RUN: scrapea fotos de la web oficial de restaurantes (places)
// SIN escribir en la base de datos. Devuelve cuántas fichas tienen
// al menos una foto, cuántas vacías, cuántos errores y el total
// de fotos encontradas. Pensado para que el agente le diga al usuario
// "esto es lo que conseguiría" antes de pegar nada.

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";
const MAX_PHOTOS_PER_PLACE = 8;
const PER_SITE_TIMEOUT_MS = 20_000;

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
      formats: ["html"],
    }),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data?: { html?: string; metadata?: Record<string, unknown> };
  };
  const html = json.data?.html ?? "";
  const meta = json.data?.metadata ?? {};
  const found: string[] = [];
  for (const c of [meta["ogImage"], meta["og:image"], meta["twitter:image"], meta["twitterImage"]]) {
    if (typeof c === "string") found.push(c);
  }
  const imgRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) found.push(m[1]);
  const srcsetRe = /<img[^>]+srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(html)) !== null) {
    const first = m[1].split(",")[0]?.trim().split(/\s+/)[0];
    if (first) found.push(first);
  }
  const bgRe = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((m = bgRe.exec(html)) !== null) found.push(m[1]);

  const base = (() => {
    try { return new URL(url).origin; } catch { return null; }
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
    } else if (!/^https?:\/\//i.test(u)) continue;
    if (/data:image|sprite|spinner|loader|pixel|placeholder|favicon|logo\.svg/i.test(u)) continue;
    if (/\.svg(\?|$)/i.test(u)) continue;
    const key = u.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(u);
    if (out.length >= MAX_PHOTOS_PER_PLACE) break;
  }
  return out;
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "20")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

  const { data: rows, error, count } = await supabaseAdmin
    .from("places")
    .select("id, name, website", { count: "exact" })
    .not("website", "is", null)
    .neq("website", "")
    .is("photo_scrape_status", null)
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

  let withPhotos = 0;
  let empty = 0;
  let errors = 0;
  let totalPhotos = 0;
  const samples: Array<{ name: string; count: number }> = [];

  for (const row of rows ?? []) {
    try {
      const photos = await scrapeImages(row.website as string);
      totalPhotos += photos.length;
      if (photos.length > 0) {
        withPhotos++;
        if (samples.length < 5) samples.push({ name: row.name as string, count: photos.length });
      } else empty++;
    } catch {
      errors++;
    }
  }

  return Response.json({
    ok: true,
    processed: rows?.length ?? 0,
    offset,
    limit,
    totalCandidates: count ?? 0,
    withPhotos,
    empty,
    errors,
    totalPhotos,
    samples,
  });
}

export const Route = createFileRoute("/api/public/hooks/scrape-web-photos-dry")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      GET: async ({ request }) => handle(request),
    },
  },
});
