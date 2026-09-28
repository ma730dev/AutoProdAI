# ⚙️ Ficha Técnica: Video Studio & Timeline Editor (con Looper Integrado)

> **Ruta:** `docs/features/video_looper/ficha_tecnica.md`  
> **Estado:** `✅ HECHO` (En producción / Operativo)  
> **Capa Técnica:** Next.js + React (Client) + FastAPI (Python 8000) + FFmpeg + Moviepy

---

## 🛠️ 1. Arquitectura y Pipeline de Ejecución

```mermaid
flowchart TD
    A[FileTree / PC: Clips de Video & Audio] -->|Drag & Drop / Importar| B1[Media Bin: VideoStudio.tsx]
    B1 -->|Añadir a Timeline| B2[TimelinePro.tsx: Pistas V1, A1, A2, T1, S1]
    B1 -->|⚡ Herramienta Looper| B3[Sub-Módulo Looper: Bucle Express o Enlace a Audio]
    B2 -->|Edición Interactiva: Trim Handles + Split| B4[Canvas Player: Viewport + Overlays DOM]
    B2 -->|POST /video/render_timeline| E1[FastAPI: Multi-Clip Concat + GPU Pass]
    B3 -->|POST /video/create_loop| E2[FastAPI: Stream Copy Loop 1:1]
    E1 -->|Single-Pass Render| F[Exportación .mp4 a Workspace /Videos]
    E2 -->|Concatenación Demuxer| F
    E1 -->|GET /video/preview/{job_id}| G[Reproductor HTML5 Preview 30s]
```

---

## 🔌 2. Endpoints y Métodos de la API Local (FastAPI `localhost:8000`)

| Endpoint | Método | Parámetros Clave | Descripción |
|---|:---:|---|---|
| `/video/render_timeline` | `POST` | `{ cuts, overlays, audio, resolution, quality, aspectRatio, output_folder_path, output_filename, is_preview }` | **Core:** Renderiza la composición multipista completa en una sola pasada de FFmpeg con aceleración GPU (NVENC/VideoToolbox), concatenación real de múltiples cortes virtuales con trimming, normalización SAR/FPS (`setsar=1,fps=30`), mezcla balanceada de audio y capas de texto/stickers. |
| `/video/create_loop` | `POST` | `{ video_paths, duration_mode, target_duration_seconds, audio_folder_path, resolution, quality, mute_original_audio, is_preview, output_folder_path, output_filename }` | **Feature Looper:** Construye el bucle express en segundos usando *Stream Copy* (`-c:v copy`) para videos lofi o música continua de 1 a 3 horas. |
| `/video/video_folders` | `GET` | Ninguno | Retorna la lista de carpetas `Videos` de cada proyecto y canal en el workspace. |
| `/video/inspect_media` | `POST` | `{ file_path: string }` | Ejecuta `ffprobe` para extraer resolución, FPS, duración exacta, códec y detección booleana de pista de audio (`has_audio`). |
| `/video/scan_audio_folder` | `POST` | `{ folder_path: string }` | Escanea recursivamente archivos de audio, suma duraciones y devuelve tiempo formateado `HH:MM:SS`. |
| `/video/preview/{job_id}` | `GET` | `job_id` en path | Emite el stream de video resultante mediante `FileResponse` para el previsualizador del estudio. |
| `/video/status/{job_id}` | `GET` | `job_id` en path | Consulta el estado del render (`queued`, `processing`, `completed`, `error`) con porcentaje dinámico calculado por `progress_ticker`. |
| `/workspace/raw` | `GET` | `path: string` | Sirve cualquier archivo multimedia local (video/audio/imagen) por streaming HTTP (soporte 206 Range) para el canvas del editor. |

---

## 🎛️ 3. Parámetros de Calidad, Audio y Filtros FFmpeg

1. **Pipeline Multi-Clip Concat Robusto:**
    - Cada corte en la secuencia aplica `trim=start={st}:end={et},setpts=PTS-STARTPTS,{scale_filter},setsar=1,fps=30`.
    - Garantiza que clips provenientes de distintas cámaras, resoluciones o tasas de fotogramas se concatenen en `[v_concat]` sin artefactos ni desincronización de audio.
2. **Mezcla Multipista Multi-Audio:**
    - Soporte para audio original de cámara (`[a_cut_i]`), narración/voz (`[voice_fmt]`) y múltiples canciones en la pista A1 (`music_tracks`).
    - Cada pista de música se posiciona de forma temporalmente arbitraria en la línea de tiempo mediante `adelay={start_ms}|{start_ms}`, se recorta a su duración con `atrim=0:{duration}`, se modula con `volume` y se combina en un bus unificado mediante `amix=inputs=N:duration=longest`.
    - El bus de música resultante se mezcla con la voz y el audio de los clips manteniendo los niveles de volumen fijados por el creador.
