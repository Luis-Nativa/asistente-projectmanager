import { query } from './db.js';
import type { Accion } from './gemini.js';

export async function executeActions(acciones: Accion[], inboxMessageId: number): Promise<string[]> {
  const results: string[] = [];

  for (const accion of acciones) {
    try {
      switch (accion.tipo) {
        case 'crear_tarea':
          await crearTarea(accion, inboxMessageId);
          results.push(`✅ Tarea: ${accion.title}`);
          break;
        case 'crear_gasto':
          await crearGasto(accion, inboxMessageId);
          results.push(`✅ Gasto: ${accion.title || accion.content}`);
          break;
        case 'crear_nota':
          await crearNota(accion, inboxMessageId);
          results.push(`✅ Nota guardada`);
          break;
        case 'crear_proyecto':
          await crearProyecto(accion);
          results.push(`✅ Proyecto: ${accion.project_name}`);
          break;
        case 'crear_subtareas':
          await crearSubtareas(accion);
          results.push(`✅ Subtareas agregadas`);
          break;
        case 'completar_tarea':
          await completarTarea(accion);
          results.push(`✅ Tarea completada`);
          break;
        case 'consulta':
          results.push(`❓ Consulta: ${accion.question}`);
          break;
        default:
          console.warn('⚠️ Tipo de acción desconocido:', accion.tipo);
      }
    } catch (error) {
      console.error(`❌ Error ejecutando acción ${accion.tipo}:`, error);
      results.push(`❌ Error en ${accion.tipo}`);
    }
  }

  return results;
}

async function crearTarea(accion: Accion, inboxMessageId: number) {
  await query(
    `INSERT INTO tasks (title, detail, project_id, person, assigned_to, priority, 
     starts_at, due_at, remind_at, tags, recurrence, source_msg_id, confirmed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)`,
    [
      accion.title,
      accion.detail,
      accion.project_id || null,
      accion.person || null,
      accion.assigned_to || null,
      accion.priority || 3,
      accion.starts_at || null,
      accion.due_at || null,
      accion.remind_at || null,
      accion.tags || [],
      accion.recurrence || null,
      inboxMessageId
    ]
  );
}

async function crearGasto(accion: Accion, inboxMessageId: number) {
  await query(
    `INSERT INTO expenses (concept, amount, currency, kind, project_id, person, 
     due_at, source_msg_id, confirmed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
    [
      accion.title || accion.content || accion.detail || 'Gasto sin descripción',
      accion.amount,
      accion.currency || 'MXN',
      accion.kind || 'gasto',
      accion.project_id || null,
      accion.person || null,
      accion.due_at || null,
      inboxMessageId
    ]
  );
}

async function crearNota(accion: Accion, inboxMessageId: number) {
  await query(
    `INSERT INTO notes (content, project_id, tags, source_msg_id)
     VALUES ($1, $2, $3, $4)`,
    [
      accion.content || accion.detail || 'Nota sin contenido',
      accion.project_id || null,
      accion.tags || [],
      inboxMessageId
    ]
  );
}

async function crearProyecto(accion: Accion) {
  await query(
    `INSERT INTO projects (name, client, budget_amount, currency)
     VALUES ($1, $2, $3, $4)`,
    [
      accion.project_name,
      null,
      accion.budget_amount || null,
      'MXN'
    ]
  );
}

async function crearSubtareas(accion: Accion) {
  if (!accion.target_task_id || !accion.subtasks) return;

  for (let i = 0; i < accion.subtasks.length; i++) {
    await query(
      `INSERT INTO subtasks (task_id, title, position)
       VALUES ($1, $2, $3)`,
      [accion.target_task_id, accion.subtasks[i], i]
    );
  }
}

async function completarTarea(accion: Accion) {
  if (!accion.target_task_id) return;

  await query(
    `UPDATE tasks SET status = 'hecho', completed_at = now()
     WHERE id = $1`,
    [accion.target_task_id]
  );
}
