import { Router, Request, Response } from 'express';
import { sendTelegramMessage } from '../services/telegram.js';
import { saveInboxMessage } from '../services/db.js';

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

    // 6. Responder al usuario
    await sendTelegramMessage(chatId, `✅ Recibido (ID: ${inboxId})\n\n"${text}"\n\n🔄 Parser viene en la Fase 2...`);

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.status(200).json({ ok: true }); // Siempre responder 200 a Telegram
  }
});

export default router;
