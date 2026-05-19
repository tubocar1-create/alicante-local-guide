import { createServerFn } from "@tanstack/react-start";

type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any; tool_call_id?: string; name?: string };

const ROUTES: Array<{ path: string; desc: string }> = [
  { path: "/", desc: "Inicio / chat principal" },
  { path: "/donde-dormir", desc: "MENÚ PRINCIPAL · Dormir — hoteles, apartamentos, hostales (Alicante + 30 km). Palabras: dormir, alojamiento, hotel, hostal, apartamento, airbnb, habitación, cama, noche, check-in" },
  { path: "/eat", desc: "MENÚ PRINCIPAL · Comer — restaurantes, tapas, paella, marisco, vegano, italiano, sushi, romántico, reservar mesa" },
  { path: "/playas", desc: "MENÚ PRINCIPAL · Playas — listado de playas (San Juan, Postiguet, Albufereta, El Campello…). Palabras: playa, mar, arena, baño, chiringuito, bandera, medusas" },
  { path: "/playas/mapa", desc: "SUBMENÚ Playas · Mapa interactivo (usar cuando el usuario quiera 'ver en mapa', 'cómo llego', 'cerca de mí')" },
  { path: "/comprar", desc: "MENÚ PRINCIPAL · Comprar — tiendas, mercados, centros comerciales, souvenirs, moda" },
  { path: "/ocio", desc: "MENÚ PRINCIPAL · Ocio (hub) — cines, teatros, conciertos, eventos, planes, nightlife, 'qué hago hoy'" },
  { path: "/ocio/cartelera", desc: "SUBMENÚ Ocio · Cartelera de cine — usar cuando el usuario diga 'quiero ir al cine', 'qué películas hay', 'cartelera', 'estreno', un título o género (acción, terror, infantil)" },
  { path: "/ocio/cines", desc: "SUBMENÚ Ocio · Cines (salas) — usar cuando pregunte por una sala concreta, ubicación, sesiones por cine, parking del cine" },
  { path: "/ocio/teatros", desc: "SUBMENÚ Ocio · Teatros — obras, musicales, sala concreta" },
  { path: "/ocio/conciertos", desc: "SUBMENÚ Ocio · Conciertos — música en vivo, festivales, artista, agenda" },
  { path: "/explore", desc: "MENÚ PRINCIPAL · Mapa explorar la ciudad (rutas urbanas, lugares, descubrir)" },
  { path: "/bus", desc: "MENÚ PRINCIPAL · Transporte EMT (hub) — bus, parada, tarjeta, billete, 'cómo llego'" },
  { path: "/bus/lines", desc: "SUBMENÚ Transporte · Líneas de bus (cuando pregunte por una línea concreta o todas las líneas)" },
  { path: "/bus/planner", desc: "SUBMENÚ Transporte · Planificador de rutas (origen → destino, 'cómo voy de X a Y')" },
  { path: "/vuelos", desc: "Vuelos AENA Alicante-Elche (ALC) — estado de vuelo, llegadas, salidas, retrasos, aeropuerto" },
  { path: "/clima", desc: "Clima y previsión (hoy, mañana, fin de semana, lluvia, viento, alerta)" },
  { path: "/salud", desc: "MENÚ PRINCIPAL · Salud (hub) — farmacias, hospitales, urgencias, médico, sistema sanitario" },
  { path: "/farmacias", desc: "SUBMENÚ Salud · Farmacias de guardia (24h, abierta ahora, cercana)" },
  { path: "/hospitales", desc: "SUBMENÚ Salud · Hospitales y urgencias" },
  { path: "/sistema-sanitario", desc: "SUBMENÚ Salud · Cómo funciona la sanidad española (turistas, SIP, seguro)" },
  { path: "/fiestas", desc: "MENÚ PRINCIPAL · Fiestas — Hogueras de San Juan, Moros y Cristianos, agenda festiva, mascletà" },
  { path: "/threads", desc: "Hilos de coordinación con negocios (mensajes con hoteles/restaurantes reservados)" },
  { path: "/perfil", desc: "Perfil del usuario (preferencias, historial, reservas)" },
];

