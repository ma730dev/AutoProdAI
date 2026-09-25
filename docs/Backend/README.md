# ⚙️ Documentación Backend: API Routes (Next.js) + Motor Local (Python)

## 📌 Resumen General
El backend está dividido en dos capas optimizadas para mantener el costo operativo en **$0 USD**:

1. **Cloud Backend (TypeScript — Next.js 16.3.3 API Routes / Vercel)**:
   * Gestiona autenticación de usuarios (Supabase Auth + Google OAuth).
   * Maneja el CRUD de Canales, Videos, Conversaciones y Mensajes mediante **Prisma 7.10** con `@prisma/adapter-pg`.
   * Implementa el **Chat Universal Multi-Provider** (`universalChatWithTools`) con soporte para Gemini, OpenAI y Anthropic.
   * Orquesta las **Herramientas del Cerebro** que ejecutan tareas avanzadas.
   * Gestiona API Keys cifradas en Supabase Vault.
   * Registra el consumo de tokens en la tabla `TokenUsage`.

2. **Motor Local (Python FastAPI — `localhost:8000`)**:
   * Controlador local que corre en la máquina del usuario.
   * Ejecuta operaciones de archivos en el workspace (`workspace`), procesamiento de video con FFmpeg (`video_looper`) y transcripción local con Faster-Whisper (`subtitles`).
   * Abre el explorador de archivos nativo del SO para selección de workspace.
   * CORS universal para conectar fluidamente con la app.

---

## 🔌 API Endpoints Cloud (Next.js API Routes)

### Autenticación (`/api/auth/`)

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/auth/sync` | POST | Sincroniza el usuario de Supabase Auth con la tabla `User` de PostgreSQL |
| `/api/auth/callback` | GET | Callback de Google OAuth |
| `/api/auth/me-role` | GET | Obtiene el rol del usuario autenticado |

### Chat Universal (`/api/chat`)

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/chat` | POST | Chat multi-provider con tool loop nativo de Vercel AI SDK. Parámetros: `messages`, `provider`, `model`, `workspacePath`, `channelId` |

**Patrón Agentic Orchestrator:**
1. Construye el System Prompt base. Si se envía un `channelId`, extrae de Prisma e inyecta dinámicamente las `contextRules` del canal.
2. Consulta en Prisma el Agente `isOrchestrator = true` y carga sus `tools` asociadas.
3. Convierte dinámicamente los JSON Schemas de la BD a Zod usando `jsonSchema` de `ai-core`.
4. Utiliza **Function Calling Nativo** (`generateText` con `maxSteps: 5`) para que Gemini/OpenAI/Anthropic interactúe con el Motor de Python, delegando exploración y edición del Workspace de manera autónoma.
5. Registro asíncrono de `TokenUsage` en la BD.

### Herramientas del Cerebro (`/api/tools/`)

Todas las acciones ejecutables del sistema se implementan como herramientas nativas consumidas por el Orquestador y el Frontend:

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/tools/prompts` | GET / POST | Consulta de plantillas y SOPs operativos (`consultar_prompts`) para el Orquestador y Frontend |
| `/api/tools/prompts/[id]` | PATCH / DELETE | Edición y eliminación dinámica de plantillas de prompts |
| `/api/tools/extraer_canal_youtube` | POST | Extrae videos, métricas, tags e indexa contexto pgvector y crea `InfoCanal/` local |
| `/api/tools/crear_canal` | POST | Valida plan, registra en BD y crea `InfoCanal/` con sus 4 archivos esenciales |
| `/api/tools/generar_info_canal` | POST | Alias retrocompatible que delega a `crear_canal` |
| `/api/tools/generar_locucion` | POST | Genera narraciones con Edge-TTS ($0) u OpenAI TTS |
| `/api/tools/estado_sistema` | POST | Diagnóstico de dependencias locales instaladas |

### CRUD de Datos

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/conversations` | GET | Lista conversaciones del usuario |
| `/api/conversations` | POST | Crea conversación con systemPrompt + mensaje de bienvenida dinámico |
| `/api/conversations` | DELETE | Elimina todas las conversaciones y mensajes del usuario |
| `/api/conversations/[id]/messages` | GET/POST | CRUD de mensajes de una conversación |
| `/api/channels` | GET | Lista canales del usuario con sus videos |

### Configuración

| Endpoint | Método | Descripción |
|---|---|---|
| `/api/settings/keys` | * | Gestión de API Keys: encriptación en Supabase Vault, persistencia de secretId en tabla `User` |
| `/api/setup/install` | POST | Instalación del motor local Python |
| `/api/setup/shutdown` | POST | Apagado remoto del motor local |

---

## 🔌 API Endpoints Motor Local (Python FastAPI — Puerto 8000)

### Workspace (`/workspace/`)

| Endpoint | Método | Descripción |
|---|---|---|
| `/workspace/` | GET | Lista recursiva del workspace (árbol hasta 4 niveles). Query param: `base_path` |
| `/workspace/pick` | GET | Abre explorador de archivos nativo del SO para seleccionar carpeta |
| `/workspace/create` | POST | Crea carpeta + subcarpetas. Body: `target_path`, `folder_name`, `subfolders[]` |
| `/workspace/file` | GET | Lee contenido de archivo `.md`/`.txt`. Query param: `path` |
| `/workspace/file` | POST | Guarda/sobrescribe archivo `.md`/`.txt`. Body: `path`, `content` |
### Sistema

| Endpoint | Método | Descripción |
|---|---|---|
| `/status` | GET | Health check del motor local |
| `/shutdown` | POST | Apaga el servidor matando el proceso |

---

## 🔐 Auth Guard — `lib/auth.ts`

Patrón de doble verificación para mínima latencia:
1. **Fast path (0ms):** Parsea las cookies SSR de Supabase, concatena chunks, decodifica base64/JWT y extrae `sub` + `email` del payload.
2. **Fallback seguro:** Si falla el fast path, llama a `supabase.auth.getUser()` por red.

---

## 📊 Token Usage Tracking

Cada respuesta del chat cloud registra:
- `provider` (gemini, openai, anthropic)
- `modelName` (ej: gemini-3.6-flash, gpt-4o)
- `promptTokens`, `completionTokens`, `totalTokens`
- `userId`, `conversationId` (opcional)

El registro es fire-and-forget (`.catch()` silencioso) para no bloquear la respuesta HTTP.
