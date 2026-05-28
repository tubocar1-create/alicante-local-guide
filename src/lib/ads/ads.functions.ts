import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ADVERTISERS, getAdvertiser, type Advertiser } from "./advertisers";
import {
  fetchAlicanteParkings,
  fetchAlicanteTraffic,
  fetchAlicanteAirQuality,
  fetchAlicanteAgenda,
  fetchAlicanteAirTraffic,
  fetchRenfeAlicanteSchedule,
  fetchAenaDisruptions,
  fetchAenaTomorrowDepartures,
  fetchAlibusAlicante,
  fetchAlicantePressHeadlines,
  fetchAlicantePressDirect,
  fetchAlicanteIncidencias,
  type CulturalEvent,
} from "./alicante-city.server";
import {
  fetchTeatroPrincipalAgenda,
  fetchPlazaTorosAgenda,
  fetchMercadillosHoy,
  fetchAddaAgenda,
  fetchStereoAgenda,
  fetchSalaOneAgenda,
  fetchMuelleLiveAgenda,
  fetchSpringAgenda,
  fetchRabasaAgenda,
  fetchRocanrolaAgenda,
  fetchSongkickAlicante,
  type RegionalEvent,
} from "./regional-agendas.server";

export type AdCopy = {
  headline: string; // 4-7 palabras
  body: string; // 1 frase, máx 110 chars
  cta: string; // 2-3 palabras
};

export type AdVariantsResponse = {
  advertiser: {
    id: string;
    name: string;
    ctaUrl: string;
    theme: Advertiser["theme"];
  };
  variants: AdCopy[];
  error?: string;
};

const FALLBACK: Record<string, AdCopy[]> = {
  "clima-alicante": [
    {
      headline: "Buen día para pasear",
      body: "Cielo amable en Alicante. Aprovecha el rato para callejear por el casco antiguo.",
      cta: "Ver tiempo",
    },
    {
      headline: "Hidrátate, que aprieta",
      body: "El sol mediterráneo no avisa: lleva agua y crema, sobre todo si vas a la playa.",
      cta: "Ver tiempo",
    },
  ],
  "mar-alicante": [
    {
      headline: "Mar tranquilo en el Postiguet",
      body: "Buen día para un baño rápido o pasear por el paseo marítimo.",
      cta: "Ver mar",
    },
    {
      headline: "Levante en la costa",
      body: "El mar viene movido. Cuidado si vas con peques o paddle surf.",
      cta: "Ver mar",
    },
  ],
  "info-alicante": [
    {
      headline: "El Castillo de Santa Bárbara",
      body: "Está sobre el monte Benacantil y se ve la silueta de la 'Cara del Moro' desde el puerto.",
      cta: "Saber más",
    },
    {
      headline: "TRAM hasta El Campello",
      body: "La L1 te lleva por la costa con vistas; ideal para escaparte sin coche.",
      cta: "Saber más",
    },
    {
      headline: "Hogueras: junio en llamas",
      body: "Del 20 al 24 la ciudad arde de fiesta. Si vienes esos días, reserva con tiempo.",
      cta: "Saber más",
    },
  ],
};

const ALC_LAT = 38.3452;
const ALC_LON = -0.481;

type Weather = {
  tempC: number;
  feelsC: number;
  windKmh: number;
  precipMm: number;
  code: number;
  isDay: boolean;
};

async function fetchAlicanteWeather(): Promise<Weather | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${ALC_LAT}&longitude=${ALC_LON}&current=temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day&timezone=Europe%2FMadrid`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j?.current;
    if (!c) return null;
    return {
      tempC: Math.round(c.temperature_2m),
      feelsC: Math.round(c.apparent_temperature),
      windKmh: Math.round(c.wind_speed_10m),
      precipMm: Number(c.precipitation ?? 0),
      code: Number(c.weather_code ?? 0),
      isDay: Number(c.is_day) === 1,
    };
  } catch {
    return null;
  }
}

type SunTimes = { sunrise: string; sunset: string };
async function fetchSunTimes(): Promise<SunTimes | null> {
  try {
    const url = `https://api.sunrise-sunset.org/json?lat=${ALC_LAT}&lng=${ALC_LON}&formatted=0`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    if (j?.status !== "OK") return null;
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Madrid",
      });
    return { sunrise: fmt(j.results.sunrise), sunset: fmt(j.results.sunset) };
  } catch {
    return null;
  }
}

