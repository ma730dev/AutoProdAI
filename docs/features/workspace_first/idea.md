# 💡 FEAT-23: Arquitectura Workspace-First & Exploración Libre de Proyectos

> **Ubicación:** `docs/features/workspace_first/idea.md`  
> **Estado:** `✅ HECHO`  
> **Prioridad:** `P0`  
> **Módulo:** Núcleo Operativo del Workspace & Orquestador Central  

---

## 🎯 1. Visión y Propósito del Producto

Históricamente, AutoProd nació con una vinculación muy estrecha y rígida hacia los canales de YouTube: creaba automáticamente carpetas `InfoCanal/`, forzaba registros en la tabla `Channel` de base de datos, imponía límites de suscripción por número de carpetas en la raíz del disco, y el orquestador inyectaba directivas hardcodeadas que forzaban a la IA a asumir que cualquier carpeta era un canal de YouTube y a proponer títulos de video con métricas de retención sin haber hecho un briefing.

Esta rigidez limitaba la visión central de AutoProd: **el sistema operativo para proyectos de contenido**. Un creador puede tener series de podcasts, marcas, líneas de reels, cursos o proyectos experimentales que no siguen la estructura de un canal de YouTube.

**FEAT-23** redefine la interacción del sistema con el disco:
1. **Soberanía y Libertad del Creador:** El Workspace es un espacio abierto. La IA explora dinámicamente lo que existe (hasta 2 niveles de profundidad) para entender qué proyectos hay, en qué estado se encuentran y cómo puede asistir al usuario, sin imponer carpetas ni archivos que nadie pidió.
2. **Desacoplamiento Total de YouTube:** Las herramientas e integraciones de YouTube pasan a ser módulos desacoplados para consulta o inspiración externa en fases posteriores, sin contaminar el flujo de trabajo local de disco.
3. **Cero Hardcoding en el Chat:** Se erradicaron las heurísticas de texto y directivas quemadas en código TypeScript. Las reglas operativas residen de forma limpia en el system prompt y en las directivas dinámicas de la base de datos (`PromptTemplate`).

---

## 🏗️ 2. Lo que Tenemos Hoy vs. Lo que Faltaba

| Aspecto | Antes de FEAT-23 | Con FEAT-23 |
|---|---|---|
| **Definición del Workspace** | Considerado exclusivamente como un contenedor de "canales de YouTube". | Espacio abierto y soberano para proyectos de contenido de cualquier formato. |
| **Exploración de Disco** | La IA no tenía visión clara de archivos o se sesgaba por nombres heurísticos. | Snapshot neutral en tiempo real de hasta 2 niveles de profundidad (con límites anti-saturación de tokens). |
| **Creación de Carpetas (`workspace_control`)** | Creaba forzosamente `InfoCanal/` + `Contexto_canal.md` y escribía en tabla `Channel`. | Crea únicamente las carpetas que el creador solicita o aprueba, sin archivos forzados ni escrituras no pedidas. |
| **Límites de Carpetas** | Bloqueaba carpetas en la raíz mediante el límite de plan `maxChannels`. | Eliminado el bloqueo artificial en disco; el creador gestiona sus archivos con soberanía total. |
| **Directivas del Orquestador** | Cientos de líneas inyectando obligatoriedad de proponer 2-3 títulos de video de YouTube. | Orquestador centrado en el briefing, exploración de contexto y asistencia según el estado real del proyecto. |
| **Gobernanza de Herramientas** | Herramientas legacy de YouTube vinculadas al orquestador en `agentTool`. | Solo vinculadas herramientas del dominio activo (`workspace_control`, `system_control`, `creative_studio`). |

---

## 🚀 3. Escalabilidad & Horizontes Futuros

1. **Fase 1 (Implementada en FEAT-23):**
   - Control limpio y libre del Workspace en disco con `workspace_control`.
   - Snapshot en tiempo real inyectado en el prompt para dar noción inmediata a la IA de qué existe en el entorno.
   - Orquestador con enfoque en briefing, escucha activa y ejecución certera.

2. **Fase 2 (Integraciones Desacopladas de Plataformas):**
   - Módulo independiente de YouTube y Redes Sociales: herramientas como `channel_memory` o extractores de métricas se usan como herramientas externas de auditoría o inspiración, sin tocar la estructura del Workspace.
   - Sincronización opcional de publicación y analíticas sin mezclar la base de datos de producción con el árbol de archivos.

3. **Fase 3 (Asistencia Predictiva & Auto-Indexación Ligera):**
   - Generación de sumarios locales (`.summary.json` o metadatos ligeros) en segundo plano para proyectos grandes, permitiendo que la IA recuerde el avance de producción sin necesidad de leer archivos completos en cada interacción.
