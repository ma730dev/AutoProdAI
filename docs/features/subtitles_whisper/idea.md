# 💡 Idea & Escalabilidad: Subtitulador Whisper & Hardware Governor

> **Ruta:** `docs/features/subtitles_whisper/idea.md`  
> **Propósito:** Transcripción y subtitulado automático sin costo ni límites artificiales, compatible con flujos de edición modernos.

---

## 🎯 1. El Problema & El Propósito de Negocio

- **El Problema:** La transcripción manual de diálogos o canciones para YouTube y TikTok es una de las tareas más lentas del proceso creativo. Muchas herramientas web cobran suscripciones caras por minuto transcrito o limitan los formatos de exportación. Además, correr Whisper en una laptop modesta suele colapsar el sistema operativo al consumir el 100% de la CPU.
- **La Solución AutoProd:** Doble motor (Whisper API para velocidad supersónica o Whisper Local 100% gratuito) con un **Hardware Governor** inteligente que protege el equipo del usuario y exporta directamente en `.srt` compatible con CapCut para estilización viral inmediata.

---

## 📊 2. Matriz de Alcance: Lo Hecho vs. Lo Faltante

| Capacidad | Estado | Descripción / Comentario |
|---|:---:|---|
| **Doble Motor Whisper (Cloud API + Local)** | `✅ HECHO` | Elección entre velocidad en la nube o privacidad/costo cero local. |
| **Procesamiento de Video Individual** | `✅ HECHO` | Extracción de audio en 16kHz mono y generación de subtítulos. |
| **Modo Carpeta de Canciones** | `✅ HECHO` | Transcripción en lote de colecciones enteras de pistas musicales. |
| **Transcripción Especializada para Canciones & Música** | `✅ HECHO` | Aislamiento acústico estéreo en centro vocal, desactivación de VAD en notas sostenidas y modelo Large-v3-Turbo local. |
| **Subtítulos Rítmicos Dinámicos Estilo CapCut** | `✅ HECHO` | Agrupación automática de 3 a 5 palabras y cortes líricos en pausas >0.40s. |
| **Hardware Governor & Aislamiento de CPU** | `✅ HECHO` | Conserva núcleos libres para el sistema y previene congelamientos. |
| **Modal de Estimación Previa** | `✅ HECHO` | Prevé tiempos y advertencias de energía antes de lanzar el trabajo. |
| **Exportación Nativa para CapCut (`.srt`/`.vtt`/`.json`)** | `✅ HECHO` | Importación directa a la línea de tiempo de CapCut PC y móvil con sincronización lírica exacta. |
| **Editor de Timeline Visual con Forma de Onda** | `⏳ FALTANTE` | Barra interactiva de audio para ajustar visualmente los bloques de texto. |
| **Estilos Cinemáticos Quemados (Hardsubs)** | `⏳ FALTANTE` | Renderizado con estilos de subtítulos animados tipo "Hormozi / MrBeast" integrados. |
| **Traducción Automática Multi-Idioma** | `⏳ FALTANTE` | Generación de pistas de subtítulos en inglés, español y portugués en un solo clic. |

---

## 🚀 3. Banco de Ideas de Escalabilidad para este Módulo

1. **Generador de Shorts con "Palabra por Palabra" Destacada (Karaoke Highlighting):**
   - Resaltar en color brillante (amarillo/verde) la palabra exacta que el narrador o cantante está pronunciando en tiempo real en el preview de video.
2. **Corrector Ortográfico Asistido por IA:**
   - Pase final con LLM liviano para corregir nombres propios, jerga del nicho o términos técnicos que Whisper haya malinterpretado fonéticamente.
3. **Separación de Pistas Vía Demucs Local (Opcional para Audio Extremo):**
   - Pipeline alternativo para canciones con mezclas muy complejas, aislando la pista acapella antes de pasarla a Whisper.

