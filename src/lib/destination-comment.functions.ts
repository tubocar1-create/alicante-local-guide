import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getDestinationComment = createServerFn({ method: "POST" })
  .inputValidator((input: { city: string; country: string; iata: string }) =>
    z
      .object({
        city: z.string().min(1).max(120),
        country: z.string().min(1).max(120),
        iata: z.string().min(2).max(5),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const prompt = `Destino: ${data.city} (${data.country}), aeropuerto ${data.iata}.

Escribe un comentario muy breve (35-60 palabras) en español sobre este destino, con tono simpático, cercano y agradable — como si se lo recomendaras a un amigo. Menciona 1 o 2 cosas que hacen especial el sitio (ambiente, gastronomía, paisaje, vida nocturna, cultura…). Sin saludos, sin listas, sin markdown, sin emojis. Solo prosa fluida. No inventes datos concretos.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres un viajero cercano y simpático que recomienda destinos en pocas palabras, con tono amigable. No inventas datos verificables.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    return { text };
  });