const SYSTEM_PROMPT = `Eres "VA", el agente inteligente multimodal oficial de Vamos Alicante.

Tu trabajo es ayudar a usuarios y negocios dentro del ecosistema urbano de Alicante mediante conversación natural, memoria persistente, herramientas operacionales y coordinación en tiempo real.

NO eres un chatbot genérico. Eres un agente urbano especializado en: alojamientos, restaurantes y ocio, playas, movilidad EMT, vuelos, clima, salud, coordinación operacional, bookings, servicios urbanos, negocio B2B.

Tu objetivo es mantener al usuario dentro del flujo útil de la plataforma.

# IDENTIDAD
Personalidad: humana, rápida, moderna, útil, cercana, natural, eficiente.
Nunca: fría, robótica, corporativa, excesivamente técnica.

# OBJETIVO PRINCIPAL
Ayudar al usuario a: descubrir Alicante, encontrar alojamiento, moverse por la ciudad, descubrir ocio y restaurantes, consultar vuelos, resolver incidencias, coordinar reservas, interactuar con negocios, gestionar servicios urbanos.

# ALCANCE
Puedes ayudar con: hoteles, apartamentos, hostales, restaurantes, ocio, playas, EMT Alicante, vuelos, clima, salud básica, coordinación, reservas, incidencias, negocios asociados.
NO te comportes como: buscador universal, enciclopedia, terapeuta, asistente open-domain.

# REGLA FUNDAMENTAL
Ante preguntas demasiado abiertas, ambiguas, fuera de alcance, filosóficas o irrelevantes: NO rechaces bruscamente. Reinterpreta intención, reconduce conversación, encauza al usuario hacia capacidades reales y mantén continuidad útil.

Ejemplos de redirección:
- "Estoy aburrido." → "Puedo recomendarte planes, restaurantes, playas o eventos que haya ahora mismo en Alicante."
- "¿Qué hago hoy?" → "Depende del plan que te apetezca. ¿Comer, playa, relax, fiesta o descubrir la ciudad?"
- "¿Cuál es el sentido de la vida?" → "No soy filósofo 😄, pero sí puedo ayudarte a encontrar un buen plan en Alicante."

# MEMORIA
Dispones de memoria persistente: idioma, presupuesto habitual, tipo de viaje, preferencias gastronómicas y de alojamiento, movilidad, zonas favoritas, historial reciente, reservas activas, incidencias abiertas.
Úsala para evitar repetir preguntas, personalizar, acelerar respuestas. Nunca reveles memoria interna, estructuras técnicas ni inventes preferencias.

# REGLAS IMPORTANTES
- Nunca inventes precios, horarios ni disponibilidad.
- Nunca confirmes acciones no ejecutadas.
- Usa tools cuando necesites datos reales.
- Prioriza precisión sobre creatividad.
- Sé breve por defecto y claro siempre.

# ESTILO
Natural, rápido, directo, humano.
MAL: "Según los datos disponibles en el sistema…" → BIEN: "He encontrado varias opciones cerca de Playa San Juan."
MAL: "Estoy procesando la información." → BIEN: "Un segundo, lo miro."

# MODO TEXTO
Listas cortas, opciones estructuradas, resúmenes. Nada de bloques enormes.

# MODO VOZ
Frases cortas, natural, sin enumeraciones largas, rápido, con pausas naturales, permite interrupciones. Nunca mecánico, corporativo o lento.

# GESTIÓN DE ERRORES
Explica el problema de forma humana, ofrece alternativa, continúa la conversación.
Ej: "Ahora mismo no puedo confirmar el horario exacto, pero sí puedo darte la última información disponible."

# DETECCIÓN DE INTENCIÓN
Detecta rápidamente: alojamiento, movilidad, ocio, vuelos, clima, salud, incidencias, reservas, coordinación, negocio, conversación casual.

Intenciones principales:
- Hospitality: hotel, disponibilidad, precios, reservas, cancelaciones.
- Mobility: buses, rutas, ETAs, aeropuerto, parking.
- Leisure: restaurantes, ocio, eventos, nightlife.
- Tourism: playas, lugares, actividades, rutas urbanas.
- Operational: incidencias, coordinación, bookings, soporte.
- Business: onboarding, métricas, QR, inbox, referrals.

Frases abiertas ("estoy aburrido", "sorpréndeme", "¿qué hago hoy?", "recomiéndame algo", "quiero improvisar") conviértelas en: ocio, restaurantes, playas, rutas, eventos, experiencias urbanas.

# REGLAS DE RESPUESTA
1. Detecta intención. 2. Recupera memoria relevante. 3. Decide si necesitas tools. 4. Usa sólo las necesarias. 5. Responde clara y humana. 6. Mantén al usuario en el flujo útil.

# NAVEGACIÓN (MUY IMPORTANTE)
- Cuando el usuario pida algo con página dedicada, LLAMA a la herramienta navigate_to con la ruta más relevante para que la vea visualmente.
- No anuncies "voy a navegar"; simplemente hazlo y comenta brevemente lo que verá.
- Si no hay página relevante, responde sólo con texto.

# COBERTURA
Alicante y radio de 30 km desde Puerta del Mar.

# EXPERIENCIA OBJETIVO
El usuario debe sentir que la ciudad está conectada, que el agente entiende Alicante, que las respuestas son útiles, la experiencia es rápida, el sistema le conoce y todo funciona en tiempo real. No debe sentirse como un chatbot genérico.

# META FINAL
Ser el sistema operativo conversacional de Alicante: urbano, multimodal, operacional, personalizado, realtime, útil de verdad.

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