3. **Overlays & Stickers en Una Sola Pasada:**
    - Encadenamiento dinámico de filtros `drawtext` habilitados por tiempo con `enable='between(t,start,end)'`.
4. **Herramienta Looper Integrada (Cero Pérdida):**
    - Modo 1-clic con `-c:v copy` para repetir clips continuos sin re-codificación, o modificador de clip en el inspector para que un fondo se extienda hasta el final de la música.
5. **Canvas Interactivo con Arrastre y Sincronización Temporal Estricta:**
    - **Arrastre Libre de Etiquetas:** Arrastre interactivo con el ratón sobre el viewport del Canvas para posicionar etiquetas y textos con snapping magnético al centro (50%).
    - **Visibilidad Temporal Estricta:** Las etiquetas solo se renderizan durante el intervalo `[startTime, startTime + duration]`. Si el cabezal está fuera de rango, no se muestran en reproducción (mostrando modo ghost solo si está seleccionada en el inspector para edición).
    - **Handles de Duración en Timeline:** Pista T1 con manillas laterales izquierda (In-point) y derecha (Duración) para estirar o encoger el tiempo exacto que debe durar cada etiqueta.
    - **Paneo y Zoom del Video en Canvas:** Posibilidad de arrastrar el metraje dentro del viewport para re-encuadrar tomas horizontales en formatos verticales (9:16 Shorts), con controles de escala, pan X/Y y botón de centrado.
    - **Reordenamiento Ágil de Cortes:** Botones `◀ Mover antes` y `Mover después ▶` más duplicador de clips `📋` en el inspector.
6. **Multipista de Audio (Múltiples Canciones y Efectos en A1):**
    - **Streaming Universal Híbrido (`getMediaUrl`):** Resolución inteligente y unificada de fuentes multimedia para video y audio. Para rutas locales en disco, conecta con `${getControladorUrl()}/workspace/raw?path=...` asegurando compatibilidad total tanto en desarrollo local (`localhost:3000`) como en despliegues cloud sobre HTTPS (`test.autoprodai.com`), integrando cabeceras W3C Private Network Access (`Access-Control-Allow-Private-Network: true`). Para URLs remotas (Supabase Storage / CDN) o blobs en memoria, reproduce directamente la URL sin intermediarios.
    - **Importación Múltiple:** Subida por lotes de archivos MP3/WAV/OGG/FLAC desde el explorador del PC.
    - **Audición Rápida:** Botón de play/pause (`▶ / ⏸`) en la bandeja de medios para preescuchar cualquier canción antes de insertarla.
    - **Inserción en Cascada:** Botón `⚡ Añadir Todas en Cascada` que dispone toda la biblioteca de audio secuencialmente una canción tras otra en la pista A1.
    - **Recorte y Arrastre en Timeline:** Cada bloque de audio en la pista A1 cuenta con manillas izquierda y derecha para trimming y arrastre de cuerpo para reubicar su inicio temporal libremente.
    - **Inspector de Audio:** Modulación limpia de volumen por canción (0% a 150%) y duplicación de pista, mientras que el recorte de duración y posicionamiento temporal se gestionan de forma visual y directa con los handles y arrastre en la línea de tiempo.
7. **Inversión de Video (Reverse Playback):**
    - **Modificador `is_reversed` por Clip:** Configurable desde el Inspector de Clip (conmutador `⏪ Invertir Video`) y menú contextual de clic derecho en la pista V1 de la línea de tiempo.
    - **Cálculo Matemático en Vivo:** El Canvas DOM resuelve el fotograma invertido instantáneamente (`cut.isReversed ? Math.max(cut.startTime, cut.endTime - elapsed) : cut.startTime + elapsed`).
    - **Renderizado Final FFmpeg:** Inyección de los filtros de inversión `reverse` en el pipeline de video y `areverse` en el canal de audio del corte para generar el rebobinado perfecto sin desincronizaciones.
8. **Subtitulador IA Integrado (Pista S1 & Whisper):**
    - **Acceso Unificado:** Botón de acción directa `🎧 Subtitular IA` en la barra superior del Video Studio y pestaña `🎧 Subs` en la bandeja de recursos (sin silos ni pantallas aisladas).
    - **Transcripción con Whisper:** Detección de idioma, selección de motor (CPU local, GPU CUDA o API OpenAI) y procesamiento asíncrono en segundo plano.
    - **Pista S1 en Timeline:** Bloques de subtítulos colocados de forma precisa en la pista S1 de `TimelinePro`.
    - **Live Canvas Subtitle Overlay:** Renderizado de subtítulo activo en el visor de Canvas con estilo dinámico de alta visibilidad (TikTok/Reels).
    - **Edición y Exportación:** Edición en caliente de texto de cada bloque, importación de subtítulos `.srt`/`.vtt` y quemado automático en el video exportado mediante `-vf subtitles=...`.
