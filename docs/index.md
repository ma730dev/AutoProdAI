# 📚 Índice Maestro de Documentación (AutoProd)

**⚠️ ATENCIÓN AGENTES DE IA (Gemini, Claude, Cursor, Windsurf):**
Si estás leyendo esto, es porque has sido instruido a consultar el contexto del repositorio antes de proponer cambios, escribir código o crear nuevas funcionalidades. **ESTE ES TU PUNTO DE PARTIDA OBLIGATORIO.**

## 🧠 ¿Cómo entender este repositorio?

> **Definición Oficial de Producto:**  
> **AutoProd es el sistema operativo para canales de contenido.**  
> Un espacio donde los creadores y operadores de canales organizan sus proyectos, desarrollan ideas, producen contenido con sus propios recursos, analizan resultados y construyen un workflow que se adapta a su forma de crear.

> **Manifiesto:**  
> *«La automatización no reemplaza al creador. Le devuelve tiempo para crear.»*  
> *«Automatiza el trabajo. Conserva el control.»*

### Los 4 Pilares del Sistema:
- **CREA:** Convierte ideas en contenido con intención (temas, guiones y portadas respetando la identidad del canal).
- **PRODUCE:** Ensamble audiovisual, bucles de 1 a 3 horas, clips y subtítulos en un solo lugar.
- **ANALIZA:** Referencias de nicho, enfoques temáticos y memoria histórica de contenidos cubiertos.
- **ESCALA:** Gestión multicanal ordenada, cronograma de producción y workflow predecible sin tareas mecánicas.

Para lograr una plataforma ágil, privada y sin costos exorbitantes de servidor, AutoProd opera bajo una arquitectura híbrida de dos capas:

1. **Frontend / Backend Cloud (Next.js):** Maneja la interfaz de usuario estilo IDE (TailwindCSS v4), autenticación (Supabase SSR), base de datos (Prisma) y orquestación inteligente de asistencia creativa.
2. **Motor de Procesamiento Local (FastAPI Python):** La ventaja de ejecución (*"Tu contenido. Tu equipo. Tu control"*). Corre directamente en la máquina del usuario (`localhost:8000`), permitiendo renderizar video en 4K y procesar subtítulos a costo de servidor cero para AutoProd y con máxima privacidad para el usuario.

---

## 📂 Mapa de Contextos y Funcionalidades

Antes de modificar cualquier parte del sistema, **DEBES** leer el `.md` correspondiente a la funcionalidad o área que vas a afectar. 

