import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../services/db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// GET /api/shares - Listar shares (solo owner)
router.get('/', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    
    if (scope.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner puede ver los shares' });
    }
    
    const result = await query(
      `SELECT s.*, p.name as project_name
       FROM shares s
       LEFT JOIN projects p ON p.id = s.project_id
       WHERE s.revoked_at IS NULL
       ORDER BY s.created_at DESC`,
      []
    );
    
    res.json({ shares: result.rows });
  } catch (error) {
    console.error('❌ Error en GET /api/shares:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/shares - Crear share (solo owner)
router.post('/', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    
    if (scope.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner puede crear shares' });
    }
    
    const { label, project_id, can_complete, can_create, can_see_money, expires_in_days } = req.body;
    
    if (!label) {
      return res.status(400).json({ error: 'El label es obligatorio' });
    }
    
    // Validar que project_id esté dentro del scope del owner
    if (project_id) {
      const projectResult = await query(
        'SELECT id FROM projects WHERE id = $1',
        [project_id]
      );
      
      if (projectResult.rows.length === 0) {
        return res.status(404).json({ error: 'Proyecto no encontrado' });
      }
    }
    
    // Generar slug y PIN
    const slug = crypto.randomBytes(16).toString('hex');
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const pinHash = await bcrypt.hash(pin, parseInt(process.env.PIN_SALT_ROUNDS || '12'));
    
    // Calcular fecha de expiración
    let expiresAt = null;
    if (expires_in_days) {
      const expiresDate = new Date();
      expiresDate.setDate(expiresDate.getDate() + expires_in_days);
      expiresAt = expiresDate;
    }
    
    const result = await query(
      `INSERT INTO shares (slug, label, project_id, pin_hash, role, can_complete, can_create, can_see_money, expires_at)
       VALUES ($1, $2, $3, $4, 'colaborador', $5, $6, $7, $8)
       RETURNING *`,
      [
        slug,
        label,
        project_id || null,
        pinHash,
        can_complete !== undefined ? can_complete : true,
        can_create !== undefined ? can_create : false,
        can_see_money !== undefined ? can_see_money : false,
        expiresAt
      ]
    );
    
    // Registrar en activity
    await query(
      `INSERT INTO activity (share_id, actor_label, entity_type, entity_id, action, detail)
       VALUES ($1, $2, 'share', $3, 'creo', $4)`,
      [scope.id, scope.label, result.rows[0].id, JSON.stringify({ label, project_id })]
    );
    
    // Devolver el PIN en claro (solo una vez)
    res.status(201).json({
      ...result.rows[0],
      pin: pin, // PIN en claro para mostrar al usuario
      url: `/d/${slug}`
    });
  } catch (error) {
    console.error('❌ Error en POST /api/shares:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// PATCH /api/shares/:id - Actualizar share (solo owner)
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { id } = req.params;
    
    if (scope.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner puede editar shares' });
    }
    
    const { can_complete, can_create, can_see_money, expires_at } = req.body;
    
    const existingResult = await query('SELECT * FROM shares WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share no encontrado' });
    }
    
    const updates: string[] = [];
    const params: any[] = [];
    let paramCount = 1;
    
    if (can_complete !== undefined) {
      updates.push(`can_complete = $${paramCount}`);
      params.push(can_complete);
      paramCount++;
    }
    if (can_create !== undefined) {
      updates.push(`can_create = $${paramCount}`);
      params.push(can_create);
      paramCount++;
    }
    if (can_see_money !== undefined) {
      updates.push(`can_see_money = $${paramCount}`);
      params.push(can_see_money);
      paramCount++;
    }
    if (expires_at !== undefined) {
      updates.push(`expires_at = $${paramCount}`);
      params.push(expires_at);
      paramCount++;
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nada para actualizar' });
    }
    
    params.push(id);
    const result = await query(
      `UPDATE shares SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      params
    );
    
    // Registrar en activity
    await query(
      `INSERT INTO activity (share_id, actor_label, entity_type, entity_id, action, detail)
       VALUES ($1, $2, 'share', $3, 'edito', $4)`,
      [scope.id, scope.label, id, JSON.stringify(req.body)]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error en PATCH /api/shares/:id:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// DELETE /api/shares/:id - Revocar share (solo owner, no puede revocarse a sí mismo)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { id } = req.params;
    
    if (scope.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner puede revocar shares' });
    }
    
    const existingResult = await query('SELECT * FROM shares WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share no encontrado' });
    }
    
    const share = existingResult.rows[0];
    
    // No puede revocarse a sí mismo
    if (share.id === scope.id) {
      return res.status(403).json({ error: 'No puedes revocar tu propio acceso' });
    }
    
    // Marcar como revocado
    await query(
      'UPDATE shares SET revoked_at = now() WHERE id = $1',
      [id]
    );
    
    // Registrar en activity
    await query(
      `INSERT INTO activity (share_id, actor_label, entity_type, entity_id, action, detail)
       VALUES ($1, $2, 'share', $3, 'revoco', $4)`,
      [scope.id, scope.label, id, JSON.stringify({ label: share.label })]
    );
    
    res.status(204).send();
  } catch (error) {
    console.error('❌ Error en DELETE /api/shares/:id:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// POST /api/shares/:id/regenerate-pin - Regenerar PIN (solo owner)
router.post('/:id/regenerate-pin', async (req: Request, res: Response) => {
  try {
    const scope = req.scope!;
    const { id } = req.params;
    
    if (scope.role !== 'owner') {
      return res.status(403).json({ error: 'Solo el owner puede regenerar PINs' });
    }
    
    const existingResult = await query('SELECT * FROM shares WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Share no encontrado' });
    }
    
    // Generar nuevo PIN
    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    const newPinHash = await bcrypt.hash(newPin, parseInt(process.env.PIN_SALT_ROUNDS || '12'));
    
    await query(
      'UPDATE shares SET pin_hash = $1 WHERE id = $2',
      [newPinHash, id]
    );
    
    // Registrar en activity
    await query(
      `INSERT INTO activity (share_id, actor_label, entity_type, entity_id, action, detail)
       VALUES ($1, $2, 'share', $3, 'regenero PIN', $4)`,
      [scope.id, scope.label, id, JSON.stringify({})]
    );
    
    res.json({ pin: newPin });
  } catch (error) {
    console.error('❌ Error en POST /api/shares/:id/regenerate-pin:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
