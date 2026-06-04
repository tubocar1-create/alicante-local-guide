import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AlsaStop = {
  time: string;          // "HH:MM" o "HH:MM-HH:MM"
  name: string;
  province: string;      // "Alicante", "Albacete", "Madrid", …
  kind: "origen" | "recogida" | "intermedia" | "destino";
};

export type AlsaScheduleItem = {
  id: number;
  service_date: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  origin_station: string;
  destination_station: string;
  bus_type: string | null;
  observations: string[];           // notas libres (no parseables como parada)
  stops: AlsaStop[];                // itinerario normalizado (incluye origen+destino)
  badge: string | null;             // p.ej. "Más rápido", "Más barato"
};

export type AlsaScheduleResponse = {
  items: AlsaScheduleItem[];
  generatedAt: string | null;
};

const Input = z.object({
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  direction: z.enum(["S", "L"]),
});

// ────────── Normalización del campo JSONB `observations` ──────────

type RawStopObj = { name?: string; stop?: string; time?: string; province?: string; city?: string; type?: string };

function hhmm(t: string | undefined): string {
  if (!t) return "";
  return t.length >= 5 ? t.slice(0, 5) : t;
}

function classifyType(type: string | undefined): "origen" | "destino" | "intermedia" {
  const t = (type ?? "").toLowerCase();
  if (t.includes("salida")) return "origen";
  if (t.includes("llegada")) return "destino";
  return "intermedia";
}

// Mapeo blando ruta → provincia de las terminales (para fallback)
function terminalProvince(slug: string, station: string): string {
  const s = station.toLowerCase();
  if (s.includes("madrid") || s.includes("barajas")) return "Madrid";
  if (s.includes("alicante")) return "Alicante";
  if (s.includes("benidorm")) return "Alicante";
  if (s.includes("valencia")) return "Valencia";
  if (s.includes("murcia")) return "Murcia";
  if (s.includes("barcelona")) return "Barcelona";
  if (s.includes("málaga") || s.includes("malaga")) return "Málaga";
  if (s.includes("granada")) return "Granada";
  if (s.includes("almería") || s.includes("almeria")) return "Almería";
  // Fallback: extraer la segunda terminal del slug "alicante-madrid"
  const parts = slug.split("-");
  const other = parts[parts.length - 1];
  return other ? other.charAt(0).toUpperCase() + other.slice(1) : "";
}

