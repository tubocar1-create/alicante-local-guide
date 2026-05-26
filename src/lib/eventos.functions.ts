import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type VenueDTO = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  cover_url: string | null;
  notes: string | null;
};

export type EventDTO = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string | null;
  poster_url: string | null;
  duration_min: number | null;
  age_rating: string | null;
  genre: string | null;
  artist: string | null;
  source_url: string | null;
};

export type EventShowtimeDTO = {
  id: string;
  event_id: string;
  venue_id: string;
  starts_at: string;
  ends_at: string | null;
  price_min: number | null;
  price_max: number | null;
  currency: string | null;
  ticket_url: string | null;
  availability: string | null;
};

export const listVenues = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("venues")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as VenueDTO[];
});

export type AgendaRow = {
  showtime: EventShowtimeDTO;
  event: EventDTO;
  venue: VenueDTO;
};

// Dashboard cronológico: todos los pases vigentes ordenados por fecha+lugar.
export const listAgenda = createServerFn({ method: "GET" }).handler(
  async (): Promise<AgendaRow[]> => {
    const nowIso = new Date().toISOString();
    const { data: shows, error } = await supabaseAdmin
      .from("event_showtimes")
      .select("*")
      .gte("starts_at", nowIso)
      .order("starts_at");
    if (error) throw error;
    const rows = (shows ?? []) as EventShowtimeDTO[];
    if (rows.length === 0) return [];

    const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));
    const venueIds = Array.from(new Set(rows.map((r) => r.venue_id)));
    const [{ data: ev }, { data: vn }] = await Promise.all([
      supabaseAdmin.from("events").select("*").in("id", eventIds),
      supabaseAdmin.from("venues").select("*").in("id", venueIds),
    ]);
    const evMap = new Map((ev ?? []).map((e) => [e.id, e as EventDTO]));
    const vnMap = new Map((vn ?? []).map((v) => [v.id, v as VenueDTO]));
    return rows
      .map((s) => {
        const e = evMap.get(s.event_id);
        const v = vnMap.get(s.venue_id);
        if (!e || !v) return null;
        return { showtime: s, event: e, venue: v } satisfies AgendaRow;
      })
      .filter(Boolean) as AgendaRow[];
  },
);

export type CarteleraEventoDTO = EventDTO & {
  showtime_count: number;
  venue_count: number;
  next_show_at: string | null;
  next_venue_name: string | null;
  next_price_min: number | null;
};

// Cartelera visual: cada evento con su próximo pase agregado.
export const listEventosCartelera = createServerFn({ method: "GET" }).handler(
  async (): Promise<CarteleraEventoDTO[]> => {
    const nowIso = new Date().toISOString();
    const { data: shows, error } = await supabaseAdmin
      .from("event_showtimes")
      .select("*")
      .gte("starts_at", nowIso)
      .order("starts_at");
    if (error) throw error;
    const rows = (shows ?? []) as EventShowtimeDTO[];
    if (rows.length === 0) return [];

    const eventIds = Array.from(new Set(rows.map((r) => r.event_id)));
    const venueIds = Array.from(new Set(rows.map((r) => r.venue_id)));
    const [{ data: ev }, { data: vn }] = await Promise.all([
      supabaseAdmin.from("events").select("*").in("id", eventIds),
      supabaseAdmin.from("venues").select("*").in("id", venueIds),
    ]);
    const venueMap = new Map((vn ?? []).map((v) => [v.id, v as VenueDTO]));

    const agg = new Map<
      string,
      {
        count: number;
        venues: Set<string>;
        next: string;
        nextVenue: string | null;
        nextPrice: number | null;
      }
    >();
    for (const s of rows) {
      const cur = agg.get(s.event_id);
      const v = venueMap.get(s.venue_id);
      if (!cur) {
        agg.set(s.event_id, {
          count: 1,
          venues: new Set([s.venue_id]),
          next: s.starts_at,
          nextVenue: v?.name ?? null,
          nextPrice: s.price_min,
        });
      } else {
        cur.count++;
        cur.venues.add(s.venue_id);
        if (s.starts_at < cur.next) {
          cur.next = s.starts_at;
          cur.nextVenue = v?.name ?? null;
          cur.nextPrice = s.price_min;
        }
      }
    }

    const items: CarteleraEventoDTO[] = (ev ?? []).map((e) => {
      const a = agg.get(e.id);
      return {
        ...(e as EventDTO),
        showtime_count: a?.count ?? 0,
        venue_count: a?.venues.size ?? 0,
        next_show_at: a?.next ?? null,
        next_venue_name: a?.nextVenue ?? null,
        next_price_min: a?.nextPrice ?? null,
      };
    });

    items.sort((a, b) => {
      if (!a.next_show_at) return 1;
      if (!b.next_show_at) return -1;
      return a.next_show_at.localeCompare(b.next_show_at);
    });
    return items;
  },
);

export const getEventoWithShowtimes = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: evento, error: ee } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (ee) throw ee;
    if (!evento) return { evento: null, showtimes: [], venues: [] };

    const nowIso = new Date().toISOString();
    const { data: shows, error: es } = await supabaseAdmin
      .from("event_showtimes")
      .select("*")
      .eq("event_id", evento.id)
      .gte("starts_at", nowIso)
      .order("starts_at");
    if (es) throw es;
    const showtimes = (shows ?? []) as EventShowtimeDTO[];
    const venueIds = Array.from(new Set(showtimes.map((s) => s.venue_id)));
    let venues: VenueDTO[] = [];
    if (venueIds.length > 0) {
      const { data: vn } = await supabaseAdmin
        .from("venues")
        .select("*")
        .in("id", venueIds);
      venues = (vn ?? []) as VenueDTO[];
    }
    return { evento: evento as EventDTO, showtimes, venues };
  });

export const getVenueWithEvents = createServerFn({ method: "POST" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { data: venue, error: ev } = await supabaseAdmin
      .from("venues")
      .select("*")
      .eq("slug", data.slug)
      .maybeSingle();
    if (ev) throw ev;
    if (!venue) return { venue: null, showtimes: [], events: [] };

    const nowIso = new Date().toISOString();
    const { data: shows, error: es } = await supabaseAdmin
      .from("event_showtimes")
      .select("*")
      .eq("venue_id", venue.id)
      .gte("starts_at", nowIso)
      .order("starts_at");
    if (es) throw es;
    const showtimes = (shows ?? []) as EventShowtimeDTO[];
    const eventIds = Array.from(new Set(showtimes.map((s) => s.event_id)));
    let events: EventDTO[] = [];
    if (eventIds.length > 0) {
      const { data: ed } = await supabaseAdmin
        .from("events")
        .select("*")
        .in("id", eventIds);
      events = (ed ?? []) as EventDTO[];
    }
    return { venue: venue as VenueDTO, showtimes, events };
  });
