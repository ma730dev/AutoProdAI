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
- **Definición Oficial:** AutoProd es el **sistema operativo para proyectos de contenido** (un proyecto puede ser un canal, serie, marca o línea editorial; YouTube es un destino de publicación opcional, no la definición del producto). Un espacio donde los creadores organizan sus proyectos, desarrollan ideas con intención, producen con sus propios recursos, analizan resultados y construyen un workflow que se adapta a su forma de crear.
- **Manifiesto de Marca:** *«La automatización no reemplaza al creador. Le devuelve tiempo para crear.»* | *«Automatiza el trabajo. Conserva el control.»*
- **Los 4 Pilares:** `CREA` • `PRODUCE` • `ANALIZA` • `ESCALA`.
- **Diferencial de Ejecución:** *«Tu contenido. Tu equipo. Tu control»* (velocidad nativa, costo predecible y soberanía absoluta sobre los archivos).
- **PROHIBIDO:** En cualquier texto visible al usuario (landing, dashboard, tooltips, modales), exponer tecnologías internas (FastAPI, Python, FFmpeg, Whisper, CUDA, DALL-E, pgvector, tokens) o recurrir a clichés de marketing agresivo ("viral", "ganchos de retención", "fórmulas mágicas", "bots que hacen videos solos"). Comunicar siempre desde la capacidad, la organización y el beneficio real para el creador.

### 6. SOBERANÍA Y EXCLUSIVIDAD DE DESPLIEGUE (GitHub Actions)
- Los instaladores del motor (`.exe`, `.dmg`) se generan exclusivamente a través de **GitHub Actions**. No existe carpeta `harness/` ni scripts locales de build.
- **PROHIBIDO** para la IA disparar flujos de CI/CD, releases o workflows de GitHub de forma autónoma.
- La IA puede preparar el código, bumps de versión en `controlador/version.txt` y documentación de cambios, pero **ÚNICAMENTE el usuario activa los workflows de GitHub Actions** cuando lo considera pertinente.

### 7. ESTRICTA PROHIBICIÓN DE INICIATIVAS NO PEDIDAS (CERO AGREGADOS FANTASMA EN UI Y CÓDIGO)
- **PROHIBIDO** crear o insertar botones, barras, enlaces, toggles, widgets flotantes, badges o componentes visuales que el usuario NO haya solicitado explícitamente en su mensaje.
- La IA DEBE apegarse de forma quirúrgica al alcance estricto pedido por el usuario. Si el usuario pide modificar, mover o eliminar algo, se ejecuta eso y NADA MÁS.
- **PROHIBIDO** asumir «mejoras de experiencia», atajos espontáneos o elementos estéticos no pedidos. Si surge una duda de usabilidad o navegación, la IA está obligada a preguntar en vez de alterar la interfaz por su cuenta.
- Toda alteración o elemento de interfaz inventado sin instrucción expresa del usuario constituye una falta grave a las directivas del repositorio.

---

## 📁 TAXONOMÍA Y ORGANIZACIÓN DEL ESPACIO DE TRABAJO (WORKSPACE-FIRST)

El Workspace de AutoProd es un **espacio de trabajo abierto y soberano** en el disco del creador. La IA explora dinámicamente lo que existe para deducir contexto, intención y estado de producción sin forzar una jerarquía rígida.

```
📁 {workspace}/                                 <-- [NIVEL 0: Raíz del Workspace]
├── 📁 Recursos/                                <-- [Almacén global: B-roll, clips, proyectos de edición, loops y assets]
└── 📁 NombreDelProyecto/                       <-- [NIVEL 1: PROYECTO O LÍNEA EDITORIAL] (Espacio libre del creador)
    ├── [Archivos de notas / contexto / guiones]
    └── 📁 Pieza_O_Subproyecto/                 <-- [NIVEL 2: PIEZA DE CONTENIDO / PRODUCCIÓN] (Convención modular)
        ├── 📁 Guiones/                         <-- [Convención modular sugerida: Guion en Markdown]
        ├── 📁 Letras/                          <-- [Letras nombrando exactamente el archivo de audio]
        ├── 📁 Videos/                          <-- [Metraje bruto, clips y render final .mp4]
        ├── 📁 Miniatura/                       <-- [Prompts, conceptos y portada final]
        ├── 📁 Musica/                          <-- [Pistas de audio y música de fondo]
        └── 📁 Ambiente/                        <-- [Efectos SFX y atmósferas sonoras]
```

**Principios de Convivencia y Flexibilidad:**
- **Soberanía y Adaptabilidad:** El creador organiza sus carpetas y proyectos a su manera. La IA nunca debe borrar, sobreescribir ni imponer carpetas reservadas si el usuario no las solicita.
- **`Recursos/`:** Carpeta en la raíz del Workspace (**Nivel 0**). Almacén global y compartido de clips auxiliares (B-roll), proyectos de edición, loops y assets visuales/auditivos para el montaje multimedia.
- **Proyectos de Contenido (Nivel 1):** Carpetas en la raíz del Workspace que representan series, marcas, canales o líneas editoriales. No están obligadas a tener una estructura fija.
- **Convención Modular Sugerida (Niveles 2 y 3):** Las subcarpetas (`Guiones/`, `Letras/`, `Videos/`, `Miniatura/`, `Musica/`, `Ambiente/`) constituyen una plantilla base de alta productividad recomendada para piezas individuales de video o música, pero son **sugeridas**, no una imposición del sistema.
  - **`Letras/`:** Si se utiliza para producción musical o lírica, se recomienda guardar el texto con el nombre exacto de la pista de audio (`Cancion.txt` para `Cancion.mp3`) para facilitar el auto-matching de subtítulos.


---

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