9. **Soporte de Alta Capacidad para Videos Largos (10m, 30m, 1h+ y Multi-Gigabyte):**
    - **Streaming Multipart Directo (`/workspace/upload_stream`):** Eliminación del cuello de botella de `FileReader.readAsDataURL` (Base64) que saturaba el límite de 512MB de V8 en el navegador. La subida se realiza por chunks directos a disco sin huella de RAM.
    - **Escaneo Automático de Carpeta Activa (`/workspace/folder_videos`):** La bandeja de medios carga y analiza automáticamente todos los videos existentes en `targetFolder` al montar o cambiar de canal.
    - **Duración Real Inmediata:** Los clips se insertan con su duración real analizada por `ffprobe`, eliminando el antiguo límite provisional de 15 segundos.
    - **Búfer de Bucle Eficiente en FFmpeg:** Se sustituyó `size=30000` (que consumía 93 GB de RAM y limitaba a 16m) por cálculo exacto de fotogramas (`loop_frames = max(30, int(round(total_cuts_duration * 30)))`), permitiendo renderizar bucles de 1 a 3 horas sin saturación de memoria.
    - **Regla Adaptativa & Auto-Fit en Timeline:** La regla de tiempo limita dinámicamente las marcas a un máximo de 300 elementos DOM y aplica zoom automático inteligente (`handleFitToView`), evitando congelamientos en timelines de larga duración.
10. **Función Looper Integrada en el Inspector de Video (Efecto/Herramienta de Clip) y Multi-Corte de Línea de Tiempo:**
    - **Integración Nativa en Inspector de Video:** El Looper no es una pestaña independiente en la barra superior del inspector (`activeInspectorTab === 'clip'`), sino una función operativa integrada en el flujo de efectos del video (junto a recorte, encuadre/pan-zoom e inversión).
    - **Operación Estricta sobre Cortes de Línea de Tiempo (`timelineCuts`):** El generador de bucles no opera sobre archivos en crudo de la biblioteca, sino exclusivamente sobre los cortes que el usuario ha dispuesto en la línea de tiempo.
    - **Preservación Total de Efectos por Corte (Inversión, Recorte, Pan & Zoom):** Si el creador coloca dos instancias del mismo video en la línea de tiempo y a una le aplica `isReversed: true` (inversión de video), al seleccionarlas para el ciclo del bucle, cada corte conserva sus modificaciones de forma totalmente independiente:
      - *Corte 1:* Reproducción hacia adelante con su respectivo recorte y encuadre.
      - *Corte 2:* Reproducción invertida (`⏪ REV`) con cálculo en vivo en Canvas (`offsetInClip = subEnd - subElapsed`) y filtro `reverse` / `areverse` en FFmpeg.
    - **Selección y Reordenamiento de Ciclo:** Selector con casillas de verificación para incluir/excluir cualquier corte presente en la línea de tiempo, con indicador `⏪ REV` y controles `▲`, `▼` y `✕` para definir el orden exacto de la vuelta.
    - **Duración con 2 Opciones:**
      - **⏱️ Poner Tiempo:** Minutos, segundos y accesos rápidos (5m, 15m, 30m, 60m).
      - **🎵 Elegir Canciones:** Sincronización automática con la pista A1 o selección manual de canciones de `projectAudioList` con inserción opcional en A1.
    - **Capacidad Universal de Alargar o Acortar Libremente:** Botones de paso fino (`- 1m`, `- 10s`, `+ 10s`, `+ 1m`) en el inspector y manilla interactiva amarilla (`🔁`) en el timeline para estirar o encoger el bloque elásticamente a cualquier segundo exacto.
    - **Rendimiento Máximo en Navegador («Sin romper la PC»):** Toda la secuencia de bucle (sea de 1 clip o de múltiples clips cíclicos) se representa en la pista V1 como **1 solo elemento elástico en el DOM** con muescas doradas vía CSS (`repeating-linear-gradient`). En el canvas, `resolveClipAtTime` conmuta con precisión de milisegundo el sub-clip activo en cada vuelta.
    - **Pipeline de Exportación Multi-Clip:** Al exportar (`/video/render_timeline`), el ciclo de bucle se expande virtualmente en cortes secuenciales enlazados preservando `start_time`, `end_time`, `is_reversed`, pan y zoom exactos para que FFmpeg los procese y concatene de forma nativa sin desajustes de códec ni desincronización de audio.
    - **Restauración Limpia al Desactivar:** Al desactivar el bucle, los cortes originales son desempaquetados de nuevo en la línea de tiempo manteniendo sus efectos individuales (`isReversed`, `panX`, `panY`, `zoom`, `startTime`, `endTime`) exactamente como estaban.
