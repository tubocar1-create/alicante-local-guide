ns
# Módulo de Coordinación Urbana Contextual Inteligente

Diseño de comunicación **operacional, contextual y atada a un servicio**. No es un chat social. Cada conversación nace de una reserva o interacción concreta y muere cuando esa interacción se cierra.

## 1. Principios de diseño (no negociables)

- 1 reserva = 1 hilo. No existe chat libre.
- Mensajes mayoritariamente **estructurados** (quick replies). Texto libre limitado a 280 chars y solo cuando el hilo está activo.
- El hilo **caduca** automáticamente al completarse / cancelarse el servicio (+ ventana corta post-servicio para feedback).
- Mobile-first, una sola pantalla, acciones grandes.
- Cada mensaje puede llevar **payload contextual** (ETA, ubicación, QR, slot propuesto) — no solo texto.

## 2. Modelo de datos (nuevas tablas)

```text
conversation_threads
 ├─ id (uuid)
 ├─ booking_id (uuid, FK bookings)         ← raíz contextual
 ├─ business_id (uuid)
 ├─ user_id (uuid)
 ├─ status: open | awaiting_user | awaiting_business | closed | expired
 ├─ last_message_at, created_at, closed_at
 └─ context_snapshot jsonb (servicio, hora, party_size)

messages
 ├─ id, thread_id
 ├─ sender_type: user | business | system | ai
 ├─ message_type: quick_reply | free_text | system_event | eta_update | location | qr | slot_proposal
 ├─ template_key (ej. 'business.confirm', 'user.on_my_way')
 ├─ text (nullable, ≤280)
 ├─ payload jsonb (slot, eta_minutes, lat/lng, qr_code_id, …)
 ├─ created_at, read_at
 └─ requires_action boolean

booking_requests  (extiende bookings con estado de negociación)
 └─ ya cubierto por bookings + nueva columna negotiation_state
```

RLS: hilo visible solo a `user_id`, miembros del `business_id`, y admin. Insert de mensajes: solo participantes del hilo y solo si `status != closed`. Trigger crea `conversation_thread` automáticamente al insertar `bookings` (status=pending).

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversation_threads`.

## 3. Catálogo de mensajes estructurados

**Negocio → Usuario**: `confirm`, `propose_slot` (payload: nuevo `scheduled_at`), `decline` (payload: motivo), `service_ready`, `running_late` (payload: `delay_minutes`), `request_clarification`.

**Usuario → Negocio**: `accept`, `reject_proposal`, `on_my_way` (payload: ETA calculada), `running_late`, `arrived` (payload: lat/lng + QR), `cancel`.

**Sistema (auto)**: `booking_created`, `eta_update` (cada N min si usuario en tránsito), `qr_validated`, `thread_closed`, `reminder_pre_arrival` (T-15min).

**IA (futuro)**: `suggested_reply`, `auto_confirm` (cuando reglas del negocio lo permiten).

## 4. Integraciones urbanas

- **ETA / Bus**: cuando usuario envía `on_my_way`, server fn `computeUserEta` usa `useUserLocation` + `bus-eta` y emite `eta_update` periódicos hasta llegada o timeout. Negocio ve countdown en vivo.
- **QR**: `arrived` se cierra validando el QR del negocio (`/api/public/qr-validate`). Esto dispara `system_event: qr_validated` y mueve `booking.status = completed`.
- **Disponibilidad**: cuando negocio responde `propose_slot`, sistema chequea `services` + huecos ocupados antes de permitir el envío.
- **Métricas**: cada mensaje genera `interaction_event` (type según `message_type`) — alimenta el panel existente.

## 5. Estados del hilo (máquina simple)

```text
open → awaiting_business (user creó reserva)
awaiting_business → awaiting_user (negocio propone/pide aclaración)
awaiting_user ↔ awaiting_business (ping-pong negociación)
cualquiera → closed (booking confirmed+completed | cancelled | no_show)
inactividad >24h en awaiting_* → expired (auto vía cron)
```

## 6. UX / superficies

- **Usuario**: ruta `/threads` (lista compacta de reservas activas) y `/threads/$id` (timeline + barra de quick-replies contextual al estado).
- **Negocio**: nueva pestaña en bottom nav `Bandeja`, badge con count de `awaiting_business`. Cada item muestra: cliente, servicio, hora propuesta, tiempo desde último mensaje (SLA visible).
- **Composer**: 90% botones (chips), 10% texto libre. Sin emojis pickers, sin attachments, sin grupos.
- **Sin notificaciones intrusivas**: in-app realtime + push opcional para `requires_action=true`.

## 7. Métricas nuevas (panel negocio)

- Tiempo medio de respuesta del negocio (P50, P95).
- Tasa de confirmación / rechazo / contrapropuesta.
- Tasa de llegadas confirmadas vs no-show.
- Diferencia ETA prometido vs real.
- Reservas completadas por hilo.

## 8. Arquitectura de código

```text
src/lib/coord/
 ├─ threads.functions.ts      createThread, listThreads, getThread, closeThread
 ├─ messages.functions.ts     sendMessage (valida template + payload), markRead
 ├─ templates.ts              catálogo de message_type + schemas Zod
 ├─ eta-bridge.ts             integra bus-eta + useUserLocation
 └─ state-machine.ts          transiciones de thread/booking
src/routes/
 ├─ threads.tsx               layout (lista + outlet)
 ├─ threads.$id.tsx           timeline
 └─ business.inbox.tsx        bandeja del negocio
src/components/coord/
 ├─ Timeline.tsx
 ├─ QuickReplyBar.tsx         renderiza chips según state + role
 ├─ MessageBubble.tsx         variantes por message_type
 ├─ EtaLive.tsx               countdown realtime
 └─ SlotProposalCard.tsx
```

Realtime con `supabase.channel('thread:'+id)` filtrado por `thread_id`.

## 9. Preparación para IA y futuro

- Cada mensaje guarda `template_key` → fácil entrenar/auto-completar.
- Hook `onIncomingMessage` con punto de extensión para "auto-confirm si regla cumplida" (ej. negocio activa "auto-aceptar reservas <2 personas en horario X").
- `context_snapshot` permite pasar contexto completo a un LLM sin reconsultar DB.
- Multi-vertical: `service_id` ya existe, los templates son agnósticos del vertical.
- Multi-ciudad: nada del módulo asume Alicante.

## 10. Plan de entrega por fases

**Fase 1 – Núcleo (este sprint)**
Migración tablas + RLS + trigger auto-thread, server fns CRUD, ruta `/threads/$id` y `/business/inbox`, templates básicos (confirm / propose_slot / accept / cancel / arrived), realtime. Cierre de hilo al completarse el booking.

**Fase 2 – Urbano**
ETA en vivo (`on_my_way` + `eta_update`), integración QR en `arrived`, recordatorio T-15.

**Fase 3 – Métricas + SLAs**
Panel de tiempos de respuesta, badge de SLA en bandeja del negocio, alertas (Brevo WhatsApp ya planteado) para `awaiting_business >X min`.

**Fase 4 – IA y reglas**
Auto-confirm, sugerencias de respuesta, detección de no-show probable.

---

¿Arranco por la **Fase 1** (migración + hilo atado a booking + bandeja del negocio + 5 templates básicos + realtime)? Si prefieres, puedo empezar solo por el modelo de datos y la bandeja, y dejar la UX del usuario para después.
