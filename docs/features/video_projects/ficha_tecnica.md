# ⚙️ Ficha Técnica: VideoProjects, Normalización de BD, Caché y Cuentas Vinculadas

> **Ruta:** `docs/features/video_projects/ficha_tecnica.md`  
> **Estado:** `✅ HECHO` (En producción / Operativo)  
> **Capa Técnica:** Next.js + React 19 + Prisma (PostgreSQL) + Supabase Storage + Google OAuth 2.0 (YouTube Data API v3) + FastAPI Motor Local

---

## 🛠️ 1. Arquitectura y Pipeline de Ejecución

```mermaid
flowchart TD
    subgraph Frontend["🖥️ Capa de Presentación (Next.js / React 19)"]
        Sidebar["Sidebar: Canales & Redes / Video Studio"]
        ProjectHub["ProjectHub: Cuadrícula de Proyectos"]
        Studio["VideoStudio: Editor Multipista con Auto-Save 2s"]
        LinkedAccounts["LinkedAccountsView: OAuth y ContentHistory"]
        AssetLib["AssetLibraryView: Cuota y Vaciar Caché"]
    end

    subgraph API["🌐 Endpoints Next.js API Routes"]
        ProjectsAPI["/api/video-projects & /[id]"]
        ClearCacheAPI["/api/assets/clear-cache"]
        OAuthLogin["/api/auth/youtube/login"]
        OAuthCallback["/api/auth/youtube/callback"]
        ChannelHistoryAPI["/api/channels/[id]/history"]
    end

    subgraph Database["🗄️ PostgreSQL (Supabase / Prisma)"]
        VideoProject["Tabla videoProject (Mesa de Montaje)"]
        ContentHistory["Tabla contentHistory (Historial Multirred)"]
        Asset["Tabla asset (con flag isCache)"]
        Channel["Tabla channel (Tokens OAuth 2.0)"]
    end

    ProjectHub -->|GET / POST| ProjectsAPI
    Studio -->|PUT (Auto-Save Debounce 2s)| ProjectsAPI
    AssetLib -->|POST| ClearCacheAPI
    LinkedAccounts -->|Login Google| OAuthLogin
    OAuthCallback -->|Sincronización| Channel
    OAuthCallback -->|Sincronización| ContentHistory
    ProjectsAPI --> VideoProject
    ClearCacheAPI --> Asset
    LinkedAccounts --> ChannelHistoryAPI
```

---

## 🗄️ 2. Modelo de Datos y Normalización Limpia

### A. Modelo `VideoProject` (Mesa de Montaje Independiente)
Desacoplado de cualquier canal obligatorio. `userId` es el dueño soberano.
- `id`: UUID (PK).
- `userId`: UUID (FK `User`, NOT NULL).
- `channelId`: UUID (FK `Channel`, NULLABLE con `ON DELETE SET NULL`). Permite editar a usuarios sin canales.
- `title`: String con el nombre del proyecto.
- `aspectRatio`: "16:9" | "9:16" | "1:1".
- `resolution`: "1080p" | "4K" | "720p".
- `timelineData`: JSONB completo con pistas `cuts`, `audio`, `overlays`, `subtitles`, formato y volúmenes.
- `thumbnailUrl`: String opcional para portada visual.
- `durationSeconds`: Duración calculada neta.
- `status`: "DRAFT" | "RENDERED" | "ARCHIVED".
- `storageMode`: "LOCAL" | "CLOUD" | "HYBRID".
- `localPath`: Ruta en disco local si se sincroniza con el workspace físico.

### B. Modelo `ContentHistory` (Historial Multirred Agnóstico)
Sustituto de la antigua tabla `Video`. Representa el historial de publicaciones reales en redes sociales.
- `id`: UUID (PK).
- `channelId`: UUID (FK `Channel`, NOT NULL).
- `platform`: "YOUTUBE" | "INSTAGRAM" | "TIKTOK" | "FACEBOOK".
- `contentType`: "VIDEO" | "SHORT" | "REEL" | "POST".
- `externalId`: ID nativo en la red social (ej. `youtubeVideoId`).
- `externalUrl`: URL directa pública.
- `title`, `description`, `thumbnailUrl`, `tags`.
- `metrics`: JSONB con estadísticas (reproducciones, me gusta, comentarios).
- `publishedAt`: Fecha de publicación en la red social.

### C. Flag de Caché en `Asset` (`isCache: Boolean`)
- `isCache: true`: Archivos temporales (renders de previsualización, formas de onda de audio, audios TTS descartados, proxies).
- `isCache: false`: Archivos activos permanentes del usuario (canciones, clips de B-Roll, logos, miniaturas finales).
- Permite depurar gigabytes sin tocar los archivos fijos del creador.

---

## 🔌 3. Endpoints de la API Implementados

| Endpoint | Método | Descripción |
|---|:---:|---|
| `/api/video-projects` | `GET` | Lista todos los proyectos del usuario autenticado con filtros de canal (`channelId=none` o específico), estado y búsqueda. |
| `/api/video-projects` | `POST` | Crea un nuevo proyecto independiente o asignado a un canal. |
| `/api/video-projects/[id]` | `GET` | Retorna el proyecto completo incluyendo su `timelineData` para montarlo en el editor. |
| `/api/video-projects/[id]` | `PUT` | Actualiza metadatos y estado de la línea de tiempo (consumido por el hook de auto-guardado). |
| `/api/video-projects/[id]` | `DELETE` | Elimina el proyecto de forma segura. |
| `/api/assets/clear-cache` | `POST` | Purga los recursos con `isCache = true` en base de datos y Supabase Storage, liberando cuota inmediatamente. |
| `/api/auth/youtube/login` | `GET` | Redirige al flujo oficial de consentimiento de Google con scopes `youtube.readonly` y perfil. |
| `/api/auth/youtube/callback` | `GET` | Intercambia el código por tokens OAuth 2.0, registra el canal verificado y descarga su `ContentHistory` inicial. |
| `/api/channels/[id]/history` | `GET` | Consulta las publicaciones oficiales sincronizadas del canal seleccionado. |

---

## 🖥️ 4. Componentes de Interfaz de Usuario

- [`components/dashboard/ProjectHub.tsx`](file:///e:/autoprod/components/dashboard/ProjectHub.tsx): Hub lanzador con cuadrícula de proyectos, creación guiada de proyectos, duplicador, eliminador y filtros.
- [`components/dashboard/LinkedAccountsView.tsx`](file:///e:/autoprod/components/dashboard/LinkedAccountsView.tsx): Panel de gestión de canales de YouTube conectados con OAuth 2.0 y visualizador modal de `ContentHistory`.
- [`components/dashboard/VideoStudio.tsx`](file:///e:/autoprod/components/dashboard/VideoStudio.tsx): Integración del Hub (si no hay proyecto activo), botón de regreso a proyectos, indicador en caliente de auto-guardado (`🔄 Guardando...` / `✓ Guardado`) y selector de motor de cómputo (Local vs Nube) en el modal de exportación.
- [`components/dashboard/AssetLibraryView.tsx`](file:///e:/autoprod/components/dashboard/AssetLibraryView.tsx): Medidor de cuota actualizado con desglose de `Caché` y botón directo `[ Vaciar Caché ]`.
- [`components/dashboard/ConversationSidebar.tsx`](file:///e:/autoprod/components/dashboard/ConversationSidebar.tsx): Acceso directo a `🌐 Canales & Redes`.
