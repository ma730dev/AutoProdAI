# 💡 Idea & Escalabilidad: FEAT-16 — Orquestación de Canales, Capa de Video & Interactive Question Cards

> **Ruta:** `docs/features/channel_and_video_orchestration/idea.md`  
> **Estado:** `✅ HECHO` (En producción / Operativo)  
> **Pilar AutoProd:** `CREA` • `PRODUCE` • `ESCALA`

---

## 🎯 1. Visión y Propósito para el Creador

En AutoProd, la experiencia del creador no debe ser la de lidiar con un chatbot genérico que alucina o improvisa estructuras, ni la de memorizar comandos o tipear textos interminables.

AutoProd es el **sistema operativo para proyectos de contenido**. Esta funcionalidad resuelve tres pilares esenciales:
1. **Coherencia y Memoria del Canal:** Ya sea que el canal venga importado desde YouTube con el extractor o nazca desde una idea nueva, la estructura de memoria (`InfoCanal/`) es idéntica y predecible.
2. **Soberanía y Facilidad de Publicación:** En cada proyecto de video, el creador cuenta con su archivo `config_video.md`, listo para copiar y pegar en YouTube Studio con títulos optimizados, ganchos y comentarios de comunidad.
3. **Control Fluido con Interactive Question Cards (Estilo Antigravity):** Las decisiones complejas (como elegir entre modelos de IA, confirmar carpetas extra o seleccionar temas) se resuelven con tarjetas visuales de 1 solo clic, mostrando con total transparencia el costo estimado en créditos.

---

## 🚀 2. Beneficios de Escalabilidad

- **Higiene Cognitiva de la IA:** Las opciones estructuradas eliminan el ping-pong conversacional innecesario, reduciendo el tamaño de la ventana de contexto y preservando la capacidad de razonamiento profundo del modelo.
- **Transparencia en Token Economics:** El creador siempre sabe cuánto consumirá una acción antes de ejecutarla, construyendo confianza absoluta en la plataforma.
- **Extensibilidad Agéntica:** El componente `InteractiveQuestionCard` puede ser reutilizado por cualquier herramienta futura (selección de locución TTS, variantes de miniatura, presets de renderizado en el video looper).

---

## 📋 3. Banco de Ideas Futuras (Próximos Pasos)

1. **Auto-Copy Button en `config_video.md`:** Botones rápidos de 1-clic en la interfaz para copiar el título, descripción o comentario fijado al portapapeles directamente desde el visor.
2. **Subida Directa a YouTube API:** Publicar automáticamente el contenido de `config_video.md` y el video renderizado en `Videos/` a YouTube mediante OAuth 2.0.
3. **Multi-Idioma en Question Cards:** Adaptación dinámica de las tarjetas al idioma del creador (`es` / `en`).
