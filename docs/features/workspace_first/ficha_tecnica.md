# 🏛️ FEAT-23 — Arquitectura Workspace-First & Exploración Libre de Proyectos

## Ficha Técnica

> **Ruta:** `docs/features/workspace_first/ficha_tecnica.md`  
> **Estado:** `✅ HECHO` (En producción / Operativo)  
> **Capa Técnica:** Next.js 15 (App Router) + PostgreSQL (pgvector / Prisma) + FileSystem Local

---

### 1. Propósito y Arquitectura

Esta funcionalidad transforma el núcleo cognitivo de AutoProd de una arquitectura anclada y forzada a "canales de YouTube" hacia un modelo **Workspace-First**:

1. **El Workspace como Fuente Soberana de Contexto:**  
   El espacio de trabajo físico del usuario en su disco es un entorno abierto donde organiza libremente proyectos de contenido (series, podcasts, marcas, líneas editoriales, canales). La IA no asume una jerarquía rígida ni impone carpetas reservadas.
2. **Exploración en Tiempo Real (Snapshot de 2 Niveles):**  
   En cada mensaje entrante en `app/api/chat/route.ts`, el sistema realiza un escaneo superficial y seguro del sistema de archivos local (hasta 2 niveles de profundidad: raíz y subcarpetas inmediatas), inyectando una instantánea neutral y estructurada en el System Prompt. Dispone de topes de seguridad (máximo 60 entradas en la raíz y 20 elementos por subcarpeta) para garantizar rendimiento y control estricto de tokens.
3. **Desacoplamiento de Heurísticas Hardcodeadas:**  
   Se eliminaron las detecciones forzadas de "canal activo" basadas en coincidencia de subcadenas de texto en el mensaje del usuario, las reglas mandatorias que obligaban a proponer "2-3 títulos de video con métricas de YouTube", y la inyección automática de similitud vectorial de canales.
4. **Herramienta `workspace_control` Abierta y Segura:**  
   El endpoint unificado de disco (`app/api/tools/workspace_control/route.ts`) se reescribió para operar con libertad y seguridad traversal (`resolveInsideWorkspace`):
   - Creación y eliminación de rutas arbitrarias bajo petición explícita del usuario o acuerdo en el briefing.
   - Eliminación de la creación forzada de `InfoCanal/` o `Contexto_canal.md`.
   - Eliminación de la inserción automática en la tabla `Channel` de Prisma al crear carpetas en la raíz.
5. **Gobernanza de Tools por Dominios (Fase 1):**  
   A través de la migración `017_workspace_only_tools.sql`, el agente `orchestrator` se vincula exclusivamente a las herramientas activas de la fase (`workspace_control`, `system_control`, `creative_studio`), desvinculando herramientas legacy o específicas de YouTube para evitar sesgos y alucinaciones.

---

### 2. Archivos Modificados e Implementados

| Archivo | Tipo de Cambio |
|---|---|
| `app/api/tools/workspace_control/route.ts` | Refactor integral: soporte de rutas anidadas seguras, sanitización traversal, eliminación de inserción forzada en BD `Channel`, y acciones `listar`, `crear_carpetas`, `eliminar_carpetas`, `leer_archivo`, `guardar_archivo`. |
| `app/api/chat/route.ts` | Eliminación de heurísticas de canal activo, directivas mandatorias de títulos de video de YouTube, inyecciones de pgvector de canales y optimización del snapshot del workspace a 2 niveles neutrales con topes de seguridad. |
| `migrations/017_workspace_only_tools.sql` | Migración SQL idempotente: desvinculación de tools legacy (`crear_canal`, `generar_info_canal`, `extraer_canal_youtube`, `channel_memory`), actualización de la directiva del orquestador y actualización de semillas en `toolIntentGolden`. |
| `AGENTS.md` | Actualización de la sección de taxonomía del espacio de trabajo a un modelo Workspace-First donde las estructuras de producción son recomendaciones modulares, no mandatos rígidos de código. |

---

### 3. Endpoints del Sistema

#### `POST /api/tools/workspace_control`
Control unificado del sistema de archivos local en el Workspace del usuario.

- **`listar`**: Explora directorios devolviendo si existen, sus elementos y subdirectorios.
- **`crear_carpetas`**: Crea una o múltiples carpetas físicas relativas al workspace root.
- **`eliminar_carpetas`**: Elimina de forma segura carpetas en disco evitando borrado de la raíz.
- **`leer_archivo`**: Lee archivos de notas, contexto o guiones hasta 8,000 caracteres.
- **`guardar_archivo`**: Escribe o sobrescribe atómicamente archivos de texto o Markdown.
