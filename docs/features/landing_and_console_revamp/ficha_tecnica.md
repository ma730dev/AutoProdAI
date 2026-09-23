# ⚙️ Ficha Técnica: Landing Page & Console UX/UI Revamp (FEAT-13)

> **Módulo:** Rediseño Integral de Frontend, Identidad Visual y Consola de Producción  
> **Estado:** `✅ HECHO`  
> **Archivos Modificados:**  
> - `public/brand/` (Directorio oficial con `logo-monogram.svg`, `logo-monogram.png` y `logo-lockup.png`)  
> - `public/references/` (Referencia de diseño `four-pillars-reference.png`)  
> - `docs/features/landing_and_console_revamp/assets/` (Referencias de diseño: `four-pillars-reference.png`, `mockup-section-reference.png`, `hero-branding-feedback.png`)  
> - `public/logo.svg` y `public/logo.png` (Archivos raíz para acceso directo estático)  
> - `app/icon.svg` (Favicon e icono de aplicación nativo de Next.js App Router)  
> - `components/AutoProdLogo.tsx` (Componente React reutilizable del monograma AP)  
> - `app/layout.tsx` (Metadatos con favicon/icons y fuentes Google: Plus Jakarta Sans, Space Grotesk, Inter)  
> - `app/globals.css` (Clases de utilidad de tipografía .font-logo, .font-title, .font-btn, etc.)  
> - `app/page.tsx` (Hero centrado sin fondo con marca AutoProdai, mockup interactivo y especificaciones realistas)  
> - `app/translations.ts` (Diccionario bilingüe actualizado con visión integral para creadores de video)  
> - `app/login/page.tsx` (Cabecera de autenticación con logotipo oficial vectorial)  
> - `app/dashboard/page.tsx` (Cabecera con logotipo oficial, switcher de estudios y status de motor local)  
> - `components/dashboard/Launchpad.tsx` (Tarjetas de acción directa: bucles, clips rápidos, subtítulos y portadas)  

---

## 🏗️ 1. Arquitectura y Componentes del Frontend

### 1.1 Branding e Identidad Visual
- **Logotipo Vectorial Oficial (`public/logo.svg`):**
  - Monograma geométrico estilizado `AP` con trazo redondeado morado (`#8629FE`).
  - Implementado con efecto de brillo suave (`drop-shadow`) en Navbar, Footer, Login y Dashboard Header.
- **Jerarquía Tipográfica Coherente:**
  - **Logo / Identidad:** *Plus Jakarta Sans* 800 (ExtraBold).
  - **Títulos y Titulares:** *Space Grotesk* 700 (Bold).
  - **Subtítulos y Bloques de Apoyo:** *Space Grotesk* 500 (Medium).
  - **Botones y CTAs:** *Plus Jakarta Sans* 600 (SemiBold).
  - **Cuerpo, Descripciones y Docs:** *Inter* 400 (Regular).
  - **Datos, Badges y UI:** *Inter* 500 (Medium).

### 1.2 Landing Page (`app/page.tsx`)
- **Protagonismo Monumental del Logo y la Marca en el Hero:**
  - Logotipo oficial `AP` en escala gigante (`h-32` a `lg:h-60`), 100% libre sin caja ni fondo (`fill="none"`), centrado con un aura envolvente de neón violeta (`#8629FE`, blur de 100px).
  - Nombre de marca como el elemento más grande y dominante de la página: **AutoProdAI** en escala colosal (`text-5xl` a `text-8xl`), en tipografía *Plus Jakarta Sans* 800 ExtraBold (`font-logo`).
  - **Titular Complementario (H2 - Space Grotesk 700):** *"Nunca había sido tan fácil producir tu contenido"*, en un tamaño armónico que acompaña sin competir (`text-2xl` a `text-5xl`).
  - **Subtitular (Space Grotesk 500):** *"Crea, edita y escala tus videos con Inteligencia Artificial"*, en `text-zinc-400`.
  - **Párrafo Descriptivo (Inter 400):** Conciso, ligero y estilizado (`text-zinc-500`), dejando todo el protagonismo a la marca y el valor del producto.
