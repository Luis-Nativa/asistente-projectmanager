# Plan de Implementación — Sistema de Pendientes por Telegram

**Versión:** 1.0  
**Fecha:** 2026-08-12

---

## Filosofía

**Construir por fases, probar cada fase antes de avanzar.** Si dejas los recordatorios para el final creyendo que son fáciles, se te va el proyecto.

**No avanzar a la siguiente fase hasta que la anterior funcione.** Si la Fase 2 no pasa el caso de prueba maestro, no construyas la Fase 3.

---

## Fase 0: Setup inicial

**Duración estimada:** 2 horas  
**Entregable:** Repo creado, BD en Neon, `/health` en Fly.io

### Tareas

1. **Crear estructura del repo:**
   ```
   /backend
     src/
       index.ts
     package.json
     tsconfig.json
     fly.toml
   /frontend
     package.json
     next.config.js
   ```

2. **Configurar backend:**
   - `npm init` en `/backend`.
   - Instalar dependencias: `express`, `pg`, `typescript`, `@types/node`, `@types/express`.
   - Configurar `tsconfig.json` con `strict: true`.
   - Crear `src/index.ts` con Express básico.

3. **Crear Neon Postgres:**
   - Crear proyecto en Neon.
   - Copiar `DATABASE_URL`.
   - Crear archivo `migrations/001_init.sql` con el esquema inicial (ver `MODELO-DATOS.md`).
   - Correr migración: `psql $DATABASE_URL < migrations/001_init.sql`.

4. **Endpoint `/health`:**
   ```typescript
   app.get('/health', (req, res) => {
     res.json({ status: 'ok', timestamp: new Date().toISOString() });
   });
   ```

5. **Configurar Fly.io:**
   - `fly apps create <nombre>`.
   - Configurar secrets: `fly secrets set DATABASE_URL=...`.
   - Crear `fly.toml` básico.
   - Deploy: `fly deploy`.

6. **Probar:**
   ```bash
   curl https://<nombre>.fly.dev/health
   # Debe responder: {"status":"ok","timestamp":"..."}
   ```

### Criterios de aceptación

- `curl` a `/health` responde 200.
- La migración de Neon se corrió sin errores.
- Fly.io tiene la app corriendo.

---

## Fase 1: Webhook de Telegram

**Duración estimada:** 3 horas  
**Entregable:** Mensajes de Telegram se guardan en `inbox_messages`

### Tareas

1. **Crear bot de Telegram:**
   - Hablar con @BotFather.
   - Crear bot con `/newbot`.
   - Copiar `TELEGRAM_BOT_TOKEN`.
   - Obtener tu `chat.id` con @userinfobot.

2. **Configurar webhook:**
   - Generar `TELEGRAM_WEBHOOK_SECRET` aleatorio.
   - Registrar webhook:
     ```bash
     curl -X POST https://api.telegram.org/bot<token>/setWebhook \
       -H "Content-Type: application/json" \
       -d '{
         "url": "https://<nombre>.fly.dev/telegram/webhook",
         "secret_token": "<TELEGRAM_WEBHOOK_SECRET>"
       }'
     ```

3. **Implementar endpoint del webhook:**
   ```typescript
   app.post('/telegram/webhook', async (req, res) => {
     // 1. Validar secret_token
     const secretToken = req.headers['x-telegram-bot-api-secret-token'];
     if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
       return res.status(403).json({ error: 'Invalid secret token' });
     }
     
     // 2. Validar chat.id
     const chatId = req.body.message?.chat?.id;
     if (chatId !== parseInt(process.env.TELEGRAM_CHAT_ID)) {
       return res.status(200).json({ ok: true }); // Ignorar silenciosamente
     }
     
     // 3. Guardar en inbox_messages
     await db.query(
       `INSERT INTO inbox_messages (tg_msg_id, raw_text)
        VALUES ($1, $2)`,
       [req.body.message.message_id, req.body.message.text]
     );
     
     // 4. Responder "Recibido"
     await sendTelegramMessage(chatId, '✅ Recibido');
     
     res.status(200).json({ ok: true });
   });
   ```

4. **Implementar `sendTelegramMessage`:**
   ```typescript
   async function sendTelegramMessage(chatId: number, text: string) {
     await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ chat_id: chatId, text })
     });
   }
   ```

