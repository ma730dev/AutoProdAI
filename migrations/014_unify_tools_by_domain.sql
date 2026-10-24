-- ==============================================================================
-- AutoProd Infrastructure Migration: 014_unify_tools_by_domain.sql
-- Idempotent provisioning:
-- 1. Registro / Actualización de las 4 herramientas unificadas por dominio:
--    - workspace_control: Control unificado de carpetas y archivos en disco
--    - system_control: Diagnóstico local, SOPs y capacidades
--    - creative_studio: Síntesis de voz (TTS) y generación de arte/miniaturas (DALL-E)
--    - channel_memory: Extracción y consulta de memoria viva (InfoCanal)
-- 2. Vinculación de las 4 herramientas al agente orquestador
-- 3. Semilla de intenciones canónicas en toolIntentGolden (System 1 Router)
-- ==============================================================================

-- 1. REGISTRO DE LAS HERRAMIENTAS POR DOMINIO EN public."tool"

-- Herramienta 1: workspace_control
INSERT INTO public."tool" ("id", "name", "description", "schema", "apiEndpoint", "method", "createdAt")
VALUES
(
  gen_random_uuid(),
  'workspace_control',
  'Control y gestión unificada del workspace físico de AutoProd. Permite listar directorios de forma segura (sin 404s), crear carpetas para canales o proyectos de video, eliminar carpetas obsoletas, y leer o guardar archivos de configuración o guiones en disco.',
  '{
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "description": "Acción a ejecutar en el workspace.",
        "enum": ["listar", "crear_carpetas", "eliminar_carpetas", "leer_archivo", "guardar_archivo", "default"]
      },
      "path": {
        "type": "string",
        "description": "Ruta relativa o absoluta de la carpeta o archivo a consultar, crear, eliminar, leer o guardar."
      },
      "paths": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Lista de rutas relativas o absolutas de carpetas a crear de una sola vez."
      },
      "content": {
        "type": "string",
        "description": "Contenido en texto o markdown a guardar en el archivo (para guardar_archivo)."
      },
      "overwrite": {
        "type": "boolean",
        "description": "Indica si se debe sobreescribir el archivo en caso de que ya exista (por defecto true)."
      }
    },
    "required": ["action"]
  }'::jsonb,
  'http://localhost:3000/api/tools/workspace_control',
  'POST',
  now()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "schema" = EXCLUDED."schema",
  "apiEndpoint" = EXCLUDED."apiEndpoint",
  "method" = EXCLUDED."method";

-- Herramienta 2: system_control
INSERT INTO public."tool" ("id", "name", "description", "schema", "apiEndpoint", "method", "createdAt")
VALUES
(
  gen_random_uuid(),
  'system_control',
  'Control operativo del sistema AutoProd. Permite verificar el estado del motor local FastAPI en el puerto 8000, consultar directivas y prompts de producción (SOPs dinámicos) y obtener el resumen de capacidades del sistema.',
  '{
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "description": "Acción del sistema a ejecutar.",
        "enum": ["estado_sistema", "consultar_prompts", "capacidades"]
      },
      "tipo_prompt": {
        "type": "string",
        "description": "Tipo de prompt o directiva a consultar (ej: crear_video, crear_guion, miniatura, locucion)."
      },
      "categoria": {
        "type": "string",
        "description": "Categoría opcional del prompt (ej: PRODUCTION, BRIEFING, SYSTEM)."
      }
    },
    "required": ["action"]
  }'::jsonb,
  'http://localhost:3000/api/tools/system_control',
  'POST',
  now()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "schema" = EXCLUDED."schema",
  "apiEndpoint" = EXCLUDED."apiEndpoint",
  "method" = EXCLUDED."method";

-- Herramienta 3: creative_studio
INSERT INTO public."tool" ("id", "name", "description", "schema", "apiEndpoint", "method", "createdAt")
VALUES
(
  gen_random_uuid(),
  'creative_studio',
  'Estudio creativo multimedia de AutoProd. Sintetiza locuciones y voces en off profesionales (con ElevenLabs o OpenAI TTS) y genera miniaturas, portadas o recursos visuales en alta definición con DALL-E 3.',
  '{
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "description": "Acción creativa a realizar.",
        "enum": ["generar_locucion", "generar_imagen"]
      },
      "texto": {
        "type": "string",
        "description": "Texto del guion o diálogo a convertir en audio (para generar_locucion)."
      },
      "voz": {
        "type": "string",
        "description": "Identificador o nombre de la voz (para generar_locucion)."
      },
      "prompt": {
        "type": "string",
        "description": "Descripción visual detallada de la imagen a generar (para generar_imagen)."
      },
      "aspect_ratio": {
        "type": "string",
        "description": "Relación de aspecto: 16:9 (YouTube horizontal), 9:16 (Shorts/TikTok), 1:1 (cuadrado).",
        "enum": ["16:9", "9:16", "1:1"]
      },
      "tipo": {
        "type": "string",
        "description": "Tipo de recurso visual: THUMBNAIL, BANNER, LOGO o ASSET.",
        "enum": ["THUMBNAIL", "BANNER", "LOGO", "ASSET"]
      },
      "channel_name": {
        "type": "string",
        "description": "Nombre de la carpeta del canal al cual asociar el recurso multimedia."
      },
      "video_title": {
        "type": "string",
        "description": "Título de la carpeta del proyecto de video donde se guardará el resultado."
      }
    },
    "required": ["action"]
  }'::jsonb,
  'http://localhost:3000/api/tools/creative_studio',
  'POST',
  now()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "schema" = EXCLUDED."schema",
  "apiEndpoint" = EXCLUDED."apiEndpoint",
  "method" = EXCLUDED."method";

