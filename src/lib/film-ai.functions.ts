import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getFilmAIInsight = createServerFn({ method: "POST" })
  .inputValidator((input: {
    title: string;
    originalTitle?: string | null;
    director?: string | null;
    cast?: string[];
    genre?: string | null;
    year?: number | null;
  }) =>
    z
      .object({
        title: z.string().min(1).max(300),
        originalTitle: z.string().max(300).nullish(),
        director: z.string().max(300).nullish(),
        cast: z.array(z.string().max(200)).max(20).optional(),
        genre: z.string().max(120).nullish(),
        year: z.number().int().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const ctx = [
      `Película: "${data.title}"`,
      data.originalTitle && data.originalTitle !== data.title
        ? `Título original: "${data.originalTitle}"`
        : null,
      data.director ? `Dirección: ${data.director}` : null,
      data.cast && data.cast.length
        ? `Reparto: ${data.cast.slice(0, 8).join(", ")}`
        : null,
      data.genre ? `Género: ${data.genre}` : null,
      data.year ? `Año aproximado: ${data.year}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const prompt = `${ctx}

Redacta una ficha breve en español (180-260 palabras) con tres bloques claros separados por línea en blanco, en este orden:

1) Producción: estudio/productora, país, año, datos relevantes de rodaje o estreno.
2) Dirección: trayectoria del director/a, estilo, películas anteriores destacadas.
3) Reparto: papeles principales y trabajos previos conocidos del reparto listado.

Tono informativo, conciso y elegante. Sin emojis, sin markdown, sin listas con viñetas, sin titulares con almohadilla. Usa los nombres de bloque en negrita simulada escribiendo "Producción.", "Dirección.", "Reparto." al inicio de cada párrafo. Si algún dato no es verificable, omítelo en lugar de inventar.`;

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
                "Eres un crítico de cine riguroso. Solo expones datos plausibles y verificables sobre producción, dirección y reparto. Si dudas, omites.",
            },
            { role: "user", content: prompt },
          ],
        }),
      },
    );

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const text: string = json.choices?.[0]?.message?.content ?? "";
    return { text };
  });
