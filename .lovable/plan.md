# Tracking de visitantes y vista por usuario en admin

## Objetivo
Rastrear actividad de usuarios logueados Y visitantes anónimos (con `visitor_id` persistente), enriquecer cada evento con IP truncada + país + ciudad + UA + referrer + UTM, y exponer una pantalla de admin por usuario/visitante con timeline y preferencias inferidas.

## 1. Base de datos (migración)

Ampliar `interaction_events` con columnas nuevas (nullable, no rompe nada existente):
- `visitor_id text` — UUID anónimo persistente en cookie/localStorage del navegador
- `ip_trunc text` — IP truncada a /24 (ej. `81.32.45.0`)
- `country text`, `city text`, `region text`
- `user_agent text`, `device text` (mobile/desktop/tablet), `browser text`, `os text`
- `referrer text`
- `utm jsonb` — `{source, medium, campaign, term, content}`
- `path text` — ruta normalizada (ya viene en `metadata.route`, pero indexar)
- Índices: `(visitor_id, occurred_at desc)`, `(user_id, occurred_at desc)`, `(country)`, `(occurred_at desc)`

Política RLS nueva: permitir INSERT anónimo desde el server (vía service role en el endpoint público), así que **no** se cambian las políticas — el endpoint usa `supabaseAdmin`.

## 2. Endpoint público `/api/public/track`

Nuevo `src/routes/api/public/track.ts`. Recibe POST con `{type, visitor_id, path, metadata, referrer, utm}`. El servidor:
- Lee IP de `cf-connecting-ip` o `x-forwarded-for`, la trunca a /24
- Lee país/ciudad/región de los headers de Cloudflare (`cf-ipcountry`, `request.cf.city`, `request.cf.region`)
- Parsea UA con un mini-parser propio (no añade dependencias pesadas)
- Inserta en `interaction_events` con `supabaseAdmin`
- Valida con Zod, rate-limit suave por `visitor_id` (descarta duplicados <500ms)

## 3. Cliente

Nuevo `src/lib/tracking/visitor.ts`:
- `getVisitorId()` — genera y persiste un UUID en `localStorage` (`vamos_vid`) + cookie (1 año)
- `captureUTM()` — parsea `?utm_*` al cargar y los persiste en `sessionStorage`

Modificar `src/lib/operations/trackOperationalEvent.ts`:
- Sustituir la llamada a `logOperationalEvent` (server function actual) por un `fetch('/api/public/track', { keepalive: true })` con `visitor_id`, `referrer`, `utm`, `user_id` (si hay sesión).
- Mantener firma — los call-sites no cambian.

Wiring global: en `__root.tsx` (o un hook en `RootComponent`) hacer un `trackOperationalEvent({type:'page_view'})` en cada cambio de ruta (escucha de `router.subscribe('onResolved')`).

## 4. Admin: vista por usuario/visitante

Ampliar `/admin/usuarios` (lista) para incluir también visitantes anónimos (agrupados por `visitor_id` cuando no hay `user_id`). Mostrar:
- email/nombre o "Anónimo · {visitor_id corto}"
- país·ciudad de la última visita
- nº de sesiones, última visita, total de eventos

Nueva ruta `/admin/usuarios.$id.tsx` (id = user_id UUID o `v:{visitor_id}`):
- **Cabecera**: identidad, primera/última visita, país·ciudad, navegador, dispositivo
- **Preferencias inferidas**: top 5 secciones (`/playas`, `/tram`, `/comprar`…), top categorías de comercio, horarios de uso (mañana/tarde/noche)
- **Timeline**: últimos 100 eventos con ruta, tipo, ts, metadata
- **Adquisición**: referrer + UTM de la primera visita

Server functions nuevas en `src/lib/admin/visitors.functions.ts` (protegidas con `requireSupabaseAuth` + check de rol admin):
- `listVisitors({limit, offset, filter})` 
- `getVisitorTimeline({id})` — devuelve cabecera + agregados + eventos

## 5. Privacidad
- IP siempre truncada a /24 (nunca se guarda la IP completa)
- Añadir nota en `/legal/privacidad` mencionando el `visitor_id` y la IP truncada para analítica propia
- Sin cambios en GA4 (ya estaba)

## Detalles técnicos
- Cloudflare Workers expone IP y geo vía headers (`cf-connecting-ip`, `cf-ipcountry`) y `request.cf` en runtime. No requiere servicio externo.
- UA parsing: función propia ~40 líneas (regex sobre `Mozilla/.../Chrome/...`). No instalamos `ua-parser-js`.
- El endpoint público nunca devuelve datos del usuario; solo `{ok:true}`.

## Fuera de alcance
- Heatmaps / session replay (eso es Hotjar/Clarity, otro nivel)
- Fingerprinting más allá del visitor_id en cookie
- Export CSV (se puede añadir luego)
