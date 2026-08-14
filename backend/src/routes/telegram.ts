import { Router, Request, Response } from 'express';
import { sendTelegramMessage } from '../services/telegram.js';
import { saveInboxMessage, query } from '../services/db.js';
import { parseMessage, type ParserContext } from '../services/gemini.js';
import { executeActions } from '../services/executor.js';
import { procesarConsulta, esConsulta } from '../services/consultas.js';
import { procesarComando } from '../services/comandos.js';
import { handleVincularCommand, findShareByChatId } from '../services/vinculation.js';
import { processVoiceNote } from '../services/voice.js';

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
    const voice = message.voice;
    const audio = message.audio;

    // 3. Determinar si es el owner o un colaborador vinculado
    const ownerChatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
    const isOwner = chatId === ownerChatId;
    
    // Si no es el owner, buscar si está vinculado
    let share = null;
    if (!isOwner) {
      share = await findShareByChatId(chatId);
      
      // Si no está vinculado y no es el owner, ignorar
      if (!share) {
        console.warn(`⚠️ Chat no autorizado: ${chatId}`);
        return res.status(200).json({ ok: true });
      }
    }

    // 4. Manejar notas de voz y audio
    if (voice || audio) {
      const fileId = voice ? voice.file_id : audio.file_id;
      const duration = voice ? voice.duration : audio.duration;
      
      // Validar duración (máximo 25 minutos)
      if (duration > 25 * 60) {
        await sendTelegramMessage(chatId, '⚠️ El audio es demasiado largo (máximo 25 minutos). Por favor, divide el audio en partes más pequeñas.');
        return res.status(200).json({ ok: true });
      }
      
      // Guardar mensaje en inbox
      const inboxId = await saveInboxMessage(msgId, null);
      console.log(`✅ Nota de voz guardada en inbox: ${inboxId}`);
      
      // Responder inmediatamente
      await sendTelegramMessage(chatId, '🎤 Procesando nota de voz...');
      
      try {
        // Procesar nota de voz (descargar, transcribir, guardar)
        const transcription = await processVoiceNote(fileId, inboxId);
        
        // Parsear transcripción
        const context = await buildContext(share?.project_id);
        const result = await parseMessage(transcription, context);
        
        console.log(`🤖 Parser generó ${result.acciones.length} acciones de nota de voz`);
        
        // Si es colaborador, forzar project_id del share
        if (share && share.project_id) {
          result.acciones = result.acciones.map((accion: any) => {
            if (accion.tipo === 'crear_tarea' || accion.tipo === 'crear_gasto' || accion.tipo === 'crear_nota') {
              return { ...accion, project_id: share.project_id };
            }
            return accion;
          });
        }
        
        // Ejecutar acciones
        const results = await executeActions(result.acciones, inboxId);
        
        // Construir mensaje de respuesta
        let mensaje = `✅ Nota de voz procesada:\n\n${results.join('\n')}`;
        
        // Agregar dudas si las hay
        const dudas = result.acciones
          .filter((accion: any) => accion.tipo === 'consulta' && accion.duda)
          .map((accion: any) => accion.duda);
        
        if (dudas.length > 0) {
          mensaje += `\n\n❓ Necesito más información:\n\n${dudas.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}`;
        }
        
        await sendTelegramMessage(chatId, mensaje);
      } catch (error) {
        console.error('❌ Error procesando nota de voz:', error);
        await sendTelegramMessage(chatId, '❌ Error al procesar la nota de voz. Por favor, intenta de nuevo.');
      }
      
      return res.status(200).json({ ok: true });
    }

    // 5. Solo procesar mensajes de texto
    if (!text) {
      await sendTelegramMessage(chatId, '⚠️ Solo puedo procesar mensajes de texto y notas de voz.');
      return res.status(200).json({ ok: true });
    }

    // 5. Manejar comando /vincular (solo para colaboradores)
    if (!isOwner && text.trim().startsWith('/vincular')) {
      await handleVincularCommand(chatId, text);
      return res.status(200).json({ ok: true });
    }

    // 6. Guardar en inbox_messages
    const inboxId = await saveInboxMessage(msgId, text);
    console.log(`✅ Mensaje guardado en inbox: ${inboxId} (de ${isOwner ? 'owner' : share.label})`);

    // 7. Responder inmediatamente
    await sendTelegramMessage(chatId, '⏳ Procesando...');

    // 8. Detectar si es un comando
    if (text.startsWith('/')) {
      const esComando = await procesarComando(chatId, text);
      if (esComando) {
        return res.status(200).json({ ok: true });
      }
    }

    // 9. Detectar si es una consulta
    if (esConsulta(text)) {
      console.log(`🤔 Detectada consulta: "${text}"`);
      const answer = await procesarConsulta(text);
      await sendTelegramMessage(chatId, `💬 ${answer}`);
      return res.status(200).json({ ok: true });
    }

    // 10. Construir contexto para el parser
    const context = await buildContext(share?.project_id);

    // 11. Parsear mensaje con Gemini
    let result;
    try {
      result = await parseMessage(text, context);
      console.log(`🤖 Parser generó ${result.acciones.length} acciones`);
    } catch (parseError) {
      console.error('❌ Error en parseMessage:', parseError);
      await sendTelegramMessage(chatId, `❌ Error del parser: ${parseError instanceof Error ? parseError.message : 'Error desconocido'}`);
      return res.status(200).json({ ok: true });
    }

    // 12. Si es colaborador, forzar project_id del share
    if (share && share.project_id) {
      result.acciones = result.acciones.map((accion: any) => {
        if (accion.tipo === 'crear_tarea' || accion.tipo === 'crear_gasto' || accion.tipo === 'crear_nota') {
          return { ...accion, project_id: share.project_id };
        }
        return accion;
      });
    }

    // 13. Ejecutar acciones y recopilar resultados
    let results;
    try {
      results = await executeActions(result.acciones, inboxId);
    } catch (execError) {
      console.error('❌ Error en executeActions:', execError);
      await sendTelegramMessage(chatId, `❌ Error ejecutando acciones: ${execError instanceof Error ? execError.message : 'Error desconocido'}`);
      return res.status(200).json({ ok: true });
    }

    // 14. Verificar si hay dudas que enviar por Telegram
    const dudas = result.acciones
      .filter((accion: any) => accion.tipo === 'consulta' && accion.duda)
      .map((accion: any) => accion.duda);

    // 15. Construir mensaje de respuesta
    let mensaje = '';
    if (results.length > 0) {
      mensaje += `✅ Procesado:\n\n${results.join('\n')}`;
    }

    // 16. Si hay dudas, agregarlas al mensaje
    if (dudas.length > 0) {
      const mensajeDudas = `❓ Necesito más información:\n\n${dudas.map((d: string, i: number) => `${i + 1}. ${d}`).join('\n')}`;
      
      if (mensaje) {
        mensaje += `\n\n${mensajeDudas}`;
      } else {
        mensaje = mensajeDudas;
      }
    }

    // 17. Enviar mensaje final (o mensaje por defecto si no hay nada que reportar)
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

