import { Request, Response, NextFunction } from 'express';
import { verifyToken, getShareById, type Share } from '../services/auth.js';

declare global {
  namespace Express {
    interface Request {
      scope?: Share;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Extraer JWT del header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 2. Validar JWT
    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o vencido' });
    }
    
    // 3. Recargar share desde BD (no confiar en el payload)
    let share;
    try {
      share = await getShareById(payload.share_id);
    } catch (err) {
      return res.status(401).json({ error: 'Enlace inválido o revocado' });
    }
    
    // 4. Adjuntar scope
    req.scope = share;
    
    next();
  } catch (error) {
    console.error('❌ Error en authMiddleware:', error);
    res.status(500).json({ error: 'Error interno' });
  }
}
