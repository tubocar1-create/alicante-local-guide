## Objetivo

Reemplazar el cálculo Haversine entre paradas por **distancia real sobre polilínea** descargada de Vectalia, y arreglar de paso las coordenadas erróneas detectadas durante la comparación de Línea 12.

## Fase 0 — Correcciones de datos (rápido, sin código)

Antes de tocar el motor, corregir lo que ya sabemos que está mal:

1. **`bus_stops` stop_code `5101` (Las Franciscanas IDA)** — coordenadas actuales `38.3452, -0.478817` (Puerta del Mar). Corregir a las del gemelo VUELTA `5114`: `38.3483856, -0.5032439`.
2. **`bus_stops` stop_code `5124` (Plaza Juan Pablo II)** — verificar contra la polilínea descargada y reubicar dentro del shape de IDA.
3. **`bus_line_stops` Línea 12 VUELTA seq 7** — `Gutiérrez Mellado` y `Paso a nivel` comparten coordenadas (distancia 0 m). Verificar cuál de los dos `stop_code` tiene la coordenada mal.

Migración manual con `UPDATE` sobre `bus_stops` (vía herramienta insert).

## Fase 1 — Tabla `bus_line_shapes`

Nueva tabla para guardar las polilíneas:

```text
bus_line_shapes
  id              uuid PK
  line_code       text          -- "12"
  direction       smallint      -- 1=IDA, 2=VUELTA  (mismo convenio que bus_line_stops)
  source          text          -- "vectalia_kmz"
  source_line_id  text          -- id numérico interno de Vectalia
  geometry        jsonb         -- array [[lng,lat], ...]
  total_length_m  numeric
  point_count     int
  fetched_at      timestamptz
  UNIQUE(line_code, direction)
```

Más una tabla derivada de **distancias proyectadas por segmento de parada**, calculadas una vez al ingerir el shape:

```text
bus_line_stop_distances
  line_code       text
  direction       smallint
  from_seq        int           -- seq en bus_line_stops
  to_seq          int           -- from_seq+1
  from_stop_code  text
  to_stop_code    text
  distance_m      numeric       -- distancia real sobre la polilínea
  cumulative_m    numeric       -- desde el inicio de la línea
  PRIMARY KEY(line_code, direction, from_seq)
```

Con GRANTs `SELECT TO anon, authenticated` y `ALL TO service_role`, RLS habilitada con policy de lectura pública.

## Fase 2 — Endpoint de ingesta

Un solo server route protegido por header secreto:

```text
POST /api/public/hooks/bus-shape-sync
  body: { lineCode: "12", lineId?: "<id Vectalia>" }
  header: x-internal-secret: <BUS_SHAPE_SYNC_SECRET>
```

Hace lo que ya probamos en chat:
1. Si no se pasa `lineId`, busca la página `/linea/linea-{N}.../` con Firecrawl y extrae el `id` del `<script src="...line-kml?...id=XXX">`.
2. Descarga el KMZ con `executeJavascript` (Akamai bypass).
3. Parsea KML → 2 `LineString` (IDA + VUELTA).
4. Upsert en `bus_line_shapes`.
5. Lee `bus_line_stops` de esa línea+dirección, **proyecta cada parada** sobre la polilínea (snap al punto más cercano), calcula `cumulative_m` por parada y deriva `distance_m` consecutivos.
6. Upsert en `bus_line_stop_distances`.

Sin cron automático. Se llama manualmente o desde un panel admin línea por línea, con confirmación previa (cumple regla "no scrape masivo sin OK").

## Fase 3 — Geometría: proyección punto→polilínea

Nuevo módulo `src/lib/bus-engine/polyline.ts`:

- `projectPointOnPolyline(point, polyline) -> { distanceAlong_m, snappedPoint, segmentIndex }`
  Itera segmentos, calcula la proyección perpendicular sobre cada uno, devuelve la más cercana.
- `polylineLength(polyline) -> number` — suma de Haversine entre puntos consecutivos.
- `interpolateOnPolyline(polyline, distance_m) -> LatLng` — para mover un bus sobre el shape (futura mejora del mapa).

Tests unitarios con los datos de Línea 12 (esperado: 6,46 km IDA, 5,39 km VUELTA).

## Fase 4 — Integración en el motor

`src/lib/bus-engine/geometry.ts`:
- Mantener `haversineMeters` (sigue valiendo para distancias usuario→parada).
- Añadir `realDistanceBetweenStops(lineCode, direction, fromSeq, toSeq)` → lee de `bus_line_stop_distances` con caché en memoria.

`src/lib/bus-engine/segments.ts`:
- Cuando exista distancia real en `bus_line_stop_distances`, usarla. Si no, fallback Haversine actual.

Esto afecta a:
- Cálculo de "cuánto queda hasta tu parada" (suma de segmentos por delante).
- Estimación de velocidad en `bus_segment_stats` (más precisa).
- Posición visual del bus en mapa (Fase 5, opcional, no incluida ahora).

## Fase 5 — UI

Cambios mínimos:
- `bus.dashboard.$code`: si hay shape disponible, mostrar km reales en lugar de Haversine.
- `BusLineLiveMap`: dibujar la polilínea real (`Polyline` de Leaflet) en lugar de la línea recta entre paradas.

## Qué NO se toca

- El plan grande del motor realtime (snapshots Vectalia cada 5 min) sigue intacto y es independiente.
- Estructura de páginas y rutas — solo cambian datos.
- No se programa cron de ingesta automática. **Cada línea se sincroniza manualmente con confirmación.**
- No se llama a ninguna API de Google. Solo Firecrawl, con la lista de líneas confirmada por el usuario antes de cualquier batch.

## Orden de ejecución propuesto

1. Confirmar las 3 correcciones de coordenadas (Fase 0) → aplicar con `UPDATE`.
2. Migración `bus_line_shapes` + `bus_line_stop_distances`.
3. Módulo `polyline.ts` + tests con Línea 12.
4. Endpoint de ingesta + ejecutar **solo para Línea 12** como piloto.
5. Verificar tabla comparativa post-corrección (esperado IDA ~+15-20% en lugar de +56%).
6. Integrar en `segments.ts` con fallback.
7. Mapa con polilínea real (Fase 5).
8. Cuando todo funcione en Línea 12, decidir contigo qué otras líneas ingerir (lista explícita, no batch ciego).
