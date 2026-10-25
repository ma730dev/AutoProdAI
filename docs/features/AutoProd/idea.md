# 💡 Visión Macro: AutoProd — El Sistema Operativo para Proyectos de Contenido

> **Definición Oficial de Producto:**  
> **AutoProd es el sistema operativo para proyectos de contenido.**  
> Un espacio donde los creadores organizan sus proyectos, desarrollan ideas, producen contenido de alta calidad con sus propios recursos, analizan resultados y construyen un workflow de producción que se adapta a su forma de crear. El Workspace es un espacio abierto que la IA explora para entender el contexto; los canales de YouTube son una integración aparte.

> **Manifiesto de Marca:**  
> *«La automatización no reemplaza al creador. Le devuelve tiempo para crear.»*  
> *«Automatiza el trabajo. Conserva el control.»*

---

## 🧭 1. El Propósito Central de AutoProd

La producción de videos para YouTube hoy en día está fragmentada y rota:
- Un creador pasa horas saltando entre Premiere/CapCut, ChatGPT, generadores de miniaturas, herramientas de SEO, carpetas desordenadas en Windows y la consola de YouTube Studio.
- Las plataformas en la nube existentes cobran suscripciones carísimas ($50-$200/mes) porque intentan renderizar video en servidores remotos (lo cual dispara sus costos en AWS/GCP y limita la calidad del video a 1080p comprimido).
- **El verdadero diferencial de AutoProd no es "hacer videos con un bot", sino reunir todo el proceso en un solo sistema operativo.**

### Los 4 Pilares del Sistema Operativo:
1. **CREA (Convierte tus ideas en contenido con intención):** Investiga temas, desarrolla conceptos, contempla distintos escenarios narrativos y dale estructura a tus guiones sin perder la identidad de cada canal.
2. **PRODUCE (Todo lo que necesitas para crear, en un solo lugar):** Ensambla bucles continuos de 1 a 3 horas, recorta clips rápidos para Shorts y genera subtítulos palabra por palabra sin depender de un flujo fragmentado.
3. **ANALIZA (Entiende qué está pasando con tus canales):** Consulta referencias, explora enfoques de otros creadores y encuentra información que te ayude a decidir qué crear, qué mejorar y dónde existen nuevas oportunidades.
4. **ESCALA (Más capacidad. Más control. Menos trabajo repetitivo):** Organiza múltiples canales de forma independiente y construye un workflow de producción predecible para dedicar más tiempo a las decisiones importantes y menos a las tareas mecánicas.

### La Ventaja de Ejecución: Tu Contenido. Tu Equipo. Tu Control.
1. **Velocidad real:** Renders hasta 4K aprovechando la potencia del computador del usuario, sin esperas ni colas remotas.
2. **Costos predecibles:** Sin tarifas arbitrarias por segundo o minuto de video renderizado.
3. **Control y Privacidad absoluta:** Los archivos originales, metraje y recursos del creador jamás se secuestran en servidores externos; permanecen bajo su soberanía.

---

## 📊 2. Comparativa: Lo que Tenemos Hoy vs. Hacia Dónde Vamos

