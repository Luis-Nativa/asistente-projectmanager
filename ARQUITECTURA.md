# Arquitectura — Sistema de Pendientes por Telegram

**Versión:** 1.0  
**Fecha:** 2026-08-12

---

## Diagrama de arquitectura

```
┌─────────────────┐
│   Telegram Bot  │
│  (usuario final)│
└────────┬────────┘
         │ webhook (HTTPS)
         │ POST /telegram/webhook
         ▼
┌─────────────────────────────────────────────────────────┐
│                   Express Backend (Fly.io)               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Webhook    │  │  API REST    │  │   Internal   │  │
│  │   Routes     │  │   Routes     │  │   Routes     │  │
│  │              │  │              │  │              │  │
│  │ /telegram/*  │  │ /api/*       │  │ /internal/*  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
│         └─────────────────┴─────────────────┘           │
│                           │                             │
│                  ┌────────▼────────┐                    │
│                  │   Middleware    │                    │
│                  │                 │                    │
│                  │ - auth          │                    │
│                  │ - scope filter  │                    │
│                  │ - rate limit    │                    │
│                  │ - validation    │                    │
│                  └────────┬────────┘                    │
│                           │                             │
│         ┌─────────────────┼─────────────────┐           │
│         │                 │                 │           │
│  ┌──────▼───────┐  ┌──────▼───────┐  ┌──────▼───────┐  │
│  │   Gemini     │  │   Executor   │  │  Reminders   │  │
│  │   Service    │  │   Service    │  │   Service    │  │
│  │              │  │              │  │              │  │
│  │ - parser     │  │ - acciones   │  │ - tick       │  │
│  │ - transcribe │  │ - BD queries │  │ - briefing   │  │
│  │ - consultas  │  │              │  │ - cierre     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │           │
└─────────┼─────────────────┼─────────────────┼───────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────┐  ┌──────────────────────────────────┐
│  Gemini Flash   │  │      Neon Postgres (Serverless)  │
│     API         │  │                                  │
│                 │  │  - projects                      │
│ - parser        │  │  - tasks                         │
│ - transcribe    │  │  - subtasks                      │
│ - consultas     │  │  - expenses                      │
│                 │  │  - notes                         │
└─────────────────┘  │  - shares                        │
                     │  - activity                      │
                     │  - comments                      │
                     │  - inbox_messages                │
                     │  - system_flags                  │
                     └──────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│              Next.js Frontend (Vercel)                    │
│                                                          │
│  /d/[slug]           → Dashboard principal               │
│  /d/[slug]/pin       → Pantalla de PIN                   │
│  /d/[slug]/revision  → Revisión de notas de voz          │
│  /d/[slug]/review    → Modo revisión                     │
│                                                          │
│  Componentes:                                            │
│  - TaskList.tsx                                          │
│  - ProjectCard.tsx                                       │
│  - ExpenseTable.tsx                                      │
│  - NotesPanel.tsx                                        │
│  - CommentsPanel.tsx                                     │
│  - ShareModal.tsx                                        │
└──────────────────────────────────────────────────────────┘
```

---

## Componentes

### 1. Telegram Webhook

**Responsabilidad:** Recibir mensajes de Telegram, validar autenticidad, guardar en bitácora.

**Flujo:**
1. Telegram envía POST a `/telegram/webhook`.
2. Middleware valida `X-Telegram-Bot-Api-Secret-Token` contra `TELEGRAM_WEBHOOK_SECRET`.
3. Valida que `chat.id` esté en `shares.tg_chat_id` (o sea el owner).
4. Guarda mensaje crudo en `inbox_messages`.
5. Responde 200 OK en <500ms (para evitar reintentos de Telegram).
6. En segundo plano:
   - Si es texto: envía al parser.
   - Si es voz: descarga audio, transcribe, envía al parser.
   - Executor convierte acciones en filas de BD.
   - Bot confirma con resumen corto.

**Endpoints:**
- `POST /telegram/webhook` — Sin auth de API, valida secret_token de Telegram.

---

