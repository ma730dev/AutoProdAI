# 💡 Idea & Escalabilidad: Image Studio (Estudio de Imágenes)

> **Ruta:** `docs/features/image_generator/idea.md`  
> **Propósito:** Generación de imágenes y recursos visuales para la producción de video, ambientación de escenas, material de apoyo y arte de canal.

---

## 🎯 1. El Problema & El Propósito

- **El Problema:** La producción de contenido audiovisual requiere un flujo constante de imágenes: fondos para escenas, ilustraciones conceptuales, B-roll estático para la línea de tiempo, recursos de ambientación e identidad visual del canal. Depender de bancos de imágenes genéricos o herramientas externas dispersas rompe el flujo de trabajo del creador y genera costos innecesarios.
- **La Solución AutoProd:** Un estudio de imágenes integrado directamente en el sistema operativo del creador. Permite generar cualquier recurso visual en formatos y resoluciones generales (16:9 panorámico para video, 9:16 vertical para formatos móviles y 1:1 cuadrado para elementos generales y perfiles), con posibilidad de guiar la estética mediante imágenes de referencia y guardar el archivo automáticamente en el disco local del canal y en la nube.

---

## 📊 2. Matriz de Alcance: Lo Hecho vs. Lo Faltante

| Capacidad | Estado | Descripción / Comentario |
|---|:---:|---|
| **Generación en Proporciones Estándar (16:9, 9:16, 1:1)** | `✅ HECHO` | Cobertura para fondos de video, formatos verticales y cuadrados universales. |
| **Referencia de Estilo Visual (`Ctrl+V` y arrastrar)** | `✅ HECHO` | Extracción de paleta y composición para guiar la estética de la nueva imagen. |
| **Mejora Asistida de Descripción** | `✅ HECHO` | Optimización de detalles artísticos, iluminación y encuadre a petición del creador. |
| **Guardado Dual en Espacio de Trabajo y Nube** | `✅ HECHO` | Archivo físico guardado en el canal local y respaldo sincronizado en Supabase Storage. |
| **Selección de Tipo de Recurso (Imagen vs. Portada)** | `✅ HECHO` | Organización automática en la carpeta correspondiente del canal (`Imagenes/` o `Miniaturas/`). |
| **Integración con Modelos Locales (FLUX / SDXL)** | `⏳ FALTANTE` | Opción de generar imágenes directamente en hardware local sin costo por API. |
| **Eliminación y Segmentación de Fondos** | `⏳ FALTANTE` | Aislar sujetos y objetos para montaje directo sobre la línea de tiempo. |

---

## 🚀 3. Banco de Ideas de Escalabilidad

1. **Inserción Directa en Video Studio:**
   - Botón para enviar una imagen generada directamente a la pista de video o recursos del proyecto activo sin salir del flujo de trabajo.
2. **Generación por Lotes para Escenas de Guion:**
   - A partir de un guion estructurado, generar automáticamente las ilustraciones o fondos necesarios para cada sección narrativa.
