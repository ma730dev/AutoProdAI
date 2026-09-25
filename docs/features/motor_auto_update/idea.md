# 💡 Visión y Escalabilidad: Auto-Update del Motor Local & Notificación 1-Clic (`FEAT-22`)

> **Ruta:** `docs/features/motor_auto_update/idea.md`  
> **Estado:** `✅ HECHO / EVOLUCIÓN CONTINUA`

---

## 🎯 1. Propósito de Negocio y Experiencia del Creador

### El Problema Tradicional del Software de Escritorio
En la mayoría de herramientas audiovisuales locales con arquitectura de escritorio, cuando se publica un parche o una nueva versión:
1. El usuario debe enterarse por un correo o aviso manual.
2. Debe ir a una página web de descargas.
3. Debe volver a descargar un archivo pesado de varios cientos de megabytes (incluyendo herramientas que ya tiene instaladas como FFmpeg).
4. Debe cerrar la aplicación, abrir el instalador con permisos de administrador, seguir un asistente y reconfigurar sus rutas.

Este proceso genera fricción, usuarios anclados en versiones obsoletas con bugs ya corregidos y quejas de soporte innecesarias.

### La Solución AutoProd: Cero Fricción & Máxima Soberanía
AutoProd aborda la experiencia desde el manifiesto:  
*«La automatización no reemplaza al creador. Le devuelve tiempo para crear.»*

- **Descarga Mínima Esencial:** Solo viaja el código binario nuevo (~70 MB), no los 200 MB del instalador completo.
- **Inviolabilidad de Proyectos:** El actualizador jamás toca `workspace/youtube/` ni los canales, videos o configuraciones del usuario.
- **Acción Asistida con 1 Clic:** Un badge discreto aparece junto al indicador de estado `⚡ Online`. El usuario decide cuándo actualizar con un clic y el sistema se reconecta solo en 3 segundos sin cerrar su navegador ni perder su contexto creativo.

---

## 🚀 2. Capacidades Hechas vs. Futura Escalabilidad

### ✅ Capacidades Implementadas (`v1.5.0+`):
- [x] Publicación automatizada en GitHub Releases de binarios sueltos (`autoprod-motor.exe` y `autoprod-motor`).
- [x] Endpoint Cloud `/api/setup/version` con caché en memoria (5 minutos) para consultar releases sin exceder límites de API.
- [x] Endpoint local `/system/version` y `/system/update` con descarga en streaming.
- [x] Script de intercambio atómico (`update_swap.bat` / UNIX replace) para sortear el bloqueo de archivos de Windows.
- [x] UI integrada en la barra lateral con badge `🟣 vX.X.X disponible` y botón `[Actualizar]`.
- [x] Reconexión automática transparente en el Dashboard post-reinicio.

### ⏳ Ideas de Escalabilidad Futura:
- [ ] **Canales de Lanzamiento (Release Channels):** Permitir a creadores avanzados elegir entre el canal `Estable` (Production) y el canal `Beta / Nightly` para probar nuevas funciones antes de tiempo.
- [ ] **Rollback Automático:** Si tras la actualización el nuevo motor no logra inicializar en el puerto 8000 en 15 segundos, restaurar automáticamente la copia de seguridad previa `autoprod-motor.old.exe`.
- [ ] **Diff / Changelog Modal:** Al hacer clic en el badge de actualización, abrir un modal ligero con los puntos clave de lo nuevo en esa versión antes de confirmar.
- [ ] **Actualización Automática de yt-dlp:** Tarea en segundo plano para invocar `yt-dlp -U` periódicamente y mantener las herramientas de extracción de YouTube siempre compatibles con los cambios del algoritmo.
