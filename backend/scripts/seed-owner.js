import 'dotenv/config';
import { createOwnerShare } from '../src/services/auth.js';
import { query } from '../src/services/db.js';

async function seed() {
  console.log('🔄 Creando seed del owner...');
  
  // Verificar si ya existe un owner
  const existingOwner = await query(
    "SELECT * FROM shares WHERE role = 'owner' AND revoked_at IS NULL"
  );
  
  if (existingOwner.rows.length > 0) {
    console.log('⚠️ Ya existe un owner. Usando el existente.');
    console.log(`   Slug: ${existingOwner.rows[0].slug}`);
    console.log(`   Label: ${existingOwner.rows[0].label}`);
    console.log('   Para regenerar el PIN, usa el endpoint POST /api/shares/:id/regenerate-pin');
    return;
  }
  
  // Generar PIN aleatorio de 6 dígitos
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const label = 'Main';
  
  console.log(`📝 Creando owner con label: ${label}`);
  console.log(`🔑 PIN generado: ${pin}`);
  
  const { slug } = await createOwnerShare(pin, label);
  
  console.log('✅ Owner creado exitosamente');
  console.log('');
  console.log('📋 Información de acceso:');
  console.log(`   URL: https://tu-app.vercel.app/d/${slug}`);
  console.log(`   Slug: ${slug}`);
  console.log(`   PIN: ${pin}`);
  console.log('');
  console.log('⚠️ IMPORTANTE: Guarda este PIN en un lugar seguro.');
  console.log('   El PIN se muestra solo una vez. Si lo pierdes, tendrás que crear un nuevo share.');
  console.log('');
  console.log('🔐 Próximos pasos:');
  console.log('   1. Agrega las variables de entorno en Render:');
  console.log(`      - JWT_SECRET: ${generateRandomSecret()}`);
  console.log(`      - REFRESH_TOKEN_SECRET: ${generateRandomSecret()}`);
  console.log(`      - CRON_SECRET: ${generateRandomSecret()}`);
  console.log('   2. Crea el frontend en Next.js');
  console.log('   3. Accede a la URL con el slug y PIN');
}

function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

seed().catch(console.error);
