# Sistema de Pendientes por Telegram

Sistema personal de gestión de pendientes que captura mensajes de Telegram (texto y voz), los interpreta con Gemini Flash, los guarda en Neon Postgres, y los muestra en un dashboard Next.js.

## Estado del Proyecto

✅ **Todas las fases completadas**

- ✅ Fase 0: Setup inicial
- ✅ Fase 1: Webhook de Telegram
- ✅ Fase 2: Parser con Gemini + Executor
- ✅ Fase 3: API de lectura + Dashboard con PIN
- ✅ Fase 4: CRUD completo en el dashboard
- ✅ Fase 5: Cron + Recordatorios + Briefing
- ✅ Fase 6: Consultas en lenguaje natural
- ✅ Fase 7: Comandos del bot
- ✅ Fase 8: Acceso compartido (multi-tablero)
- ✅ Fase 9: Actividad + Comentarios + Modo revisión
- ✅ Fase 10: Vinculación de Telegram para colaboradores
- ✅ Fase 11: Notas de voz

## Arquitectura

- **Backend:** Node 20 + TypeScript + Express (Render)
- **Base de datos:** Neon Postgres
- **LLM:** Gemini 3.5 Flash Lite
- **Frontend:** Next.js 14 + Tailwind (Vercel)
- **Cron:** cron-job.org (keep-alive + recordatorios)

## Características Principales

### Captura de Pendientes
- Mensajes de texto en español coloquial
- Notas de voz con transcripción automática
- Parser inteligente con Gemini Flash
- Detección automática de tareas, gastos, notas y proyectos
- Sistema de dudas para información incompleta

### Dashboard Web
- Interfaz moderna con Tailwind CSS
- Vista de 3 columnas (Hoy, Vencidas, Proyectos)
- CRUD completo de tareas, gastos, notas y proyectos
- Sistema de comentarios por tarea
- Modo revisión para análisis de proyectos
- Gestión de accesos compartidos

### Multi-usuario
- Sistema de shares con permisos granulares
- Vinculación de Telegram para colaboradores
- Filtrado por proyecto asignado
- Auditoría de actividad

### Automatización
- Recordatorios automáticos por Telegram
- Briefing matutino (7:00 AM)
- Cierre nocturno (9:00 PM)
- Comandos del bot: /hoy, /urgentes, /resumen, /posponer, /deshacer

### Consultas Inteligentes
- Preguntas en lenguaje natural
- Respuestas basadas en datos reales
- Snapshot automático de datos relevantes

## Documentación

- `PLAN-TECNICO.md` — Plan técnico completo
- `ARQUITECTURA.md` — Diagrama de arquitectura
- `MODELO-DATOS.md` — Esquema de base de datos
- `API-CONTRACTS.md` — Contratos de API
- `PROMPTS.md` — Prompts del sistema
- `SEGURIDAD.md` — Decisiones de seguridad
- `IMPLEMENTACION.md` — Plan de implementación
- `DECISIONES.md` — Registro de decisiones
- `CRON-JOB-CONFIG.md` — Configuración de cron-job.org

## URLs de Producción

- **Backend:** https://pendientes-telegram-backend.onrender.com
- **Frontend:** https://asistente-projectmanager.vercel.app
- **Dashboard:** https://asistente-projectmanager.vercel.app/d/d23e11533588a47c8c434f72228837b3

## Desarrollo Local

### Backend

```bash
cd backend
npm install
npm run dev      # http://localhost:8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # http://localhost:3000
```

## Variables de Entorno

Ver `backend/.env.local` para todas las variables necesarias.

## Licencia

Privado - Uso personal
