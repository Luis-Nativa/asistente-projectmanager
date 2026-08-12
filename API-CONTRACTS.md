# Contratos de API — Sistema de Pendientes por Telegram

**Versión:** 1.0  
**Fecha:** 2026-08-12

---

## Autenticación

### POST /api/auth/pin

Intercambia slug + PIN por JWT + refresh token.

**Request:**
```json
POST /api/auth/pin
Content-Type: application/json

{
  "slug": "a7f3b2c1d4e5f6g7h8i9j0k1l2m3n4o5",
  "pin": "483920"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "d9e8f7g6h5i4j3k2l1m0n9o8p7q6r5s4",
  "expiresIn": 86400,
  "share": {
    "id": "uuid",
    "label": "Main",
    "role": "owner",
    "project_id": null
  }
}
```

**Response (401):**
```json
{
  "error": "PIN inválido",
  "attemptsRemaining": 4
}
```

**Rate limit:** 5 intentos por IP cada 15 minutos.

---

### POST /api/auth/refresh

Intercambia refresh token por nuevo JWT.

**Request:**
```json
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "d9e8f7g6h5i4j3k2l1m0n9o8p7q6r5s4"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400
}
```

**Response (401):**
```json
{
  "error": "Refresh token inválido o vencido"
}
```

---

## Autenticación de rutas protegidas

Todas las rutas bajo `/api/*` (excepto `/api/auth/*`) exigen:

```
Authorization: Bearer <jwt>
```

El middleware:
1. Valida el JWT.
2. Recarga el share desde BD.
3. Verifica que no esté revocado ni vencido.
4. Adjunta `req.scope = share`.

---

## Endpoints públicos

### GET /health

Sin auth. Para keep-alive y monitoreo.

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-08-12T18:00:00Z"
}
```

---

### POST /telegram/webhook

Sin auth de API. Valida `X-Telegram-Bot-Api-Secret-Token` de Telegram.

**Request:**
```json
POST /telegram/webhook
X-Telegram-Bot-Api-Secret-Token: <secret>
Content-Type: application/json

{
  "update_id": 123456789,
  "message": {
    "message_id": 42,
    "from": { "id": 123456789 },
    "chat": { "id": 123456789 },
    "date": 1691866800,
    "text": "Comprar plantas para Casa Nativa"
  }
}
```

**Response (200):**
```json
{
  "ok": true
}
```

---

### POST /internal/tick

Sin auth de API. Valida `X-Cron-Secret`.

**Request:**
```
POST /internal/tick
X-Cron-Secret: <secret>
```

**Response (200):**
```json
{
  "ok": true,
  "remindersSent": 3,
  "briefingSent": false,
  "closingSent": false
}
```

---

## Endpoints protegidos

### GET /api/dashboard

Snapshot completo del día.

**Response (200):**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Casa Nativa",
      "status": "activo",
      "budget_amount": 50000,
      "spent": 23000,
      "remaining": 27000,
      "tasks_count": 12,
      "tasks_pending": 8
    }
  ],
  "tasks_today": [
    {
      "id": "uuid",
      "title": "Confirmar a Luis el pago del herrero",
      "priority": 2,
      "due_at": "2026-08-12T09:00:00-06:00",
      "project": { "id": "uuid", "name": "Casa Nativa" },
      "status": "pendiente"
    }
  ],
  "tasks_overdue": [
    {
      "id": "uuid",
      "title": "Enviar factura",
      "priority": 1,
      "due_at": "2026-08-10T09:00:00-06:00",
      "project": null,
      "status": "pendiente",
      "days_overdue": 2
    }
  ],
  "expenses_pending": [
    {
      "id": "uuid",
      "concept": "Pago al herrero",
      "amount": 8000,
      "currency": "MXN",
      "due_at": "2026-08-15T09:00:00-06:00",
      "project": { "id": "uuid", "name": "Casa Nativa" },
      "status": "pendiente"
    }
  ]
}
```

