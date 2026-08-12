# Revisión de Ingeniería — Sistema de Pendientes por Telegram

**Fecha:** 2026-08-12  
**Plan revisado:** Sistema completo con parser Gemini, dashboard Next.js, recordatorios y notas de voz  
**Estado:** Revisión técnica opinionada

---

## Resumen ejecutivo

El plan está **bien pensado y es implementable**. Las decisiones de stack son razonables (Node + TypeScript + Neon + Gemini Flash), el modelo de datos es sólido, y el enfoque iterativo por fases es correcto. El caso de prueba maestro (sección 15) es excelente: tener un volcado real con criterios de aceptación claros es lo que separa un proyecto que funciona de uno que se atasca en "vibes".

**Problemas críticos que debes resolver antes de implementar:**

1. **Render Cron + free tier es una contradicción.** El cron no corre si el servicio duerme. El keep-alive es un parche frágil.
2. **El prompt del parser tiene 24 reglas + ejemplos.** Gemini Flash va a perder precisión. Necesitas un sistema de evaluación, no solo "probar y ver".
3. **El filtrado por scope es el punto único de fallo de seguridad.** Un endpoint mal filtrado y Karla ve todo. Requiere tests automatizados, no solo revisión manual.
4. **La pantalla de revisión de notas de voz asume que vas a revisar.** No vas a hacerlo. En 3 semanas tienes 400 tareas fantasma.

---

## 1. Arquitectura y decisiones de stack

### Lo que está bien

- **Webhook sobre polling:** Correcto. El polling no despierta el servicio en Render free tier.
- **Neon sobre RDS/Supabase:** Serverless, capa gratis generosa, SQL plano. Buena elección para un proyecto personal.
- **Gemini Flash sobre GPT-4o-mini:** Costo similar, pero Flash tiene mejor soporte para `responseSchema` y es más predecible en salida estructurada.
- **Next.js en Vercel:** Despliegue en un clic, integración con GitHub, gratis para uso personal.
- **Separación backend/frontend:** Dos repos o dos carpetas, cada uno con su deploy. Evita confusión en builds.

### Problemas

#### 1.1 Render Cron + Free Tier: la contradicción fundamental

El plan dice:
> "Render Cron Job separado que golpea `POST /internal/tick` cada 5 min"

Y también:
> "El plan gratis de Render duerme por falta de tráfico *entrante*"

**El problema:** Si el servicio duerme, el cron no puede despertarlo. El cron de Render asume que el servicio está activo. Si el servicio duerme, el cron se encola o se pierde.

**El parche:** Ping a `/health` cada 10 min desde cron-job.org.

**Por qué el parche es frágil:**
- cron-job.org es un servicio externo gratuito. Si se cae, tu sistema duerme.
- El ping cada 10 min mantiene el servicio despierto, pero no garantiza que el cron de Render corra a tiempo.
- Si Render cambia las reglas del free tier (ya lo hicieron antes), todo se rompe.

**Recomendación:**

**Opción A (recomendada): Migrar a Railway o Fly.io.**
- Railway: $5 de crédito gratis al mes. Suficiente para este proyecto. Cron nativo, sin cold starts.
- Fly.io: Gratis para uso ligero. Cron nativo, mejor control de infraestructura.
- Costo real: $0-5/mes. Vale la pena por la confiabilidad.

**Opción B: Usar un servicio de cron externo.**
- cron-job.org (gratis) o EasyCron ($5/mes) que llame a `POST /internal/tick`.
- El servicio puede dormir, pero el cron externo lo despierta con la llamada.
- Problema: si el servicio tarda 50s en despertar, el cron puede hacer timeout.

**Opción C: Aceptar la fragilidad.**
- Si el servicio duerme, los recordatorios se retrasan hasta el siguiente mensaje entrante.
- El briefing de las 7am puede llegar a las 7:05 o 7:10.
- Para uso personal, esto puede ser aceptable.

**Mi recomendación:** Opción A. $5/mes por confiabilidad es buen negocio. Si quieres mantener costo cero, Opción B con cron-job.org, pero monitorea que el cron esté corriendo.

#### 1.2 Cold starts de Neon

El plan menciona:
> "Sube el `connectionTimeoutMillis` a 15000"

