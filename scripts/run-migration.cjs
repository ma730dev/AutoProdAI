const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

async function run() {
  const fileArg = process.argv[2] || 'migrations/014_unify_tools_by_domain.sql';
  const filePath = path.isAbsolute(fileArg) ? fileArg : path.join(__dirname, '..', fileArg);

  if (!fs.existsSync(filePath)) {
    console.error(`[Error] Archivo de migración no encontrado: ${filePath}`);
    process.exit(1);
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[Error] No se encontró DIRECT_URL o DATABASE_URL en el archivo .env');
    process.exit(1);
  }

  console.log(`[Migración] Leyendo archivo: ${path.basename(filePath)}...`);
  const sql = fs.readFileSync(filePath, 'utf-8');

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('[Migración] Conectando a Supabase PostgreSQL...');
    const client = await pool.connect();
    console.log('[Migración] Ejecutando sentencias SQL...');
    await client.query(sql);
    client.release();
    console.log(`✅ [Éxito] Migración ${path.basename(filePath)} aplicada correctamente.`);
  } catch (err) {
    console.error('[Error al ejecutar migración]:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
