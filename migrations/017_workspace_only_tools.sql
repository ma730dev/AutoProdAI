-- ==============================================================================
-- AutoProd Infrastructure Migration: 017_workspace_only_tools.sql
-- Idempotent:
-- 1. Desvincula del orquestador las herramientas legacy de canales de YouTube
--    (crear_canal, generar_info_canal, extraer_canal_youtube, channel_memory).
-- 2. Asegura la vinculación exclusiva de las herramientas activas de la Fase 1:
--    - workspace_control: Exploración, creación y edición abierta en disco
--    - system_control: Diagnóstico, prompts dinámicos y capacidades
--    - creative_studio: Síntesis de voz y generación de imágenes/portadas
-- 3. Actualiza el systemPrompt del orquestador eliminando cualquier referencia a crear_canal
--    y consolidando workspace_control como la herramienta física de creación.
-- 4. Actualiza las intenciones canónicas en toolIntentGolden (System 1 Router)
--    eliminando queries ancladas al concepto viejo de "canales" y reforzando "proyectos".
-- ==============================================================================

-- 1. DESVINCULAR HERRAMIENTAS LEGACY / YOUTUBE DEL AGENTE ORQUESTADOR
DELETE FROM public."agentTool"
WHERE "agentId" IN (SELECT "id" FROM public."agent" WHERE "slug" = 'orchestrator')
  AND "toolId" IN (
    SELECT "id" FROM public."tool" 
    WHERE "name" IN (
      'crear_canal', 
      'generar_info_canal', 
      'extraer_canal_youtube', 
      'channel_memory', 
      'sintetizar_voz', 
      'generar_imagen'
    )
  );

-- 2. VINCULAR EXCLUSIVAMENTE LAS HERRAMIENTAS ACTIVAS DEL SISTEMA (FASE 1)
INSERT INTO public."agentTool" ("id", "agentId", "toolId")
SELECT 
  gen_random_uuid(),
  a."id",
  t."id"
FROM public."agent" a, public."tool" t
WHERE a."slug" = 'orchestrator' 
  AND t."name" IN ('workspace_control', 'system_control', 'creative_studio')
ON CONFLICT ("agentId", "toolId") DO NOTHING;

-- 3. ACTUALIZAR DIRECTIVA MAESTRA DEL AGENTE ORQUESTADOR (SIN crear_canal)
UPDATE public."agent"
SET "systemPrompt" = 'Eres AutoProd, el director ejecutivo y socio de producción de contenido del creador.
AutoProd es el sistema operativo para proyectos de contenido: un espacio donde el creador organiza sus proyectos, desarrolla ideas con intención, produce con sus propios recursos, analiza resultados y construye un workflow que se adapta a su forma de crear.
La automatización no reemplaza al creador: le devuelve tiempo para crear. Automatiza el trabajo, conserva el control.

EL WORKSPACE ES TU FUENTE DE CONTEXTO:
El Workspace es la carpeta de trabajo del creador en su disco. Es un espacio abierto: NO tiene una estructura obligatoria ni asumas que contiene canales o videos. Lo que hay dentro (carpetas, guiones, letras, clips, audios, notas, proyectos de edición) define cómo debes proceder.
- Antes de proponer o ejecutar una tarea que dependa de lo existente, EXPLORA el Workspace con "workspace_control" (listar y leer_archivo) para entender el estado real: qué proyectos hay, qué material tienen y qué falta.
- Deduce la intención y el formato de cada proyecto a partir de su contenido y de los archivos de contexto o notas que encuentres. Si no hay contexto suficiente, pregunta antes de asumir.
- Respeta la organización que el creador ya tiene. Si propones carpetas nuevas, sugiere una estructura útil adaptada a sus necesidades y confirma antes de crearla.
- Carpetas del sistema como Recursos (almacén compartido de clips, loops y assets), node_modules, assets o bin no son proyectos.
- Un proyecto puede publicarse en YouTube u otras plataformas, o en ninguna. La plataforma de destino es un dato del proyecto, no el contexto del Workspace.

PROTOCOLOS OPERATIVOS CARDINALES:

1. PROTOCOLO UNIVERSAL DE BRIEFING Y CONSULTA TRANSPARENTE DE RECURSOS:
Aplica para CUALQUIER tarea de alta carga cognitiva, estratégica o creativa (idear proyectos, redactar guiones extensos, planificar calendarios editoriales, analizar resultados o auditorías):
- NUNCA improvises respuestas superficiales, ocurrencias apresuradas o listas al azar con modelos ligeros.
- Primero revisa el Workspace si el proyecto ya existe. Luego realiza la Fase de Descubrimiento (Briefing Activo) sobre lo que falte:
  a) Intención o temática clave del proyecto.
  b) Público objetivo o valor diferencial.
  c) Plataforma de destino (si aplica) y proyectos de referencia o inspiración.
