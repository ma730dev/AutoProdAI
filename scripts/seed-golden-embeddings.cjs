const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

async function seedEmbeddings() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!connectionString) {
    console.error('[Error] Falta DIRECT_URL o DATABASE_URL en .env');
    process.exit(1);
  }

  if (!apiKey) {
    console.error('[Error] Falta OPENAI_API_KEY en .env para generar embeddings');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('[Embeddings] Conectando a Supabase PostgreSQL...');
    const client = await pool.connect();

    // 1. Buscar filas que no tengan embedding
    const queryRes = await client.query(
      `SELECT "id", "toolName", "canonicalQuery" FROM public."toolIntentGolden" WHERE "embedding" IS NULL ORDER BY "createdAt" ASC`
    );

    const pendingRows = queryRes.rows;
    console.log(`[Embeddings] Se encontraron ${pendingRows.length} intenciones sin embedding.`);

    if (pendingRows.length === 0) {
      console.log('✅ [Embeddings] Todas las intenciones canónicas ya tienen su embedding generado.');
      client.release();
      return;
    }

    // 2. Procesar en lotes de hasta 20 para evitar saturar el API
    const BATCH_SIZE = 20;
    let updatedCount = 0;

    for (let i = 0; i < pendingRows.length; i += BATCH_SIZE) {
      const batch = pendingRows.slice(i, i + BATCH_SIZE);
      const inputs = batch.map(r => r.canonicalQuery);

      console.log(`[Embeddings] Generando vectores para lote ${Math.floor(i / BATCH_SIZE) + 1} (${inputs.length} intenciones)...`);

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: inputs
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errText}`);
      }

      const resJson = await response.json();
      const embeddingsData = resJson.data;

      // 3. Guardar cada embedding en Postgres
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const vector = embeddingsData[j].embedding;
        const vectorStr = `[${vector.join(',')}]`;

        await client.query(
          `UPDATE public."toolIntentGolden" SET "embedding" = $1::vector, "updatedAt" = now() WHERE "id" = $2`,
          [vectorStr, row.id]
        );

        console.log(`  ✓ [${row.toolName}] "${row.canonicalQuery}" vectorizado.`);
        updatedCount++;
      }
    }

    client.release();
    console.log(`\n🎉 [Éxito] Se generaron y guardaron ${updatedCount} embeddings vectoriales en toolIntentGolden.`);
  } catch (err) {
    console.error('[Error]:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedEmbeddings();
