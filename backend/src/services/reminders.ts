import { query } from './db.js';
import { sendTelegramMessage } from './telegram.js';

/**
 * Enviar recordatorios de tareas pendientes
 * Busca tareas con remind_at <= now() y reminded_at IS NULL
 */
export async function sendReminders(): Promise<number> {
  try {
    const result = await query(
      `SELECT t.*, p.name as project_name
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.remind_at <= now()
         AND t.reminded_at IS NULL
         AND t.status IN ('pendiente', 'en_proceso')
         AND t.confirmed = true
       ORDER BY t.remind_at`,
      []
    );
    
    const tasks = result.rows;
    
    if (tasks.length === 0) {
      console.log('📭 No hay recordatorios pendientes');
      return 0;
    }
    
    console.log(`📬 Enviando ${tasks.length} recordatorios...`);
    
    const chatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
    let sentCount = 0;
    
    for (const task of tasks) {
      try {
        const message = buildReminderMessage(task);
        await sendTelegramMessage(chatId, message);
        
        // Marcar como recordado
        await query(
          'UPDATE tasks SET reminded_at = now() WHERE id = $1',
          [task.id]
        );
        
        sentCount++;
        console.log(`✅ Recordatorio enviado: ${task.title}`);
      } catch (error) {
        console.error(`❌ Error enviando recordatorio para tarea ${task.id}:`, error);
      }
    }
    
    return sentCount;
  } catch (error) {
    console.error('❌ Error en sendReminders:', error);
    return 0;
  }
}

/**
 * Enviar briefing matutino (7:00 AM)
 * Solo se envía una vez al día
 */
export async function sendBriefingIfNeeded(): Promise<boolean> {
  try {
    const now = new Date();
    const hour = now.getHours();
    
    // Solo enviar entre 7:00 y 7:59
    if (hour !== 7) {
      return false;
    }
    
    // Verificar si ya se envió hoy
    const flagResult = await query(
      "SELECT value FROM system_flags WHERE key = 'last_briefing_date'",
      []
    );
    
    const lastDate = flagResult.rows[0]?.value;
    const today = now.toISOString().split('T')[0];
    
    if (lastDate === today) {
      console.log('📭 Briefing ya enviado hoy');
      return false;
    }
    
    console.log('📬 Enviando briefing matutino...');
    
    const chatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
    const briefing = await buildBriefingMessage();
    
    await sendTelegramMessage(chatId, briefing);
    
    // Actualizar flag
    await query(
      "UPDATE system_flags SET value = $1 WHERE key = 'last_briefing_date'",
      [today]
    );
    
    console.log('✅ Briefing enviado');
    return true;
  } catch (error) {
    console.error('❌ Error en sendBriefingIfNeeded:', error);
    return false;
  }
}

/**
 * Enviar cierre nocturno (21:00)
 * Solo se envía una vez al día
 */
export async function sendClosingIfNeeded(): Promise<boolean> {
  try {
    const now = new Date();
    const hour = now.getHours();
    
    // Solo enviar entre 21:00 y 21:59
    if (hour !== 21) {
      return false;
    }
    
    // Verificar si ya se envió hoy
    const flagResult = await query(
      "SELECT value FROM system_flags WHERE key = 'last_closing_date'",
      []
    );
    
    const lastDate = flagResult.rows[0]?.value;
    const today = now.toISOString().split('T')[0];
    
    if (lastDate === today) {
      console.log('📭 Cierre ya enviado hoy');
      return false;
    }
    
    console.log('📬 Enviando cierre nocturno...');
    
    const chatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
    const closing = await buildClosingMessage();
    
    await sendTelegramMessage(chatId, closing);
    
    // Actualizar flag
    await query(
      "UPDATE system_flags SET value = $1 WHERE key = 'last_closing_date'",
      [today]
    );
    
    console.log('✅ Cierre enviado');
    return true;
  } catch (error) {
    console.error('❌ Error en sendClosingIfNeeded:', error);
    return false;
  }
}

/**
 * Construir mensaje de recordatorio
 */
function buildReminderMessage(task: any): string {
  const lines = ['⏰ *Recordatorio*\n'];
  
  lines.push(`*${task.title}*`);
  
  if (task.project_name) {
    lines.push(`📁 Proyecto: ${task.project_name}`);
  }
  
  if (task.due_at) {
    const dueDate = new Date(task.due_at);
    const formatted = dueDate.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    lines.push(`📅 Fecha: ${formatted}`);
  }
  
  if (task.detail) {
    lines.push(`\n${task.detail}`);
  }
  
  const priorityEmoji = getPriorityEmoji(task.priority);
  lines.push(`\n${priorityEmoji} Prioridad: ${getPriorityLabel(task.priority)}`);
  
  return lines.join('\n');
}

/**
 * Construir mensaje de briefing matutino
 */
async function buildBriefingMessage(): Promise<string> {
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
  
  lines.push(`\n💡 _Usa /hoy para ver todas las tareas de hoy_`);
  lines.push(`💡 _Usa /urgentes para ver tareas urgentes_`);
  
  return lines.join('\n');
}

/**
 * Construir mensaje de cierre nocturno
 */
async function buildClosingMessage(): Promise<string> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const lines = [`🌙 *Resumen del día*\n`];
  
  // Tareas completadas hoy
  const completedResult = await query(
    `SELECT COUNT(*) as count FROM tasks 
     WHERE status = 'hecho' 
       AND completed_at >= $1`,
    [today]
  );
  const completedCount = completedResult.rows[0].count;
  
  // Tareas pendientes
  const pendingResult = await query(
    `SELECT COUNT(*) as count FROM tasks 
     WHERE status IN ('pendiente', 'en_proceso')`,
    []
  );
  const pendingCount = pendingResult.rows[0].count;
  
  // Tareas vencidas
  const overdueResult = await query(
    `SELECT COUNT(*) as count FROM tasks 
     WHERE status IN ('pendiente', 'en_proceso') 
       AND due_at < $1`,
    [today]
  );
  const overdueCount = overdueResult.rows[0].count;
  
  lines.push(`✅ *Completadas:* ${completedCount}`);
  lines.push(`⏳ *Pendientes:* ${pendingCount}`);
  lines.push(`⚠️ *Vencidas:* ${overdueCount}`);
  
  // Próximas tareas para mañana
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
  
  const tomorrowResult = await query(
    `SELECT * FROM tasks 
     WHERE status IN ('pendiente', 'en_proceso') 
       AND due_at >= $1 AND due_at < $2
     ORDER BY priority, due_at
     LIMIT 5`,
    [tomorrow, dayAfterTomorrow]
  );
  
  if (tomorrowResult.rows.length > 0) {
    lines.push(`\n📅 *Pendientes para mañana:*`);
    tomorrowResult.rows.forEach((t: any) => {
      const priorityEmoji = getPriorityEmoji(t.priority);
      lines.push(`  ${priorityEmoji} ${t.title}`);
    });
  }
  
  lines.push(`\n💡 _Usa /resumen para ver el briefing completo_`);
  lines.push(`💡 _Usa /posponer <id> <fecha> para posponer tareas_`);
  
  return lines.join('\n');
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

/**
 * Obtener label de prioridad
 */
function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 1: return 'Urgente';
    case 2: return 'Alta';
    case 3: return 'Normal';
    case 4: return 'Baja';
    default: return 'Normal';
  }
}