**Nota:** Si `can_see_money = false`, los proyectos se devuelven **sin** `budget_amount`, `spent`, `remaining`, y `/api/expenses` responde 403.

---

### GET /api/tasks

Lista de tareas con filtros.

**Query params:**
- `status` — pendiente | en_proceso | hecho | cancelado (default: todos excepto cancelado)
- `project_id` — UUID (opcional, se valida contra `req.scope.project_id`)
- `from` — ISO 8601 (opcional)
- `to` — ISO 8601 (opcional)

**Response (200):**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "title": "Comprar plantas",
      "detail": "Para la entrada de Casa Nativa",
      "project": { "id": "uuid", "name": "Casa Nativa" },
      "person": null,
      "assigned_to": "Paulina",
      "status": "pendiente",
      "priority": 3,
      "starts_at": null,
      "due_at": "2026-08-15T09:00:00-06:00",
      "remind_at": "2026-08-15T08:00:00-06:00",
      "tags": ["mantenimiento", "estética"],
      "blocked_by": null,
      "recurrence": null,
      "confirmed": true,
      "private": false,
      "subtasks": [
        { "id": "uuid", "title": "Lijar macetas", "done": false },
        { "id": "uuid", "title": "Pintar muros", "done": true }
      ],
      "comments_count": 2,
      "created_at": "2026-08-10T14:30:00Z",
      "completed_at": null
    }
  ],
  "total": 15
}
```

---

### POST /api/tasks

Crear tarea.

**Request:**
```json
POST /api/tasks
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "title": "Comprar plantas",
  "detail": "Para la entrada de Casa Nativa",
  "project_id": "uuid",
  "assigned_to": "Paulina",
  "priority": 3,
  "due_at": "2026-08-15T09:00:00-06:00",
  "remind_at": "2026-08-15T08:00:00-06:00",
  "tags": ["mantenimiento", "estética"],
  "subtasks": ["Lijar macetas", "Pintar muros"]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "title": "Comprar plantas",
  "status": "pendiente",
  "created_at": "2026-08-12T18:00:00Z"
}
```

**Validación:** Si `req.scope.project_id` no es null y no coincide con `project_id`, responde 403.

---

### PATCH /api/tasks/:id

Actualizar tarea.

**Request:**
```json
PATCH /api/tasks/:id
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "status": "hecho",
  "completed_by": "Karla"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "hecho",
  "completed_at": "2026-08-12T18:30:00Z"
}
```

**Validación:**
- Si `status` cambia a "hecho" y `can_complete = false`, responde 403.
- Si la tarea es `private = true` y `role != 'owner'`, responde 404.

---

### DELETE /api/tasks/:id

Eliminar tarea.

**Response (204):** No content.

**Validación:** Si la tarea es `private = true` y `role != 'owner'`, responde 404.

---

### POST /api/tasks/:id/subtasks

Agregar subtarea.

**Request:**
```json
POST /api/tasks/:id/subtasks
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "title": "Comprar tierra",
  "position": 2
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "title": "Comprar tierra",
  "done": false,
  "position": 2
}
```

---

### PATCH /api/subtasks/:id

Actualizar subtarea.

**Request:**
```json
PATCH /api/subtasks/:id
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "done": true
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "done": true
}
```

---

### GET /api/projects

Lista de proyectos.

**Response (200):**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Casa Nativa",
      "client": null,
      "status": "activo",
      "budget_amount": 50000,
      "spent": 23000,
      "remaining": 27000,
      "tasks_count": 12,
      "tasks_pending": 8,
      "shared_with": [
        {
          "label": "Karla",
          "last_seen_at": "2026-08-12T15:00:00Z",
          "can_complete": true,
          "can_create": true,
          "can_see_money": false
        }
      ],
      "created_at": "2026-08-01T10:00:00Z"
    }
  ]
}
```

