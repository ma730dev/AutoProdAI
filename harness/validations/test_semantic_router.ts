import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { evaluateSemanticRoute, getToolsForDomain } from '../../lib/semantic-router';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runTests() {
  console.log('\n================================================================');
  console.log('       🧪  AUTOPROD AI - TEST DEL ROUTER SEMÁNTICO (SYSTEM 1)');
  console.log('================================================================\n');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !supabaseKey || !openAiApiKey) {
    console.error('❌ Faltan variables de entorno necesarias (SUPABASE_URL, KEY o OPENAI_API_KEY).');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const testQueries = [
    'qué canales tengo creados en mi workspace',
    'en qué video estoy trabajando ahora mismo',
    'muéstrame la lista de borradores de video',
    'cuál es el estado del motor local y autoprod',
    'quiero locutar este texto con voz en español',
    'crea un canal nuevo llamado Misterios Antiguos',
    'analizar este canal de youtube https://youtube.com/@ejemplo'
  ];

  for (const query of testQueries) {
    const start = performance.now();
    const result = await evaluateSemanticRoute({
      queryText: query,
      openAiApiKey,
      supabaseClient: supabase,
      defaultThreshold: 0.70
    });
    const durationMs = Math.round(performance.now() - start);

    console.log(`\n💬 Consulta: "${query}"`);
    console.log(`⏱️ Latencia: ${durationMs} ms`);
    if (result.matched) {
      console.log(`   ✅ MATCH: Tool [${result.toolName}]`);
      console.log(`   📂 Dominio: ${result.domain}`);
      console.log(`   ⚡ Fast-Path Directo: ${result.isDirectFastPath ? 'SÍ (Sin LLM)' : 'NO (Va a GPT)'}`);
      console.log(`   🎯 Similitud de Coseno: ${Math.round((result.confidence || 0) * 100)}%`);
      console.log(`   🛠️ Herramientas inyectadas para este dominio: [${getToolsForDomain(result.domain).join(', ')}]`);
    } else {
      console.log(`   ❓ Sin coincidencia suficiente (o inferior al umbral) -> Fallback al Orquestador completo.`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 Pruebas de enrutamiento finalizadas.');
  console.log('================================================================\n');
}

runTests();
