
# Refactor del motor predictivo: de ETAs interpoladas a buses virtuales persistentes

## Diagnóstico del estado actual

Hoy el motor (`src/lib/bus-engine/`) calcula tiempos por segmento y los suma desde la próxima salida programada para producir ETAs por parada. Los "buses" que se ven son derivados visuales de esas ETAs. Esto produce los síntomas que describes: espaciado matemático, sin regulación terminal, sin bunching, sin flota inferida.

## Nuevo modelo (resumen)

La entidad raíz pasa a ser **`VirtualBus`** persistente con estado, posición sobre la polilínea y trip activo. Las ETAs se **derivan** del estado de cada bus, nunca al revés.

```text
snapshots + horarios + geometría + stats
        │
        ▼
   FLOTA INFERIDA (N buses activos para esta ventana)
        │
        ▼
   SIMULACIÓN CONTINUA (tick → mover/dwell/regular)
        │
        ▼
   ETAs DERIVADAS POR PARADA  +  POSICIONES PARA EL MAPA
```

## Alcance de esta entrega (Fase 1)

Para mantener el cambio revisable, esta entrega ataca el núcleo:

1. **Tabla `virtual_buses`** (persistencia + identidad continua) y `bus_segment_stats` extendida con ventana horaria.
2. **Nuevo módulo `src/lib/bus-engine/fleet/`** con:
   - `cycle.ts` — `cycle_time = outbound + inbound + regulación`.
   - `fleet-inference.ts` — `active_buses = round(cycle_time / headway)` por ventana horaria.
   - `simulation.ts` — tick que mueve buses, aplica dwell y detecta regulación terminal.
   - `derive-etas.ts` — produce las ETAs por parada a partir del estado de la flota (no al revés).
   - `reconcile.ts` — al recibir snapshot, asigna observación al bus virtual más probable y corrige velocidad/headway.
3. **ServerFn `tickVirtualFleet({ line })`** que avanza la simulación y persiste el estado. Se invoca on-demand desde el dashboard y desde el widget.
4. **Dashboard (`bus.dashboard.$code.tsx`)** y **`FavoriteStopWidget`**: consumen `deriveEtasFromFleet()` en lugar del cálculo lineal actual. En HTTPS sigue siendo el único origen; en preview se mantiene la lectura real (regla actual intacta).
5. **`BusLineLiveMap`**: los marcadores leen `virtual_buses` (posición, dirección, estado, confianza) en vez de interpolar entre paradas.

## Fuera de alcance (fases siguientes, separadas)

- Detección automática de incorporación/desincorporación de buses (fase 2).
- Bunching/gap detection visible en UI (fase 2).
- Panel admin de calidad por línea con confianza, varianza y deriva (fase 3).
- Aprendizaje bayesiano completo con peak_factor por ventana (fase 2 — ahora WMWA simple ya existente).

## Detalles técnicos clave

- **Identidad persistente**: `virtual_buses` se actualiza por `UPDATE`, no se borra y recrea por consulta. `bus_id = line|direction|trip_id|service_date`.
- **Estados**: `moving | dwell_stop | terminal_regulation | layover | out_of_service`. El bus que llega a terminal pasa a `terminal_regulation` durante `terminal_wait_avg`, luego arranca el siguiente trip — no desaparece.
- **Tick**: idempotente por `now`. Calcula `Δt = now - last_tick`, avanza `distance_from_origin` según velocidad del segmento ajustada por ventana horaria, gestiona dwell y regulación.
- **Inferencia de flota**: por ventana horaria (`early_morning`, `morning_peak`, `midday`, `afternoon_peak`, `evening`, `night`), calcula `headway` desde `bus_schedules` y produce `active_buses = round(cycle_time / headway)`. Buses sobrantes pasan a `out_of_service`.
- **Reconciliación con snapshot**: dado `(stop, eta_observada)`, busca el bus virtual cuyo ETA derivado esté más cerca; aplica WMWA al segmento correspondiente y reajusta su `distance_from_origin`. Si ningún bus encaja dentro de tolerancia, crea uno nuevo (incorporación) o marca outlier.
- **Confianza por bus**: `f(snapshot_age, sample_count, variance, gap_desde_última_observación)`. Se propaga a las ETAs derivadas.
- **HTTPS-only para la simulación**: se mantiene la regla actual. En preview, los componentes siguen leyendo realtime real sin pasar por el motor.
- **Mapa**: marcadores leen `virtual_buses.position` (interpolada en cliente cada rAF entre ticks de 5–10s), con flecha de dirección y badge de confianza.

## Lo que no se toca (regla de oro)

- Estructura de rutas y navegación del agente.
- Diseño del widget y del dashboard (solo cambia el origen de los números).
- Deep link `qr.vectalia.es` se mantiene como botón externo.
- En preview seguimos con tiempos reales sin tocar.

## Migración SQL prevista

```sql
CREATE TABLE public.virtual_buses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_code text NOT NULL,
  direction smallint NOT NULL,
  trip_key text NOT NULL,
  service_date date NOT NULL,
  current_segment_idx int,
  segment_progress numeric,
  distance_from_origin_m numeric,
  speed_kmh numeric,
  state text NOT NULL,
  source text NOT NULL,
  headway_slot text,
  confidence numeric,
  last_tick_at timestamptz,
  last_observation_at timestamptz,
  estimated_terminal_arrival timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (line_code, direction, trip_key, service_date)
);
-- + GRANTs y RLS (SELECT auth+anon, INSERT/UPDATE solo service_role vía serverFn)

ALTER TABLE public.bus_segment_stats
  ADD COLUMN IF NOT EXISTS time_window text,
  ADD COLUMN IF NOT EXISTS peak_factor numeric;
```

## Entrega propuesta

Si apruebas, en este turno hago **Fase 1 completa**: migración SQL + módulos `fleet/` + serverFn de tick + reemplazo del origen de datos en dashboard, widget favorito y mapa. Fases 2 y 3 (detección automática de flota, bunching, panel admin de calidad) en turnos siguientes.

¿Apruebas Fase 1 tal cual o quieres ajustar el alcance (ej. dejar el mapa para fase 2)?
