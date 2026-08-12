# Modelo de Datos — Sistema de Pendientes por Telegram

**Versión:** 1.0  
**Fecha:** 2026-08-12

---

## Esquema completo

```sql
-- Extensión para UUIDs aleatorios
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROYECTOS
-- ============================================
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  client        TEXT,
  status        TEXT NOT NULL DEFAULT 'activo',   -- activo | pausado | cerrado
  budget_amount NUMERIC(14,2),
  currency      TEXT NOT NULL DEFAULT 'MXN',
  notes         TEXT,
  last_review_at TIMESTAMPTZ,                     -- última revisión (separado de last_seen_at)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at   TIMESTAMPTZ
);

-- ============================================
-- TAREAS
-- ============================================
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  detail        TEXT,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  person        TEXT,                              -- "Luis", "el herrero"
  assigned_to   TEXT,                              -- delegación
  status        TEXT NOT NULL DEFAULT 'pendiente', -- pendiente | en_proceso | hecho | cancelado
  priority      SMALLINT NOT NULL DEFAULT 3,       -- 1 urgente ... 4 algún día
  starts_at     TIMESTAMPTZ,                       -- ventanas de trabajo
  due_at        TIMESTAMPTZ,
  remind_at     TIMESTAMPTZ,
  reminded_at   TIMESTAMPTZ,                       -- se llena al enviar, evita duplicados
  tags          TEXT[] NOT NULL DEFAULT '{}',
  blocked_by    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  recurrence    TEXT,                              -- diaria | semanal | quincenal | mensual
  recurrence_parent UUID REFERENCES tasks(id) ON DELETE SET NULL,
  source_msg_id BIGINT,
  source_ts     TEXT,                              -- "04:12" (marca de tiempo de audio)
  confirmed     BOOLEAN NOT NULL DEFAULT true,     -- false para tareas de notas de voz
  private       BOOLEAN NOT NULL DEFAULT false,    -- invisible para colaboradores
  completed_by  TEXT,                              -- quién la completó
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_tasks_status_due ON tasks (status, due_at);
CREATE INDEX idx_tasks_project ON tasks (project_id);
CREATE INDEX idx_tasks_remind ON tasks (remind_at) WHERE reminded_at IS NULL AND confirmed = true;
CREATE INDEX idx_tasks_blocked ON tasks (blocked_by) WHERE blocked_by IS NOT NULL;

-- ============================================
-- SUBTAREAS (checklists)
-- ============================================
CREATE TABLE subtasks (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id   UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  done      BOOLEAN NOT NULL DEFAULT false,
  position  SMALLINT NOT NULL DEFAULT 0
);

CREATE INDEX idx_subtasks_task ON subtasks (task_id);

-- ============================================
-- GASTOS
-- ============================================
CREATE TABLE expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  concept    TEXT NOT NULL,
  amount     NUMERIC(14,2) NOT NULL,
  currency   TEXT NOT NULL DEFAULT 'MXN',
  kind       TEXT NOT NULL DEFAULT 'gasto',      -- gasto | ingreso
  status     TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | pagado
  person     TEXT,
  due_at     TIMESTAMPTZ,
  paid_at    TIMESTAMPTZ,
  source_msg_id BIGINT,
  source_ts  TEXT,
  confirmed  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_project ON expenses (project_id, status);

-- ============================================
-- NOTAS
-- ============================================
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content    TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  tags       TEXT[] NOT NULL DEFAULT '{}',
  source_msg_id BIGINT,
  source_ts  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notes_project ON notes (project_id);

-- ============================================
-- BITÁCORA CRUDA (para reprocesar si el parser falla)
-- ============================================
CREATE TABLE inbox_messages (
  id          BIGSERIAL PRIMARY KEY,
  tg_msg_id   BIGINT,
  kind        TEXT NOT NULL DEFAULT 'texto',     -- texto | voz
  raw_text    TEXT,                              -- NULL si es solo audio
  tg_file_id  TEXT,                              -- para volver a bajar el audio
  duration_s  INTEGER,
  transcript  TEXT,                              -- transcripción de audio
  parsed_json JSONB,
  status      TEXT NOT NULL DEFAULT 'procesado', -- procesado | error | ambiguo
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_status ON inbox_messages (status);
CREATE INDEX idx_inbox_created ON inbox_messages (created_at DESC);

-- ============================================
-- SHARES (acceso compartido multi-tablero)
-- ============================================
CREATE TABLE shares (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,            -- 32 caracteres aleatorios
  label         TEXT NOT NULL,                   -- "Karla — Casa Nativa"
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE, -- NULL = todo
  pin_hash      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'colaborador', -- owner | colaborador | lector
  can_complete  BOOLEAN NOT NULL DEFAULT true,
  can_create    BOOLEAN NOT NULL DEFAULT false,
  can_see_money BOOLEAN NOT NULL DEFAULT false,
  tg_chat_id    BIGINT,                          -- opcional, para colaboradores en Telegram
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  last_seen_at  TIMESTAMPTZ,                     -- último acceso
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_shares_slug ON shares (slug);
CREATE INDEX idx_shares_tg_chat ON shares (tg_chat_id) WHERE tg_chat_id IS NOT NULL;

-- ============================================
-- BITÁCORA DE ACTIVIDAD
-- ============================================
CREATE TABLE activity (
  id          BIGSERIAL PRIMARY KEY,
  share_id    UUID REFERENCES shares(id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL,                     -- copia del label, sobrevive si borras el share
  entity_type TEXT NOT NULL,                     -- task | subtask | expense | note | project
  entity_id   UUID,
  action      TEXT NOT NULL,                     -- creo | completo | reabrio | edito | comento
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_created ON activity (created_at DESC);
CREATE INDEX idx_activity_entity ON activity (entity_type, entity_id);

-- ============================================
-- COMENTARIOS
-- ============================================
CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author      TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_task ON comments (task_id);

-- ============================================
-- SYSTEM FLAGS (control de estado)
-- ============================================
CREATE TABLE system_flags (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Flags iniciales
INSERT INTO system_flags (key, value) VALUES
  ('last_briefing_date', NULL),
  ('last_closing_date', NULL);

-- ============================================
-- REFRESH TOKENS
-- ============================================
CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id    UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_share ON refresh_tokens (share_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);
```

