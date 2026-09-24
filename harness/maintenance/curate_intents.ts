import path from 'path';
import dotenv from 'dotenv';
import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import pg from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Pool } = pg;

function sanitizeAndMaskQuery(text: string): string {
  // Limpieza básica de espacios y minúsculas
  let cleaned = text.trim().toLowerCase().replace(/\s+/g, ' ');
  // Enmascarar URLs de youtube
  cleaned = cleaned.replace(/https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/[^\s]+/gi, '{URL}');
  return cleaned;
}

async function main() {
  console.log('\n================================================================');
  console.log('       🧹  AUTOPROD AI - HARNESS DE CURADURÍA DE INTENCIONES');
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
    // 1. Obtener registros en caliente en estado PENDING con ejecuciones exitosas
    const pendingRes = await client.query(`
      SELECT "id", "rawQuery", "detectedDomain", "executedTool"
      FROM public."intentTelemetry"
      WHERE "status" = 'PENDING' AND "success" = true AND "executedTool" IS NOT NULL
      ORDER BY "createdAt" ASC
      LIMIT 100
    `);

    console.log(`📋 Consultas pendientes en staging: ${pendingRes.rows.length}`);

    if (pendingRes.rows.length === 0) {
      console.log('✨ No hay consultas pendientes por curar en este momento.');
      return;
    }

    let promotedCount = 0;
    let duplicateCount = 0;
    let reviewCount = 0;

    for (const row of pendingRes.rows) {
      const normalizedQuery = sanitizeAndMaskQuery(row.rawQuery);
      
      // Vectorizar la consulta candidata
      const { embedding } = await embed({
        model: createOpenAI({ apiKey }).embedding('text-embedding-3-small'),
        value: normalizedQuery,
      });

      const vectorString = `[${embedding.join(',')}]`;

      // Comparar contra toolIntentGolden para la misma herramienta
      const matchRes = await client.query(`
        SELECT "id", "canonicalQuery", (1 - ("embedding" <=> $1::vector))::float AS similarity
        FROM public."toolIntentGolden"
        WHERE "toolName" = $2 AND "embedding" IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 1
      `, [vectorString, row.executedTool]);

      const topMatch = matchRes.rows[0];
      const highestSimilarity = topMatch ? topMatch.similarity : 0;

      if (highestSimilarity > 0.92) {
        // Redundante: ya existe una formulación prácticamente idéntica
        await client.query(`
          UPDATE public."intentTelemetry"
          SET "status" = 'DISCARDED_DUPLICATE'
          WHERE "id" = $1
        `, [row.id]);
        duplicateCount++;
      } else if (highestSimilarity >= 0.70 && highestSimilarity <= 0.90) {
        // Zona de oro: nueva formulación lingüística de la misma intención
        const domain = row.detectedDomain || 'SYSTEM';
        await client.query(`
          INSERT INTO public."toolIntentGolden" ("toolName", "domain", "canonicalQuery", "embedding", "isDirectFastPath", "confidenceThreshold")
          VALUES ($1, $2, $3, $4::vector, true, 0.85)
          ON CONFLICT ("toolName", "canonicalQuery") DO NOTHING
        `, [row.executedTool, domain, normalizedQuery, vectorString]);

        await client.query(`
          UPDATE public."intentTelemetry"
          SET "status" = 'PROMOTED'
          WHERE "id" = $1
        `, [row.id]);
        promotedCount++;
        console.log(`⭐ PROMOVIDA: "${normalizedQuery}" para la tool ${row.executedTool} (Similitud base: ${highestSimilarity.toFixed(2)})`);
      } else {
        // Muy distante o atípica: marcar para revisión
        await client.query(`
          UPDATE public."intentTelemetry"
          SET "status" = 'FLAGGED_REVIEW'
          WHERE "id" = $1
        `, [row.id]);
        reviewCount++;
      }
    }

    console.log('\n📊 Resumen de Curaduría:');
    console.log(`   • Promovidas a Golden: ${promotedCount}`);
    console.log(`   • Descartadas por redundantes: ${duplicateCount}`);
    console.log(`   • En cuarentena / revisión: ${reviewCount}\n`);
  } catch (err: any) {
    console.error('❌ Error en el proceso de curaduría:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
