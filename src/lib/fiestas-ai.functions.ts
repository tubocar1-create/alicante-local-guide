import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const askFiestasAI = createServerFn({ method: "POST" })
  .inputValidator((input: { messages: Array<{ role: "user" | "assistant"; content: string }> }) =>
    z
      .object({
        messages: z.array(MessageSchema).min(1).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const system = `Eres un guía local de Alicante apasionado por las FIESTAS DE LA CIUDAD: las Hogueras de San Juan, las mascletás, los castillos de fuegos, la Ofrenda de Flores, la Banyà y todo lo que rodea estas fiestas declaradas de Interés Turístico Internacional.

Tono: ¡MUY alegre, cercano, con muchísima energía! Habla como una vecina enamorada de su fiesta. Usa emojis con generosidad (🔥🎆✨🎇💃🥳🎉🌟) pero sin saturar.

Reglas:
- Responde SIEMPRE en español, en frases cortas y rítmicas.
- Máximo 6 frases por respuesta, salvo que te pidan detalle.
- Si el usuario pregunta por fechas, monumentos, recorridos, mascletà, banyà, ofrenda, ninots, indica datos concretos y conocidos (sin inventar nombres específicos de comisiones o pirotécnicos del año en curso si no estás seguro).
- Si no sabes algo, dilo con alegría y propón una alternativa cercana.
- No incluyas markdown pesado: usa frases naturales y, como mucho, alguna negrita con **palabra**.
- Cierra a menudo con una invitación entusiasta ("¡no te lo pierdas!", "¡vívelo!", "¡que arda Alicante! 🔥").`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
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