-- Herramienta 4: channel_memory
INSERT INTO public."tool" ("id", "name", "description", "schema", "apiEndpoint", "method", "createdAt")
VALUES
(
  gen_random_uuid(),
  'channel_memory',
  'Gestión y consulta de memoria contextual de canales. Permite extraer datos de referencia de canales de YouTube mediante yt-dlp y leer la memoria viva local (InfoCanal: Contexto_canal.md, Metricas_canal.md, Historial_canal.md).',
  '{
    "type": "object",
    "properties": {
      "action": {
        "type": "string",
        "description": "Acción de memoria a ejecutar.",
        "enum": ["extraer_canal_youtube", "leer_memoria_canal"]
      },
      "url_o_handle": {
        "type": "string",
        "description": "URL completa o handle (@ejemplo) del canal de YouTube a auditar (para extraer_canal_youtube)."
      },
      "channel_name": {
        "type": "string",
        "description": "Nombre de la carpeta del canal para consultar su memoria InfoCanal (para leer_memoria_canal)."
      },
      "seccion": {
        "type": "string",
        "description": "Sección específica a leer: CONTEXTO, METRICAS, HISTORIAL o TODAS.",
        "enum": ["CONTEXTO", "METRICAS", "HISTORIAL", "TODAS"]
      }
    },
    "required": ["action"]
  }'::jsonb,
  'http://localhost:3000/api/tools/channel_memory',
  'POST',
  now()
)
ON CONFLICT ("name") DO UPDATE SET
  "description" = EXCLUDED."description",
  "schema" = EXCLUDED."schema",
  "apiEndpoint" = EXCLUDED."apiEndpoint",
  "method" = EXCLUDED."method";


-- 2. VINCULAR LAS 4 HERRAMIENTAS AL AGENTE ORCHESTRADOR
INSERT INTO public."agentTool" ("id", "agentId", "toolId")
SELECT 
  gen_random_uuid(),
  a."id",
  t."id"
FROM public."agent" a, public."tool" t
WHERE a."slug" = 'orchestrator' 
  AND t."name" IN ('workspace_control', 'system_control', 'creative_studio', 'channel_memory')
ON CONFLICT ("agentId", "toolId") DO NOTHING;


-- 3. SEMILLA DE INTENCIONES CANÓNICAS (COLD START) PARA SYSTEM 1
INSERT INTO public."toolIntentGolden" ("toolName", "domain", "canonicalQuery", "isDirectFastPath", "confidenceThreshold")
VALUES
-- Dominio: SYSTEM / Capacidades y Bienvenida (Fast-Path ultra veloz < 15ms)
('capacidades_sistema', 'SYSTEM', '¿qué puedes hacer?', true, 0.78),
('capacidades_sistema', 'SYSTEM', '¿cómo funciona autoprod?', true, 0.78),
('capacidades_sistema', 'SYSTEM', '¿en qué me puedes ayudar?', true, 0.78),
('capacidades_sistema', 'SYSTEM', 'cuáles son tus capacidades', true, 0.78),
('capacidades_sistema', 'SYSTEM', 'dime qué herramientas tienes', true, 0.78),
('capacidades_sistema', 'SYSTEM', 'cómo empezar en autoprod', true, 0.78),
('capacidades_sistema', 'SYSTEM', 'ayuda con el sistema', true, 0.75),
('estado_sistema', 'SYSTEM', 'estado del sistema', true, 0.82),
('estado_sistema', 'SYSTEM', 'el motor está conectado', true, 0.82),

-- Dominio: WORKSPACE_FS / Control de archivos y carpetas
('listar_proyectos_workspace', 'WORKSPACE_FS', '¿qué canales tengo?', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'qué proyectos tengo', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'qué carpetas tengo', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'qué tengo en mi workspace', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'listar carpetas del workspace', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'ver mis proyectos en disco', true, 0.78),
('workspace_control', 'WORKSPACE_FS', 'crear carpeta para nuevo proyecto', false, 0.85),
('workspace_control', 'WORKSPACE_FS', 'crear carpetas de producción', false, 0.85),
('workspace_control', 'WORKSPACE_FS', 'eliminar carpeta', false, 0.88),
('workspace_control', 'WORKSPACE_FS', 'leer archivo del proyecto', false, 0.85),
('workspace_control', 'WORKSPACE_FS', 'guardar guion en archivo', false, 0.85),

-- Dominio: CREATIVE_STUDIO / Miniaturas y Locución
('creative_studio', 'CREATIVE_STUDIO', 'generar miniatura para video', false, 0.85),
('creative_studio', 'CREATIVE_STUDIO', 'crear portada con dall-e', false, 0.85),
('creative_studio', 'CREATIVE_STUDIO', 'generar locución para guion', false, 0.85),
('creative_studio', 'CREATIVE_STUDIO', 'sintetizar voz en off con elevenlabs', false, 0.85),

-- Dominio: CHANNEL_MEMORY / YouTube y Memoria
('channel_memory', 'CHANNEL_MEMORY', 'analizar canal de youtube de referencia', false, 0.85),
('channel_memory', 'CHANNEL_MEMORY', 'extraer métricas de un canal competidor', false, 0.85),
('channel_memory', 'CHANNEL_MEMORY', 'consultar adn del canal', false, 0.85),
('channel_memory', 'CHANNEL_MEMORY', 'ver historial de videos del canal', false, 0.85)

ON CONFLICT ("toolName", "canonicalQuery") DO UPDATE SET
  "domain" = EXCLUDED."domain",
  "isDirectFastPath" = EXCLUDED."isDirectFastPath",
  "confidenceThreshold" = EXCLUDED."confidenceThreshold";
