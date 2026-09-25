# ⚙️ Ficha Técnica — FEAT-20: Orquestación Creativa, Briefing de Ideación, Negociación de Créditos & Tool generar_imagen en Chat

> **Ubicación:** `docs/features/creative_orchestration_and_image_tools/ficha_tecnica.md`  
> **Estado:** `✅ HECHO`  
> **Fecha:** Septiembre 2026  
> **Stack:** Next.js (App Router), AI SDK, Supabase (pgvector + Storage), OpenAI DALL-E 3 & GPT-4o, Prisma  

---

## 🏛️ 1. Arquitectura y Componentes Técnicos

```
┌─────────────────────────────────────────────────────────────┐
│                 CHAT INTERACTIVO (ChatPanel)               │
│  - Renderizado Markdown enriquecido (img con visor HD)      │
│  - InteractiveQuestionCard (confirmación en 1 clic)         │
└──────────────────────────────┬──────────────────────────────┘
                               │ POST /api/chat
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            CEREBRO ORQUESTADOR (/api/chat/route.ts)         │
│  1. Detección de Consentimiento de Créditos (Regex / Body)  │
│  2. Directivas de Briefing y Canales de Reflejo             │
│  3. Selección de Modelo: gpt-4o-mini (Free) -> GPT-4o (3cr) │
│  4. Proxy de Tools -> Despacho a /api/tools/...             │
│  5. Inyector Garantizado de Markdown de Imagen              │
└──────────────────────────────┬──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ app/api/tools/generar_imagen │    │     MIGRACIÓN SQL 010        │
│  - DALL-E 3 (16:9, 9:16, 1:1)│    │  - Tool generar_imagen       │
│  - Guardado en Workspace     │    │  - toolIntentGolden (5)      │
│  - Registro en Prisma Asset  │    │  - Protocolo Briefing Prompt │
│  - Descuento de 5 créditos   │    │  - Vinculación en agentTool  │
└──────────────────────────────┘    └──────────────────────────────┘
```

---

## 🛠️ 2. Endpoints y Herramientas

### `POST /api/tools/generar_imagen`
Tool oficial de AutoProd conforme a la **Regla 2 de AGENTS.md**.

**Payload de Entrada:**
```json
{
  "prompt": "Un primer plano cinematográfico de un programador mirando monitores con código neón, iluminación lateral dramática, estilo cinematográfico 4K",
  "aspect_ratio": "16:9",
  "tipo": "THUMBNAIL",
  "channel_name": "CanalTech",
  "video_title": "MiPrimerVideo"
}
```

**Respuesta Exitosa:**
```json
{
  "status": "success",
  "fileName": "miniatura_un_primer_plano_cinematografico.png",
  "filePath": "E:\\autoprod\\CanalTech\\MiPrimerVideo\\Miniatura\\miniatura_un_primer_plano_cinematografico.png",
  "imageUrl": "/api/assets/stream?path=...",
  "markdown": "\n\n![THUMBNAIL: miniatura_un_primer_plano](/api/assets/stream?path=...)\n\n",
  "dimensions": "1792x1024",
  "newBalance": 45,
  "assetId": "uuid-..."
}
```

---

## 🗄️ 3. Migración de Base de Datos (`010_image_generation_tool_and_discovery_prompts.sql`)

1. **Tabla `tool`:** Registra `generar_imagen` con su esquema de validación JSON Schema y endpoint `http://localhost:3000/api/tools/generar_imagen`.
2. **Tabla `agentTool`:** Asocia la herramienta al agente `orchestrator`.
3. **Tabla `toolIntentGolden`:** Ingesta 5 intenciones canónicas de generación gráfica en el dominio `CREATIVE_STUDIO`.
4. **Tabla `agent` y `promptTemplate`:** Inyecta las directivas de Briefing y Consulta Transparente de Créditos en `crear_canal` y el system prompt global del Orquestador.

---

## 🎨 4. Renderizado en Frontend (`components/chat/ChatPanel.tsx`)

- **Componente `img`:** Contenedor estilizado con borde `border-zinc-700/60`, fondo oscuro, sombra y barra inferior con título y enlace "Ver HD".
- **Componente `code`:** Intercepta bloques con sintaxis ````interactive-question````, ````interactive_question````, ````questionnaire````, ````interactive_form```` y renderiza `<InteractiveQuestionCard>` como un **formulario nativo que emerge directamente en la conversación del chat**, soportando wizard por pasos, radio buttons circulares, opción abierta personalizada ("Otra respuesta: Escribe aquí...") y transición animada al completarse sin oscurecer ni bloquear la pantalla con modales globales.
