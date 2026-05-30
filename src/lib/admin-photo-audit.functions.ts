// Auditoría de fotos por subsector.
// Cuenta cuántos items tienen foto visible vs sin foto en cada subsector,
// para todos los sectores con foto del proyecto. SOLO LECTURA, no llama a Google.

import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { MAP_BEACHES } from "@/lib/playas-map-data";
import { HEALTH_CATEGORIES } from "@/lib/health-categories";

// Supabase / PostgREST limita por defecto a 1000 filas por petición. Para
// auditar tablas grandes (places, shop_businesses…) hay que paginar a mano
// con .range() hasta agotar el conjunto, o los totales salen truncados.
async function fetchAll<T>(
  build: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

export type SubsectorRow = {
  key: string;
  label: string;
  total: number;
  withPhoto: number;
  withoutPhoto: number;
};

export type SectorBlock = {
  key: string;
  label: string;
  source: string; // tabla(s) y columna(s)
  subsectors: SubsectorRow[];
};

export type PhotoAuditResult = {
  sectors: SectorBlock[];
  generatedAt: string;
};

const RESTAURANT_CATEGORIES: { key: string; label: string }[] = [
  { key: "asian", label: "Asiática (japonés, sushi, chino, thai…)" },
  { key: "drinks", label: "Copas y bares" },
  { key: "typical", label: "Cocina típica (alicantina, tapas)" },
  { key: "rice_fish", label: "Arroces y marisco" },
  { key: "italian", label: "Italiana / pizzerías" },
  { key: "pizzas", label: "Pizzas a domicilio" },
  { key: "brunch", label: "Brunch / cafeterías" },
];

export const getPhotoAudit = createServerFn({ method: "GET" }).handler(
  async (): Promise<PhotoAuditResult> => {
    const sectors: SectorBlock[] = [];

    // ───────────────────────────────── PLAYAS (mapa interactivo)
    {
      const { data: covers } = await supabaseAdmin
        .from("beach_covers")
        .select("slug, photos, public_url");
      const withPhotoSlugs = new Set(
        (covers ?? [])
          .filter(
            (c) =>
              !!c.public_url ||
              (Array.isArray(c.photos) && c.photos.length > 0),
          )
          .map((c) => c.slug),
      );
      const subs: SubsectorRow[] = MAP_BEACHES.map((b) => ({
        key: b.slug,
        label: b.name,
        total: 1,
        withPhoto: withPhotoSlugs.has(b.slug) ? 1 : 0,
        withoutPhoto: withPhotoSlugs.has(b.slug) ? 0 : 1,
      }));
      sectors.push({
        key: "playas",
        label: "Playas (mapa interactivo)",
        source: "beach_covers.public_url / photos[]",
        subsectors: subs,
      });
    }

    // ───────────────────────────────── COMPRAR (shop_businesses por subsubsector)
    {
      const { data: subsubs } = await supabaseAdmin
        .from("shop_subsubsectors")
        .select("id, slug, name")
        .order("name");
      const biz = await fetchAll<{ subsubsector_id: string | null; photos: unknown; logo_url: string | null }>(
        async (from, to) =>
          await supabaseAdmin
            .from("shop_businesses")
            .select("subsubsector_id, photos, logo_url")
            .range(from, to),
      );
      const counters = new Map<
        string,
        { total: number; withPhoto: number }
      >();
      for (const b of biz ?? []) {
        const id = (b as { subsubsector_id: string | null }).subsubsector_id;
        if (!id) continue;
        const cur = counters.get(id) ?? { total: 0, withPhoto: 0 };
        cur.total++;
        const photos = (b as { photos: unknown }).photos;
        const hasPhoto =
          (Array.isArray(photos) && photos.length > 0) ||
          !!(b as { logo_url: string | null }).logo_url;
        if (hasPhoto) cur.withPhoto++;
        counters.set(id, cur);
      }
      const subs: SubsectorRow[] = (subsubs ?? []).map((s) => {
        const c = counters.get(s.id) ?? { total: 0, withPhoto: 0 };
        return {
          key: s.slug,
          label: s.name,
          total: c.total,
          withPhoto: c.withPhoto,
          withoutPhoto: c.total - c.withPhoto,
        };
      });
      sectors.push({
        key: "comprar",
        label: "Comprar (tiendas por subsubsector)",
        source: "shop_businesses.photos / logo_url",
        subsectors: subs,
      });
    }

    // ───────────────────────────────── RESTAURANTES (places por category)
    // Criterio = experiencia visual: la tarjeta del listado SOLO muestra
    // `cover_photo`. `raw.photos` son refs de Google que NO se renderizan
    // hasta que se descargan a Storage, así que no cuentan como "foto
    // visible" para el usuario.
    {
      const rows = await fetchAll<{ category: string | null; cover_photo: string | null }>(
        async (from, to) =>
          await supabaseAdmin
            .from("places")
            .select("category, cover_photo")
            .range(from, to),
      );
      const counters = new Map<
        string,
        { total: number; withPhoto: number }
      >();
      for (const r of rows ?? []) {
        const cat = (r as { category: string | null }).category ?? "_none_";
        const cur = counters.get(cat) ?? { total: 0, withPhoto: 0 };
        cur.total++;
        const cover = (r as { cover_photo: string | null }).cover_photo;
        if (cover && cover.trim().length > 0) cur.withPhoto++;
        counters.set(cat, cur);
      }
      const subs: SubsectorRow[] = RESTAURANT_CATEGORIES.map((cat) => {
        const c = counters.get(cat.key) ?? { total: 0, withPhoto: 0 };
        return {
          key: cat.key,
          label: cat.label,
          total: c.total,
          withPhoto: c.withPhoto,
          withoutPhoto: c.total - c.withPhoto,
        };
      });
      for (const [cat, c] of counters) {
        if (!RESTAURANT_CATEGORIES.some((r) => r.key === cat)) {
          subs.push({
            key: cat,
            label: `(otra) ${cat}`,
            total: c.total,
            withPhoto: c.withPhoto,
            withoutPhoto: c.total - c.withPhoto,
          });
        }
      }
      sectors.push({
        key: "restaurantes",
        label: "Restaurantes (places por categoría)",
        source: "places.cover_photo (lo que ve el usuario en la tarjeta)",
        subsectors: subs,
      });
    }

    // ───────────────────────────────── HOTELES (hotels_static por hotel_type)
    {
      const { data: rows } = await supabaseAdmin
        .from("hotels_static")
        .select("hotel_type, main_image, scraped_photos, raw");
      const counters = new Map<
        string,
        { total: number; withPhoto: number }
      >();
      for (const r of rows ?? []) {
        const t = (r as { hotel_type: string | null }).hotel_type ?? "sin tipo";
        const cur = counters.get(t) ?? { total: 0, withPhoto: 0 };
        cur.total++;
        const main = (r as { main_image: string | null }).main_image;
        const scraped = (r as { scraped_photos: string[] | null })
          .scraped_photos;
        const raw = (r as { raw: { photos?: unknown[] } | null }).raw;
        const rawPhotos =
          raw && Array.isArray(raw.photos) && raw.photos.length > 0;
        const hasPhoto =
          !!main || (Array.isArray(scraped) && scraped.length > 0) || rawPhotos;
        if (hasPhoto) cur.withPhoto++;
        counters.set(t, cur);
      }
      const subs: SubsectorRow[] = Array.from(counters.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([t, c]) => ({
          key: t,
          label: t,
          total: c.total,
          withPhoto: c.withPhoto,
          withoutPhoto: c.total - c.withPhoto,
        }));
      sectors.push({
        key: "hoteles",
        label: "Hoteles (por tipo)",
        source: "hotels_static.main_image / scraped_photos / raw.photos",
        subsectors: subs,
      });
    }

    // ───────────────────────────────── CINES
    {
      const { data: rows } = await supabaseAdmin
        .from("cinemas")
        .select("photos, active")
        .eq("active", true);
      const total = rows?.length ?? 0;
      const withPhoto = (rows ?? []).filter(
        (r) =>
          Array.isArray((r as { photos: string[] | null }).photos) &&
          ((r as { photos: string[] }).photos.length ?? 0) > 0,
      ).length;
      sectors.push({
        key: "cines",
        label: "Cines",
        source: "cinemas.photos[]",
        subsectors: [
          {
            key: "cines",
            label: "Salas de cine",
            total,
            withPhoto,
            withoutPhoto: total - withPhoto,
          },
        ],
      });
    }

    // ───────────────────────────────── PELÍCULAS / CARTELERA
    {
      const { data: rows } = await supabaseAdmin
        .from("films")
        .select("poster_url, active")
        .eq("active", true);
      const total = rows?.length ?? 0;
      const withPhoto = (rows ?? []).filter(
        (r) => !!(r as { poster_url: string | null }).poster_url,
      ).length;
      sectors.push({
        key: "cartelera",
        label: "Cartelera (películas)",
        source: "films.poster_url",
        subsectors: [
          {
            key: "films",
            label: "Películas activas",
            total,
            withPhoto,
            withoutPhoto: total - withPhoto,
          },
        ],
      });
    }

    // ───────────────────────────────── EVENTOS (por category)
    {
      const { data: rows } = await supabaseAdmin
        .from("events")
        .select("category, poster_url, active")
        .eq("active", true);
      const counters = new Map<
        string,
        { total: number; withPhoto: number }
      >();
      for (const r of rows ?? []) {
        const cat = (r as { category: string | null }).category ?? "otro";
        const cur = counters.get(cat) ?? { total: 0, withPhoto: 0 };
        cur.total++;
        if ((r as { poster_url: string | null }).poster_url) cur.withPhoto++;
        counters.set(cat, cur);
      }
      const subs: SubsectorRow[] = Array.from(counters.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, c]) => ({
          key: k,
          label: k,
          total: c.total,
          withPhoto: c.withPhoto,
          withoutPhoto: c.total - c.withPhoto,
        }));
      sectors.push({
        key: "eventos",
        label: "Eventos (por categoría)",
        source: "events.poster_url",
        subsectors: subs,
      });
    }

    // ───────────────────────────────── VENUES (por kind)
    {
      const { data: rows } = await supabaseAdmin
        .from("venues")
        .select("kind, cover_url, active")
        .eq("active", true);
      const counters = new Map<
        string,
        { total: number; withPhoto: number }
      >();
      for (const r of rows ?? []) {
        const k = (r as { kind: string | null }).kind ?? "sin tipo";
        const cur = counters.get(k) ?? { total: 0, withPhoto: 0 };
        cur.total++;
        if ((r as { cover_url: string | null }).cover_url) cur.withPhoto++;
        counters.set(k, cur);
      }
      const subs: SubsectorRow[] = Array.from(counters.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, c]) => ({
          key: k,
          label: k,
          total: c.total,
          withPhoto: c.withPhoto,
          withoutPhoto: c.total - c.withPhoto,
        }));
      sectors.push({
        key: "venues",
        label: "Recintos / teatros / salas",
        source: "venues.cover_url",
        subsectors: subs,
      });
    }

    // ───────────────────────────────── SALUD PRIVADO (health_providers por category)
    {
      const { data: rows } = await supabaseAdmin
        .from("health_providers")
        .select("category, photos");
      const counters = new Map<
        string,
        { total: number; withPhoto: number }
      >();
      for (const r of rows ?? []) {
        const cat = (r as { category: string | null }).category ?? "_none_";
        const cur = counters.get(cat) ?? { total: 0, withPhoto: 0 };
        cur.total++;
        const photos = (r as { photos: string[] | null }).photos;
        if (Array.isArray(photos) && photos.length > 0) cur.withPhoto++;
        counters.set(cat, cur);
      }
      const subs: SubsectorRow[] = HEALTH_CATEGORIES.filter(
        (c) => c.group === "privado",
      ).map((cat) => {
        const c = counters.get(cat.slug) ?? { total: 0, withPhoto: 0 };
        return {
          key: cat.slug,
          label: cat.label,
          total: c.total,
          withPhoto: c.withPhoto,
          withoutPhoto: c.total - c.withPhoto,
        };
      });
      sectors.push({
        key: "salud-privado",
        label: "Salud privada (health_providers)",
        source: "health_providers.photos[]",
        subsectors: subs,
      });
    }

    // ───────────────────────────────── SALUD PÚBLICO (health_centers)
    // Criterio = experiencia visual del usuario.
    // /hospitales/:id tiene 4 hospitales con fotos HARDCODEADAS (mocks
    // Unsplash) → cuentan como "con foto visible" aunque la BD esté vacía.
    // TODO interno: migrar esos mocks a BD más adelante.
    {
      const HARDCODED_PHOTO_IDS = new Set<string>([
        "ac5060da-c9b9-4c74-8dc9-4f209cc4f51c",
        "1e5fb1fa-0aba-457d-b173-578ea7c4cd1e",
        "64f8f487-da8d-4aa3-9bb8-b67bf25e6c25",
        "bf0baa51-3395-48c0-80d7-618a821590b1",
      ]);
      const { data: rows } = await supabaseAdmin
        .from("health_centers")
        .select("id, service_type, google_photo_refs");
      const counters = new Map<
        string,
        { total: number; withPhoto: number }
      >();
      for (const r of rows ?? []) {
        const st =
          (r as { service_type: string | null }).service_type ?? "sin tipo";
        const cur = counters.get(st) ?? { total: 0, withPhoto: 0 };
        cur.total++;
        const refs = (r as { google_photo_refs: string[] | null })
          .google_photo_refs;
        const id = (r as { id: string }).id;
        const hasVisible =
          HARDCODED_PHOTO_IDS.has(id) ||
          (Array.isArray(refs) && refs.length > 0);
        if (hasVisible) cur.withPhoto++;
        counters.set(st, cur);
      }
      const subs: SubsectorRow[] = Array.from(counters.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, c]) => ({
          key: k,
          label: k,
          total: c.total,
          withPhoto: c.withPhoto,
          withoutPhoto: c.total - c.withPhoto,
        }));
      sectors.push({
        key: "salud-publico",
        label: "Salud pública (health_centers) · incluye mocks visibles",
        source: "health_centers.google_photo_refs[] + 4 mocks hardcoded en /hospitales/:id",
        subsectors: subs,
      });
    }

    return { sectors, generatedAt: new Date().toISOString() };
  },
);
