# 💡 FEAT-20: Orquestación Creativa, Briefing de Ideación, Negociación de Créditos & Tool generar_imagen en Chat

> **Ubicación:** `docs/features/creative_orchestration_and_image_tools/idea.md`  
> **Estado:** `✅ HECHO`  
> **Prioridad:** `P0`  
> **Módulo:** Orquestador Central & Creative Studio  

---

## 🎯 1. Visión y Propósito del Producto

En modelos conversacionales agénticos convencionales, los modelos ligeros y rápidos (como `gpt-4o-mini`) tienden a improvisar ideas genéricas y superficiales de inmediato ante peticiones abiertas como *"dame ideas para mi canal"* o *"qué canal creo"*, sin conocer la audiencia, el tono o las referencias de inspiración del creador.

Por otro lado, elevar el modelo a espaldas del usuario hacia un modelo de razonamiento profundo pesado (como `GPT-4o` o `Claude 3.5 Sonnet`) incurre en gastos imprevistos de créditos y no resuelve la falta de contexto si no hubo un proceso previo de descubrimiento.

**FEAT-20** instaura la **Arquitectura Consultiva de 3 Fases**:
1. **Fase de Descubrimiento Activo (Briefing Estratégico):** El asistente frena cualquier ocurrencia apresurada y formula preguntas de intención sobre la temática, público objetivo y **canales de reflejo / inspiración**.
2. **Propuesta Transparente de Recursos y Negociación en el Chat:** Se le informa al creador con total claridad el modelo avanzado propuesto y el costo exacto en créditos (ej: 3 créditos para GPT-4o), permitiéndole confirmar o declinar con un solo clic interactivo dentro de la conversación.
3. **Generación Multimodal Directa en Chat (`generar_imagen`):** Creación de miniaturas, portadas y recursos visuales directamente a través del chat, persistidos en la taxonomía oficial del workspace (`Miniatura/` o `InfoCanal/`) y renderizados de forma visible e inmediata en la interfaz.

---

## 🏗️ 2. Lo que Tenemos Hoy vs. Lo que Faltaba

| Aspecto | Antes de FEAT-20 | Con FEAT-20 |
|---|---|---|
| **Ideación de Canales** | `gpt-4o-mini` soltaba ocurrencias aleatorias sin entender audiencia ni referencias. | Protocolo de Briefing: indaga nicho, audiencia y canales de reflejo antes de proponer. |
| **Uso de Modelos Avanzados** | Riesgo de consumo arbitrario o bloqueo rígido fuera de contexto. | Propuesta transparente en el chat: informa modelo, costo de créditos y espera consentimiento explícito. |
| **Interacción de Consentimiento** | Mensajes de texto manuales o errores HTTP 402 confusos. | Tarjetas interactivas (`InteractiveQuestionCard`) y detección de lenguaje natural en el chat. |
| **Generación de Imágenes en Chat** | Exclusiva del panel Image Studio; el chat no podía generar ni mostrar imágenes directamente. | Tool oficial `generar_imagen` (`app/api/tools/generar_imagen/route.ts`) que guarda en workspace y renderiza en el chat. |
| **Renderizado Markdown de Imagen** | Componente img no estilizado o enlaces planos. | Bloque visual enriquecido con badge de estudio, contenedor oscuro, sombra y visor HD. |

---

## 🚀 3. Escalabilidad & Horizontes Futuros

1. **Horizonte 1 (Actual):**
   - Briefing interactivo por chat.
   - Consentimiento transparente de 3 créditos para GPT-4o.
   - Generación de miniaturas con DALL-E 3 persistidas en el workspace físico y renderizadas con marco HD.

2. **Horizonte 2 (Próximo):**
   - Generación iterativa de miniaturas: solicitar variaciones ("hazla con mayor contraste", "cambia el sujeto") manteniendo la memoria de la imagen previa en el chat.
   - Ingesta automática de miniaturas de los canales de reflejo para análisis comparativo de CTR.

3. **Horizonte 3 (SaaS Multi-Modelo):**
   - Subasta dinámica de modelos: permitir al creador elegir entre o3-mini, Claude 3.7 Sonnet o GPT-4o según su saldo disponible directamente desde un selector embebido en la pregunta interactiva.
