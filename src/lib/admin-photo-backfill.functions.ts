// Backfill ÚNICO de fotos desde Google Places para los subsectores
// autorizados explícitamente por el admin desde /admin/auditoria-fotos.
//
// Reglas (instrucción única del usuario):
// - Solo subsectores que vengan en `authorizedKeys` (formato `sector::subsector`).
// - Como máximo UNA foto por ficha.
// - Las URLs se anexan a la columna de fotos de la tabla correspondiente.
// - Tope global duro = 2000 fotos por ejecución.
//
// IMPORTANTE: el kill-switch global de Google se BYPASSEA aquí a propósito,
// porque la autorización ya viene por subsector desde la UI. No usamos
// fetchGoogle() (que aborta si killswitch=off). Sí registramos cada llamada
// en external_api_calls vía trackExternalCall para que el consumo quede
// auditado en /admin/consumo-google.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { trackExternalCall } from "@/lib/observability/track-external-call";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";

const PLACES_BASE = "https://places.googleapis.com/v1";
const BUCKET = "entity-photos";
const HARD_CAP = 2000;

type SectorReport = {
  sectorKey: string;
  subsectorKey: string;
  label: string;
  attempted: number;
  ok: number;
  skipped: number;
  errors: string[];
};

async function googleFetch(args: {
  url: string;
  init?: RequestInit;
  endpoint: string;
  caller: string;
}): Promise<Response | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const startedAt = Date.now();
  let statusCode = 0;
  let errorMsg: string | null = null;
  try {
    const res = await fetch(args.url, args.init);
    statusCode = res.status;
    if (!res.ok) errorMsg = `HTTP ${res.status}`;
    return res;
  } catch (e) {
    errorMsg = e instanceof Error ? e.message : String(e);
    return null;
  } finally {
    void trackExternalCall({
      provider: "google_places",
      endpoint: args.endpoint,
      caller: args.caller,
      statusCode,
      latencyMs: Date.now() - startedAt,
      meta: errorMsg ? { error: errorMsg, backfill: true } : { backfill: true },
    });
  }
}

async function findPlaceId(opts: {
  name: string;
  lat?: number | null;
  lng?: number | null;
  caller: string;
}): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const body: Record<string, unknown> = {
    textQuery: `${opts.name} Alicante`,
    maxResultCount: 1,
    languageCode: "es",
  };
  if (opts.lat != null && opts.lng != null) {
    body.locationBias = {
      circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: 3000 },
    };
  }
  const res = await googleFetch({
    url: `${PLACES_BASE}/places:searchText`,
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify(body),
    },
    endpoint: "places:searchText",
    caller: opts.caller,
  });
  if (!res || !res.ok) return null;
  const j = (await res.json()) as { places?: Array<{ id?: string }> };
  return j.places?.[0]?.id ?? null;
}

async function getFirstPhotoName(placeId: string, caller: string): Promise<string | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const res = await googleFetch({
    url: `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=es`,
    init: { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "photos" } },
    endpoint: "places:details",
    caller,
  });
  if (!res || !res.ok) return null;
  const j = (await res.json()) as { photos?: Array<{ name?: string }> };
  return j.photos?.[0]?.name ?? null;
}

async function fetchPhotoBytes(
  photoName: string,
  caller: string,
): Promise<{ buf: ArrayBuffer; contentType: string } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const res = await googleFetch({
    url: `${PLACES_BASE}/${photoName}/media?maxWidthPx=1600&key=${key}`,
    init: { redirect: "follow" },
    endpoint: "places:photo:media",
    caller,
  });
  if (!res || !res.ok) return null;
  const buf = await res.arrayBuffer();
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { buf, contentType };
}

async function uploadPhoto(
  folder: string,
  id: string,
  blob: { buf: ArrayBuffer; contentType: string },
): Promise<string | null> {
  const ext = blob.contentType.includes("png") ? "png" : "jpg";
  const path = `${folder}/${id}.${ext}`;
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, blob.buf, { contentType: blob.contentType, upsert: true });
  if (error) return null;
  const { data: pub } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/** Resuelve UNA foto Google para un item y la sube. Devuelve la URL pública o null. */
