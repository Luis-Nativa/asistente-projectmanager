# Seguridad — Sistema de Pendientes por Telegram

**Versión:** 1.0  
**Fecha:** 2026-08-12

---

## Principios

1. **Filtrado por scope en el servidor.** El `project_id` del alcance sale del token, **nunca** del request.
2. **Defensa en profundidad.** Múltiples capas de validación.
3. **Auditoría completa.** Todo acceso y acción se registra.
4. **Secretos nunca en claro.** PINs y tokens se guardan como hashes.

---

## Autenticación

### PIN + Refresh Tokens

**Flujo:**

1. Usuario accede a `/d/<slug>`.
2. Ingresa PIN de 6 dígitos.
3. `POST /api/auth/pin` valida slug + PIN.
4. Servidor devuelve:
   - JWT de 1 día (para acceso inmediato).
   - Refresh token de 30 días (en `httpOnly cookie`).
5. Cuando el JWT expira, el frontend usa el refresh token para obtener uno nuevo.
6. Si el refresh token también expira, vuelve a pedir PIN.

**Ventajas sobre JWT de 30 días:**
- Si el JWT es robado, solo es válido por 1 día.
- El refresh token se puede revocar desde el servidor.
- Mejor balance entre seguridad y UX.

**Implementación:**

```typescript
// POST /api/auth/pin
async function authenticatePin(slug: string, pin: string) {
  // 1. Buscar share por slug
  const share = await db.query('SELECT * FROM shares WHERE slug = $1', [slug]);
  if (!share.rows[0]) return { error: 'Enlace inválido', status: 401 };
  
  // 2. Validar PIN
  const valid = await bcrypt.compare(pin, share.rows[0].pin_hash);
  if (!valid) {
    await logFailedAttempt(slug);
    return { error: 'PIN inválido', status: 401 };
  }
  
  // 3. Verificar que no esté revocado ni vencido
  if (share.rows[0].revoked_at) return { error: 'Enlace revocado', status: 401 };
  if (share.rows[0].expires_at && share.rows[0].expires_at < new Date()) {
    return { error: 'Enlace vencido', status: 401 };
  }
  
  // 4. Generar JWT
  const token = jwt.sign(
    { share_id: share.rows[0].id },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
  
  // 5. Generar refresh token
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const refreshTokenHash = await bcrypt.hash(refreshToken, 12);
  await db.query(
    `INSERT INTO refresh_tokens (share_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [share.rows[0].id, refreshTokenHash, addDays(30)]
  );
  
  // 6. Actualizar last_seen_at
  await db.query(
    'UPDATE shares SET last_seen_at = now() WHERE id = $1',
    [share.rows[0].id]
  );
  
  return { token, refreshToken, expiresIn: 86400 };
}
```

### Rate Limit de PIN

**Regla:** 5 intentos por IP cada 15 minutos.

**Implementación:**

```typescript
import rateLimit from 'express-rate-limit';

const pinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/api/auth/pin', pinRateLimit, authenticatePin);
```

---

## Autorización

### Filtrado por scope

**Regla inquebrantable:** El `project_id` del alcance sale de `req.scope.project_id`, **nunca** de parámetros del cliente.

**Middleware:**

```typescript
async function authMiddleware(req, res, next) {
  // 1. Extraer JWT del header
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  
  const token = authHeader.split(' ')[1];
  
  // 2. Validar JWT
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o vencido' });
  }
  
  // 3. Recargar share desde BD (no confiar en el payload)
  const share = await db.query('SELECT * FROM shares WHERE id = $1', [payload.share_id]);
  if (!share.rows[0]) {
    return res.status(401).json({ error: 'Share no encontrado' });
  }
  
  // 4. Verificar que no esté revocado ni vencido
  if (share.rows[0].revoked_at) {
    return res.status(401).json({ error: 'Enlace revocado' });
  }
  if (share.rows[0].expires_at && share.rows[0].expires_at < new Date()) {
    return res.status(401).json({ error: 'Enlace vencido' });
  }
  
  // 5. Adjuntar scope
  req.scope = share.rows[0];
  
  // 6. Actualizar last_seen_at
  await db.query(
    'UPDATE shares SET last_seen_at = now() WHERE id = $1',
    [share.rows[0].id]
  );
  
  next();
}
```

**Uso en endpoints:**

```typescript
// GET /api/tasks
app.get('/api/tasks', authMiddleware, async (req, res) => {
  const { project_id } = req.query;
  
  // Validar que project_id del query coincida con scope
  if (project_id && req.scope.project_id && project_id !== req.scope.project_id) {
    return res.status(403).json({ error: 'No autorizado para este proyecto' });
  }
  
  // Usar scope.project_id para filtrar
  const tasks = await db.query(
    `SELECT * FROM tasks
     WHERE ($1::uuid IS NULL OR project_id = $1)
       AND ($2::boolean OR private = false)
       AND status <> 'cancelado'
     ORDER BY due_at NULLS LAST, priority`,
    [req.scope.project_id, req.scope.role === 'owner']
  );
  
  res.json({ tasks: tasks.rows });
});
```

### Permisos granulares

| Permiso | Efecto |
|---|---|
| `can_complete = false` | Los `PATCH` de status responden 403 |
| `can_create = false` | Los `POST` responden 403 |
| `can_see_money = false` | `/api/expenses` responde 403, proyectos se devuelven sin `budget_amount`, `spent`, `remaining` |
| `private = true` en tarea | Invisible para cualquiera que no sea `role='owner'` |

**Validación de permisos:**

```typescript
// PATCH /api/tasks/:id
app.patch('/api/tasks/:id', authMiddleware, async (req, res) => {
  const { status } = req.body;
  
  // Validar can_complete
  if (status === 'hecho' && !req.scope.can_complete) {
    return res.status(403).json({ error: 'No puedes completar tareas' });
  }
  
  // Validar private
  const task = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (task.rows[0].private && req.scope.role !== 'owner') {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }
  
  // ... actualizar tarea
});
```

---

## Webhook de Telegram

### Validación de secret_token

**Regla:** Todo request de Telegram debe incluir `X-Telegram-Bot-Api-Secret-Token`.

**Implementación:**

```typescript
app.post('/telegram/webhook', async (req, res) => {
  // 1. Validar secret_token
  const secretToken = req.headers['x-telegram-bot-api-secret-token'];
  if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(403).json({ error: 'Invalid secret token' });
  }
  
  // 2. Validar chat.id
  const chatId = req.body.message?.chat?.id;
  if (!chatId) {
    return res.status(400).json({ error: 'Missing chat.id' });
  }
  
  // 3. Buscar share por chat.id
  const share = await db.query(
    'SELECT * FROM shares WHERE tg_chat_id = $1',
    [chatId]
  );
  
  // 4. Si no existe, verificar si es el owner (TELEGRAM_CHAT_ID)
  if (!share.rows[0] && chatId !== process.env.TELEGRAM_CHAT_ID) {
    // Ignorar mensajes de chats no autorizados
    return res.status(200).json({ ok: true });
  }
  
  // 5. Procesar mensaje
  await processMessage(req.body.message, share.rows[0]);
  
  res.status(200).json({ ok: true });
});
```

### Filtrado por chat.id

**Regla:** Solo procesar mensajes de `chat.id` autorizados.

**Autorizados:**
- `TELEGRAM_CHAT_ID` (owner).
- `shares.tg_chat_id` (colaboradores vinculados).

**No autorizados:**
- Cualquier otro `chat.id`. Se ignora silenciosamente.

---

## Protección de datos sensibles

### Tareas privadas

**Regla:** Tareas con `private = true` solo son visibles para `role='owner'`.

**Cuándo marcar como privada:**
- El mensaje contiene "confidencial", "no compartir", "entre nos".
- El parser detecta montos o temas delicados en el texto crudo.

**Implementación:**

```typescript
// En el parser
if (text.match(/confidencial|no compartir|entre nos/i)) {
  return { ..., private: true };
}
```

### Dinero oculto

**Regla:** Si `can_see_money = false`, los endpoints de expenses responden 403 y los proyectos se devuelven **sin** `budget_amount`, `spent`, `remaining`.

**No filtrar en el frontend.** Filtrar en el backend.

**Implementación:**

```typescript
// GET /api/projects
app.get('/api/projects', authMiddleware, async (req, res) => {
  const projects = await db.query('SELECT * FROM projects');
  
  // Si no puede ver dinero, quitar campos financieros
  if (!req.scope.can_see_money) {
    projects.rows.forEach(p => {
      delete p.budget_amount;
      delete p.spent;
      delete p.remaining;
    });
  }
  
  res.json({ projects: projects.rows });
});
```

---

## Auditoría

### Bitácora de actividad

**Regla:** Toda acción se registra en `activity`.

**Implementación:**

```typescript
async function logActivity(shareId: string, actorLabel: string, entityType: string, entityId: string, action: string, detail?: any) {
  await db.query(
    `INSERT INTO activity (share_id, actor_label, entity_type, entity_id, action, detail)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [shareId, actorLabel, entityType, entityId, action, JSON.stringify(detail)]
  );
}

// Uso
await logActivity(
  req.scope.id,
  req.scope.label,
  'task',
  taskId,
  'completo',
  { title: task.title }
);
```

### Notificación de acceso nuevo

**Regla:** Cuando un share se usa por primera vez, notificar al owner.

**Implementación:**

```typescript
// En authMiddleware
if (!share.rows[0].last_seen_at) {
  // Primer acceso
  await sendTelegramMessage(
    process.env.TELEGRAM_CHAT_ID,
    `🔔 ${share.rows[0].label} accedió al tablero por primera vez.`
  );
}
```

---

## Revocación de accesos

### Revocar share

**Regla:** Marcar `revoked_at`, no borrar la fila (conserva bitácora).

**Implementación:**

```typescript
// DELETE /api/shares/:id
app.delete('/api/shares/:id', authMiddleware, async (req, res) => {
  // No puedes borrarte a ti mismo
  if (req.scope.role === 'owner' && req.scope.id === req.params.id) {
    return res.status(403).json({ error: 'No puedes revocar tu propio acceso' });
  }
  
  await db.query(
    'UPDATE shares SET revoked_at = now() WHERE id = $1',
    [req.params.id]
  );
  
  // Revocar refresh tokens
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE share_id = $1',
    [req.params.id]
  );
  
  res.status(204).send();
});
```

### Revocación automática por inactividad

**Regla:** Si un share no se usa en 60 días, notificar al owner.

**Implementación:**

```typescript
// En el cron (POST /internal/tick)
async function checkInactiveShares() {
  const inactiveShares = await db.query(
    `SELECT * FROM shares
     WHERE last_seen_at < now() - interval '60 days'
       AND revoked_at IS NULL
       AND role <> 'owner'`
  );
  
  for (const share of inactiveShares.rows) {
    await sendTelegramMessage(
      process.env.TELEGRAM_CHAT_ID,
      `⚠️ ${share.label} no ha accedido en 60 días. Considera revocarlo.`
    );
  }
}
```

---

## Tests de seguridad

### Test de filtrado por scope

**Regla:** Al final de la Fase 8, escribir un test que verifique que un token con alcance de proyecto A no puede leer ni modificar nada del proyecto B.

**Implementación:**

```typescript
describe('Scope filtering', () => {
  it('cannot read tasks from another project', async () => {
    // Crear dos proyectos
    const projectA = await createProject('Proyecto A');
    const projectB = await createProject('Proyecto B');
    
    // Crear tarea en proyecto B
    const taskB = await createTask('Tarea B', projectB.id);
    
    // Crear share con alcance de proyecto A
    const share = await createShare({ project_id: projectA.id });
    const token = await authenticate(share.slug, share.pin);
    
    // Intentar leer tareas de proyecto B
    const response = await request(app)
      .get('/api/tasks')
      .query({ project_id: projectB.id })
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(403);
  });
  
  it('cannot modify tasks from another project', async () => {
    // Similar al test anterior, pero con PATCH
  });
  
  it('cannot see expenses if can_see_money is false', async () => {
    // Crear share con can_see_money = false
    // Intentar leer /api/expenses
    // Esperar 403
  });
});
```

---

## Resumen de capas de seguridad

| Capa | Protección |
|---|---|
| **1. Webhook** | Validación de `secret_token` de Telegram |
| **2. Chat ID** | Filtrado por `chat.id` autorizado |
| **3. PIN** | 6 dígitos + bcrypt + rate limit |
| **4. JWT** | 1 día de vida, firmado con `JWT_SECRET` |
| **5. Refresh token** | 30 días, revocable, en `httpOnly cookie` |
| **6. Scope** | Filtrado por `project_id` en el servidor |
| **7. Permisos** | `can_complete`, `can_create`, `can_see_money` |
| **8. Auditoría** | Bitácora de actividad + notificaciones |
| **9. Revocación** | Marcado de `revoked_at`, no borrado |

---

## Lo que NO es seguridad de grado bancario

- PIN de 6 dígitos compartido por WhatsApp se reenvía, se filtra, no caduca solo.
- JWT en `localStorage` es vulnerable a XSS (pero el refresh token está en `httpOnly cookie`).
- No hay 2FA.
- No hay encriptación de datos en reposo (solo en tránsito con HTTPS).

**Esto es aceptable para:**
- Pendientes personales de negocio.
- Coordinación con 1-3 colaboradores.

**No es aceptable para:**
- Nóminas, contratos, datos de clientes.
- Información delicada que te dolería filtrar.

Si algún día necesitas manejar datos sensibles, migra a autenticación real (OAuth, SSO).
