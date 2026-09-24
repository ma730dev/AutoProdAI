# 🎨 Documentación Front-End: Web App

## 📌 Resumen General
La capa de presentación es una aplicación web desarrollada en **Next.js 16.3.3** (App Router, Turbopack) con **React 19.2.8**, estilizada con **TailwindCSS v4** y feedback via **Sonner**. La interfaz es bilingüe (ES/EN) con un diseño oscuro premium de paneles redimensionables estilo IDE.

---

## 🛠️ Tecnologías y Librerías

| Paquete | Versión | Uso |
|---|---|---|
| `next` | 16.3.3 | Framework (App Router, Turbopack) |
| `react` / `react-dom` | 19.2.8 | Librería de componentes |
| `tailwindcss` + `@tailwindcss/postcss` | v4 | Estilos responsivos y tema oscuro |
| `@tailwindcss/typography` | 0.5.20 | Tipografía para contenido Markdown |
| `sonner` | 2.0.8 | Toast notifications flotantes |
| `react-markdown` | 10.1.0 | Renderizado de respuestas Markdown del chat |
| `remark-gfm` | 4.0.1 | Soporte de GitHub Flavored Markdown |
| `ai` | 7.0.83 | Vercel AI SDK (streamUI, generateText) |
| `@ai-sdk/google` | 4.0.56 | Provider Gemini |
| `@ai-sdk/openai` | 4.0.50 | Provider OpenAI |
| `@ai-sdk/anthropic` | 4.0.44 | Provider Anthropic |
| `@supabase/ssr` | 0.12.5 | Auth SSR |
| `@supabase/supabase-js` | 2.112.4 | Cliente Supabase |
| `zod` | 4.4.3 | Validación de esquemas |

---

## 📐 Layout de 3 Paneles (IDE Style)

El dashboard implementa un layout de 3 columnas redimensionables con drag handlers nativos:

