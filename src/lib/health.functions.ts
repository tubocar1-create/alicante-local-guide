import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Tope duro: máximo 10 resultados por categoría
const MAX_RESULTS = 10;

export type HealthProviderDTO = {
  id: string;
  category: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  user_ratings_total: number | null;
  photos: string[];
  google_place_id: string | null;
  opening_hours: { weekdayDescriptions?: string[] } | null;
  price_level: string | null;
  notes: string | null;
  source: string;
};

function toDTO(row: Record<string, unknown>): HealthProviderDTO {
  return {
    id: row.id as string,
    category: row.category as string,
    name: row.name as string,
    address: (row.address as string) ?? null,
    phone: (row.phone as string) ?? null,
    website: (row.website as string) ?? null,
    lat: (row.lat as number) ?? null,
    lng: (row.lng as number) ?? null,
    rating: (row.rating as number) ?? null,
    user_ratings_total: (row.user_ratings_total as number) ?? null,
    photos: (row.photos as string[]) ?? [],
    google_place_id: (row.google_place_id as string) ?? null,
    opening_hours:
      (row.opening_hours as { weekdayDescriptions?: string[] }) ?? null,
    price_level: (row.price_level as string) ?? null,
    notes: (row.notes as string) ?? null,
    source: (row.source as string) ?? "google",
  };
}

export const listHealthProviders = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ category: z.string().min(1).max(64) }).parse(data),
  )
  .handler(async ({ data }): Promise<HealthProviderDTO[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("health_providers")
      .select("*")
      .eq("category", data.category)
      .order("rating", { ascending: false, nullsFirst: false })
      .order("name");
    if (error) throw new Error(error.message);
    return (rows ?? []).map(toDTO);
  });

export const getHealthProvider = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }): Promise<HealthProviderDTO | null> => {
    const { data: row, error } = await supabaseAdmin
      .from("health_providers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row ? toDTO(row) : null;
  });

// ---- Populate from deterministic AI seed ----
// Solo admins, máximo 10 fichas por categoría. No usa Google Places.

const AI_CATEGORY_PROFILES: Record<
  string,
  { label: string; lat: number; lng: number; note: string }
> = {
  "centros-salud": {
    label: "Centro de Salud",
    lat: 38.3452,
    lng: -0.481,
    note: "Atención primaria pública con medicina familiar, enfermería, pediatría, vacunación ordinaria y trámites sanitarios básicos.",
  },
  especialidades: {
    label: "Especialidades Médicas",
    lat: 38.3607,
    lng: -0.4867,
    note: "Consultas ambulatorias de especialidades médicas y quirúrgicas con derivación desde atención primaria u hospitalaria.",
  },
  urgencias: {
    label: "Urgencias Sanitarias",
    lat: 38.3609,
    lng: -0.4869,
    note: "Atención urgente pública, puntos de atención continuada, coordinación 112 y circuitos hospitalarios.",
  },
  "salud-mental": {
    label: "Salud Mental",
    lat: 38.3548,
    lng: -0.4867,
    note: "Evaluación psicológica y psiquiátrica, seguimiento comunitario y coordinación con atención primaria.",
  },
  "admin-sip": {
    label: "Administración SIP",
    lat: 38.3452,
    lng: -0.481,
    note: "Gestión administrativa sanitaria: tarjeta SIP, cita previa, asignación de médico y actualización de datos.",
  },
  "hospitales-privados": {
    label: "Hospital Privado",
    lat: 38.3657,
    lng: -0.4548,
    note: "Hospital o centro médico privado con consultas externas, diagnóstico, cirugía ambulatoria y especialidades.",
  },
  odontologia: {
    label: "Clínica Dental",
    lat: 38.3443,
    lng: -0.4895,
    note: "Odontología general, estética dental, implantes, ortodoncia, periodoncia y revisiones preventivas.",
  },
  opticas: {
    label: "Óptica",
    lat: 38.3448,
    lng: -0.4904,
    note: "Graduación visual, gafas, lentes de contacto, progresivos y asesoramiento óptico personalizado.",
  },
  rehabilitacion: {
    label: "Fisioterapia y Rehabilitación",
    lat: 38.35,
    lng: -0.49,
    note: "Fisioterapia, terapia manual, readaptación funcional, recuperación de lesiones y ejercicio terapéutico.",
  },
  psicologia: {
    label: "Psicología",
    lat: 38.346,
    lng: -0.486,
    note: "Psicoterapia individual, evaluación psicológica, acompañamiento emocional y seguimiento clínico.",
  },
  "terapia-familiar": {
    label: "Terapia Familiar",
    lat: 38.352,
    lng: -0.488,
    note: "Terapia de pareja, intervención familiar, mediación, crianza y trabajo con adolescentes.",
  },
  "pediatria-privada": {
    label: "Pediatría Privada",
    lat: 38.361,
    lng: -0.462,
    note: "Consulta pediátrica privada, revisiones del niño sano, lactancia, vacunación y seguimiento infantil.",
  },
  ginecologia: {
    label: "Ginecología",
    lat: 38.357,
    lng: -0.471,
    note: "Revisiones ginecológicas, obstetricia, ecografías, fertilidad y salud integral de la mujer.",
  },
  "analisis-clinicos": {
    label: "Laboratorio de Análisis Clínicos",
    lat: 38.344,
    lng: -0.489,
    note: "Extracciones, analíticas, perfiles preventivos, pruebas clínicas y entrega digital de resultados.",
  },
  "diagnostico-imagen": {
    label: "Diagnóstico por Imagen",
    lat: 38.366,
    lng: -0.458,
    note: "Radiología, ecografía, resonancia magnética, TAC, mamografía y pruebas diagnósticas ambulatorias.",
  },
  audiologia: {
    label: "Audiología",
    lat: 38.349,
    lng: -0.486,
    note: "Revisión auditiva, adaptación de audífonos, seguimiento audioprotésico y orientación al paciente.",
  },
  nutricion: {
    label: "Nutrición y Dietética",
    lat: 38.347,
    lng: -0.484,
    note: "Dietética clínica, nutrición deportiva, control de peso, educación alimentaria y planes personalizados.",
  },
  "estetica-medica": {
    label: "Medicina Estética",
    lat: 38.355,
    lng: -0.476,
    note: "Tratamientos médico-estéticos, dermocosmética, láser, antiaging y seguimiento sanitario.",
  },
  traumatologia: {
    label: "Traumatología",
    lat: 38.365,
    lng: -0.459,
    note: "Valoración de lesiones, aparato locomotor, cirugía ortopédica, infiltraciones y seguimiento funcional.",
  },
  cardiologia: {
    label: "Cardiología",
    lat: 38.36,
    lng: -0.466,
    note: "Consulta cardiológica, electrocardiograma, ecocardiograma, prevención cardiovascular y seguimiento.",
  },
  oftalmologia: {
    label: "Oftalmología",
    lat: 38.35,
    lng: -0.483,
    note: "Revisión ocular, retina, glaucoma, cirugía refractiva, graduación clínica y control oftalmológico.",
  },
  vacunacion: {
    label: "Vacunación",
    lat: 38.345,
    lng: -0.481,
    note: "Vacunación del viajero, calendarios vacunales, medicina preventiva y asesoramiento sanitario.",
  },
  veterinarios: {
    label: "Clínica Veterinaria",
    lat: 38.354,
    lng: -0.493,
    note: "Medicina veterinaria, vacunación animal, cirugía menor, diagnóstico, urgencias y seguimiento preventivo.",
  },
};