type Marine = { seaTempC: number; waveM: number; wavePeriodS: number };
async function fetchMarine(): Promise<Marine | null> {
  try {
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${ALC_LAT}&longitude=${ALC_LON}&current=wave_height,wave_period,sea_surface_temperature&timezone=Europe%2FMadrid`;
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = await r.json();
    const c = j?.current;
    if (!c) return null;
    return {
      seaTempC: Math.round(Number(c.sea_surface_temperature)),
      waveM: Number(Number(c.wave_height).toFixed(1)),
      wavePeriodS: Math.round(Number(c.wave_period)),
    };
  } catch {
    return null;
  }
}

const WIKI_TOPICS = [
  "Alicante",
  "Castillo_de_Santa_Bárbara",
  "Hogueras_de_San_Juan",
  "Explanada_de_España",
  "Barrio_de_Santa_Cruz_(Alicante)",
  "Playa_del_Postiguet",
  "Mercado_Central_de_Alicante",
  "Isla_de_Tabarca",
  "Basílica_de_Santa_María_(Alicante)",
  "Concatedral_de_San_Nicolás_de_Bari_(Alicante)",
  "MARQ_(Alicante)",
  "Tranvía_Metropolitano_de_Alicante",
  "Puerto_de_Alicante",
  "Monte_Benacantil",
  "Gastronomía_de_la_provincia_de_Alicante",
];

type WikiSummary = { title: string; extract: string; url: string };

async function fetchRandomWikiSummary(): Promise<WikiSummary | null> {
  const topic = WIKI_TOPICS[Math.floor(Math.random() * WIKI_TOPICS.length)];
  try {
    const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
    const r = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j?.extract) return null;
    return {
      title: j.title ?? topic.replace(/_/g, " "),
      extract: String(j.extract).slice(0, 800),
      url: j?.content_urls?.desktop?.page ?? `https://es.wikipedia.org/wiki/${topic}`,
    };
  } catch {
    return null;
  }
}

function describeWmo(code: number): string {
  if (code === 0) return "despejado";
  if ([1, 2, 3].includes(code)) return "parcialmente nublado";
  if ([45, 48].includes(code)) return "niebla";
  if ([51, 53, 55, 56, 57].includes(code)) return "llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "nieve";
  if ([95, 96, 99].includes(code)) return "tormenta";
  return "variable";
}

