-- Migración inicial: Sistema de Pendientes por Telegram
-- Fecha: 2026-08-12

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- PROYECTOS
-- ============================================
CREATE TABLE projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  client        TEXT,
  status        TEXT NOT NULL DEFAULT 'activo',
  budget_amount NUMERIC(14,2),
  currency      TEXT NOT NULL DEFAULT 'MXN',
  notes         TEXT,
  last_review_at TIMESTAMPTZ,
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
  person        TEXT,
  assigned_to   TEXT,
  status        TEXT NOT NULL DEFAULT 'pendiente',
  priority      SMALLINT NOT NULL DEFAULT 3,
  starts_at     TIMESTAMPTZ,
  due_at        TIMESTAMPTZ,
  remind_at     TIMESTAMPTZ,
  reminded_at   TIMESTAMPTZ,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  blocked_by    UUID REFERENCES tasks(id) ON DELETE SET NULL,
  recurrence    TEXT,
  recurrence_parent UUID REFERENCES tasks(id) ON DELETE SET NULL,
  source_msg_id BIGINT,
  source_ts     TEXT,
  confirmed     BOOLEAN NOT NULL DEFAULT true,
  private       BOOLEAN NOT NULL DEFAULT false,
  completed_by  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

CREATE INDEX idx_tasks_status_due ON tasks (status, due_at);
CREATE INDEX idx_tasks_project ON tasks (project_id);
CREATE INDEX idx_tasks_remind ON tasks (remind_at) WHERE reminded_at IS NULL AND confirmed = true;
CREATE INDEX idx_tasks_blocked ON tasks (blocked_by) WHERE blocked_by IS NOT NULL;

-- ============================================
-- SUBTAREAS
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
  kind       TEXT NOT NULL DEFAULT 'gasto',
  status     TEXT NOT NULL DEFAULT 'pendiente',
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
-- BITÁCORA CRUDA
-- ============================================
CREATE TABLE inbox_messages (
  id          BIGSERIAL PRIMARY KEY,
  tg_msg_id   BIGINT,
  kind        TEXT NOT NULL DEFAULT 'texto',
  raw_text    TEXT,
  tg_file_id  TEXT,
  duration_s  INTEGER,
  transcript  TEXT,
  parsed_json JSONB,
  status      TEXT NOT NULL DEFAULT 'procesado',
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inbox_status ON inbox_messages (status);
CREATE INDEX idx_inbox_created ON inbox_messages (created_at DESC);

-- ============================================
-- SHARES
-- ============================================
CREATE TABLE shares (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  label         TEXT NOT NULL,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  pin_hash      TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'colaborador',
  can_complete  BOOLEAN NOT NULL DEFAULT true,
  can_create    BOOLEAN NOT NULL DEFAULT false,
  can_see_money BOOLEAN NOT NULL DEFAULT false,
  tg_chat_id    BIGINT,
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  last_seen_at  TIMESTAMPTZ,
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
  actor_label TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  action      TEXT NOT NULL,
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
-- SYSTEM FLAGS
-- ============================================
CREATE TABLE system_flags (
  key   TEXT PRIMARY KEY,
  value TEXT
);

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