**El problema real:** Neon suspende la BD después de ~5 min de inactividad. La primera query después de horas puede tardar 1-3s. Esto no es un timeout, es un cold start.

**Impacto en UX:**
- Mandas un mensaje por Telegram. El webhook llega, pero la primera query (guardar en `inbox_messages`) tarda 2s.
- El bot responde "Recibido" después de 2-3s en vez de <500ms.
- No es grave, pero se siente lento.

**Solución:**
- Acepta el cold start. Para uso personal, 2-3s de retraso en el primer mensaje no es crítico.
- Opcional: ping a la BD cada 4 min desde el backend para mantenerla despierta. Pero esto gasta recursos de Neon.

**Recomendación:** Acepta el cold start. Sube `connectionTimeoutMillis` a 15000 como dice el plan. No vale la pena complicar el diseño para ahorrar 2s.

#### 1.3 Gemini Flash: ¿es la mejor opción?

**Alternativas consideradas implícitamente:**
- GPT-4o-mini: costo similar, pero `responseSchema` es menos maduro.
- Claude Haiku: más caro, pero mejor en instrucciones complejas.
- Ollama local: gratis, pero requiere infraestructura.

**Por qué Flash es correcto aquí:**
- `responseSchema` es nativo y funciona bien.
- Costo: ~$0.0001 por mensaje de texto, ~$0.001 por minuto de audio. Para uso personal, centavos al mes.
- Velocidad: <2s para respuestas típicas.

**Riesgo:** Google puede cambiar precios o deprecar la API. Pero para un proyecto personal, el costo de migrar es bajo (solo cambias el cliente de LLM).

**Recomendación:** Quédate con Flash. Está bien elegido.

### Veredicto de arquitectura

**Aprobada con una condición:** resuelve el tema del cron antes de la Fase 5. Si vas a usar Render free tier, usa un cron externo (cron-job.org) y acepta que los recordatorios pueden retrasarse 1-2 min. Si quieres confiabilidad, migra a Railway ($5/mes).

---

## 2. Modelo de datos

### Lo que está bien

- **UUIDs como PKs:** Correcto para un sistema distribuido (aunque no necesites distribución, es una buena práctica).
- **`timestamptz` para todo:** Evita bugs de zona horaria. La conversión a `America/Mexico_City` se hace solo en el frontend.
- **`inbox_messages` como bitácora cruda:** Excelente. Si el parser se equivoca, puedes reprocesar sin perder el original.
- **No guardar "gastado" en `projects`:** Correcto. Se calcula sumando `expenses`. Evita desincronización.
- **`tags` como `TEXT[]`:** Flexible, permite áreas dentro de proyectos sin crear una tabla aparte.

### Problemas

#### 2.1 Índices faltantes

**Falta un índice en `tasks.project_id`:**
```sql
CREATE INDEX ON tasks (project_id);
```
Sin esto, cada consulta de "tareas del proyecto X" hace un scan completo. Con 1000 tareas, no es grave. Con 10,000, sí.

**Falta un índice en `expenses.project_id` (ya existe, pero verifica):**
```sql
CREATE INDEX ON expenses (project_id, status);
```
Este ya está en el plan. Bien.

**Falta un índice en `shares.slug`:**
```sql
CREATE UNIQUE INDEX ON shares (slug);
```
El plan dice `slug TEXT UNIQUE NOT NULL`, lo que implica un índice único. Pero explícitalo para claridad.

**Falta un índice en `activity.created_at`:**
```sql
CREATE INDEX ON activity (created_at DESC);
```
Este ya está en el plan. Bien.

**Recomendación:** Añade `CREATE INDEX ON tasks (project_id);` a la migración.

#### 2.2 `blocked_by` sin validación de ciclos

El plan añade:
```sql
ALTER TABLE tasks ADD COLUMN blocked_by UUID REFERENCES tasks(id) ON DELETE SET NULL;
```

**El problema:** Si la tarea A bloquea a B, y B bloquea a A, tienes un ciclo. El sistema no dispara recordatorios para ninguna de las dos, y el usuario no sabe por qué.

