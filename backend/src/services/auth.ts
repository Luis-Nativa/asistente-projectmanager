import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from './db.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'default-refresh-secret';
const REFRESH_TOKEN_EXPIRES_IN = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || '30');
const PIN_SALT_ROUNDS = parseInt(process.env.PIN_SALT_ROUNDS || '12');

export interface Share {
  id: string;
  slug: string;
  label: string;
  project_id: string | null;
  pin_hash: string;
  role: 'owner' | 'colaborador' | 'lector';
  can_complete: boolean;
  can_create: boolean;
  can_see_money: boolean;
  tg_chat_id: number | null;
  expires_at: string | null;
  revoked_at: string | null;
  last_seen_at: string | null;
}

export async function authenticatePin(slug: string, pin: string): Promise<{
  token: string;
  refreshToken: string;
  expiresIn: number;
  share: Share;
}> {
  // 1. Buscar share por slug
  const shareResult = await query('SELECT * FROM shares WHERE slug = $1', [slug]);
  
  if (shareResult.rows.length === 0) {
    throw new Error('Enlace inválido');
  }
  
  const share = shareResult.rows[0];
  
  // 2. Validar PIN
  const valid = await bcrypt.compare(pin, share.pin_hash);
  if (!valid) {
    throw new Error('PIN inválido');
  }
  
  // 3. Verificar que no esté revocado ni vencido
  if (share.revoked_at) {
    throw new Error('Enlace revocado');
  }
  
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    throw new Error('Enlace vencido');
  }
  
  // 4. Generar JWT
  const token = jwt.sign(
    { share_id: share.id },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  
  // 5. Generar refresh token
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const refreshTokenHash = await bcrypt.hash(refreshToken, PIN_SALT_ROUNDS);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_IN);
  
  await query(
    `INSERT INTO refresh_tokens (share_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [share.id, refreshTokenHash, expiresAt]
  );
  
  // 6. Actualizar last_seen_at
  await query(
    'UPDATE shares SET last_seen_at = now() WHERE id = $1',
    [share.id]
  );
  
  return {
    token,
    refreshToken,
    expiresIn: 86400, // 1 día en segundos
    share
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  token: string;
  expiresIn: number;
}> {
  // 1. Buscar refresh token
  const tokenResult = await query(
    `SELECT rt.*, s.id as share_id 
     FROM refresh_tokens rt
     JOIN shares s ON s.id = rt.share_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
    [refreshToken]
  );
  
  if (tokenResult.rows.length === 0) {
    throw new Error('Refresh token inválido o vencido');
  }
  
  const tokenData = tokenResult.rows[0];
  
  // 2. Verificar que el share no esté revocado
  const shareResult = await query(
    'SELECT * FROM shares WHERE id = $1 AND revoked_at IS NULL',
    [tokenData.share_id]
  );
  
  if (shareResult.rows.length === 0) {
    throw new Error('Share revocado');
  }
  
  // 3. Generar nuevo JWT
  const token = jwt.sign(
    { share_id: tokenData.share_id },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
  
  return {
    token,
    expiresIn: 86400
  };
}

export function verifyToken(token: string): { share_id: string } {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { share_id: string };
    return payload;
  } catch (error) {
    throw new Error('Token inválido o vencido');
  }
}

export async function getShareById(shareId: string): Promise<Share> {
  const result = await query('SELECT * FROM shares WHERE id = $1', [shareId]);
  
  if (result.rows.length === 0) {
    throw new Error('Share no encontrado');
  }
  
  const share = result.rows[0];
  
  if (share.revoked_at) {
    throw new Error('Enlace revocado');
  }
  
  if (share.expires_at && new Date(share.expires_at) < new Date()) {
    throw new Error('Enlace vencido');
  }
  
  // Actualizar last_seen_at
  await query(
    'UPDATE shares SET last_seen_at = now() WHERE id = $1',
    [shareId]
  );
  
  return share;
}

export async function createOwnerShare(pin: string, label: string = 'Main'): Promise<{
  slug: string;
  pin: string;
}> {
  const slug = crypto.randomBytes(16).toString('hex');
  const pinHash = await bcrypt.hash(pin, PIN_SALT_ROUNDS);
  
  await query(
    `INSERT INTO shares (slug, label, project_id, pin_hash, role, can_complete, can_create, can_see_money, expires_at)
     VALUES ($1, $2, NULL, $3, 'owner', true, true, true, NULL)`,
    [slug, label, pinHash]
  );
  
  return { slug, pin };
}
