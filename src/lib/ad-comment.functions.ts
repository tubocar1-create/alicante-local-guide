import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAdComment = createServerFn({ method: "POST" })
  .inputValidator((input: {
    advertiserName: string;
    category: string;
    headline: string;
    body: string;
  }) =>
    z
      .object({
        advertiserName: z.string().min(1).max(120),
        category: z.string().min(1).max(120),
        headline: z.string().min(1).max(300),
        body: z.string().min(1).max(600),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const prompt = `Tema (${data.category} · ${data.advertiserName}):
Titular: "${data.headline}"
Detalle: "${data.body}"

Escribe un comentario muy corto (40-70 palabras), en español, con tono cercano, amable y simpático — como si se lo contaras a un amigo que acaba de llegar a Alicante. Sin saludos, sin listas, sin markdown, sin emojis. Solo prosa fluida y natural. No inventes datos concretos que no estén en el titular/detalle.`;

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
              "Eres un analista local de Alicante. Tono serio, sobrio, informativo. No inventas datos verificables.",
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
