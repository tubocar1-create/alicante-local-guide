
## Fase 2 — Persistencia y reconciliación

### Premisa del usuario
En **preview** (donde Akamai no bloquea) tenemos tiempos REALES.
En **HTTPS publicado** sólo tenemos el motor.
Usaremos el preview como "sensor de campo" que envía observaciones al backend para reconciliar la flota virtual.

### 1. Tabla auxiliar `bus_fleet_observations`
Migración nueva con: `id`, `line_code`, `direction`, `stop_code`, `observed_eta_min`, `observed_at`, `source` (`preview_real`, `snapshot_manual`), `client_id` (anon), `meta jsonb`. RLS: read público, insert anónimo (rate-limited por client_id en server), admin manage. Sirve de log de campo y de fuente para WMWA en `bus_segment_stats`.

### 2. ServerFn `tickVirtualFleet({ line })`
- Construye `LineFleetPlan` + `generateActiveFleet` (lo que ya tenemos).
- UPSERT en `virtual_buses` por `(line_code, direction, trip_key, service_date)` donde `trip_key = headway_slot = "BUS01"…"BUSNN"`.
- Marca `is_active=false` los buses de la línea que no estén en la flota actual (cambio de ventana horaria).
- Guarda `position_lat/lng`, `current_segment_idx`, `segment_progress`, `state`, `confidence`, `last_tick_at`, `meta` (con `cycleMin`, `headwayMin`).
- Idempotente: lo puede llamar cron / mapa / dashboard sin acumular filas.

### 3. ServerFn `getActiveFleet({ line })`
SELECT plano sobre `virtual_buses` filtrado por línea y `is_active=true`. Devuelve la forma que ya consume el mapa.

### 4. ServerFn `reportRealtimeObservation({ line, direction, stopCode, etaMin, source })`
- Inserta en `bus_fleet_observations`.
- Aplica reconciliación ligera:
  - Localiza el bus virtual cuyo trayecto futuro contenga esa parada antes y más cercano al `etaMin` observado.
  - Calcula `delta = etaMin_observado − etaMin_virtual`.
  - Si `|delta| > 1 min` y `|delta| ≤ 10 min`: ajusta `meta.phase_correction` del bus (desplaza fase en el ciclo) y bump `confidence` hacia arriba.
  - Si `|delta| > 10 min`: descartar (probable outlier o cambio de turno) y registrar solo log.
- Rate-limit: 1 inserción cada 10 s por `(client_id, line, stopCode)`.

### 5. Wiring en preview (HTTP only)
En `bus.dashboard.$code.tsx` y `FavoriteStopWidget`, cuando `usePredict === false` (preview) y llega un ETA real desde `getClientStopsRealtimeBatch`, disparar `reportRealtimeObservation` con `source="preview_real"`. Throttle a 30 s por parada+línea.

### 6. Mapa con flota persistida
`BusLineLiveMap`:
- En **HTTPS** (`usePredict===true`): hace `tickVirtualFleet` cada 10 s, lee `getActiveFleet` cada 3 s para refrescar marcadores. Posición intermedia se interpola en cliente entre ticks.
- En **preview**: sigue el camino actual (cliente predice sobre la marcha) — no se duplica esfuerzo.

### 7. fleet.ts: usar `meta.phase_correction`
`generateActiveFleet` lee, por slot, una corrección de fase persistida (si existe) desde una caché ligera (la pasaremos al construir el plan o la leeremos del registro `virtual_buses` previo). Mantenemos pura la función actual y añadimos una variante `generateActiveFleetWithCorrections(plan, corrections, at)`.

### Detalles técnicos
- `trip_key` estable = nombre del slot (`BUS01`…). `service_date` = fecha local Madrid.
- `tickVirtualFleet` y `reportRealtimeObservation` no requieren auth (rate-limit por IP/`client_id`).
- Todo HTTPS-only se mantiene desde el cliente (no se llama tick en preview, no se reconcilia desde HTTPS porque ahí no hay reales).

### Fuera del alcance (queda para Fase 3)
- Cron pg_cron de tick periódico (lo dejamos manual desde el cliente para no gastar).
- UI admin de calidad/varianza/derivación.
- Detección de bunching y gap visualizada en UI.

¿OK con este alcance o ajustamos antes de migrar?
