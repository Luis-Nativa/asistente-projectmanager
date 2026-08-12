# Registro de Decisiones — Sistema de Pendientes por Telegram

**Fecha:** 2026-08-12

---

## Decisiones de arquitectura

### D1: Fly.io en vez de Render

**Contexto:** El plan original proponía Render free tier + cron-job.org para mantener el servicio despierto.

**Problema:** Render free tier duerme por falta de tráfico entrante. El cron de Render no corre si el servicio duerme. El keep-alive con cron-job.org es un parche frágil.

**Decisión:** Usar Fly.io en vez de Render.

**Razones:**
- Fly.io es gratis para uso ligero.
- Fly.io tiene cron nativo (Machines), sin dependencias externas.
- No hay cold starts ni retrasos.
- Mejor confiabilidad que Render free tier + cron externo.

**Tradeoffs:**
- Fly.io requiere configurar `fly.toml` y usar su CLI.
- Render tiene UI más amigable, pero la confiabilidad es más importante.

---

### D2: Refresh tokens en vez de JWT de 30 días

**Contexto:** El plan original proponía JWT de 30 días.

**Problema:** Si el JWT es robado, es válido por 30 días. No hay forma de revocarlo sin invalidar todos los tokens.

**Decisión:** JWT de 1 día + refresh token de 30 días.

**Razones:**
- Si el JWT es robado, solo es válido por 1 día.
- El refresh token se puede revocar desde el servidor.
- Mejor balance entre seguridad y UX.

**Tradeoffs:**
- Complejidad adicional de implementar refresh tokens.
- El frontend debe manejar la renovación automática.

---

### D3: No partir audios largos

**Contexto:** El plan original proponía segmentar audios de >4000 palabras en bloques.

**Problema:** La segmentación puede introducir inconsistencias. Si el bloque 1 extrae "Proyecto Casa Nativa", el bloque 2 puede no saberlo y crear un proyecto fantasma.

**Decisión:** No partir audios. El usuario dicta notas rápidas (<5 min). Si necesita dictar más, usa dictado por texto de Telegram.

**Razones:**
- Simplicidad. No hay que implementar segmentación ni deduplicación.
- El usuario puede usar dictado por texto de Telegram para dictados largos.
- Las notas de voz son para capturas rápidas, no para dictados de 20 min.

**Tradeoffs:**
- Limitación de 20 MB de Telegram (aproximadamente 5-7 min de audio).
- El usuario debe saber que las notas de voz son rápidas.

---

### D4: Diccionario de nombres para transcripción

**Contexto:** La transcripción de audios falla en nombres propios.

**Problema:** Un nombre mal transcrito crea un proyecto fantasma o una persona inexistente.

**Decisión:** Implementar diccionario de nombres comunes.

**Razones:**
- Reduce errores de transcripción en nombres propios.
- El diccionario aprende de las correcciones del usuario.
- 50 líneas de código, beneficio alto.

**Tradeoffs:**
- Mantenimiento del diccionario.
- No cubre todos los nombres, solo los más comunes.

---

## Decisiones de modelo de datos

### D5: Índice en `tasks.project_id`

**Contexto:** El plan original no incluía este índice.

**Problema:** Sin índice, cada consulta de "tareas del proyecto X" hace un scan completo.

**Decisión:** Añadir índice `idx_tasks_project`.

**Razones:**
- Mejora performance de consultas por proyecto.
- Costo de almacenamiento mínimo.
- Es una buena práctica para foreign keys.

---

### D6: Validación de ciclos en `blocked_by`

**Contexto:** El plan original no mencionaba validación de ciclos.

**Problema:** Si la tarea A bloquea a B, y B bloquea a A, tienes un ciclo. El sistema no dispara recordatorios para ninguna de las dos.

**Decisión:** Implementar validación de ciclos con BFS.

**Razones:**
- Previene bugs difíciles de debuggear.
- 20 líneas de código.
- Mejora la experiencia del usuario.

**Tradeoffs:**
- Complejidad adicional en el executor.
- overhead de performance mínimo (BFS en grafo pequeño).

---

### D7: Recurrencia con generación de instancias (Opción C)

**Contexto:** El plan original no especificaba cómo manejar recurrencia.

**Problema:** Si digo "cada semana revisar el checklist", ¿el sistema crea una tarea nueva cada semana? ¿O solo recuerda la tarea original?

**Decisión:** Opción C: Cuando se completa una tarea recurrente, el sistema crea la siguiente instancia con `due_at` = próxima fecha.

**Razones:**
- Es la más intuitiva para el usuario.
- Cada instancia es independiente.
- Permite rastrear la cadena con `recurrence_parent`.

**Tradeoffs:**
- Complejidad adicional en el executor.
- Hay que implementar `calculateNextDate`.

---

### D8: Índice parcial en `tasks` para `confirmed = true`