- **Posicionamiento Transversal para Creadores:**
  - Orientado a creadores con cámara propia, editores, generadores de clips para Shorts/Reels/TikTok y canales automatizados.
  - Cero hipérboles irreales: Especificación precisa de bucles de 1 a 3 horas, sincronización de audio, subtitulado palabra por palabra, diseño de portadas 16:9 y 9:16, y optimización de metraje.
- **4 Pilares Interactivos (Creativo, Producción, Analytics, Automatización):**
  - Composición vertical de 4 columnas cromáticas de alto impacto:
    1. 💡 **Creativo (Cyan / Electric Blue):** Exploración de ideas, diseño de portadas y biblioteca multimedia.
    2. 🎬 **Producción (Neon Purple / Violet #8629FE):** Bucles de 1 a 3 Horas en 4K, Recortes y Clips Rápidos, Subtítulos Dinámicos.
    3. 📊 **Analytics (Amber / Gold):** Extractor de Canales YouTube, Exploración de temas y enfoques, Memoria Histórica del Canal.
    4. 🤖 **Automatización (Emerald / Mint Green):** Calendario de Publicación con slots programados por canal, Cola de Render Desatendido y Pipeline End-to-End.
  - **Mecánica Hover Interactiva:** En reposo exhibe tipografía monumental, slogans y auras de color; al pasar el cursor o hacer clic, la columna se expande (`lg:flex-[2.2]`) y revela las tarjetas de herramientas correspondientes.
- **Showcase Interactivo del IDE:**
  - Pestañas funcionales con previsualización en tiempo real de Asistente de Guiones, Bucles y Clips, Subtitulador Dinámico, Miniaturas y Gestión de Canales.
- **FAQ y Sección Comparativa:**
  - Aclaración directa de compatibilidad con CapCut/Premiere, renderizado por hardware local y privacidad total de archivos.

### 1.3 Consola de Producción: Arquitectura de 3 Paneles (`app/dashboard/page.tsx`)
- **Layout de 3 Columnas Simultáneas:**
  1. **Panel Izquierdo (`ConversationSidebar.tsx`):**
     - Monitor en tiempo real e interruptor de arranque/apagado del Motor Local (`localhost:8000`).
     - Árbol de navegación jerárquica del Workspace (`FileTree.tsx`) con canales, videos y carpetas base.
     - Botones de acceso directo a los 4 estudios de producción: `🎬 Video Studio (Editor)`, `🎨 Creador de Imágenes`, `🗃️ Biblioteca de Recursos` y `🎙️ Locución & TTS`.
     - Tarjeta compacta del Copilot IA con botón para nuevo chat y estado de actividad.
  2. **Panel Central (`<main>` - Espacio de Trabajo / Canvas Activo):**
     - Mantiene siempre visible el estudio en uso (`Launchpad`, `Video Studio`, `Image Studio`, `Asset Library` o `TTS`).
     - No desaparece ni se reemplaza al chatear: el creador puede interactuar con el agente sin perder el contexto visual de su línea de tiempo, metraje o recursos.
  3. **Panel Derecho (`ChatPanel.tsx` / `FilePreviewer.tsx` - Copilot Persistente):**
     - Copilot universal accesible desde cualquier pantalla del sistema.
     - Selector desplegable de historial de conversaciones con buscador rápido, renombrado inline y eliminación.
     - Botón `+ Nueva conversación`, selector de plantillas SOP y botón de colapso rápido (`✕`).
     - Manilla de arrastre horizontal fluida (`makeDragHandler`) para redimensionar de 320px a 700px.
     - Botón flotante inferior derecho y toggle en cabecera para abrir/cerrar el panel con un solo clic.
     - Integración con el visor de archivos (`FilePreviewer.tsx`) con pestaña de alternancia para volver al Copilot.

---

## 🔒 2. Cumplimiento de Reglas del Repositorio
- Cero hardcoding en componentes: Todos los textos se gestionan en `app/translations.ts` con soporte bilingüe completo (`es` / `en`).
- Se preserva el Orquestador Central en `app/api/chat/route.ts` y las herramientas en `app/api/tools/`.
