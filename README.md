# Sistema de Pendientes por Telegram

Sistema personal de gestión de pendientes que captura mensajes de Telegram (texto y voz), los interpreta con Gemini Flash, los guarda en Neon Postgres, y los muestra en un dashboard Next.js.

## Arquitectura

- **Backend:** Node 20 + TypeScript + Express (Fly.io)
- **Base de datos:** Neon Postgres
- **LLM:** Gemini 2.5 Flash
- **Frontend:** Next.js 14 + Tailwind (Vercel)
- **Cron:** Fly.io Machines

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

**Fase actual:** 0 (Setup inicial)

## Quick Start

### Backend

```bash
cd backend
npm install
npm run migrate  # Requiere DATABASE_URL
npm run dev      # http://localhost:8080
```

### Frontend

Próximamente...
