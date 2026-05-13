import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ADVERTISERS, getAdvertiser, type Advertiser } from "./advertisers";

export type AdCopy = {
  headline: string; // 4-7 palabras
  body: string; // 1 frase, máx 110 chars
  cta: string; // 2-3 palabras
};

export type AdVariantsResponse = {
  advertiser: {
    id: string;
    name: string;
    ctaUrl: string;
    theme: Advertiser["theme"];
  };
  variants: AdCopy[];
  error?: string;
};

const FALLBACK: Record<string, AdCopy[]> = {
  "clima-alicante": [
    {
      headline: "Buen día para pasear",
      body: "Cielo amable en Alicante. Aprovecha el rato para callejear por el casco antiguo.",
      cta: "Ver tiempo",
    },
    {
      headline: "Hidrátate, que aprieta",
      body: "El sol mediterráneo no avisa: lleva agua y crema, sobre todo si vas a la playa.",
      cta: "Ver tiempo",
    },
  ],
  "info-alicante": [
    {
      headline: "El Castillo de Santa Bárbara",
      body: "Está sobre el monte Benacantil y se ve la silueta de la 'Cara del Moro' desde el puerto.",
      cta: "Saber más",
    },
    {
      headline: "TRAM hasta El Campello",
      body: "La L1 te lleva por la costa con vistas; ideal para escaparte sin coche.",
      cta: "Saber más",
    },
    {
      headline: "Hogueras: junio en llamas",
      body: "Del 20 al 24 la ciudad arde de fiesta. Si vienes esos días, reserva con tiempo.",
      cta: "Saber más",
    },
  ],
};

const ALC_LAT = 38.3452;
const ALC_LON = -0.481;

type Weather = {
  tempC: number;
  feelsC: number;
  windKmh: number;
  precipMm: number;
  code: number;
  isDay: boolean;
};

async function fetchAlicanteWeather(): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${ALC_LAT}&longitude=${ALC_LON}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&timezone=Europe%2FMadrid`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j?.current;
    if (!c) return null;
    return {
      tempC: Math.round(c.temperature_2m),
      feelsC: Math.round(c.apparent_temperature),
      windKmh: Math.round(c.wind_speed_10m),
      precipMm: Number(c.precipitation ?? 0),
      code: Number(c.weather_code ?? 0),
      isDay: Number(c.is_day) === 1,
    };
  } catch {
    return null;
  }
}

type SunTimes = { sunrise: string; sunset: string };
async function fetchSunTimes(): Promise<SunTimes | null> {
  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${ALC_LAT}&lng=${ALC_LON}&formatted=0`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.status !== "OK") return null;
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      });
    return { sunrise: fmt(j.results.sunrise), sunset: fmt(j.results.sunset) };
  } catch {
    return null;
  }
}

type Marine = { seaTempC: number; waveM: number; wavePeriodS: number };
async function fetchMarine(): Promise<Marine | null> {
  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${ALC_LAT}&longitude=${ALC_LON}&current=wave_height,wave_period,sea_surface_temperature&timezone=Europe%2FMadrid`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j?.current;
    if (!c) return null;
    return {
      seaTempC: Math.round(Number(c.sea_surface_temperature)),
      waveM: Number(Number(c.wave_height).toFixed(1)),
      wavePeriodS: Math.round(Number(c.wave_period)),
    };
  } catch {
    return null;
  }
}

const WIKI_TOPICS = [
  "Alicante",
  "Castillo_de_Santa_Bárbara",
  "Hogueras_de_San_Juan",
  "Explanada_de_España",
  "Barrio_de_Santa_Cruz_(Alicante)",
  "Playa_del_Postiguet",
  "Mercado_Central_de_Alicante",
  "Isla_de_Tabarca",
  "Basílica_de_Santa_María_(Alicante)",
  "Concatedral_de_San_Nicolás_de_Bari_(Alicante)",
  "MARQ_(Alicante)",
  "Tranvía_Metropolitano_de_Alicante",
  "Puerto_de_Alicante",
  "Monte_Benacantil",
  "Gastronomía_de_la_provincia_de_Alicante",
];

type WikiSummary = { title: string; extract: string; url: string };

async function fetchRandomWikiSummary(): Promise<WikiSummary | null> {
  const topic = WIKI_TOPICS[Math.floor(Math.random() * WIKI_TOPICS.length)];
  try {
    const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.extract) return null;
    return {
      title: j.title ?? topic.replace(/_/g, " "),
      extract: String(j.extract).slice(0, 800),
      url: j?.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${topic}`,
    };
  } catch {
    return null;
  }
}

