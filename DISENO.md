# Rediseño del Dashboard — Estado y Continuación

Registro de dónde quedó el rediseño del dashboard (`frontend/app/d/[slug]/page.tsx`) y qué falta. Plan completo original (con todo el razonamiento y hallazgos de investigación) en `~/.claude/plans/quiero-revisar-el-dise-o-vectorized-yao.md` de la máquina donde se planeó — este archivo es el resumen operativo para retomar el trabajo sin tener que releer esa sesión completa.

## Por qué

El dashboard original era un grid plano de 3 columnas ("solo cuadros", sin jerarquía visual) con checkboxes decorativos que fallaban silenciosamente. Se rediseñó para tener una jerarquía clara (proyectos → tareas accionables → notas) y, sobre todo, para que la interacción fuera real: al investigar se encontró que **el backend no tenía ninguna ruta de escritura** (`PATCH`/`POST`/`DELETE`) — solo 5 `GET`. Todo lo que "se veía" interactivo en el frontend llamaba a endpoints que nunca existieron.

## Fase 1 — COMPLETADA

**Backend** (`backend/src/routes/api.ts`):
- `PATCH /api/tasks/:id` implementado (no existía antes). Reglas de `API-CONTRACTS.md` aplicadas: 403 si `status→hecho` y `can_complete=false`, 404 si `private=true` y `role≠owner`. Setea `completed_at`/`completed_by` al completar.
- `GET /api/dashboard` ahora incluye `tasks_count`/`tasks_pending` por proyecto (antes causaba "NaN/" en las tarjetas de proyecto).

**Frontend**:
- `frontend/app/layout.tsx`: `<Toaster />` montado (existía el componente pero no se usaba).
- `frontend/components/TaskList.tsx`: checkbox controlado + optimistic update + rollback en error + toast.
- `frontend/components/ProjectCard.tsx`: botón "Ver detalle" ahora abre un `Sheet` con el detalle real del proyecto.
- `frontend/components/ProjectCarousel.tsx` (nuevo): carrusel de proyectos arriba de todo, usando el bloque `carousel` de shadcn (embla).
- `frontend/components/UrgentOverdueBoard.tsx` (nuevo): reemplaza el stack de tareas por dos secciones explícitas "Urgentes" (`priority===1`) y "Atrasadas", lado a lado desde tablet (`md:grid-cols-2`), apiladas en mobile con Urgentes primero.
- `frontend/app/d/[slug]/page.tsx`: reescrito de grid de 3 columnas a stack vertical jerárquico: stats → **Proyectos (carrusel)** → **Urgentes/Atrasadas** → separador visual → **Notas**.
- shadcn instalados: `carousel`, `sheet`, `popover`, `select` (los últimos dos ya están instalados para la Fase 2, aún no usados).

**Verificado en vivo:** backend probado con curl (404/200/permisos), checkbox probado en navegador (tarea completada real y revertida), responsive confirmado en 375/768/1024px, `tsc --noEmit` limpio en frontend y backend.

**Hallazgo aparte, no arreglado (fuera de alcance):** el backend local (`npm run dev`) no carga `.env.local` automáticamente — hay que correrlo como `node --env-file=.env.local ./node_modules/.bin/tsx watch src/index.ts` para que el login/JWT funcionen en local. Es un gap de DX preexistente, no algo introducido en este trabajo.

## Fase 2 — PENDIENTE: Gantt a nivel de tarea

Sin tocar la base de datos (`tasks.starts_at`/`due_at`/`blocked_by` ya existen y bastan).

- Crear `frontend/components/TaskGanttChart.tsx`, construido a medida con CSS Grid/Flexbox (no una librería como `gantt-task-react`, para controlar el look exacto del dark theme). Agrupa por proyecto (swimlane = nombre de proyecto), una fila por tarea con barra `starts_at→due_at`.
- Specs de marca (del skill `dataviz`, no re-derivar): barras ≤24px de grosor, extremos redondeados 4px con base cuadrada, gap de 2px entre barras, gridlines 1px sólidas en gris recesivo, **un solo eje** (tiempo, nunca eje dual). **Color por estado** (a tiempo=verde, en riesgo=ámbar, atrasado=rojo — reusar clases ya usadas en `TaskList.tsx`), nunca color por identidad de proyecto.
- `date-fns` (ya instalado) basta para calcular posición (left/width en % sobre la ventana visible).
- Insertar en `page.tsx` entre `ProjectCarousel` y `UrgentOverdueBoard`.
- `popover` (detalle al click en una barra) y `select` (filtro de proyecto/fechas) ya están instalados, listos para usar.
- Sin cambios de backend — `GET /api/tasks` ya soporta `project_id`, `from`, `to`, `status`.
- Verificar: contraste ≥3:1 de verde/ámbar/rojo sobre `slate-950`, y el Gantt en 375px (scroll horizontal con labels sticky a la izquierda).

## Fase 3 — PENDIENTE: Timeblocking v1

Reutiliza tareas existentes, sin schema nuevo.

- Crear `frontend/components/TimeblockCalendar.tsx`: grilla día/semana con tareas como bloques (`starts_at`+`due_at`). **Click-to-edit**, no drag-and-drop (evita traer `dnd-kit`, no instalado).
- Persiste vía el mismo `PATCH /api/tasks/:id` de Fase 1.
- Insertar en `page.tsx` entre el Gantt y `UrgentOverdueBoard`.
- Sin backend nuevo.

## Fuera de alcance de este rediseño (decisión ya tomada, no re-litigar)

- **Gantt a nivel de proyecto** (una barra = un proyecto completo): requiere migración `start_date`/`end_date` en `projects` + `PATCH /api/projects/:id` (tampoco existe). Se puede pedir como Fase 4 después de validar el Gantt de tareas.
- **Hábitos** (rachas, % cumplimiento, heatmap): no existe ningún primitivo en la base de datos (`recurrence` de tareas no basta). Requiere tablas y endpoints nuevos desde cero. Se recomendó planearlo aparte con `/spec` como iniciativa independiente, no como parte de este rediseño.

## Cómo retomar

1. Revisar este archivo + `API-CONTRACTS.md` (sección de tareas) para refrescar el contrato.
2. Empezar por Fase 2 (Gantt de tareas) — es la pieza visual más grande que falta y no requiere backend nuevo.
3. Correr `/design-review` de nuevo tras integrar cada fase, como se hizo en la Fase 1.
