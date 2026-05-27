import { createServerFn } from "@tanstack/react-start";
import { MAP_BEACHES } from "@/lib/playas-map-data";

type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any; tool_call_id?: string; name?: string };

const ROUTES: Array<{ path: string; desc: string }> = [
  { path: "/", desc: "Inicio / chat principal" },
  { path: "/donde-dormir", desc: "MENÚ PRINCIPAL · Dormir — hoteles, apartamentos, hostales (Alicante + 30 km). Palabras: dormir, alojamiento, hotel, hostal, apartamento, airbnb, habitación, cama, noche, check-in" },
  { path: "/", desc: "MENÚ PRINCIPAL · Comer — el submenú Comer se abre en el chat principal (no hay ruta /eat). Categorías: cocina típica, arroces/paella, italiano, japonés/asiático, vegano, brunch, postres, comida rápida, barato, internacional. Cada categoría abre su propio Dashboard inline en el chat." },
  { path: "/playas", desc: "MENÚ PRINCIPAL · Playas — listado de playas (San Juan, Postiguet, Albufereta, El Campello…). Palabras: playa, mar, arena, baño, chiringuito, bandera, medusas" },
  { path: "/playas/mapa", desc: "SUBMENÚ Playas · Mapa interactivo (usar cuando el usuario quiera 'ver en mapa', 'cómo llego', 'cerca de mí')" },
  { path: "/comprar", desc: "MENÚ PRINCIPAL · Comprar — tiendas, mercados, centros comerciales, souvenirs, moda" },
  { path: "/ocio", desc: "MENÚ PRINCIPAL · Ocio (hub) — cines, teatros, conciertos, eventos, planes, nightlife, 'qué hago hoy'" },
  { path: "/ocio/cartelera", desc: "SUBMENÚ Ocio · Cartelera de cine — usar cuando el usuario diga 'quiero ir al cine', 'qué películas hay', 'cartelera', 'estreno', un título o género (acción, terror, infantil)" },
  { path: "/ocio/cines", desc: "SUBMENÚ Ocio · Cines (salas) — usar cuando pregunte por una sala concreta, ubicación, sesiones por cine, parking del cine" },
  { path: "/ocio/teatros", desc: "SUBMENÚ Ocio · Teatros — obras, musicales, sala concreta" },
  { path: "/ocio/conciertos", desc: "SUBMENÚ Ocio · Conciertos — música en vivo, festivales, artista, agenda" },
  { path: "/explore", desc: "MENÚ PRINCIPAL · Mapa explorar la ciudad (rutas urbanas, lugares, descubrir)" },
  { path: "action:bus-picker", desc: "MENÚ PRINCIPAL · Bus urbano — abre el selector '¿Ya sabes qué bus tomar?' (bus urbano, parada, tarjeta, billete, 'cómo llego')" },
  { path: "action:bus-picker", desc: "SUBMENÚ Transporte · Líneas de bus — abre el selector de bus (al elegir una línea se muestra el Dashboard de esa línea con sus paradas)" },
  { path: "action:bus-picker", desc: "SUBMENÚ Transporte · Planificador de rutas (origen → destino, 'cómo voy de X a Y') — abre el selector de bus en el Inicio" },
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

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const hasAnyTerm = (text: string, terms: string[]) =>
  terms.some((term) => new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`, "i").test(text));

const parentPath = (p: string): string => {
  if (!p || p === "/") return "/";
  const segs = p.split("/").filter(Boolean);
  segs.pop();
  return segs.length === 0 ? "/" : "/" + segs.join("/");
};

// === RESOLVER DE NOMBRES PROPIOS (máxima prioridad) ===
// Detecta entidades específicas (playa concreta, línea de bus concreta,
// marca de cine, destino de vuelo, hotel concreto…) antes que la categoría genérica.

// Marcas/cines conocidos en Alicante con su ruta destino.
// Mientras no podamos resolver slug del cine dinámicamente, llevamos al listado de cines.
const CINEMA_BRANDS: Array<{ terms: string[]; path: string }> = [
  { terms: ["yelmo", "yelmocines", "yelmo cines"], path: "/ocio/cines" },
  { terms: ["kinepolis"], path: "/ocio/cines" },
  { terms: ["odeon", "odeón", "odeon multicines"], path: "/ocio/cines" },
  { terms: ["cinesa"], path: "/ocio/cines" },
  { terms: ["abc park", "abc"], path: "/ocio/cines" },
  { terms: ["aana", "aana cinema"], path: "/ocio/cines" },
  { terms: ["panoramis"], path: "/ocio/cines" },
];

// Ciudades / destinos comunes desde ALC con su IATA. Detecta "vuelo a Madrid",
// "quiero ir a Amsterdam", "llego desde Londres" → ficha de destino / origen.
const CITY_TO_IATA: Array<{ names: string[]; iata: string }> = [
  { names: ["madrid"], iata: "MAD" },
  { names: ["barcelona"], iata: "BCN" },
  { names: ["bilbao"], iata: "BIO" },
  { names: ["sevilla"], iata: "SVQ" },
  { names: ["valencia"], iata: "VLC" },
  { names: ["malaga", "málaga"], iata: "AGP" },
  { names: ["palma", "palma de mallorca", "mallorca"], iata: "PMI" },
  { names: ["tenerife"], iata: "TFN" },
  { names: ["ibiza"], iata: "IBZ" },
  { names: ["menorca", "mahon", "mahón"], iata: "MAH" },
  { names: ["santiago", "santiago de compostela"], iata: "SCQ" },
  { names: ["vigo"], iata: "VGO" },
  { names: ["asturias", "oviedo"], iata: "OVD" },
  { names: ["londres", "london"], iata: "LGW" },
  { names: ["paris", "parís"], iata: "CDG" },
  { names: ["amsterdam", "ámsterdam"], iata: "AMS" },
  { names: ["bruselas", "brussels"], iata: "BRU" },
  { names: ["berlin", "berlín"], iata: "BER" },
  { names: ["munich", "múnich"], iata: "MUC" },
  { names: ["roma", "rome"], iata: "FCO" },
  { names: ["milan", "milán"], iata: "MXP" },
  { names: ["dublin", "dublín"], iata: "DUB" },
  { names: ["manchester"], iata: "MAN" },
  { names: ["liverpool"], iata: "LPL" },
  { names: ["edimburgo", "edinburgh"], iata: "EDI" },
  { names: ["oslo"], iata: "OSL" },
  { names: ["estocolmo", "stockholm"], iata: "ARN" },
  { names: ["copenhague", "copenhagen"], iata: "CPH" },
  { names: ["helsinki"], iata: "HEL" },
  { names: ["varsovia", "warsaw"], iata: "WAW" },
  { names: ["praga", "prague"], iata: "PRG" },
  { names: ["viena", "vienna"], iata: "VIE" },
  { names: ["zurich", "zúrich"], iata: "ZRH" },
  { names: ["ginebra", "geneva"], iata: "GVA" },
  { names: ["lisboa", "lisbon"], iata: "LIS" },
  { names: ["porto", "oporto"], iata: "OPO" },
  { names: ["frankfurt"], iata: "FRA" },
  { names: ["dusseldorf", "düsseldorf"], iata: "DUS" },
  { names: ["hamburgo", "hamburg"], iata: "HAM" },
  { names: ["colonia", "cologne"], iata: "CGN" },
  { names: ["napoles", "nápoles", "naples"], iata: "NAP" },
  { names: ["venecia", "venice"], iata: "VCE" },
  { names: ["atenas", "athens"], iata: "ATH" },
  { names: ["estambul", "istanbul"], iata: "IST" },
  { names: ["marrakech"], iata: "RAK" },
  { names: ["casablanca"], iata: "CMN" },
];

const properNounMatch = (
  rawText: string,
  currentPath: string,
): { path: string; reason: string } | null => {
  const text = normalizeText(rawText);
  if (!text) return null;

  // 1) PLAYA CONCRETA — slug directo a ficha real /playas/$slug
  for (const playa of MAP_BEACHES) {
    const baseName = normalizeText(playa.name)
      .replace(/^(playa|cala)\s+(de\s+la\s+|de\s+los\s+|del\s+|de\s+l\s+|de\s+)?/i, "")
      .trim();
    const slugWords = normalizeText(playa.slug.replace(/-/g, " "));
    const candidates = [baseName, slugWords].filter((v) => v && v.length >= 3);
    for (const cand of candidates) {
      if (text.includes(cand)) {
        const target = `/playas/${playa.slug}`;
        if (target === currentPath) return null;
        return { path: target, reason: `playa concreta: ${playa.name}` };
      }
    }
  }

  // 2) LÍNEA DE BUS CONCRETA — "linea 12", "L12", "bus 24", "el 22"
  const lineMatch =
    text.match(/\bl(?:inea)?\s*([0-9]{1,3}[a-z]?)\b/i) ||
    text.match(/\bbus\s+([0-9]{1,3}[a-z]?)\b/i) ||
    text.match(/\bel\s+([0-9]{1,3}[a-z]?)\b/i);
  if (lineMatch && lineMatch[1]) {
    const code = lineMatch[1].toUpperCase();
    const target = `/bus/dashboard/${code}`;
    if (target === currentPath) return null;
    return { path: target, reason: `línea de bus concreta: ${code}` };
  }

  // 3) MARCA DE CINE CONCRETA
  for (const brand of CINEMA_BRANDS) {
    if (hasAnyTerm(text, brand.terms) || brand.terms.some((t) => text.includes(t))) {
      if (brand.path === currentPath) return null;
      return { path: brand.path, reason: `marca de cine concreta` };
    }
  }

  // 4) CIUDAD / AEROPUERTO POR NOMBRE PROPIO → ficha destino/origen
  //    Disparadores: "vuelo a X", "ir a X", "viajar a X", "llego desde X", "vengo de X"…
  const travelIntent =
    /\b(vuelo|vuelos|volar|viajar|viaje|ir|voy|quiero ir|quisiera ir|llegar|llego|vengo|venir|reservar)\b/.test(
      text,
    );
  if (travelIntent) {
    for (const c of CITY_TO_IATA) {
      for (const name of c.names) {
        const reFrom = new RegExp(`\\b(desde|de)\\s+${name}\\b`);
        const reTo = new RegExp(`\\b(a|para|hacia|hasta)\\s+${name}\\b`);
        const looseTo = new RegExp(`\\b${name}\\b`);
        const isFrom = reFrom.test(text);
        const isTo = reTo.test(text) || (!isFrom && looseTo.test(text));
        if (isFrom || isTo) {
          const target = isFrom ? `/vuelos/${c.iata}?type=L` : `/vuelos/${c.iata}`;
          if (currentPath === `/vuelos/${c.iata}`) return null;
          return {
            path: target,
            reason: isFrom
              ? `ficha de origen: ${name} (${c.iata})`
              : `ficha de destino: ${name} (${c.iata})`,
          };
        }
      }
    }
  }

  return null;
};

const getPriorityRoute = (
  rawText: string,
  currentPath: string = "/",
): { path: string; reason: string } | null => {
  const text = normalizeText(rawText);
  if (!text) return null;

  // PRIORIDAD MÁXIMA: nombre propio / entidad concreta
  const proper = properNounMatch(rawText, currentPath);
  if (proper) return proper;


  // === Navegación relativa al flujo actual ===
  // Volver / atrás → sube un nivel desde la ruta actual
  if (hasAnyTerm(text, ["atras", "volver", "regresa", "regresar", "back", "vuelve"])) {
    const parent = parentPath(currentPath);
    if (parent !== currentPath) return { path: parent, reason: "volver al nivel anterior" };
  }
  // Menú principal / inicio / home
  if (hasAnyTerm(text, ["inicio", "home", "principal", "menu"]) && !hasAnyTerm(text, ["bus", "linea", "lineas"])) {
    if (currentPath !== "/") return { path: "/", reason: "volver al menú principal" };
  }

  const isTransportTheme = hasAnyTerm(text, ["bus", "emt", "parada", "paradas", "linea", "lineas", "billete", "bonobus", "tarjeta"]);
  const hasOriginDestination = /\bde\s+\S+.+\b(a|hasta)\s+\S+/.test(text);

  const rules: Array<{ path: string; reason: string; terms: string[]; test?: (text: string) => boolean }> = [
    { path: "/ocio/cartelera", reason: "tema cine/cartelera", terms: ["cine", "pelicula", "peliculas", "cartelera", "estreno", "estrenos", "sesion", "sesiones"] },
    { path: "/ocio/cines", reason: "tema salas de cine", terms: ["cines", "sala", "salas", "kinepolis", "odeon", "yelmocines"] },
    { path: "/ocio/teatros", reason: "tema teatro", terms: ["teatro", "teatros", "obra", "obras", "musical", "musicales"] },
    { path: "/ocio/conciertos", reason: "tema conciertos", terms: ["concierto", "conciertos", "festival", "festivales", "musica", "artista"] },
    { path: "/farmacias", reason: "tema farmacia", terms: ["farmacia", "farmacias", "guardia", "medicamento", "medicamentos"] },
    { path: "/hospitales", reason: "tema hospital/urgencias", terms: ["hospital", "hospitales", "urgencia", "urgencias", "emergencia", "emergencias"] },
    { path: "/sistema-sanitario", reason: "tema sistema sanitario", terms: ["sanidad", "sanitario", "sip", "seguro", "medico", "medica"] },
    
    { path: "/playas", reason: "tema playas", terms: ["playa", "playas", "mar", "arena", "bano", "chiringuito", "bandera", "medusas"] },
    { path: "/donde-dormir", reason: "tema alojamiento", terms: ["dormir", "alojamiento", "hotel", "hoteles", "hostal", "hostales", "apartamento", "apartamentos", "airbnb", "habitacion"] },
    { path: "/comprar", reason: "tema compras", terms: ["comprar", "tienda", "tiendas", "mercado", "mercados", "shopping", "souvenir", "souvenirs", "moda", "centro comercial"] },
    { path: "/vuelos", reason: "tema vuelos/aeropuerto", terms: ["vuelo", "vuelos", "aeropuerto", "llegadas", "salidas", "retraso", "retrasos", "aena"] },
    { path: "/clima", reason: "tema clima", terms: ["clima", "tiempo", "lluvia", "llueve", "llover", "viento", "temperatura", "calor", "frio", "alerta"] },
    { path: "/fiestas", reason: "tema fiestas", terms: ["fiesta", "fiestas", "hogueras", "mascleta", "moros", "cristianos"] },
    { path: "action:bus-picker", reason: "tema líneas de bus", terms: ["linea", "lineas"], test: () => isTransportTheme },
    { path: "action:bus-picker", reason: "tema planificador de transporte", terms: ["bus", "emt", "parada", "paradas", "billete", "bonobus", "tarjeta"], test: () => isTransportTheme || hasOriginDestination },
    { path: "/ocio", reason: "tema ocio/planes", terms: ["ocio", "plan", "planes", "aburrido", "aburrida", "hacer", "hoy", "noche", "salir"] },
    { path: "/explore", reason: "tema explorar ciudad", terms: ["explorar", "descubrir", "ruta", "rutas", "paseo", "monumento", "monumentos", "lugar", "lugares"] },
    { path: "/salud", reason: "tema salud", terms: ["salud", "medico", "medica", "doctor", "doctora"] },
  ];

  for (const rule of rules) {
    if (rule.test && !rule.test(text)) continue;
    if (hasAnyTerm(text, rule.terms)) {
      // Si ya está en esa ruta, no proponemos navegar — dejar que el AI conteste contextual.
      if (rule.path === currentPath) return null;
      return { path: rule.path, reason: rule.reason };
    }
  }

  if (hasOriginDestination && isTransportTheme && currentPath !== "/") {
    return { path: "/", reason: "origen y destino con transporte" };
  }
  return null;
};

// === DESAMBIGUACIÓN DE RUTAS ===
// Cuando una frase puede encajar en varias secciones (p.ej. "tomar el sol"
// → playa o clima), no navegamos directamente: devolvemos una pregunta corta
// al usuario para que elija. Se evalúa ANTES de la clasificación determinista.
type AmbiguityCase = {
  // patrón ambiguo que dispara la duda
  test: RegExp;
  // términos que, si aparecen, ya desambigüan y por tanto NO preguntamos
  disambiguators?: RegExp;
  // pregunta para el usuario
  ask: string;
};

const AMBIGUITY_CASES: AmbiguityCase[] = [
  {
    // "tomar el sol", "ponerme al sol", "broncearme", "solearme"
    test: /\b(tomar\s+el\s+sol|ponerme\s+al\s+sol|al\s+sol|broncear(me|se)?|solear(me|se)?|tumbarme\s+al\s+sol)\b/i,
    disambiguators: /\b(playa|playas|cala|calas|arena|mar|chiringuito|clima|tiempo|temperatura|previsi[oó]n|lluvia|llueve|nublad[oa]|sol(es)?\s+(hoy|mañana|fin\s+de\s+semana))\b/i,
    ask: "¿Te refieres a una playa donde tomar el sol o a la previsión del tiempo para hoy?",
  },
];

const detectAmbiguity = (text: string): string | null => {
  for (const c of AMBIGUITY_CASES) {
    if (!c.test.test(text)) continue;
    if (c.disambiguators && c.disambiguators.test(text)) continue;
    return c.ask;
  }
  return null;
};

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

# NAVEGACIÓN (MUY IMPORTANTE) — REGLA DE ENRUTAMIENTO PRIORITARIO

PASO 0 — NOMBRE PROPIO GANA SIEMPRE.
Antes que nada busca en la frase NOMBRES PROPIOS o entidades concretas conocidas y enrútalas a su ficha específica:
- Playa concreta (Playa San Juan, Postiguet, Albufereta, Cala Granadella, Moraig…) → /playas/{slug}
- Línea de bus concreta ("línea 12", "L22", "bus 24") → /bus/dashboard/{código} (Dashboard de la línea con sus paradas)
- Marca de cine concreta (Yelmo, Kinepolis, Odeón, ABC Park, Panoramis) → ficha del cine en /ocio/cines
- Vuelo con destino concreto ("vuelo a Madrid", "vuelos a Londres") → /vuelos filtrado por ese destino
- Hotel concreto (Hotel Meliá, AC Hotel…) → /donde-dormir y filtra
El nombre propio SIEMPRE prioriza sobre el sustantivo genérico. Ejemplo: "Playa San Juan" → /playas/san-juan (NO /playas). "Yelmo Cines" → ficha Yelmo (NO /ocio/cartelera). "Vuelo a Madrid" → /vuelos?destino=madrid (NO /vuelos genérico).

PASO 1 — Si no hay nombre propio, detecta el SUSTANTIVO / TEMA CLAVE.
Extrae de la frase del usuario la palabra principal que describe el TEMA (sustantivo o actividad: cine, película, hotel, playa, paella, restaurante, farmacia, hospital, bus, vuelo, clima, concierto, teatro, fiesta, mercado, tienda…). IGNORA verbos genéricos de movimiento o deseo ("quiero", "ir", "voy", "necesito", "busco", "me apetece", "dame", "llévame"). Esos verbos NO definen el destino.

PASO 2 — EMPAREJAR CON EL MENÚ PRINCIPAL.
Compara ese sustantivo / tema con las palabras clave de cada ítem marcado "MENÚ PRINCIPAL" en RUTAS DISPONIBLES. La ruta cuyo set de palabras clave coincide con el tema GANA, aunque la frase contenga otros verbos.

PASO 3 — DECIDIR MENÚ vs SUBMENÚ.
- Pregunta general sobre el sector → ruta de MENÚ PRINCIPAL.
- Pregunta específica (un subtipo, una acción concreta dentro del sector) → SUBMENÚ correspondiente.

PASO 4 — NAVEGAR EN EL MISMO TURNO con navigate_to. No preguntes "¿quieres que te lleve?". Comenta breve lo que verá.

REGLA ANTI-COLISIÓN CON el selector de buses:
- "/" (selector de buses) SÓLO se usa cuando el tema es transporte público en sí mismo: el usuario menciona "bus", "EMT", "parada", "línea", "tarjeta", "billete", o nombra DOS lugares (origen → destino, "de X a Y"). Desde el selector, al elegir una línea se entra a su Dashboard, y desde ahí a una parada concreta.
- "Quiero IR al cine / a la playa / a un restaurante" NO es transporte: el tema es cine / playa / restaurante. Verbo "ir" + actividad ⇒ enruta a la actividad, NO al selector de buses.
- Sólo si después de estar en la página de la actividad el usuario pregunta "¿cómo llego?" o "¿qué bus cojo?", entonces sí navega a "/" para abrir el selector de buses.

Ejemplos correctos:
- "Quiero ir al cine" → tema = cine → navigate_to("/ocio/cartelera"). NUNCA "/" para bus.
- "Quiero ir a la playa" → tema = playa → navigate_to("/playas").
- "Quiero ir a comer paella" → tema = paella/comer → el chat abre el Dashboard inline (no navegues a /eat, esa ruta no existe).
- "¿Qué cines hay?" → navigate_to("/ocio/cines").
- "¿Qué película veo hoy?" → navigate_to("/ocio/cartelera").
- "¿Qué hay para hacer hoy?" → navigate_to("/ocio").
- "Necesito una farmacia de guardia" → navigate_to("/farmacias").
- "Tengo dolor de pecho" → navigate_to("/hospitales") + indicar 112.
- "Quiero dormir cerca de la playa" → navigate_to("/donde-dormir").
- "¿Llueve mañana?" → navigate_to("/clima").
- "¿Mi vuelo llega a tiempo?" → navigate_to("/vuelos").
- "Cómo voy del centro a San Juan" → AQUÍ sí: dos lugares → navigate_to("/") y se abre el selector de buses.
- "¿Qué bus va al aeropuerto?" → navigate_to("/").

Sólo responde sin navegar si NO hay ninguna ruta razonable, en saludo/despedida casual, o si el usuario ya está en la página correcta y pide un detalle puntual.

# CONTINUIDAD DE FLUJO (MUY IMPORTANTE)
La conversación NUNCA termina al navegar. Después de llevar al usuario a una página, mantén el hilo: ofrece próximos pasos contextuales, refina filtros, baja a un detalle, vuelve a un nivel superior o salta a una sección hermana — según lo que pida.

# GUÍA POR SELECTORES DE CADA CATEGORÍA (REGLA CENTRAL)
El agente es un guía a través de la app: lleva al usuario por las categorías y, una vez DENTRO de una categoría, ofrece SIEMPRE las MISMAS opciones que muestra el SELECTOR/SUBMENÚ de esa categoría en pantalla. No inventes opciones nuevas ni sugieras rutas externas a ese selector: refleja exactamente sus ramificaciones para que el usuario se adentre paso a paso hasta el endpoint final (ficha, parada, película, playa, farmacia…).

Cómo aplicarlo:
1. Al enrutar a una categoría (ej. /ocio, /salud, /playas, /comprar, /, /bus, /donde-dormir…), enumera brevemente las ramas reales del selector de esa pantalla y pregunta cuál escoge.
2. Cuando elija una rama, navega a la subcategoría correspondiente y vuelve a ofrecer las opciones del siguiente selector. Repite hasta el endpoint.
3. No mezcles ramas de otras categorías: el contexto activo manda. Si el usuario cambia de tema, confirma antes de saltar.
4. Nunca dejes al usuario en una categoría sin indicarle las opciones disponibles del selector de esa pantalla.

Reglas:
1. La "Ruta actual del usuario" indica el contexto. Decide si la próxima respuesta debe: a) bajar de nivel (submenú o detalle), b) subir de nivel (padre / menú principal), c) saltar a una ruta hermana, d) permanecer y responder con texto.
2. Si el usuario YA está en la ruta donde se atiende su tema y hace una pregunta de detalle (filtrar, elegir un ítem, comparar), NO navegues: responde con texto y ofrece las opciones del selector actual.
3. "volver", "atrás", "regresa" → navega al padre (quitar el último segmento; si ya está en raíz, "/").
4. "menú", "menú principal", "inicio", "home" → navega a "/".
5. Si está en una página y nombra otro tema del menú/submenú → navega a la nueva ruta sin pedir confirmación, y reenumera las opciones del selector de la nueva pantalla.
6. Si está en un submenú y pregunta por un hermano del mismo hub (en /ocio/cartelera pregunta "¿y teatros?"), salta a /ocio/teatros.
7. Tras cada navegación, frase breve indicando qué verá + las ramas del selector de esa pantalla como siguiente paso natural.
8. Mantén memoria del recorrido: si el usuario eligió cine, luego una sala concreta, y luego "¿cómo llego?", recién entonces saltas a "/" para abrir el selector de buses con destino=el cine.

Ejemplos:
- En /ocio/cartelera, "¿hay algo de terror?" → texto, sin navegar.
- En /ocio/cartelera, "y de teatro?" → navigate_to("/ocio/teatros").
- En /ocio/cartelera, "volver" → navigate_to("/ocio").
- En /playas/mapa, "menú principal" → navigate_to("/").
- En el Dashboard de Comer (en "/"), "¿cómo llego al primero?" → navigate_to("/") con origen/destino.

# COBERTURA
Alicante y radio de 30 km desde Puerta del Mar.

# EXPERIENCIA OBJETIVO
El usuario debe sentir que la ciudad está conectada, que el agente entiende Alicante, que las respuestas son útiles, la experiencia es rápida, el sistema le conoce y todo funciona en tiempo real. No debe sentirse como un chatbot genérico.

# META FINAL
Ser el sistema operativo conversacional de Alicante: urbano, multimodal, operacional, personalizado, realtime, útil de verdad.

Responde SIEMPRE en el idioma del usuario (por defecto español).`;

// === RESPUESTAS LOCALES (sin llamar a la IA) ===
// Catálogo de respuestas breves por ruta para acompañar la navegación determinista.
const ROUTE_BLURBS: Record<string, string> = {
  "/": "Vuelvo al menú principal.",
  "/ocio/cartelera": "Aquí tienes la cartelera. ¿Filtramos por sala u hora?",
  "/ocio/cines": "Estos son los cines. Dime cuál te interesa.",
  "/ocio/teatros": "Cartel de teatros. ¿Algún género en concreto?",
  "/ocio/conciertos": "Conciertos próximos. ¿Te oriento por fecha o artista?",
  "/ocio": "Planes de ocio. ¿Cine, teatro, conciertos o salir de noche?",
  "/playas": "Playas y calas. ¿Centro, San Juan, El Campello o caletas escondidas?",
  "/playas/mapa": "Mapa de playas. Pulsa una para ver detalles.",
  "/donde-dormir": "Alojamientos cerca. ¿Zona, precio o estilo?",
  "/comprar": "Tiendas y mercados. ¿Buscas algo concreto?",
  
  "/explore": "Explora la ciudad. ¿Centro histórico, museos o rutas?",
  
  "/bus/planner": "Te abro el selector de buses para planificar tu ruta.",
  "/vuelos": "Estado del aeropuerto ALC. ¿Llegadas o salidas?",
  "/clima": "Previsión del tiempo en Alicante.",
  "/salud": "Salud. ¿Farmacia, hospital o info del sistema?",
  "/farmacias": "Farmacias de guardia más cercanas.",
  "/hospitales": "Hospitales y urgencias.",
  "/sistema-sanitario": "Info del sistema sanitario español.",
  "/fiestas": "Agenda festiva: Hogueras, Moros y Cristianos, mascletà…",
  "/threads": "Tus hilos con negocios.",
  "/perfil": "Tu perfil.",
};

const blurbFor = (path: string): string => {
  if (path === "action:bus-picker") return "Te abro el selector de buses urbanos.";
  if (ROUTE_BLURBS[path]) return ROUTE_BLURBS[path];
  // Ficha de playa concreta → punto final: anuncia y cierra el diálogo.
  const playaMatch = path.match(/^\/playas\/([^/?#]+)$/);
  if (playaMatch && playaMatch[1] !== "mapa") {
    const playa = MAP_BEACHES.find((p) => p.slug === playaMatch[1]);
    const name = playa?.name ?? "esta playa";
    return `Esta es ${name}, te estoy dejando fotos, descripción y reseñas, para que tú explores y decidas.`;
  }
  // Rutas con parámetro: usar el padre
  const parent = path.split("/").slice(0, -1).join("/") || "/";
  if (ROUTE_BLURBS[parent]) return ROUTE_BLURBS[parent];
  return "Te llevo allí.";
};

// Para fichas /vuelos/{IATA} (destino) y /vuelos/{IATA}?type=L (origen)
// generamos un blurb con el conteo real de vuelos hoy y a 7 días.
async function flightsCountBlurb(
  supabaseAdmin: any,
  path: string,
): Promise<string | null> {
  const m = path.match(/^\/vuelos\/([A-Z]{3})(\?type=L)?$/);
  if (!m) return null;
  const iata = m[1];
  const isInbound = !!m[2];
  const flightType = isInbound ? "L" : "S";

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(startToday);
  endToday.setDate(endToday.getDate() + 1);
  const end7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const qToday = supabaseAdmin
    .from("aena_flights")
    .select("id", { count: "exact", head: true })
    .eq("airport", "ALC")
    .eq("flight_type", flightType)
    .eq("iata_otro", iata)
    .gte("scheduled_at", startToday.toISOString())
    .lt("scheduled_at", endToday.toISOString());

  const qWeek = supabaseAdmin
    .from("aena_flights")
    .select("id", { count: "exact", head: true })
    .eq("airport", "ALC")
    .eq("flight_type", flightType)
    .eq("iata_otro", iata)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", end7d.toISOString());

  try {
    const [tRes, wRes] = await Promise.all([qToday, qWeek]);
    const today = tRes.count ?? 0;
    const week = wRes.count ?? 0;
    return `Hemos encontrado ${today} vuelo${today === 1 ? "" : "s"} disponible${today === 1 ? "" : "s"} para hoy y ${week} vuelo${week === 1 ? "" : "s"} disponible${week === 1 ? "" : "s"} para los próximos 7 días.`;
  } catch {
    return null;
  }
}

// Detecta intentos abiertos / ambiguos que SÍ merecen llamada a la IA.
const isOpenEnded = (text: string): boolean => {
  const t = normalizeText(text);
  if (!t) return false;
  if (t.split(" ").length > 14) return true; // frases largas
  return /\b(aburrid|sorprend|recomienda|recomiend|que hago|que hacer|no se|improvisar|romantic|familia|ninos|barato|caro|cerca de mi|sugerencia|opcion|que me recomien|ideas?)\b/.test(t);
};

// Saludo / despedida / agradecimiento → respuesta local
const SMALLTALK_RX = /^(hola|buenas|hey|hi|hello|gracias|grasias|thanks|adios|adiós|chao|chau|hasta luego|ok|vale|perfecto|genial|👍|👌)[\s!.¡¿?]*$/i;
const smalltalkReply = (text: string): string | null => {
  const t = text.trim();
  if (!SMALLTALK_RX.test(t)) return null;
  if (/gracias|grasias|thanks/i.test(t)) return "¡A ti! Si necesitas algo más, dímelo.";
  if (/adios|adiós|chao|chau|hasta luego/i.test(t)) return "¡Hasta pronto! 👋";
  if (/^(ok|vale|perfecto|genial|👍|👌)/i.test(t)) return "👍";
  return "¡Hola! ¿Qué buscas en Alicante hoy? Playa, comer, cine, transporte…";
};

// === FAQ MATCHER (BD) ===
// Carga FAQs activas y elige la primera cuya lista de keywords (TODAS) y any_of (AL MENOS UNA, si hay) coinciden.
type FaqRow = {
  id: string;
  keywords: string[];
  any_of: string[];
  response: string;
  route: string | null;
  priority: number;
};

// Coincidencia por palabra completa (no substring) para que "tomar" no
// dispare "mar", "cena" no dispare "cenar mal", etc.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (text: string, needle: string): boolean => {
  if (!needle) return false;
  // Si el término ya contiene espacios, basta con substring (frase).
  if (/\s/.test(needle)) return text.includes(needle);
  return new RegExp(`(?:^|[^a-z0-9ñ])${escapeRegex(needle)}(?:[^a-z0-9ñ]|$)`).test(text);
};

const matchFaq = (text: string, faqs: FaqRow[]): FaqRow | null => {
  for (const f of faqs) {
    const allOk = (f.keywords ?? []).every((k) => hasWord(text, normalizeText(k)));
    if (!allOk) continue;
    const anyList = (f.any_of ?? []).map(normalizeText).filter(Boolean);
    const anyOk = anyList.length === 0 || anyList.some((k) => hasWord(text, k));
    if (!anyOk) continue;
    return f;
  }
  return null;
};

type AdminClient = { from: (table: string) => any };

const logUnknown = async (db: AdminClient, rawQuery: string, normalized: string, path: string) => {
  try {
    const { data: existing } = await db
      .from("agente_unknown_queries")
      .select("id, count")
      .eq("normalized", normalized)
      .maybeSingle();
    if (existing) {
      await db
        .from("agente_unknown_queries")
        .update({ count: existing.count + 1, last_seen_at: new Date().toISOString(), path })
        .eq("id", existing.id);
    } else {
      await db
        .from("agente_unknown_queries")
        .insert({ query: rawQuery.slice(0, 500), normalized: normalized.slice(0, 500), path });
    }
  } catch {
    // No bloqueamos la respuesta por un fallo de log.
  }
};

const bumpFaqHits = async (db: AdminClient, id: string) => {
  try {
    const { data } = await db.from("agente_faqs").select("hits").eq("id", id).maybeSingle();
    if (data) {
      await db.from("agente_faqs").update({ hits: (data.hits ?? 0) + 1 }).eq("id", id);
    }
  } catch {
    // ignore
  }
};


// === BD de nombres propios (cache in-memory por instancia) ===
type ProperNounRow = {
  name: string;
  normalized: string;
  aliases: string[] | null;
  category: string;
  route: string;
  priority: number;
};
let _properNounsCache: { at: number; rows: ProperNounRow[] } | null = null;
const PROPER_NOUNS_TTL_MS = 5 * 60 * 1000;

const loadProperNouns = async (db: AdminClient): Promise<ProperNounRow[]> => {
  const now = Date.now();
  if (_properNounsCache && now - _properNounsCache.at < PROPER_NOUNS_TTL_MS) {
    return _properNounsCache.rows;
  }
  const { data } = await db
    .from("agente_proper_nouns")
    .select("name, normalized, aliases, category, route, priority")
    .eq("active", true)
    .order("priority", { ascending: true });
  const rows = (data ?? []) as ProperNounRow[];
  _properNounsCache = { at: now, rows };
  return rows;
};

// Palabras genéricas que NO deben usarse como token distintivo de un nombre propio
// (evita falsos positivos del tipo "hotel" → primer hotel de la lista).
const PROPER_NOUN_STOPWORDS = new Set([
  "a","al","ante","bajo","con","contra","de","del","desde","en","entre","hacia","hasta","la","las","el","los","lo","y","o","u","por","para","segun","sin","sobre","tras","un","una","unos","unas","the","of","by","and","or",
  "hotel","hoteles","hostal","hostales","apartamento","apartamentos","apartahotel","resort","spa","suites","suite","affiliated",
  "restaurante","restaurantes","bar","bares","cafeteria","cafe","cafetería","pub","pubs","brewery","cerveceria","cervecería","taberna","tasca","pizzeria","pizzería","marisqueria","marisquería","arroceria","arrocería",
  "vuelos","vuelo","destino","aerolinea","aerolínea","compania","compañia","compañía",
  "alicante","elche","santa","san","santo","sant","playa","calle","avenida","plaza","centro","ciudad","alacant",
  "cine","cines","teatro","teatros","sala","farmacia","farmacias","hospital","hospitales",
]);

const matchProperNoun = (
  normalizedText: string,
  rows: ProperNounRow[],
  currentPath: string,
): { path: string; reason: string; name: string } | null => {
  if (!normalizedText) return null;
  let best: { path: string; reason: string; name: string; len: number; prio: number } | null = null;
  for (const r of rows) {
    // Candidatos: el nombre normalizado completo, cada alias, y además los tokens
    // distintivos del nombre (palabra ≥4 chars que no esté en stopwords). Esto
    // permite que "Meliá" matchee "Meliá Alicante" sin necesidad de añadir alias.
    const baseCandidates = [r.normalized, ...(r.aliases ?? [])].filter((s) => s && s.length >= 3);
    const distinctiveTokens = (r.normalized || "")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 4 && !PROPER_NOUN_STOPWORDS.has(t));
    const candidates = Array.from(new Set([...baseCandidates, ...distinctiveTokens]));
    for (const cand of candidates) {
      const c = cand.trim();
      if (!c) continue;
      // Match por palabra completa (límites) o substring si tiene espacios (nombre compuesto)
      const matched = c.includes(" ")
        ? normalizedText.includes(c)
        : new RegExp(`(^|\\s)${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|\\s)`).test(normalizedText);
      if (!matched) continue;
      if (r.route === currentPath) continue; // ya estamos allí
      const score = c.length;
      if (
        !best ||
        r.priority < best.prio ||
        (r.priority === best.prio && score > best.len)
      ) {
        best = { path: r.route, reason: `nombre propio (${r.category}): ${r.name}`, name: r.name, len: score, prio: r.priority };
      }
    }
  }
  return best ? { path: best.path, reason: best.reason, name: best.name } : null;
};

// Intención "tomar algo" — reenvía al chat principal para que renderice el
// Dashboard Nocturno inline (no existe ruta /tomar-algo dedicada).
const DRINKS_INTENT_RE = /\b(tomar algo|beber|copa|copas|coctel|cóctel|cocktail|cocteleria|coctelería|cerveza|cervezas|cerveceria|cervecería|brewery|vermut|vermouth|gin tonic|gintonic|vino|vinos|vinoteca|wine bar|pub|pubs|discoteca|discotecas|disco|night ?club|nightclub|club nocturno|rooftop|terraceo|sala de fiestas|karaoke|karaokes|bar de copas|chupito|chupitos|afterwork|sunset bar)\b/i;

// === Intenciones de comida ===
// Cada categoría tiene su Dashboard inline en ChatScreen. Reenviamos al chat
// principal con el prompt canónico que dispara la regex correspondiente.
// "Comida rápida" general y "Comer" general abren submenús (no Dashboard directo).
type FoodIntent = {
  test: RegExp;
  forwardPrompt?: string;
  openSubmenu?: "comer" | "comer.comida-rapida";
  blurb: string;
};
const FOOD_INTENTS: FoodIntent[] = [
  // Específicos de comida rápida (Dashboard concreto)
  { test: /\b(hamburgues\w*|burger\w*|smash ?burger\w*|mcdonald\w*|burger king|goiko|five guys|tgb)\b/i, forwardPrompt: "Una buena hamburguesería abierta ahora (McDonald's, Burger King, TGB, Goiko, Five Guys…)", blurb: "Abro el Dashboard de hamburgueserías." },
  { test: /\b(montaditos?|100 montaditos|lizarr[aá]n)\b/i, forwardPrompt: "Un sitio de montaditos abierto ahora (100 Montaditos, Lizarrán…)", blurb: "Abro el Dashboard de montaditos." },
  { test: /\b(kebaps?|kebab|d[oö]ner|shawarma)\b/i, forwardPrompt: "Un buen kebap abierto ahora", blurb: "Abro el Dashboard de kebaps." },
  { test: /\b(kfc|popeyes|pollo frito|pollos asados|poller[ií]a)\b/i, forwardPrompt: "Un sitio de pollo frito o pollos asados abierto ahora (KFC, Popeyes…)", blurb: "Abro el Dashboard de pollo frito." },
  { test: /\b(taco bell|tacos?|burritos?|tex.?mex|taquer[ií]a|mexican[oa]s?)\b/i, forwardPrompt: "Un mexicano abierto ahora (Taco Bell, tacos, burritos…)", blurb: "Abro el Dashboard mexicano." },
  { test: /\b(telepizza|domino'?s|papa john'?s?|pizza hut|pizza m[oó]vil|pizza a domicilio|pizzer[ií]a r[aá]pida|pizza r[aá]pida)\b/i, forwardPrompt: "Una pizzería abierta ahora (Telepizza, Domino's…)", blurb: "Abro el Dashboard de pizzas rápidas." },
  // Submenú de comida rápida (general)
  { test: /\b(comida r[aá]pida|fast ?food|comida basura)\b/i, openSubmenu: "comer.comida-rapida", blurb: "Abro el submenú de Comida rápida: hamburguesas, pizzas, montaditos, kebaps, pollo frito o mexicano." },
  // Categorías con Dashboard propio
  { test: /\b(cocina t[ií]pica|alicantin[oa]s?|tradicional|tasca|cocina espa[ñn]ola|tapas tradicionales|mediterr[aá]ne[oa])\b/i, forwardPrompt: "Recomiéndame un sitio de cocina típica alicantina tradicional abierto ahora", blurb: "Abro el Dashboard de cocina típica alicantina." },
  { test: /\b(arroz|arroces|arrocer[ií]a|paella|pescado|pescados|marisco|mariscos|marisquer[ií]a|seafood)\b/i, forwardPrompt: "Quiero un buen arroz, paella o pescado fresco, ¿dónde voy ahora?", blurb: "Abro el Dashboard de arroces y pescado." },
  { test: /\b(italian[oa]s?|pasta|trattoria|ristorante|pizzer[ií]a|pizza)\b/i, forwardPrompt: "Apetece italiano (pizza, pasta), ¿dónde puedo ir ahora?", blurb: "Abro el Dashboard italiano." },
  { test: /\b(japon[eé]s|japonesa|sushi|ramen|asi[aá]tic[oa]s?|chin[oa]s?|thai|tailand|vietnam|coreano|korean|wok|noodle)\b/i, forwardPrompt: "Un japonés o asiático rico abierto ahora", blurb: "Abro el Dashboard japonés / asiático." },
  { test: /\b(vegano[as]?|vegan[a]?|vegetarian[oa]s?|saludable|healthy|poke|veggie|plant[\s-]?based)\b/i, forwardPrompt: "Un sitio vegano o saludable abierto ahora", blurb: "Abro el Dashboard vegano / saludable." },
  { test: /\b(brunch|desayun[oa]s?|breakfast|tortitas|pancakes|waffles?|gofres?|huevos benedictinos|eggs benedict|cruasanes?|croissants?|boller[ií]a)\b/i, forwardPrompt: "Necesito un buen desayuno o brunch en Alicante abierto ahora", blurb: "Abro el Dashboard de desayuno / brunch." },
  { test: /\b(postres?|helader[ií]as?|helados?|gelater[ií]as?|pasteler[ií]as?|chocolater[ií]as?|crepes?|cr[eê]pes?|tartas?|reposter[ií]a|dulces?|cafeter[ií]a con postres)\b/i, forwardPrompt: "Una cafetería con postres ricos abierta ahora", blurb: "Abro el Dashboard de postres y cafetería." },
  { test: /\b(barato|baratos?|baratit[oa]s?|econ[oó]mic[oa]s?|low cost|men[uú] del d[ií]a|men[uú] diario|comer barato|sin gastar)\b/i, forwardPrompt: "Algo barato y rico para comer ya, abierto ahora", blurb: "Abro el Dashboard low cost." },
  { test: /\b(internacional|hind[uú]e?s?|hindi|indi[oa]s?|india|libanes[ae]?|libano|[áa]rabe|peruan[oa]s?|peru|latino[as]?|latinoameric[oa]n[oa]s?|venezolan[oa]s?|colombian[oa]s?|argentin[oa]s?|cuban[oa]s?|brasil|marroqu[ií]|griego|griega|turco)\b/i, forwardPrompt: "Quiero comida internacional (hindú, libanés, peruano, mexicano, latino, árabe…), ¿dónde voy ahora?", blurb: "Abro el Dashboard internacional." },
  // Intento genérico "Comer" — SIEMPRE el último para que los específicos ganen
  { test: /\b(comer|cenar|cena|almorzar|almuerzo|comida|restaurante|restaurantes|hambre|tengo hambre|me apetece comer|qu[eé] comemos|qu[eé] cenamos)\b/i, openSubmenu: "comer", blurb: "Abro el submenú Comer: dime qué te apetece (cocina típica, arroces, italiano, japonés, vegano, brunch, postres, comida rápida, barato o internacional)." },
];

// === Stopwords genéricas (ES) para extracción de keywords aprendidas ===
const LEARN_STOPWORDS = new Set<string>([
  ...PROPER_NOUN_STOPWORDS,
  "que","cual","cuales","como","donde","cuando","cuanto","cuanta","cuantos","cuantas","quien","quienes",
  "me","mi","mis","tu","tus","su","sus","nos","nuestro","nuestra","te","se","le","les",
  "ya","aqui","alli","ahi","hoy","ahora","manana","tarde","noche","dia","dias","semana","mes",
  "quiero","quisiera","necesito","busco","buscar","ver","ir","hacer","tomar","comer","beber","comprar","saber","decir",
  "puedo","puede","podria","sabes","dime","dame","dale","abre","abrir","muestra","mostrar",
  "hay","esta","estan","ser","estar","tener","va","van","voy","vamos","si","no","tambien","pero","con","sin",
  "muy","mas","menos","mucho","poco","algo","alguno","alguna","todo","toda","nada","favor","gracias","hola",
  "porfavor","please","entre","sobre","hasta","desde","cerca","lejos","mejor","peor","bueno","buena",
]);

const extractKeywords = (normalized: string): string[] => {
  return Array.from(
    new Set(
      normalized
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3 && !LEARN_STOPWORDS.has(t))
    )
  ).slice(0, 10);
};

// Maximizado: el agente aprende al primer paso por Gemini (sin esperar repeticiones).
const PROMOTION_THRESHOLD = 1;

// Match determinista contra agente_intents aprendidos (sin Gemini).
// Maximizado: acepta coincidencia total O mayoría (hits ≥ max(2, ceil(n/2))),
// devolviendo el intent con mayor score relativo (hits/total).
const matchLearnedIntent = async (
  db: AdminClient,
  normalized: string,
  currentPath: string,
): Promise<{ id: string; reply: string; route: string | null; key: string } | null> => {
  try {
    const { data } = await db
      .from("agente_intents")
      .select("id, key, spoken_reply, route, keywords, priority")
      .eq("active", true)
      .order("priority", { ascending: true })
      .limit(1000);
    const rows = (data ?? []) as Array<{ id: string; key: string; spoken_reply: string; route: string | null; keywords: string[] }>;
    let best: { id: string; reply: string; route: string | null; key: string; score: number } | null = null;
    for (const r of rows) {
      const kws = (r.keywords ?? []).map(normalizeText).filter(Boolean);
      if (kws.length === 0) continue;
      const hits = kws.filter((k) => hasWord(normalized, k)).length;
      if (hits === 0) continue;
      const needed = Math.max(2, Math.ceil(kws.length / 2));
      const passes = hits === kws.length || hits >= needed;
      if (!passes) continue;
      if (r.route && r.route === currentPath) continue;
      const score = hits / kws.length;
      if (!best || score > best.score) {
        best = { id: r.id, reply: r.spoken_reply, route: r.route, key: r.key, score };
      }
    }
    if (best) {
      const { score: _s, ...rest } = best;
      return rest;
    }
  } catch (e) {
    console.warn("matchLearnedIntent failed", e);
  }
  return null;
};

// Promueve una entrada de caché a agente_intents cuando se repite ≥ threshold.
const promoteToIntent = async (
  db: AdminClient,
  normalized: string,
  reply: string,
  navigate: string | null,
  hits: number,
) => {
  if (hits < PROMOTION_THRESHOLD) return;
  const keywords = extractKeywords(normalized);
  if (keywords.length === 0) return;
  const key = `learned:${normalized.slice(0, 60).replace(/\s+/g, "_")}`;
  try {
    const { data: existing } = await db
      .from("agente_intents")
      .select("id")
      .eq("key", key)
      .maybeSingle();
    if (existing) {
      await db
        .from("agente_intents")
        .update({ spoken_reply: reply, route: navigate, keywords, active: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await db.from("agente_intents").insert({
        key,
        label: `Aprendido: ${normalized.slice(0, 80)}`,
        spoken_reply: reply,
        route: navigate,
        keywords,
        priority: 50,
        active: true,
        notes: `Auto-promovido tras ${hits} repeticiones (origen: caché LLM).`,
      });
    }
  } catch (e) {
    console.warn("promoteToIntent failed", e);
  }
};

export const agenteVamosChat = createServerFn({ method: "POST" })
  .inputValidator((d: { messages: Array<{ role: "user" | "assistant"; content: string }>; path?: string; disableLLM?: boolean }) => d)
  .handler(async ({ data }) => {
    const lastUserMessage = [...data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const currentPath = data.path ?? "/";
    const disableLLM = data.disableLLM === true;
    const normalized = normalizeText(lastUserMessage);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Registramos siempre para auto-aprendizaje (sin bloquear).
    void logUnknown(supabaseAdmin, lastUserMessage, normalized, currentPath);

    // 0a) INTENT APRENDIDO — coincidencia por keywords contra agente_intents.
    // Es la capa más generalizable: una misma intención puede expresarse de
    // muchas formas, pero comparte tokens distintivos. Cero llamadas a Gemini.
    const learned = await matchLearnedIntent(supabaseAdmin, normalized, currentPath);
    if (learned) {
      return {
        ok: true as const,
        content: learned.reply,
        navigate: learned.route,
        forwardPrompt: undefined,
        source: "intent" as const,
      };
    }

    // 0b) CACHÉ APRENDIDA — coincidencia exacta por (normalized, path).
    try {
      const { data: cached } = await supabaseAdmin
        .from("agente_llm_cache")
        .select("id, reply, navigate, forward_prompt, hits")
        .eq("normalized", normalized)
        .eq("path", currentPath)
        .eq("active", true)
        .maybeSingle();
      if (cached?.reply) {
        const newHits = (cached.hits ?? 0) + 1;
        void supabaseAdmin
          .from("agente_llm_cache")
          .update({ hits: newHits, last_used_at: new Date().toISOString() })
          .eq("id", cached.id);
        // Auto-promoción a intent cuando la consulta se repite ≥3 veces.
        void promoteToIntent(supabaseAdmin, normalized, cached.reply, cached.navigate ?? null, newHits);
        return {
          ok: true as const,
          content: cached.reply,
          navigate: cached.navigate ?? null,
          forwardPrompt: cached.forward_prompt ?? undefined,
          source: "cache" as const,
        };
      }
    } catch (e) {
      console.warn("agente_llm_cache lookup failed", e);
    }

    if (disableLLM) {
      return {
        ok: false as const,
        content: "",
        navigate: null,
        source: "llm_disabled" as const,
      };
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ok: false as const,
        content: "",
        navigate: null,
        source: "no_api_key" as const,
      };
    }

    const model = "google/gemini-2.5-flash";
    const history = data.messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "system",
            content: `Ruta actual del usuario: ${currentPath}.
Responde SIEMPRE en JSON estricto con la forma: {"reply": string breve para decir en voz alta (1-2 frases naturales), "navigate": string|null (ruta a la que llevar al usuario, o null), "forwardPrompt": string|null (prompt que el chat principal debe procesar al llegar, o null)}.
Aplica la doctrina: si enrutas a una categoría, enumera en "reply" SOLO las ramas reales del selector de esa pantalla. Nunca mezcles categorías ajenas al tema activo. No inventes opciones. No te inventes rutas: usa solo las del SYSTEM_PROMPT.`,
          },
          ...history,
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("agenteVamosChat LLM error", res.status, errText);
      return {
        ok: false as const,
        content: "",
        navigate: null,
        source: "llm_error" as const,
        status: res.status,
      };
    }

    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";

    const persistCache = (reply: string, navigate: string | null, forwardPrompt: string | null) => {
      if (!reply) return;
      void supabaseAdmin
        .from("agente_llm_cache")
        .upsert(
          {
            normalized,
            path: currentPath,
            raw_query: lastUserMessage.slice(0, 500),
            reply,
            navigate,
            forward_prompt: forwardPrompt,
            model,
            hits: 1,
            last_used_at: new Date().toISOString(),
            active: true,
          },
          { onConflict: "normalized,path" }
        );
    };

    try {
      const parsed = JSON.parse(raw) as { reply?: string; navigate?: string | null; forwardPrompt?: string | null };
      const reply = parsed.reply ?? "";
      const navigate = parsed.navigate ?? null;
      const forwardPrompt = parsed.forwardPrompt ?? null;
      persistCache(reply, navigate, forwardPrompt);
      return {
        ok: true as const,
        content: reply,
        navigate,
        forwardPrompt: forwardPrompt ?? undefined,
        source: "llm" as const,
      };
    } catch {
      const reply = raw.trim();
      persistCache(reply, null, null);
      return {
        ok: true as const,
        content: reply,
        navigate: null,
        source: "llm" as const,
      };
    }
  });




