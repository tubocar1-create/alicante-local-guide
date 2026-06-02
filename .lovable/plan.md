## Objetivo

Reemplazar el motor predictivo por un **lector de snapshots realtime + interpolación visual**. Vectalia (vía endpoint ya existente `/api/public/bus-eta`) es la única fuente de verdad. El motor actual (carousel, fleet, slots, learning, peak-detector, etc.) se **desactiva pero se conserva** en disco por si hay que volver.

## Arquitectura nueva

```text
[pg_cron 5min] → [/api/public/hooks/bus-realtime-snapshot]
                       ↓ para cada (línea, parada) activa
                 fetch /api/public/bus-eta?stop=X&line=Y
                       ↓
                 INSERT public.bus_realtime_snapshots
                       ↓
[useBusRealtime hook] ← lee snapshot más reciente
                       ↓
[interpolación visual cliente cada 5-10s]
                       ↓
        UI: dashboard, mapa, LiveEta
```

## Tabla nueva

`public.bus_realtime_snapshots` con columnas: `id`, `captured_at`, `line_code`, `stop_code`, `direction`, `eta_minutes` (int[]), `source` (text). Índice por `(line_code, captured_at DESC)` y `(stop_code, line_code, captured_at DESC)`. RLS público de lectura, escritura solo `service_role`.

## Hook server (snapshot cycle)

`src/routes/api/public/hooks/bus-realtime-snapshot.ts`:
- Lee de `bus_line_stops` qué (líneas, paradas, direcciones) están activas
- Por cada combinación, llama internamente al endpoint Vectalia existente
- Inserta filas en `bus_realtime_snapshots`
- Limita concurrencia (batch de 5) para no saturar
- Auto-purga snapshots > 24h

## pg_cron

```sql
SELECT cron.schedule('bus-realtime-snapshot', '*/5 * * * *', ...);
```

## Motor: desactivar

- `src/lib/bus-engine/predict.ts` y `fleet.ts`: las funciones `predictLineState` y `predictStopArrivals` se **reescriben** para leer de `bus_realtime_snapshots` + interpolar, en lugar de delegar a `predictLineFromFleet`.
- Los archivos `carousel.ts`, `fleet-sizer.ts`, `fleet-validator.ts`, `slots.ts`, `peak-detector.ts`, `extra-bus-activation.ts`, `learning.ts`, `temporal-consistency.ts`, `active-window.ts`, `safe-mode.ts`, `confidence.ts`, `schedule.ts`, `segments.ts` quedan **en disco intactos** pero sin imports vivos (se elimina su re-export del `index.ts` salvo `types`, `geometry`, `from-snapshot`).
- `bus-snapshot-learning.functions.ts`, `bus-fleet.functions.ts` quedan en disco pero su cron asociado se pausa (`SELECT cron.unschedule(...)`).

## Lectura + interpolación

Nuevo `src/lib/bus-engine/realtime.ts`:
- `loadRealtimeLineState(lineCode, at)` → server fn que devuelve último snapshot de cada parada de la línea
- `interpolateBuses(snapshot, now)` → puro cliente: decrementa ETAs según `(now - capturedAt)` segundos, clamp a 0; marca buses como `stale` si snapshot > 5min, `frozen` si > 10min
- Reconstruye VirtualBus[] agrupando ETAs por dirección y detectando continuidad simple (ETAs decrecientes = mismo bus)
- Velocidad clamp 6-42 km/h

## Cambios UI

- `useBusEngine` cambia su `queryFn` para consumir `loadRealtimeLineState` (TTL 30s en cliente, snapshot real cada 5min servidor)
- `bus.dashboard.$code.tsx`: usa el nuevo estado realtime. Si snapshot > 10min, banner "Actualizando datos realtime".
- `BusLineLiveMap`, `LiveEta`, `RealtimeMiniMap`: consumen mismo hook. Interpolación visual cada 5s vía `setInterval`.

## Reglas duras implementadas en código

- No se crean VirtualBus que no aparezcan en snapshot
- Sin terminal_wait → next trip autónomo: cuando un bus desaparece del snapshot, queda `disappeared` hasta el próximo refresh
- Sin generación de flota, sin slots, sin learning
- Si `bus_realtime_snapshots` no tiene filas recientes para la línea: estado `freeze` y mensaje al usuario

## Pasos de implementación

1. Migración: crear `bus_realtime_snapshots` con GRANTs + RLS + índices
2. Crear hook `bus-realtime-snapshot.ts` con fetch interno a `bus-eta` por (stop,line) de `bus_line_stops`
3. Programar pg_cron cada 5min + pausar crons del motor viejo (`bus-fleet-tick`)
4. Crear `src/lib/bus-engine/realtime.ts` + server fn `loadRealtimeLineState`
5. Reescribir `predict.ts` y `fleet.ts::predictLineFromFleet/predictStopFromFleet` para delegar a realtime + interpolación
6. Limpiar `src/lib/bus-engine/index.ts` para exportar solo lo vivo
7. Actualizar `useBusEngine` y verificar que dashboard/map siguen renderizando
8. QA: revisar `/bus/dashboard/12`, comprobar que ETAs vienen de snapshot y que la interpolación es suave

## Qué NO se toca

- Endpoint `/api/public/bus-eta` (Vectalia raw) — sigue siendo la fuente
- Datos estáticos `bus_line_stops`, `bus_lines`, `bus_stops` — los uso para saber qué consultar
- Estructura de páginas y rutas — solo cambia el dato que reciben
- Archivos del motor viejo permanecen en disco para rollback rápido