---

## Cambios respecto al plan original

### 1. Índices añadidos

- `idx_tasks_project` — Consultas de tareas por proyecto.
- `idx_tasks_blocked` — Validación de tareas bloqueadas.
- `idx_inbox_status` — Consultas de mensajes por estado.
- `idx_inbox_created` — Ordenar mensajes por fecha.
- `idx_notes_project` — Consultas de notas por proyecto.
- `idx_subtasks_task` — Consultas de subtareas por tarea.

### 2. Columnas añadidas

**tasks:**
- `assigned_to` — Delegación.
- `starts_at` — Ventanas de trabajo.
- `blocked_by` — Dependencias entre tareas.
- `recurrence` — Recurrencia (diaria, semanal, etc.).
- `recurrence_parent` — Tarea padre para instancias recurrentes.
- `source_ts` — Marca de tiempo de audio.
- `confirmed` — Confirmación de tareas de notas de voz.
- `private` — Tareas invisibles para colaboradores.
- `completed_by` — Quién completó la tarea.

**expenses:**
- `source_msg_id` — Mensaje de origen.
- `source_ts` — Marca de tiempo de audio.
- `confirmed` — Confirmación de gastos de notas de voz.

**notes:**
- `source_msg_id` — Mensaje de origen.
- `source_ts` — Marca de tiempo de audio.

**inbox_messages:**
- `kind` — texto | voz.
- `tg_file_id` — Para volver a bajar el audio.
- `duration_s` — Duración del audio.
- `transcript` — Transcripción de audio.

**projects:**
- `last_review_at` — Última revisión (separado de `last_seen_at`).

### 3. Tablas nuevas

