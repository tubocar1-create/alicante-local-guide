import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAP_BEACHES, getBeachBySlug, type MapBeach } from "./playas-map-data";

const UA = "AlicanteFriend/1.0 (https://alicante-local-guide.lovable.app)";

async function fetchSummary(title: string): Promise<{ extract: string; photo: string | null }> {
  try {
    const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return { extract: "", photo: null };
    const j: any = await res.json();
    return {
      extract: (j.extract as string) ?? "",
      photo: (j.originalimage?.source as string) ?? (j.thumbnail?.source as string) ?? null,
    };
  } catch {
    return { extract: "", photo: null };
  }
}

async function fetchMediaList(title: string, limit: number): Promise<string[]> {
  try {
    const url = `https://es.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return [];
    const j: any = await res.json();
    const items = (j.items || []) as any[];
    const out: string[] = [];
    for (const it of items) {
      if (it.type !== "image") continue;
      const raw: string = it.title || "";
      const file = raw.replace(/^File:/i, "").replace(/^Archivo:/i, "");
      if (!file) continue;
      const ext = file.split(".").pop()?.toLowerCase() ?? "";
      if (!["jpg", "jpeg", "png", "webp"].includes(ext)) continue;
      if (/logo|icon|escudo|coat[-_ ]of[-_ ]arms|bandera|flag|wiki|commons/i.test(file)) continue;
      out.push(
        `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1200`,
      );
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export type MapBeachWithCover = MapBeach & { photo: string | null };

export const getMapBeaches = createServerFn({ method: "GET" }).handler(
  async (): Promise<MapBeachWithCover[]> => {
    const results = await Promise.all(
      MAP_BEACHES.map(async (b) => {
        const s = await fetchSummary(b.wikiTitle);
        let photo = s.photo;
        if (!photo) {
          const list = await fetchMediaList(b.wikiTitle, 1);
          photo = list[0] ?? null;
        }
        return { ...b, photo };
      }),
    );
    return results;
  },
);

export type BeachDetail = {
  beach: MapBeach;
  photos: string[];
  review: string;
};

async function aiBeachReview(beach: MapBeach): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallback = `${beach.name} es uno de esos rincones del litoral alicantino con personalidad propia. ${beach.description} Una buena opción para combinar baño, paseo y un rato de calma frente al Mediterráneo.`;
  if (!apiKey) return fallback;
  const prompt = `Escribe una reseña breve (90-130 palabras) en español sobre "${beach.name}", en la costa de Alicante. Contexto: ${beach.description}. Tono cercano, simpático y honesto, como si se lo recomendaras a un amigo que viene de visita. Menciona ambiente, tipo de arena o roca, a quién le encaja y un consejo práctico (acceso, mejor hora, snorkel, viento...). Sin listas, sin markdown, sin emojis. No inventes datos verificables (chiringuitos concretos, precios, distancias exactas).`;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un guía local de Alicante, cercano y honesto, especialista en playas y calas." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const j: any = await res.json();
    return (j.choices?.[0]?.message?.content as string) || fallback;
  } catch {
    return fallback;
  }
}

export const getBeachDetail = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) =>
    z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<BeachDetail | null> => {
    const beach = getBeachBySlug(data.slug);
    if (!beach) return null;
    const [summary, media, review] = await Promise.all([
      fetchSummary(beach.wikiTitle),
      fetchMediaList(beach.wikiTitle, 8),
      aiBeachReview(beach),
    ]);
    const photos: string[] = [];
    const seen = new Set<string>();
    if (summary.photo) {
      photos.push(summary.photo);
      seen.add(summary.photo);
    }
    for (const p of media) {
      if (seen.has(p)) continue;
      photos.push(p);
      seen.add(p);
      if (photos.length >= 5) break;
    }
    return { beach, photos, review };
  });

export const getCoastIntro = createServerFn({ method: "GET" }).handler(async (): Promise<{ text: string }> => {
  const apiKey = process.env.LOVABLE_API_KEY;
  const fallback =
    "La costa de Alicante es un buffet libre: castillo arriba, calas con peces curiosos, kilómetros de arena y dunas al sur. Desliza, elige y nos vemos en la orilla.";
  if (!apiKey) return { text: fallback };
  const prompt =
    "Escribe UN comentario muy breve (25-40 palabras), divertido y con chispa, en español, sobre la costa de Alicante y la variedad de sus playas. Tono cercano, como un amigo. Una o dos frases. Sin listas, sin markdown, sin emojis.";
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un guía local alicantino, cercano y simpático." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return { text: fallback };
    const j: any = await res.json();
    const text = (j.choices?.[0]?.message?.content as string) || fallback;
    return { text };
  } catch {
    return { text: fallback };
  }
});