11. **Detección Automática de Recursos Faltantes y Alertas Visuales en Rojo (Offline Media):**
    - **Ámbito Global (Explorador FileTree & VideoStudio):**
      - *Explorador de Carpetas (`FileTree.tsx`):* Identificación de proyectos de video de nivel 1 que carecen de recursos de video válidos en su carpeta `Videos/` (o carecen de la carpeta), mostrándolos en rojo con el badge `⚠️ Sin videos`. Del mismo modo, carpetas `Videos/` vacías se marcan en rojo con `⚠️ Vacía`, y archivos con extensiones no reconocidas se muestran en rojo con `⚠️ No reconocido`.
      - *Línea de Tiempo (`TimelinePro.tsx`):* Cortes de video en pista V1 y pistas de audio en A1 que apuntan a archivos no encontrados o inaccesibles se renderizan en rojo intenso (`bg-red-950/95 border-red-500 ring-2 ring-red-400 text-red-100`), con badge `OFFLINE`, título `⚠️ OFFLINE: {nombre}` y manillas en rojo.
      - *Bandeja de Medios (`VideoStudio.tsx`):* Clips y pistas de audio en la bandeja de recursos se resaltan en rojo con bordes carmesí y etiquetas de aviso `⚠️ Archivo inaccesible / Offline`, deshabilitando la preescucha de canciones faltantes.
      - *Canvas Viewport:* Overlay de emergencia en rojo `⚠️ Media Offline / Recurso Inaccesible` cuando el cabezal de tiempo se posiciona sobre un clip cuyo archivo no se encuentra en el disco, evitando caídas o pantallas congeladas.
      - *Inspector Contextual:* Tarjeta de advertencia en rojo detallando la ruta exacta perdida para que el creador pueda reconectar o sustituir el archivo.
    - **Verificación Ultra-Ligera Sin Overhead:** Verificación no bloqueante vía solicitudes `HEAD` a `/api/assets/stream?path=...` (con fallback a `/workspace/raw`), comprobando existencia en disco en < 1ms sin consumir ancho de banda ni decodificar streams.

---

## 📂 4. Archivos Involucrados en el Repositorio

- [`components/workspace/FileTree.tsx`](file:///e:/autoprod/components/workspace/FileTree.tsx): Explorador de archivos con detección de proyectos sin recursos (`checkHasVideoResources`), carpetas `Videos/` vacías y archivos desconocidos en rojo.
- [`components/video-studio/VideoStudio.tsx`](file:///e:/autoprod/components/video-studio/VideoStudio.tsx): Editor de video con verificación reactiva de accesibilidad de medios (`missingMediaPaths`), overlay de Media Offline en Canvas, alertas en Media Bin e inspector.
- [`components/video-studio/timeline/TimelinePro.tsx`](file:///e:/autoprod/components/video-studio/timeline/TimelinePro.tsx): Línea de tiempo multipista con marcado en rojo y badges `OFFLINE` para cortes de video (V1) y audio (A1) faltantes.
- [`app/api/assets/stream/route.ts`](file:///e:/autoprod/app/api/assets/stream/route.ts): Handler `HEAD` de alto rendimiento para validación instantánea de archivos en disco sin carga de streaming.
- [`components/video-studio/VideoLooperStudio.tsx`](file:///e:/autoprod/components/video-studio/VideoLooperStudio.tsx): Re-export de compatibilidad hacia atrás para `VideoStudio`.
- [`controlador/routers/video_looper.py`](file:///e:/autoprod/controlador/routers/video_looper.py): Router FastAPI con `/video/render_timeline` (Multi-clip pipeline con `reverse`/`areverse`, búfer eficiente para videos largos y GPU) y `/video/create_loop`.
- [`controlador/routers/workspace.py`](file:///e:/autoprod/controlador/routers/workspace.py): Endpoints `/workspace/upload_stream` y `/workspace/folder_videos` para streaming directo de archivos grandes sin Base64.
- [`lib/controlador-client.ts`](file:///e:/autoprod/lib/controlador-client.ts): Cliente TypeScript con `uploadStreamFile` y `getFolderVideos`.


