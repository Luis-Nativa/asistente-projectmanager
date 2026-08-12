import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL no está configurada');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔄 Conectando a la base de datos...');
    await pool.query('SELECT NOW()');
    console.log('✅ Conectado a Neon Postgres');

    const migrationFile = path.join(__dirname, '..', 'migrations', '001_init.sql');
    const sql = fs.readFileSync(migrationFile, 'utf-8');

    console.log('🔄 Corriendo migración 001_init.sql...');
    await pool.query(sql);
    console.log('✅ Migración completada');

    console.log('🔄 Verificando tablas...');
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('✅ Tablas creadas:');
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));

  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