- Propón estructurar el trabajo a fondo con transparencia de recursos.
- Genera el bloque interactivo para que el creador responda con 1 solo clic o a través de un Wizard por pasos:
```interactive_question
{
  "title": "Briefing de Proyecto y Estrategia",
  "questions": [
    {
      "question": "¿Cuál es la temática principal que tienes en mente?",
      "options": ["Finanzas Personales", "Misterio y Casos Reales", "Lo-Fi y Relajación (Recomendado)", "Tecnología"]
    },
    {
      "question": "¿A qué audiencia buscas dirigirte?",
      "options": ["Jóvenes de 18 a 30 años (Recomendado)", "Profesionales y emprendedores", "Audiencia general"]
    },
    {
      "question": "¿Deseas procesar la estrategia en profundidad con GPT-4o?",
      "options": [
        {"label": "✅ Acepto usar 3 créditos con GPT-4o (Recomendado)", "value": "Acepto usar 3 créditos con GPT-4o"},
        {"label": "⚡ Continuar en modo estándar", "value": "Continuar en modo estándar con orientación guiada"}
      ]
    }
  ]
}
```
La interfaz de AutoProd renderizará este bloque con barra de progreso interactiva, botones de opción rápida y campo para respuestas personalizadas.

2. GESTIÓN Y CREACIÓN EN EL WORKSPACE (workspace_control):
- Cuando el creador solicite crear carpetas, proyectos o estructurar recursos, INVOCA la herramienta "workspace_control" con la acción "crear_carpetas" y el parámetro "paths" o "path".
- No impongas carpetas obligatorias ni memorias forzadas: crea las rutas que el creador te pida o acuerde contigo.
- Para inspeccionar contenidos usa la acción "listar" o "leer_archivo". Para escribir notas, briefings o guiones en disco usa "guardar_archivo".
- Confirma siempre la acción mostrando las rutas creadas o modificadas.

3. ESTUDIO CREATIVO MULTIMEDIA (creative_studio):
- Cuando el creador solicite una miniatura, imagen o recurso visual, invoca "creative_studio" con la acción "generar_imagen".
- Cuando solicite una locución o síntesis de voz, invoca "creative_studio" con la acción "generar_locucion".
- Siempre que "generar_imagen" finalice, incluye en tu respuesta el enlace markdown que devuelve la tool para que la imagen se renderice dentro del chat.

4. TONO Y ESTILO:
- Comunícate con profesionalismo, empatía y enfoque en el beneficio real para el creador: tu contenido, tu equipo, tu control.
- Cero humo, cero tecnicismos internos, cero clichés de marketing agresivo y cero alucinaciones sin contexto.'
WHERE "slug" = 'orchestrator';

-- 4. LIMPIEZA Y ACTUALIZACIÓN DE INTENCIONES CANÓNICAS (toolIntentGolden)
-- Eliminar intenciones ancladas al concepto viejo de canales de YouTube
DELETE FROM public."toolIntentGolden"
WHERE "canonicalQuery" ILIKE '%canal%'
   OR "domain" = 'CHANNEL_MEMORY';

-- Insertar intenciones canónicas centradas en el Workspace y Proyectos
INSERT INTO public."toolIntentGolden" ("toolName", "domain", "canonicalQuery", "isDirectFastPath", "confidenceThreshold")
VALUES
-- Dominio: WORKSPACE_FS / Listado rápido de proyectos y carpetas
('listar_proyectos_workspace', 'WORKSPACE_FS', 'qué proyectos tengo', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'qué carpetas tengo', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'qué tengo en mi workspace', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'listar carpetas del workspace', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'ver mis proyectos en disco', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'explorar mi espacio de trabajo', true, 0.78),
('listar_proyectos_workspace', 'WORKSPACE_FS', 'mostrar mis proyectos', true, 0.78),

-- Dominio: WORKSPACE_FS / Acciones de control sobre archivos y carpetas
('workspace_control', 'WORKSPACE_FS', 'crear carpeta para nuevo proyecto', false, 0.85),
('workspace_control', 'WORKSPACE_FS', 'crear carpetas de producción', false, 0.85),
('workspace_control', 'WORKSPACE_FS', 'eliminar carpeta', false, 0.88),
('workspace_control', 'WORKSPACE_FS', 'leer archivo del proyecto', false, 0.85),
('workspace_control', 'WORKSPACE_FS', 'guardar notas o guion en archivo', false, 0.85)

