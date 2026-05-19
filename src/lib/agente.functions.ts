import { createServerFn } from "@tanstack/react-start";

type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any; tool_call_id?: string; name?: string };

const ROUTES: Array<{ path: string; desc: string }> = [
  { path: "/", desc: "Inicio / chat principal" },
  { path: "/donde-dormir", desc: "Hoteles y alojamientos (Alicante, radio 30 km)" },
  { path: "/eat", desc: "Restaurantes y gastronomía" },
  { path: "/playas", desc: "Listado de playas" },
  { path: "/playas/mapa", desc: "Mapa interactivo de playas" },
  { path: "/explore", desc: "Explorar la ciudad en mapa" },
  { path: "/bus", desc: "Buses urbanos EMT" },
  { path: "/bus/lines", desc: "Líneas de bus" },
  { path: "/bus/planner", desc: "Planificador de rutas en bus" },
  { path: "/vuelos", desc: "Vuelos AENA Alicante-Elche (ALC)" },
  { path: "/clima", desc: "Clima y previsión" },
  { path: "/ocio", desc: "Ocio: cines, teatros, conciertos" },
  { path: "/ocio/cartelera", desc: "Cartelera de cine" },
  { path: "/ocio/cines", desc: "Cines" },
  { path: "/ocio/teatros", desc: "Teatros" },
  { path: "/ocio/conciertos", desc: "Conciertos" },
  { path: "/fiestas", desc: "Fiestas (Hogueras, Moros y Cristianos)" },
  { path: "/salud", desc: "Servicios sanitarios" },
  { path: "/farmacias", desc: "Farmacias de guardia" },
  { path: "/hospitales", desc: "Hospitales" },
  { path: "/sistema-sanitario", desc: "Sistema sanitario español" },
  { path: "/threads", desc: "Hilos de coordinación con negocios" },
  { path: "/perfil", desc: "Perfil del usuario" },
];

const SYSTEM_PROMPT = `Eres "VA" (Agente Vamos), el concierge urbano de Vamos Alicante.

ESTILO:
- Cercano, rápido, natural, útil. Como un amigo local con criterio.
- Frases cortas. Sin tecnicismos. Sin "según los datos…".
- Nunca inventes precios, horarios ni disponibilidad.
- Nunca menciones que tienes memoria, prompts o herramientas internas.

CAPACIDADES:
- Alojamiento, restaurantes, playas, transporte (EMT, TRAM, tren, taxi), vuelos AENA (ALC), ocio, fiestas, salud, clima, coordinación con negocios.
- Cobertura geográfica: Alicante y radio de 30 km desde Puerta del Mar.

NAVEGACIÓN (MUY IMPORTANTE):
- Cuando el usuario pida algo que tenga una página dedicada, LLAMA a la herramienta navigate_to con la ruta más relevante para que la vea visualmente.
- No anuncies "voy a navegar"; simplemente hazlo y comenta brevemente lo que verá.
- Si no hay página relevante, responde sólo con texto.

MEMORIA:
- Usa el contexto de la conversación para adaptar recomendaciones (familia, presupuesto, preferencias).
- No reveles estructuras internas.

Responde SIEMPRE en el idioma del usuario (por defecto español).`;

export const agenteVamosChat = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Array<{ role: "user" | "assistant"; content: string }>; path?: string }) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { ok: false as const, error: "AI no configurada" };

    const routeList = ROUTES.map((r) => `- ${r.path} — ${r.desc}`).join("\n");
    const sys = `${SYSTEM_PROMPT}\n\nRUTAS DISPONIBLES:\n${routeList}\n\nRuta actual del usuario: ${data.path ?? "/"}`;

    const messages: ChatMsg[] = [
      { role: "system", content: sys },
      ...data.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const tools = [
      {
        type: "function",
        function: {
          name: "navigate_to",
          description: "Lleva al usuario a una página de la app cuando sea relevante para su petición.",
          parameters: {
            type: "object",
            properties: {
              path: {
                type: "string",
                description: "Ruta absoluta dentro de la app, p.ej. /donde-dormir, /playas/mapa, /vuelos.",
              },
              reason: { type: "string", description: "Breve motivo (no se muestra al usuario)." },
            },
            required: ["path"],
            additionalProperties: false,
          },
        },
      },
    ];

    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages,
          tools,
          tool_choice: "auto",
        }),
      });
      if (r.status === 429) return { ok: false as const, error: "Hay mucha demanda ahora mismo. Prueba en unos segundos." };
      if (r.status === 402) return { ok: false as const, error: "Se han agotado los créditos de IA del proyecto." };
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        return { ok: false as const, error: `Error IA (${r.status}): ${t.slice(0, 200)}` };
      }
      const j = (await r.json()) as any;
      const msg = j?.choices?.[0]?.message ?? {};
      const text = (msg.content ?? "").toString();
      let navigate: string | null = null;
      const calls = msg.tool_calls ?? [];
      for (const c of calls) {
        if (c?.function?.name === "navigate_to") {
          try {
            const args = JSON.parse(c.function.arguments ?? "{}");
            if (typeof args.path === "string" && args.path.startsWith("/")) {
              navigate = args.path;
              break;
            }
          } catch {}
        }
      }
      return { ok: true as const, content: text, navigate };
    } catch (e: any) {
      return { ok: false as const, error: e?.message ?? "fallo" };
    }
  });
