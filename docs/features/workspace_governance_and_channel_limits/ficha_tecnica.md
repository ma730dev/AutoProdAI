# 🏛️ FEAT-21 — Gobernanza de Espacio de Trabajo, Rama `workspace/youtube` & Auditoría de Límites de Canales

## Ficha Técnica

> **Ruta:** `docs/features/workspace_governance_and_channel_limits/ficha_tecnica.md`  
> **Estado:** `✅ HECHO` (En producción / Operativo)  
> **Capa Técnica:** Next.js 15 + FastAPI (Motor Local 8000) + PostgreSQL/Prisma + Supabase

---

### 1. Propósito y Arquitectura

Esta funcionalidad establece la estructura canónica y gobierno estricto de las carpetas de canales dentro del workspace del usuario, coordinando la sincronización de archivos entre la base de datos cloud y el hardware local del creador:

1. **Rama Canónica `workspace/youtube`:**  
   Todo canal gestionado en AutoProd se crea y aloja exclusivamente dentro de `{workspace}/youtube/`.
2. **Plantilla Base Modular de Canales:**  
   Al crear o inicializar un canal nuevo (o si el workspace es nuevo con `Canal_1`), se crea la estructura modular obligatoria:
   - `InfoCanal/`: `Contexto_canal.md`, `Metricas_canal.md`, `Historial_canal.md`, `Branding_canal.md`.
   - `Guiones/`: `Plantilla_Guion.md`.
   - `Videos/`: `README.md` (metraje bruto, clips y exportaciones finales).
   - `Miniatura/`: `Ideas_Miniaturas.md`.
   - `Musica/`: `README.md` (pistas libres de copyright).
   - `Imagenes/`: `README.md` (recursos visuales, capturas y miniaturas IA).
3. **Límites de Canales por Plan:**  
   - **Basic (Starter):** Hasta **3 canales** activos.
   - **Pro:** Hasta **7 canales** simultáneos.
   - **Enterprise:** **Ilimitado** (9999 canales).
   - **Free Trial:** 1 canal de prueba.
4. **Trazabilidad de Creación Física (`folderStatus`):**  
   - Si el canal se vincula (por OAuth o creación) mientras el motor local está **offline**, se registra en la base de datos con `folderStatus: 'PENDING'`.
   - Al encenderse o conectarse el motor (`motorStatus === true`), el sistema detecta canales pendientes y emite una alerta interactiva al creador con acción directa de un clic para crear la estructura física en disco.
5. **Auditoría Física y Modal de Limpieza (`WorkspaceCleanupModal`):**  
   - Al conectarse el motor local, se audita el número de carpetas físicas en `workspace/youtube`.
   - Si el número de carpetas excede el límite del plan del usuario (`folders.length > maxAllowed` y `role !== 'ADMIN'`), se despliega de inmediato el modal de limpieza interactivo para seleccionar y eliminar carpetas sobrantes de forma segura tanto en disco como en base de datos.

---

### 2. Archivos Modificados e Implementados

| Archivo | Tipo de Cambio |
|---|---|
| `migrations/011_workspace_youtube_and_channel_folder_sync.sql` | Migración SQL idempotente: añade `folderStatus VARCHAR(20) DEFAULT 'PENDING'` a `channel` y actualiza `planLimit` (Starter=3, Pro=7, Enterprise=9999). |
| `prisma/schema.prisma` | Modelo `Channel`: campo `folderStatus String? @default("PENDING")`. |
| `src/prisma/contract.prisma` | Sincronización del contrato Prisma con `folderStatus`. |
| `lib/pricing-config.ts` | Configuración de planes: `STARTER` (maxChannels: 3, Plan Básico), `PRO` (maxChannels: 7). |
| `controlador/routers/workspace.py` | `init_channel_template_files()`, `ensure_youtube_workspace_and_template()`, endpoint `GET /workspace/audit_channels`, y soporte de creación de canal con plantillas completas. |
| `harness/setup/detector.ts` | `getWorkspacePath()` resolviendo y garantizando la rama `workspace/youtube`. |
| `lib/controlador-client.ts` | Métodos `createChannel()`, `auditChannels()`, `deleteFolder()`. |
| `app/api/channels/route.ts` | Soporte para `folderStatus`, endpoint `PATCH` (actualización de estado físico) y `DELETE` (eliminación de canales en cascada). |
| `app/api/auth/youtube/callback/route.ts` | Validación de límites de suscripción previa al enlace OAuth y registro con `folderStatus: 'PENDING'`. |
| `app/api/tools/crear_canal/route.ts` | Creación en disco de las subcarpetas `InfoCanal`, `Guiones`, `Videos`, `Miniatura`, `Musica`, `Imagenes` y sus plantillas Markdown. |
| `components/modals/WorkspaceCleanupModal.tsx` | Componente visual interactivo para auditar, seleccionar en bloque y eliminar carpetas excedentes del workspace. |
| `app/dashboard/page.tsx` | Orquestación reactiva del estado del motor, detección de canales pendientes, auditoría de carpetas físicas y modal de limpieza. |
| `app/translations.ts` | Actualización de textos en español e inglés para reflejar los límites de 3 canales en Basic y 7 en Pro. |

---

### 3. Endpoints del Sistema

#### `GET /workspace/audit_channels` (Motor Local :8000)
- **Propósito:** Audita las carpetas de canales dentro de `workspace/youtube`.
- **Respuesta:**
  ```json
  {
    "youtube_root": "E:/AutoProdAI/workspace/youtube",
    "total_channels": 4,
    "channels": [
      {
        "name": "Canal_1",
        "path": "E:/AutoProdAI/workspace/youtube/Canal_1",
        "has_info_canal": true,
        "subfolders_count": 6,
        "created_at": "2026-09-24T18:00:00"
      }
    ]
  }
  ```

#### `POST /workspace/delete_folder` (Motor Local :8000)
- **Body:** `{ "paths": ["E:/AutoProdAI/workspace/youtube/CanalViejo"] }`
- **Respuesta:** `{ "status": "success", "message": "Se eliminaron 1 carpeta(s) correctamente." }`

#### `PATCH /api/channels` (Next.js)
- **Body:** `{ "id": "uuid-del-canal", "folderStatus": "CREATED" }`
- **Respuesta:** `{ "success": true, "channel": { ... } }`

#### `DELETE /api/channels` (Next.js)
- **Body:** `{ "name": "CanalViejo" }` o `{ "id": "uuid-del-canal" }`
- **Respuesta:** `{ "success": true, "deletedChannelId": "uuid-del-canal" }`
