import path from 'path';
import dotenv from 'dotenv';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

async function main() {
  console.log('\n================================================================');
  console.log('       🧠  AUTOPROD AI - SEMILLA DE EMBEDDINGS DE INTENCIONES');
  console.log('================================================================\n');

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!connectionString) {
    console.error('❌ [ERROR] No se encontró DIRECT_URL ni DATABASE_URL.');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('❌ [ERROR] No se encontró OPENAI_API_KEY en variables de entorno.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    // Buscar intenciones que aún no tengan vector generado
    const res = await client.query(`
      SELECT "id", "toolName", "domain", "canonicalQuery"
      FROM public."toolIntentGolden"
      WHERE "embedding" IS NULL
    `);

    console.log(`🔍 Intenciones pendientes de vectorizar: ${res.rows.length}`);

    for (const row of res.rows) {
      console.log(`⏳ Vectorizando [${row.domain}] ${row.toolName} -> "${row.canonicalQuery}"...`);
      
      const { embedding } = await embed({
        model: createOpenAI({ apiKey }).embedding('text-embedding-3-small'),
        value: row.canonicalQuery,
      });

      const vectorString = `[${embedding.join(',')}]`;
      await client.query(`
        UPDATE public."toolIntentGolden"
        SET "embedding" = $1::vector, "updatedAt" = now()
        WHERE "id" = $2
      `, [vectorString, row.id]);

      console.log(`✅ Vector actualizado con éxito.`);
    }

    console.log('\n🎉 ¡Todas las intenciones canónicas base han sido vectorizadas correctamente!\n');
  } catch (err: any) {
    console.error('❌ Error durante la generación de embeddings:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