- `shares` — Acceso compartido multi-tablero.
- `activity` — Bitácora de actividad.
- `comments` — Comentarios en tareas.
- `refresh_tokens` — Refresh tokens para autenticación.

---

## Validaciones

### Validación de ciclos en `blocked_by`

Antes de insertar o actualizar `blocked_by`, verificar que no haya un ciclo:

```typescript
async function wouldCreateCycle(taskId: string, blockedBy: string): Promise<boolean> {
  // BFS desde blockedBy para ver si llegamos a taskId
  const visited = new Set<string>();
  const queue = [blockedBy];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true; // Ciclo detectado
    if (visited.has(current)) continue;
    visited.add(current);
    
    const result = await db.query(
      'SELECT blocked_by FROM tasks WHERE id = $1',
      [current]
    );
    
    if (result.rows[0]?.blocked_by) {
      queue.push(result.rows[0].blocked_by);
    }
  }
  
  return false;
}
```

### Recurrencia: generación de instancias

Cuando se completa una tarea recurrente:

```typescript
async function onTaskCompleted(taskId: string) {
  const task = await db.query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  
  if (task.rows[0].recurrence) {
    // Calcular próxima fecha
    const nextDueAt = calculateNextDate(task.rows[0].due_at, task.rows[0].recurrence);
    
    // Crear nueva instancia
    await db.query(
      `INSERT INTO tasks (title, detail, project_id, person, recurrence, recurrence_parent, due_at, remind_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        task.rows[0].title,
        task.rows[0].detail,
        task.rows[0].project_id,
        task.rows[0].person,
        task.rows[0].recurrence,
        taskId,
        nextDueAt,
        calculateReminder(nextDueAt)
      ]
    );
  }
}

function calculateNextDate(currentDate: Date, recurrence: string): Date {
  const next = new Date(currentDate);
  switch (recurrence) {
    case 'diaria': next.setDate(next.getDate() + 1); break;
    case 'semanal': next.setDate(next.getDate() + 7); break;
    case 'quincenal': next.setDate(next.getDate() + 14); break;
    case 'mensual': next.setMonth(next.getMonth() + 1); break;
  }
  return next;
}
```

---

## Seed inicial

Después de correr las migraciones, crear el share del owner:

```sql
INSERT INTO shares (slug, label, project_id, pin_hash, role,
                    can_complete, can_create, can_see_money, expires_at)
VALUES (
  '<32 caracteres aleatorios>',   -- tu enlace permanente
  'Main',
  NULL,                           -- NULL = todos los proyectos
  '<bcrypt de tu PIN>',
  'owner',
  true, true, true,
  NULL                            -- sin caducidad
);
```

---

## Consultas comunes

### Tareas pendientes de recordatorio

```sql
SELECT * FROM tasks
WHERE remind_at <= now()
  AND reminded_at IS NULL
  AND confirmed = true
  AND (blocked_by IS NULL OR (SELECT status FROM tasks WHERE id = blocked_by) = 'hecho')
  AND status = 'pendiente';
```

### Tareas de un proyecto (filtrado por scope)

```sql
SELECT * FROM tasks
WHERE ($1::uuid IS NULL OR project_id = $1)
  AND ($2::boolean OR private = false)
  AND status <> 'cancelado'
ORDER BY due_at NULLS LAST, priority;
```

### Presupuesto ejercido de un proyecto

```sql
SELECT
  p.budget_amount,
  COALESCE(SUM(e.amount), 0) AS spent,
  p.budget_amount - COALESCE(SUM(e.amount), 0) AS remaining
FROM projects p
LEFT JOIN expenses e ON e.project_id = p.id AND e.status = 'pagado'
WHERE p.id = $1
GROUP BY p.id, p.budget_amount;
```

### Actividad reciente de un proyecto

```sql
SELECT * FROM activity
WHERE (entity_type = 'project' AND entity_id = $1)
   OR (entity_type = 'task' AND entity_id IN (SELECT id FROM tasks WHERE project_id = $1))
ORDER BY created_at DESC
LIMIT 50;
```
