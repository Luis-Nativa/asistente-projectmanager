import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 15000,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('📊 Query ejecutada', { text: text.substring(0, 50), duration, rows: res.rowCount });
  return res;
}

export async function saveInboxMessage(tgMsgId: number, rawText: string | null): Promise<number> {
  const result = await query(
    `INSERT INTO inbox_messages (tg_msg_id, raw_text, kind, status)
     VALUES ($1, $2, 'texto', 'procesado')
     RETURNING id`,
    [tgMsgId, rawText]
  );
  return result.rows[0].id;
}

export async function getShareByChatId(chatId: number) {
  const result = await query(
    `SELECT * FROM shares WHERE tg_chat_id = $1 AND revoked_at IS NULL`,
    [chatId]
  );
  return result.rows[0];
}

export default pool;
