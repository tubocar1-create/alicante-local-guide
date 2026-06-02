# Motor Inteligente de Predicción Operacional — Buses Vectalia Alicante

## Objetivo

Reemplazar la dependencia de realtime (bloqueado por Akamai) por un **motor predictivo autónomo** que estima posición de buses y ETAs usando horarios oficiales + geometría + aprendizaje estadístico + snapshots manuales del operador.

## Arquitectura en 4 capas

```text
CAPA 1  Horarios oficiales Vectalia (estáticos, ya en bus-static)
   │
CAPA 2  Modelo estadístico histórico (segmentos, ciclos, descansos)
   │
CAPA 3  Motor predictivo (buses virtuales, posición, ETA)
   │
CAPA 4  Recalibración por snapshots manuales (EWMA α≈0.2)
```

Sin workers de scraping, sin polling, sin Akamai. Todo se calcula on-demand en el cliente o en serverFn ligera leyendo de Supabase.

## Modelo de datos (nuevo)

Tablas en Supabase (migración):

1. **`bus_line_geometry`** — polyline y orden de paradas por línea+sentido
   - `line`, `direction` (IDA/VUELTA), `polyline` (array [lat,lng]), `stops_ordered` (array codes), `total_distance_m`
2. **`bus_segment_stats`** — aprendizaje por segmento parada→parada
   - `from_stop`, `to_stop`, `line`, `distance_m`, `avg_minutes`, `rush_minutes`, `night_minutes`, `weekday_minutes`, `holiday_minutes`, `samples`, `confidence`, `updated_at`
3. **`bus_cycle_stats`** — duración ciclo por línea
   - `line`, `cycle_avg`, `cycle_morning`, `cycle_afternoon`, `cycle_night`, `terminal_wait_avg`, `terminal_wait_min`, `terminal_wait_max`, `samples`
4. **`bus_schedules`** — salidas programadas (seed manual desde Vectalia PDFs)
   - `line`, `direction`, `departure_time` (HH:MM), `day_type` (weekday/saturday/sunday/holiday), `from_terminal`
5. **`bus_snapshots`** — snapshots manuales del operador
   - `id`, `timestamp`, `line`, `stop_id`, `eta_clock`, `direction`, `observed_by`, `notes`
6. **`bus_predictions_log`** — para medir deriva (opcional, fase 2)

GRANTs: `authenticated` SELECT en todas; INSERT en `bus_snapshots` solo admin via RLS con `has_role`.

## Módulos de código

### `src/lib/bus-engine/` (nuevo, pure TS, sin red)

- `geometry.ts` — haversine, distancia sobre polyline, snap-to-line, progreso 0..1
- `segments.ts` — lookup `bus_segment_stats`, fallback a velocidad urbana (16 km/h diurno, 28 km/h nocturno)
- `cycle.ts` — duración ciclo, descanso terminal aprendido
- `schedule.ts` — generador de **buses virtuales** desde `bus_schedules` para una ventana [-cycleDuration, now]
- `position.ts` — para cada bus virtual: tiempo transcurrido desde salida → distancia recorrida → punto en polyline + segmento actual + progreso
- `eta.ts` — `ETA = scheduled + learnedDelay + segmentCorrection + timeProfile + trafficProfile`
- `confidence.ts` — score 0..1 a partir de samples, antigüedad, varianza
- `learning.ts` — EWMA `T_new = 0.2·observed + 0.8·hist`, detector hora pico
- `peak-detector.ts` — clasifica timestamp en morning_peak / midday / afternoon_peak / night / weekend / holiday
- `index.ts` — `predictLineState(line, now)` devuelve el JSON output del brief

### ServerFns (`src/lib/bus-predict.functions.ts`)

- `predictLine({ line, at? })` → `{ line, timestamp, buses[], stops[] }`
- `predictStop({ stopCode, at? })` → lista ETAs por línea
- `submitSnapshot({ line, stopId, etaClock, direction })` — admin only, dispara `learning.applySnapshot()` que actualiza `bus_segment_stats` y `bus_cycle_stats` vía EWMA
- `getLineGeometry({ line })` — sirve polyline + stops_ordered (cacheable, staleTime alto)

