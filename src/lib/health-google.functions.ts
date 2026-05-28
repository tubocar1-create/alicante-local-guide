import { createServerFn } from "@tanstack/react-start";
import { getGooglePlacesKey } from "@/lib/google-killswitch.server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Populador de centros públicos vía Google Places API (no IA).
// Pensado para "Punto de Atención Continuada" (PAC) y "Punto de
// Atención Sanitaria" (PAS) por toda la provincia de Alicante.

// FIELD_MASK adelgazado al MÍNIMO (solo Basic Data, ~$5/1000).
// Sin Pro/Enterprise fields. Refresco solo manual desde admin.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
].join(",");

type GPlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

// Centros principales de la provincia (cobertura amplia, no solo capital)
const PROVINCE_CENTERS: Array<{ name: string; lat: number; lng: number }> = [
  { name: "Alicante", lat: 38.3452, lng: -0.481 },
  { name: "Elche", lat: 38.2655, lng: -0.6983 },
  { name: "Torrevieja", lat: 37.9785, lng: -0.6826 },
  { name: "Orihuela", lat: 38.0846, lng: -0.9444 },
  { name: "Benidorm", lat: 38.5411, lng: -0.1225 },
  { name: "Alcoy", lat: 38.6985, lng: -0.4744 },
  { name: "Dénia", lat: 38.8407, lng: 0.1057 },
  { name: "Elda", lat: 38.4783, lng: -0.7906 },
  { name: "Villajoyosa", lat: 38.5076, lng: -0.2329 },
  { name: "San Vicente del Raspeig", lat: 38.396, lng: -0.5253 },
];

const QUERY_MAP: Record<string, string[]> = {
  pac: [
    "Punto de Atención Continuada",
    "PAC sanitario",
    "Centro de salud urgencias",
    "Atención continuada urgencias",
  ],
  pas: [
    "Punto de Atención Sanitaria",
    "PAS sanitario",
    "Consultorio auxiliar sanidad",
    "Punto sanitario rural",
  ],
};

async function searchTextNear(
  textQuery: string,
  apiKey: string,
  center: { name?: string; lat: number; lng: number },
  radius = 12000,
): Promise<GPlace[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: `${textQuery} ${center.name ?? "Alicante"}`,
      languageCode: "es",
      regionCode: "ES",
      maxResultCount: 20,
      locationBias: {
        circle: {
          center: { latitude: center.lat, longitude: center.lng },
          radius,
        },
      },
    }),
  });
  if (!res.ok) {
    console.error("Google Places error", res.status, await res.text());
    return [];
  }
  const json = (await res.json()) as { places?: GPlace[] };
  return json.places ?? [];
}

function municipalityFromAddress(address: string | null): string {
  if (!address) return "Alicante";
  // Formato típico: "Calle X, 12, 03001 Alicante, España"
  const m = address.match(/\d{5}\s+([^,]+)/);
  if (m) return m[1].trim();
  const parts = address.split(",").map((s) => s.trim()).filter(Boolean);
  return parts[parts.length - 2] ?? parts[0] ?? "Alicante";
}

export const populateAtencionContinuada = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        kind: z.enum(["pac", "pas"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin role required");

    const apiKey = await getGooglePlacesKey();
    if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY missing");

    const queries = QUERY_MAP[data.kind];
    const seen = new Map<string, GPlace>();

    for (const center of PROVINCE_CENTERS) {
      for (const q of queries) {
        const places = await searchTextNear(q, apiKey, center, 15000);
        for (const p of places) {
          if (!p.id || !p.displayName?.text) continue;
          // Filtrado defensivo: descartar hospitales privados, clínicas
          // dentales, farmacias y demás ruido.
          const nameLow = p.displayName.text.toLowerCase();
          const isNoise =
            /dental|óptica|optica|veterinari|farmacia|clínica privada|estética/i.test(
              nameLow,
            );
          if (isNoise) continue;
          if (!seen.has(p.id)) seen.set(p.id, p);
        }
      }
    }

    const list = Array.from(seen.values());
    if (!list.length) {
      return { inserted: 0, total: 0, source: "google", kind: data.kind };
    }

    const serviceType = "urgencias"; // PAC y PAS comparten naturaleza urgente
    const specialtyTag = data.kind === "pac" ? "PAC" : "PAS";
    const associated =
      data.kind === "pac"
        ? ["Atención continuada", "Urgencias extrahospitalarias"]
        : ["Atención sanitaria básica", "Consultorio auxiliar"];

    const rows = list.map((p) => {
      const address = p.formattedAddress ?? null;
      return {
        name: p.displayName!.text!,
        service_type: serviceType,
        specialties: [specialtyTag],
        municipality: municipalityFromAddress(address),
        address,
        phone: p.nationalPhoneNumber ?? null,
        schedule:
          p.regularOpeningHours?.weekdayDescriptions?.join(" · ") ?? null,
        health_department: null as string | null,
        associated_services: associated,
        website: p.websiteUri ?? null,
        source_url: `https://www.google.com/maps/place/?q=place_id:${p.id}`,
        notes: `Google Place · ${p.rating ?? "s/r"}★ (${p.userRatingCount ?? 0})`,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
      };
    });

    // Reemplazo limpio por tipo: borrar entradas previas de este kind antes
    // de insertar la nueva tanda, así evitamos duplicados sin clave única.
    await supabaseAdmin
      .from("health_centers")
      .delete()
      .eq("service_type", serviceType)
      .contains("specialties", [specialtyTag]);

    const { error } = await supabaseAdmin
      .from("health_centers")
      .insert(rows);
    if (error) throw new Error(error.message);

    return {
      inserted: rows.length,
      total: list.length,
      source: "google",
      kind: data.kind,
    };
  });
