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
  opening_hours: unknown;
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