### UI

- **`FavoriteStopWidget`** — reemplazar fetch realtime por `predictStop()`. Mantener diseño. Mostrar `etaMinutes`, badge confidence opcional. Botón externo `target="_blank"` a `qr.vectalia.es/Alicante/mapa.aspx?...` se mantiene.
- **`BusLineLiveMap`** — consumir `predictLine()`. Renderizar marcadores de buses virtuales sobre polyline con interpolación suave (rAF, lerp entre dos ticks de predicción cada 15s). Flecha de dirección.
- **`StopRealtimeSheet`** — usar `predictStop()`.
- **Nueva ruta `/admin/bus-snapshots`** — formulario para operador: línea, parada, hora observada → `submitSnapshot`. Lista últimos 50 snapshots con impacto en estadísticas.

### Eliminar/desactivar

- Llamadas a `bus-realtime.functions.ts` / `bus-eta` (mantener archivos por ahora, marcar deprecated en comentario). No tocar `liveStopUrl` (sigue siendo el deep-link externo).
- Edge functions `bus-eta` y `bus-eta-raw`: dejar pero marcadas como no usadas.

## Seed inicial

Sin snapshots históricos reales, arrancamos con:
- `bus_segment_stats`: `avg_minutes = distance_m / (16 km/h)` + dwell 15s, `samples = 0`, `confidence = 0.3` (baseline puro).
- `bus_cycle_stats`: suma de segmentos ida+vuelta + 5 min descanso terminal por defecto.
- `bus_schedules`: poblar manualmente para línea 12 como piloto (resto se añade después).

A medida que el operador introduce snapshots, EWMA acerca los valores a la realidad y `confidence` sube con `samples`.

## Fases de entrega

1. **Migración SQL** + seed mínimo línea 12 (geometría + horarios + segmentos baseline).
2. **`src/lib/bus-engine/`** + serverFns predictivas con tests unitarios mentales sobre línea 12.
3. **Migrar `FavoriteStopWidget`** al motor predictivo. Verificar en preview.
4. **Migrar `BusLineLiveMap`** con interpolación rAF.
5. **Panel `/admin/bus-snapshots`** para recalibración.
6. **Confidence en UI** + log opcional de deriva.

## Detalles técnicos clave

- **Buses virtuales**: para cada `departure_time` ∈ [now - cycleDuration, now], crear bus con `elapsed = now - departure`. Si `elapsed > cycleDuration`, status `finished`. Si en terminal, `terminal_wait`.
- **Posición sobre polyline**: acumular `segment.avg_minutes` ajustado por perfil horario hasta consumir `elapsed`; el sobrante define progreso dentro del segmento actual → interpolación lineal sobre los puntos de polyline correspondientes a ese segmento.
- **Perfil horario** (`timeProfileCorrection`): factor multiplicador sobre `avg_minutes` según `peak-detector` (ej. morning_peak ×1.25).
- **Snapshot manual**: `observed_segment_time = etaClock_observado - last_known_passage` → EWMA contra `avg_minutes` del segmento correspondiente. También recalibra `cycle_stats` si es snapshot en terminal.
- **Confidence**: `min(1, samples/30) × exp(-ageDays/14) × (1 - normalizedStdDev)`.
- **Sin IA generativa, sin embeddings**. Matemática pura.

## Lo que NO se toca

- Estructura de rutas existentes (regla de oro). El widget sigue siendo el widget; el mapa sigue siendo el mapa.
- Diseño visual de `FavoriteStopWidget`.
- Deep link externo `liveStopUrl` → `qr.vectalia.es`.
- Categoría/agente: el motor solo refleja resultados, no cambia navegación.

## Alcance de esta entrega

Si apruebas, implemento **fases 1–3** en este turno (migración + engine + widget favorito funcionando con predicción). Fases 4–6 (mapa con rAF, panel admin snapshots, confidence en UI) en turnos siguientes para mantener cambios revisables.
