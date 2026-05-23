## Centro de observación y entrenamiento del Agente IA

Transformaré `/admin` añadiendo una nueva sección `/admin/ai` con 7 subrutas, sin tocar las secciones existentes (Resumen, Usuarios, Arquitectura, Integraciones, BD, Métricas). Reutilizo el sidebar, el gate por PIN y los helpers de `admin-shared.ts`.

### 1. Base de datos (migración)

Ampliar `agente_learning_log` (nullable, sin romper inserts actuales):
- `normalized_query`, `detected_intent`, `intent_confidence numeric`
- `resolver_type text`, `resolved boolean`, `fallback_used boolean`
- `failure_reason text` (enum lógico: `NO_INTENT_MATCH | LOW_CONFIDENCE | EMPTY_RESULTS | API_FAILURE | ENTITY_AMBIGUOUS | OUT_OF_SCOPE`)
- `latency_ms int`, `model_used text`, `tokens_input int`, `tokens_output int`, `estimated_cost numeric`
- `clicked_result text`, `conversion_event text`
- `route_origin text`, `geo_context jsonb`, `session_id text`

Política RLS: mantener "admins read" y añadir INSERT vía service-role (server fn) — no se abre a `anon`.

Índices: `(created_at desc)`, `(failure_reason)`, `(detected_intent)`, `(session_id)`.

Tabla nueva `agente_unknown_query_actions` para trazar acciones de la cola (resuelta/ignorada/spam/fusionada/promovida-a-intent).

Ampliar `agente_admin_supervisions` solo si falta algo (ya tiene casi todo).

### 2. Helper de telemetría

`src/lib/agent/logAgentLearning.ts` — wrapper sobre `supabaseAdmin` para registrar una interacción completa (input + output + métricas + coste). Server-only. Calcula `estimated_cost` con tabla de tarifas por modelo.

Integración:
- `supabase/functions/chat/index.ts` — registrar al final del turno.
- Resolvers del agente (`src/lib/agente.functions.ts`, `agente-intents.functions.ts`) — registrar matches/fallbacks.

### 3. Server functions admin (`src/lib/admin-ai.functions.ts`)

Todas con `requireSupabaseAuth` + check `has_role(admin)`:
- `getAiOverview` — KPIs agregados (totals, resolution rate, fallback rate, latencia, coste, top intents/failures).
- `getAiTimeseries({ days })` — series para gráficas.
- `listUnknownQueries({ status, search })`
- `actUnknownQuery({ id, action, payload })` — promover, ignorar, spam, fusionar, crear FAQ.
- `listSupervisionItems({ status })`
- `submitSupervision({ id, correction })`
- CRUD `listIntents/upsertIntent/deleteIntent` sobre `agente_intents` + `agente_faqs`.
- CRUD `listEntities/upsertEntity` sobre `agente_proper_nouns`.
- `getAiAnalytics`, `getAiCosts`.

### 4. UI — 7 subrutas

Layout: reutilizo `admin.tsx` sidebar añadiendo grupo "Agente IA" con 7 entradas.

```
src/routes/admin.ai.tsx                 (layout con subnav opcional + Outlet)
src/routes/admin.ai.overview.tsx        Dashboard: KPI cards + gráficas (recharts ya en uso)
src/routes/admin.ai.unknown-queries.tsx Tabla filtrable + acciones rápidas
src/routes/admin.ai.supervision.tsx     Cards revisables con acciones
src/routes/admin.ai.intents.tsx         CRUD intents/FAQs
src/routes/admin.ai.entities.tsx        CRUD entidades/alias
src/routes/admin.ai.analytics.tsx       Rankings y conversiones
src/routes/admin.ai.costs.tsx           Coste por día/modelo/intent
```

Estilo "centro de control": cards con badges de estado (verde/ámbar/rojo), tablas con filtros, botones de acción inline, tooltips explicativos en lenguaje no técnico. Usa los componentes shadcn ya existentes (`Card`, `Table`, `Badge`, `Button`, `Dialog`, `Select`).

### Detalles técnicos

- TypeScript strict, sin `any`.
- Cada server fn devuelve DTO plano (cumple regla de TanStack).
- Comentarios JSDoc en helpers y server fns.
- `queryOptions` con `staleTime: 30min` para overview (consistente con admin actual), `5min` para colas activas.
- No se modifica `client.ts`, `types.ts`, ni se crean edge functions nuevas (se reutiliza la `chat` existente solo para instrumentarla).
- Migración nullable + defaults seguros → no rompe el insert actual desde `chat`.

### Fuera de alcance (lo aviso)

- No conecto pagos/Stripe para costes reales (uso tarifas estáticas configurables en `src/lib/agent/model-pricing.ts`).
- Conversion tracking depende de que los componentes de resultado emitan eventos — añado el helper `trackAgentConversion` pero solo lo cableo en 1-2 puntos clave (chat → reserva, chat → click externo); el resto queda preparado para iteraciones.
