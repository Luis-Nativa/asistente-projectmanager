import { query } from './db.js';
import { sendTelegramMessage } from './telegram.js';
import { sendReminders, sendBriefingIfNeeded, sendClosingIfNeeded } from './reminders.js';

/**
 * Procesar comandos del bot
 * 
 * @param chatId - ID del chat de Telegram
 * @param text - Texto del mensaje
 * @returns true si se procesó un comando, false si no
 */
export async function procesarComando(chatId: number, text: string): Promise<boolean> {
  const trimmed = text.trim();
  
  // Detectar comandos
  if (trimmed.startsWith('/')) {
    const parts = trimmed.split(' ');
    const command = parts[0].toLowerCase();
    
    switch (command) {
      case '/deshacer':
        await handleDeshacer(chatId);
        return true;
        
      case '/resumen':
        await handleResumen(chatId);
        return true;
        
      case '/hoy':
        await handleHoy(chatId);
        return true;
        
      case '/urgentes':
        await handleUrgentes(chatId);
        return true;
        
      case '/posponer':
        if (parts.length < 3) {
          await sendTelegramMessage(chatId, '❌ Uso: /posponer <id> <fecha>\n\nEjemplo: /posponer abc123 2026-08-20');
          return true;
        }
        await handlePosponer(chatId, parts[1], parts[2]);
        return true;
        
      default:
        // Comando no reconocido, no hacer nada
        return false;
    }
  }
  
  return false;
}

/**
 * /deshacer - Borrar lo creado por el último mensaje
 */
async function handleDeshacer(chatId: number) {
  try {
    // Buscar el último mensaje procesado
    const lastMessage = await query(
      `SELECT id FROM inbox_messages 
       WHERE status = 'procesado' 
       ORDER BY created_at DESC 
       LIMIT 1`,
      []
    );
    
    if (lastMessage.rows.length === 0) {
      await sendTelegramMessage(chatId, '❌ No hay mensajes para deshacer');
      return;
    }
    
    const messageId = lastMessage.rows[0].id;
    
    // Eliminar tareas creadas por este mensaje
    const tasksDeleted = await query(
      `DELETE FROM tasks WHERE source_msg_id = $1 RETURNING id`,
      [messageId]
    );
    
    // Eliminar gastos creados por este mensaje
    const expensesDeleted = await query(
      `DELETE FROM expenses WHERE source_msg_id = $1 RETURNING id`,
      [messageId]
    );
    
    // Eliminar notas creadas por este mensaje
    const notesDeleted = await query(
      `DELETE FROM notes WHERE source_msg_id = $1 RETURNING id`,
      [messageId]
    );
    
    // Marcar el mensaje como deshecho
    await query(
      `UPDATE inbox_messages SET status = 'deshacer' WHERE id = $1`,
      [messageId]
    );
    
    const total = tasksDeleted.rows.length + expensesDeleted.rows.length + notesDeleted.rows.length;
    
    if (total === 0) {
      await sendTelegramMessage(chatId, 'ℹ️ No se encontraron elementos para deshacer');
    } else {
      await sendTelegramMessage(chatId, `✅ Deshecho: ${total} elementos eliminados`);
    }
  } catch (error) {
    console.error('❌ Error en /deshacer:', error);
    await sendTelegramMessage(chatId, '❌ Error al deshacer');
  }
}

/**
 * /resumen - Enviar el briefing manualmente
 */
async function handleResumen(chatId: number) {
  try {
    await sendTelegramMessage(chatId, '⏳ Generando resumen...');
    
    // Construir y enviar el briefing manualmente
    const { buildBriefingMessage } = await import('./reminders.js');
    const briefing = await buildBriefingMessage();
    
    await sendTelegramMessage(chatId, briefing);
  } catch (error) {
    console.error('❌ Error en /resumen:', error);
    await sendTelegramMessage(chatId, '❌ Error al generar resumen');
  }
}

/**
 * /hoy - Enviar tareas de hoy
 */
async function handleHoy(chatId: number) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = await query(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.status IN ('pendiente', 'en_proceso')
         AND t.due_at >= $1 AND t.due_at < $2
       ORDER BY t.priority, t.due_at`,
      [today, tomorrow]
    );
    
    if (result.rows.length === 0) {
      await sendTelegramMessage(chatId, '📅 No hay tareas para hoy');
      return;
    }
    
    const lines = [`📅 *Tareas para hoy (${result.rows.length}):*\n`];
    
    result.rows.forEach((t: any) => {
      const time = new Date(t.due_at).toLocaleTimeString('es-MX', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const priorityEmoji = getPriorityEmoji(t.priority);
      const project = t.project_name ? ` [${t.project_name}]` : '';
      
      lines.push(`${priorityEmoji} ${time} - ${t.title}${project}`);
    });
    
    await sendTelegramMessage(chatId, lines.join('\n'));
  } catch (error) {
    console.error('❌ Error en /hoy:', error);
    await sendTelegramMessage(chatId, '❌ Error al obtener tareas de hoy');
  }
}

/**
 * /urgentes - Enviar tareas urgentes (priority 1)
 */
async function handleUrgentes(chatId: number) {
  try {
    const result = await query(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.status IN ('pendiente', 'en_proceso')
         AND t.priority = 1
       ORDER BY t.due_at NULLS LAST`,
      []
    );
    
    if (result.rows.length === 0) {
      await sendTelegramMessage(chatId, '🔴 No hay tareas urgentes');
      return;
    }
    
    const lines = [`🔴 *Tareas urgentes (${result.rows.length}):*\n`];
    
    result.rows.forEach((t: any) => {
      const project = t.project_name ? ` [${t.project_name}]` : '';
      const dueDate = t.due_at 
        ? new Date(t.due_at).toLocaleDateString('es-MX', { 
            month: 'short', 
            day: 'numeric' 
          })
        : 'sin fecha';
      
      lines.push(`• ${t.title}${project} - ${dueDate}`);
    });
    
    await sendTelegramMessage(chatId, lines.join('\n'));
  } catch (error) {
    console.error('❌ Error en /urgentes:', error);
    await sendTelegramMessage(chatId, '❌ Error al obtener tareas urgentes');
  }
}

