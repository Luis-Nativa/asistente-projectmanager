import { Router, Request, Response } from 'express';
import { sendReminders, sendBriefingIfNeeded, sendClosingIfNeeded } from '../services/reminders.js';

const router = Router();

/**
 * POST /internal/tick
 * Endpoint llamado por cron-job.org cada 5 minutos
 * Requiere header X-Cron-Secret para autenticación
 */
router.post('/tick', async (req: Request, res: Response) => {
  try {
    // Validar CRON_SECRET
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET) {
      console.warn('⚠️ Intento de acceso no autorizado a /internal/tick');
      return res.status(403).json({ error: 'Invalid secret' });
    }
    
    console.log('⏰ Ejecutando tick de cron...');
    
    // Ejecutar las tres funciones
    const [remindersSent, briefingSent, closingSent] = await Promise.all([
      sendReminders(),
      sendBriefingIfNeeded(),
      sendClosingIfNeeded()
    ]);
    
    console.log(`✅ Tick completado: ${remindersSent} recordatorios, briefing=${briefingSent}, cierre=${closingSent}`);
    
    res.status(200).json({ 
      ok: true, 
      remindersSent, 
      briefingSent, 
      closingSent 
    });
  } catch (error) {
    console.error('❌ Error en POST /internal/tick:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
