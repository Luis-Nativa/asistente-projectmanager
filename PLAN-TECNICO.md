# Plan Técnico — Sistema de Pendientes por Telegram

**Versión:** 1.0  
**Fecha:** 2026-08-12  
**Estado:** Planeación completa, listo para implementación

---

## Resumen ejecutivo

Sistema personal de gestión de pendientes que captura mensajes de Telegram (texto y voz), los interpreta con Gemini Flash, los guarda en Neon Postgres, y los muestra en un dashboard Next.js. Incluye recordatorios automáticos, briefing matutino, acceso compartido multi-tablero, y notas de voz con transcripción.

---

## Decisiones de arquitectura

### Stack tecnológico

| Componente | Tecnología | Justificación |
|---|---|---|
| **Backend** | Node 20 + TypeScript + Express | Mismo lenguaje que frontend, menos fricción |
| **Base de datos** | Neon Postgres (driver `pg`) | Serverless, capa gratis, SQL plano |
| **LLM** | Gemini 2.5 Flash | Salida estructurada con `responseSchema`, costo de centavos |
| **Frontend** | Next.js 14 (App Router) + Tailwind | Despliegue en un clic desde GitHub |
| **Hosting backend** | Fly.io | Gratis para uso ligero, cron nativo, sin cold starts |
| **Hosting frontend** | Vercel | Gratis, integración con GitHub |
| **Cron** | Fly.io Machines (cron nativo) | Confiabilidad total, sin dependencias externas |
| **Zona horaria** | UTC en BD, America/Mexico_City en frontend | Único punto donde se rompen los recordatorios |

### Cambios respecto al plan original

1. **Fly.io en vez de Render:** Render free tier + cron es contradictorio (el cron no corre si el servicio duerme). Fly.io es gratis y tiene cron nativo.
2. **Refresh tokens en vez de JWT de 30 días:** JWT de 1 día + refresh token de 30 días. Más seguro.
3. **No partir audios largos:** El usuario dicta notas rápidas (<5 min). Si necesita dictar más, usa dictado por texto de Telegram.
4. **Diccionario de nombres:** Para reducir errores de transcripción en nombres propios.

---

## Arquitectura en una línea

```
Telegram → webhook → Express (Fly.io) → Gemini Flash (parser) → Neon
                          ↑                                       ↓
              Fly.io Cron (cada 5 min)                    Next.js (Vercel)
                          ↓                                       ↑
              recordatorios → Telegram                    refresh token + PIN
```

Un solo backend sirve dos consumidores: el bot y el dashboard. El dashboard **nunca** habla con Gemini ni con Neon directamente.

---

## Flujo de datos

### Mensaje de texto

1. Usuario envía mensaje por Telegram.
2. Webhook recibe el mensaje, valida `secret_token` y `chat.id`.
3. Guarda el mensaje crudo en `inbox_messages`.
4. Responde "Recibido" en <500ms.
5. En segundo plano:
   - Envía el mensaje a Gemini Flash con el prompt del parser.
   - Gemini devuelve JSON estructado con acciones.
   - Executor convierte acciones en filas de BD.
   - Bot confirma con resumen corto.

### Nota de voz

1. Usuario manda nota de voz (mantener presionado micrófono).
2. Webhook recibe `message.voice`, valida tamaño (<20 MB) y duración (<25 min).
3. Guarda metadata en `inbox_messages` con `kind='voz'`.
4. Responde "Recibí X min. Transcribiendo…" en <3s.
5. En segundo plano:
   - Descarga audio con `getFile`.
   - Envía audio a Gemini Flash con prompt de transcripción.
   - Guarda transcripción en `inbox_messages.transcript`.
   - Envía transcripción al parser (mismo prompt que texto).
   - Todo lo creado entra con `confirmed=false`.
   - Bot manda resumen con enlace a pantalla de revisión.

### Recordatorios

1. Fly.io Cron llama `POST /internal/tick` cada 5 min.
2. Busca tareas con `remind_at <= now() AND reminded_at IS NULL AND confirmed = true`.
3. Para cada tarea:
   - Manda recordatorio por Telegram.
   - Marca `reminded_at = now()`.
4. Si son las 07:00 y no se ha enviado hoy: briefing matutino.
5. Si son las 21:00: cierre nocturno.

### Acceso compartido

1. Owner crea share con `POST /api/shares`.
2. Servidor genera slug (32 chars) y PIN (6 dígitos).
3. PIN se muestra **una sola vez** y se guarda como bcrypt.
4. Colaborador accede a `/d/<slug>`, ingresa PIN.
5. `POST /api/auth/pin` valida y devuelve JWT de 1 día + refresh token de 30 días.
6. Middleware recarga el share desde BD en cada request.
7. Todas las consultas se filtran por `req.scope.project_id`.

---

## Alcance de datos

**Incluye:**
- Tareas con subtareas (checklists)
- Recordatorios
- Proyectos con presupuesto y gastos
- Notas sueltas sin fecha
- Comentarios en tareas
- Bitácora de actividad

**No incluye:**
- Personas como tabla aparte (son campo de texto en tareas/gastos)
- Archivos adjuntos (solo texto y audio)
- Integración con calendarios externos
- Multi-idioma (solo español mexicano)

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Fly.io cambia reglas del free tier | Baja | Alto | Migrar a Railway ($5/mes) |
| Gemini Flash pierde precisión con prompts largos | Media | Alto | Eval dataset con 20-30 mensajes |
| Parser crea tareas fantasma de notas de voz | Alta | Medio | Confirmación por Telegram (`/confirmar`) |
| Colaborador filtra datos de otro proyecto | Baja | Crítico | Tests automatizados de filtrado por scope |
| Neon cold start después de inactividad | Alta | Bajo | Aceptar 2-3s de retraso |
| Usuario no revisa tareas de notas de voz | Alta | Medio | Confirmación automática después de 24h + notificación |

---

## Fases de implementación

**Fases 0-7:** Sistema base (texto, dashboard, recordatorios, consultas).  
**Fases 8-10:** Acceso compartido (multi-tablero, actividad, comentarios).  
**Fase 11:** Notas de voz (transcripción, pantalla de revisión).

Ver `IMPLEMENTACION.md` para detalles de cada fase.

---

## Archivos de planeación relacionados

- `ARQUITECTURA.md` — Detalles de arquitectura
- `MODELO-DATOS.md` — Esquema de BD completo
- `API-CONTRATS.md` — Contratos de API
- `PROMPTS.md` — Todos los prompts del sistema
- `SEGURIDAD.md` — Decisiones de seguridad
- `IMPLEMENTACION.md` — Plan de implementación por fases
- `DECISIONES.md` — Registro de decisiones tomadas
