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
  plastiahorro: [
    {
      headline: "Tuppers que duran de verdad",
      body: "Llévate la cocina ordenada sin gastar de más. Te esperamos en Plastiahorro.",
      cta: "Ver tienda",
    },
    {
      headline: "Lo del hogar, a precio Plastiahorro",
      body: "Menaje, organización y mil ideas para el día a día sin vaciar la cartera.",
      cta: "Echa un vistazo",
    },
    {
      headline: "Tu bazar de confianza en Alicante",
      body: "Desde el vaso de agua hasta el organizador del cajón: lo tenemos.",
      cta: "Ir a la tienda",
    },
    {
      headline: "Ahorra en lo de cada día",
      body: "Productos de cocina, baño y limpieza con esa sonrisa al ver el ticket.",
      cta: "Descubrir",
    },
  ],
};

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
    const advertiser =
      getAdvertiser(data.advertiserId) ?? ADVERTISERS[0];
    const count = data.count ?? 6;

    const baseResp = {
      advertiser: {
        id: advertiser.id,
        name: advertiser.name,
        ctaUrl: advertiser.ctaUrl,
        theme: advertiser.theme,
      },
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ...baseResp,
        variants: FALLBACK[advertiser.id] ?? FALLBACK.plastiahorro,
        error: "no_api_key",
      };
    }

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
                  "Eres copywriter publicitario en español de España. Escribes banners cortos, frescos y honestos. Nada de mayúsculas gritonas, nada de '¡!' encadenados, nada de promesas vacías.",
              },
              {
                role: "user",
                content: `Anunciante: ${advertiser.name}\nCategoría: ${advertiser.category}\nBrief: ${advertiser.brief}\n\nGenera ${count} variantes DISTINTAS de banner publicitario corto. Cada variante: headline (máx 7 palabras), body (1 frase, máx 110 caracteres), cta (2-3 palabras). Tono cercano, alicantino, sin clichés. Variedad de ángulos (precio, utilidad, ocasión, descubrimiento, hostelero, hogar, regalo…).`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "emit_ad_variants",
                  description: "Devuelve variantes de copy publicitario.",
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
          variants: FALLBACK[advertiser.id] ?? FALLBACK.plastiahorro,
          error: `gateway_${res.status}`,
        };
      }

      const json = await res.json();
      const args =
        json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) {
        return {
          ...baseResp,
          variants: FALLBACK[advertiser.id] ?? FALLBACK.plastiahorro,
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
          variants: FALLBACK[advertiser.id] ?? FALLBACK.plastiahorro,
          error: "empty_variants",
        };
      }

      return { ...baseResp, variants };
    } catch (e) {
      console.error("[ads] error", e);
      return {
        ...baseResp,
        variants: FALLBACK[advertiser.id] ?? FALLBACK.plastiahorro,
        error: "exception",
      };
    }
  });
