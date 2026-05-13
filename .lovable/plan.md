# Plan: Módulo Universal de Servicios — Alicante Friend

## Resumen

Extender la app actual con un núcleo modular para negocios (QR, reservas, referrals, métricas, dashboard) sin tocar las funcionalidades existentes (buses, mapas, IA, ETA, exploración, puntos, rutas, Supabase, edge functions, Overpass).

Trabajo en **fases incrementales**. Esta primera entrega monta los **cimientos** (modelo de datos universal, RLS, roles, rutas privadas, dashboard mínimo). Las features avanzadas (campañas, analytics ricos, marketplace) se construyen encima, en fases posteriores.

---

## Fase 1 — Cimientos (esta entrega)

### 1. Modelo de datos universal (Supabase)

Una sola migración, entidades genéricas reutilizables por cualquier vertical:

- `businesses` — negocio (nombre, slug, sector, lat/lng, datos de contacto, horario JSON, owner_id).
- `business_users` — relación usuario↔negocio con rol (`owner`, `staff`).
- `services` — servicio/producto ofrecido por un negocio (nombre, duración, precio opcional, metadata JSONB para extender por vertical).
- `bookings` — reserva ligera (business_id, service_id, user_id, datetime, party_size, status, notes).
- `qr_codes` — QR universal (business_id, code, purpose `visit|referral|promo|booking|campaign`, payload JSONB, expires_at, max_uses, uses).
- `visits` — validación física (qr_id, business_id, user_id, scanned_at, source).
- `referrals` — origen→destino (referrer_user_id, business_id, code, status, converted_at).
- `interaction_events` — tabla **única** de eventos para métricas (type, user_id, business_id, timestamp, location, source, campaign_id, conversion_status, metadata JSONB).
- `campaigns` — placeholder mínimo (business_id, name, type, starts_at, ends_at, active).
- `app_role` enum (`public_user`, `business_user`, `admin`) + `user_roles` table + `has_role()` SECURITY DEFINER (patrón estándar).

Cada tabla con RLS:
- Lectura pública sólo lo que debe serlo (negocios, servicios).
- Escritura/lectura privada gated por `has_role` o `business_users`.
- `referral_qrs` existente se mantiene tal cual; el nuevo `qr_codes` convive.

### 2. Roles y acceso

- Función `has_role(user_id, role)` SECURITY DEFINER.
- Función `is_business_member(user_id, business_id)` SECURITY DEFINER.
- RLS del módulo business usa estas funciones — nada de roles en `profiles`.

### 3. Rutas — separación pública / privada

```
src/routes/
  (existentes intactas)
  _business.tsx                 ← layout protegido (beforeLoad → /login si no business_user)
  _business/
    index.tsx                   ← dashboard
    bookings.tsx
    qr.tsx                      ← generar / escanear
    referrals.tsx
    metrics.tsx
    settings.tsx
  api/public/
    qr-validate.ts              ← POST: valida un QR escaneado
    booking-create.ts           ← POST: crea reserva (con rate-limit + zod)
```

El módulo business **no aparece** en la navegación pública. Acceso vía URL directa + login con rol `business_user`.

### 4. Server functions (createServerFn)

En `src/lib/business/`:
- `qr.functions.ts` — crear QR, validar QR, listar visitas.
- `bookings.functions.ts` — crear, listar, cambiar estado.
- `referrals.functions.ts` — generar código, registrar conversión.
- `metrics.functions.ts` — agregaciones simples sobre `interaction_events`.
- `business.functions.ts` — CRUD básico del negocio del usuario.

Todas con `requireSupabaseAuth` + validación Zod.

### 5. Tracking universal

Helper `trackEvent({ type, business_id, ... })` que escribe en `interaction_events`. Lo usan todas las acciones (qr_scan, booking_created, referral_converted, visit_validated…). Una sola fuente de verdad para métricas.

### 6. Dashboard business (mínimo viable, móvil-first)

Pantallas listas pero compactas:
- **Resumen**: hoy → visitas, QR escaneados, reservas, referrals.
- **Reservas**: lista + cambio de estado.
- **QR**: generar QR (purpose + expiración) y mostrar imagen escaneable.
- **Referrals**: lista + código compartible.
- **Métricas**: 4-5 cards + gráfico simple semanal (recharts ya disponible).

Diseño con tokens existentes en `src/styles.css`. Sin colores hardcoded.

---

## Fases siguientes (NO en esta entrega — sólo se documentan)

- **Fase 2**: escáner QR con cámara en el dashboard, WhatsApp deep-links para reservas, campañas activas.
- **Fase 3**: analytics enriquecido (cohortes, recurrencia, horarios pico), CPA, exportes.
- **Fase 4**: marketplace, multi-ciudad, IA contextual aplicada a negocios.

---

## Detalles técnicos

- **Stack**: TanStack Start + Supabase (ya configurado). Sin nuevas dependencias salvo `qrcode` para generar imágenes QR.
- **Compatibilidad**: cero cambios en `src/routes/index.tsx`, `bus.*`, `eat.tsx`, `stay.tsx`, `explore.tsx`, hooks existentes, edge functions de bus. La tabla `referral_qrs` actual se mantiene.
- **Seguridad**: RLS en todas las tablas nuevas, roles en tabla separada (no en profiles), validación Zod en todas las entradas, rate-limit en endpoints `/api/public/*`.
- **SSR-safe**: server functions con `requireSupabaseAuth`; `_business` layout con `beforeLoad` que verifica sesión + rol.

---

## Entregables Fase 1

1. Migración Supabase con todas las tablas + RLS + funciones helper.
2. `src/routes/_business.tsx` + 6 sub-rutas con UI mínima funcional.
3. `src/lib/business/*.functions.ts` con la lógica server.
4. 2 endpoints `/api/public/*` (qr-validate, booking-create).
5. Componente `BusinessNav` y tokens de diseño si hacen falta.
6. Documentación breve en `.lovable/plan.md`.

¿Apruebas este plan para empezar con la Fase 1?