**Solución:**
- Opción A: Validación en el backend. Antes de insertar `blocked_by`, verifica que no haya un ciclo (BFS/DFS desde la tarea nueva).
- Opción B: Acepta el riesgo. Para un sistema personal, los ciclos son raros. Si ocurren, el usuario ve tareas atenuadas y puede investigar.

**Recomendación:** Opción A. 20 líneas de código. Añade una función `would_create_cycle(task_id, blocked_by)` que haga BFS. Si hay ciclo, rechaza la operación con un mensaje claro.

#### 2.3 Recurrencia no está completa

El plan añade:
```sql
ALTER TABLE tasks ADD COLUMN recurrence TEXT; -- diaria | semanal | quincenal | mensual
```

**El problema:** ¿Cómo se generan las instancias futuras? Si digo "cada semana revisar el checklist", ¿el sistema crea una tarea nueva cada semana? ¿O solo recuerda la tarea original?

**Opciones:**
- **Opción A:** La tarea original se marca como completada, y el cron genera una nueva instancia para la próxima fecha.
- **Opción B:** La tarea nunca se completa. El cron solo manda recordatorios periódicos.
- **Opción C:** La tarea se completa, y el sistema crea una nueva con `due_at` = próxima fecha.

**Recomendación:** Opción C. Es la más intuitiva. Cuando completas una tarea recurrente, el sistema crea la siguiente instancia. Añade un campo `recurrence_parent` para rastrear la cadena.

**Falta en el esquema:**
```sql
ALTER TABLE tasks ADD COLUMN recurrence_parent UUID REFERENCES tasks(id);
```

#### 2.4 `confirmed` sin índice

El plan añade:
```sql
ALTER TABLE tasks ADD COLUMN confirmed BOOLEAN NOT NULL DEFAULT true;
```

**El problema:** Las tareas no confirmadas no disparan recordatorios. Pero sin índice, cada consulta de "tareas pendientes de recordatorio" filtra por `confirmed = true` en memoria.

**Recomendación:** Añade un índice parcial:
```sql
CREATE INDEX ON tasks (remind_at) WHERE reminded_at IS NULL AND confirmed = true;
```

### Veredicto de modelo de datos

**Aprobado con ajustes menores:**
1. Añade índice en `tasks.project_id`.
2. Añade validación de ciclos en `blocked_by`.
3. Completa el diseño de recurrencia (¿cómo se generan instancias?).
4. Añade índice parcial en `tasks` para `confirmed = true`.

---

## 3. Seguridad

### Lo que está bien

- **Filtrado por scope en el servidor:** Correcto. El `project_id` sale del token, no del request.
- **Rate limit de 5 intentos de PIN por IP cada 15 min:** Suficiente para 6 dígitos.
- **`private = true` para tareas sensibles:** Buena idea. El texto crudo del mensaje puede mencionar montos o temas delicados.
- **Protección de `DELETE /api/shares/:id` para `role='owner'`:** Evita que te borres por accidente.

### Problemas

#### 3.1 El PIN se comparte por WhatsApp

El plan dice:
> "Un PIN de 6 dígitos compartido por WhatsApp se reenvía, se filtra y no caduca solo."

**El riesgo real:**
- Karla reenvía el enlace + PIN a alguien más.
- El PIN queda en el historial de WhatsApp.
- Si Karla pierde el celular, alguien puede acceder al tablero.

**Mitigaciones en el plan:**
- Caducidad de 90 días (default).
- Revocación desde el main.
- `can_see_money = false` por defecto.

**Lo que falta:**
- **Auditoría de accesos:** El plan tiene `activity`, pero no registra *accesos* al tablero, solo acciones. Añade `last_seen_at` en `shares` (ya está en el esquema) y actualízalo en cada request.
- **Notificación de acceso nuevo:** Cuando un share se usa por primera vez, manda un mensaje a tu chat de Telegram: "Karla accedió al tablero por primera vez".
- **Revocación automática por inactividad:** Si un share no se usa en 60 días, revócalo automáticamente (o al menos notifícalo).

**Recomendación:** Añade las tres mitigaciones. Son 30 líneas de código y te dan visibilidad.

#### 3.2 JWT de 30 días es demasiado largo

El plan dice:
> "devuelve un JWT de 30 días"

