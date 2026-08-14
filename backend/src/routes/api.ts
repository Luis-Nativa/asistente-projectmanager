import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/db.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/dashboard
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    
    // Obtener proyectos (con conteo de tareas, espejo de GET /api/projects)
    const projectsQuery = scope.project_id
      ? `SELECT p.*,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status <> 'cancelado') as tasks_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status IN ('pendiente', 'en_proceso')) as tasks_pending
         FROM projects p WHERE p.id = $1 AND p.archived_at IS NULL`
      : `SELECT p.*,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status <> 'cancelado') as tasks_count,
          (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status IN ('pendiente', 'en_proceso')) as tasks_pending
         FROM projects p WHERE p.archived_at IS NULL`;
    
    const projectsResult = await query(projectsQuery, scope.project_id ? [scope.project_id] : []);
    const projects = projectsResult.rows;
    
    // Calcular presupuesto ejercido para cada proyecto
    const projectsWithBudget = await Promise.all(
      projects.map(async (p) => {
        if (!scope.can_see_money) {
          return { ...p };
        }
        
        const budgetResult = await query(
          `SELECT 
            COALESCE(SUM(amount), 0) as spent
           FROM expenses 
           WHERE project_id = $1 AND status = 'pagado' AND kind = 'gasto'`,
          [p.id]
        );
        
        const spent = parseFloat(budgetResult.rows[0].spent);
        const budget = p.budget_amount ? parseFloat(p.budget_amount) : null;
        
        return {
          ...p,
          budget_amount: budget,
          spent,
          remaining: budget ? budget - spent : null
        };
      })
    );
    
    // Obtener todas las tareas pendientes (no solo las de hoy)
    const tasksPendingResult = await query(
      `SELECT t.*, p.name as project_name 
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.status IN ('pendiente', 'en_proceso')
         AND ($1::uuid IS NULL OR t.project_id = $1)
         AND ($2::boolean OR t.private = false)
       ORDER BY t.due_at NULLS LAST, t.priority`,
      [scope.project_id, scope.role === 'owner']
    );
    
    // Definir fecha actual para tareas vencidas
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Obtener tareas vencidas
    const tasksOverdueResult = await query(
      `SELECT t.*, p.name as project_name,
              EXTRACT(DAY FROM (now() - t.due_at)) as days_overdue
       FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id
       WHERE t.status IN ('pendiente', 'en_proceso')
         AND t.due_at < $1
         AND ($2::uuid IS NULL OR t.project_id = $2)
         AND ($3::boolean OR t.private = false)
       ORDER BY t.due_at`,
      [today, scope.project_id, scope.role === 'owner']
    );
    
    // Obtener gastos pendientes
    const expensesPendingResult = await query(
      `SELECT e.*, p.name as project_name
       FROM expenses e
       LEFT JOIN projects p ON p.id = e.project_id
       WHERE e.status = 'pendiente'
         AND ($1::uuid IS NULL OR e.project_id = $1)
       ORDER BY e.due_at NULLS LAST`,
      [scope.project_id]
    );
    
    res.json({
      projects: projectsWithBudget,
      tasks_pending: tasksPendingResult.rows,
      tasks_overdue: tasksOverdueResult.rows,
      expenses_pending: scope.can_see_money ? expensesPendingResult.rows : []
    });
  } catch (error) {
    console.error('❌ Error en GET /api/dashboard:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/tasks
router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { status, project_id, from, to } = req.query;
    
    // Validar que project_id del query coincida con scope
    if (project_id && scope.project_id && project_id !== scope.project_id) {
      return res.status(403).json({ error: 'No autorizado para este proyecto' });
    }
    
    let queryText = `
      SELECT t.*, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;
    
    // Filtrar por scope
    params.push(scope.project_id || null);
    queryText += ` AND ($${paramCount}::uuid IS NULL OR t.project_id = $${paramCount})`;
    paramCount++;
    
    // Filtrar tareas privadas
    params.push(scope.role === 'owner');
    queryText += ` AND ($${paramCount}::boolean OR t.private = false)`;
    paramCount++;
    
    // Filtrar por status
    if (status) {
      params.push(status);
      queryText += ` AND t.status = $${paramCount}`;
      paramCount++;
    } else {
      queryText += ` AND t.status <> 'cancelado'`;
    }
    
    // Filtrar por project_id
    if (project_id) {
      params.push(project_id);
      queryText += ` AND t.project_id = $${paramCount}`;
      paramCount++;
    }
    
    // Filtrar por fecha
    if (from) {
      params.push(from);
      queryText += ` AND t.due_at >= $${paramCount}`;
      paramCount++;
    }
    
    if (to) {
      params.push(to);
      queryText += ` AND t.due_at <= $${paramCount}`;
      paramCount++;
    }
    
    queryText += ` ORDER BY t.due_at NULLS LAST, t.priority`;
    
    const result = await query(queryText, params);
    
    res.json({
      tasks: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Error en GET /api/tasks:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PATCH /api/tasks/:id
router.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { id } = req.params;
    const { status, title, detail, due_at, starts_at, priority } = req.body;

    const existingResult = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    const task = existingResult.rows[0];

    // Ocultar tareas privadas y fuera de scope como si no existieran
    if (task.private && scope.role !== 'owner') {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }
    if (scope.project_id && task.project_id !== scope.project_id) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    if (status === 'hecho' && !scope.can_complete) {
      return res.status(403).json({ error: 'No autorizado para completar tareas' });
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      params.push(status);
      paramCount++;

      if (status === 'hecho') {
        updates.push(`completed_at = now()`);
        updates.push(`completed_by = $${paramCount}`);
        params.push(scope.label);
        paramCount++;
      }
    }
    if (title !== undefined) {
      updates.push(`title = $${paramCount}`);
      params.push(title);
      paramCount++;
    }
    if (detail !== undefined) {
      updates.push(`detail = $${paramCount}`);
      params.push(detail);
      paramCount++;
    }
    if (due_at !== undefined) {
      updates.push(`due_at = $${paramCount}`);
      params.push(due_at);
      paramCount++;
    }
    if (starts_at !== undefined) {
      updates.push(`starts_at = $${paramCount}`);
      params.push(starts_at);
      paramCount++;
    }
    if (priority !== undefined) {
      updates.push(`priority = $${paramCount}`);
      params.push(priority);
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nada para actualizar' });
    }

    params.push(id);
    const result = await query(
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en PATCH /api/tasks/:id:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/projects
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    
    let queryText = `
      SELECT p.*,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status <> 'cancelado') as tasks_count,
        (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status IN ('pendiente', 'en_proceso')) as tasks_pending
      FROM projects p
      WHERE p.archived_at IS NULL
    `;
    const params: any[] = [];
    
    if (scope.project_id) {
      queryText += ` AND p.id = $1`;
      params.push(scope.project_id);
    }
    
    queryText += ` ORDER BY p.created_at DESC`;
    
    const result = await query(queryText, params);
    let projects = result.rows;
    
    // Calcular presupuesto ejercido si puede ver dinero
    if (scope.can_see_money) {
      projects = await Promise.all(
        projects.map(async (p) => {
          const budgetResult = await query(
            `SELECT COALESCE(SUM(amount), 0) as spent
             FROM expenses 
             WHERE project_id = $1 AND status = 'pagado' AND kind = 'gasto'`,
            [p.id]
          );
          
          const spent = parseFloat(budgetResult.rows[0].spent);
          const budget = p.budget_amount ? parseFloat(p.budget_amount) : null;
          
          return {
            ...p,
            budget_amount: budget,
            spent,
            remaining: budget ? budget - spent : null
          };
        })
      );
    } else {
      // Quitar campos financieros
      projects = projects.map(p => {
        const { budget_amount, spent, remaining, ...rest } = p;
        return rest;
      });
    }
    
    res.json({ projects });
  } catch (error) {
    console.error('❌ Error en GET /api/projects:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/expenses
router.get('/expenses', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    
    // Verificar permiso
    if (!scope.can_see_money) {
      return res.status(403).json({ error: 'No autorizado para ver gastos' });
    }
    
    const { project_id, status } = req.query;
    
    // Validar que project_id del query coincida con scope
    if (project_id && scope.project_id && project_id !== scope.project_id) {
      return res.status(403).json({ error: 'No autorizado para este proyecto' });
    }
    
    let queryText = `
      SELECT e.*, p.name as project_name
      FROM expenses e
      LEFT JOIN projects p ON p.id = e.project_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;
    
    // Filtrar por scope
    params.push(scope.project_id || null);
    queryText += ` AND ($${paramCount}::uuid IS NULL OR e.project_id = $${paramCount})`;
    paramCount++;
    
    // Filtrar por status
    if (status) {
      params.push(status);
      queryText += ` AND e.status = $${paramCount}`;
      paramCount++;
    }
    
    // Filtrar por project_id
    if (project_id) {
      params.push(project_id);
      queryText += ` AND e.project_id = $${paramCount}`;
      paramCount++;
    }
    
    queryText += ` ORDER BY e.created_at DESC`;
    
    const result = await query(queryText, params);
    
    res.json({
      expenses: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Error en GET /api/expenses:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// GET /api/notes
router.get('/notes', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    
    let queryText = `
      SELECT n.*, p.name as project_name
      FROM notes n
      LEFT JOIN projects p ON p.id = n.project_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;
    
    // Filtrar por scope
    params.push(scope.project_id || null);
    queryText += ` AND ($${paramCount}::uuid IS NULL OR n.project_id = $${paramCount})`;
    paramCount++;
    
    queryText += ` ORDER BY n.created_at DESC`;
    
    const result = await query(queryText, params);
    
    res.json({
      notes: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('❌ Error en GET /api/notes:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