function describeWmo(code: number): string {
  if (code === 0) return "despejado";
  if ([1, 2, 3].includes(code)) return "parcialmente nublado";
  if ([45, 48].includes(code)) return "niebla";
  if ([51, 53, 55, 56, 57].includes(code)) return "llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "nieve";
  if ([95, 96, 99].includes(code)) return "tormenta";
  return "variable";
}

export const getAdVariants = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { advertiserId: string; count?: number }) =>
      z
        .object({
          advertiserId: z.string().min(1).max(60),
          count: z.number().int().min(1).max(12).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<AdVariantsResponse> => {
    const advertiser = getAdvertiser(data.advertiserId) ?? ADVERTISERS[0];
    const count = data.count ?? 6;

    const baseResp = {
      advertiser: {
        id: advertiser.id,
        name: advertiser.name,
        ctaUrl: advertiser.ctaUrl,
        theme: advertiser.theme,
      },
    };

    let weatherCtx = "";
    if (advertiser.kind === "weather") {
      const w = await fetchAlicanteWeather();
      if (w) {
        weatherCtx = `\n\nDATOS METEO ACTUALES (Alicante): ${w.tempC}°C (sensación ${w.feelsC}°C), viento ${w.windKmh} km/h, precipitación ${w.precipMm} mm, condición: ${describeWmo(w.code)}, ${w.isDay ? "de día" : "de noche"}. Usa estos datos REALES, no los inventes. Menciona la temperatura.`;
      } else {
        weatherCtx = "\n\n(Sin datos meteo en vivo: escribe consejos generales según la estación actual en Alicante).";
      }
    }

    let wiki: WikiSummary | null = null;
    if (advertiser.kind === "info") {
      wiki = await fetchRandomWikiSummary();
      if (wiki) {
        baseResp.advertiser.ctaUrl = wiki.url;
      }
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ...baseResp,
        variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
        error: "no_api_key",
      };
    }

    const userPrompt =
      advertiser.kind === "weather"
        ? `Genera ${count} variantes DISTINTAS de tarjeta de CLIMA para Alicante. Cada variante: headline (máx 7 palabras, refleja el tiempo actual), body (1 frase con consejo práctico, máx 110 caracteres), cta (2-3 palabras tipo "Ver tiempo"). Tono cercano y útil. Sin alarmismo.${weatherCtx}`
        : wiki
          ? `Tema REAL extraído de Wikipedia: "${wiki.title}".\n\nResumen fuente:\n"""${wiki.extract}"""\n\nGenera ${count} variantes DISTINTAS de tarjeta INFORMATIVA basadas EXCLUSIVAMENTE en ese resumen (no inventes datos que no estén ahí). Cada variante destaca un ángulo distinto del tema. Cada variante: headline (máx 7 palabras), body (1 frase con un dato concreto, máx 110 caracteres), cta (2-3 palabras tipo "Saber más"). Tono cercano, sin clichés. Si un dato no está en el resumen, omítelo.`
          : `Genera ${count} variantes DISTINTAS de tarjeta INFORMATIVA sobre Alicante. Temas variados: gastronomía local, Hogueras, playas, TRAM/TAM, Castillo de Santa Bárbara, barrios, mercados, datos curiosos. Cada variante: headline (máx 7 palabras), body (1 frase, máx 110 caracteres), cta (2-3 palabras tipo "Saber más"). Tono cercano, sin clichés turísticos.`;

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Eres redactor en español de España. Escribes tarjetas cortas, frescas y honestas para una app local de Alicante. Nada de mayúsculas gritonas, nada de '¡!' encadenados, nada de promesas vacías.",
              },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "emit_ad_variants",
                  description: "Devuelve variantes de copy.",
                  parameters: {
                    type: "object",
                    properties: {
                      variants: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            headline: { type: "string" },
                            body: { type: "string" },
                            cta: { type: "string" },
                          },
                          required: ["headline", "body", "cta"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["variants"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "emit_ad_variants" },
            },
          }),
        },
      );

      if (!res.ok) {
        console.error("[ads] gateway error", res.status, await res.text());
        return {
          ...baseResp,
          variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
          error: `gateway_${res.status}`,
        };
      }

      const json = await res.json();
      const args =
        json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) {
        return {
          ...baseResp,
          variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
          error: "no_tool_call",
        };
      }
      const parsed = JSON.parse(args) as { variants: AdCopy[] };
      const variants = (parsed.variants ?? [])
        .filter((v) => v?.headline && v?.body && v?.cta)
        .slice(0, count);

      if (variants.length === 0) {
        return {
          ...baseResp,
          variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
          error: "empty_variants",
        };
      }

      return { ...baseResp, variants };
    } catch (e) {
      console.error("[ads] error", e);
      return {
        ...baseResp,
        variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
        error: "exception",
      };
    }
  });