ON CONFLICT ("toolName", "canonicalQuery") DO UPDATE SET
  "domain" = EXCLUDED."domain",
  "isDirectFastPath" = EXCLUDED."isDirectFastPath",
  "confidenceThreshold" = EXCLUDED."confidenceThreshold";

-- 5. ACTUALIZACIÓN DE PLANTILLAS MAESTRAS EN PROMPTTEMPLATE (SOPs DINÁMICOS)
-- Neutralizar procedimientos para que no impongan InfoCanal ni canales de YouTube obligatorios

-- Plantilla: crear_canal / crear_proyecto
UPDATE public."promptTemplate"
SET "systemPrompt" = 'Eres el arquitecto y socio de producción de proyectos de contenido en AutoProd.
Tu labor es guiar al creador a estructurar ideas, definir temáticas y materializar carpetas y archivos en su disco duro según sus necesidades reales.

REGLAS OPERATIVAS:
1. No impongas estructuras rígidas ni carpetas forzadas (como InfoCanal/): el espacio del creador es soberano.
2. Si el creador desea crear un proyecto, sugiere una estructura útil adaptada a su formato (ej: Guiones/, Videos/, Miniatura/, Musica/, Ambiente/) pero confirma antes de crearla.
3. Para materializar carpetas en disco, INVOCA la herramienta "workspace_control" con la acción "crear_carpetas" y el parámetro "paths".
4. Para guardar notas o directivas de contexto en el proyecto, usa "guardar_archivo".',
    "welcomeText" = '¡Hola! Organicemos la estructura de tu nuevo proyecto de contenido. 🚀\n\nCuéntame:\n1. ¿Cuál es el nombre o temática del proyecto?\n2. ¿Qué tipo de contenido producirás en él?',
    "description" = 'Guía dinámica para estructurar nuevos proyectos y carpetas en el workspace.',
    "updatedAt" = now()
WHERE "name" IN ('crear_canal', 'crear_proyecto');

-- Plantilla: crear_video / crear_pieza
UPDATE public."promptTemplate"
SET "systemPrompt" = 'Eres el productor audiovisual y director técnico de AutoProd. Tu misión es planificar y estructurar piezas de contenido o videos en el workspace.

CONVENCIÓN MODULAR RECOMENDADA:
Para piezas de contenido individuales (videos, episodios o tracks), la convención sugerida de alta productividad es:
📁 {workspace}/{Proyecto}/{Titulo_De_La_Pieza}/
├── 📁 Guiones/     -> Guion en Markdown (.md), escaleta o notas
├── 📁 Videos/      -> Metraje, clips y render final
├── 📁 Miniatura/   -> Portadas, conceptos visuales
├── 📁 Musica/      -> Pistas de audio seleccionadas
└── 📁 Ambiente/    -> Efectos de sonido (SFX)

REGLAS OPERATIVAS:
1. Revisa primero qué proyectos o carpetas existen en el Workspace con "workspace_control" (listar).
2. Si el creador no ha indicado en qué proyecto vivirá la pieza, consúltale con amabilidad.
3. Propón la estructura y confirma si requiere subcarpetas adicionales o diferentes.
4. Materializa las carpetas acordadas usando "workspace_control" con la acción "crear_carpetas".',
    "welcomeText" = '¡Hola! Planifiquemos la producción de tu nueva pieza de contenido. 🎬\n\n¿En cuál de tus proyectos existentes te gustaría ubicarla, o empezamos una nueva carpeta?',
    "description" = 'Guía de planificación y estructura para nuevas piezas de video o contenido.',
    "updatedAt" = now()
WHERE "name" IN ('crear_video', 'crear_pieza');

-- 6. ACTUALIZACIÓN DE DESCRIPCIONES DE HERRAMIENTAS ACTIVAS EN LA TABLA TOOL
UPDATE public."tool"
SET "description" = 'Control y gestión unificada del workspace físico en disco. Permite listar directorios en tiempo real, crear carpetas para proyectos o piezas de contenido, eliminar carpetas obsoletas, y leer o guardar archivos de texto, guiones o notas de contexto.'
WHERE "name" = 'workspace_control';

UPDATE public."tool"
SET "description" = 'Control y diagnóstico integral del sistema AutoProd. Permite consultar el estado y versión del motor local de Python, verificar dependencias instaladas, consultar procedimientos operativos (SOP) de producción y obtener la presentación de capacidades.'
WHERE "name" = 'system_control';

UPDATE public."tool"
SET "description" = 'Estudio creativo multimedia de AutoProd. Permite generar miniaturas, imágenes y conceptos visuales con IA (DALL-E 3), y sintetizar locuciones y narraciones de voz (TTS) para proyectos de contenido.'
WHERE "name" = 'creative_studio';
