# 🧠 Ficha Técnica: Router Semántico Jerárquico & Telemetría Flywheel (FEAT-19)

> **Módulo:** `FEAT-19`  
> **Estado:** `✅ HECHO` (Fase 1 y Fase 2 provisionadas)  
> **Capa:** Next.js Server / pgvector (Supabase) / Vercel AI SDK / Prisma  
> **Tipo:** Decision Gatekeeper / Hierarchical Tool Retrieval / Intent Telemetry  

---

## 🏛️ 1. Arquitectura y Propósito

El **Router Semántico (System 1)** actúa como una capa de decisión de ultra-baja latencia (< 50ms) previa a la invocación del modelo de lenguaje autorregresivo (GPT-4o, Claude o Gemini). Su misión es:
1. **Clasificación por Dominios (Namespaces):** Agrupar herramientas en bolsas lógicas (`WORKSPACE_FS`, `VIDEO_PROJECT`, `CHANNEL_MEMORY`, `CREATIVE_STUDIO`, `SYSTEM`).
2. **Fast-Path Determinista:** Resolver consultas operativas directas (listados, lecturas de proyectos, estado) sin invocar el LLM ni quemar tokens de entrada/salida.
3. **Domain Tool Retrieval:** Cuando el LLM sí debe intervenir, inyectar únicamente las herramientas del dominio detectado en lugar del inventario completo de herramientas, reduciendo alucinaciones y latencia.
4. **Data Flywheel Asíncrono:** Registrar consultas en caliente en `intentTelemetry` (texto plano, $0 costo, 2ms) para su posterior curaduría y enriquecimiento del índice limpio `toolIntentGolden`.

---

## 🗄️ 2. Modelos de Base de Datos y pgvector

### A. Tabla `toolIntentGolden` (Índice Limpio)
* **Propósito:** Almacén de intenciones canónicas y vectores de referencia para búsqueda de similitud de coseno.
* **Campos Principales:**
  * `id`: UUID (Primary Key).
  * `toolName`: Identificador de la herramienta (`crear_canal`, `consultar_proyecto_video`, etc.).
  * `domain`: Dominio funcional (`WORKSPACE_FS`, `VIDEO_PROJECT`, etc.).
  * `canonicalQuery`: Formulación prototípica (ej: `"qué video estoy haciendo"`).
  * `embedding`: `vector(1536)` (generado con `text-embedding-3-small`).
  * `isDirectFastPath`: Booleano que define si la intención puede resolverse sin LLM.
  * `confidenceThreshold`: Umbral mínimo de similitud coseno (por defecto `0.85`).
* **Índice Vectorial:** HNSW sobre `embedding vector_cosine_ops` para búsquedas en < 15ms.

### B. Tabla `intentTelemetry` (Buffer en Caliente / Staging)
* **Propósito:** Captura pasiva y asíncrona de solicitudes de usuarios en producción.
* **Campos Principales:**
  * `id`: UUID (Primary Key).
  * `userId`: UUID (Nullable, vinculado a `user.id`).
  * `rawQuery`: Texto original recibido en el chat.
  * `detectedDomain`: Dominio detectado por el router.
  * `executedTool`: Herramienta efectivamente ejecutada.
  * `wasFastPath`: Booleano que audita si se resolvió sin LLM.
  * `confidenceScore`: Puntuación de similitud o certeza.
  * `status`: Estado del registro (`PENDING`, `PROMOTED`, `DISCARDED_DUPLICATE`, `FLAGGED_REVIEW`).

---

## ⚙️ 3. Funciones RPC y Librería Central

### Función RPC: `match_tool_intents`
```sql
match_tool_intents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  tool_name text,
  domain text,
  canonical_query text,
  is_direct_fast_path boolean,
  confidence_threshold float,
  similarity float
);
```

### Módulo: `lib/semantic-router.ts`
* `evaluateSemanticRoute()`: Vectoriza la consulta del usuario y ejecuta la búsqueda por similitud contra `toolIntentGolden`.
* `logIntentTelemetry()`: Registra en background (`setImmediate`) la solicitud en `intentTelemetry`.
* `getToolsForDomain()`: Retorna el subconjunto de herramientas permitidas para el dominio detectado.

---

## 🛠️ 4. Arneses de Mantenimiento (`harness/maintenance/`)

1. **`harness/maintenance/seed_golden_embeddings.ts`:**
   * Genera los vectores iniciales para todas las semillas canónicas en `toolIntentGolden` que tengan `embedding IS NULL`.
2. **`harness/maintenance/curate_intents.ts`:**
   * Procesa por lotes los registros `PENDING` de `intentTelemetry`.
   * Enmascara entidades privadas (`{URL}`, nombres propios).
   * Calcula similitud contra `toolIntentGolden`:
     * Similitud > 0.92 ➔ `DISCARDED_DUPLICATE`.
     * Similitud entre 0.70 y 0.90 ➔ `PROMOTED` a `toolIntentGolden`.
     * Similitud < 0.60 ➔ `FLAGGED_REVIEW`.
