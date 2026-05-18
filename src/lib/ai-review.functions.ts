import { createServerFn } from "@tanstack/react-start";

export const getAiReview = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string; cuisine?: string | null; address?: string | null; kind?: string | null }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY no configurada");

    const isHealth = data.kind === "health";
    const isHotel = data.kind === "hotel" || /hotel|hostal|hostel|apartam|pension|pensión|guest|resort/i.test(data.cuisine ?? "");
    const prompt = isHotel
      ? `Escribe una breve reseña (90-130 palabras) en español sobre el alojamiento "${data.name}"${
          data.cuisine ? `, tipo: ${data.cuisine}` : ""
        }${data.address ? `, ubicado en ${data.address}` : ""}, en Alicante. Tono cercano y honesto, basado en lo que conoces de este alojamiento o de otros similares de la zona. Menciona ubicación, ambiente, tipo de habitación o servicios destacables y a qué tipo de viajero le encajaría. Si no tienes información específica, sé prudente y no inventes datos verificables (no inventes precios, estrellas ni servicios concretos). Sin listas ni markdown, solo prosa fluida.`
      : isHealth

      ? `Escribe una breve reseña (90-130 palabras) en español sobre "${data.name}"${
          data.kind ? `, categoría: ${data.kind}` : ""
        }${data.address ? `, ubicado en ${data.address}` : ""}, en Alicante. Tono cercano, profesional y honesto, basado en lo que conoces de este centro o de centros similares de la zona. Menciona trato, especialidades o servicios destacables y a quién le encajaría. Si no tienes información específica, sé prudente y no inventes datos concretos (no inventes médicos ni precios). Sin listas ni markdown, solo prosa fluida.`
      : `Escribe una breve reseña (90-130 palabras) en español sobre el local "${data.name}"${
          data.cuisine ? `, tipo: ${data.cuisine}` : ""
        }${data.address ? `, ubicado en ${data.address}` : ""}, en Alicante. Tono cercano y agradable, pero honesto y sincero, basado en lo que conoces de este sitio o de locales similares de la zona. Menciona ambiente, propuesta gastronómica y a quién le encajaría. Si no tienes información específica del sitio, sé prudente y di lo típico de la zona/categoría sin inventar datos concretos. No uses listas ni markdown, solo prosa fluida.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: isHotel
            ? "Eres un guía local de Alicante experto en alojamientos, cercano, honesto y prudente. No inventes datos verificables."
            : isHealth
            ? "Eres un guía local de Alicante experto en servicios sanitarios y de bienestar, cercano, honesto y prudente. No inventes datos verificables."
            : "Eres un crítico gastronómico local de Alicante, cercano, honesto y prudente. No inventes datos verificables." },
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