**El problema:** Si revocas un share, el token sigue siendo válido por hasta 30 días. El middleware recarga el share desde la BD en cada request, así que un share revocado es rechazado inmediatamente. Pero si el JWT es robado, puede usarse por 30 días.

**Solución:**
- Reduce la vida del JWT a 7 días.
- O usa refresh tokens: JWT de 1 día + refresh token de 30 días.

**Recomendación:** Reduce a 7 días. Para un tablero personal, volver a ingresar el PIN una vez por semana es aceptable.

#### 3.3 Webhook de Telegram: validación insuficiente

El plan dice:
> "Filtra por `TELEGRAM_CHAT_ID` en el webhook."

**El problema:** El plan original filtra por un solo `TELEGRAM_CHAT_ID`. El addendum 13.6 cambia esto a "busca el `chat.id` en `shares`". Pero no menciona cómo validar que el mensaje viene realmente de Telegram.

**Lo que falta:**
- **Validación del `secret_token`:** Telegram permite configurar un `secret_token` en `setWebhook`. Cada request incluye este token en el header `X-Telegram-Bot-Api-Secret-Token`. Valídalo contra `TELEGRAM_WEBHOOK_SECRET`.
- **Validación de `chat.id`:** Después de validar el secret_token, verifica que `chat.id` esté en `shares.tg_chat_id` (o sea el owner).

**Recomendación:** Añade validación de `secret_token` en el middleware del webhook. Es una línea de código y evita que alguien falsifique requests.

#### 3.4 El filtrado por scope requiere tests automatizados

El plan enfatiza:
> "El `project_id` del alcance sale del token, nunca del request."

**El problema:** Es fácil cometer un error. Aceptas `?project_id=` del cliente, lo usas en la query, y Karla puede leer todos tus proyectos.

**Solución:** Tests automatizados que verifiquen el filtrado.

**Recomendación:** Al final de la Fase 8, escribe un test que:
1. Cree dos proyectos (A y B).
2. Cree un share con alcance de A.
3. Intente leer B con ese token → debe fallar (403).
4. Intente modificar B con ese token → debe fallar (403).
5. Intente leer A con ese token → debe funcionar (200).

Este test es el más importante del sistema. Sin él, no sabes si el filtrado funciona.

### Veredicto de seguridad

**Aprobado con ajustes:**
1. Añade auditoría de accesos y notificación de acceso nuevo.
2. Reduce la vida del JWT a 7 días.
3. Añade validación de `secret_token` en el webhook.
4. Escribe tests automatizados de filtrado por scope.

---

## 4. Parser con LLM

### Lo que está bien

- **Salida estructurada con `responseSchema`:** Elimina el parsing de JSON a mano.
- **Ejemplos few-shot del volcado real:** Excelente. Los ejemplos reales son 10x más efectivos que ejemplos inventados.
- **Regla 18 (no todo monto es un gasto):** Crítica. Sin esto, el parser crea gastos fantasma.
- **Bitácora en `inbox_messages`:** Si el parser falla, puedes reprocesar.

### Problemas

#### 4.1 El prompt tiene 24 reglas + ejemplos. Gemini Flash va a perder precisión.

**El problema:** Los LLMs pierden precisión con prompts largos. Después de ~10 reglas, las últimas se ignoran o se aplican mal.

**Evidencia:** El plan dice:
> "Cuando tengas la Fase 2 corriendo, mándame los casos donde el parser se equivocó y afinamos el prompt"

Esto es reactivo. Necesitas un sistema proactivo.

**Solución: Eval dataset.**

1. Crea un dataset de 20-30 mensajes de prueba (incluyendo el volcado de 16 min).
2. Para cada mensaje, define la salida esperada (tareas, gastos, notas, etc.).
3. Corre el parser sobre el dataset. Mide precisión, recall, F1.
4. Itera el prompt hasta que la precisión sea >90%.
5. Guarda el dataset y los resultados. Cada vez que cambies el prompt, re-corre el dataset.

**Recomendación:** Crea el eval dataset antes de la Fase 2. Sin esto, estás volando a ciegas.

#### 4.2 Segmentación de audios largos puede introducir inconsistencias

El plan dice:
> "Si la transcripción pasa de ~4,000 palabras, pártela en bloques por pausas largas o cambios de tema y corre el parser por bloque, pasándole como contexto las acciones ya extraídas de los bloques anteriores"