function normalizeStops(
  raw: unknown,
  origin_station: string,
  destination_station: string,
  departure_time: string,
  arrival_time: string,
  route_slug: string,
  direction: "S" | "L",
): { stops: AlsaStop[]; notes: string[]; badge: string | null } {
  const notes: string[] = [];
  let badge: string | null = null;
  let raw_stops: RawStopObj[] = [];

  // Forma A: array
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        // Patrón "Para en X a las HH:MM"
        const m = item.match(/Para en (.+?) a las (\d{1,2}:\d{2})/i);
        if (m) {
          raw_stops.push({ name: m[1].trim(), time: m[2] });
        } else {
          notes.push(item);
        }
      } else if (item && typeof item === "object") {
        raw_stops.push(item as RawStopObj);
      }
    }
  }
  // Forma B: objeto {stops|itinerary, badge}
  else if (raw && typeof raw === "object") {
    const obj = raw as { stops?: unknown; itinerary?: unknown; badge?: unknown };
    if (typeof obj.badge === "string") badge = obj.badge;
    const arr = (Array.isArray(obj.stops) ? obj.stops : Array.isArray(obj.itinerary) ? obj.itinerary : []) as RawStopObj[];
    raw_stops = arr.filter((x) => x && typeof x === "object");
  }

  // Origen siempre primero (de origin_station)
  const stops: AlsaStop[] = [];
  const originProv = terminalProvince(route_slug, origin_station);
  const destProv = terminalProvince(route_slug, destination_station);

  stops.push({
    time: hhmm(departure_time),
    name: origin_station,
    province: originProv,
    kind: "origen",
  });

  // Intermedias
  for (const s of raw_stops) {
    const name = (s.name ?? s.stop ?? "").trim();
    const time = hhmm(s.time);
    if (!name || !time) continue;
    const kind = classifyType(s.type);
    // Si el raw ya marca salida/llegada y coincide con terminal, lo saltamos (lo añade el origen/destino)
    if (kind === "origen") continue;
    if (kind === "destino") continue;
    const province = (s.province ?? s.city ?? "").trim();
    stops.push({
      time,
      name,
      province: province || terminalProvince(route_slug, name),
      kind: "intermedia",
    });
  }

  // Destino al final
  stops.push({
    time: hhmm(arrival_time),
    name: destination_station,
    province: destProv,
    kind: "destino",
  });

  // Dedupe por (time|name)
  const seen = new Set<string>();
  const out: AlsaStop[] = [];
  for (const s of stops) {
    const key = `${s.time}|${s.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }

  // Marcar primera parada intermedia que coincide en ciudad con el origen como "recogida"
  // (para la ida desde Alicante: la primera parada dentro de provincia Alicante es recogida)
  const isIda = direction === "S";
  const refProv = isIda ? originProv : destProv;
  let firstIntermediateIdx = -1;
  for (let i = 1; i < out.length - 1; i++) {
    if (out[i].kind === "intermedia") { firstIntermediateIdx = i; break; }
  }
  if (firstIntermediateIdx > 0 && out[firstIntermediateIdx].province === refProv) {
    out[firstIntermediateIdx] = { ...out[firstIntermediateIdx], kind: "recogida" };
  }

  return { stops: out, notes, badge };
}

function mapRow(r: {
  id: number;
  service_date: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number;
  origin_station: string;
  destination_station: string;
  bus_type: string | null;
  observations: unknown;
  route_slug: string;
  direction: "S" | "L";
}): AlsaScheduleItem & { route_slug: string; direction: "S" | "L" } {
  const { stops, notes, badge } = normalizeStops(
    r.observations,
    r.origin_station,
    r.destination_station,
    r.departure_time,
    r.arrival_time,
    r.route_slug,
    r.direction,
  );
  return {
    id: r.id,
    service_date: r.service_date,
    departure_time: r.departure_time,
    arrival_time: r.arrival_time,
    duration_minutes: r.duration_minutes,
    origin_station: r.origin_station,
    destination_station: r.destination_station,
    bus_type: r.bus_type ?? null,
    observations: notes,
    stops,
    badge,
    route_slug: r.route_slug,
    direction: r.direction,
  };
}

export const getAlsaSchedule = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<AlsaScheduleResponse> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    const today = fmt.format(new Date());

    const { data: rows, error } = await supabaseAdmin
      .from("alsa_schedules")
      .select("id, service_date, departure_time, arrival_time, duration_minutes, origin_station, destination_station, bus_type, observations, route_slug, direction, created_at")
      .eq("route_slug", data.slug)
      .eq("direction", data.direction)
      .gte("service_date", today)
      .order("service_date", { ascending: true })
      .order("departure_time", { ascending: true })
      .limit(2000);

    if (error) throw new Error(error.message);

    const items = (rows ?? []).map((r) => mapRow({
      id: r.id as number,
      service_date: r.service_date as string,
      departure_time: r.departure_time as string,
      arrival_time: r.arrival_time as string,
      duration_minutes: r.duration_minutes as number,
      origin_station: r.origin_station as string,
      destination_station: r.destination_station as string,
      bus_type: (r.bus_type as string | null) ?? null,
      observations: r.observations as unknown,
      route_slug: r.route_slug as string,
      direction: r.direction as "S" | "L",
    }));

    const generatedAt = (rows?.[0]?.created_at as string | undefined) ?? null;
    return { items, generatedAt };
  });

const ItemInput = z.object({ id: z.number().int().positive() });

export const getAlsaScheduleItem = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => ItemInput.parse(data))
  .handler(async ({ data }): Promise<(AlsaScheduleItem & { route_slug: string; direction: "S" | "L" }) | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r, error } = await supabaseAdmin
      .from("alsa_schedules")
      .select("id, service_date, departure_time, arrival_time, duration_minutes, origin_station, destination_station, bus_type, observations, route_slug, direction")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) return null;
    return mapRow({
      id: r.id as number,
      service_date: r.service_date as string,
      departure_time: r.departure_time as string,
      arrival_time: r.arrival_time as string,
      duration_minutes: r.duration_minutes as number,
      origin_station: r.origin_station as string,
      destination_station: r.destination_station as string,
      bus_type: (r.bus_type as string | null) ?? null,
      observations: r.observations as unknown,
      route_slug: r.route_slug as string,
      direction: r.direction as "S" | "L",
    });
  });
