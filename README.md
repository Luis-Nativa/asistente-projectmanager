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

**Fase actual:** 1 (Webhook de Telegram) - En progreso

### Fases completadas

- ✅ **Fase 0:** Setup inicial
  - Backend Express + TypeScript funcionando
  - Base de datos Neon Postgres configurada
  - Deploy en Render: https://pendientes-telegram-backend.onrender.com
  - Health check: https://pendientes-telegram-backend.onrender.com/health

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
