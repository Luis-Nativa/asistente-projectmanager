import { query } from './db.js';
import { sendTelegramMessage } from './telegram.js';
import crypto from 'crypto';

// Almacenamiento temporal de códigos de vinculación (en memoria)
// En producción, usar Redis o similar
const vinculationCodes = new Map<string, { shareId: string; expiresAt: number }>();

/**
 * Generar código de vinculación para un share
 */
export async function generateVinculationCode(shareId: string): Promise<string> {
  // Generar código de 6 dígitos
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Expira en 10 minutos
  const expiresAt = Date.now() + 10 * 60 * 1000;
  
  vinculationCodes.set(code, { shareId, expiresAt });
  
  // Limpiar códigos expirados
  const now = Date.now();
  for (const [key, value] of vinculationCodes.entries()) {
    if (value.expiresAt < now) {
      vinculationCodes.delete(key);
    }
  }
  
  return code;
}

/**
 * Vincular chat de Telegram a un share
 */
export async function vinculateTelegramChat(chatId: number, code: string): Promise<boolean> {
  const vinculation = vinculationCodes.get(code);
  
  if (!vinculation || vinculation.expiresAt < Date.now()) {
    return false;
  }
  
  // Actualizar share con tg_chat_id
  await query(
    'UPDATE shares SET tg_chat_id = $1 WHERE id = $2',
    [chatId, vinculation.shareId]
  );
  
  // Eliminar código usado
  vinculationCodes.delete(code);
  
  return true;
}

/**
 * Buscar share por chat_id de Telegram
 */
export async function findShareByChatId(chatId: number): Promise<any | null> {
  const result = await query(
    `SELECT s.*, p.name as project_name
     FROM shares s
     LEFT JOIN projects p ON p.id = s.project_id
     WHERE s.tg_chat_id = $1
       AND s.revoked_at IS NULL
       AND (s.expires_at IS NULL OR s.expires_at > now())`,
    [chatId]
  );
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Procesar comando /vincular
 */
export async function handleVincularCommand(chatId: number, text: string): Promise<void> {
  const parts = text.trim().split(/\s+/);
  
  if (parts.length < 2) {
    await sendTelegramMessage(chatId, '❌ Uso: /vincular <código>\n\nEjemplo: /vincular 123456');
    return;
  }
  
  const code = parts[1];
  
  if (!/^\d{6}$/.test(code)) {
    await sendTelegramMessage(chatId, '❌ El código debe tener 6 dígitos');
    return;
  }
  
  const success = await vinculateTelegramChat(chatId, code);
  
  if (success) {
    await sendTelegramMessage(chatId, '✅ ¡Vinculación exitosa!\n\nAhora puedes enviar mensajes para crear tareas en tu proyecto asignado.');
  } else {
    await sendTelegramMessage(chatId, '❌ Código inválido o expirado.\n\nPide a tu administrador que genere un nuevo código.');
  }
}

/**
 * Notificar al owner cuando un colaborador completa una tarea
 */
export async function notifyOwnerOfCompletion(share: any, taskTitle: string): Promise<void> {
  const ownerChatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
  
  if (!ownerChatId) return;
  
  const message = `🔔 *${share.label}* completó una tarea:\n\n${taskTitle}`;
  
  await sendTelegramMessage(ownerChatId, message);
}

/**
 * Enviar briefing personalizado a colaborador
 */
export async function sendCollaboratorBriefing(share: any): Promise<void> {
  if (!share.tg_chat_id) return;
  
  const projectId = share.project_id;
  
  // Obtener tareas del proyecto asignado
  const tasksResult = await query(
    `SELECT t.*, p.name as project_name
     FROM tasks t
     LEFT JOIN projects p ON p.id = t.project_id
     WHERE t.project_id = $1
       AND t.status IN ('pendiente', 'en_proceso')
       AND t.confirmed = true
     ORDER BY t.priority, t.due_at NULLS LAST
     LIMIT 10`,
    [projectId]
  );
  
  if (tasksResult.rows.length === 0) {
    await sendTelegramMessage(share.tg_chat_id, '☀️ ¡Buenos días!\n\nNo tienes tareas pendientes en tu proyecto.');
    return;
  }
  
  const lines = [`☀️ ¡Buenos días, ${share.label}!\n`];
  lines.push(`📋 Tareas pendientes en *${share.project_name}*:\n`);
  
  tasksResult.rows.forEach((task: any, index: number) => {
    const priorityEmoji = task.priority === 1 ? '🔴' : task.priority === 2 ? '🟠' : '🔵';
    const dueDate = task.due_at 
      ? new Date(task.due_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
      : 'sin fecha';
    
    lines.push(`${index + 1}. ${priorityEmoji} ${task.title} - ${dueDate}`);
  });
  
  lines.push(`\n💡 Total: ${tasksResult.rows.length} tareas`);
  
  await sendTelegramMessage(share.tg_chat_id, lines.join('\n'));
}