**El problema:**
- ¿Cómo defines "cambio de tema"? ¿Por pausa de 5s? ¿10s?
- Si el bloque 1 extrae "Proyecto Casa Nativa", ¿el bloque 2 lo sabe? ¿Y si el bloque 2 menciona "el proyecto" sin decir "Casa Nativa"?
- El parser puede duplicar acciones o crear proyectos fantasma.

**Solución:**
- Segmenta por pausas de >10s o cambios de tema detectados por la transcripción (marcas `[mm:ss]`).
- Pasa al bloque N un resumen compacto de las acciones del bloque N-1 (no las acciones completas, solo: proyectos mencionados, tareas creadas, personas).
- Si el bloque N menciona "el proyecto" sin nombre, asume que es el último proyecto mencionado en el resumen.

**Recomendación:** Implementa la segmentación, pero añade un paso de deduplicación al final. Si dos acciones tienen el mismo título y proyecto, mézclalas.

#### 4.3 El parser no maneja bien las correcciones del usuario

El plan dice:
> "Al hablar, el usuario se corrige a sí mismo. 'Le debo ocho mil, no, nueve mil' → usa 9000."

**El problema:** ¿Y si la corrección es ambigua? "Le debo ocho mil... o mejor siete mil... no, espera, eran nueve mil." ¿Cuál es la versión final?

**Solución:** La regla 12 dice "La última versión de un dato gana." Esto es correcto, pero el parser debe identificar correcciones.

**Recomendación:** Añade un ejemplo few-shot con correcciones múltiples:
> Entrada: "le debo al herrero ocho mil... no, espera, eran nueve mil... o mejor siete mil, no, al final son ocho mil"
> Salida: `crear_gasto` con amount 8000

#### 4.4 No hay mecanismo de "duda" para el usuario

El plan dice:
> "Si algo es genuinamente ambiguo, créalo con tu mejor interpretación y agrega el campo 'duda' con una pregunta corta"

**El problema:** ¿Cómo ve el usuario las dudas? ¿En el resumen de Telegram? ¿En el dashboard?

**Solución:**
- En el resumen de Telegram, lista las dudas: "5 acciones con dudas por resolver".
- En el dashboard, las tareas con dudas aparecen resaltadas, con la pregunta visible.
- El usuario resuelve la duda editando la tarea o marcándola como "correcta".

**Recomendación:** Añade esto al diseño del dashboard (Fase 3).

### Veredicto de parser

**Aprobado con ajustes críticos:**
1. Crea un eval dataset de 20-30 mensajes antes de la Fase 2.
2. Implementa deduplicación después de la segmentación de audios largos.
3. Añade ejemplos few-shot con correcciones múltiples.
4. Diseña la UX de "dudas" en el dashboard.

---

## 5. Recordatorios y cron

### Lo que está bien

- **Briefing matutino a las 7:00 y cierre nocturno a las 21:00:** Buena cadencia.
- **Control de "ya se envió hoy" con `system_flags`:** Más confiable que depender de que el cron nunca se salte una corrida.
- **`reminded_at` para evitar duplicados:** Correcto.

### Problemas

#### 5.1 ¿Qué pasa si el cron se salta una corrida?

El plan asume que el cron corre cada 5 min sin falta. Pero:
- Render puede tener retrasos.
- cron-job.org puede fallar.
- El servicio puede estar en cold start.

**El problema:** Si el cron se salta la corrida de las 7:00, el briefing no se envía. `system_flags.last_briefing_date` no se actualiza. La siguiente corrida (7:05) ve que "no se ha enviado hoy" y lo envía.

**Esto es aceptable.** El briefing llega tarde, pero llega.

**Recomendación:** Acepta este comportamiento. No vale la pena complicar el diseño para manejar retrasos de 5 min.

#### 5.2 Las tareas bloqueadas no disparan recordatorios

El plan dice:
> "Una tarea con `blocked_by` apuntando a algo no completado **no dispara recordatorios**"

**El problema:** ¿Cómo sabe el cron si la tarea bloqueadora está completada? Necesita hacer un JOIN o una subquery.

