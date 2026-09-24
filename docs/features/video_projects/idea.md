# 💡 Visión & Escalabilidad: VideoProjects, Normalización de BD, Caché y Cuentas Vinculadas

> **Ruta:** `docs/features/video_projects/idea.md`  
> **Propósito:** Separación clara de la mesa de montaje técnico, soberanía del creador sin canales obligatorios, control higiénico del almacenamiento en la nube y vinculación oficial multirred.

---

## 🧭 1. El Propósito y Filosofía de Producto

En la versión inicial de AutoProd, existía una fricción conceptual:
- Un video era considerado un scraping de YouTube.
- Si un usuario no tenía un canal vinculado, el sistema no permitía guardar proyectos en base de datos.
- El editor de video operaba puramente en la memoria volátil del navegador (`useState`), perdiendo el trabajo ante un cierre inesperado o recarga de pestaña.
- El almacenamiento en la nube corría el riesgo de llenarse de archivos temporales (previews de 30 segundos, proxies, audios de prueba de TTS) sin que el usuario supiera cómo limpiar su espacio.

Con esta implementación, AutoProd adopta el patrón **Local-First con Cloud Sync Opcional (estilo Git/GitHub)**:
1. **Soberanía y Libertad:** Quien solo quiere editar sin conectar canales tiene una mesa de montaje completa con persistencia garantizada.
2. **Higiene y Control de Costos:** Al igual que en CapCut y Premiere Pro, el usuario sabe qué archivos son activos reales y qué archivos son caché temporal, pudiendo vaciar el caché con un solo clic.
3. **Legitimidad y Seguridad:** Se sustituye el scraping frágil por OAuth 2.0 oficial de Google, preparando a AutoProd para la publicación desatendida y la expansión multicanal.

---

## 📊 2. Lo que Tenemos Hecho vs. Lo que Falta

| Capacidad | Estado | Detalle |
|---|:---:|---|
| **Modelo `VideoProject` normalizado** | `✅ HECHO` | Proyectos de edición técnicos desacoplados, con `userId` soberano y `channelId` opcional. |
| **Modelo `ContentHistory` agnóstico** | `✅ HECHO` | Historial de publicaciones multirred (YouTube, Instagram, TikTok) preparado para análisis. |
| **Hub de Proyectos (Launcher)** | `✅ HECHO` | Cuadrícula con miniaturas, badges de formato, filtros y creación guiada. |
| **Auto-Guardado con Debounce (2s)** | `✅ HECHO` | Guardado silencioso de la línea de tiempo en base de datos sin interrumpir el flujo del creador. |
| **Separación de Caché y Vaciar Caché** | `✅ HECHO` | Flag `isCache` en `Asset`, endpoint `/api/assets/clear-cache` y botón de 1 clic en la interfaz. |
| **Selector de Cómputo (Local vs Nube)** | `✅ HECHO` | Modal de exportación con selector explícito entre motor local ($0 costo) y worker en la nube. |
| **Vinculación Oficial YouTube OAuth 2.0** | `✅ HECHO` | Endpoints `/api/auth/youtube/login` y `callback` con sincronización de canal y publicaciones. |
| **Panel de Cuentas Vinculadas** | `✅ HECHO` | Vista `LinkedAccountsView` accesible desde el sidebar con visualizador de `ContentHistory`. |
| **Publicación Directa a YouTube (Upload API)** | `⏳ FALTANTE` | Subir el `.mp4` renderizado directamente a YouTube usando los tokens de refresco del canal. |
| **Sincronización con Instagram & TikTok** | `⏳ FALTANTE` | Conectar Instagram Graph API y TikTok Creator API bajo la misma tabla `ContentHistory`. |
| **Plantillas Base de la Comunidad (Templates)** | `⏳ FALTANTE` | Tabla dedicada `Template` para comprar o compartir esqueletos de edición sin mezclar con proyectos. |

---

## 🚀 3. Ideas de Escalabilidad

1. **Auto-Corte Inteligente de Videos Publicados a Shorts:**
   - La IA lee un video del `ContentHistory` del canal, identifica los momentos de mayor retención y genera automáticamente un nuevo `VideoProject` en formato `9:16` con subtítulos cinemáticos para TikTok/Shorts.
2. **Consolidar Proyecto (Project Prune):**
   - Una herramienta que analiza qué clips de video o canciones en la carpeta del proyecto NO están en la línea de tiempo y ofrece archivarlos o eliminarlos del disco para ahorrar espacio.
3. **Sincronización Offline Bidireccional (Git-like Sync):**
   - Cuando el motor local está activo, guardar simultáneamente el archivo `project.autoprod.json` en `{workspace}/{Canal}/{Video}/` y sincronizarlo con `VideoProject.timelineData` en la nube al detectar conexión.