5. **Configurar keep-alive (opcional si usas Fly.io):**
   - Fly.io no duerme, así que no necesitas keep-alive.
   - Si usas Render, configura cron-job.org para hacer ping a `/health` cada 10 min.

6. **Probar:**
   - Mandar "hola" al bot.
   - Verificar que aparece en `inbox_messages`:
     ```sql
     SELECT * FROM inbox_messages ORDER BY created_at DESC LIMIT 1;
     ```

### Criterios de aceptación

- Mandas "hola" al bot.
- El bot responde "✅ Recibido".
- La fila aparece en `inbox_messages` con `raw_text = 'hola'`.

---

## Fase 2: Parser con Gemini + Executor

**Duración estimada:** 6 horas  
**Entregable:** Mensajes se parsean y se crean filas en la BD

### Tareas

1. **Crear eval dataset:**
   - Crear `tests/fixtures/volcado-domingo.txt` con el caso de prueba maestro (sección 15 del plan original).
   - Crear 20-30 mensajes de prueba con salida esperada.
   - Guardar en `tests/fixtures/eval-dataset.json`.

2. **Implementar servicio de Gemini:**
   ```typescript
   import { GoogleGenerativeAI } from '@google/generative-ai';
   
   const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
   
   export async function parseMessage(text: string, context: any) {
     const model = genAI.getGenerativeModel({
       model: 'gemini-2.5-flash',
       systemInstruction: PARSER_PROMPT,
       generationConfig: {
         responseMimeType: 'application/json',
         responseSchema: PARSER_SCHEMA
       }
     });
     
     const result = await model.generateContent({
       contents: [{ role: 'user', parts: [{ text }] }],
       ...context
     });
     
     return JSON.parse(result.response.text());
   }
   ```

3. **Implementar executor:**
   ```typescript
   export async function executeActions(acciones: any[], inboxMessageId: number) {
     for (const accion of acciones) {
       switch (accion.tipo) {
         case 'crear_tarea':
           await crearTarea(accion, inboxMessageId);
           break;
         case 'crear_gasto':
           await crearGasto(accion, inboxMessageId);
           break;
         case 'crear_nota':
           await crearNota(accion, inboxMessageId);
           break;
         case 'crear_proyecto':
           await crearProyecto(accion);
           break;
         case 'crear_subtareas':
           await crearSubtareas(accion);
           break;
         case 'completar_tarea':
           await completarTarea(accion);
           break;
       }
     }
   }
   ```

4. **Integrar parser + executor en el webhook:**
   ```typescript
   app.post('/telegram/webhook', async (req, res) => {
     // ... validaciones ...
     
     // Guardar en inbox_messages
     const result = await db.query(
       `INSERT INTO inbox_messages (tg_msg_id, raw_text)
        VALUES ($1, $2) RETURNING id`,
       [req.body.message.message_id, req.body.message.text]
     );
     const inboxMessageId = result.rows[0].id;
     
     // Responder "Recibido" inmediatamente
     await sendTelegramMessage(chatId, '✅ Recibido');
     res.status(200).json({ ok: true });
     
     // Procesar en segundo plano
     processInBackground(req.body.message.text, inboxMessageId, chatId);
   });
   
   async function processInBackground(text: string, inboxMessageId: number, chatId: number) {
     try {
       const context = await buildContext();
       const { acciones } = await parseMessage(text, context);
       await executeActions(acciones, inboxMessageId);
       
       // Confirmar con resumen
       const resumen = buildResumen(acciones);
       await sendTelegramMessage(chatId, resumen);
     } catch (error) {
       await db.query(
         `UPDATE inbox_messages SET status = 'error', error = $1 WHERE id = $2`,
         [error.message, inboxMessageId]
       );
       await sendTelegramMessage(chatId, '⚠️ No pude procesar tu mensaje.');
     }
   }
   ```

5. **Correr eval dataset:**
   ```bash
   npm test tests/parser.test.ts
   ```
   - Verificar que la precisión sea >90%.
   - Ajustar el prompt si es necesario.

6. **Probar con el caso de prueba maestro:**
   - Pasar el volcado de 16 min por el parser.
   - Verificar que:
     - `expenses` queda vacía.
     - Salen 19 tareas ± 2.
     - Ninguna con priority 1.

### Criterios de aceptación