/**
 * /posponer <id> <fecha> - Posponer tarea a nueva fecha
 */
async function handlePosponer(chatId: number, taskId: string, newDate: string) {
  try {
    // Validar formato de fecha
    const dateObj = new Date(newDate);
    if (isNaN(dateObj.getTime())) {
      await sendTelegramMessage(chatId, '❌ Fecha inválida. Usa formato YYYY-MM-DD');
      return;
    }
    
    // Buscar la tarea
    const taskResult = await query(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );
    
    if (taskResult.rows.length === 0) {
      // Intentar buscar por los primeros caracteres del ID
      const partialResult = await query(
        `SELECT * FROM tasks WHERE id::text LIKE $1 LIMIT 1`,
        [`${taskId}%`]
      );
      
      if (partialResult.rows.length === 0) {
        await sendTelegramMessage(chatId, '❌ Tarea no encontrada');
        return;
      }
      
      taskId = partialResult.rows[0].id;
    }
    
    // Actualizar la fecha
    await query(
      'UPDATE tasks SET due_at = $1 WHERE id = $2',
      [newDate, taskId]
    );
    
    const formattedDate = dateObj.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    await sendTelegramMessage(chatId, `✅ Tarea pospuesta hasta ${formattedDate}`);
  } catch (error) {
    console.error('❌ Error en /posponer:', error);
    await sendTelegramMessage(chatId, '❌ Error al posponer tarea');
  }
}

/**
 * Obtener emoji de prioridad
 */
function getPriorityEmoji(priority: number): string {
  switch (priority) {
    case 1: return '🔴';
    case 2: return '🟠';
    case 3: return '🔵';
    case 4: return '⚪';
    default: return '⚪';
  }
}

// Exportar función para construir mensaje de briefing (usada en /resumen)
export async function buildBriefingMessage(): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const lines = [`☀️ *Buenos días*\n`];
  lines.push(`📅 ${today.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`);
  
  // Tareas urgentes (priority 1)
  const urgentResult = await query(
    `SELECT * FROM tasks 
     WHERE status IN ('pendiente', 'en_proceso') 
       AND priority = 1 
     ORDER BY due_at NULLS LAST`,
    []
  );
  
  if (urgentResult.rows.length > 0) {
    lines.push(`🔴 *Urgentes (${urgentResult.rows.length}):*`);
    urgentResult.rows.slice(0, 5).forEach((t: any) => {
      lines.push(`  • ${t.title}`);
    });
    if (urgentResult.rows.length > 5) {
      lines.push(`  _...y ${urgentResult.rows.length - 5} más_`);
    }
    lines.push('');
  }
  
  // Tareas vencidas
  const overdueResult = await query(
    `SELECT *, EXTRACT(DAY FROM (now() - due_at)) as days_overdue
     FROM tasks 
     WHERE status IN ('pendiente', 'en_proceso') 
       AND due_at < $1
     ORDER BY due_at`,
    [today]
  );
  
  if (overdueResult.rows.length > 0) {
    lines.push(`⚠️ *Vencidas (${overdueResult.rows.length}):*`);
    overdueResult.rows.slice(0, 5).forEach((t: any) => {
      lines.push(`  • ${t.title} (hace ${Math.floor(t.days_overdue)} días)`);
    });
    lines.push('');
  }
  
  // Tareas de hoy
  const todayResult = await query(
    `SELECT * FROM tasks 
     WHERE status IN ('pendiente', 'en_proceso') 
       AND due_at >= $1 AND due_at < $2
     ORDER BY due_at`,
    [today, tomorrow]
  );
  
  if (todayResult.rows.length > 0) {
    lines.push(`📅 *Hoy (${todayResult.rows.length}):*`);
    todayResult.rows.slice(0, 5).forEach((t: any) => {
      const time = new Date(t.due_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      lines.push(`  • ${time} - ${t.title}`);
    });
    lines.push('');
  }
  
  // Pagos de hoy
  const paymentsResult = await query(
    `SELECT * FROM expenses 
     WHERE status = 'pendiente' 
       AND due_at >= $1 AND due_at < $2
     ORDER BY due_at`,
    [today, tomorrow]
  );
  
  if (paymentsResult.rows.length > 0) {
    lines.push(`💰 *Pagos que tocan hoy (${paymentsResult.rows.length}):*`);
    paymentsResult.rows.slice(0, 5).forEach((e: any) => {
      lines.push(`  • ${e.concept} - $${e.amount.toLocaleString('es-MX')} ${e.currency}`);
    });
    lines.push('');
  }
  
  // Resumen
  const pendingResult = await query(
    `SELECT COUNT(*) as count FROM tasks WHERE status IN ('pendiente', 'en_proceso')`,
    []
  );
  const pendingCount = pendingResult.rows[0].count;
  
  lines.push(`📊 *Resumen:*`);
  lines.push(`  • Tareas pendientes: ${pendingCount}`);
  lines.push(`  • Urgentes: ${urgentResult.rows.length}`);
  lines.push(`  • Vencidas: ${overdueResult.rows.length}`);
  
  return lines.join('\n');
}
