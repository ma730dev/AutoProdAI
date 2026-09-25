-- ==============================================================================
-- AutoProd Infrastructure Migration: 013_fix_supabase_security_advisors.sql
-- Idempotent provisioning:
-- 1. Fijar search_path inmutable en funciones (Cierra vulnerabilidad 0011_function_search_path_mutable)
-- 2. Restringir funciones de Supabase Vault (get_api_key, save_api_key, get_decrypted_secret)
--    para que solo service_role pueda ejecutarlas (Cierra 0028 y 0029)
-- 3. Convertir match_tool_intents a SECURITY INVOKER con search_path explícito
-- 4. Fijar search_path en match_channel_contexts
-- 5. Mover extensión vector al esquema extensions si es soportado
-- ==============================================================================

-- 1. RECONFIGURAR match_tool_intents COMO SECURITY INVOKER (ELIMINA ADVERTENCIA DE SEGURIDAD)
CREATE OR REPLACE FUNCTION public.match_tool_intents(
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
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, extensions, pg_temp
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

-- Otorgar ejecución segura a los roles de Supabase
GRANT EXECUTE ON FUNCTION public.match_tool_intents(vector, float, int) TO anon, authenticated, service_role;

-- 2. BLOQUE PL/PGSQL IDEMPOTENTE PARA AJUSTAR PERMISOS Y SEARCH_PATH EN FUNCIONES DEL VAULT
DO $$
DECLARE
  r RECORD;
BEGIN
  -- A. Ajustar get_decrypted_secret (Protección de Vault)
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'get_decrypted_secret'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'ALTER FUNCTION ' || r.func_sig || ' SET search_path = public, vault, extensions, pg_temp';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM anon, authenticated, PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO service_role';
  END LOOP;

  -- B. Ajustar get_api_key (Protección de claves de usuario)
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'get_api_key'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'ALTER FUNCTION ' || r.func_sig || ' SET search_path = public, vault, extensions, pg_temp';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM anon, authenticated, PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO service_role';
  END LOOP;

  -- C. Ajustar save_api_key (todas las sobrecargas existentes)
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'save_api_key'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'ALTER FUNCTION ' || r.func_sig || ' SET search_path = public, vault, extensions, pg_temp';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION ' || r.func_sig || ' FROM anon, authenticated, PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || r.func_sig || ' TO service_role';
  END LOOP;

  -- D. Ajustar match_channel_contexts (Fijar search_path)
  FOR r IN (
    SELECT oid::regprocedure AS func_sig
    FROM pg_proc
    WHERE proname = 'match_channel_contexts'
      AND pronamespace = 'public'::regnamespace
  ) LOOP
    EXECUTE 'ALTER FUNCTION ' || r.func_sig || ' SET search_path = public, extensions, pg_temp';
  END LOOP;
END $$;

-- 3. MOVER EXTENSIÓN VECTOR AL ESQUEMA EXTENSIONS (MEJOR PRÁCTICA DE SUPABASE)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector' AND extnamespace = 'public'::regnamespace
  ) THEN
    CREATE SCHEMA IF NOT EXISTS extensions;
    ALTER EXTENSION "vector" SET SCHEMA extensions;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Si por dependencias de tabla el motor prefiere dejarla en public, no abortar migración
    RAISE NOTICE 'Nota sobre extension vector: %', SQLERRM;
END $$;
