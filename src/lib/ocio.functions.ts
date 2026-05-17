import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CinemaDTO = {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  ticket_url: string | null;
  opening_hours: { weekdayDescriptions?: string[] } | null;
  photos: string[];
  notes: string | null;
};

export type FilmDTO = {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  duration_min: number | null;
  genre: string | null;
  language: string | null;
  age_rating: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  synopsis: string | null;
  director: string | null;
  cast_list: string[];
};

export type ShowtimeDTO = {
  id: string;
  cinema_id: string;
  film_id: string;
  starts_at: string;
  room: string | null;
  version: string | null;
  format: string | null;
  price_eur: number | null;
  ticket_url: string | null;
};

export const listCinemas = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("cinemas")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as CinemaDTO[];
});

export const getCinemaWithShowtimes = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: cinema, error: ec } = await supabaseAdmin
      .from("cinemas")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (ec) throw ec;
    if (!cinema) return { cinema: null, showtimes: [], films: [] };

    const nowIso = new Date().toISOString();
    const { data: shows, error: es } = await supabaseAdmin
      .from("showtimes")
      .select("*")
      .eq("cinema_id", cinema.id)
      .gte("starts_at", nowIso)
      .order("starts_at");
    if (es) throw es;
    const showtimes = (shows ?? []) as ShowtimeDTO[];

    const filmIds = Array.from(new Set(showtimes.map((s) => s.film_id)));
    let films: FilmDTO[] = [];
    if (filmIds.length > 0) {
      const { data: fdata, error: ef } = await supabaseAdmin
        .from("films")
        .select("*")
        .in("id", filmIds);
      if (ef) throw ef;
      films = (fdata ?? []) as FilmDTO[];
    }

    return { cinema: cinema as CinemaDTO, showtimes, films };
  });

export const getFilmWithShowtimes = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: film, error: ef } = await supabaseAdmin
      .from("films")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (ef) throw ef;
    if (!film) return { film: null, showtimes: [], cinemas: [] };

    const nowIso = new Date().toISOString();
    const { data: shows, error: es } = await supabaseAdmin
      .from("showtimes")
      .select("*")
      .eq("film_id", film.id)
      .gte("starts_at", nowIso)
      .order("starts_at");
    if (es) throw es;
    const showtimes = (shows ?? []) as ShowtimeDTO[];

    const cinemaIds = Array.from(new Set(showtimes.map((s) => s.cinema_id)));
    let cinemas: CinemaDTO[] = [];
    if (cinemaIds.length > 0) {
      const { data: cdata, error: ec } = await supabaseAdmin
        .from("cinemas")
        .select("*")
        .in("id", cinemaIds);
      if (ec) throw ec;
      cinemas = (cdata ?? []) as CinemaDTO[];
    }

    return { film: film as FilmDTO, showtimes, cinemas };
  });

export type CarteleraItemDTO = FilmDTO & {
  showtime_count: number;
  cinema_count: number;
  next_show_at: string | null;
};

// Listado global de cartelera: todas las películas con pases futuros.
export const listCartelera = createServerFn({ method: "GET" })
  .inputValidator((data: { cinemaSlug?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
  const nowIso = new Date().toISOString();

  let cinemaFilterId: string | null = null;
  let cinemaInfo: { id: string; slug: string; name: string } | null = null;
  if (data?.cinemaSlug) {
    const { data: c, error: ec } = await supabaseAdmin
      .from("cinemas")
      .select("id, slug, name")
      .eq("slug", data.cinemaSlug)
      .maybeSingle();
    if (ec) throw ec;
    if (!c) return { cinema: null, items: [] as CarteleraItemDTO[] };
    cinemaFilterId = c.id;
    cinemaInfo = c;
  }

  let q = supabaseAdmin
    .from("showtimes")
    .select("film_id, cinema_id, starts_at")
    .gte("starts_at", nowIso)
    .order("starts_at");
  if (cinemaFilterId) q = q.eq("cinema_id", cinemaFilterId);
  const { data: shows, error: es } = await q;
  if (es) throw es;
  const rows = shows ?? [];
  if (rows.length === 0) return [] as CarteleraItemDTO[];

  const filmIds = Array.from(new Set(rows.map((s) => s.film_id)));
  const { data: films, error: ef } = await supabaseAdmin
    .from("films")
    .select("*")
    .in("id", filmIds);
  if (ef) throw ef;

  const byFilm = new Map<
    string,
    { count: number; cinemas: Set<string>; next: string }
  >();
  for (const s of rows) {
    const cur = byFilm.get(s.film_id);
    if (!cur) {
      byFilm.set(s.film_id, {
        count: 1,
        cinemas: new Set([s.cinema_id]),
        next: s.starts_at,
      });
    } else {
      cur.count++;
      cur.cinemas.add(s.cinema_id);
      if (s.starts_at < cur.next) cur.next = s.starts_at;
    }
  }

  const items: CarteleraItemDTO[] = (films ?? []).map((f) => {
    const agg = byFilm.get(f.id);
    return {
      ...(f as FilmDTO),
      showtime_count: agg?.count ?? 0,
      cinema_count: agg?.cinemas.size ?? 0,
      next_show_at: agg?.next ?? null,
    };
  });

  // Ordena por próximo pase (más cercano primero)
  items.sort((a, b) => {
    if (!a.next_show_at) return 1;
    if (!b.next_show_at) return -1;
    return a.next_show_at.localeCompare(b.next_show_at);
  });

  return items;
});
