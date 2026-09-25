-- ==============================================================================
-- AutoProd Infrastructure Migration: 012_enable_rls_tool_intent_and_telemetry.sql
-- Idempotent provisioning:
-- 1. Habilitar Row Level Security (RLS) en public."toolIntentGolden"
-- 2. Habilitar Row Level Security (RLS) en public."intentTelemetry"
-- 3. Políticas seguras para lectura de intenciones canónicas del router semántico
-- 4. Políticas seguras y optimizadas para ingesta y auditoría de telemetría
-- ==============================================================================

-- 1. HABILITAR RLS EN toolIntentGolden
ALTER TABLE IF EXISTS public."toolIntentGolden" ENABLE ROW LEVEL SECURITY;

-- 2. HABILITAR RLS EN intentTelemetry
ALTER TABLE IF EXISTS public."intentTelemetry" ENABLE ROW LEVEL SECURITY;

-- 3. POLÍTICAS PARA toolIntentGolden
-- Lectura pública para anon y authenticated (necesaria para el router semántico y evaluación de similitud)
DROP POLICY IF EXISTS "tool_intent_golden_select_policy" ON public."toolIntentGolden";
CREATE POLICY "tool_intent_golden_select_policy"
ON public."toolIntentGolden"
FOR SELECT
TO anon, authenticated, service_role
USING (true);

-- Modificación y administración reservada exclusivamente a service_role (backend/arnés de curaduría)
DROP POLICY IF EXISTS "tool_intent_golden_service_all" ON public."toolIntentGolden";
CREATE POLICY "tool_intent_golden_service_all"
ON public."toolIntentGolden"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 4. POLÍTICAS PARA intentTelemetry
-- Administración completa para service_role (backend y prisma directo)
DROP POLICY IF EXISTS "intent_telemetry_service_all" ON public."intentTelemetry";
CREATE POLICY "intent_telemetry_service_all"
ON public."intentTelemetry"
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Inserción autenticada: solo permite asociar telemetría al propio usuario autenticado o null (anónimo seguro)
DROP POLICY IF EXISTS "intent_telemetry_insert_policy" ON public."intentTelemetry";
CREATE POLICY "intent_telemetry_insert_policy"
ON public."intentTelemetry"
FOR INSERT
TO authenticated
WITH CHECK (
  "userId" IS NULL OR "userId" = (SELECT auth.uid())
);

-- Lectura autenticada: los usuarios solo pueden consultar su propia telemetría
DROP POLICY IF EXISTS "intent_telemetry_select_policy" ON public."intentTelemetry";
CREATE POLICY "intent_telemetry_select_policy"
ON public."intentTelemetry"
FOR SELECT
TO authenticated
USING (
  "userId" = (SELECT auth.uid())
);