### 1. Panel Izquierdo — Navegación y Contexto
Componentes:
- **[`ConversationSidebar.tsx`](file:///e:/AutoProd/components/dashboard/ConversationSidebar.tsx)**: Lista de conversaciones con búsqueda, selección y acciones (crear, eliminar).
- **[`Launchpad.tsx`](file:///e:/AutoProd/components/dashboard/Launchpad.tsx)**: Tarjetas de inicio rápido ("Crear Canal 📺", "Crear Video 🎬", "Crear Guion 📄") que buscan `PromptTemplate` en BD y crean conversaciones con `systemPrompt` y `welcomeText` personalizados.

### 2. Panel Central — Chat Co-Pilot Multi-Provider
Componente principal:
- **[`ChatPanel.tsx`](file:///e:/AutoProd/components/dashboard/ChatPanel.tsx)**: Interfaz de chat con:
  - Selector de provider (Gemini, OpenAI, Anthropic).
  - Selector de modelo (ej: `gemini-3.6-flash`, `gpt-4o`).
  - Selector de workspace (conectado al Motor Python via `WorkspaceModal`).
  - Historial de mensajes con renderizado Markdown.
  - Envío de mensajes al endpoint `/api/chat`.

### 3. Panel Derecho — Inspector y Archivos
Componentes:
- **[`RightInspector.tsx`](file:///e:/AutoProd/components/dashboard/RightInspector.tsx)**: Panel inspector con información contextual.
- **[`FileTree.tsx`](file:///e:/autoprod/components/workspace/FileTree.tsx)**: Árbol de archivos del workspace (conectado al Motor Python en puerto 8000).
- **[`FilePreviewer.tsx`](file:///e:/autoprod/components/workspace/FilePreviewer.tsx)**: Vista previa de archivos del workspace.
- **[`MarkdownEditor.tsx`](file:///e:/autoprod/components/workspace/MarkdownEditor.tsx)**: Editor de archivos Markdown con guardado al Motor Python.

---

## 🧩 Catálogo Completo de Componentes

### Arquitectura Modular por Funcionalidad (`components/`)

El frontend de AutoProd sigue una **Arquitectura Guiada por Características (Feature-Driven Architecture)**, donde cada módulo principal reside en su propia carpeta con su componente principal en la raíz:

| Funcionalidad / Dominio | Carpeta | Componente Principal | Subcomponentes y Recursos |
|---|---|---|---|
| **Video Studio & Timeline** | `components/video-studio/` | [`VideoStudio.tsx`](file:///e:/autoprod/components/video-studio/VideoStudio.tsx) | `ProjectHub.tsx`, `timeline/TimelinePro.tsx`, `VideoSubtitlesStudio.tsx`, `VideoLooperStudio.tsx` |
| **Chat & Orquestador** | `components/chat/` | [`ChatPanel.tsx`](file:///e:/autoprod/components/chat/ChatPanel.tsx) | `ConversationSidebar.tsx`, `InteractiveQuestionCard.tsx` |
| **Explorador & Workspace** | `components/workspace/` | [`FileTree.tsx`](file:///e:/autoprod/components/workspace/FileTree.tsx) | `FilePreviewer.tsx`, `MarkdownEditor.tsx` |
| **Estudio de Imágenes** | `components/image-studio/` | [`ImageStudio.tsx`](file:///e:/autoprod/components/image-studio/ImageStudio.tsx) | Generador de imágenes y miniaturas DALL-E |
| **Text to Speech Studio** | `components/tts-studio/` | [`TextToSpeechStudio.tsx`](file:///e:/autoprod/components/tts-studio/TextToSpeechStudio.tsx) | Síntesis de voz multi-motor (Edge-TTS / OpenAI) |
| **Biblioteca de Recursos** | `components/asset-library/` | [`AssetLibraryView.tsx`](file:///e:/autoprod/components/asset-library/AssetLibraryView.tsx) | Gestión de assets, almacenamiento y vaciado de caché |
| **Cuentas Vinculadas** | `components/channels/` | [`LinkedAccountsView.tsx`](file:///e:/autoprod/components/channels/LinkedAccountsView.tsx) | Conexión OAuth 2.0 y sincronización de ContentHistory |
| **Modales Globales** | `components/modals/` | — | `UserSettingsModal.tsx`, `SubscriptionPlansModal.tsx`, `WorkspaceModal.tsx`, `ConfirmDeleteModal.tsx`, `PreExecutionEstimateModal.tsx` |
| **Shell & Dashboard Layout** | `components/dashboard/` | [`Launchpad.tsx`](file:///e:/autoprod/components/dashboard/Launchpad.tsx) | `ProfileDropdown.tsx`, `CreditCounter.tsx`, `RightInspector.tsx`, `types.ts` |


### Agentes (`components/agents/`)

| Componente | Archivo | Descripción |
|---|---|---|
| ChannelCreatorConsole | [`ChannelCreatorConsole.tsx`](file:///e:/AutoProd/components/agents/ChannelCreatorConsole.tsx) | Consola de creación de canales con interfaz paso a paso |

### Auth (`components/auth/`)

| Componente | Archivo | Descripción |
|---|---|---|
| GoogleLoginButton | [`GoogleLoginButton.tsx`](file:///e:/AutoProd/components/auth/GoogleLoginButton.tsx) | Botón de login via Google OAuth (Supabase Auth) |

---

## 📄 Páginas

| Página | Ruta | Archivo | Descripción |
|---|---|---|---|
| Landing | `/` | [`app/page.tsx`](file:///e:/AutoProd/app/page.tsx) | Página pública con diseño oscuro (gradientes púrpura/índigo). Secciones: Hero, Features Grid, How It Works, Footer. Bilingüe ES/EN. |
| Login | `/login` | [`app/login/`](file:///e:/AutoProd/app/login) | Autenticación Google OAuth via Supabase Auth |
| Dashboard | `/dashboard` | [`app/dashboard/page.tsx`](file:///e:/AutoProd/app/dashboard/page.tsx) | Dashboard principal con layout IDE de 3 paneles redimensionables |
| Admin | `/admin` | [`app/admin/`](file:///e:/AutoProd/app/admin) | Panel de administración |

---

## 🌐 Sistema Bilingüe

Implementado en [`app/translations.ts`](file:///e:/AutoProd/app/translations.ts):
- Soporte para ES (Español) y EN (English).
- Selector de idioma persistido en `localStorage`.
- Usado en Landing Page y Dashboard.