| Dimensión | 📍 Lo que Tenemos Hoy (Estado Actual) | 🚀 Hacia Dónde Vamos (Visión Futura) |
|---|---|---|
| **Público Objetivo** | Creadores solistas técnicos que producen canales de música, lofi y contenido automatizado. | Creadores individuales, agencias de contenido, editores y equipos multi-canal (Modo Agencia y Multi-Tenant). |
| **Distribución de Software** | Aplicación web en consola con Motor Local binario compilado (`autoprod-motor.exe`) e instalador asistente (`AutoProd-Setup.exe` / `.dmg`). | **App de Escritorio Nativa Todo-en-Uno (Tauri / Electron)** con ventana unificada y motor como servicio invisible. |
| **Setup de Dependencias** | **`AutoProd-Setup.exe` 100% automatizado:** Asistente con Inno Setup que incluye `autoprod-motor.exe`, `ffmpeg.exe`, `yt-dlp.exe` y modelos locales sin tocar la terminal. | Actualizaciones automáticas silenciosas (OTA) del motor y modelos sin reinstalación manual. |
| **Flujo de Video** | Video Looper con sincronización de música y previsualizador de 5 min (1 video a la vez). | **Fábrica de Contenido Batch & Pipeline Completo:** Cola de 50 videos que renderizan de noche + Auto-corte automático a YouTube Shorts/TikTok (9:16). |
| **Voz & Narración** | **Generador TTS Multi-Voz Integrado (FEAT-15):** Edge-TTS gratuito ilimitado local ($0) + OpenAI TTS con control de créditos y BYOK. | Expansión a ElevenLabs hiperrealista y Cartesia Sonic con clonación de voz. |
| **Subtítulos** | Extracción Faster-Whisper (CTranslate2) con Silero VAD y timestamps palabra por palabra ($0 costo API). | **Editor de Timeline Visual Interactivo** con quemado hard/soft de subtítulos animados cinemáticos dentro de AutoProd. |
| **Integración con YouTube** | Extracción de metadatos de canales existentes con pgvector para enriquecer contexto. | **Ciclo Cerrado de Publicación (End-to-End):** OAuth 2.0, subida desatendida vía API v3, selector de miniaturas, programación en calendario y métricas de retención en vivo. |
| **Inteligencia Agéntica** | Chat multi-provider con tool calls para leer/escribir archivos locales. | **Agentes Autónomos Especializados:** Agente Investigador de Tendencias, Agente Analista de Retención de Guiones y Simulador A/B de Miniaturas. |
| **Monetización** | Planes Starter ($70), Pro ($100) y Enterprise ($150) vía Lemon Squeezy y Nequi manual. | SaaS global con facturación automática, licencias por máquina offline, add-ons de créditos y Marketplace de Plantillas de la comunidad. |

---

## 🎯 3. Los 3 Horizontes de Crecimiento de AutoProd

```mermaid
timeline
    title Hoja de Ruta Evolutiva de AutoProd
    Horizonte 1 (MVP Robusto & Flujo Cerrado) : Video Looper Estable : Faster-Whisper Local : Instalador AutoProd-Setup.exe : Generador TTS Multi-Voz : Monetización Lemon Squeezy
    Horizonte 2 (IDE de Automatización Completa) : App de Escritorio Tauri : Render Batch Nocturno : Subida YouTube API v3 : Auto-Corte Shorts : Editor Visual Subtítulos
    Horizonte 3 (Ecosistema SaaS & Agencias) : Modo Multi-Canal y Equipos : Scraping de Tendencias IA : Simulador A/B CTR : Marketplace de Plantillas
```

### 🟢 Horizonte 1: El Loop de Producción Cerrado (Presente Inmediato)
- Instalador local empaquetado (`AutoProd-Setup.exe` y `.dmg`) con entrega directa desde `/api/setup/download-installer`.
- Motor local compilado (`autoprod-motor.exe`) con CTranslate2 (Faster-Whisper), FFmpeg y Edge-TTS integrados.
- Generador de voz en off (TTS) con opción gratuita ilimitada y opción de créditos.
- Cerrar el ciclo: que el video terminado se suba automáticamente a YouTube con sus tags, descripción SEO y miniatura sin salir de AutoProd.

### 🟡 Horizonte 2: La Suite Todo-en-Uno (Mediano Plazo)
- Envolver la UI web en aplicación de escritorio nativa (Tauri / Electron).
- Integrar ElevenLabs y Cartesia como opciones adicionales de ultra alta fidelidad.
- Implementar cola de producción en segundo plano (Batch Queue) para que el computador trabaje mientras el creador duerme.

### 🟣 Horizonte 3: La Plataforma de Escala Masiva (Largo Plazo)
- Permitir que agencias administren 20+ canales de YouTube con roles de equipo.
- IA predictiva: la plataforma no solo genera el video, sino que predice qué miniatura y qué gancho (hook) tendrán mayor CTR antes de publicar.
- Comunidad y Marketplace donde creadores vendan sus plantillas de guiones, presets de looper y flujos agénticos.

---

## 💎 4. Principios Innegociables de Producto

1. **Filosofía $0 en Costos de Servidor Innecesarios:**  
   El servidor nunca debe procesar un solo frame de video. Todo el cómputo pesado ocurre en el hardware que el cliente ya posee.
2. **Privacidad y Control Absoluto:**  
   El contenido del creador (archivos originales, audios, recursos) se queda en su disco duro local; AutoProd no secuestra sus archivos ni depende de almacenamiento en la nube obligatorio.
3. **Autonomía con Control Humano (Human-in-the-Loop):**  
   Los agentes de IA proponen, redactan y ejecutan tareas repetitivas, pero el creador siempre tiene la última palabra antes de publicar o gastar créditos.
