# REGLAS DEL REPOSITORIO AUTOPROD (LEER OBLIGATORIAMENTE)

Antes de realizar CUALQUIER cambio arquitectónico, crear una funcionalidad, o modificar el código fuente de AutoProd, **DEBES** leer el índice de funcionalidades ubicado en `docs/index.md` y el Master Tracker en `docs/features/README.md`. 
No asumas la arquitectura. Navega a `docs/index.md`, lee el contexto de tu tarea, y si creas o modificas una funcionalidad, estás obligado a documentarla en `docs/features/{tu_feature}/` separando su `ficha_tecnica.md` (código, arquitectura, endpoints) e `idea.md` (visión, alcance y escalabilidad), actualizando el Master Tracker.

---

## 🏛️ REGLAS CARDINALES DE ARQUITECTURA DE AUTOPROD

### 1. UN SOLO CEREBRO ORQUESTADOR (`app/api/chat/route.ts`)
- AutoProd opera bajo un modelo de **Orquestador Central** (Agentic Brain).
- **PROHIBIDO** crear sub-agentes dispersos o rutas paralelas de chat/razonamiento en `app/api/agents/...` o `app/api/chat/ask/...`.
- Toda interacción de usuario y ejecución coordinada ocurre a través de `/api/chat`.

### 2. TODAS LAS HERRAMIENTAS EJECUTABLES DEBEN RESIDIR EN `app/api/tools/`
- Cualquier endpoint que realice una acción (crear carpetas, extraer datos, generar metadatos, consultar SOPs) es una **Tool del Cerebro**.
- Su ruta obligatoria es: `app/api/tools/[nombre_tool]/route.ts`.
- Las tools se registran en la tabla `Tool` de la base de datos y se vinculan al agente en `AgentTool`.
- **PROHIBIDO** crear carpetas de utilidades o endpoints sueltos fuera de `app/api/tools/`.

### 3. CERO HARDCODING Y PROMPTS DINÁMICOS VÍA `consultar_prompts`
- **PROHIBIDO** quemar directivas operativas extensas, prompts de roles o guías paso a paso (SOPs) en archivos de código TypeScript (`.ts` o `.tsx`).
- Las directivas y plantillas viven en la tabla `PromptTemplate` de la base de datos.
- El Orquestador utiliza la tool `consultar_prompts` (`app/api/tools/prompts/route.ts`) mediante Function Calling para cargar bajo demanda las reglas específicas cuando atiende una tarea (ej: `crear_canal`, `crear_video`, `crear_guion`).

### 4. INFRAESTRUCTURA Y BASELINE VÍA MIGRACIONES SQL
- La configuración base, herramientas del sistema y plantillas de prompts no se crean con seeds manuales en tiempo de ejecución (`db:seed` o `GET` endpoints de desarrollo).
- Todo cambio en esquema o datos de arranque debe declararse de forma idempotente en `migrations/*.sql` para su despliegue gestionado por Terraform / Supabase.
- **Nomenclatura Estricta y Secuencial (`005_...`, `006_...`):** Toda nueva migración SQL DEBE seguir el prefijo secuencial de 3 dígitos con ceros a la izquierda. Actualmente el baseline se encuentra en `004_ip_registration_and_anti_abuse.sql`, por lo que las siguientes migraciones **DEBEN** ser obligatoriamente:
  - `migrations/005_nombre_descriptivo.sql`
  - `migrations/006_nombre_descriptivo.sql`
  - y así sucesivamente.
