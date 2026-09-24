-- ==============================================================================
-- AutoProd Infrastructure Migration: 008_semantic_router_and_telemetry.sql
-- Idempotent provisioning:
-- 1. Habilitar extensión pgvector si no existe
-- 2. Creación de la tabla toolIntentGolden (Índice de intenciones canónicas y embeddings limpios)
-- 3. Creación de la tabla intentTelemetry (Buffer en caliente para telemetría y staging)
-- 4. Función RPC match_tool_intents (Búsqueda vectorial rápida HNSW por similitud de coseno)
-- 5. Semilla inicial de intenciones canónicas por dominio (Cold Start)
-- ==============================================================================

-- 1. EXTENSIÓN VECTORIAL
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. TABLA toolIntentGolden (TABLA LIMPIA DEL ROUTER SEMÁNTICO)
CREATE TABLE IF NOT EXISTS public."toolIntentGolden" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "toolName" TEXT NOT NULL,
  "domain" TEXT NOT NULL DEFAULT 'SYSTEM',
  "canonicalQuery" TEXT NOT NULL,
  "embedding" vector(1536),
  "isDirectFastPath" BOOLEAN NOT NULL DEFAULT true,
  "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "uq_tool_intent_golden_canonical" UNIQUE ("toolName", "canonicalQuery")
);

-- Índices para búsqueda por dominio y herramienta
CREATE INDEX IF NOT EXISTS "idx_tool_intent_golden_domain" ON public."toolIntentGolden" ("domain");
CREATE INDEX IF NOT EXISTS "idx_tool_intent_golden_tool_name" ON public."toolIntentGolden" ("toolName");
CREATE INDEX IF NOT EXISTS "idx_tool_intent_golden_fast_path" ON public."toolIntentGolden" ("isDirectFastPath");

-- Índice vectorial HNSW para búsquedas de similitud en menos de 15ms
CREATE INDEX IF NOT EXISTS "idx_tool_intent_golden_embedding_hnsw"
ON public."toolIntentGolden"
USING hnsw ("embedding" vector_cosine_ops);

-- 3. TABLA intentTelemetry (BUFFER EN CALIENTE PARA TELEMETRÍA Y STAGING)
CREATE TABLE IF NOT EXISTS public."intentTelemetry" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES public."user"("id") ON DELETE SET NULL,
  "rawQuery" TEXT NOT NULL,
  "detectedDomain" TEXT,
  "executedTool" TEXT,
  "wasFastPath" BOOLEAN NOT NULL DEFAULT false,
  "confidenceScore" DOUBLE PRECISION,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROMOTED', 'DISCARDED_DUPLICATE', 'FLAGGED_REVIEW'
  "metadata" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Índices para el procesamiento en batch y auditoría
CREATE INDEX IF NOT EXISTS "idx_intent_telemetry_status" ON public."intentTelemetry" ("status");
CREATE INDEX IF NOT EXISTS "idx_intent_telemetry_user_id" ON public."intentTelemetry" ("userId");
CREATE INDEX IF NOT EXISTS "idx_intent_telemetry_executed_tool" ON public."intentTelemetry" ("executedTool");
CREATE INDEX IF NOT EXISTS "idx_intent_telemetry_created_at" ON public."intentTelemetry" ("createdAt" DESC);

-- 4. FUNCIÓN RPC: match_tool_intents (SIMILITUD DE COSENO)
CREATE OR REPLACE FUNCTION match_tool_intents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  tool_name text,
  domain text,
  canonical_query text,
  is_direct_fast_path boolean,
  confidence_threshold float,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ti."id",
    ti."toolName" AS tool_name,
    ti."domain",
    ti."canonicalQuery" AS canonical_query,
    ti."isDirectFastPath" AS is_direct_fast_path,
    ti."confidenceThreshold" AS confidence_threshold,
    (1 - (ti."embedding" <=> query_embedding))::float AS similarity
  FROM public."toolIntentGolden" ti
  WHERE ti."embedding" IS NOT NULL
    AND (1 - (ti."embedding" <=> query_embedding)) >= match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

-- Permisos para roles de Supabase (anon, authenticated, service_role)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public."toolIntentGolden" TO anon, authenticated, service_role;
GRANT ALL ON public."intentTelemetry" TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_tool_intents TO anon, authenticated, service_role;

-- 5. SEMILLA INICIAL DE INTENCIONES CANÓNICAS POR DOMINIO (COLD START)
INSERT INTO public."toolIntentGolden" ("toolName", "domain", "canonicalQuery", "isDirectFastPath", "confidenceThreshold")
VALUES
  -- ── DOMINIO: WORKSPACE_FS ──
  ('crear_canal', 'WORKSPACE_FS', 'crea un canal llamado {NOMBRE}', true, 0.88),
  ('crear_canal', 'WORKSPACE_FS', 'iniciar un nuevo canal de {NICHO}', true, 0.88),
  ('crear_canal', 'WORKSPACE_FS', 'configura un canal nuevo {NOMBRE}', true, 0.88),
  ('listar_canales', 'WORKSPACE_FS', 'qué canales tengo creados', true, 0.85),
  ('listar_canales', 'WORKSPACE_FS', 'mostrar mis canales del workspace', true, 0.85),
  ('listar_canales', 'WORKSPACE_FS', 'lista todas las carpetas de canal', true, 0.85),

  -- ── DOMINIO: VIDEO_PROJECT ──
  ('consultar_proyecto_video', 'VIDEO_PROJECT', 'qué video estoy haciendo', true, 0.85),
  ('consultar_proyecto_video', 'VIDEO_PROJECT', 'cuál es mi video en progreso', true, 0.85),
  ('consultar_proyecto_video', 'VIDEO_PROJECT', 'en qué video estoy trabajando actualmente', true, 0.85),
  ('listar_proyectos_video', 'VIDEO_PROJECT', 'listar proyectos de video', true, 0.85),
  ('listar_proyectos_video', 'VIDEO_PROJECT', 'muéstrame mis borradores de video', true, 0.85),

  -- ── DOMINIO: CHANNEL_MEMORY ──
  ('extraer_canal_youtube', 'CHANNEL_MEMORY', 'extraer datos de este canal de youtube {URL}', true, 0.88),
  ('extraer_canal_youtube', 'CHANNEL_MEMORY', 'analizar este canal de youtube {URL}', true, 0.88),
  ('generar_info_canal', 'CHANNEL_MEMORY', 'generar resumen y adn del canal', true, 0.88),
  ('generar_info_canal', 'CHANNEL_MEMORY', 'actualizar contexto de este canal', true, 0.88),

  -- ── DOMINIO: CREATIVE_STUDIO ──
  ('generar_locucion', 'CREATIVE_STUDIO', 'generar locución con tts', true, 0.85),
  ('generar_locucion', 'CREATIVE_STUDIO', 'crear audio de voz para este texto', true, 0.85),
  ('generar_locucion', 'CREATIVE_STUDIO', 'locutar el guion con voz {VOZ}', true, 0.85),

  -- ── DOMINIO: SYSTEM ──
  ('estado_sistema', 'SYSTEM', 'cuál es el estado del motor local', true, 0.85),
  ('estado_sistema', 'SYSTEM', 'verificar si el sistema está online', true, 0.85),
  ('prompts', 'SYSTEM', 'consultar directivas de producción', false, 0.90)

ON CONFLICT ("toolName", "canonicalQuery") DO NOTHING;
