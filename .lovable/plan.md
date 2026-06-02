# Fase 3 — Motor predictivo profesional de flotas virtuales

Refactor del motor `bus-engine` + capa de persistencia para que la flota virtual respete horarios oficiales como verdad base, calcule fleet_size real, ancle buses a terminales, valide consistencia, degrade confianza y entre en SAFE MODE cuando los datos fallen. El mapa pasa a ser puramente lector.

## 1. Schema (migración única)

Ampliar `virtual_buses` con anclaje + telemetría:
- `departure_time time` — hora oficial de salida
- `origin_terminal text` — "Puerta del Mar" | "Plaza Juan Pablo II"
- `service_slot text` — `07-09`, `09-12`, `12-15`, `15-18`, `18-22`, `22-06`
- `anchored_to_departure boolean default true`
- `phase_error_sec integer default 0`
- `reliability numeric default 0.5`
- `last_observation_sec integer` — segundos desde última observación real
- `speed_kmh numeric`
- `safe_mode boolean default false`

Nueva tabla `bus_engine_health`:
- `line_code text PK`, `last_tick_at`, `last_tick_sec int`, `engine_alive bool`,
  `prediction_quality text` (`high`|`medium`|`low`|`safe`), `active_buses int`,
  `fleet_size_expected int`, `avg_confidence numeric`, `safe_mode bool`,
  `learning_active bool`, `meta jsonb`.
- GRANT public SELECT, admin manage; RLS pública lectura.

Nueva tabla `bus_segment_stats_slot` (estadísticas por slot horario):
- `line_code, direction, from_stop, to_stop, day_type, service_slot,
  avg_minutes, samples, confidence, updated_at`.
- GRANT idem.

## 2. Módulos nuevos en `src/lib/bus-engine/`

### `slots.ts`
- `getServiceSlot(at)` → uno de los 6 slots.
- `getActiveHeadway(plan, slot)` y `getCycleTime(plan, slot)` usando `bus_headway_stats` + `bus_cycle_stats`.

### `fleet-sizer.ts`
- `computeFleetSize(cycleMin, headwayMin)` → `ceil(cycle/headway)` con tope `+1`.
- `enumerateAnchoredDepartures(plan, slot, now)` → lista de `{departureTime, terminal, direction, slotKey}` derivada de `bus_line_departures` (verdad oficial). Solo entran al motor salidas oficiales o snapshots confirmados.

### `fleet-validator.ts`
- `validateFleetConsistency(fleet, plan)`:
  - elimina duplicados (mismo `trip_key`/dirección/salida),
  - calcula `spacing_sec` entre buses consecutivos,
  - aplica `min_spacing = headway*0.45`, `max_spacing = headway*2.2`,
  - marca conflictos: degrada confianza, fusiona pares casi-idénticos, descarta el más débil cuando overlap.
  - filtra velocidades fuera de `[6,42] km/h`.
  - cap final a `fleet_size + 1`.

### `confidence.ts` (extender)
- `scoreBus(bus, ctx)` combinando:
  - positivo: observación <5min, spacing válido, velocidad razonable, phase_error<60s.
  - negativo: drift>180s, sin snapshot >15min, spacing inválido.
- Degradación temporal: `0–5m=alta`, `5–15m=media`, `15–30m=baja`, `>30m=safe`.

### `safe-mode.ts`
- `shouldEnterSafeMode(fleet, health)` si `avg_confidence<0.35` o `last_snapshot_age>30min` o `validator descartó >40%`.
- En SAFE MODE: generar buses SOLO desde `bus_line_departures` interpolando linealmente sobre la geometría con velocidad media histórica. Sin corrección agresiva. Marcar `safe_mode=true` en cada bus y en `bus_engine_health.prediction_quality='safe'`.

### `eta-propagation.ts`
- Reemplaza interpolación lineal por:
  `eta = base_from_position(bus, stop) + Σ segment_speed_slot + Σ dwell_slot + traffic_factor + phase_correction`.
- `segment_speed_slot` viene de `bus_segment_stats_slot` (fallback a `bus_segment_stats`).