### 2. API REST

**Responsabilidad:** Servir datos al dashboard, manejar CRUD, filtrar por scope.

**Autenticación:**
- `POST /api/auth/pin` — Intercambia slug + PIN por JWT + refresh token.
- Todas las demás rutas requieren `Authorization: Bearer <jwt>`.
- Middleware recarga el share desde BD en cada request.
- Si el share está revocado o vencido, responde 401.

**Filtrado por scope:**
- El `project_id` del alcance sale del token (`req.scope.project_id`), **nunca** del request.
- Si un endpoint recibe `?project_id=` del cliente, se valida contra `req.scope.project_id`.
- Si no coincide, responde 403.

**Endpoints:** Ver `API-CONTRACTS.md`.

---

### 3. Internal Routes

**Responsabilidad:** Endpoints llamados por el cron, no expuestos al público.

**Autenticación:**
- Header `X-Cron-Secret` contra `CRON_SECRET`.

**Endpoints:**
- `POST /internal/tick` — Ejecuta lógica de recordatorios, briefing, cierre.

---

### 4. Gemini Service

**Responsabilidad:** Interactuar con Gemini Flash para parser, transcripción y consultas.

**Funciones:**
- `parseMessage(text, context)` — Parser de texto/voz a acciones JSON.
- `transcribeAudio(audioBuffer)` — Transcripción de audio a texto.
- `answerQuestion(question, snapshot)` — Agente de consultas.

**Configuración:**
- `responseMimeType: "application/json"`
- `responseSchema: <schema>` — Para salida estructurada.
- System prompts en `src/prompts/`.

---

### 5. Executor Service

**Responsabilidad:** Convertir acciones JSON del parser en filas de BD.

**Funciones:**
- `executeActions(acciones, inbox_message_id)` — Procesa cada acción y crea filas.
- `crear_tarea(data)` — Inserta en `tasks`.
- `crear_gasto(data)` — Inserta en `expenses`.
- `crear_nota(data)` — Inserta en `notes`.
- `crear_proyecto(data)` — Inserta en `projects`.
- `crear_subtareas(data)` — Inserta en `subtasks`.
- `completar_tarea(data)` — Actualiza `status` y `completed_at`.

**Validaciones:**
- Si la acción tiene `project_id`, verifica que exista.
- Si la acción tiene `blocked_by`, verifica que no haya ciclo.
- Si la acción es recurrente, genera siguiente instancia al completarse.

---

### 6. Reminders Service

**Responsabilidad:** Ejecutar lógica de recordatorios, briefing y cierre.

**Funciones:**
- `tick()` — Llamado cada 5 min por el cron.
- `sendReminders()` — Busca tareas con `remind_at <= now()` y manda recordatorios.
- `sendBriefing()` — Manda resumen del día a las 07:00.
- `sendClosing()` — Manda resumen de pendientes a las 21:00.

**Control de "ya enviado hoy":**
- Tabla `system_flags` con `last_briefing_date` y `last_closing_date`.
- Antes de enviar, verifica que no se haya enviado hoy.

---

### 7. Auth Middleware

**Responsabilidad:** Validar JWT, recargar share, filtrar por scope.

**Flujo:**
1. Extrae JWT del header `Authorization`.
2. Verifica firma y expiración.
3. Extrae `share_id` del payload.
4. Recarga el share desde BD (no confía en el payload).
5. Verifica que no esté revocado ni vencido.
6. Adjunta `req.scope = share`.
7. Continúa al handler.

---

### 8. Frontend (Next.js)

**Responsabilidad:** Dashboard para ver y editar tareas, proyectos, gastos, notas.

**Rutas:**
- `/d/[slug]` — Dashboard principal.
- `/d/[slug]/pin` — Pantalla de PIN.
- `/d/[slug]/revision/[id]` — Revisión de notas de voz.
- `/d/[slug]/review` — Modo revisión.

**Autenticación:**
- JWT en `localStorage`.
- Refresh token en `httpOnly cookie`.
- Si el backend responde 401, intenta refresh. Si falla, vuelve al PIN.

