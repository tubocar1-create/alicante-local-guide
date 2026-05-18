import { createServerFn } from "@tanstack/react-start";
import { PLAYAS, type PlayaSeed } from "./playas-data";

export type PlayaInfo = {
  slug: string;
  name: string;
  town: string;
  category: "populares" | "escondidas";
  extract: string;
  photo: string | null;
  wikiUrl: string;
  lat?: number;
  lng?: number;
};

export type PlayasGuide = {
  intro: string;
  comoIr: string;
  queLlevar: string;
  queHacer: string;
  consejos: string;
};

async function fetchWiki(title: string) {
  try {
    const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const res = await fetch(url, { headers: { "User-Agent": "AlicanteFriend/1.0 (contact: hello@lovable.dev)" } });
    if (!res.ok) return null;
    const j = await res.json();
    return {
      extract: (j.extract as string) ?? "",
      photo: (j.originalimage?.source as string) ?? (j.thumbnail?.source as string) ?? null,
      wikiUrl: (j.content_urls?.desktop?.page as string) ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    };
  } catch {
    return null;
  }
}

async function buildPlayas(): Promise<PlayaInfo[]> {
  const results = await Promise.all(
    PLAYAS.map(async (p: PlayaSeed) => {
      const w = await fetchWiki(p.wikiTitle);
      return {
        slug: p.slug,
        name: p.name,
        town: p.town,
        category: p.category,
        extract: w?.extract ?? "",
        photo: w?.photo ?? null,
        wikiUrl: w?.wikiUrl ?? `https://es.wikipedia.org/wiki/${encodeURIComponent(p.wikiTitle)}`,
        lat: p.lat,
        lng: p.lng,
      };
    }),
  );
  return results;
}

async function generateGuide(): Promise<PlayasGuide> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) {
    return {
      intro: "La costa alicantina combina arenales urbanos, calas salvajes y un mar transparente.",
      comoIr: "TRAM línea 1/3 a las playas urbanas y autobús/coche para las calas escondidas.",
      queLlevar: "Crema solar, agua, calzado de roca para las calas, gorra y toalla.",
      queHacer: "Snorkel en las calas, paseos al atardecer y chiringuitos en los arenales.",
      consejos: "Madruga en julio-agosto: el parking en las calas se llena antes de las 10:00.",
    };
  }

  const prompt = `Eres guía local de Alicante. Genera una guía cálida, cercana y útil sobre las playas y calas de la provincia de Alicante (Costa Blanca: Alicante, Campello, Villajoyosa, Benidorm, Calp, Benissa, Teulada-Moraira, Benitatxell, Jávea, Dénia, Santa Pola, Guardamar, Torrevieja…). Devuelve EXACTAMENTE este JSON con strings en español, sin markdown ni emojis dentro de los valores:

{
  "intro": "180-250 palabras describiendo la costa alicantina: arenales urbanos vs calas escondidas, color del agua, posidonia, microclima, banderas azules.",
  "comoIr": "120-160 palabras: TRAM línea 1/3/9 desde Alicante, autobuses Vectalia/Alsa, coche y dónde aparcar (parkings de pago en Granadella, Moraig, etc.), bici por la vía verde.",
  "queLlevar": "100-140 palabras: crema solar mineral, agua abundante, escarpines/cangrejeras para calas de roca, gafas de snorkel, sombrilla para arenales sin sombra, neverita.",
  "queHacer": "120-160 palabras: snorkel en Granadella/Moraig/Cantalars, kayak en Calp, paddle surf en San Juan, paseos por Les Rotes, chiringuitos al atardecer en Postiguet y Muchavista, ruta del faro del Albir.",
  "consejos": "80-120 palabras: madrugar de julio a agosto, evitar tramontana, app del Ayto. con banderas, respetar posidonia, llevarse la basura, mejor época mayo-junio y septiembre."
}

Solo el JSON, sin texto extra.`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres guía local experto de la Costa Blanca. Devuelves siempre JSON válido." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status}`);
    const j = await res.json();
    const txt: string = j.choices?.[0]?.message?.content ?? "{}";
    const cleaned = txt.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    return JSON.parse(cleaned) as PlayasGuide;
  } catch {
    return {
      intro: "La costa alicantina combina arenales urbanos, calas salvajes y un mar transparente.",
      comoIr: "TRAM línea 1/3 a las playas urbanas y autobús/coche para las calas escondidas.",
      queLlevar: "Crema solar, agua, calzado de roca, gafas de snorkel y sombrilla.",
      queHacer: "Snorkel en calas, kayak en Calp, paseos al atardecer y chiringuitos.",
      consejos: "Madruga en julio-agosto y respeta la posidonia.",
    };
  }
}

export const getPlayasContent = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ playas: PlayaInfo[]; guide: PlayasGuide }> => {
    const [playas, guide] = await Promise.all([buildPlayas(), generateGuide()]);
    return { playas, guide };
  },
);
