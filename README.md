# Sistema de Pendientes por Telegram

Sistema personal de gestión de pendientes que captura mensajes de Telegram (texto y voz), los interpreta con Gemini Flash, los guarda en Neon Postgres, y los muestra en un dashboard Next.js.

## Arquitectura

- **Backend:** Node 20 + TypeScript + Express (Render)
- **Base de datos:** Neon Postgres
- **LLM:** Gemini 2.5 Flash
- **Frontend:** Next.js 14 + Tailwind (Vercel)
- **Cron:** cron-job.org (keep-alive + recordatorios)

## Documentación

Ver archivos de planeación:
- `PLAN-TECNICO.md` — Resumen ejecutivo
- `ARQUITECTURA.md` — Diagrama y componentes
- `MODELO-DATOS.md` — Esquema de BD
- `API-CONTRACTS.md` — Contratos de API
- `PROMPTS.md` — Prompts del sistema
- `SEGURIDAD.md` — Decisiones de seguridad
- `IMPLEMENTACION.md` — Plan de implementación
- `DECISIONES.md` — Registro de decisiones

## Estado

**Fase actual:** 2 (Parser con Gemini) - En progreso

### Fases completadas

- ✅ **Fase 0:** Setup inicial
  - Backend Express + TypeScript funcionando
  - Base de datos Neon Postgres configurada
  - Deploy en Render: https://pendientes-telegram-backend.onrender.com
  - Health check: https://pendientes-telegram-backend.onrender.com/health

- ✅ **Fase 1:** Webhook de Telegram
  - Endpoint POST /telegram/webhook funcionando
  - Validación de secret_token
  - Filtrado por TELEGRAM_CHAT_ID
  - Guardado de mensajes en inbox_messages
  - Respuesta de confirmación al usuario

- 🔄 **Fase 2:** Parser con Gemini + Executor
  - Servicio de Gemini configurado
  - Prompt del parser con 24 reglas
  - Executor para convertir acciones en filas de BD
  - Integración completa en webhook
  - **Modelo actualizado a gemini-3.5-flash-lite** (económico y eficiente)
  - Pendiente: Probar con mensajes reales

## Quick Start

### Backend (Local)

```bash
cd backend
npm install
npm run migrate  # Requiere DATABASE_URL
npm run dev      # http://localhost:8080
```

### Backend (Producción)

El backend está desplegado en Render:
- **URL:** https://pendientes-telegram-backend.onrender.com
- **Health:** https://pendientes-telegram-backend.onrender.com/health
- **Config:** Ver `backend/RENDER.md` para detalles del deploy

### Frontend

Próximamente...
