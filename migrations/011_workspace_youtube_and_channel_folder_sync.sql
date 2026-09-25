-- ==============================================================================
-- AutoProd Infrastructure Migration: 011_workspace_youtube_and_channel_folder_sync.sql
-- Idempotent provisioning: Plan Limits (Basic: 3, Pro: 7, Enterprise: 9999),
-- Channel folder status tracking ('PENDING' / 'CREATED') and workspace/youtube governance.
-- ==============================================================================

-- 1. Añadir columna folderStatus a la tabla channel para trazabilidad de creación física
ALTER TABLE public."channel" ADD COLUMN IF NOT EXISTS "folderStatus" VARCHAR(20) DEFAULT 'PENDING';

-- 2. Actualizar canales existentes que ya cuenten con localPath a estado 'CREATED'
UPDATE public."channel"
SET "folderStatus" = 'CREATED'
WHERE "localPath" IS NOT NULL AND ("folderStatus" IS NULL OR "folderStatus" = 'PENDING');

-- 3. Actualizar límites de canales según la nueva regla de negocio en planLimit
-- Basic / Starter: hasta 3 canales
UPDATE public."planLimit"
SET "maxChannels" = 3
WHERE "planId" IN (SELECT "id" FROM public."plan" WHERE "name" = 'STARTER');

-- Pro: hasta 7 canales
UPDATE public."planLimit"
SET "maxChannels" = 7
WHERE "planId" IN (SELECT "id" FROM public."plan" WHERE "name" = 'PRO');

-- Enterprise: canales ilimitados (9999)
UPDATE public."planLimit"
SET "maxChannels" = 9999
WHERE "planId" IN (SELECT "id" FROM public."plan" WHERE "name" = 'ENTERPRISE');
