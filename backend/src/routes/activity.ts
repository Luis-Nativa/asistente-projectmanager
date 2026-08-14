import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/db.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/activity - Listar actividad (filtrado por scope)
router.get('/', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { limit = '50', entity_type, entity_id } = req.query;
    
    let queryText = `
      SELECT a.*, s.label as actor_label
      FROM activity a
      LEFT JOIN shares s ON s.id = a.share_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;
    
    // Filtrar por scope (solo ver actividad de proyectos accesibles)
    if (scope.project_id) {
      queryText += ` AND (
        (a.entity_type = 'project' AND a.entity_id = $${paramCount})
        OR (a.entity_type IN ('task', 'subtask', 'expense', 'note') 
            AND a.entity_id IN (
              SELECT id FROM tasks WHERE project_id = $${paramCount}
              UNION SELECT id FROM expenses WHERE project_id = $${paramCount}
              UNION SELECT id FROM notes WHERE project_id = $${paramCount}
            ))
      )`;
      params.push(scope.project_id);
      paramCount++;
    }
    
    // Filtrar por tipo de entidad
    if (entity_type) {
      queryText += ` AND a.entity_type = $${paramCount}`;
      params.push(entity_type);
      paramCount++;
    }
    
    // Filtrar por ID de entidad
    if (entity_id) {
      queryText += ` AND a.entity_id = $${paramCount}`;
      params.push(entity_id);
      paramCount++;
    }
    
    queryText += ` ORDER BY a.created_at DESC LIMIT $${paramCount}`;
    params.push(parseInt(limit as string));
    
    const result = await query(queryText, params);
    
    res.json({ activity: result.rows });
  } catch (error) {
    console.error('❌ Error en GET /api/activity:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
