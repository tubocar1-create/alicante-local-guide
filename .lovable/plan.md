## Objetivo

Registrar TODA llamada externa de pago (Lovable AI Gateway + Google Maps/Places) para auditar consumo real, y exponerlo en dos páginas de admin con acceso desde el menú lateral.

## 1. Tabla `external_api_calls` (migración)

Una sola tabla para los dos proveedores, con índice por `provider + created_at`:

```
external_api_calls
  id, created_at
  provider          'lovable_ai' | 'google_places' | 'google_maps' | 'google_geocoding' | 'google_directions'
  endpoint          texto corto (ej: 'chat/completions', 'places:searchText', 'directions')
  model             nullable (sólo IA)
  caller            nombre del server fn o ruta que llama (ej: 'ai-review', 'places.search')
  status_code       int
  latency_ms        int
  tokens_input      int nullable
  tokens_output     int nullable
  estimated_cost    numeric(10,6) nullable (USD)
  meta              jsonb
```

RLS: solo admins leen; inserts vía service role desde server functions.

## 2. Wrapper único — `src/lib/observability/track-external-call.ts`

Función `trackExternalCall({provider, endpoint, caller, model, ...})` que inserta con `supabaseAdmin`. Try/catch silencioso para no romper la llamada original.

## 3. Helpers por proveedor

- `src/lib/observability/lovable-ai.ts` → `callLovableAI({caller, model, messages, ...})` que envuelve el fetch a `ai.gateway.lovable.dev`, parsea `usage.prompt_tokens`/`completion_tokens`, calcula coste con `MODEL_PRICING` y trackea.
- `src/lib/observability/google.ts` → `fetchGoogle({provider, endpoint, caller, url, init})` que mide latencia, status y registra.

## 4. Refactor de los 16 sitios IA + sitios Google

Sustituir cada `fetch("https://ai.gateway.lovable.dev/...")` por `callLovableAI(...)` con el `caller` correcto. Misma cosa para los call sites de Google Maps/Places (los localizo con `rg`).

## 5. Server functions de lectura

`src/lib/admin-consumption.functions.ts`:
- `getAiConsumption({ hours })` → agregado por hora/modelo/caller con coste.
- `getGoogleConsumption({ hours })` → agregado por endpoint/caller con conteo.
- `getRecentExternalCalls({ provider, hours, limit })` → últimas N llamadas.

## 6. Páginas admin nuevas

- `src/routes/admin.consumo-ia.tsx`
  - Selector de rango: 1 h / 12 h / 24 h / 7 d / 30 d
  - Totales: nº llamadas, tokens in/out, coste USD
  - Tabla por modelo y por caller
  - Gráfico simple por hora
  - Lista de las últimas 50 llamadas

- `src/routes/admin.consumo-google.tsx`
  - Mismo selector
  - Totales por API (Places / Maps / Geocoding / Directions)
  - Tabla por endpoint y por caller
  - Lista últimas 50

## 7. Menú lateral admin

Añadir en `src/routes/admin.tsx` (sidebar) dos entradas:
- "🤖 Consumo IA" → `/admin/consumo-ia`
- "☁️ Consumo Google" → `/admin/consumo-google`

## Lo que NO toco

- No cambio el comportamiento del agente.
- No cambio el flujo de ninguna llamada existente, solo la envuelvo.
- No toco `agente_learning_log` (sigue como está; las páginas nuevas se nutren de la nueva tabla).

## Riesgos

- Refactor de 16+ archivos: lo hago en una sola pasada y con la misma firma para minimizar diff.
- Los call sites de Google Maps en cliente (browser) NO se pueden trackear desde servidor; sólo registro los que ya pasan por server fns. El resto se ve en Google Cloud Console.

¿Adelante con todo, o prefieres que arranque solo por la tabla + wrapper IA + página IA, y dejamos Google para una segunda iteración?