**Nota:** Si `can_see_money = false`, los proyectos se devuelven **sin** `budget_amount`, `spent`, `remaining`.

---

### POST /api/projects

Crear proyecto.

**Request:**
```json
POST /api/projects
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Nueva sucursal",
  "client": "Inversionistas XYZ",
  "budget_amount": 100000,
  "currency": "MXN"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "name": "Nueva sucursal",
  "status": "activo",
  "created_at": "2026-08-12T18:00:00Z"
}
```

**Validación:** Si `can_create = false`, responde 403.

---

### PATCH /api/projects/:id

Actualizar proyecto.

**Request:**
```json
PATCH /api/projects/:id
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "status": "pausado",
  "last_review_at": "2026-08-12T18:00:00Z"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "pausado",
  "last_review_at": "2026-08-12T18:00:00Z"
}
```

---

### GET /api/expenses

Lista de gastos.

**Query params:**
- `project_id` — UUID (opcional, se valida contra `req.scope.project_id`)
- `status` — pendiente | pagado (opcional)

**Response (200):**
```json
{
  "expenses": [
    {
      "id": "uuid",
      "concept": "Pago al herrero",
      "amount": 8000,
      "currency": "MXN",
      "kind": "gasto",
      "status": "pendiente",
      "person": "Luis",
      "due_at": "2026-08-15T09:00:00-06:00",
      "project": { "id": "uuid", "name": "Casa Nativa" },
      "created_at": "2026-08-10T14:30:00Z"
    }
  ],
  "total": 5
}
```

**Validación:** Si `can_see_money = false`, responde 403.

---

### POST /api/expenses

Crear gasto.

**Request:**
```json
POST /api/expenses
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "concept": "Pago al herrero",
  "amount": 8000,
  "currency": "MXN",
  "kind": "gasto",
  "project_id": "uuid",
  "person": "Luis",
  "due_at": "2026-08-15T09:00:00-06:00"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "concept": "Pago al herrero",
  "status": "pendiente",
  "created_at": "2026-08-12T18:00:00Z"
}
```

**Validación:**
- Si `can_create = false`, responde 403.
- Si `can_see_money = false`, responde 403.

---

### GET /api/notes

Lista de notas.

**Response (200):**
```json
{
  "notes": [
    {
      "id": "uuid",
      "content": "Tarifario: habitaciones desde $1,600, $1,700 y $1,800.",
      "project": { "id": "uuid", "name": "Casa Nativa" },
      "tags": ["precios"],
      "created_at": "2026-08-10T14:30:00Z"
    }
  ],
  "total": 8
}
```

---

### POST /api/notes

Crear nota.

**Request:**
```json
POST /api/notes
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "content": "Estrategia de marketing: filtrar clientes de menor presupuesto.",
  "project_id": "uuid",
  "tags": ["estrategia"]
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "content": "Estrategia de marketing: filtrar clientes de menor presupuesto.",
  "created_at": "2026-08-12T18:00:00Z"
}
```

---

### GET /api/projects/:id/review

Modo revisión. Devuelve cuatro bloques para revisar pendientes con alguien.

**Query params:**
- `desde` — ISO 8601 (opcional, default: `last_review_at` del proyecto)

**Response (200):**
```json
{
  "project": { "id": "uuid", "name": "Casa Nativa" },
  "closed_since_last_review": [
    {
      "id": "uuid",
      "title": "Arreglar banqueta",
      "completed_by": "Paulina",
      "completed_at": "2026-08-11T16:00:00Z"
    }
  ],
  "overdue": [
    {
      "id": "uuid",
      "title": "Enviar factura",
      "due_at": "2026-08-10T09:00:00-06:00",
      "days_overdue": 2
    }
  ],
  "stalled": [
    {
      "id": "uuid",
      "title": "Remodelar taller",
      "created_at": "2026-07-28T10:00:00Z",
      "days_since_activity": 15,
      "last_activity": "2026-07-28T10:00:00Z"
    }
  ],
  "next_7_days": [
    {
      "id": "uuid",
      "title": "Comprar plantas",
      "due_at": "2026-08-15T09:00:00-06:00",
      "priority": 3
    }
  ]
}
```

