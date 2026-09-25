# 💡 FEAT-21 — Visión de Negocio, Experiencia del Creador & Escalabilidad

## Idea & Backlog Estratégico

> **Ruta:** `docs/features/workspace_governance_and_channel_limits/idea.md`  
> **Estado:** `✅ HECHO` (En producción / Operativo)  
> **Objetivo de Negocio:** Garantizar orden absoluto en disco, soberanía de archivos y cumplimiento transparente de los planes de suscripción.

---

### 1. El Porqué de la Funcionalidad (Visión del Creador)

En AutoProd, la promesa al creador es:  
*«La automatización no reemplaza al creador. Le devuelve tiempo para crear.»*  
*«Tu contenido. Tu equipo. Tu control.»*

Para que un creador o agencia multicanal pueda escalar sin caos:
1. **La carpeta `youtube/` como santuario:** Todo el trabajo de canales de YouTube debe estar centralizado y aislado de otros proyectos, evitando mezclar recursos de diferentes plataformas o archivos personales.
2. **Plantillas vivas desde el minuto cero:** Cuando un creador inicializa su primer canal (`Canal_1`) o añade uno nuevo, no empieza desde una carpeta en blanco. Recibe de inmediato la estructura recomendada (`InfoCanal/`, `Guiones/`, `Videos/`, `Miniatura/`, `Musica/`, `Imagenes/`) con guías Markdown prellenadas que el orquestador y él mismo van actualizando.
3. **Sincronización tolerante a fallos:** Si el usuario vincula su canal desde el móvil o en la web con el motor local apagado, no hay error ni bloqueo: el canal queda asegurado en la base de datos en estado `PENDING`. Cuando enciende su PC y arranca el motor, el sistema lo recibe cordialmente: *"Hey, el motor está conectado. Crea la carpeta de tu canal..."*, ejecutando la inicialización en un solo clic.
4. **Gobierno amigable y sin fricción:** Si el usuario sobrepasa el número de canales de su plan en disco, no se le bloquea con un error críptico. Se le presenta una alerta limpia con el botón *"Proceder con la limpieza"*, donde puede seleccionar cuáles proyectos desea archivar o eliminar de su disco local de forma consciente y segura.

---

### 2. Tabla de Capacidades

| Capacidad | Estado | Descripción |
|---|:---:|---|
| Rama `workspace/youtube` canónica | `✅ HECHO` | Motor y Next.js anclan los canales a `.../workspace/youtube`. |
| Plantilla base de `Canal_1` automática | `✅ HECHO` | Generación automática de `Canal_1` si el workspace es nuevo. |
| Subcarpetas modulares (`InfoCanal`, `Guiones`, `Videos`, `Miniatura`, `Musica`, `Imagenes`) | `✅ HECHO` | Creación estandarizada con plantillas Markdown (`Contexto`, `Metricas`, `Historial`, `Guion`, `Miniatura`). |
| Planes Basic (3), Pro (7), Enterprise (Ilimitado) | `✅ HECHO` | Límites actualizados en `pricing-config`, migraciones SQL y traducciones. |
| Trazabilidad `folderStatus` ('PENDING' / 'CREATED') | `✅ HECHO` | Canales vinculados sin motor se guardan y se sincronizan al conectar el motor. |
| Modal interactivo de limpieza (`WorkspaceCleanupModal`) | `✅ HECHO` | Alerta y selección de carpetas excedentes para eliminación segura. |
| Archivado automático en zip antes de eliminar | `💡 IDEA` | Opción en el modal de limpieza para empaquetar la carpeta en `.zip` antes de borrar. |
| Sincronización en la nube opcional de `InfoCanal` | `💡 IDEA` | Backup automático de los 4 archivos `.md` de ADN en Supabase Storage. |
