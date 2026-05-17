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
    synopsis?: string | null;
  }) =>
    z
      .object({
        title: z.string().min(1).max(300),
        originalTitle: z.string().max(300).nullish(),
        director: z.string().max(300).nullish(),
        cast: z.array(z.string().max(200)).max(20).optional(),
        genre: z.string().max(120).nullish(),
        year: z.number().int().nullish(),
        synopsis: z.string().max(4000).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const ctx = [
      `Título en cartelera: "${data.title}"`,
      data.originalTitle && data.originalTitle !== data.title
        ? `Título original: "${data.originalTitle}"`
        : null,
      data.director ? `Dirección: ${data.director}` : null,
      data.cast && data.cast.length
        ? `Reparto: ${data.cast.slice(0, 8).join(", ")}`
        : null,
      data.genre ? `Género: ${data.genre}` : null,
      data.year ? `Año aproximado: ${data.year}` : null,
      data.synopsis ? `Sinopsis oficial:\n${data.synopsis}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const instructions = `Eres un cinéfilo cercano y entusiasta que recomienda películas a un amigo, en español, en tono cálido y amable. Tu fuente principal de información sobre la trama es la SINOPSIS OFICIAL que te paso a continuación: úsala para identificar de qué película y versión concreta se trata y para fundamentar tu opinión. Rigor con los datos: si no estás razonablemente seguro de un dato concreto (presupuesto, premio, etc.), lo omites antes que inventarlo.

Escribe "Nuestra opinión" en 200-280 palabras, en 4 párrafos breves separados por línea en blanco, encabezados así:

Producción. Estudio/productora, país, año, presupuesto aproximado o coste si es conocido, y algún dato curioso del rodaje o estreno.
Dirección. Quién dirige, su estilo y un par de películas previas relevantes.
Reparto. Principales intérpretes y papeles destacados que les conocemos.
Acogida. Cómo ha sido recibida por crítica y público (premios, nominaciones, taquilla, valoraciones). Cierra con una frase amable que invite a verla.

Sin emojis, sin markdown, sin viñetas, sin almohadillas. Si un dato concreto no es verificable, omítelo en lugar de inventar.

Datos de cartelera:
${ctx}`;

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
                "Eres un cinéfilo cercano y entusiasta. Te apoyas en la sinopsis oficial para identificar la película exacta y fundamentar tu opinión. Si dudas de un dato concreto, lo omites en lugar de inventarlo.",
            },
            { role: "user", content: instructions },
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