**Solución:**
```sql
SELECT * FROM tasks
WHERE remind_at <= now()
  AND reminded_at IS NULL
  AND status = 'pendiente'
  AND confirmed = true
  AND (blocked_by IS NULL OR (SELECT status FROM tasks WHERE id = blocked_by) = 'hecho')
```

**Recomendación:** Añade esta lógica al cron. Es una subquery simple.

#### 5.3 No hay mecanismo de "posponer"

El plan menciona:
> "Cierre nocturno: manda lo que quedó pendiente y pregunta qué se pospone."

**El problema:** ¿Cómo responde el usuario? ¿Por Telegram? ¿Por el dashboard?

**Solución:**
- Por Telegram: el usuario responde "posponer tarea X a mañana".
- El parser interpreta y actualiza `due_at`.

**Recomendación:** Añade un comando `/posponer <id> <fecha>` al bot. Es más confiable que parsing de lenguaje natural.

### Veredicto de recordatorios

**Aprobado con ajustes menores:**
1. Acepta que el briefing puede llegar tarde (5-10 min).
2. Añade lógica para tareas bloqueadas en el cron.
3. Añade un comando `/posponer` al bot.

---

## 6. Acceso compartido (addendum 13)

### Lo que está bien

- **Multi-tablero con permisos granulares:** Excelente diseño. Un solo camino de código para owner y colaboradores.
- **`can_see_money`, `can_complete`, `can_create`:** Permisos bien pensados.
- **Seed inicial para el owner:** Correcto. Tu acceso vive en la misma tabla que los colaboradores.
- **Botón "Compartir" con mensaje listo para WhatsApp:** Buena UX.

### Problemas

#### 6.1 El main es una vista agregada, pero no está clara su implementación

El plan dice:
> "Tu enlace y tu PIN no caducan ni se revocan desde la interfaz."

Y también:
> "El main es la vista agregada de todo. Cada proyecto aparece como tarjeta."

**El problema:** ¿Cómo navegas del main a un tablero de proyecto? ¿Sin volver a poner PIN?

**Solución:**
- El main tiene `role='owner'` y `project_id=NULL`.
- Desde el main, haces clic en un proyecto. El frontend navega a `/d/<slug-proyecto>`.
- Pero el slug del proyecto es diferente al slug del main. ¿Necesitas otro PIN?

**Recomendación:** Aclara esto en el diseño. Opción: el frontend guarda en `localStorage` que "este usuario es owner" y navega a cualquier proyecto sin pedir PIN. Opción más simple: el main muestra todos los proyectos, y los "tableros de proyecto" son solo vistas filtradas del main (no rutas separadas).

#### 6.2 `last_seen_at` se actualiza en cada request, pero no se usa

El plan dice:
> "last_seen_at: para que 'desde la última revisión' sea automático."

**El problema:** `last_seen_at` se actualiza en cada request, pero "última revisión" es un concepto diferente a "último acceso". Puedo entrar al tablero 10 veces sin revisar nada.

**Solución:**
- Añade un campo `last_review_at` por proyecto (en `projects` o `system_flags`).
- El usuario marca "revisado" manualmente, o el sistema lo marca después de 5 min de inactividad en el tablero.

**Recomendación:** Añade `last_review_at` y un botón "Marcar como revisado" en el tablero.

#### 6.3 Los comentarios no tienen notificaciones

El plan dice:
> "Caja de comentarios por tarea. Aquí es donde ocurre el ida y vuelta que hoy pasa en WhatsApp y se pierde."

**El problema:** Si Karla comenta en una tarea, ¿cómo te enteras? ¿Tienes que entrar al tablero a ver comentarios?

**Solución:**
- Cuando se crea un comentario, manda un mensaje a tu chat de Telegram: "Karla comentó en 'Remodelar taller': '¿Ya compraste el triplay?'"
- Agrupa comentarios por hora para no saturarte (como dice el plan para notificaciones de tareas completadas).

**Recomendación:** Añade notificaciones de comentarios por Telegram. Es 20 líneas de código.

### Veredicto de acceso compartido

**Aprobado con ajustes:**
1. Aclara cómo navegas del main a un tablero de proyecto sin PIN.
2. Añade `last_review_at` separado de `last_seen_at`.
3. Añade notificaciones de comentarios por Telegram.

---

