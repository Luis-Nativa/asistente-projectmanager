import { Router, Request, Response } from 'express';
import { authenticatePin, refreshAccessToken } from '../services/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limit: 5 intentos por IP cada 15 minutos
const pinRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/pin
router.post('/pin', pinRateLimit, async (req: Request, res: Response) => {
  try {
    const { slug, pin } = req.body;
    
    if (!slug || !pin) {
      return res.status(400).json({ error: 'slug y pin son requeridos' });
    }
    
    const result = await authenticatePin(slug, pin);
    
    res.json({
      token: result.token,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      share: {
        id: result.share.id,
        label: result.share.label,
        role: result.share.role,
        project_id: result.share.project_id
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    res.status(401).json({ error: message });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken es requerido' });
    }
    
    const result = await refreshAccessToken(refreshToken);
    
    res.json({
      token: result.token,
      expiresIn: result.expiresIn
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    res.status(401).json({ error: message });
  }
});

export default router;