- Mandas el ejemplo del herrero: "el jueves le pago a luis los 8 mil del herrero de la obra de reforma y hay que confirmarle antes el martes".
- El bot responde con resumen: "✅ 1 gasto, 1 tarea".
- En la BD aparecen 2 filas correctas.
- El eval dataset pasa con >90% de precisión.

---

## Fase 3: API de lectura + Dashboard con PIN

**Duración estimada:** 6 horas  
**Entregable:** Ves tus tareas en Vercel

### Tareas

1. **Implementar seed del owner:**
   ```sql
   INSERT INTO shares (slug, label, project_id, pin_hash, role,
                       can_complete, can_create, can_see_money, expires_at)
   VALUES (
     '<32 caracteres aleatorios>',
     'Main',
     NULL,
     '<bcrypt de tu PIN>',
     'owner',
     true, true, true,
     NULL
   );
   ```

2. **Implementar auth por PIN:**
   - Ver `SEGURIDAD.md` para detalles.
   - `POST /api/auth/pin` valida slug + PIN.
   - Devuelve JWT de 1 día + refresh token de 30 días.

3. **Implementar API de lectura:**
   - `GET /api/dashboard` — Snapshot completo.
   - `GET /api/tasks` — Lista de tareas.
   - `GET /api/projects` — Lista de proyectos.
   - `GET /api/expenses` — Lista de gastos.
   - `GET /api/notes` — Lista de notas.

4. **Crear frontend en Next.js:**
   - `npm create next-app@latest frontend`.
   - Instalar Tailwind.
   - Crear pantallas:
     - `/d/[slug]/pin` — Pantalla de PIN.
     - `/d/[slug]` — Dashboard principal.

5. **Implementar componentes:**
   - `TaskList.tsx` — Lista de tareas.
   - `ProjectCard.tsx` — Tarjeta de proyecto.
   - `ExpenseTable.tsx` — Tabla de gastos.
   - `NotesPanel.tsx` — Panel de notas.

6. **Probar:**
   - Acceder a `https://tuapp.vercel.app/d/<slug>`.
   - Ingresar PIN.
   - Ver tus tareas.

### Criterios de aceptación

- Ves tus tareas en Vercel.
- El PIN funciona.
- El JWT se renueva con el refresh token.

---

## Fase 4: CRUD completo en el dashboard

**Duración estimada:** 8 horas  
**Entregable:** Creas y editas desde la web

### Tareas

1. **Implementar endpoints de escritura:**
   - `POST /api/tasks`, `PATCH /api/tasks/:id`, `DELETE /api/tasks/:id`.
   - `POST /api/projects`, `PATCH /api/projects/:id`.
   - `POST /api/expenses`, `PATCH /api/expenses/:id`.
   - `POST /api/notes`, `PATCH /api/notes/:id`, `DELETE /api/notes/:id`.
   - `POST /api/tasks/:id/subtasks`, `PATCH /api/subtasks/:id`.

2. **Implementar validación de permisos:**
   - Ver `SEGURIDAD.md` para detalles.
   - `can_complete`, `can_create`, `can_see_money`.

3. **Implementar UI de edición:**
   - Formularios para crear/editar tareas, proyectos, gastos, notas.
   - Botones para completar, eliminar.
   - Checkboxes para subtareas.

4. **Implementar auditoría:**
   - Registrar toda acción en `activity`.

5. **Probar:**
   - Crear tarea desde el dashboard.
   - Editar tarea.
   - Completar tarea.
   - Verificar que se registra en `activity`.

### Criterios de aceptación

- Creas y editas tareas desde la web.
- Los permisos funcionan (colaborador no puede crear si `can_create = false`).
- La bitácora de actividad se llena.

---

## Fase 5: Cron + Recordatorios + Briefing

**Duración estimada:** 6 horas  
**Entregable:** Recordatorios llegan por Telegram

### Tareas

1. **Configurar cron en Fly.io:**
   - Editar `fly.toml` para añadir cron job.
   - Configurar para que corra cada 5 min.

2. **Implementar `POST /internal/tick`:**
   ```typescript
   app.post('/internal/tick', async (req, res) => {
     // Validar CRON_SECRET
     if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
       return res.status(403).json({ error: 'Invalid secret' });
     }
     
     await sendReminders();
     await sendBriefingIfNeeded();
     await sendClosingIfNeeded();
     
     res.status(200).json({ ok: true });
   });
   ```

