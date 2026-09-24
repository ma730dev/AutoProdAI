-- ==============================================================================
-- AutoProd Infrastructure Migration: 007_video_projects_and_content_history.sql
-- Idempotent provisioning:
-- 1. Creación de la tabla videoProject (mesa de montaje técnico desacoplada de canales)
-- 2. Creación de la tabla contentHistory (historial multicanal agnóstico con migración segura desde video)
-- 3. Actualización de tabla asset con isCache para control de higiene y vaciado de caché
-- 4. Actualización de conversation para desacoplarlo y soportar contentHistoryId
-- ==============================================================================

-- 1. CREACIÓN DE LA TABLA videoProject (MESA DE MONTAJE Y EDICIÓN TÉCNICA)
CREATE TABLE IF NOT EXISTS public."videoProject" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES public."user"("id") ON DELETE CASCADE,
  "channelId" UUID REFERENCES public."channel"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
  "resolution" TEXT NOT NULL DEFAULT '1080p',
  "timelineData" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "thumbnailUrl" TEXT,
  "durationSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "storageMode" TEXT NOT NULL DEFAULT 'LOCAL',
  "localPath" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- Índices eficientes para consultas y filtros
CREATE INDEX IF NOT EXISTS "idx_video_project_user_id" ON public."videoProject" ("userId");
CREATE INDEX IF NOT EXISTS "idx_video_project_channel_id" ON public."videoProject" ("channelId");
CREATE INDEX IF NOT EXISTS "idx_video_project_updated_at" ON public."videoProject" ("updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "idx_video_project_status" ON public."videoProject" ("status");

-- 2. CREACIÓN DE LA TABLA contentHistory (HISTORIAL DE PUBLICACIONES MULTIRED)
CREATE TABLE IF NOT EXISTS public."contentHistory" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channelId" UUID NOT NULL REFERENCES public."channel"("id") ON DELETE CASCADE,
  "platform" TEXT NOT NULL DEFAULT 'YOUTUBE',
  "contentType" TEXT NOT NULL DEFAULT 'VIDEO',
  "externalId" TEXT,
  "externalUrl" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "thumbnailUrl" TEXT,
  "tags" TEXT,
  "metrics" JSONB DEFAULT '{}'::jsonb,
  "publishedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_content_history_channel_id" ON public."contentHistory" ("channelId");
CREATE INDEX IF NOT EXISTS "idx_content_history_platform" ON public."contentHistory" ("platform");
CREATE INDEX IF NOT EXISTS "idx_content_history_external_id" ON public."contentHistory" ("externalId");
CREATE INDEX IF NOT EXISTS "idx_content_history_published_at" ON public."contentHistory" ("publishedAt" DESC);

-- Migración idempotente de registros históricos si la tabla "video" existía con datos
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'video') THEN
    INSERT INTO public."contentHistory" (
      "id",
      "channelId",
      "platform",
      "contentType",
      "externalId",
      "title",
      "description",
      "tags",
      "createdAt"
    )
    SELECT
      "id",
      "channelId",
      'YOUTUBE',
      'VIDEO',
      "youtubeVideoId",
      COALESCE("title", "name", 'Video de YouTube'),
      "description",
      "tags",
      "createdAt"
    FROM public."video"
    ON CONFLICT ("id") DO NOTHING;
  END IF;
END $$;

-- 3. ACTUALIZACIÓN DE conversation: DESACOPLE SEGURO
ALTER TABLE public."conversation" ADD COLUMN IF NOT EXISTS "contentHistoryId" UUID REFERENCES public."contentHistory"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_conversation_content_history_id" ON public."conversation" ("contentHistoryId");

-- Si conversation tenía videoId, migrar referencias hacia contentHistoryId
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conversation' AND column_name = 'videoId') THEN
    UPDATE public."conversation"
    SET "contentHistoryId" = "videoId"
    WHERE "videoId" IS NOT NULL AND "contentHistoryId" IS NULL;
  END IF;
END $$;

-- 4. ACTUALIZACIÓN DE asset: CONTROL DE CACHÉ DEPURABLE (PREVIEWS, PROXIES, TEMPORALES)
ALTER TABLE public."asset" ADD COLUMN IF NOT EXISTS "isCache" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS "idx_asset_is_cache" ON public."asset" ("isCache");
CREATE INDEX IF NOT EXISTS "idx_asset_user_cache" ON public."asset" ("userId", "isCache");