**Contexto:** El plan original no incluía este índice.

**Problema:** Las tareas no confirmadas no disparan recordatorios. Sin índice, cada consulta filtra por `confirmed = true` en memoria.

**Decisión:** Añadir índice parcial `idx_tasks_remind`.

**Razones:**
- Mejora performance de consultas de recordatorios.
- Solo indexa tareas que necesitan recordatorios.
- Costo de almacenamiento mínimo.

---

## Decisiones de seguridad

### D9: Caducidad default de 90 días para shares

**Contexto:** El plan original no especificaba caducidad default.

**Problema:** Los enlaces compartidos se olvidan y quedan vivos para siempre.

**Decisión:** Caducidad default de 90 días.

**Razones:**
- Obliga a revisar los accesos compartidos.
- Reduce riesgo de accesos olvidados.
- El usuario puede extender si es necesario.

**Tradeoffs:**
- El usuario tiene que renovar accesos cada 90 días.
- Puede ser molesto si hay muchos colaboradores.

---

### D10: Auditoría de accesos + notificación de acceso nuevo

**Contexto:** El plan original no incluía auditoría de accesos.

**Problema:** No hay visibilidad de quién accede y cuándo.

**Decisión:** Actualizar `last_seen_at` en cada request y notificar al owner en el primer acceso.

**Razones:**
- Da visibilidad de accesos.
- Detecta accesos no autorizados.
- 30 líneas de código, beneficio alto.

**Tradeoffs:**
- overhead de performance mínimo (UPDATE en cada request).
- Notificación puede ser molesta si hay muchos colaboradores.

---

### D11: Validación de `secret_token` en webhook

**Contexto:** El plan original no mencionaba validación de `secret_token`.

**Problema:** Sin validación, cualquiera puede falsificar requests al webhook.

**Decisión:** Validar `X-Telegram-Bot-Api-Secret-Token` en cada request.

**Razones:**
- Previene requests falsificados.
- Es una línea de código.
- Es una buena práctica de seguridad.

---

### D12: Tests automatizados de filtrado por scope

**Contexto:** El plan original no mencionaba tests de filtrado.

**Problema:** Es fácil cometer un error en el filtrado por scope y que un colaborador vea datos de otro proyecto.

**Decisión:** Escribir tests automatizados que verifiquen el filtrado.

**Razones:**
- Previene bugs de seguridad críticos.
- Da confianza al hacer cambios.
- Es el test más importante del sistema.

**Tradeoffs:**
- Tiempo de escribir los tests.
- Mantenimiento de los tests.

---

## Decisiones de parser

### D13: Eval dataset antes de la Fase 2

**Contexto:** El plan original no mencionaba eval dataset.

**Problema:** Sin eval dataset, no sabes si el parser funciona o si solo tuviste suerte con los primeros mensajes.

**Decisión:** Crear eval dataset de 20-30 mensajes con salida esperada antes de la Fase 2.

**Razones:**
- Permite medir precisión del parser.
- Permite iterar el prompt con datos concretos.
- Previene regresiones.

**Tradeoffs:**
- Tiempo de crear el dataset.
- Mantenimiento del dataset.

---

### D14: No partir audios largos (repetida)

**Contexto:** Ver D3.

**Decisión:** Ver D3.

---

### D15: Ejemplos few-shot con correcciones múltiples

**Contexto:** El plan original no incluía ejemplos con correcciones.

**Problema:** El parser puede confundirse con correcciones del usuario.

**Decisión:** Añadir ejemplo few-shot con correcciones múltiples.

**Razones:**
- Mejora precisión del parser en casos de correcciones.
- Los ejemplos few-shot son más efectivos que instrucciones en prosa.

---

### D16: UX de "dudas" en el dashboard

**Contexto:** El plan original no especificaba cómo ver las dudas.

**Problema:** Si el parser tiene dudas, el usuario no sabe cómo resolverlas.

**Decisión:** Las tareas con dudas aparecen resaltadas en el dashboard, con la pregunta visible.

**Razones:**
- Da visibilidad de dudas.
- Permite resolver dudas rápidamente.
- Mejora la experiencia del usuario.

**Tradeoffs:**
- Complejidad adicional en el frontend.

---

## Decisiones de recordatorios

### D17: Aceptar que el briefing puede llegar tarde

**Contexto:** El plan original no mencionaba retrasos del cron.

**Problema:** Si el cron se salta la corrida de las 7:00, el briefing llega tarde.

**Decisión:** Aceptar este comportamiento. No vale la pena complicar el diseño.

**Razones:**
- Fly.io cron es confiable, pero no perfecto.
- Para uso personal, 5-10 min de retraso es aceptable.
- Complejidad adicional no vale la pena.

---

### D18: Lógica para tareas bloqueadas en el cron

