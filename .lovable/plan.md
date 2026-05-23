## Reestructuración del CPA según la Doctrina (4 fases)

### Objetivo
Simplificar el CPA y unificar toda revisión bajo un único esquema de auditoría basado en las 4 fases de la doctrina. Cada conversación se abre Q&A por Q&A y se evalúa contra los 5 criterios obligatorios.

### Nueva estructura de tabs (simplificada)
De 10 tabs a 4:

```
📜 Doctrina    →  referencia inmutable (ya existe)
🔍 Auditoría   →  NUEVA — flujo único de revisión conversación-por-conversación
📚 Entrenamiento →  Intents + Entidades + FAQs (fusionadas)
📊 Operación   →  Resumen + Analítica + Costes (fusionadas)
```

Tabs que desaparecen como pestaña independiente (su contenido se absorbe):
- Conversaciones, Dudosas, Sin resolver, Supervisión → todas se unifican en **Auditoría**
- Intents, Entidades → fusionadas en **Entrenamiento**
- Resumen, Analítica, Costes → fusionadas en **Operación**

### Tab "Auditoría" — flujo único

Una sola cola de trabajo. Lista de conversaciones recientes (con filtros: pendientes, con incidencias, todas). Al abrir una conversación:

1. **Cabecera**: sesión, ruta inicial, dominio activo, duración.
2. **Línea de tiempo Q&A**: cada turno (pregunta usuario → respuesta agente) se muestra como una tarjeta auditable.
3. **Panel de evaluación por turno** (los 5 criterios de la doctrina):
   - ✅/⚠️/❌ Cumplimiento filosófico (¿enrutamiento o se desvió?)
   - ✅/⚠️/❌ Precisión de intención
   - ✅/⚠️/❌ Coherencia contextual (¿respetó dominio activo?)
   - ✅/⚠️/❌ Consistencia de ruta
   - ✅/⚠️/❌ Calidad del endpoint
   - **Fase detectada** (1/2/3/4) badge
   - Nota libre + acción correctiva ("Resolver al vuelo" ya existente: añadir keyword, crear intent, añadir FAQ, añadir alias)
4. **Veredicto global** de la conversación: OK / requiere ajuste / crítica.

Estado persistido en `agente_admin_supervisions` (ya existe) extendiendo el payload con `phase`, `criteria_scores`, `verdict`.

### Tab "Entrenamiento"
Sub-secciones internas (acordeón o tabs secundarias) — sin cambiar la lógica existente, solo agrupar:
- Intents (lista + edición existente)
- Entidades / nombres propios
- FAQs

### Tab "Operación"
Dashboard plano con: KPIs del Resumen + serie temporal + costes. Sin acciones, solo lectura.

### Archivos a tocar
- `src/routes/admin.ai.tsx` — reducir `TABS` a 4.
- `src/routes/admin.ai.auditoria.tsx` — **NUEVO** — flujo unificado de revisión.
- `src/routes/admin.ai.entrenamiento.tsx` — **NUEVO** — wrapper con sub-secciones de intents/entidades/faqs.
- `src/routes/admin.ai.operacion.tsx` — **NUEVO** — KPIs + serie + costes.
- `src/routes/admin.ai.index.tsx` — redirige a `/admin/ai/auditoria` (cola de trabajo por defecto).
- Rutas antiguas (`admin.ai.conversations.tsx`, `admin.ai.dubious.tsx`, `admin.ai.unknown-queries.tsx`, `admin.ai.supervision.tsx`, `admin.ai.intents.tsx`, `admin.ai.entities.tsx`, `admin.ai.analytics.tsx`, `admin.ai.costs.tsx`) — **se conservan los componentes internos** pero dejan de ser tabs; sus piezas se importan desde los 3 nuevos wrappers para no perder funcionalidad ya construida.
- `src/lib/admin-ai.functions.ts` — añadir `saveAuditVerdict({ logId, phase, criteria, verdict, note })`.
- Migración SQL: añadir columnas `phase smallint`, `criteria_scores jsonb`, `verdict text` a `agente_admin_supervisions`.

### Detalle técnico
- La lista de "Auditoría" se alimenta de `listAgentConversations` (ya existe) + `listDubiousInteractions` fusionadas por `session_id`.
- "Resolver al vuelo" se reutiliza tal cual (`quickResolveDubious`) en cada turno.
- La doctrina se renderiza como panel lateral colapsable dentro de "Auditoría" para que el revisor tenga los 5 criterios siempre a la vista.

### Lo que NO se toca
- `AgenteVamos.tsx` (regla de oro: las instrucciones al agente no modifican la estructura del producto).
- Tabla `agente_intents`, `agente_entities`, `agente_faqs` — sólo lectura/escritura ya existente.
- Rutas públicas del usuario final.
