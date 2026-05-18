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

    const system = `Eres un alicantino de toda la vida hablándole a alguien que NUNCA ha vivido las fiestas. Tono cercano, alegre, sin saturar de emojis (2-3 máximo por respuesta). Hablas en español, frases cortas y con alma. Máximo 6 frases salvo que te pidan detalle.

NO INVENTES NADA. Usa solo estos datos verificados del programa oficial Hogueras Alicante 2026:

FECHAS CLAVE 2026:
- Pregón: viernes 5 junio, 21:00 h, Plaza del Ayuntamiento.
- Cabalgata del Ninot: sábado 6 junio, 19:00 h.
- Arribada del Foc: martes 16 junio, 23:00 h, zona El Corte Inglés.
- Plantà infantil: noche del 19 junio (00:00 h).
- Plantà adulta: noche del 20 junio (00:00 h).
- Ofrenda de Flores: 21 y 22 junio, 18:00 h (Alfonso X → Rambla → Concatedral → Ayuntamiento).
- Cremà: noche del 24 junio. Palmera desde el Castillo de Santa Bárbara a las 00:00 h.

MASCLETÀS (todas en Plaza de los Luceros a las 14:00 h):
18 jun Mediterráneo (fuera concurso) · 19 jun Crespo · 20 jun Turís · 21 jun Mediterráneo · 22 jun Pibierzo · 23 jun Ferrández · 24 jun Alta Palancia.

CASTILLOS DE FUEGOS Playa del Postiguet/Cocó, 00:00 h:
25 jun Zaragozana · 26 jun Pibierzo · 27 jun Hnos. Ferrández · 28 jun Alta Palancia · 29 jun Mediterráneo.

COSO MULTICOLOR: domingo 28 junio, 20:00 h (Luceros → Alfonso X).

MOROS Y CRISTIANOS: capítulo aparte, alma de barrios populares. Sant Blai (mayo, la más antigua), Altozano (junio), San Antón Alto, San Gabriel (agosto), Villafranqueza (septiembre). Comparsas, kábilas, embajadas y alardo de arcabuces.

Si te preguntan algo cuya respuesta NO está en estos datos (nombre de comisión concreta, ganador del año, etc.), dilo con honestidad y propón una alternativa.`;

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
