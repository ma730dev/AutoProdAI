import { embed } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { db as prisma } from '@/src/prisma/db';

export type ToolDomain = 
  | 'WORKSPACE_FS' 
  | 'VIDEO_PROJECT' 
  | 'CHANNEL_MEMORY' 
  | 'CREATIVE_STUDIO' 
  | 'SYSTEM';

export interface SemanticRouteMatch {
  matched: boolean;
  toolName?: string;
  domain?: ToolDomain;
  canonicalQuery?: string;
  isDirectFastPath?: boolean;
  confidence?: number;
}

export interface RouteEvaluationOptions {
  queryText: string;
  openAiApiKey?: string;
  supabaseClient: any;
  defaultThreshold?: number;
}

/**
 * Evalúa el mensaje del usuario contra el índice limpio de intenciones canónicas (toolIntentGolden)
 * utilizando pgvector y similitud de coseno en milisegundos.
 */
export async function evaluateSemanticRoute({
  queryText,
  openAiApiKey,
  supabaseClient,
  defaultThreshold = 0.85
}: RouteEvaluationOptions): Promise<SemanticRouteMatch> {
  if (!queryText || !queryText.trim() || !openAiApiKey || !supabaseClient) {
    return { matched: false };
  }

  try {
    const cleanText = queryText.trim().slice(0, 500);

    // 1. Generar embedding vectorial de la consulta del usuario (< 50ms)
    const { embedding } = await embed({
      model: createOpenAI({ apiKey: openAiApiKey }).embedding('text-embedding-3-small'),
      value: cleanText,
    });

    if (!embedding || !Array.isArray(embedding)) {
      return { matched: false };
    }

    // 2. Consulta RPC a Postgres vía pgvector HNSW
    const { data, error } = await supabaseClient.rpc('match_tool_intents', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: defaultThreshold,
      match_count: 1
    });

    if (error) {
      console.warn('[SemanticRouter] Error en RPC match_tool_intents:', error.message);
      return { matched: false };
    }

    if (Array.isArray(data) && data.length > 0) {
      const topMatch = data[0];
      const similarity = topMatch.similarity ?? 0;
      const requiredThreshold = Math.min(topMatch.confidence_threshold ?? 0.78, defaultThreshold);

      if (similarity >= requiredThreshold) {
        return {
          matched: true,
          toolName: topMatch.tool_name,
          domain: topMatch.domain as ToolDomain,
          canonicalQuery: topMatch.canonical_query,
          isDirectFastPath: Boolean(topMatch.is_direct_fast_path),
          confidence: similarity
        };
      }
    }

    return { matched: false };
  } catch (err: any) {
    console.warn('[SemanticRouter] Fallback no fatal:', err.message);
    return { matched: false };
  }
}

/**
 * Ingesta asíncrona de telemetría en caliente en la tabla intentTelemetry.
 * Ejecución en background ("fire-and-forget") para latencia cero al usuario.
 */
export function logIntentTelemetry({
  userId,
  rawQuery,
  detectedDomain,
  executedTool,
  wasFastPath = false,
  confidenceScore,
  success = true,
  metadata = {}
}: {
  userId?: string | null;
  rawQuery: string;
  detectedDomain?: string | null;
  executedTool?: string | null;
  wasFastPath?: boolean;
  confidenceScore?: number | null;
  success?: boolean;
  metadata?: Record<string, any>;
}) {
  if (!rawQuery || !rawQuery.trim()) return;

  // No bloquear el hilo principal (Non-blocking)
  setImmediate(async () => {
    try {
      await prisma.intentTelemetry.create({
        data: {
          userId: userId || null,
          rawQuery: rawQuery.trim().slice(0, 1000),
          detectedDomain: detectedDomain || null,
          executedTool: executedTool || null,
          wasFastPath,
          confidenceScore: confidenceScore ?? null,
          success,
          status: 'PENDING',
          metadata: metadata || {}
        }
      });
    } catch (e: any) {
      console.warn('[SemanticRouter] Error registrando telemetría:', e.message);
    }
  });
}

/**
 * Retorna la lista de herramientas asociadas a un dominio específico
 * para el filtrado dinámico de herramientas (Domain Tool Retrieval).
 */
export function getToolsForDomain(domain?: ToolDomain): string[] {
  const commonSystemTools = ['consultar_prompts', 'estado_sistema', 'workspace_default'];

  switch (domain) {
    case 'WORKSPACE_FS':
      return ['crear_canal', 'listar_canales', ...commonSystemTools];
    case 'VIDEO_PROJECT':
      return ['consultar_proyecto_video', 'listar_proyectos_video', ...commonSystemTools];
    case 'CHANNEL_MEMORY':
      return ['extraer_canal_youtube', 'generar_info_canal', ...commonSystemTools];
    case 'CREATIVE_STUDIO':
      return ['generar_locucion', ...commonSystemTools];
    default:
      return []; // Si no hay dominio, se conservan todas
  }
}
