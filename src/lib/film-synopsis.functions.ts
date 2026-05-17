import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function decodeHtml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function fetchPublicine(path: string): Promise<string> {
  const url = `https://www.publicine.net${path}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (AlicanteGuide synopsis)" },
  });
  if (!res.ok) throw new Error(`publicine HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  return new TextDecoder("latin1").decode(buf);
}

function extractSynopsis(html: string): string | null {
  // En la página de ficha aparece "SINOPSIS <texto>" hasta la siguiente sección.
  const m = html.match(/SINOPSIS\s*<\/[^>]+>\s*<[^>]+>([\s\S]{20,2000}?)<\//i);
  if (m) return decodeHtml(m[1].replace(/<[^>]+>/g, " ")).trim();
  const m2 = html.match(/SINOPSIS[^<]*<[^>]+>([\s\S]{20,2000}?)<\//i);
  if (m2) return decodeHtml(m2[1].replace(/<[^>]+>/g, " ")).trim();
  // Fallback: línea plana "SINOPSIS ..." sin etiquetas.
  const stripped = html.replace(/<[^>]+>/g, " ");
  const m3 = stripped.match(/SINOPSIS\s+([^\n]{20,2000}?)\s+(?:TR[ÁA]ILER|G[ÉE]NERO|REPARTO|DIRECTOR|DURACI[ÓO]N|CLASIFICACI[ÓO]N|ESTRENO|Puedes ver|$)/i);
  if (m3) return decodeHtml(m3[1]).trim();
  return null;
}

async function findPidViaCinemas(filmSlug: string): Promise<{ pid: string; slug: string } | null> {
  const paths = [
    "/cartelera-cine/alacant-alicante/yelmo-cines-puerta-de-alicante",
    "/cartelera-cine/alacant-alicante/kinepolis-alicante-plaza-mar-2",
    "/cartelera-cine/alacant-alicante/cines-aana-alicante",
    "/cartelera-cine/sant-vicent-del-raspeig/odeon-multicines-alicante",
  ];
  for (const p of paths) {
    try {
      const html = await fetchPublicine(p);
      const re = new RegExp(`/pelicula/(\\d+)/${filmSlug}`, "i");
      const m = html.match(re);
      if (m) return { pid: m[1], slug: filmSlug };
    } catch {
      /* siguiente */
    }
  }
  return null;
}

export const getFilmSynopsis = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: film } = await supabaseAdmin
      .from("films")
      .select("id, slug, title, synopsis, external_ids")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!film) return { synopsis: null as string | null };
    if (film.synopsis) return { synopsis: film.synopsis as string };

    const ext = (film.external_ids ?? {}) as { publicine_pid?: string; publicine_slug?: string };
    let pid = ext.publicine_pid ?? null;
    let pSlug = ext.publicine_slug ?? film.slug;

    if (!pid) {
      const found = await findPidViaCinemas(pSlug);
      if (found) {
        pid = found.pid;
        pSlug = found.slug;
      }
    }
    if (!pid) return { synopsis: null };

    let html: string;
    try {
      html = await fetchPublicine(`/pelicula/${pid}/${pSlug}`);
    } catch {
      return { synopsis: null };
    }
    const synopsis = extractSynopsis(html);
    if (!synopsis) return { synopsis: null };

    await supabaseAdmin
      .from("films")
      .update({
        synopsis,
        external_ids: { ...ext, publicine_pid: pid, publicine_slug: pSlug },
      })
      .eq("id", film.id);

    return { synopsis };
  });