3. **Implementar `sendReminders`:**
   - Buscar tareas con `remind_at <= now() AND reminded_at IS NULL AND confirmed = true`.
   - Mandar recordatorio por Telegram.
   - Marcar `reminded_at = now()`.

4. **Implementar `sendBriefingIfNeeded`:**
   - Si son las 07:00 y no se ha enviado hoy, mandar briefing.
   - Actualizar `system_flags.last_briefing_date`.

5. **Implementar `sendClosingIfNeeded`:**
   - Si son las 21:00, mandar cierre nocturno.
   - Actualizar `system_flags.last_closing_date`.

6. **Probar:**
   - Crear tarea con `remind_at` a 6 minutos.
   - Esperar a que llegue el recordatorio.
   - Verificar que llega a las 07:00 el briefing.

### Criterios de aceptación

- Pones un `remind_at` a 6 minutos y llega.
- El briefing de las 7:00 llega.
- El cierre de las 21:00 llega.

---

## Fase 6: Consultas en lenguaje natural

**Duración estimada:** 4 horas  
**Entregable:** Preguntas "cuánto llevo en X" y responde bien

### Tareas

1. **Implementar `POST /api/ask`:**
   - Armar snapshot compacto en JSON.
   - Enviar pregunta + snapshot a Gemini.
   - Devolver respuesta.

2. **Implementar consultas por bot:**
   - Si el parser devuelve `tipo: 'consulta'`, llamar al agente de consultas.
   - Mandar respuesta por Telegram.

3. **Probar:**
   - Preguntar "cuánto llevo gastado en Casa Nativa".
   - Verificar que responde con cifras exactas.

### Criterios de aceptación

- Preguntas "cuánto llevo en X" y responde bien.
- Las respuestas son exactas, no calculadas a ojo.

---

## Fase 7: Comandos del bot

**Duración estimada:** 4 horas  
**Entregable:** `/deshacer`, `/resumen`, `/hoy`, `/urgentes`, `/posponer`

### Tareas

1. **Implementar `/deshacer`:**
   - Borrar lo creado por el último mensaje (por `source_msg_id`).

2. **Implementar `/resumen`:**
   - Mandar el briefing manualmente.

3. **Implementar `/hoy`:**
   - Mandar tareas de hoy.

4. **Implementar `/urgentes`:**
   - Mandar tareas con priority 1.

5. **Implementar `/posponer <id> <fecha>`:**
   - Actualizar `due_at` de la tarea.

6. **Probar:**
   - Probar cada comando.

### Criterios de aceptación

- Los comandos funcionan.
- `/deshacer` borra todo el volcado.

---

## Fase 8: Acceso compartido (multi-tablero)

**Duración estimada:** 6 horas  
**Entregable:** Tablero de Karla funcionando con permisos reales

### Tareas

1. **Implementar tabla `shares`:**
   - Ver `MODELO-DATOS.md`.

2. **Implementar endpoints de shares:**
   - `POST /api/shares`, `GET /api/shares`, `PATCH /api/shares/:id`, `DELETE /api/shares/:id`.

3. **Implementar filtrado por scope en toda la API:**
   - Ver `SEGURIDAD.md` para detalles.

4. **Implementar botón "Compartir" en el frontend:**
   - Modal con nombre, permisos, caducidad.
   - Generar slug + PIN.
   - Mostrar enlace + PIN una sola vez.

5. **Implementar tests de filtrado por scope:**
   - Ver `SEGURIDAD.md` para detalles.

6. **Probar:**
   - Crear share para Karla con alcance de Casa Nativa.
   - Karla accede y solo ve Casa Nativa.
   - Karla no puede ver gastos si `can_see_money = false`.

### Criterios de aceptación

- Tablero de Karla funciona con permisos reales.
- Un token con alcance de proyecto A no puede leer proyecto B.

---

## Fase 9: Actividad + Comentarios + Modo revisión

**Duración estimada:** 6 horas  
**Entregable:** Bitácora de actividad, comentarios, modo revisión

### Tareas

1. **Implementar tabla `activity`:**
   - Ver `MODELO-DATOS.md`.

2. **Implementar tabla `comments`:**
   - Ver `MODELO-DATOS.md`.

3. **Implementar atribución de quién cerró qué:**
   - `completed_by` en `tasks`.

4. **Implementar modo revisión:**
   - `GET /api/projects/:id/review`.
   - Cuatro bloques: cerradas, vencidas, estancadas, próximas 7 días.