### Refactor de `fleet.ts`
- `buildLineFleetPlan` usa slot activo + cycle_time + headway por slot.
- `generateActiveFleet` ahora:
  1. enumera salidas oficiales del slot,
  2. para cada salida calcula `elapsed = now - departure_time`,
  3. posiciona bus en ciclo (IDA→regulación→VUELTA),
  4. aplica `phase_correction` por slot del bus,
  5. ejecuta `validateFleetConsistency`,
  6. ejecuta `scoreBus` y `shouldEnterSafeMode`.
- `deriveStopEtas` usa `eta-propagation`.

## 3. Server functions (`src/lib/bus-fleet.functions.ts`)

- `tickVirtualFleet({line})` (ya existe) — refactor:
  - llama al nuevo flujo (slot-aware, validador, safe-mode),
  - persiste campos nuevos (`departure_time`, `origin_terminal`, `service_slot`,
    `phase_error_sec`, `reliability`, `speed_kmh`, `safe_mode`),
  - UPSERT en `bus_engine_health` (alive, quality, fleet_size_expected vs real, avg_confidence).
- `tickAllLines()` nuevo — itera líneas activas para tick masivo.
- `getEngineHealth({line?})` nuevo.
- `reportRealtimeObservation` (existe) — ampliar para actualizar `bus_segment_stats_slot` (WMWA, peso 0.6 live, 1.0 snapshot manual) y `last_observation_sec`.

## 4. Tick autónomo server-side

Nueva route `src/routes/api/public/hooks/bus-fleet-tick.ts`:
- POST verificada con `BUS_FLEET_TICK_SECRET`,
- llama `tickAllLines()`,
- pensada para pg_cron / scheduler externo cada 20s (en la práctica cada minuto vía cron Lovable, suficiente para empezar — el frontend sigue pidiendo `tickVirtualFleet` por línea cuando se abre).

## 5. Mapa = solo lectura

`BusLineLiveMap.tsx`:
- Eliminar la lógica que dispara `tickVirtualFleet` desde cliente (mantener fallback de cortesía si `last_tick_sec>60`).
- Solo `getActiveFleet` cada 3s + interpolación visual suave client-side (lerp entre dos snapshots consecutivos).
- Badge "estimación histórica" cuando algún bus tiene `safe_mode=true`.

## 6. Dashboard

`bus.dashboard.$code.tsx`:
- Sigue reportando observaciones (preview real).
- Mostrar `prediction_quality` y `active_buses / fleet_size_expected` del health.
- Si SAFE MODE → badge ámbar "Datos históricos".

## 7. Reglas duras (en código, no negociables)

- Sin salida oficial ni snapshot ⇒ **no se crea bus**.
- `fleet.length ≤ fleet_size + 1`.
- Velocidad fuera de `[6,42] km/h` ⇒ bus degradado o descartado.
- Spacing fuera de rango ⇒ resolver, no ocultar.
- Mapa nunca calcula posiciones absolutas; solo interpola entre dos lecturas.

## Notas técnicas

- HTTPS-only se mantiene: el tick server-side corre en producción; en preview el cliente puede seguir disparando ticks bajo demanda para iterar.
- Aprendizaje continuo: cada observación real alimenta `bus_segment_stats_slot` + `phase_correction` con WMWA (α≈0.3).
- Todo el código nuevo es puro TS bajo `src/lib/bus-engine/`, sin dependencias nuevas.
- Migración única con GRANTs explícitos para las dos tablas nuevas.

## Entregables por orden

1. Migración (schema + tablas nuevas + GRANTs + RLS).
2. Módulos `slots.ts`, `fleet-sizer.ts`, `fleet-validator.ts`, `safe-mode.ts`, `eta-propagation.ts`.
3. Refactor `fleet.ts` + `confidence.ts`.
4. Refactor `bus-fleet.functions.ts` + nuevo endpoint cron.
5. Mapa y dashboard como consumidores puros.

¿Apruebas el plan o ajustamos algo antes de migrar?
