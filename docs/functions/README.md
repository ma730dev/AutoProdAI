# 🔧 Catálogo de Herramientas y Dominios Operativos (AutoProd)

> **Propósito de este documento:** Referencia técnica del catálogo de herramientas unificadas por dominios, rutas Fast-Path y funciones ejecutables que el Orquestador Central (`app/api/chat/route.ts`) puede invocar. Si durante una conversación **el usuario menciona una capacidad o idea que no existe aún en este catálogo**, el agente de IA debe:
> 1. Identificar que la función aún no está implementada.
> 2. Preguntarle al usuario si desea registrarla como idea en el [Master Feature Tracker](file:///e:/autoprod/docs/features/README.md).
> 3. No improvisar ni asumir que existe.

---

## 🏛️ 1. Filosofía de Operación: Espacios de Trabajo, Carpetas y Archivos

AutoProd es el **sistema operativo para creadores de contenido**. Opera bajo una filosofía abierta y versátil donde:
- Toda producción se basa en el **control soberano de archivos y carpetas locales** (`workspace_control`).
- El usuario puede crear carpetas para canales, proyectos de video, podcast o cualquier tipo de producción audiovisual que desee sin restricciones artificiales ni rigideces de nomenclatura.
- El Orquestador Central utiliza **Domain Tool Retrieval** (filtrado inteligente por dominios) para dotar al modelo únicamente de las herramientas que necesita según la intención del usuario, reduciendo consumo de tokens y eliminando llamadas accidentales a disco.

---

## ⚡ 2. El Flujo de Decisión en 2 Capas (System 1 + System 2)

```
[ Mensaje del Usuario ]
           │
           ▼
┌──────────────────────────────────────┐
│     1. Router Semántico (System 1)    │  < 15ms, Embeddings HNSW + Heurística
└──────────────────┬───────────────────┘
                   │
         ¿Es Fast-Path directo?
        ┌──────────┴──────────┐
       SÍ                     NO
        │                      │
        ▼                      ▼
┌──────────────┐     ┌──────────────────────────────────────────────┐
│  FAST-PATH   │     │      2. Orquestador / LLM (System 2)         │
│  0 tokens    │     │  - Inyección selectiva por dominio           │
│  < 15ms      │     │  - GPT-4o-mini con herramientas filtradas    │
│  Respuesta   │     └──────────────────────┬───────────────────────┘
│  Directa     │                            │
└──────────────┘             ¿Requiere acción en el sistema?
                                    ┌───────┴───────┐
                                   SÍ               NO
                                    │                │
                                    ▼                ▼
                       ┌─────────────────────────┐  ┌──────────────┐
                       │ Invocación HTTP a Tool  │  │ Respuesta de │
                       │ /api/tools/[dominio]    │  │ Orientación  │
                       └─────────────────────────┘  └──────────────┘
```

### Rutas Rápidas (Fast-Paths de 0 Tokens):
1. **`capacidades_sistema` (`< 15ms`):** Responde de inmediato consultas de bienvenida, qué puede hacer AutoProd y estado general, listando los 4 pilares (`CREA`, `PRODUCE`, `ANALIZA`, `ESCALA`) y los canales físicos en disco sin tocar LLMs ni arriesgar errores 404.
2. **`listar_canales_disco`:** Inspección en tiempo real del directorio raíz del workspace.
3. **`consultar_proyecto_video`:** Consulta del proyecto en curso en la base de datos.
4. **`listar_proyectos_recientes`:** Historial de proyectos de video activos.
5. **`estado_sistema`:** Verificación de conectividad del motor local FastAPI (`localhost:8000`).

---

## 🔌 3. Los 4 Endpoints Unificados por Dominio (`app/api/tools/`)

En lugar de docenas de endpoints sueltos, AutoProd consolida sus herramientas en **4 dominios temáticos unificados con despachadores de acciones (`action`)**:

### 1. `workspace_control` (`/api/tools/workspace_control`)
Control absoluto y soberano del disco y sistema de archivos.

| Acción (`action`) | Parámetros | Descripción |
|---|---|---|
| `listar` | `path` | Inspección segura de directorios (retorna `{ exists: false }` si no existe, sin errores 404). |
| `crear_carpetas` | `paths: string[]` | Creación de directorios en bloque (canales, proyectos de video, carpetas modulares) con límites por plan. |
| `eliminar_carpetas` | `paths: string[]` | Eliminación segura de carpetas en disco con protección de carpetas reservadas. |
| `leer_archivo` | `path` | Lectura de guiones, configuraciones y archivos de texto (máx 8000 caracteres). |
| `guardar_archivo` | `path`, `content`, `overwrite` | Escritura atómica de guiones, ideas o configuraciones. |
| `default` | — | Información del workspace predeterminado configurado. |

---

### 2. `system_control` (`/api/tools/system_control`)
Diagnóstico local, directivas de producción y capacidades.

| Acción (`action`) | Parámetros | Descripción |
|---|---|---|
| `estado_sistema` | — | Diagnóstico de salud del motor local FastAPI en el puerto 8000 y workspace. |
| `consultar_prompts` | `tipo_prompt`, `categoria` | Carga dinámica de SOPs y directivas desde `PromptTemplate` sin hardcoding. |
| `capacidades` | — | Resumen de los 4 pilares operativos de AutoProd. |

---

### 3. `creative_studio` (`/api/tools/creative_studio`)
Estudio de producción multimedia y activos creativos.

| Acción (`action`) | Parámetros | Descripción |
|---|---|---|
| `generar_locucion` | `texto`, `voz` | Síntesis de narraciones y voces en off profesionales con control de créditos. |
| `generar_imagen` | `prompt`, `aspect_ratio`, `tipo`, `channel_name`, `video_title` | Generación de miniaturas (16:9), portadas y assets con DALL-E 3 guardados en el workspace. |

---

### 4. `channel_memory` (`/api/tools/channel_memory`)
Memoria contextual, ADN de audiencia e investigación de mercado.

| Acción (`action`) | Parámetros | Descripción |
|---|---|---|
| `extraer_canal_youtube` | `url_o_handle` | Extracción de metadatos, tags y estadísticas de referencia de YouTube vía yt-dlp. |
| `leer_memoria_canal` | `channel_name`, `seccion` | Lectura de la memoria viva local (`InfoCanal/`: `Contexto_canal.md`, `Metricas_canal.md`, `Historial_canal.md`). |

---

## 🎯 4. Tabla de Mapeo de Dominios en el Router Semántico

| Dominio | Herramientas Inyectadas | Modo Operativo |
|---|---|---|
| `WORKSPACE_FS` | `workspace_control`, `system_control` | Control de archivos, creación de carpetas y proyectos |
| `VIDEO_PROJECT` | `workspace_control`, `system_control` | Producción de video, timeline, guiones |
| `CREATIVE_STUDIO` | `creative_studio`, `workspace_control`, `system_control` | Locución, miniaturas y diseño |
| `CHANNEL_MEMORY` | `channel_memory`, `workspace_control`, `system_control` | Identidad, métricas de YouTube y memoria |
| `SYSTEM` | `system_control` | Diagnóstico, SOPs y consultas del sistema |
| *Modo Asesor (Sin Match)* | `system_control` | Modo conversacional seguro (Cero herramientas de disco) |

---

## 📋 5. Protocolo de Gestión de Nuevas Ideas

Cuando el usuario mencione una funcionalidad o capacidad que no existe en estos 4 dominios:
```
1. Notificar claramente que la capacidad no está disponible actualmente.
2. Preguntar si desea registrarla en el Master Feature Tracker (docs/features/README.md).
3. Si el usuario aprueba, documentar en docs/features/{nombre_feature}/ separando
   ficha_tecnica.md e idea.md, y actualizar el Master Tracker.
4. CERO invención de endpoints o atajos fuera de app/api/tools/.
```