async function resolveOnePhoto(args: {
  name: string;
  lat?: number | null;
  lng?: number | null;
  folder: string;
  id: string;
  caller: string;
}): Promise<string | null> {
  const placeId = await findPlaceId({
    name: args.name,
    lat: args.lat,
    lng: args.lng,
    caller: args.caller,
  });
  if (!placeId) return null;
  const photoName = await getFirstPhotoName(placeId, args.caller);
  if (!photoName) return null;
  const blob = await fetchPhotoBytes(photoName, args.caller);
  if (!blob) return null;
  return await uploadPhoto(args.folder, args.id, blob);
}

const InputSchema = z.object({
  authorizedKeys: z.array(z.string().min(3).max(120)).max(500),
  max: z.number().int().min(1).max(HARD_CAP).optional(),
});

export const backfillAuthorizedPhotos = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      return {
        ok: false as const,
        error: "Falta GOOGLE_PLACES_API_KEY en el servidor.",
        budget: 0,
        used: 0,
        reports: [] as SectorReport[],
      };
    }

    const budget = Math.min(data.max ?? HARD_CAP, HARD_CAP);
    let used = 0;
    const reports: SectorReport[] = [];

    // Agrupar autorizaciones por sector
    const bySector = new Map<string, Set<string>>();
    for (const k of data.authorizedKeys) {
      const [s, ...rest] = k.split("::");
      const sub = rest.join("::");
      if (!s || !sub) continue;
      if (!bySector.has(s)) bySector.set(s, new Set());
      bySector.get(s)!.add(sub);
    }

    const remaining = () => budget - used;

    // ───────────── COMPRAR (shop_businesses por slug del subsubsector)
    if (bySector.has("comprar") && remaining() > 0) {
      const slugs = Array.from(bySector.get("comprar")!);
      const { data: subs } = await supabaseAdmin
        .from("shop_subsubsectors")
        .select("id, slug, name")
        .in("slug", slugs);
      for (const ss of subs ?? []) {
        if (remaining() <= 0) break;
        const rep: SectorReport = {
          sectorKey: "comprar",
          subsectorKey: ss.slug,
          label: `Comprar · ${ss.name}`,
          attempted: 0,
          ok: 0,
          skipped: 0,
          errors: [],
        };
        const { data: rows } = await supabaseAdmin
          .from("shop_businesses")
          .select("id, name, lat, lng, photos, logo_url")
          .eq("subsubsector_id", ss.id)
          .limit(remaining());
        const targets = (rows ?? []).filter((r) => {
          const ps = (r as { photos: unknown }).photos;
          const hasPhotos = Array.isArray(ps) && ps.length > 0;
          return !hasPhotos && !(r as { logo_url: string | null }).logo_url;
        });
        for (const r of targets) {
          if (remaining() <= 0) break;
          rep.attempted++;
          used++;
          const url = await resolveOnePhoto({
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            folder: "comprar",
            id: r.id,
            caller: "backfill:comprar",
          });
          if (!url) {
            rep.skipped++;
            continue;
          }
          const { error } = await supabaseAdmin
            .from("shop_businesses")
            .update({ photos: [url] as never })
            .eq("id", r.id);
          if (error) rep.errors.push(`${r.id}: ${error.message}`);
          else rep.ok++;
        }
        reports.push(rep);
      }
    }

    // ───────────── RESTAURANTES (places.cover_photo por category)
    if (bySector.has("restaurantes") && remaining() > 0) {
      for (const cat of bySector.get("restaurantes")!) {
        if (remaining() <= 0) break;
        const rep: SectorReport = {
          sectorKey: "restaurantes",
          subsectorKey: cat,
          label: `Restaurantes · ${cat}`,
          attempted: 0,
          ok: 0,
          skipped: 0,
          errors: [],
        };
        const { data: rows } = await supabaseAdmin
          .from("places")
          .select("id, name, lat, lng, cover_photo, google_place_id")
          .eq("category", cat)
          .is("cover_photo", null)
          .limit(remaining());
        for (const r of rows ?? []) {
          if (remaining() <= 0) break;
          rep.attempted++;
          used++;
          // Si ya tenemos google_place_id, ahorramos la búsqueda de texto.
          let placeId: string | null = (r as { google_place_id: string | null }).google_place_id ?? null;
          if (!placeId) {
            placeId = await findPlaceId({
              name: r.name,
              lat: r.lat,
              lng: r.lng,
              caller: "backfill:restaurantes",
            });
          }
          if (!placeId) {
            rep.skipped++;
            continue;
          }
          const photoName = await getFirstPhotoName(placeId, "backfill:restaurantes");
          if (!photoName) {
            rep.skipped++;
            continue;
          }
          const blob = await fetchPhotoBytes(photoName, "backfill:restaurantes");
          if (!blob) {
            rep.skipped++;
            continue;
          }
          const url = await uploadPhoto("restaurantes", r.id, blob);
          if (!url) {
            rep.skipped++;
            continue;
          }
          const { error } = await supabaseAdmin
            .from("places")
            .update({ cover_photo: url })
            .eq("id", r.id);
          if (error) rep.errors.push(`${r.id}: ${error.message}`);
          else rep.ok++;
        }
        reports.push(rep);
      }
    }

    // ───────────── HOTELES (hotels_static.main_image por hotel_type)
    if (bySector.has("hoteles") && remaining() > 0) {
      for (const t of bySector.get("hoteles")!) {
        if (remaining() <= 0) break;
        const rep: SectorReport = {
          sectorKey: "hoteles",
          subsectorKey: t,
          label: `Hoteles · ${t}`,
          attempted: 0,
          ok: 0,
          skipped: 0,
          errors: [],
        };
        const { data: rows } = await supabaseAdmin
          .from("hotels_static")
          .select("id, name, lat, lng, main_image")
          .eq("hotel_type", t)
          .is("main_image", null)
          .limit(remaining());
        for (const r of rows ?? []) {
          if (remaining() <= 0) break;
          rep.attempted++;
          used++;
          const url = await resolveOnePhoto({
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            folder: "hoteles",
            id: r.id,
            caller: "backfill:hoteles",
          });
          if (!url) {
            rep.skipped++;
            continue;
          }
          const { error } = await supabaseAdmin
            .from("hotels_static")
            .update({ main_image: url })
            .eq("id", r.id);
          if (error) rep.errors.push(`${r.id}: ${error.message}`);
          else rep.ok++;
        }
        reports.push(rep);
      }
    }

    // ───────────── CINES (cinemas.photos)
    if (bySector.has("cines") && remaining() > 0) {
      const rep: SectorReport = {
        sectorKey: "cines",
        subsectorKey: "cines",
        label: "Cines · Salas",
        attempted: 0,
        ok: 0,
        skipped: 0,
        errors: [],
      };
      const { data: rows } = await supabaseAdmin
        .from("cinemas")
        .select("id, name, lat, lng, photos, active")
        .eq("active", true)
        .limit(remaining());
      const targets = (rows ?? []).filter(
        (r) => !Array.isArray(r.photos) || r.photos.length === 0,
      );
      for (const r of targets) {
        if (remaining() <= 0) break;
        rep.attempted++;
        used++;
        const url = await resolveOnePhoto({
          name: r.name,
          lat: r.lat,
          lng: r.lng,
          folder: "cines",
          id: r.id,
          caller: "backfill:cines",
        });
        if (!url) {
          rep.skipped++;
          continue;
        }
        const { error } = await supabaseAdmin
          .from("cinemas")
          .update({ photos: [url] })
          .eq("id", r.id);
        if (error) rep.errors.push(`${r.id}: ${error.message}`);
        else rep.ok++;
      }
      reports.push(rep);
    }

    // ───────────── VENUES (venues.cover_url por kind)
    if (bySector.has("venues") && remaining() > 0) {
      for (const kind of bySector.get("venues")!) {
        if (remaining() <= 0) break;
        const rep: SectorReport = {
          sectorKey: "venues",
          subsectorKey: kind,
          label: `Recintos · ${kind}`,
          attempted: 0,
          ok: 0,
          skipped: 0,
          errors: [],
        };
        const { data: rows } = await supabaseAdmin
          .from("venues")
          .select("id, name, lat, lng, cover_url, active")
          .eq("active", true)
          .eq("kind", kind)
          .is("cover_url", null)
          .limit(remaining());
        for (const r of rows ?? []) {
          if (remaining() <= 0) break;
          rep.attempted++;
          used++;
          const url = await resolveOnePhoto({
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            folder: "venues",
            id: r.id,
            caller: "backfill:venues",
          });
          if (!url) {
            rep.skipped++;
            continue;
          }
          const { error } = await supabaseAdmin
            .from("venues")
            .update({ cover_url: url })
            .eq("id", r.id);
          if (error) rep.errors.push(`${r.id}: ${error.message}`);
          else rep.ok++;
        }
        reports.push(rep);
      }
    }

    // ───────────── SALUD PRIVADA (health_providers.photos por category)
    if (bySector.has("salud-privado") && remaining() > 0) {
      const slugSet = bySector.get("salud-privado")!;
      // Mapeamos slugs autorizados (puede que la BD use el mismo slug).
      const cats = HEALTH_CATEGORIES.filter(
        (c) => c.group === "privado" && slugSet.has(c.slug),
      );
      for (const cat of cats) {
        if (remaining() <= 0) break;
        const rep: SectorReport = {
          sectorKey: "salud-privado",
          subsectorKey: cat.slug,
          label: `Salud privada · ${cat.label}`,
          attempted: 0,
          ok: 0,
          skipped: 0,
          errors: [],
        };
        const { data: rows } = await supabaseAdmin
          .from("health_providers")
          .select("id, name, lat, lng, photos")
          .eq("category", cat.slug)
          .limit(remaining());
        const targets = (rows ?? []).filter(
          (r) => !Array.isArray(r.photos) || r.photos.length === 0,
        );
        for (const r of targets) {
          if (remaining() <= 0) break;
          rep.attempted++;
          used++;
          const url = await resolveOnePhoto({
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            folder: "salud-privado",
            id: r.id,
            caller: "backfill:salud-privado",
          });
          if (!url) {
            rep.skipped++;
            continue;
          }
          const { error } = await supabaseAdmin
            .from("health_providers")
            .update({ photos: [url] })
            .eq("id", r.id);
          if (error) rep.errors.push(`${r.id}: ${error.message}`);
          else rep.ok++;
        }
        reports.push(rep);
      }
    }

    // ───────────── SALUD PÚBLICA (health_centers.google_photo_refs por service_type)
    if (bySector.has("salud-publico") && remaining() > 0) {
      for (const st of bySector.get("salud-publico")!) {
        if (remaining() <= 0) break;
        const rep: SectorReport = {
          sectorKey: "salud-publico",
          subsectorKey: st,
          label: `Salud pública · ${st}`,
          attempted: 0,
          ok: 0,
          skipped: 0,
          errors: [],
        };
        const { data: rows } = await supabaseAdmin
          .from("health_centers")
          .select("id, name, lat, lng, google_photo_refs")
          .eq("service_type", st)
          .limit(remaining());
        const targets = (rows ?? []).filter(
          (r) =>
            !Array.isArray(r.google_photo_refs) ||
            r.google_photo_refs.length === 0,
        );
        for (const r of targets) {
          if (remaining() <= 0) break;
          rep.attempted++;
          used++;
          const url = await resolveOnePhoto({
            name: r.name,
            lat: r.lat,
            lng: r.lng,
            folder: "salud-publico",
            id: r.id,
            caller: "backfill:salud-publico",
          });
          if (!url) {
            rep.skipped++;
            continue;
          }
          const { error } = await supabaseAdmin
            .from("health_centers")
            .update({ google_photo_refs: [url] })
            .eq("id", r.id);
          if (error) rep.errors.push(`${r.id}: ${error.message}`);
          else rep.ok++;
        }
        reports.push(rep);
      }
    }

    // ───────────── Sectores NO aplicables a Google Places
    const notApplicable: string[] = [];
    for (const s of ["playas", "cartelera", "eventos"]) {
      if (bySector.has(s)) {
        notApplicable.push(s);
        reports.push({
          sectorKey: s,
          subsectorKey: "—",
          label:
            s === "playas"
              ? "Playas (usar /api/public/hooks/sync-beach-covers)"
              : s === "cartelera"
                ? "Cartelera de cine (pósters vienen del scraper, no de Google)"
                : "Eventos (pósters vienen de prensa/Songkick, no de Google)",
          attempted: 0,
          ok: 0,
          skipped: 0,
          errors: ["No aplica a Google Places — se ignora."],
        });
      }
    }

    return {
      ok: true as const,
      budget,
      used,
      reports,
      notApplicable,
      finishedAt: new Date().toISOString(),
    };
  });