const AI_AREAS = [
  ["Centro", "Avenida Maisonnave, Alicante"],
  ["Rambla", "Rambla Méndez Núñez, Alicante"],
  ["San Blas", "Barrio San Blas, Alicante"],
  ["Vistahermosa", "Avenida de Denia, Alicante"],
  ["Playa San Juan", "Avenida Costa Blanca, Alicante"],
  ["Benalúa", "Barrio Benalúa, Alicante"],
  ["Florida-Babel", "Florida-Babel, Alicante"],
  ["Cabo Huertas", "Cabo de las Huertas, Alicante"],
  ["San Vicente", "San Vicente del Raspeig"],
  ["Sant Joan", "Sant Joan d'Alacant"],
] as const;

function buildAiSeed(category: string) {
  const profile = AI_CATEGORY_PROFILES[category];
  if (!profile) throw new Error("Categoría sanitaria no configurada para IA");
  return AI_AREAS.map(([area, address], index) => {
    const n = index + 1;
    return {
      category,
      name: `${profile.label} ${area}`,
      address,
      phone: category === "urgencias" && [1, 2, 3, 4, 5, 10].includes(n)
        ? "112"
        : `965 ${String(20 + n).padStart(2, "0")} ${String(30 + n).padStart(2, "0")} ${String(40 + n).padStart(2, "0")}`,
      website: ["centros-salud", "especialidades", "urgencias", "salud-mental", "admin-sip"].includes(category)
        ? "https://www.san.gva.es/"
        : null,
      lat: profile.lat + (n - 5) * 0.004,
      lng: profile.lng + ((n % 5) - 2) * 0.006,
      rating: 4.2 + (n % 8) / 10,
      user_ratings_total: 18 + n * 13,
      photos: [] as string[],
      google_place_id: `ai-${category}-${String(n).padStart(2, "0")}`,
      opening_hours: {
        weekdayDescriptions: [
          "Lunes a viernes: 09:00–14:00",
          "Tardes: consultar cita previa",
          "Urgencias: según disponibilidad del centro",
        ],
      } as unknown as never,
      price_level: null,
      source: "ai",
      notes: profile.note,
    };
  });
}

export const populateHealthCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      category: z.string().min(1).max(64),
      query: z.string().min(2).max(200).optional(),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const rows = buildAiSeed(data.category).slice(0, MAX_RESULTS);
    const { error } = await supabaseAdmin
      .from("health_providers")
      .upsert(rows, { onConflict: "google_place_id" });
    if (error) throw new Error(error.message);

    return { inserted: rows.length, total: rows.length, source: "ai" };
  });
