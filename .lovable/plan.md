# Motor contextual urbano para AgenteVamos

Refactor del agente para que actúe como orquestador contextual, no como buscador de keywords. Solo se toca la lógica/UI del agente — **no se crean ni modifican páginas** (regla de oro del proyecto: el agente navega sobre la estructura existente).

## Alcance

Archivos a modificar:
- `src/components/AgenteVamos.tsx` — toda la lógica de detección, conversación y navegación.

Sin cambios en: rutas, dashboards, supabase, intents en BD.

## Modelo de decisión (por turno)

Antes de responder, el agente calcula un objeto interno:

```
{
  domain:        'transporte' | 'salud' | 'salud_general' | 'comer' | 'dormir'
               | 'playas' | 'ocio' | 'fiestas' | 'compras' | 'mapa'
               | 'clima' | 'qr' | 'perfil' | null,
  intentConfidence: 0..1,
  userState:    'apurado' | 'relajado' | 'explorando' | 'cansado'
              | 'perdido' | 'enfermo' | null,
  assistantMode:'operativo' | 'empatico' | 'inspiracional'
              | 'social' | 'practico' | 'neutro',
  uiAction:     'openDomain' | 'openSubmenu' | 'openEndpoint'
              | 'askClarification' | 'none',
}
```

`uiAction` se resuelve así:
- `intentConfidence ≥ 0.80` y endpoint identificable → `openEndpoint` (navegación directa).
- `domain` claro pero subcategoría ambigua → `openSubmenu` (mostrar opciones del dominio en el chat, sin navegar).
- Solo dominio detectado → `openDomain`.
- Nada claro → `askClarification` (conversar primero).

## Reglas duras

1. **Hard-block sanitario**: si el mensaje contiene `dolor, fiebre, mareo, mal, enfermo, cansado, herida, síntoma(s), náuseas, vómito, sangre, urgencia`, forzar `domain = 'salud_general'`, `userState = 'enfermo'`, `assistantMode = 'empatico'`. Prohibido navegar directo a especialista/hospital/traumatología. Pregunta obligada: "¿Necesitas hospital, farmacia, urgencias o especialista?".
2. **No first-keyword-wins**: una palabra suelta nunca dispara endpoint específico. Se exige al menos (verbo de intención + sustantivo) o número de línea concreto, etc.
3. **Dominios primero**: nunca saltar a subcategoría sin dominio explícito y confianza ≥ 0.80.
4. **Subcategorías válidas solo con claridad explícita**: ej. "línea 12", "Hotel Meliá", "dermatólogo".

## Tonos por dominio (assistantMode)

- transporte → operativo, frases cortas, sin floritura.
- salud / salud_general → empático, calmado, guiado.
- playas → inspiracional, relajado.
- fiestas → dinámico, social.
- compras → práctico, directo.
- resto → neutro.

El tono solo afecta el texto que devuelve el agente, no la UI.

## Flujos de ejemplo (deterministas)

- "quiero tomar el bus" → transporte, conf 0.55 → askClarification: "¿Bus urbano, TRAM o interurbano?".
- "quiero línea 12" → transporte, conf 0.95 → openEndpoint `/bus/dashboard/12`.
- "me siento mal" → hard-block → salud_general → askClarification con 4 opciones.
- "quiero fiesta" → fiestas, conf 0.6 → askClarification: "¿Pubs, terraza, discoteca o música en vivo?".
- "farmacia cerca" → salud, conf 0.9 → openEndpoint `/farmacias`.
- "Hotel Meliá" → dormir, conf 0.9 → abrir el hotel si se resuelve, si no, listado.

## Detalles técnicos

1. **Nuevo módulo interno en `AgenteVamos.tsx`**:
   - `detectDomain(text)` → `{domain, confidence}` con tablas de verbos+sustantivos por dominio.
   - `detectUserState(text)` → estado.
   - `HEALTH_HARD_BLOCK` set de tokens; si hay match, override total.
   - `pickAssistantMode(domain, userState)`.
   - `decideUiAction(domain, confidence, resolvedRoute)`.
2. **Integración con la pipeline actual**:
   - Reemplazar el bloque "first-match" actual (matchBusLineDashboard + intents directos) por: primero `detectDomain` → si confianza alta y existe resolvedor específico (línea de bus, hotel concreto, categoría salud explícita), entonces navegar; en cualquier otro caso, generar respuesta conversacional con el submenu del dominio.
   - Mantener `parseBusLineCode` ya existente; solo se invoca cuando `domain === 'transporte'` y el texto contiene marcador de línea.
3. **Submenús conversacionales** (sin crear páginas):
   - transporte → ["Bus urbano", "TRAM", "Interurbano"]
   - salud_general → ["Hospital", "Farmacia", "Urgencias", "Especialista"]
   - fiestas → ["Pubs", "Terraza", "Discoteca", "Música en vivo"]
   - comer → ["Cocina típica", "Arroces", "Italiano", "Asiático", "Brunch", "Pizzas", "Rápida", "Internacional"]
   - Cada chip, al pulsarse, dispara el mismo pipeline con el texto de la opción → resuelve a endpoint existente.
4. **Personalidad**: helpers `formatReply(mode, text)` que ajustan longitud y registro; sin emojis salvo en fiestas/playas (máx. 1).
5. **Logs**: en `console.debug` el objeto de decisión para depuración.

## Lo que NO se toca

- Rutas en `src/routes/**`.
- Tabla `agente_intents` ni server functions de catálogo.
- Dashboards de bus, hoteles, salud, etc.
- routeTree.gen.ts.

## Verificación

- Probar en preview los 6 ejemplos del documento.
- Confirmar que "duele la cabeza" NO abre traumatología y sí pregunta hospital/farmacia/urgencias/especialista.
- Confirmar que "línea 22" sigue abriendo `/bus/dashboard/22` (regresión del fix anterior).
