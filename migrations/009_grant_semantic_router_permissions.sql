-- ==============================================================================
-- AutoProd Infrastructure Migration: 009_grant_semantic_router_permissions.sql
-- Idempotent provisioning:
-- 1. Actualizar match_tool_intents con SECURITY DEFINER y search_path = public
-- 2. Otorgar permisos GRANT SELECT / EXECUTE para roles anon, authenticated y service_role
-- ==============================================================================

-- 1. RE-DECLARACIÓN CON SECURITY DEFINER
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

-- 2. PERMISOS EXPLÍCITOS PARA ROLES DE SUPABASE
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public."toolIntentGolden" TO anon, authenticated, service_role;
GRANT ALL ON public."intentTelemetry" TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_tool_intents TO anon, authenticated, service_role;
