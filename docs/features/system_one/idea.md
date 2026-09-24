# 💡 Visión de Producto: Router Semántico Jerárquico & Data Flywheel (FEAT-19)

> **Módulo:** `FEAT-19`  
> **Filosofía:** *"Velocidad nativa, costo predecible y soberanía absoluta."*  
> **Paradigma:** Compound AI Systems (System 1 Fast Decision + System 2 Deep Reasoning).  

---

## 🎯 1. La Visión de Negocio

El uso intensivo de modelos de lenguaje autorregresivos (GPT-4o, Claude) para cada interacción simple en una plataforma de producción audiovisual genera tres fricciones críticas:
1. **Latencia Innecesaria:** Esperar 2 o 3 segundos para una pregunta trivial como *"¿cuántos canales tengo?"* degrada la sensación de agilidad del software.
2. **Gasto de Tokens:** El 60% de las consultas de un creador son operativas o de navegación, no creativas. Pagar tokens completos por esquemas JSON repetitivos encarece el costo de operación del SaaS.
3. **Riesgo de Confusión:** Al alimentar un LLM con decenas de herramientas heterogéneas, aumenta la probabilidad de tool-calling erróneo o alucinación.

El **Router Semántico (FEAT-19)** implementa el paradigma **System 1 / System 2**:
* Las tareas operativas y consultas deterministas se despachan en **< 100 milisegundos a costo $0**.
* El razonamiento creativo profundo (guiones, análisis narrativo, ideación de miniaturas) se reserva para los modelos de alta capacidad con el contexto quirúrgico filtrado por dominios.

---

## 🔄 2. El Ciclo Virtuoso (Data Flywheel)

Cada vez que un creador se comunica con AutoProd usando modismos, abreviaciones o errores ortográficos y la tarea se resuelve con éxito:
1. La interacción se archiva de forma asíncrona y despersonalizada en `intentTelemetry`.
2. El arnés de curaduría extrae la variación lingüística y la incorpora al índice limpio `toolIntentGolden`.
3. Con el paso de las semanas, AutoProd aprende el lenguaje natural de sus creadores y resuelve un porcentaje cada vez mayor de solicitudes de forma instantánea.

---

## 📋 3. Estado de Capacidades

### ✅ Hecho
* Migración SQL idempotente `008_semantic_router_and_telemetry.sql` con soporte `pgvector` e índices HNSW.
* Sincronización en Prisma con modelos `ToolIntentGolden` e `IntentTelemetry`.
* Semillas iniciales canónicas por dominio (`WORKSPACE_FS`, `VIDEO_PROJECT`, `CHANNEL_MEMORY`, `CREATIVE_STUDIO`, `SYSTEM`).
* Módulo core `lib/semantic-router.ts` con evaluación de similitud y registro asíncrono no bloqueante.
* Arneses de mantenimiento para vectorización (`seed_golden_embeddings.ts`) y curaduría por lotes (`curate_intents.ts`).

### ⏳ Siguientes Pasos
* Activación del Fast-Path en `app/api/chat/route.ts` para respuestas inmediatas de proyectos y canales.
* Integración del filtrado dinámico de herramientas (`getToolsForDomain`) en la llamada a `generateText`.
