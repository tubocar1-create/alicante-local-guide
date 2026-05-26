## Objetivo

Crear el módulo **Teatro, conciertos y eventos** clonando la arquitectura de Cines (Dashboard cronológico + Cartelera visual + BD + scraping + purga), reemplazando los dos botones actuales (`/ocio/teatros` y `/ocio/conciertos`) por uno único.

## 1. Cambios en Ocio (entrada)

- En `src/routes/ocio.tsx`: sustituir los botones de **Teatros** y **Conciertos** por uno solo: **🎭 Teatro, conciertos y eventos** → `/ocio/eventos`.
- Mantener `ocio_.teatros.tsx` y `ocio_.conciertos.tsx` como redirects a `/ocio/eventos` (compatibilidad).

## 2. Base de datos (nuevas tablas)

Inspirado en `cinemas` / `films` / `showtimes`:

- **`venues`** — recintos (Teatro Principal, ADDA, Plaza de Toros, Área 12, Muelle Live, etc.)
  - `id`, `slug`, `name`, `kind` (teatro|sala|auditorio|recinto|waterfront|congresos), `address`, `lat`, `lng`, `website`, `cover_url`, `phone`
- **`events`** — eventos en cartel
  - `id`, `slug`, `title`, `category` (teatro|concierto|opera|danza|musical|festival|humor|otro), `description`, `poster_url`, `duration_min`, `age_rating`, `genre`, `artist`, `source_url`, `created_at`, `updated_at`
- **`event_showtimes`** — pases (1 evento puede tener varias fechas/sitios)
  - `id`, `event_id` FK, `venue_id` FK, `starts_at` (timestamptz), `price_min`, `price_max`, `currency`, `ticket_url`, `availability` (disponible|agotado|n/d)
- **`event_sources`** — fuentes para el scraper (las 15 webs del prompt)
  - `id`, `venue_id`, `url`, `last_scraped_at`, `enabled`

Reglas:
- RLS pública SELECT en las 4 tablas (lectura abierta como `cinemas`).
- Insert/update solo vía `supabaseAdmin` (scraper).
- Trigger `update_updated_at_column` en `events`.
- Constraint: `starts_at <= '2026-12-31 23:59:59 Europe/Madrid'` (validación via trigger, no CHECK).
- Función `purge_event_showtimes_past(p_retention interval default '1 day')` análoga a `purge_showtimes_past`.
- Función `purge_events_orphan()` para borrar eventos sin pases vigentes.
- Seed inicial: insertar las 15 `venues` del listado con su `website`.

## 3. Scraping

- Server route `src/routes/api/public/hooks/eventos-sync.ts` (estilo `cinemas-sync.ts`).
- Usa **Firecrawl** (`FIRECRAWL_API_KEY` ya disponible) para extraer eventos por venue.
- Para cada venue habilitado: scrape → parseo con Lovable AI (`google/gemini-2.5-flash`) → upsert en `events` + `event_showtimes`.
- Descarta eventos con `starts_at < now()` o `> 2026-12-31`.
- **pg_cron mensual** (día 1 a las 03:00) llama al endpoint con `apikey`.
- **pg_cron semanal** (domingos 04:00) ejecuta `purge_event_showtimes_past()` + `purge_events_orphan()`.

## 4. UI nuevo (estilo cines)

Rutas a crear, copiando layout/estética/paleta de `ocio_.cines.*` y `ocio_.cartelera.tsx`:

- **`/ocio/eventos`** — landing con dos accesos:
  - 📋 **Cronograma** (Dashboard) → `/ocio/eventos/agenda`
  - 🎟️ **Cartelera** (visual) → `/ocio/eventos/cartelera`
  - Lista de venues (tipo `ocio_.cines.tsx`)

- **`/ocio/eventos/agenda`** — Dashboard cronológico
  - Tabla compacta ordenada por fecha+lugar
  - Columnas: Fecha · Evento · Lugar · Precio · Ticket
  - Campos faltantes → "n/d"
  - Filtros: categoría, venue, mes

- **`/ocio/eventos/cartelera`** — Cartelera visual (clon de `ocio_.cartelera.tsx`)
  - Grid de posters 2/3/4/5 cols
  - Cada tarjeta: poster, título, categoría, próxima fecha, venue
  - Link a `/ocio/eventos/$id`

- **`/ocio/eventos/$id`** — detalle de evento (clon de `ocio_.pelicula.$id.tsx`)
  - Poster grande, descripción, lista de pases con fecha/lugar/precio/botón ticket

- **`/ocio/eventos/venue/$id`** — eventos por recinto (clon de `ocio_.cines.$id.tsx`)

Paleta: morado profundo (`#7c3aed` / `#f472b6`) para distinguir de cines (rosa) — pero misma estructura visual.

## 5. Server functions

`src/lib/eventos.functions.ts`:
- `listEvents({ from?, to?, category?, venueId? })` — para Dashboard
- `listEventsCartelera()` — agrupados por evento con próximo pase
- `getEventDetail(id|slug)`
- `listVenues()` / `getVenueWithEvents(id)`

Todas usan `supabase` (publishable) — son lectura pública.

## 6. Doctrina del agente (CPA)

Añadir intent `eventos_culturales` con keywords: teatro, concierto, ópera, ADDA, principal, plaza toros, área 12, muelle live, etc. → endpoint `/ocio/eventos`.

## Detalles técnicos

- **Posters faltantes**: placeholder con icono según categoría (🎭/🎵/🎤/💃) sobre gradiente del venue.
- **Remasterización visual**: usar `imagegen` solo bajo demanda (no automático en scraper para no quemar créditos); por ahora solo guardamos URL fuente y aplicamos `object-cover` + overlay.
- **Realtime no necesario** — refresh mensual es suficiente.
- **Compatibilidad**: las rutas viejas `/ocio/teatros` y `/ocio/conciertos` redirigen a `/ocio/eventos`.

## Orden de implementación

1. Migración BD (4 tablas + RLS + funciones de purga + seed de 15 venues).
2. `eventos.functions.ts` con queries de lectura.
3. UI: `ocio.eventos.tsx`, `ocio_.eventos.agenda.tsx`, `ocio_.eventos.cartelera.tsx`, `ocio_.eventos.$id.tsx`, `ocio_.eventos.venue.$id.tsx`.
4. Actualizar `ocio.tsx` (botón único) + redirects de teatros/conciertos.
5. Endpoint scraper `api/public/hooks/eventos-sync.ts`.
6. pg_cron (mensual scrape + semanal purga).
7. Intent CPA.
