# Revisión del diálogo hablado del Agente Vamos

## Diagnóstico (estado actual)

El diálogo funciona pero le falta forma conversacional. Una conversación entre dos partes necesita: **apertura → turnos claros → cierre**. Hoy hay vacíos en cada fase.

### 1. Inicio (apertura)
- Saludo correcto y abierto: *"Buenas tardes Leopoldo, ¿qué vamos a hacer hoy?"* y queda escuchando. **OK.**
- Pero si el usuario abre el panel en modo texto, el saludo aparece escrito y también se habla (cambio reciente). Coherente con la regla "habla lo que escribe".

### 2. Secuencia (turnos)
Problemas detectados:

- **Doble emisión del agente sin esperar al usuario**: tras la pregunta del usuario ("Comer tacos") el agente escribe primero un placeholder *"Abro el Dashboard…"* y luego lo sustituye por el resumen *"Te he conseguido N restaurantes…"*. En texto se ve bien (una sola burbuja final), pero conceptualmente son dos respuestas encadenadas del mismo lado sin turno del usuario en medio.
- **Sin acuse de recibo verbal**: el agente no dice nada entre la petición y el resumen final (que tarda ~1-2 s mientras carga datos). El usuario no sabe si fue escuchado.
- **Sin invitación al siguiente turno**: tras el resumen el agente queda mudo. En voz vuelve a escuchar (silencio), pero no propone qué viene ("¿Quieres que te abra el primero?", "¿Reservo?", "¿Otra categoría?"). Eso rompe la secuencia: el usuario no sabe si la conversación sigue.
- **Eco de voz cuando habla y escucha a la vez**: `shouldAutoListen` se reactiva en `onend` del TTS, pero si el TTS se corta o falla, puede haber solape micro+voz.

### 3. Fin (cierre)
- No hay despedida. El diálogo termina por:
  - Pulsar la X → cierre brusco, corta el TTS a mitad.
  - Timeout de 60 s de inactividad → cierre silencioso.
  - Navegar fuera → panel sigue abierto pero contexto cambia.
- Falta un cierre verbal del tipo *"Si necesitas algo más, vuélveme a llamar."* antes de cerrar por inactividad.

### 4. Otros detalles
- El placeholder *"Abro el Dashboard…"* no aporta valor escrito porque siempre se sobrescribe. Es ruido visual.
- En modo texto, hablar la respuesta siempre puede molestar; el toggle de altavoz lo silencia, pero el estado por defecto debería ser **mute en texto / unmute en voz**.

---

## Propuesta de cambios

### A. Inicio
1. Mantener el saludo actual.
2. En modo **texto**, arrancar **muted = true** (no habla salvo que el usuario active altavoz). En modo **voz**, muted = false.

### B. Turnos
3. **Eliminar el placeholder escrito** *"Abro el Dashboard…"*: no añadir burbuja intermedia; mostrar sólo un indicador de "pensando" (puntos) hasta que llegue el resumen real.
4. **Acuse breve hablado** mientras se carga el Dashboard, sólo en voz: una frase corta tipo *"Voy a por ello…"* (≤2 palabras, 1 s) para mantener el turno. Solo se reproduce si el resumen tarda más de ~800 ms.
5. **Cerrar el turno con invitación**: tras el resumen, añadir una segunda frase corta que invite al siguiente turno, en función del contexto:
   - Cartelera con resultados: *"¿Te abro el primero o probamos otra cocina?"*
   - Sin resultados abiertos: *"¿Probamos otra categoría?"*
   - Dashboard genérico: *"¿Algo más?"*
   Esta frase se habla y se escribe como parte del mismo mensaje del agente (no burbuja aparte).

### C. Fin
6. **Cierre verbal por inactividad**: cuando salte el timeout de 60 s, antes de cerrar, hablar/escribir *"Si necesitas algo más, vuélveme a llamar."* y cerrar al terminar el TTS (no a mitad).
7. **Cierre por X**: si el agente está hablando, dejar terminar la frase actual antes de cerrar visualmente; o cortar limpio sin reabrir audio.
8. **Detección de despedida del usuario**: si el usuario dice/escribe "gracias", "nada más", "adiós", "hasta luego" → el agente responde *"Hasta luego, Leopoldo."* y cierra el panel.

### D. Anti-eco
9. Asegurar que `stopListening()` se llama **antes** de cada `speak()` y `startListening()` sólo en `onend`/`onerror` del TTS, no en paralelo.

---

## Detalles técnicos

Archivo único afectado: `src/components/AgenteVamos.tsx` (más una pequeña adición al evento de resumen en `ChatScreen.tsx` para enviar `categoryLabel` ya formateado si hace falta).

- **A2 (mute por defecto)**: en el efecto que detecta apertura (`open && !wasOpenRef.current`), setear `setMuted(mode === "text")`. Hoy `mode` se fuerza a `"voice"` al abrir; añadir lectura del modo elegido por el usuario.
- **B3 (sin placeholder)**: en `send()` línea ~704, no insertar el `reply` placeholder cuando hay `forwardPrompt || pendingSubmenu`. En su lugar, mantener el estado `loading=true` (ya pinta indicador en línea ~1229) hasta que el handler de `vamos:food-summary` inserte el resumen.
- **B4 (acuse "Voy a por ello…")**: tras `setLoading(true)` y si `modeRef.current === "voice"`, programar un `setTimeout(800ms)` que llame `speak("Voy a por ello.")` sólo si el resumen aún no ha llegado. Cancelar el timeout cuando llegue el resumen.
- **B5 (invitación al siguiente turno)**: en `speakExternalSummary`, concatenar al `text` una segunda frase según el caso (`openCount > 0` → invitar a abrir el primero; `count > 0` → otra categoría; `0` → otra categoría). Mostrar y hablar como un único mensaje.
- **C6 (cierre por inactividad)**: en `bumpIdle`, antes del `onClose()`, llamar a un nuevo `speakFarewell()` que habla el mensaje de despedida y al `onend` ejecuta `onClose()`. Si está muted, sólo escribe la frase y cierra tras 1.5 s.
- **C7 (cierre por X)**: en el handler de la X, si `speakingRef.current`, llamar a `stopSpeaking()` limpiamente (ya existe) y luego `onClose()`.
- **C8 (despedida del usuario)**: en `send()`, antes de llamar al servidor, comprobar si `clean` matchea `/^(gracias|nada m[aá]s|adi[oó]s|hasta luego|chao|chau)\b/i`. Si sí, responder local con *"Hasta luego, Leopoldo."*, hablarlo y cerrar tras `onend`.
- **D9 (anti-eco)**: revisar que `speak()` llama `stopListening()` al inicio (ya lo hace `send()`, pero el resumen externo no pasa por `send()`). Añadir `stopListening()` al principio de `speak()`.

No se tocan rutas, ni estructura de páginas, ni componentes fuera del agente. Se respeta la **regla de oro** del proyecto.

## Fuera de alcance (no se hace ahora)
- Cambiar la voz TTS (sigue siendo Web Speech del dispositivo o el clip pregrabado si existe).
- Persistir histórico entre sesiones (sigue limpiándose al cerrar, como ya está).
- Reordenar el menú o los Dashboards.