---

### POST /api/ask

Consultas en lenguaje natural.

**Request:**
```json
POST /api/ask
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "question": "¿Cuánto llevo gastado en Casa Nativa?"
}
```

**Response (200):**
```json
{
  "answer": "Llevas $23,000 MXN gastados en Casa Nativa. Te quedan $27,000 del presupuesto de $50,000.",
  "sources": {
    "expenses": 5,
    "tasks": 12
  }
}
```

---

## Acceso compartido

### POST /api/shares

Crear share (enlace compartido).

**Request:**
```json
POST /api/shares
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "label": "Karla — Casa Nativa",
  "project_id": "uuid",
  "can_complete": true,
  "can_create": true,
  "can_see_money": false,
  "expires_in_days": 90
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "slug": "a7f3b2c1d4e5f6g7h8i9j0k1l2m3n4o5",
  "pin": "483920",
  "url": "https://tuapp.vercel.app/d/a7f3b2c1d4e5f6g7h8i9j0k1l2m3n4o5",
  "expires_at": "2026-11-10T18:00:00Z"
}
```

**Nota:** El PIN se muestra **una sola vez**. Si cierras la respuesta, el PIN se perdió y hay que regenerarlo.

**Validación:** Solo `role='owner'` puede crear shares.

---

### GET /api/shares

Lista de shares activos.

**Response (200):**
```json
{
  "shares": [
    {
      "id": "uuid",
      "label": "Karla — Casa Nativa",
      "project": { "id": "uuid", "name": "Casa Nativa" },
      "can_complete": true,
      "can_create": true,
      "can_see_money": false,
      "last_seen_at": "2026-08-12T15:00:00Z",
      "expires_at": "2026-11-10T18:00:00Z",
      "created_at": "2026-08-12T10:00:00Z"
    }
  ]
}
```

---

### PATCH /api/shares/:id

Actualizar permisos de share.

**Request:**
```json
PATCH /api/shares/:id
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "can_see_money": true,
  "expires_in_days": 30
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "can_see_money": true,
  "expires_at": "2026-09-11T18:00:00Z"
}
```

---

### DELETE /api/shares/:id

Revocar share (marca `revoked_at`, no borra).

**Response (204):** No content.

**Validación:** Si `role='owner'`, responde 403 (no puedes borrarte a ti mismo).

---

### POST /api/shares/:id/regenerate-pin

Regenerar PIN de share.

**Response (200):**
```json
{
  "pin": "951753"
}
```

**Nota:** El PIN se muestra **una sola vez**.

---

## Comentarios

### GET /api/tasks/:id/comments

Lista de comentarios de una tarea.

**Response (200):**
```json
{
  "comments": [
    {
      "id": "uuid",
      "author": "Karla",
      "body": "¿Ya compraste el triplay?",
      "created_at": "2026-08-12T16:00:00Z"
    }
  ]
}
```

---

### POST /api/tasks/:id/comments

Crear comentario.

**Request:**
```json
POST /api/tasks/:id/comments
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "body": "Sí, ya lo compré. Falta la pintura."
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "author": "Luis",
  "body": "Sí, ya lo compré. Falta la pintura.",
  "created_at": "2026-08-12T18:00:00Z"
}
```

---

## Códigos de error

| Código | Significado |
|---|---|
| 400 | Request inválido (validación de campos) |
| 401 | No autenticado (JWT inválido o vencido) |
| 403 | No autorizado (scope insuficiente) |
| 404 | Recurso no encontrado |
| 429 | Rate limit excedido |
| 500 | Error interno del servidor |

**Formato de error:**
```json
{
  "error": "Mensaje de error",
  "code": "ERROR_CODE"
}
```
