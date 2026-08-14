import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/db.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/tasks/:taskId/comments - Listar comentarios de una tarea
router.get('/tasks/:taskId/comments', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { taskId } = req.params;
    
    // Verificar que la tarea existe y está dentro del scope
    const taskResult = await query(
      `SELECT * FROM tasks WHERE id = $1`,
      [taskId]
    );
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const task = taskResult.rows[0];
    
    // Verificar permisos
    if (task.private && scope.role !== 'owner') {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    if (scope.project_id && task.project_id !== scope.project_id) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const result = await query(
      `SELECT c.*, s.label as author_label
       FROM comments c
       LEFT JOIN shares s ON s.id = c.share_id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId]
    );
    
    res.json({ comments: result.rows });
  } catch (error) {
    console.error('❌ Error en GET /api/tasks/:taskId/comments:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/tasks/:taskId/comments - Crear comentario
router.post('/tasks/:taskId/comments', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { taskId } = req.params;
    const { body } = req.body;
    
    if (!body || body.trim() === '') {
      return res.status(400).json({ error: 'El comentario no puede estar vacío' });
    }
    
    // Verificar que la tarea existe y está dentro del scope
    const taskResult = await query(
      `SELECT * FROM tasks WHERE id = $1`,
      [taskId]
    );
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const task = taskResult.rows[0];
    
    // Verificar permisos
    if (task.private && scope.role !== 'owner') {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    if (scope.project_id && task.project_id !== scope.project_id) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    
    const result = await query(
      `INSERT INTO comments (task_id, share_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [taskId, scope.id, body]
    );
    
    // Registrar en activity
    await query(
      `INSERT INTO activity (share_id, actor_label, entity_type, entity_id, action, detail)
       VALUES ($1, $2, 'comment', $3, 'creo', $4)`,
      [scope.id, scope.label, result.rows[0].id, JSON.stringify({ task_id: taskId, body: body.substring(0, 50) })]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en POST /api/tasks/:taskId/comments:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/comments/:id - Eliminar comentario
router.delete('/comments/:id', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { id } = req.params;
    
    const commentResult = await query(
      `SELECT c.*, t.project_id, t.private
       FROM comments c
       JOIN tasks t ON t.id = c.task_id
       WHERE c.id = $1`,
      [id]
    );
    
    if (commentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }
    
    const comment = commentResult.rows[0];
    
    // Solo el autor o el owner pueden eliminar
    if (comment.share_id !== scope.id && scope.role !== 'owner') {
      return res.status(403).json({ error: 'No autorizado' });
    }
    
    // Verificar scope
    if (comment.private && scope.role !== 'owner') {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }
    if (scope.project_id && comment.project_id !== scope.project_id) {
      return res.status(404).json({ error: 'Comentario no encontrado' });
    }
    
    await query('DELETE FROM comments WHERE id = $1', [id]);
    
    // Registrar en activity
    await query(
      `INSERT INTO activity (share_id, actor_label, entity_type, entity_id, action, detail)
       VALUES ($1, $2, 'comment', $3, 'elimino', $4)`,
      [scope.id, scope.label, id, JSON.stringify({ task_id: comment.task_id })]
    );
    
    res.status(204).send();
  } catch (error) {
    console.error('❌ Error en DELETE /api/comments/:id:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