**Contexto:** El plan original no mencionaba tareas bloqueadas en el cron.

**Problema:** Las tareas bloqueadas no deben disparar recordatorios.

**Decisión:** Añadir lógica en el cron para verificar si la tarea bloqueadora está completada.

**Razones:**
- Previene recordatorios de tareas que no se pueden hacer.
- Es una subquery simple.

---

### D19: Comando `/posponer`

**Contexto:** El plan original no incluía `/posponer`.

**Problema:** El cierre nocturno pregunta "qué se pospone", pero no hay forma de responder.

**Decisión:** Añadir comando `/posponer <id> <fecha>`.

**Razones:**
- Permite posponer tareas rápidamente.
- Es más confiable que parsing de lenguaje natural.

---

## Decisiones de acceso compartido

### D20: Navegación del main a proyectos sin PIN

**Contexto:** El plan original no aclaraba cómo navegar del main a un tablero de proyecto.

**Problema:** ¿Necesitas otro PIN para cada proyecto?

**Decisión:** El frontend guarda en `localStorage` que "este usuario es owner" y navega a cualquier proyecto sin pedir PIN.

**Razones:**
- Mejora la experiencia del usuario.
- El owner ya está autenticado.
- Los colaboradores sí necesitan PIN para cada tablero.

---

### D21: `last_review_at` separado de `last_seen_at`

**Contexto:** El plan original usaba `last_seen_at` para "última revisión".

**Problema:** `last_seen_at` se actualiza en cada request, pero "última revisión" es un concepto diferente.

**Decisión:** Añadir `last_review_at` y un botón "Marcar como revisado".

**Razones:**
- Separa "último acceso" de "última revisión".
- Permite saber cuándo fue la última revisión real.

---

### D22: Notificaciones de comentarios por Telegram

**Contexto:** El plan original no incluía notificaciones de comentarios.

**Problema:** Si Karla comenta en una tarea, ¿cómo te enteras?

**Decisión:** Notificar por Telegram cuando se crea un comentario.

**Razones:**
- Permite responder comentarios rápidamente.
- Evita tener que entrar al dashboard para ver comentarios.
- 20 líneas de código.

---

## Decisiones de notas de voz

### D23: Confirmación rápida + notificación + confirmación por Telegram

**Contexto:** El plan original asumía que el usuario iba a revisar.

**Problema:** Si no revisas, en 3 semanas tienes 400 tareas fantasma.

**Decisión:** Implementar las tres:
1. Confirmación automática después de 24h (solo tareas sin dudas).
2. Notificación si hay tareas sin confirmar después de 24h.
3. Confirmación por Telegram (`/confirmar <id>`).

**Razones:**
- Reduce fricción de revisión.
- La confirmación por Telegram es la más importante: reduce fricción a cero.
- Previene tareas fantasma.

---

### D24: Titulares de proyectos por texto, resto por audio

**Contexto:** El usuario preguntó si puede crear proyectos por texto y el resto por audio.

**Decisión:** Sí. Los proyectos se crean por texto (son pocos y estructurados). El resto (tareas, gastos, notas) se puede dictar por audio.

**Razones:**
- Los proyectos son pocos y estructurados.
- Las tareas, gastos y notas son muchos y coloquiales.
- Flexibilidad para el usuario.

---

### D25: Aceptar límite de 20 MB de Telegram

**Contexto:** Telegram no permite descargar archivos de más de 20 MB con `getFile`.

**Problema:** Si mandas un audio de 25 min como archivo, el bot no puede procesarlo.

**Decisión:** Aceptar esta limitación. El usuario debe saber que las notas de voz son rápidas.

**Razones:**
- No vale la pena complicar el diseño.
- Las notas de voz son para capturas rápidas (<5 min).
- Si necesita dictar más, usa dictado por texto de Telegram.

---

## Decisiones de implementación

### D26: Implementar por fases, crear plan completo primero

**Contexto:** El usuario pidió implementar por fases pero crear el plan completo primero.

**Decisión:** Crear todos los archivos .md de planeación antes de implementar código.

**Razones:**
- Permite revisar el plan completo antes de implementar.
- Documenta todas las decisiones.
- Facilita la implementación por fases.

---

## Resumen

**Total de decisiones:** 26  
**Decisiones críticas:** D1 (Fly.io), D2 (Refresh tokens), D3 (No partir audios), D13 (Eval dataset), D23 (Confirmación de notas de voz).

**Principios generales:**
1. **Confiabilidad sobre costo.** Fly.io es gratis y más confiable que Render free tier.
2. **Seguridad sobre comodidad.** Refresh tokens, validación de secret_token, tests de filtrado.
3. **Simplicidad sobre funcionalidad.** No partir audios, aceptar límite de 20 MB.
4. **UX sobre perfección.** Confirmación por Telegram, navegación sin PIN para owner.