## 7. Notas de voz (addendum 14)

### Lo que está bien

- **Pipeline de dos pasadas (transcribir → parsear):** Correcto. Pedir transcripción + clasificación en una sola llamada degrada la precisión.
- **Guardar `tg_file_id`:** Puedes volver a bajar el audio meses después sin almacenarlo.
- **Pantalla de revisión con marcas de tiempo:** Excelente. Cuando algo sale raro, en 5s verificas qué dijiste.
- **Todo entra con `confirmed = false`:** Crítico. No quieres que una tarea mal parseada te esté timbrando el martes a las 7am.

### Problemas

#### 7.1 La pantalla de revisión asume que vas a revisar

El plan dice:
> "La tentación va a ser dictar 20 minutos y no revisar nunca. Si no revisas, en tres semanas tu base de datos tiene 400 tareas fantasma."

**El problema real:** La pantalla de revisión es un paso adicional. Si toma >3 min, no la vas a usar.

**Solución:**
- **Revisión rápida:** Las tareas sin dudas se marcan como confirmadas automáticamente después de 24h. Solo revisas las que tienen dudas.
- **Notificación de recordatorio:** Si hay tareas sin confirmar después de 24h, el bot te manda un mensaje: "Tienes 12 tareas sin confirmar. → Revisar".
- **Confirmación por Telegram:** En vez de entrar al dashboard, puedes confirmar por Telegram: "/confirmar 128" confirma todo el volcado 128.

**Recomendación:** Implementa las tres. La confirmación por Telegram es la más importante: reduce la fricción a cero.

#### 7.2 La transcripción va a fallar en nombres propios

El plan dice:
> "La transcripción de un dictado hecho en el coche, con ruido y nombres propios locales, va a fallar en los nombres."

**El problema:** Un nombre mal transcrito crea un proyecto fantasma o una persona inexistente.

**Solución:**
- **Diccionario de nombres:** Mantén una lista de nombres comunes (Karla, Paulina, Luis, Casa Nativa, etc.). Si la transcripción dice "Carla(?)" y "Karla" está en el diccionario, sugiere "Karla".
- **Aprendizaje:** Cuando corriges un nombre en la pantalla de revisión, guárdalo. La próxima vez, usa la corrección.

**Recomendación:** Implementa un diccionario simple de nombres. 50 líneas de código.

#### 7.3 El límite de 20 MB de Telegram es un problema real

El plan dice:
> "Si llega un `audio`/`document` con `file_size > 20 MB`, responde de inmediato: 'Ese archivo pesa 27 MB y Telegram no me deja bajarlo.'"

**El problema:** Si mandas un audio de 25 min como archivo (no como nota de voz), el bot no puede procesarlo.

**Solución:**
- Obliga a que los audios se manden como notas de voz (mantener presionado el micrófono).
- Si llega un archivo >20 MB, responde con el mensaje de error y sugiere reenviarlo como nota de voz.

**Recomendación:** Acepta esta limitación. Es un edge case raro. La mayoría de las notas de voz son <5 min.

### Veredicto de notas de voz

**Aprobado con ajustes críticos:**
1. Implementa confirmación por Telegram (`/confirmar <id>`).
2. Añade un diccionario de nombres para reducir errores de transcripción.
3. Acepta el límite de 20 MB de Telegram. No vale la pena complicar el diseño.

---

## 8. Plan de implementación

### Lo que está bien

- **Fases iterativas:** Correcto. No intentes construir todo de golpe.
- **Criterios de aceptación claros:** "Mandas el ejemplo del herrero y salen 2 filas correctas." Excelente.
- **El caso de prueba maestro (sección 15):** La mejor parte del plan. Tener un volcado real con criterios de aceptación es lo que separa un proyecto que funciona de uno que se atasca.

### Problemas

#### 8.1 Las fases 8-11 son addendums, no fases originales

El plan original tiene 7 fases. Los addendums añaden 4 más (8-11). Esto puede causar confusión.

**Recomendación:** Reorganiza las fases:
- **Fases 0-7:** Sistema base (texto, dashboard, recordatorios, consultas).
- **Fases 8-10:** Acceso compartido (multi-tablero, actividad, comentarios).
- **Fase 11:** Notas de voz.