### 🌟 Funcionalidades Específicas & Master Tracker (`docs/features/`)
Esta carpeta contiene el detalle de las mecánicas centrales y el seguimiento de producto.
👉 **[🎯 Master Feature Tracker & Product Backlog](file:///e:/autoprod/docs/features/README.md):** Tablero de control de alcance, estado de tareas (`✅ HECHO`, `🔄 EN PROGRESO`, `📋 PLANIFICADO`, `💡 IDEA`) y banco de ideas.

#### 🏛️ Contexto Macro de AutoProd
- 📄 **[Documento Ejecutivo & SRS de AutoProd](file:///e:/autoprod/docs/SRS_AUTOPROD_EJECUTIVO.md):** Especificación formal de requerimientos, modelo $0 Server Cost, arquitectura híbrida y gobernanza.
- 🚀 **[AutoProd: Ficha Técnica Macro](file:///e:/autoprod/docs/features/AutoProd/ficha_tecnica.md)** \| **[AutoProd: Idea (Lo que Tenemos vs. Hacia Dónde Vamos)](file:///e:/autoprod/docs/features/AutoProd/idea.md)**: Arquitectura completa de 2 capas y la visión estratégica para creadores y agencias.

#### 📦 Módulos Específicos
- 🤖 **Agentic Orchestrator:** [Ficha Técnica](file:///e:/autoprod/docs/features/agentic_orchestrator/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/agentic_orchestrator/idea.md)
- 🎬 **Video Studio & Timeline Pro (con Looper Integrado):** [Ficha Técnica](file:///e:/autoprod/docs/features/video_looper/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/video_looper/idea.md)
- 🎧 **Subtitulador Whisper & Hardware Governor:** [Ficha Técnica](file:///e:/autoprod/docs/features/subtitles_whisper/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/subtitles_whisper/idea.md)
- ⚙️ **Local Motor (FastAPI):** [Ficha Técnica](file:///e:/autoprod/docs/features/local_motor/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/local_motor/idea.md)
- 📁 **Folder CRUD:** [Ficha Técnica](file:///e:/autoprod/docs/features/folder_crud/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/folder_crud/idea.md)
- 🔐 **Auth Guard & JWT:** [Ficha Técnica](file:///e:/autoprod/docs/features/auth_guard/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/auth_guard/idea.md)
- 📊 **Token Tracker:** [Ficha Técnica](file:///e:/autoprod/docs/features/token_tracker/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/token_tracker/idea.md)
- 📺 **YouTube Channel Extractor:** [Ficha Técnica](file:///e:/autoprod/docs/features/youtube_channel_extractor/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/youtube_channel_extractor/idea.md)
- 💳 **Subscriptions, Billing & Token Economics:** [Ficha Técnica](file:///e:/autoprod/docs/features/subscriptions_and_billing/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/subscriptions_and_billing/idea.md)
- 🗃️ **Biblioteca de Recursos (Asset Library & CRUD):** [Ficha Técnica](file:///e:/autoprod/docs/features/asset_library/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/asset_library/idea.md)
- 🎨 **Estudio de Imágenes (Image Studio):** [Ficha Técnica](file:///e:/autoprod/docs/features/image_generator/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/image_generator/idea.md)
- 🏛️ **Gobernanza de Canales (FEAT-12):** [Ficha Técnica](file:///e:/autoprod/docs/features/channel_governance/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/channel_governance/idea.md)
- 🚀 **Rediseño Integral de Frontend (FEAT-13):** [Ficha Técnica](file:///e:/autoprod/docs/features/landing_and_console_revamp/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/landing_and_console_revamp/idea.md)
- 🛡️ **Anti-Abuso, Rate Limiting & HMAC IP Hashing (FEAT-14):** [Ficha Técnica](file:///e:/autoprod/docs/features/anti_abuse_and_rate_limit/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/anti_abuse_and_rate_limit/idea.md)
- 🎙️ **Text-to-Speech Multi-Motor (FEAT-15):** [Ficha Técnica](file:///e:/autoprod/docs/features/text_to_speech/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/text_to_speech/idea.md)
- 🎬 **Orquestación de Canales & Interactive Question Cards (FEAT-16):** [Ficha Técnica](file:///e:/autoprod/docs/features/channel_and_video_orchestration/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/channel_and_video_orchestration/idea.md)
- 📦 **Instalador Oficial Standalone (FEAT-17):** [Ficha Técnica](file:///e:/autoprod/docs/features/standalone_installer/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/standalone_installer/idea.md)
- 🎥 **VideoProjects, Hub & Cuentas Vinculadas (FEAT-18):** [Ficha Técnica](file:///e:/autoprod/docs/features/video_projects/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/video_projects/idea.md)
- 🧠 **Router Semántico Jerárquico & Telemetría Flywheel (FEAT-19):** [Ficha Técnica](file:///e:/autoprod/docs/features/semantic_router_and_telemetry/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/semantic_router_and_telemetry/idea.md)
- ✨ **Orquestación Creativa, Briefing de Ideación, Negociación de Créditos & Tool generar_imagen (FEAT-20):** [Ficha Técnica](file:///e:/autoprod/docs/features/creative_orchestration_and_image_tools/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/creative_orchestration_and_image_tools/idea.md)
- 🏛️ **Gobernanza de Espacio de Trabajo, Rama youtube & Límites de Canales (FEAT-21):** [Ficha Técnica](file:///e:/autoprod/docs/features/workspace_governance_and_channel_limits/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/workspace_governance_and_channel_limits/idea.md)
- 🎵 **Generador de Música IA & Soundscapes (IDEA):** [Ficha Técnica](file:///e:/autoprod/docs/features/music_generator/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/music_generator/idea.md)
- 📹 **AI Video Studio & B-Roll Auto-Finder (IDEA):** [Ficha Técnica](file:///e:/autoprod/docs/features/ai_video_and_broll/ficha_tecnica.md) \| [Idea & Escalabilidad](file:///e:/autoprod/docs/features/ai_video_and_broll/idea.md)


### 🏛️ Arquitectura General (`docs/`)
- 🖥️ **[Frontend (UI)](file:///e:/autoprod/docs/frontend/README.md):** Componentes React, Tailwind v4, drag handlers.
- 🌐 **[Backend (Next.js)](file:///e:/autoprod/docs/backend/README.md):** API Routes, Supabase, Vercel AI SDK.
- 🗄️ **[Base de Datos (Prisma)](file:///e:/autoprod/docs/database/README.md):** Esquemas, migraciones, sincronización con auth de Supabase.
- 🛡️ **[Seguridad & Compatibilidad Multiplataforma](file:///e:/autoprod/docs/architecture/security_and_compatibility.md):** Estándares de rutas, I/O seguro en Python/Next.js y prevención de Directory Traversal.
- 🎯 **[Master Feature Tracker](file:///e:/autoprod/docs/features/README.md):** Control central de alcance, estado y banco de ideas.
- 🔧 **[Catálogo de Funciones & Protocolo de Ideas](file:///e:/autoprod/docs/functions/README.md):** Herramientas activas del Orquestador, sub-agentes y lista de capacidades **no implementadas**. Si el usuario pide algo que no existe aquí, el agente DEBE preguntar si quiere gestionarlo.

---

## 🛑 Reglas para Agentes (Tus Instrucciones)

1. **Expón tu contexto primero:** Antes de ejecutar acciones, escribir código o crear un plan de implementación, DEBES explicar claramente al usuario cuál es tu contexto actual, por qué estás tomando esas decisiones y cómo se alinean con la arquitectura de AutoProd. Muestra tu razonamiento ("una ventana de contexto") para que el usuario valide que estás en sintonía.
2. **Lee antes de escribir:** Nunca asumas cómo funciona una funcionalidad. Ve al link correspondiente arriba y léela.
3. **Documenta siempre:** Si creas o modificas una funcionalidad, al finalizar DEBES crear su carpeta en `docs/features/{tu_feature}/`, registrar su `ficha_tecnica.md` e `idea.md`, y agregarlo al tracker en `docs/features/README.md` y a este índice `docs/index.md`.
4. **Estructura Estándar Dual para features:** Cada carpeta dentro de `docs/features/{tu_feature}/` DEBE contener:
   - **`ficha_tecnica.md`:** Código real detrás de la función (endpoints, modelos, archivos exactos, rendimiento y capacidades `✅ HECHAS`).
   - **`idea.md`:** Visión de negocio, propósito del creador, capacidades `⏳ FALTANTES` y banco de ideas de escalabilidad.
5. **Protocolo de ideas no implementadas:** Si el usuario menciona una capacidad que **no existe** en el [Catálogo de Funciones](file:///e:/autoprod/docs/functions/README.md), DEBES:
   - Notificarle que esa funcionalidad no está implementada aún.
   - Preguntarle si quiere que la gestionemos: registrarla en el Master Tracker (`docs/features/README.md`) y/o crear su carpeta `docs/features/{slug}/` con `idea.md`.
   - **Nunca improvisar código ni asumir que existe un endpoint para algo que no está catalogado.**
6. **Soberanía y Exclusividad de Ejecución de Arneses (`harness/`):**
   - **PROHIBIDO** para el agente ejecutar comandos de despliegue, migración o compilación de arneses (`pnpm db:migrate`, `pnpm deploy:prod`, `pnpm build:exe`, etc.) de forma autónoma.
   - El agente puede crear, refactorizar y documentar el código de los arneses, pero **su ejecución queda reservada exclusivamente al usuario humano** desde su consola.