async function buildContext(projectId?: string | null): Promise<ParserContext> {
  // Fecha actual en ISO 8601
  const ahora_iso = new Date().toISOString();

  // Proyectos existentes (filtrado por project_id si se proporciona)
  let proyectosQuery = `SELECT id, name, client FROM projects WHERE archived_at IS NULL`;
  const proyectosParams: any[] = [];
  
  if (projectId) {
    proyectosQuery += ` AND id = $1`;
    proyectosParams.push(projectId);
  }
  
  const proyectosResult = await query(proyectosQuery, proyectosParams);
  const proyectos_existentes = proyectosResult.rows;

  // Tareas abiertas recientes (últimas 30, filtrado por project_id si se proporciona)
  let tareasQuery = `SELECT id, title FROM tasks WHERE status IN ('pendiente', 'en_proceso')`;
  const tareasParams: any[] = [];
  
  if (projectId) {
    tareasQuery += ` AND project_id = $1`;
    tareasParams.push(projectId);
  }
  
  tareasQuery += ` ORDER BY created_at DESC LIMIT 30`;
  
  const tareasResult = await query(tareasQuery, tareasParams);
  const tareas_abiertas_recientes = tareasResult.rows;

  return {
    ahora_iso,
    proyectos_existentes,
    tareas_abiertas_recientes
  };
}

export default router;