5. **Implementar `/revisar` en el bot:**
   - Mandar agenda de revisión por Telegram.

6. **Implementar notificaciones de comentarios:**
   - Cuando se crea un comentario, notificar por Telegram.

7. **Probar:**
   - Comentar en una tarea.
   - Verificar que llega notificación.
   - Usar `/revisar Casa Nativa`.

### Criterios de aceptación

- La bitácora de actividad se llena.
- Los comentarios funcionan.
- El modo revisión muestra los cuatro bloques.

---

## Fase 10: Vinculación de Telegram para colaboradores

**Duración estimada:** 4 horas  
**Entregable:** Karla puede capturar por Telegram

### Tareas

1. **Implementar `/vincular`:**
   - Generar código de 6 dígitos.
   - Karla escribe `/vincular 483920` al bot.
   - Backend guarda su `chat.id` en `shares.tg_chat_id`.

2. **Implementar filtrado por `chat.id`:**
   - Webhook resuelve el share por `chat.id`.
   - Todo lo que capture se crea con `project_id` del share.

3. **Implementar briefing para colaboradores:**
   - Karla recibe su propio briefing, solo con tareas de Casa Nativa.

4. **Implementar notificaciones cruzadas:**
   - Cuando Karla palomea algo, notificar al owner.

5. **Probar:**
   - Karla vincula su Telegram.
   - Karla captura pendientes.
   - Karla recibe briefing.
   - Owner recibe notificación.

### Criterios de aceptación

- Karla puede capturar por Telegram.
- Karla recibe briefing de Casa Nativa.
- Owner recibe notificación cuando Karla palomea.

---

## Fase 11: Notas de voz

**Duración estimada:** 8 horas  
**Entregable:** Transcripción, parser en modo voz, pantalla de revisión

### Tareas

1. **Implementar recepción de `voice`/`audio`:**
   - Validar tamaño (<20 MB) y duración (<25 min).
   - Descargar con `getFile`.

2. **Implementar transcripción con Gemini:**
   - Enviar audio a Gemini con prompt de transcripción.
   - Guardar transcripción en `inbox_messages.transcript`.

3. **Implementar parser en modo voz:**
   - Usar el mismo prompt de texto + reglas 11-17 de voz.
   - Todo lo creado entra con `confirmed = false`.

4. **Implementar pantalla de revisión:**
   - Lista de tarjetas editables.
   - Botones aceptar/descartar.
   - Marcas de tiempo + reproductor de audio.

5. **Implementar `/deshacer` por volcado:**
   - Eliminar todas las filas que compartan `source_msg_id`.

6. **Implementar confirmación por Telegram:**
   - `/confirmar <id>` confirma todo el volcado.

7. **Implementar diccionario de nombres:**
   - Lista de nombres comunes (Karla, Paulina, Luis, Casa Nativa, etc.).
   - Si la transcripción dice "Carla(?)" y "Karla" está en el diccionario, sugerir "Karla".

8. **Probar:**
   - Mandar nota de voz.
   - Verificar que se transcribe.
   - Verificar que se parsea.
   - Verificar que aparece en la pantalla de revisión.
   - Confirmar con `/confirmar`.

### Criterios de aceptación

- Notas de voz se transcriben y parsean.
- Pantalla de revisión funciona.
- `/confirmar` confirma todo el volcado.

---

## Resumen de fases

| Fase | Entregable | Duración |
|---|---|---|
| 0 | Setup inicial | 2h |
| 1 | Webhook de Telegram | 3h |
| 2 | Parser + Executor | 6h |
| 3 | API + Dashboard con PIN | 6h |
| 4 | CRUD completo | 8h |
| 5 | Cron + Recordatorios | 6h |
| 6 | Consultas en lenguaje natural | 4h |
| 7 | Comandos del bot | 4h |
| 8 | Acceso compartido | 6h |
| 9 | Actividad + Comentarios + Revisión | 6h |
| 10 | Vinculación de Telegram | 4h |
| 11 | Notas de voz | 8h |
| **Total** | | **63h** |

---

## Orden de implementación

**Fases 0-3:** Fin de semana (sábado-domingo).  
**Fases 4-7:** Semana siguiente.  
**Fases 8-10:** Tercera semana (si quieres acceso compartido).  
**Fase 11:** Cuarta semana (si quieres notas de voz).

**No avanzar a la siguiente fase hasta que la anterior funcione.**