**Diseño:**
- Denso y funcional, no un landing page.
- Tres columnas en escritorio, una sola en móvil.
- Modo oscuro por defecto.
- Fechas en formato relativo ("mañana", "hace 3 días").

---

## Estructura del repo

```
/backend                      → Fly.io
  src/
    index.ts                  arranque express
    routes/
      telegram.ts             webhook de Telegram
      api.ts                  API REST
      internal.ts             endpoints del cron
    services/
      gemini.ts               parser + agente de consultas
      telegram.ts             sendMessage
      db.ts                   pool de Neon
      executor.ts             convierte acciones → filas en la BD
      reminders.ts            lógica del tick
      auth.ts                 validación de JWT, refresh tokens
    prompts/
      parser.ts               prompt del parser
      transcribe.ts           prompt de transcripción
      answer.ts               prompt de consultas
    middleware/
      auth.ts                 validación de JWT y scope
      rateLimit.ts            rate limit de PIN
      validateWebhook.ts      validación de secret_token
  migrations/
    001_init.sql              esquema inicial
    002_shares.sql            tabla shares + activity + comments
    003_voice.sql             columnas de notas de voz
    004_recurrence.sql        columnas de recurrencia
  tests/
    fixtures/
      volcado-domingo.txt     caso de prueba maestro
    parser.test.ts            tests del parser con eval dataset
    scope.test.ts             tests de filtrado por scope
  package.json
  tsconfig.json
  fly.toml                    configuración de Fly.io

/frontend                     → Vercel
  app/
    d/[slug]/
      page.tsx                dashboard
      pin.tsx                 pantalla de PIN
      revision/[id]/
        page.tsx              revisión de notas de voz
      review/
        page.tsx              modo revisión
    layout.tsx
  components/
    TaskList.tsx
    ProjectCard.tsx
    ExpenseTable.tsx
    NotesPanel.tsx
    CommentsPanel.tsx
    ShareModal.tsx
  lib/
    api.ts                    cliente de API
    auth.ts                   manejo de JWT + refresh
  package.json
  tsconfig.json
  next.config.js
```

---

## Variables de entorno

### Backend (Fly.io)

```bash
DATABASE_URL=            # Neon, con ?sslmode=require
TELEGRAM_BOT_TOKEN=      # BotFather
TELEGRAM_WEBHOOK_SECRET= # aleatorio, lo valida Telegram en cada request
GEMINI_API_KEY=
PIN_SALT_ROUNDS=12       # bcrypt
JWT_SECRET=              # para firmar JWTs
JWT_EXPIRES_IN=1d        # vida del JWT
REFRESH_TOKEN_SECRET=    # para firmar refresh tokens
REFRESH_TOKEN_EXPIRES_IN=30d
CRON_SECRET=             # para validar requests del cron
TZ=America/Mexico_City
FLY_APP_NAME=            # nombre de la app en Fly.io
```

### Frontend (Vercel)

```bash
NEXT_PUBLIC_API_URL=     # URL del backend
```

---

## Despliegue

### Backend en Fly.io

1. Crear app: `fly apps create <nombre>`.
2. Configurar secrets: `fly secrets set DATABASE_URL=...`.
3. Deploy: `fly deploy`.
4. Configurar webhook de Telegram: `setWebhook` con URL y secret_token.

### Frontend en Vercel

1. Conectar repo de GitHub.
2. Configurar variables de entorno en Vercel dashboard.
3. Deploy automático en cada push a `main`.

### Cron en Fly.io

1. Configurar `fly.toml` con `[jobs.services]` para el cron.
2. El cron llama `POST /internal/tick` cada 5 min.

---

## Monitoreo

- **Health check:** `GET /health` devuelve 200 si todo está bien.
- **Uptime monitoring:** UptimeRobot (gratis) hace ping a `/health` cada 5 min.
- **Error tracking:** Sentry (gratis para uso personal) trackea errores del backend.
- **Logs:** Fly.io logs accesibles con `fly logs`.
