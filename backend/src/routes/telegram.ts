import { Router, Request, Response } from 'express';
import { sendTelegramMessage } from '../services/telegram.js';
import { saveInboxMessage, query } from '../services/db.js';
import { parseMessage, type ParserContext } from '../services/gemini.js';
import { executeActions } from '../services/executor.js';
import { procesarConsulta, esConsulta } from '../services/consultas.js';
import { procesarComando } from '../services/comandos.js';

const router = Router();

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // 1. Validar secret_token de Telegram
    const secretToken = req.headers['x-telegram-bot-api-secret-token'];
    if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn('⚠️ Secret token inválido');
      return res.status(403).json({ error: 'Invalid secret token' });
    }

    // 2. Extraer mensaje
    const message = req.body.message;
    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const msgId = message.message_id;
    const text = message.text;

    // 3. Validar que el chat.id sea el autorizado
    const ownerChatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
    if (chatId !== ownerChatId) {
      console.warn(`⚠️ Chat no autorizado: ${chatId}`);
      return res.status(200).json({ ok: true });
    }

    // 4. Solo procesar mensajes de texto (por ahora)
    if (!text) {
      await sendTelegramMessage(chatId, '⚠️ Por ahora solo puedo procesar mensajes de texto. Las notas de voz vienen en la Fase 11.');
      return res.status(200).json({ ok: true });
    }

    // 5. Guardar en inbox_messages
    const inboxId = await saveInboxMessage(msgId, text);
    console.log(`✅ Mensaje guardado en inbox: ${inboxId}`);

    // 6. Responder inmediatamente
    await sendTelegramMessage(chatId, '⏳ Procesando...');

    // 7. Detectar si es un comando
    if (text.startsWith('/')) {
      const esComando = await procesarComando(chatId, text);
      if (esComando) {
        return res.status(200).json({ ok: true });
      }
    }

    // 8. Detectar si es una consulta
    if (esConsulta(text)) {
      console.log(`🤔 Detectada consulta: "${text}"`);
      const answer = await procesarConsulta(text);
      await sendTelegramMessage(chatId, `💬 ${answer}`);
      return res.status(200).json({ ok: true });
    }

    // 9. Construir contexto para el parser
    const context = await buildContext();

    // 10. Parsear mensaje con Gemini
    let result;
    try {
      result = await parseMessage(text, context);
      console.log(`🤖 Parser generó ${result.acciones.length} acciones`);
    } catch (parseError) {
      console.error('❌ Error en parseMessage:', parseError);
      await sendTelegramMessage(chatId, `❌ Error del parser: ${parseError instanceof Error ? parseError.message : 'Error desconocido'}`);
      return res.status(200).json({ ok: true });
    }

    // 11. Ejecutar acciones y recopilar resultados
    let results;
    try {
      results = await executeActions(result.acciones, inboxId);
    } catch (execError) {
      console.error('❌ Error en executeActions:', execError);
      await sendTelegramMessage(chatId, `❌ Error ejecutando acciones: ${execError instanceof Error ? execError.message : 'Error desconocido'}`);
      return res.status(200).json({ ok: true });
    }

    // 12. Verificar si hay dudas que enviar por Telegram
    const dudas = result.acciones
      .filter((accion: any) => accion.tipo === 'consulta' && accion.duda)
      .map((accion: any) => accion.duda);

    // 13. Construir mensaje de respuesta
    let mensaje = '';
    if (results.length > 0) {
      mensaje += `✅ Procesado:\n\n${results.join('\n')}`;
    }

    // 14. Si hay dudas, agregarlas al mensaje
    if (dudas.length > 0) {
      const mensajeDudas = `❓ Necesito más información:\n\n${dudas.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}`;
      
      if (mensaje) {
        mensaje += `\n\n${mensajeDudas}`;
      } else {
        mensaje = mensajeDudas;
      }
    }

    // 15. Enviar mensaje final (o mensaje por defecto si no hay nada que reportar)
    if (!mensaje) {
      mensaje = '✅ Recibido';
    }

    await sendTelegramMessage(chatId, mensaje);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    const chatId = req.body.message?.chat?.id;
    if (chatId) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
      await sendTelegramMessage(chatId, `❌ Error procesando el mensaje: ${errorMsg}`);
    }
    res.status(200).json({ ok: true }); // Siempre responder 200 a Telegram
  }
});

async function buildContext(): Promise<ParserContext> {
  // Fecha actual en ISO 8601
  const ahora_iso = new Date().toISOString();

  // Proyectos existentes
  const proyectosResult = await query(
    `SELECT id, name, client FROM projects WHERE archived_at IS NULL`
  );
  const proyectos_existentes = proyectosResult.rows;

  // Tareas abiertas recientes (últimas 30)
  const tareasResult = await query(
    `SELECT id, title FROM tasks 
     WHERE status IN ('pendiente', 'en_proceso') 
     ORDER BY created_at DESC 
     LIMIT 30`
  );
  const tareas_abiertas_recientes = tareasResult.rows;

  return {
    ahora_iso,
    proyectos_existentes,
    tareas_abiertas_recientes
  };
}

export default router;