Implementa las fases 0-7 primero. Si después quieres acceso compartido, añade las fases 8-10. Si quieres notas de voz, añade la fase 11.

#### 8.2 Falta un plan de rollback

El plan asume que todo sale bien. Pero:
- ¿Y si la migración de la BD falla?
- ¿Y si el parser se equivoca y crea 100 tareas fantasma?
- ¿Y si el webhook de Telegram deja de funcionar?

**Recomendación:** Añade un plan de rollback:
- **BD:** Guarda un backup antes de cada migración.
- **Parser:** Si crea >10 tareas de un solo mensaje, marca el mensaje como "revisar" y no ejecutes las acciones.
- **Webhook:** Si el webhook falla 3 veces seguidas, manda un mensaje de alerta a tu chat.

#### 8.3 No hay monitoreo ni alertas

El plan no menciona cómo sabes si el sistema está funcionando.

**Recomendación:** Añade:
- **Health check:** `GET /health` devuelve 200 si todo está bien.
- **Uptime monitoring:** Usa UptimeRobot (gratis) para hacer ping a `/health` cada 5 min. Si falla, te manda un email o notificación.
- **Error tracking:** Usa Sentry (gratis para uso personal) para trackear errores del backend.

---

## Preguntas para ti antes de implementar

Antes de empezar la Fase 0, necesito que aclares esto:

### Pregunta 1: ¿Render free tier o Railway?

**Opciones:**
- **A) Render free tier + cron-job.org:** Costo $0, pero los recordatorios pueden retrasarse 5-10 min.
- **B) Railway ($5/mes):** Confiabilidad total, sin cold starts ni retrasos.

**Mi recomendación:** B. $5/mes por confiabilidad es buen negocio.

### Pregunta 2: ¿Implementas las fases 8-11 (acceso compartido + notas de voz)?

**Opciones:**
- **A) Sí, todo:** Quieres el sistema completo con multi-tablero y notas de voz.
- **B) Solo 0-7 primero:** Implementa el sistema base, úsalo 2 semanas, y después decide si añades las otras fases.

**Mi recomendación:** B. El sistema base ya es útil. Las fases 8-11 son "nice to have". No las implementes hasta que hayas validado que el sistema base funciona para ti.

### Pregunta 3: ¿Eval dataset para el parser?

**Opciones:**
- **A) Sí, creo el dataset antes de la Fase 2:** 20-30 mensajes de prueba con salida esperada.
- **B) No, vuelo a ciegas:** Pruebo con mensajes reales y ajusto el prompt sobre la marcha.

**Mi recomendación:** A. Sin eval dataset, no sabes si el parser funciona o si solo tuviste suerte con los primeros mensajes.

### Pregunta 4: ¿Confirmación de notas de voz por Telegram?

**Opciones:**
- **A) Sí, añado `/confirmar <id>`:** Puedes confirmar volcados desde Telegram sin entrar al dashboard.
- **B) No, solo desde el dashboard:** La confirmación solo se puede hacer desde la pantalla de revisión.

**Mi recomendación:** A. Reduce la fricción a cero. Si no, no vas a revisar.

---

## Conclusión

El plan está **bien pensado y es implementable**. Las decisiones de stack son correctas, el modelo de datos es sólido, y el enfoque iterativo es el adecuado.

**Los 3 problemas críticos que debes resolver antes de implementar:**

1. **Render Cron + free tier:** Decide si usas Render free tier + cron externo (costo $0, confiabilidad media) o Railway (costo $5/mes, confiabilidad alta).

2. **Eval dataset para el parser:** Crea 20-30 mensajes de prueba con salida esperada antes de la Fase 2. Sin esto, no sabes si el parser funciona.

3. **Confirmación de notas de voz por Telegram:** Añade `/confirmar <id>` para reducir la fricción de revisión. Si no, no vas a revisar y tendrás 400 tareas fantasma en 3 semanas.

**Lo que está excelente:**
- El caso de prueba maestro (sección 15).
- El filtrado por scope en el servidor.
- La bitácora en `inbox_messages`.
- La pantalla de revisión con marcas de tiempo.

**Mi veredicto:** **Aprobado con ajustes menores.** Resuelve las 3 preguntas de arriba y empieza la Fase 0.