function todayMadrid(): string {
  // YYYY-MM-DD en zona Europe/Madrid
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

async function readDailyCache(advertiserId: string): Promise<AdVariantsResponse | null> {
  try {
    const { data } = await supabaseAdmin
      .from("ad_variants_cache")
      .select("payload")
      .eq("advertiser_id", advertiserId)
      .eq("day_madrid", todayMadrid())
      .maybeSingle();
    return (data?.payload as AdVariantsResponse | undefined) ?? null;
  } catch {
    return null;
  }
}

async function writeDailyCache(advertiserId: string, payload: AdVariantsResponse) {
  try {
    await supabaseAdmin
      .from("ad_variants_cache")
      .upsert(
        {
          advertiser_id: advertiserId,
          day_madrid: todayMadrid(),
          payload: payload as never,
        },
        { onConflict: "advertiser_id,day_madrid" },
      );
  } catch (e) {
    console.error("[ads] cache write failed", e);
  }
}

export const getAdVariants = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { advertiserId: string; count?: number }) =>
      z
        .object({
          advertiserId: z.string().min(1).max(60),
          count: z.number().int().min(1).max(12).optional(),
        })
        .parse(input),
  )
  .handler(async ({ data }): Promise<AdVariantsResponse> => {
    const advertiser = getAdvertiser(data.advertiserId) ?? ADVERTISERS[0];
    const count = data.count ?? 6;

    // Caché diario: 1 generación por banner por día (zona Madrid).
    const cached = await readDailyCache(advertiser.id);
    if (cached) return cached;

    const baseResp = {
      advertiser: {
        id: advertiser.id,
        name: advertiser.name,
        ctaUrl: advertiser.ctaUrl,
        theme: advertiser.theme,
      },
    };


    let weatherCtx = "";
    if (advertiser.kind === "weather") {
      const [w, sun] = await Promise.all([fetchAlicanteWeather(), fetchSunTimes()]);
      const parts: string[] = [];
      if (w) {
        parts.push(
          `${w.tempC}°C (sensación ${w.feelsC}°C), viento ${w.windKmh} km/h, precipitación ${w.precipMm} mm, condición: ${describeWmo(w.code)}, ${w.isDay ? "de día" : "de noche"}`,
        );
      }
      if (sun) parts.push(`amanecer ${sun.sunrise}, atardecer ${sun.sunset}`);
      weatherCtx = parts.length
        ? `\n\nDATOS REALES (Alicante, ahora): ${parts.join(". ")}. Usa estos datos, no los inventes. Menciona la temperatura o la hora del sol cuando proceda.`
        : "\n\n(Sin datos en vivo: escribe consejos generales según la estación).";
    }

    let marineCtx = "";
    if (advertiser.kind === "marine") {
      const [m, sun] = await Promise.all([fetchMarine(), fetchSunTimes()]);
      const parts: string[] = [];
      if (m) parts.push(`agua ${m.seaTempC}°C, ola ${m.waveM} m, periodo ${m.wavePeriodS}s`);
      if (sun) parts.push(`atardecer ${sun.sunset}`);
      marineCtx = parts.length
        ? `\n\nDATOS REALES del mar en Alicante (Postiguet): ${parts.join(". ")}. Usa estos datos REALES. Si la ola es <0.3 m: mar plato. 0.3-0.7 m: tranquilo. 0.7-1.2 m: rizado. >1.2 m: movido. Si el agua está <18°C: fresquita; 18-22 agradable; >22 cálida.`
        : "\n\n(Sin datos marinos en vivo: escribe consejo general de playa).";
    }

    let wiki: WikiSummary | null = null;
    if (advertiser.kind === "info") {
      wiki = await fetchRandomWikiSummary();
      if (wiki) {
        baseResp.advertiser.ctaUrl = wiki.url;
      }
    }

    let parkingsCtx = "";
    if (advertiser.kind === "parkings") {
      const ps = await fetchAlicanteParkings();
      if (ps && ps.length) {
        const named = ps.filter((p) => !/^Parking\s+\d+$/i.test(p.name));
        const sorted = [...named].sort((a, b) => b.libres - a.libres);
        const lines = sorted
          .map(
            (p) =>
              `- ${p.name}: ${p.libres} libres / ${p.total} (ocupación ${p.ocupacionPct}%)`,
          )
          .join("\n");
        parkingsCtx = `\n\nDATOS REALES Ayto. Alicante (parkings públicos del centro, ahora):\n${lines}\n\nUsa estos números EXACTOS y refiérete a cada parking por su NOMBRE tal cual aparece arriba. NUNCA uses números de orden ni "Parking 1/2/3".`;
      } else {
        parkingsCtx = "\n\n(Sin datos de parkings ahora mismo).";
      }
    }

    let trafficCtx = "";
    if (advertiser.kind === "traffic") {
      const t = await fetchAlicanteTraffic();
      if (t && t.total > 0) {
        const pctFluido = Math.round((t.fluido / t.total) * 100);
        const lines = [
          `Tramos: ${t.fluido} fluidos, ${t.denso} densos, ${t.congestionado} congestionados (${t.total} total → ${pctFluido}% fluido).`,
        ];
        if (t.incidencias.length)
          lines.push(`Incidencias activas: ${t.incidencias.slice(0, 3).join("; ")}.`);
        if (t.eventos.length)
          lines.push(`Eventos de tráfico: ${t.eventos.slice(0, 3).join("; ")}.`);
        trafficCtx = `\n\nDATOS REALES Ayto. Alicante (tráfico ahora):\n${lines.join("\n")}\n\nUsa los datos REALES. Si hay incidencia o evento, menciónalo en alguna variante. Si todo va fluido, dilo con naturalidad.`;
      } else {
        trafficCtx = "\n\n(Sin datos de tráfico ahora mismo).";
      }
    }

    let airCtx = "";
    if (advertiser.kind === "air") {
      const aq = await fetchAlicanteAirQuality();
      if (aq && aq.length) {
        const lines = aq
          .map((s) => `- ${s.address}: estado ${s.status}`)
          .join("\n");
        const allGreen = aq.every((s) => s.status === "verde");
        airCtx = `\n\nDATOS REALES Ayto. Alicante (estaciones medioambientales, ahora):\n${lines}\n\nCódigo de color: verde=bueno, amarillo=aceptable, naranja=regular, rojo=malo, morado=muy malo. ${
          allGreen
            ? "Todas en verde: aire limpio."
            : "Hay diferencias entre estaciones, menciónalo."
        } Usa los datos REALES, no inventes.`;
      } else {
        airCtx = "\n\n(Sin datos de calidad del aire ahora mismo).";
      }
    }

    let agenda: CulturalEvent[] | null = null;
    let agendaCtx = "";
    if (advertiser.kind === "agenda") {
      agenda = await fetchAlicanteAgenda();
      if (agenda && agenda.length) {
        const pick = agenda.slice(0, Math.max(count, 6));
        const lines = pick
          .map(
            (e, i) =>
              `${i + 1}. "${e.title}"${e.when ? ` (${e.when})` : ""} — ${e.excerpt.slice(0, 160)}`,
          )
          .join("\n");
        agendaCtx = `\n\nEVENTOS CULTURALES REALES (agenda oficial alicante.es, ahora):\n${lines}\n\nGenera UNA variante por evento usando SOLO la información del evento (no inventes nada). Si una fecha no está, omítela.`;
      } else {
        agendaCtx = "\n\n(Sin agenda cultural disponible ahora).";
      }
    }

    let flightsCtx = "";
    if (advertiser.kind === "flights") {
      const disruptions = await fetchAenaDisruptions();
      // Si Aena falla (null) o no hay incidencias hoy → banner suspendido (sin variantes)
      if (!disruptions || disruptions.length === 0) {
        return { ...baseResp, variants: [] };
      }
      const lines = disruptions
        .map((d) => {
          const route =
            d.type === "salida"
              ? `hacia ${d.otherCity}${d.otherIata ? ` (${d.otherIata})` : ""}`
              : `desde ${d.otherCity}${d.otherIata ? ` (${d.otherIata})` : ""}`;
          if (d.status === "cancelado") {
            return `- CANCELADO ${d.type} ${d.airline} ${d.flightNumber} · ${route} · prevista ${d.scheduledTime} (${d.date})`;
          }
          return `- RETRASO +${d.delayMin} min · ${d.type} ${d.airline} ${d.flightNumber} · ${route} · prog ${d.scheduledTime} → est ${d.estimatedTime}`;
        })
        .join("\n");
      flightsCtx = `\n\nINCIDENCIAS OFICIALES Aena hoy en Alicante-Elche (ALC), salidas y llegadas:\n${lines}\n\nGenera UNA variante por incidencia. Usa SOLO estos datos.`;
    }

    // Salidas PROGRAMADAS de mañana (Aena Infovuelos)
    let flightsTomorrowCtx = "";
    if (advertiser.kind === "flights_tomorrow") {
      const flights = await fetchAenaTomorrowDepartures();
      if (!flights || flights.length === 0) {
        return { ...baseResp, variants: [] };
      }
      const lines = flights
        .map(
          (f) =>
            `- ${f.scheduledTime} · ${f.flightNumber} · ${f.airline} · → ${f.destinationCity}${f.destinationIata ? ` (${f.destinationIata})` : ""}`,
        )
        .join("\n");
      flightsTomorrowCtx = `\n\nSALIDAS PROGRAMADAS MAÑANA en Alicante-Elche (ALC), fuente oficial Aena Infovuelos:\n${lines}\n\nGenera UNA variante por vuelo. Usa SOLO estos datos, no inventes nada.`;
    }

    // Mercadillos: solo si HOY hay alguno activo. Si no, suspende.
    let mercadillosCtx = "";
    if (advertiser.kind === "mercadillos") {
      const today = await fetchMercadillosHoy();
      if (!today || today.length === 0) {
        return { ...baseResp, variants: [] };
      }
      const lines = today
        .map((m, i) => `${i + 1}. "${m.title}" — ${m.when} — ${m.excerpt}`)
        .join("\n");
      mercadillosCtx = `\n\nMERCADILLOS DEL AYTO. DE ALICANTE ACTIVOS HOY:\n${lines}\n\nGenera UNA variante por mercadillo. Usa el nombre y horario REALES.`;
    }

    // Agendas regionales: scraping según advertiser.id
    let regionalCtx = "";
    if (advertiser.kind === "regional_agenda") {
      const fetcher: Record<string, () => Promise<RegionalEvent[] | null>> = {
        "teatro-principal": fetchTeatroPrincipalAgenda,
        "plaza-toros": fetchPlazaTorosAgenda,
        "adda-alicante": fetchAddaAgenda,
        "stereo-alicante": fetchStereoAgenda,
        "sala-one": fetchSalaOneAgenda,
        "muelle-live": fetchMuelleLiveAgenda,
        "spring-alicante": fetchSpringAgenda,
        "rabasa-alicante": fetchRabasaAgenda,
        "rocanrola-alicante": fetchRocanrolaAgenda,
        "songkick-alicante": fetchSongkickAlicante,
      };
      const fn = fetcher[advertiser.id];
      const events = fn ? await fn() : null;
      if (!events || events.length === 0) {
        return { ...baseResp, variants: [] };
      }
      const pick = events.slice(0, Math.max(count, 6));
      const lines = pick
        .map(
          (e, i) =>
            `${i + 1}. "${e.title}"${e.when ? ` (${e.when})` : ""} — ${e.excerpt.slice(0, 160)}`,
        )
        .join("\n");
      regionalCtx = `\n\nEVENTOS REALES de "${advertiser.name}" (fuente: ${advertiser.ctaUrl}):\n${lines}\n\nGenera UNA variante por evento. Usa SOLO la información del listado, no inventes nada.`;
    }

    let trainsCtx = "";
    if (advertiser.kind === "trains") {
      const trips = await fetchRenfeAlicanteSchedule();
      if (trips && trips.length) {
        const llegadas = trips.filter((t) => t.direction === "llegada").slice(0, 6);
        const salidas = trips.filter((t) => t.direction === "salida").slice(0, 6);
        const fmt = (t: typeof trips[number]) =>
          `- ${t.line} ${t.trainCode} · ${t.direction === "llegada" ? `LLEGADA desde ${t.origin}` : `SALIDA hacia ${t.destination}`} · ${t.scheduledTime}`;
        trainsCtx = `\n\nHORARIO REAL Renfe Cercanías en Alicante-Terminal (próximas 3h, hora local Madrid):\nSALIDAS (trenes que SALEN de Alicante-Terminal):\n${salidas.map(fmt).join("\n") || "(ninguna)"}\n\nLLEGADAS (trenes que LLEGAN a Alicante-Terminal):\n${llegadas.map(fmt).join("\n") || "(ninguna)"}\n\nUsa SOLO estos datos. Cada variante = un tren concreto. OBLIGATORIO mezclar AMBOS sentidos: aproximadamente la mitad de las variantes deben ser SALIDAS y la otra mitad LLEGADAS (no todas llegadas). Muestra SIEMPRE la hora programada HH:MM exactamente como aparece en el listado.`;
      } else {
        trainsCtx = "\n\n(Sin horarios de Cercanías ahora mismo).";
      }
    }

    let busesCtx = "";
    if (advertiser.kind === "buses") {
      const arrivals = await fetchAlibusAlicante();
      if (arrivals && arrivals.length) {
        const fmt = (b: typeof arrivals[number]) =>
          `- Parada ${b.stop} · L${b.line}${b.destination ? ` → ${b.destination}` : ""} · en ${b.minutes} min`;
        busesCtx = `\n\nPRÓXIMAS LLEGADAS REALES de buses urbanos (Vectalia/Masatusa) en paradas céntricas de Alicante (datos AliBus, en vivo):\n${arrivals.map(fmt).join("\n")}\n\nUsa SOLO estos datos. Cada variante = una llegada concreta en una parada concreta.`;
      } else {
        busesCtx = "\n\n(Sin llegadas previstas ahora mismo en las paradas monitorizadas).";
      }
    }

    let newsCtx = "";
    if (advertiser.kind === "news") {
      const headlines = await fetchAlicantePressHeadlines();
      if (!headlines || headlines.length === 0) {
        return { ...baseResp, variants: [] };
      }
      const lines = headlines
        .map((h, i) => `${i + 1}. "${h.title}"${h.source ? ` (${h.source})` : ""}`)
        .join("\n");
      newsCtx = `\n\nTITULARES REALES de la prensa alicantina (Google News, hoy):\n${lines}\n\nGenera UNA variante por titular. Usa SOLO la información del titular; no inventes detalles ni fechas. DESCARTA cualquier titular que sea política partidista, sucesos, accidentes, fallecimientos o tragedias (si quedara alguno colado, omítelo).`;
    }

    let alicantePressCtx = "";
    if (advertiser.kind === "alicante_press") {
      const headlines = await fetchAlicantePressDirect();
      if (!headlines || headlines.length === 0) {
        return { ...baseResp, variants: [] };
      }
      // Barajar para que las variantes salgan en orden aleatorio
      const shuffled = [...headlines];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const pick = shuffled.slice(0, Math.max(count, 6));
      const lines = pick
        .map((h, i) => `${i + 1}. "${h.title}"`)
        .join("\n");
      alicantePressCtx = `\n\nTITULARES REALES de Alicante Press (alicantepress.com, scraping directo de portada):\n${lines}\n\nGenera UNA variante por titular en el MISMO orden que el listado. Usa SOLO la información del titular; no inventes detalles ni fechas. DESCARTA política partidista, sucesos, accidentes, fallecimientos o tragedias (si quedara alguno colado, omítelo).`;
    }

    let incidenciasCtx = "";
    if (advertiser.kind === "incidencias") {
      const items = await fetchAlicanteIncidencias();
      if (!items || items.length === 0) {
        return { ...baseResp, variants: [] };
      }
      const lines = items
        .slice(0, Math.max(count, 6))
        .map((i, idx) => `${idx + 1}. "${i.title}"${i.when ? ` (${i.when})` : ""}${i.description ? ` — ${i.description.slice(0, 160)}` : ""}`)
        .join("\n");
      incidenciasCtx = `\n\nINCIDENCIAS OFICIALES de movilidad.alicante.es vigentes HOY:\n${lines}\n\nGenera UNA variante por incidencia. Usa SOLO la información del listado, no inventes. Tono claro, útil, sin alarmismo.`;
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        ...baseResp,
        variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
        error: "no_api_key",
      };
    }

    let userPrompt: string;
    switch (advertiser.kind) {
      case "weather":
        userPrompt = `Genera ${count} variantes DISTINTAS de tarjeta de CLIMA para Alicante. Cada variante: headline (máx 4 palabras), body (1 frase con consejo práctico, máx 65 caracteres), cta (2-3 palabras tipo "Ver tiempo"). Tono cercano. Sin alarmismo.${weatherCtx}`;
        break;
      case "marine":
        userPrompt = `Genera ${count} variantes DISTINTAS de tarjeta de MAR Y PLAYA para Alicante. Cada variante: headline (máx 4 palabras), body (1 frase con un dato real y un consejo, máx 65 caracteres), cta (2-3 palabras tipo "Ver mar"). Tono cercano. Menciona temperatura del agua o estado del oleaje.${marineCtx}`;
        break;
      case "parkings":
        userPrompt = `Genera ${count} variantes DISTINTAS de tarjeta sobre PARKINGS del centro de Alicante. Cada variante: headline (máx 4 palabras), body (1 frase con un dato REAL del listado, máx 65 caracteres), cta (2-3 palabras tipo "Ver parkings"). SIEMPRE refiérete al parking por su NOMBRE (ej: "Alfonso El Sabio", "Plaza de América", "Mercado"). NUNCA uses números, índices ni "Parking 1/2/3". Si un parking no tiene nombre claro en los datos, no lo menciones. Incluye plazas libres o % ocupación.${parkingsCtx}`;
        break;
      case "traffic":
        userPrompt = `Genera ${count} variantes DISTINTAS de tarjeta de TRÁFICO en Alicante. Cada variante: headline (máx 4 palabras), body (1 frase con un dato real, máx 65 caracteres), cta (2-3 palabras tipo "Ver mapa"). Si hay incidencia o evento, una variante lo nombra. Si todo va fluido, dilo en positivo.${trafficCtx}`;
        break;
      case "air":
        userPrompt = `Genera ${count} variantes DISTINTAS de tarjeta sobre CALIDAD DEL AIRE en Alicante. Cada variante: headline (máx 4 palabras), body (1 frase con un dato real, máx 65 caracteres), cta (2-3 palabras tipo "Ver estaciones"). Tono cercano, útil para decidir si salir a correr, pasear con peques, etc.${airCtx}`;
        break;
      case "agenda":
        userPrompt = `Genera ${count} variantes de tarjeta de AGENDA CULTURAL en Alicante, UNA por evento del listado. Cada variante: headline (máx 4 palabras, inspirada en el título real), body (1 frase con la fecha y el qué, máx 65 caracteres), cta (2-3 palabras tipo "Ver agenda"). NO inventes nada que no esté en el listado.${agendaCtx}`;
        break;
      case "flights":
        userPrompt = `Genera ${count} variantes de tarjeta sobre INCIDENCIAS de vuelos en ALC (datos oficiales Aena). UNA variante por incidencia del listado. MÁXIMA INFORMACIÓN, MÍNIMO COMENTARIO. Sin adjetivos, sin "¡". cta "Ver vuelos".\n\n• Si CANCELADO: headline "CANCELADO [vuelo]" (ej "CANCELADO IB3567"), body "[Aerolínea] · [salida hacia / llegada desde] [ciudad] · prevista HH:MM" (máx 90 chars).\n• Si RETRASADO: headline "Retraso +[N]m [vuelo]" (ej "Retraso +45m FR1234"), body "[Aerolínea] · [hacia/desde] [ciudad] · prog HH:MM → est HH:MM" (máx 90 chars).\n\nUsa SOLO los datos del listado; no inventes.${flightsCtx}`;
        break;
      case "flights_tomorrow":
        userPrompt = `Genera ${count} variantes de tarjeta sobre SALIDAS PROGRAMADAS DE MAÑANA en Alicante-Elche (ALC, datos oficiales Aena Infovuelos). UNA variante por vuelo del listado. MÁXIMA INFORMACIÓN, MÍNIMO COMENTARIO. Sin adjetivos, sin "¡". cta "Ver vuelos".\n\nFormato: headline "Mañana HH:MM → [Ciudad]" (máx 5 palabras, ej "Mañana 07:25 → Londres"), body "[Aerolínea] · vuelo [código] · ALC → [Ciudad] ([IATA])" (máx 90 chars).\n\nUsa SOLO los datos del listado; no inventes destinos, horas ni códigos.${flightsTomorrowCtx}`;
        break;
      case "trains":
        userPrompt = `Genera ${count} variantes de tarjeta sobre TRENES de Cercanías en Alicante-Terminal. MÁXIMA INFORMACIÓN, MÍNIMO COMENTARIO. UNA variante por tren del listado (mezcla llegadas y salidas). Body formato compacto: "[Llegada/Salida] [Línea] · [desde/hacia X] · [HH:MM]" (máx 90 chars, hora exacta del listado). headline: línea + código (ej "C-1 Salida 32802") máx 4 palabras. cta "Ver horarios". NUNCA escribas "en N min", "en X minutos" ni cuentas atrás: el copy se cachea y los minutos quedan obsoletos. Usa SOLO los datos; no inventes retrasos ni andenes.${trainsCtx}`;
        break;
      case "buses":
        userPrompt = `Genera ${count} variantes de tarjeta sobre BUSES URBANOS en paradas céntricas de Alicante (datos AliBus en vivo). UNA variante por llegada del listado. headline: "L[línea] en [parada]" (ej "L02 en Luceros") máx 4 palabras. body: "Próximo bus L[línea]${"\u00A0"}→ [destino] desde parada [parada], en [N] min" (máx 95 chars). cta "Ver en mapa". Usa SOLO los datos; no inventes destinos ni minutos. Mantén el "en N min" tal cual aparece (los buses cambian cada pocos minutos y el banner se regenera con frecuencia).${busesCtx}`;
        break;
      case "mercadillos":
        userPrompt = `Genera ${count} variantes sobre MERCADILLOS de Alicante activos HOY. UNA variante por mercadillo del listado. headline (máx 4 palabras, ej "Hoy mercadillo Babel"), body (1 frase con horario y ubicación, máx 90 caracteres), cta "Ver mercados". Usa SOLO los datos; no inventes.${mercadillosCtx}`;
        break;
      case "regional_agenda":
        userPrompt = `Genera ${count} variantes de tarjeta sobre eventos de "${advertiser.name}". UNA variante por evento del listado. headline (máx 5 palabras, inspirada en el título real), body (1 frase con la fecha y el qué, máx 90 caracteres), cta "Ver agenda". NO inventes nada que no esté en el listado.${regionalCtx}`;
        break;
      case "news":
        userPrompt = `Genera ${count} variantes de tarjeta sobre TITULARES de prensa alicantina de hoy. UNA variante por titular del listado. headline (máx 5 palabras, reescritura corta y neutra del titular real, sin clickbait), body (1 frase de contexto basada SOLO en el titular, máx 95 caracteres, puede citar la fuente entre paréntesis al final), cta "Ver noticias". DESCARTA política partidista, sucesos, accidentes, muertes y tragedias. Tono informativo, sin opinión, sin signos de exclamación.${newsCtx}`;
        break;
      case "alicante_press":
        userPrompt = `Genera ${count} variantes de tarjeta sobre TITULARES de Alicante Press (alicantepress.com). UNA variante por titular del listado, en el MISMO orden que el listado. headline (máx 5 palabras, reescritura corta y neutra del titular real, sin clickbait), body (1 frase de contexto basada SOLO en el titular, máx 95 caracteres), cta "Leer noticia". DESCARTA política partidista, sucesos, accidentes, muertes y tragedias. Tono informativo, sin opinión, sin signos de exclamación.${alicantePressCtx}`;
        break;
      case "incidencias":
        userPrompt = `Genera ${count} variantes de tarjeta sobre INCIDENCIAS DE MOVILIDAD vigentes HOY en Alicante (fuente oficial movilidad.alicante.es). UNA variante por incidencia del listado. headline (máx 5 palabras, empieza por ⚠️ y resume el aviso, ej "⚠️ Corte calle San Vicente"), body (1 frase con qué pasa y, si aplica, cuándo o dónde, máx 95 caracteres), cta "Ver incidencias". Tono claro, útil, sin alarmismo. NO inventes nada que no esté en el listado.${incidenciasCtx}`;
        break;
      default:
        userPrompt = wiki
          ? `Tema REAL de Wikipedia: "${wiki.title}".\n\nResumen fuente:\n"""${wiki.extract}"""\n\nGenera ${count} variantes DISTINTAS de tarjeta INFORMATIVA basadas EXCLUSIVAMENTE en ese resumen (no inventes datos). Cada variante destaca un ángulo distinto. Cada variante: headline (máx 4 palabras), body (1 frase con un dato concreto, máx 65 caracteres), cta (2-3 palabras tipo "Saber más"). Tono cercano, sin clichés. Si un dato no está en el resumen, omítelo.`
          : `Genera ${count} variantes DISTINTAS de tarjeta INFORMATIVA sobre Alicante. Temas variados: gastronomía, Hogueras, playas, TRAM, Castillo, barrios, mercados. Cada variante: headline (máx 4 palabras), body (1 frase, máx 65 caracteres), cta (2-3 palabras tipo "Saber más"). Tono cercano.`;
    }

    try {
      const res = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content:
                  "Eres redactor en español de España. Escribes tarjetas cortas, frescas y honestas para una app local de Alicante. Nada de mayúsculas gritonas, nada de '¡!' encadenados, nada de promesas vacías.",
              },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "emit_ad_variants",
                  description: "Devuelve variantes de copy.",
                  parameters: {
                    type: "object",
                    properties: {
                      variants: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            headline: { type: "string" },
                            body: { type: "string" },
                            cta: { type: "string" },
                          },
                          required: ["headline", "body", "cta"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["variants"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "emit_ad_variants" },
            },
          }),
        },
      );

      if (!res.ok) {
        console.error("[ads] gateway error", res.status, await res.text());
        return {
          ...baseResp,
          variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
          error: `gateway_${res.status}`,
        };
      }

      const json = await res.json();
      const args =
        json?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (!args) {
        return {
          ...baseResp,
          variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
          error: "no_tool_call",
        };
      }
      const parsed = JSON.parse(args) as { variants: AdCopy[] };
      const variants = (parsed.variants ?? [])
        .filter((v) => v?.headline && v?.body && v?.cta)
        .slice(0, count);

      if (variants.length === 0) {
        return {
          ...baseResp,
          variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
          error: "empty_variants",
        };
      }

      const success = { ...baseResp, variants };
      await writeDailyCache(advertiser.id, success);
      return success;
    } catch (e) {
      console.error("[ads] error", e);
      return {
        ...baseResp,
        variants: FALLBACK[advertiser.id] ?? FALLBACK["info-alicante"],
        error: "exception",
      };
    }
  });
