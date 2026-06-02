## Objetivo

Hacer cumplir la jerarquía: **topología > horarios > flota > continuidad > observaciones > aprendizaje > interpolación**. El aprendizaje deja de poder inventar buses; solo ajusta/suaviza/degrada/oculta.

## Cambios (todos en `src/lib/bus-engine/`, sin tocar UI ni rutas)

### 1. Nuevo `active-window.ts`
- `isWithinActiveServiceWindow(departureTime, now, cycleMin)` → bool.
- Un `VirtualBus` solo existe si `departure_time <= now <= departure_time + cycleMin + grace(2 min)`.
- Buses fuera de ventana se descartan **antes** de pasar al validador.

### 2. Nuevo `anchor.ts`
- Toda salida que entre al motor debe llevar `anchor_departure_id` derivado de `bus_line_departures` (oficial) o sintética marcada `synthetic=true` con timestamp explícito.
- `generateActiveFleet` rechaza cualquier candidato sin anchor.

### 3. `fleet-validator.ts` (extender) — nuevo `validateTemporalConsistency(fleet, plan)`
Por dirección:
- ETA por parada **monotónica creciente** a lo largo de la secuencia (con tolerancia 30 s).
- Sin retrocesos (`eta[i+1] >= eta[i] - 0.5 min`).
- Sin saltos absurdos (`eta[i+1] - eta[i] <= maxSegmentMinutes * 3`).
- Máx **un origen activo + un origen futuro inminente** por dirección (descarta el resto).
- Buses superpuestos (mismo spacing < headway * 0.25) → fusión, queda el de mayor confianza.
- Cualquier bus que viole estas reglas: `discard` (no se renderiza, queda log).

### 4. `fleet-sizer.ts` / `line-profiles.ts` — endurecer
- Cap duro `min(fleetSizeExpected + 1, profile.fleetSizeMax)`.
- Para línea 12 después de 22:00 forzar `expected_max = 2` (ya existe en perfil; aquí se aplica como **hard cap** en el validator, no solo como target).

### 5. `fleet.ts::generateActiveFleet` — reescribir el orden
1. Enumerar salidas oficiales del slot (única fuente de origen).
2. Filtrar por `isWithinActiveServiceWindow` (descarta futuras y expiradas).
3. Posicionar cada bus en ciclo.
4. Aplicar `phase_correction` (aprendizaje suaviza, no reposiciona libremente: clamp ±90 s).
5. `validateFleetConsistency` (spacing, velocidad, duplicados).
6. `validateTemporalConsistency` (nuevo).
7. Cap final por flota esperada.
8. `scoreBus` + `shouldEnterSafeMode`.

### 6. Cierre de ciclo
- Un bus cuyo `now > departure_time + cycleMin + grace` se archiva (no se reutiliza). El siguiente ciclo nace de la siguiente salida oficial, nunca del bus anterior.

### 7. Failsafe (`safe-mode.ts`) — endurecer
- Si `prediction_quality < 'medium'`: el motor devuelve **solo** los buses con confianza ≥ 0.6 y oculta el resto. Mejor mostrar 1 bus creíble que 4 dudosos.
- ETAs en SAFE MODE: solo desde `bus_line_departures` + velocidad media histórica, sin corrección de fase.

### 8. Aprendizaje (`learning.ts`) — limitar
- Solo puede modificar: `phase_correction (±90 s)`, `segment_speed`, `dwell`, `eta_offset`, `activation_score` (probabilidad de bus extra).
- **No** decide cuántos buses hay, ni dónde nacen — eso lo dicta el scheduler (salidas oficiales + perfil).

### 9. UI (sin cambios)
- `BusLineLiveMap` y dashboard siguen siendo lectores. No se tocan rutas, columnas IDA/VUELTA, ni los ETAs reales del preview.

## Riesgos / no se toca
- No se cambia la API pública de `bus-engine/index.ts` (mismas exports).
- No se toca `bus-fleet.functions.ts` salvo para persistir nuevos campos ya existentes en schema (`anchor_departure_id` se añade a `virtual_buses.meta` si no existe la columna).
- No se crea migración nueva — se reutiliza `meta jsonb` para `anchor_departure_id` y `synthetic`.

## Validación
- `code--exec` para `tsc --noEmit` lo corre el harness; reviso build output.
- Inspección visual del dashboard de línea 12 en preview para confirmar: ≤4 buses en horario diurno, ≤2 después de 22:00, sin ETAs decrecientes, sin orígenes múltiples.