- **Idempotencia Obligatoria:** Todo archivo `.sql` debe ser idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ON CONFLICT DO NOTHING / UPDATE`).
- **Sincronización con Prisma:** Cualquier cambio en tablas o modelos SQL debe replicarse inmediatamente en `prisma/schema.prisma` y ejecutarse `pnpm exec prisma generate`.

### 5. DEFINICIÓN DE PRODUCTO Y TONO DE VOZ (CERO HUMO, CERO TECNICISMOS)
- **Definición Oficial:** AutoProd es el **sistema operativo para canales de contenido**. Un espacio donde los creadores organizan sus proyectos, desarrollan ideas con intención, producen con sus propios recursos, analizan resultados y construyen un workflow que se adapta a su forma de crear.
- **Manifiesto de Marca:** *«La automatización no reemplaza al creador. Le devuelve tiempo para crear.»* | *«Automatiza el trabajo. Conserva el control.»*
- **Los 4 Pilares:** `CREA` • `PRODUCE` • `ANALIZA` • `ESCALA`.
- **Diferencial de Ejecución:** *«Tu contenido. Tu equipo. Tu control»* (velocidad nativa, costo predecible y soberanía absoluta sobre los archivos).
- **PROHIBIDO:** En cualquier texto visible al usuario (landing, dashboard, tooltips, modales), exponer tecnologías internas (FastAPI, Python, FFmpeg, Whisper, CUDA, DALL-E, pgvector, tokens) o recurrir a clichés de marketing agresivo ("viral", "ganchos de retención", "fórmulas mágicas", "bots que hacen videos solos"). Comunicar siempre desde la capacidad, la organización y el beneficio real para el creador.

### 6. SOBERANÍA Y EXCLUSIVIDAD DE EJECUCIÓN DE ARNESES (`harness/`)
- **PROHIBIDO** para la IA ejecutar comandos de arneses (`pnpm db:migrate`, `pnpm deploy:prod`, `pnpm deploy:vercel`, `pnpm build:exe`, scripts de `harness/`) de forma autónoma.
- La IA puede crear, optimizar, documentar y mantener los scripts y herramientas dentro de `harness/`, pero **ÚNICAMENTE el usuario tiene la potestad de disparar su ejecución manual** desde su terminal cuando lo considere pertinente.

### 7. ESTRICTA PROHIBICIÓN DE INICIATIVAS NO PEDIDAS (CERO AGREGADOS FANTASMA EN UI Y CÓDIGO)
- **PROHIBIDO** crear o insertar botones, barras, enlaces, toggles, widgets flotantes, badges o componentes visuales que el usuario NO haya solicitado explícitamente en su mensaje.
- La IA DEBE apegarse de forma quirúrgica al alcance estricto pedido por el usuario. Si el usuario pide modificar, mover o eliminar algo, se ejecuta eso y NADA MÁS.
- **PROHIBIDO** asumir «mejoras de experiencia», atajos espontáneos o elementos estéticos no pedidos. Si surge una duda de usabilidad o navegación, la IA está obligada a preguntar en vez de alterar la interfaz por su cuenta.
- Toda alteración o elemento de interfaz inventado sin instrucción expresa del usuario constituye una falta grave a las directivas del repositorio.

---

## 📁 TAXONOMÍA Y ORGANIZACIÓN DEL ESPACIO DE TRABAJO (WORKSPACE)

El sistema de archivos de AutoProd se organiza de forma estricta en 3 niveles jerárquicos:

```
📁 {workspace}/                                 <-- [NIVEL 0: Raíz del Workspace]
└── 📁 NombreDelCanal/                          <-- [NIVEL 1: CANAL] (Cada carpeta en la raíz es un canal)
    ├── 📁 InfoCanal/                            <-- [NIVEL 2: MEMORIA Y ADN DEL CANAL] (¡NO es un video!)
    │   ├── Contexto_canal.md                   (Nicho, audiencia objetivo, tono y directivas)
    │   ├── Metricas_canal.md                   (Estadísticas y rendimiento de YouTube)
    │   ├── Historial_canal.md                  (Títulos y tags ya cubiertos para no repetir)
    │   └── [Recursos Gráficos: logo.jpg, banner.jpg, marca_de_agua.jpg]
    └── 📁 Titulo_Del_Video/                     <-- [NIVEL 2: PROYECTO DE VIDEO] (Hermanos de InfoCanal)
        ├── 📁 Guiones/                         <-- [NIVEL 3: Recursos de Producción] (Guion en Markdown)
        ├── 📁 Videos/                          (Metraje bruto, clips y render final .mp4)
        ├── 📁 Miniatura/                       (Prompts, conceptos y portada final)
        ├── 📁 Musica/                          (Pistas de audio y música de fondo)
        └── 📁 Ambiente/                        (Efectos SFX y atmósferas sonoras)
```

**Reglas de Reconocimiento y Filosofía de Organización:**
- **Canal:** Carpeta de Nivel 1 en la raíz del Workspace.
- **`InfoCanal/`:** Carpeta de Nivel 2 exclusiva para la memoria, directivas e identidad del canal. **NUNCA** es un video.
- **Proyecto de Video:** Carpeta de Nivel 2 dentro de un canal (hermana de `InfoCanal/`).
- **Plantilla Base Modular (Nivel 3):** Las subcarpetas (`Guiones/`, `Videos/`, `Miniatura/`, `Musica/`, `Ambiente/`) constituyen la **estructura base recomendada** para mantener el espacio 100% ordenado y libre de caos. Sin embargo, AutoProd es un sistema adaptativo: **comprende y respeta los lineamientos específicos de cada creador**. No todo proyecto requiere los 5 recursos (ej. un canal Lo-Fi puede prescindir de guion y TTS; un videoblog utiliza el audio directo de su cámara). El Orquestador y el Video Studio operan de forma dinámica y modular sobre los recursos presentes sin imponer bloqueos artificiales.

---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
