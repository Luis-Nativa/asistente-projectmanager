import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/db.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/projects/:id/review - Modo revisión
router.get('/projects/:id/review', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { id } = req.params;
    const { since } = req.query; // Fecha desde la última revisión
    
    // Verificar que el proyecto existe y está dentro del scope
    const projectResult = await query(
      `SELECT * FROM projects WHERE id = $1`,
      [id]
    );
    
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
    
    const project = projectResult.rows[0];
    
    // Verificar permisos
    if (scope.project_id && scope.project_id !== id) {
      return res.status(403).json({ error: 'No autorizado para este proyecto' });
    }
    
    // 1. Tareas cerradas desde la última revisión
    let closedTasksQuery = `
      SELECT t.*, t.completed_by, t.completed_at
      FROM tasks t
      WHERE t.project_id = $1
        AND t.status = 'hecho'
    `;
    const closedTasksParams: any[] = [id];
    
    if (since) {
      closedTasksQuery += ` AND t.completed_at >= $2`;
      closedTasksParams.push(since);
    }
    
    closedTasksQuery += ` ORDER BY t.completed_at DESC`;
    
    const closedTasksResult = await query(closedTasksQuery, closedTasksParams);
    
    // 2. Tareas vencidas
    const overdueTasksResult = await query(
      `SELECT t.*, 
              EXTRACT(DAY FROM (now() - t.due_at)) as days_overdue
       FROM tasks t
       WHERE t.project_id = $1
         AND t.status IN ('pendiente', 'en_proceso')
         AND t.due_at < now()
       ORDER BY t.due_at ASC`,
      [id]
    );
    
    // 3. Tareas estancadas (abiertas hace más de 14 días sin actividad)
    const stalledTasksResult = await query(
      `SELECT t.*,
              EXTRACT(DAY FROM (now() - t.created_at)) as days_since_created,
              (SELECT MAX(created_at) FROM activity 
               WHERE entity_type = 'task' AND entity_id = t.id) as last_activity
       FROM tasks t
       WHERE t.project_id = $1
         AND t.status IN ('pendiente', 'en_proceso')
         AND t.created_at < now() - interval '14 days'
         AND (
           NOT EXISTS (
             SELECT 1 FROM activity 
             WHERE entity_type = 'task' AND entity_id = t.id
             AND created_at > now() - interval '14 days'
           )
         )
       ORDER BY t.created_at ASC`,
      [id]
    );
    
    // 4. Próximas 7 días
    const upcomingTasksResult = await query(
      `SELECT t.*
       FROM tasks t
       WHERE t.project_id = $1
         AND t.status IN ('pendiente', 'en_proceso')
         AND t.due_at >= now()
         AND t.due_at < now() + interval '7 days'
       ORDER BY t.due_at ASC`,
      [id]
    );
    
    // 5. Actualizar last_review_at
    await query(
      `UPDATE projects SET last_review_at = now() WHERE id = $1`,
      [id]
    );
    
    res.json({
      project: {
        id: project.id,
        name: project.name,
        last_review_at: project.last_review_at
      },
      closed_since_last_review: closedTasksResult.rows,
      overdue: overdueTasksResult.rows,
      stalled: stalledTasksResult.rows,
      upcoming_7_days: upcomingTasksResult.rows
    });
  } catch (error) {
    console.error('❌ Error en GET /api/projects/:id/review:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
