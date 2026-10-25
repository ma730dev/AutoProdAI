import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { generateText, tool as aiTool, jsonSchema, embed } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { db as prisma } from '@/src/prisma/db';
import { isOrchestratorFreeForUser, PLANS_CONFIG } from '@/lib/pricing-config';
import { checkChatRateLimit, attachRateLimitHeaders } from '@/lib/rate-limit';
import { getWorkspacePath } from '@/lib/setup/detector';
import path from 'path';
import fs from 'fs';
import { evaluateSemanticRoute, logIntentTelemetry, getToolsForDomain, SemanticRouteMatch } from '@/lib/semantic-router';

// ──────────────────────────────────────────────
// Tool executor — calls the Python Motor API
// ──────────────────────────────────────────────
async function callPythonMotor(method: string, endpoint: string, body?: any) {
  const url = `http://localhost:8000/workspace${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Motor error: ${res.status}`);
  }
  return res.json();
}

// ──────────────────────────────────────────────
// Main POST handler (Agentic Orchestrator)
// ──────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages;
    const provider = body.provider || 'openai';
    let model = body.model === 'default' || !body.model ? 'gpt-4o-mini' : body.model;
    const { workspacePath, channelId, confirmCreditUsage, deepThinking } = body;
    let isDeepThinking = Boolean(deepThinking);

    if (!messages) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    // ── DETECCIÓN DE CONSENTIMIENTO EXPLÍCITO DE CRÉDITOS EN EL CHAT ──
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    const lastUserTextLower = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content.toLowerCase() : '';

    const isExplicitCreditConsent = 
      Boolean(confirmCreditUsage) ||
      lastUserTextLower.includes('acepto usar') ||
      lastUserTextLower.includes('acepto los créditos') ||
      lastUserTextLower.includes('acepto los 3 créditos') ||
      lastUserTextLower.includes('acepto usar créditos') ||
      lastUserTextLower.includes('acepto usar gpt-4o') ||
      lastUserTextLower.includes('con gpt-4o') ||
      lastUserTextLower.includes('usar gpt-4o') ||
      lastUserTextLower.includes('procede con gpt-4o') ||
      (lastUserTextLower.includes('acepto') && (lastUserTextLower.includes('crédito') || lastUserTextLower.includes('créditos')));

    if (isExplicitCreditConsent && (model === 'gpt-4o-mini' || model === 'default')) {
      model = 'gpt-4o';
      isDeepThinking = true;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    const { createClient: createServerClient } = require('@/lib/supabase/server');
    const supabaseServer = await createServerClient();
    const { data: userData } = await supabaseServer.auth.getUser();
    const userId = userData?.user?.id;

    let userRecord: any = null;

    if (userId) {
      try {
        userRecord = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            name: true,
            email: true,
            role: true,
            openaiVaultId: true,
            geminiVaultId: true,
            anthropicVaultId: true,
            subscription: {
              include: { plan: { include: { limits: true } } }
            }
          }
        });
      } catch (e: any) {
        console.warn('Failed to retrieve user settings', e);
      }
    }

    const userPlan = (userRecord?.subscription?.plan?.name as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE') || 'FREE';
    const planConfig = PLANS_CONFIG[userPlan] || PLANS_CONFIG.FREE;
    const maxChannels = userRecord?.subscription?.plan?.limits?.maxChannels ?? planConfig.maxChannels;
    const isAdmin = userRecord?.role === 'ADMIN';
    const isFreeTier = userPlan === 'FREE';

    // ── RATE LIMITING & ANTI-ABUSE CHECK ──
    const rateLimitResult = checkChatRateLimit(req, userId, isFreeTier);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        {
          error: rateLimitResult.errorMessage || 'Límite de solicitudes excedido. Por favor espera antes de enviar más mensajes.',
          reason: rateLimitResult.reason,
          retryAfter: rateLimitResult.resetInSeconds
        },
        { status: 429 }
      );
      attachRateLimitHeaders(response.headers, rateLimitResult);
      return response;
    }

    const existingProjects: string[] = [];
    const existingChannels = existingProjects; // Alias retrocompatible

    let apiKey = '';
    let requiredCredits = 0;
    let usedSystemKey = false;
    let userWalletId: string | null = null;
    const userPlanName = userRecord?.subscription?.plan?.name || 'FREE';

    // 1. PRIORIDAD 1: BYOK del Usuario en Vault (openaiVaultId, geminiVaultId, anthropicVaultId)
    let userSecretId = null;
    if (provider === 'openai' || provider === 'chatgpt') userSecretId = userRecord?.openaiVaultId;
    if (provider === 'gemini') userSecretId = userRecord?.geminiVaultId;
    if (provider === 'anthropic') userSecretId = userRecord?.anthropicVaultId;

    if (userSecretId) {
      const { data: secretData } = await supabase.rpc('get_decrypted_secret', { p_secret_id: userSecretId });
      if (secretData) {
        apiKey = typeof secretData === 'string' ? secretData : secretData.get_decrypted_secret || secretData;
      }
    }

    // 1b. PRIORIDAD 2: BYOK vía RPC get_api_key (User API keys en Vault)
    if (!apiKey && userId) {
      const providerKey = (provider === 'openai' || provider === 'chatgpt') ? 'openai' : provider;
      try {
        const { data: rpcKey } = await supabase.rpc('get_api_key', { p_user_id: userId, p_provider: providerKey });
        if (rpcKey && typeof rpcKey === 'string' && rpcKey.trim() !== '') {
          apiKey = rpcKey;
        }
        if (!apiKey && (provider === 'openai' || provider === 'chatgpt')) {
          const { data: chatgptRpcKey } = await supabase.rpc('get_api_key', { p_user_id: userId, p_provider: 'chatgpt' });
          if (chatgptRpcKey && typeof chatgptRpcKey === 'string' && chatgptRpcKey.trim() !== '') {
            apiKey = chatgptRpcKey;
          }
        }
      } catch (e) {
        console.warn('RPC get_api_key fallback error:', e);
      }
    }

    // 2. SI EL USUARIO NO TIENE BYOK -> USAR LLAVE MAESTRA DE LA PLATAFORMA (CONSUMO DE CRÉDITOS)
    if (!apiKey) {
      usedSystemKey = true;

      // Evaluar si es orquestador gratuito para este plan
      const isFree = isOrchestratorFreeForUser(userPlanName, model);

      if (isFree) {
        requiredCredits = 0; // Gratuito para todos en gpt-4o-mini (Starter, Pro, Enterprise y FREE con Rate Limit)
      } else {
        // Modelos avanzados o de pago
        try {
          const pricing = await prisma.servicePricing.findUnique({
            where: {
              serviceType_modelName: {
                serviceType: 'CHAT',
                modelName: model || 'default'
              }
            }
          });
          if (pricing && pricing.isActive) {
            requiredCredits = pricing.costPerUnit;
          } else {
            requiredCredits = (model?.includes('4o') && !model?.includes('mini')) ? 3 : model?.includes('claude') ? 4 : 1;
          }
        } catch (e) {
          console.warn('Error reading service pricing, defaulting', e);
          requiredCredits = (model?.includes('4o') && !model?.includes('mini')) ? 3 : model?.includes('claude') ? 4 : 1;
        }
      }

      // Verificar saldo si la acción cuesta créditos
      if (userId) {
        try {
          let wallet = await prisma.wallet.findUnique({ where: { userId } });
          // Auto-crear wallet si no existe (con 50 créditos iniciales de cortesía)
          if (!wallet) {
            wallet = await prisma.wallet.create({ data: { userId, balance: 50 } });
          }
          userWalletId = wallet.id;

          if (requiredCredits > 0 && wallet.balance < requiredCredits) {
            if (userPlanName === 'FREE') {
              return NextResponse.json({
                error: `Has agotado tus 50 créditos de prueba gratuita. Para continuar usando el orquestador ilimitado y acceder a todas las herramientas de AutoProd, suscríbete a Starter ($70), Pro ($100) o Enterprise ($150).`,
                requiresUpgrade: true
              }, { status: 402 });
            } else {
              return NextResponse.json({
                error: `Créditos insuficientes (${wallet.balance} disponibles, necesitas ${requiredCredits}). Por favor recarga tu saldo o mejora tu plan para continuar.`,
                requiresUpgrade: true
              }, { status: 402 });
            }
          }
        } catch(e) {
          console.warn('Error checking wallet', e);
        }
      }

      // Confirmación de consumo (solo para modelos pesados con costo > 1 si no ha confirmado ni consentido)
      // Si el usuario consintió explícitamente en el chat ("acepto usar 3 créditos"), procede directamente sin rebotar.
      if (requiredCredits > 1 && !confirmCreditUsage && !isExplicitCreditConsent) {
        return NextResponse.json({ 
          requiresConfirmation: true, 
          message: `Esta acción consumirá ${requiredCredits} crédito(s) de la plataforma. ¿Deseas continuar?`
        }, { status: 402 });
      }

      // Obtener la Llave Maestra del Sistema (Admin / Servidor)
      // 1. Variable de Entorno (.env / .env.local)
      if ((provider === 'openai' || provider === 'chatgpt') && process.env.OPENAI_API_KEY) {
        apiKey = process.env.OPENAI_API_KEY;
      } else if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
      } else if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
        apiKey = process.env.ANTHROPIC_API_KEY;
      }

      // 2. Si no está en variables de entorno, buscar en SystemSettings -> Vault
      if (!apiKey) {
        try {
          const systemSettings = await prisma.systemSettings.findUnique({ where: { id: "global" }});
          let systemSecretId = null;
          if (provider === 'openai' || provider === 'chatgpt') systemSecretId = systemSettings?.openaiVaultId;
          if (provider === 'gemini') systemSecretId = systemSettings?.geminiVaultId;
          if (provider === 'anthropic') systemSecretId = systemSettings?.anthropicVaultId;

          if (systemSecretId) {
            const { data: sysSecretData } = await supabase.rpc('get_decrypted_secret', { p_secret_id: systemSecretId });
            if (sysSecretData) {
               apiKey = typeof sysSecretData === 'string' ? sysSecretData : sysSecretData.get_decrypted_secret || sysSecretData;
            }
          }
        } catch(e) {
          console.warn('Error reading system settings from vault', e);
        }
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: `No API key configured in Vault for ${provider}. Verifica tus API Keys en Ajustes.` }, { status: 400 });
    }
    // ──────────────────────────────────────────────
    // 1. Cargar Orquestador y Herramientas (Agentic Pattern)
    // ──────────────────────────────────────────────
    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
    const userQueryText = typeof lastUserMessage?.content === 'string' 
      ? lastUserMessage.content 
      : (Array.isArray(lastUserMessage?.content) ? JSON.stringify(lastUserMessage.content) : '');
    let semanticMatch: SemanticRouteMatch = { matched: false };

    let baseSystemPrompt = 'Eres AutoProd, un asistente inteligente.';
    if (userRecord?.name) {
      baseSystemPrompt = `Estás hablando con ${userRecord.name}. Dirígete a él/ella por su nombre.\n\n` + baseSystemPrompt;
    }
    let systemPrompt = baseSystemPrompt;
    const aiTools: Record<string, any> = {};
    const executedTools: string[] = [];
    let activeChannel: any = null;
    let activeChannelContext: any = null;

    try {
      // Obtener el agente orquestador desde la BD
      const orchestrator = await prisma.agent.findFirst({
        where: { slug: 'orchestrator' },
        include: {
          agentTools: {
            include: { tool: true }
          }
        }
      });

      if (orchestrator) {
        // Inyectar workspace_path dinámicamente en el system prompt (prioridad: request body del cliente -> detector)
        const currentWorkspacePath = (workspacePath && typeof workspacePath === 'string' && workspacePath.trim() !== '')
          ? workspacePath
          : (getWorkspacePath() || 'No configurado');
        let resolvedPrompt = orchestrator.systemPrompt.replace('{workspace_path}', currentWorkspacePath);
        // Limpiar cualquier residuo de prohibición estricta antigua que forzaba respuestas simplonas de 2 líneas
        resolvedPrompt = resolvedPrompt.replace(/⛔ REGLA ABSOLUTA — PROHIBICIÓN DE RESPUESTAS TIPO MENÚ[\s\S]*?(?=\n\n|$)/g, '');
        systemPrompt = (userRecord?.name ? `Estás hablando con ${userRecord.name}. Dirígete a él/ella por su nombre.\n\n` : '') + resolvedPrompt;

        // Escanear el estado físico actual del workspace en disco en tiempo real (espacio abierto)
        let workspaceStructureSnapshot = '';
        try {
          if (currentWorkspacePath && currentWorkspacePath !== 'No configurado' && fs.existsSync(currentWorkspacePath)) {
            const SYSTEM_RESERVED_FOLDERS = [
              'recursos', 'assets', 'node_modules', 'bin', 'public', 'dist', 'build',
              'temp', 'tmp', 'cache', '.git', '.next', 'workspace', 'youtube', 'docs',
              'controlador', 'harness', 'prisma', 'src', 'app', 'components', 'lib'
            ];
            const MAX_ROOT_ENTRIES = 60;
            const MAX_CHILD_ENTRIES = 20;

            const listEntries = (dir: string) => {
              try {
                return fs.readdirSync(dir, { withFileTypes: true }).filter(e => !e.name.startsWith('.'));
              } catch {
                return [];
              }
            };

            const rootEntries = listEntries(currentWorkspacePath);
            const treeLines: string[] = [];

            for (const entry of rootEntries.slice(0, MAX_ROOT_ENTRIES)) {
              if (!entry.isDirectory()) {
                treeLines.push(`📄 ${entry.name}`);
                continue;
              }

              const isReserved = SYSTEM_RESERVED_FOLDERS.includes(entry.name.toLowerCase());
              if (!isReserved && !existingProjects.includes(entry.name)) {
                existingProjects.push(entry.name);
              }

              const children = listEntries(path.join(currentWorkspacePath, entry.name));
              treeLines.push(`📁 ${entry.name}/${isReserved ? ' (sistema)' : ''}${children.length === 0 ? ' (vacía)' : ''}`);

              for (const child of children.slice(0, MAX_CHILD_ENTRIES)) {
                if (child.isDirectory()) {
                  const count = listEntries(path.join(currentWorkspacePath, entry.name, child.name)).length;
                  treeLines.push(`   📁 ${child.name}/ (${count} item${count === 1 ? '' : 's'})`);
                } else {
                  treeLines.push(`   📄 ${child.name}`);
                }
              }
              if (children.length > MAX_CHILD_ENTRIES) {
                treeLines.push(`   … y ${children.length - MAX_CHILD_ENTRIES} más`);
              }
            }
            if (rootEntries.length > MAX_ROOT_ENTRIES) {
              treeLines.push(`… y ${rootEntries.length - MAX_ROOT_ENTRIES} elementos más en la raíz`);
            }

            workspaceStructureSnapshot = treeLines.length > 0
              ? `\n\n--- ESTADO ACTUAL DEL WORKSPACE EN DISCO (TIEMPO REAL) ---\nUbicación: ${currentWorkspacePath}\nContenido detectado físicamente (hasta 2 niveles):\n${treeLines.join('\n')}\n(Usa esta estructura como verdad absoluta del disco duro. No asumas que las carpetas son canales o videos: deduce el propósito de cada una según su nombre y contenido, o explora con workspace_control).`
              : `\n\n--- ESTADO ACTUAL DEL WORKSPACE EN DISCO (TIEMPO REAL) ---\nUbicación: ${currentWorkspacePath}\nEl workspace está actualmente vacío (sin carpetas ni archivos).`;
          }
        } catch (scanErr: any) {
          console.warn("[Workspace Scan Error]:", scanErr.message);
        }

        systemPrompt += workspaceStructureSnapshot;

        // Contexto de canal desacoplado: solo si vino channelId explícito en el request
        activeChannel = null;
        activeChannelContext = null;
        if (channelId && userId) {
          try {
            activeChannel = await prisma.channel.findFirst({ where: { id: channelId, userId } });
          } catch {}
        }

        // ──────────────────────────────────────────────
        // 🚀 EVALUACIÓN DEL ROUTER SEMÁNTICO (SYSTEM 1)
        // ──────────────────────────────────────────────
        const embeddingKey = (provider === 'openai' || provider === 'chatgpt') ? apiKey : (process.env.OPENAI_API_KEY || apiKey);

        if (userQueryText && userQueryText.trim().length >= 3 && embeddingKey) {
          try {
            semanticMatch = await evaluateSemanticRoute({
              queryText: userQueryText,
              openAiApiKey: embeddingKey,
              supabaseClient: supabase,
              defaultThreshold: 0.78
            });
          } catch (routerErr: any) {
            console.warn('[SemanticRouter] Error en evaluación previa:', routerErr.message);
          }
        }

        // ⚡ FAST-PATH: Despacho determinista de ultra-baja latencia sin LLM (< 150ms)
        if (semanticMatch.matched && semanticMatch.isDirectFastPath) {
          // 0. Capacidades y Bienvenida del Sistema (< 15ms, $0 tokens)
          if (semanticMatch.toolName === 'capacidades_sistema') {
            const projectListStr = existingProjects.length > 0
              ? existingProjects.map(c => `• 📁 **${c}**`).join('\n')
              : 'Actualmente no tienes carpetas creadas en tu workspace.';

            const fastText = `¡Hola! Soy **AutoProd**, tu sistema operativo para organizar y producir contenido audiovisual. 🚀\n\nAquí tienes el control total sobre tus archivos y producciones:\n\n• **CREA:** Desarrolla ideas con intención, temas y guiones estructurados.\n• **PRODUCE:** Ensamble audiovisual, clips, bucles de video de 1 a 3 horas y subtítulos automáticos.\n• **ANALIZA:** Referencias de nicho, enfoques temáticos y memoria histórica de lo ya cubierto.\n• **ESCALA:** Gestión ordenada de carpetas y proyectos en tu propio disco duro.\n\n📂 **Tu Workspace activo:**\n\`${currentWorkspacePath}\`\n\n**Tus proyectos activos (${existingProjects.length}):**\n${projectListStr}\n\n¿En qué carpeta o proyecto te gustaría que trabajemos hoy?`;

            logIntentTelemetry({
              userId,
              rawQuery: userQueryText,
              detectedDomain: 'SYSTEM',
              executedTool: 'capacidades_sistema',
              wasFastPath: true,
              confidenceScore: semanticMatch.confidence,
              success: true
            });

            return NextResponse.json({
              text: fastText,
              modelName: 'AutoProd',
              workspaceModified: false,
              executedTools: ['capacidades_sistema'],
              isFastPath: true,
              isDeepThinking: false,
              newBalance: null,
              channelId: activeChannel?.id,
              channelName: activeChannel?.name,
              detectedDomain: 'SYSTEM',
              routerConfidence: semanticMatch.confidence
            });
          }

          // 1. Listar proyectos y carpetas del workspace
          if (
            semanticMatch.toolName === 'listar_proyectos_workspace' ||
            semanticMatch.toolName === 'listar_canales' ||
            semanticMatch.toolName === 'listar_canales_disco'
          ) {
            const projectListStr = existingProjects.length > 0
              ? existingProjects.map(c => `• 📁 **${c}**`).join('\n')
              : 'Actualmente no tienes carpetas de proyectos creadas en tu workspace.';
            const fastText = `He consultado tu workspace en tiempo real (\`${currentWorkspacePath}\`):\n\n${projectListStr}\n\n¿En cuál de estos proyectos te gustaría trabajar hoy, o deseas crear una nueva carpeta para otro proyecto?`;

            logIntentTelemetry({
              userId,
              rawQuery: userQueryText,
              detectedDomain: semanticMatch.domain,
              executedTool: semanticMatch.toolName,
              wasFastPath: true,
              confidenceScore: semanticMatch.confidence,
              success: true
            });

            return NextResponse.json({
              text: fastText,
              modelName: 'AutoProd',
              workspaceModified: false,
              executedTools: [semanticMatch.toolName],
              isFastPath: true,
              isDeepThinking: false,
              newBalance: null,
              channelId: activeChannel?.id,
              channelName: activeChannel?.name,
              detectedDomain: semanticMatch.domain,
              routerConfidence: semanticMatch.confidence
            });
          }

          // 2. Consultar proyecto de video activo
          if (semanticMatch.toolName === 'consultar_proyecto_video' && userId) {
            try {
              const activeProject = await prisma.videoProject.findFirst({
                where: { userId, status: { not: 'COMPLETED' } },
                orderBy: { updatedAt: 'desc' },
                include: { channel: true }
              });

              let fastText = '';
              if (activeProject) {
                fastText = `Actualmente estás trabajando en el proyecto de video **"${activeProject.title}"**${activeProject.channel ? ` para el canal **${activeProject.channel.name}**` : ''} (Resolución: ${activeProject.resolution}, Formato: ${activeProject.aspectRatio}, Estado: ${activeProject.status}).\n\n¿Deseas continuar editando su timeline, preparar sus recursos o redactar su guion?`;
              } else {
                fastText = `No tienes ningún proyecto de video en curso en este momento.${activeChannel ? ` ¿Te gustaría iniciar un nuevo video para el canal **${activeChannel.name}**?` : ' ¿Para cuál de tus canales te gustaría crear un proyecto de video?'}`;
              }

              logIntentTelemetry({
                userId,
                rawQuery: userQueryText,
                detectedDomain: semanticMatch.domain,
                executedTool: 'consultar_proyecto_video',
                wasFastPath: true,
                confidenceScore: semanticMatch.confidence,
                success: true
              });

              return NextResponse.json({
                text: fastText,
                modelName: 'AutoProd',
                workspaceModified: false,
                executedTools: ['consultar_proyecto_video'],
                isFastPath: true,
                isDeepThinking: false,
                newBalance: null,
                channelId: activeChannel?.id,
                channelName: activeChannel?.name,
                detectedDomain: semanticMatch.domain,
                routerConfidence: semanticMatch.confidence
              });
            } catch (pErr: any) {
              console.warn('[FastPath] Error al consultar videoProject:', pErr.message);
            }
          }

          // 3. Listar proyectos de video
          if (semanticMatch.toolName === 'listar_proyectos_video' && userId) {
            try {
              const projects = await prisma.videoProject.findMany({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                include: { channel: true }
              });

              let fastText = '';
              if (projects.length > 0) {
                const listStr = projects.map(p => `• 🎬 **${p.title}** (${p.status}) - Canal: ${p.channel?.name || 'Sin canal'} [${p.resolution}]`).join('\n');
                fastText = `Tus proyectos de video más recientes:\n\n${listStr}\n\n¿Deseas abrir o continuar alguno de ellos?`;
              } else {
                fastText = `Aún no tienes proyectos de video registrados en AutoProd.${activeChannel ? ` ¿Deseas crear uno para el canal **${activeChannel.name}**?` : ''}`;
              }

              logIntentTelemetry({
                userId,
                rawQuery: userQueryText,
                detectedDomain: semanticMatch.domain,
                executedTool: 'listar_proyectos_video',
                wasFastPath: true,
                confidenceScore: semanticMatch.confidence,
                success: true
              });

              return NextResponse.json({
                text: fastText,
                modelName: 'AutoProd',
                workspaceModified: false,
                executedTools: ['listar_proyectos_video'],
                isFastPath: true,
                isDeepThinking: false,
                newBalance: null,
                channelId: activeChannel?.id,
                channelName: activeChannel?.name,
                detectedDomain: semanticMatch.domain,
                routerConfidence: semanticMatch.confidence
              });
            } catch (pErr: any) {
              console.warn('[FastPath] Error al listar videoProjects:', pErr.message);
            }
          }

          // 4. Estado del sistema
          if (semanticMatch.toolName === 'estado_sistema') {
            let motorOnline = false;
            try {
              const checkRes = await fetch('http://127.0.0.1:8000/status', { signal: AbortSignal.timeout(1500) });
              motorOnline = checkRes.ok;
            } catch {
              motorOnline = false;
            }

            const fastText = `Diagnóstico del sistema AutoProd:\n\n• **Motor Local (FastAPI):** ${motorOnline ? '🟢 Online (puerto 8000)' : '🔴 Desconectado (inicia el motor para renderizar y usar TTS)'}\n• **Workspace:** \`${currentWorkspacePath}\`\n• **Proyectos detectados:** ${existingProjects.length} proyecto(s)\n• **Router Semántico (System 1):** ⚡ Activo (< 50ms)\n\n¿En qué podemos trabajar hoy?`;

            logIntentTelemetry({
              userId,
              rawQuery: userQueryText,
              detectedDomain: semanticMatch.domain,
              executedTool: 'estado_sistema',
              wasFastPath: true,
              confidenceScore: semanticMatch.confidence,
              success: true
            });

            return NextResponse.json({
              text: fastText,
              modelName: 'AutoProd',
              workspaceModified: false,
              executedTools: ['estado_sistema'],
              isFastPath: true,
              isDeepThinking: false,
              newBalance: null,
              channelId: activeChannel?.id,
              channelName: activeChannel?.name,
              detectedDomain: semanticMatch.domain,
              routerConfidence: semanticMatch.confidence
            });
          }
        }



        const interactiveQuestionsDirective = `\n\n=== INTERFAZ DE PREGUNTAS Y FORMULARIOS INTERACTIVOS (INTERACTIVE QUESTION FORM) ===
⛔ ESTÁ ESTRICTAMENTE PROHIBIDO:
- Dibujar cajas de texto con caracteres ASCII o símbolos de bordes (ej: ┌, ─, │, └, etc.).
- Simular botones escribiendo texto entre corchetes o con emojis (ej: "[✅ Acepto usar créditos]", "[⚡ Continuar]").
- Preguntar de forma desordenada múltiples preguntas abiertas en texto plano cuando requieras estructurar una decisión.

✅ CONDUCTA OBLIGATORIA:
Siempre que requieras que el usuario:
1. Elija entre opciones de modelo/créditos (ej. consentir usar GPT-4o vs continuar en modo estándar gratis).
2. Responda a un briefing guiado por pasos (Wizard de 1 a 3 preguntas: nicho, enfoque, canales de referencia).
3. Seleccione entre 2 o 3 conceptos o títulos sugeridos.

DEBES incluir al final de tu mensaje un bloque interactivo con sintaxis \`\`\`interactive-question con JSON válido:

Ejemplo de 1 sola pregunta:
\`\`\`interactive-question
{
  "id": "decision_modelo",
  "question": "¿Deseas procesar esta tarea en profundidad con GPT-4o?",
  "description": "Se analizarán tendencias, retención y métricas avanzadas. Costará 3 créditos.",
  "options": [
    { "id": "opt1", "label": "Acepto usar 3 créditos con GPT-4o", "badge": "🧠 3 créditos", "recommended": true },
    { "id": "opt2", "label": "Continuar en modo estándar (Orientación guiada)", "badge": "⚡ 0 créditos" }
  ],
  "allowCustomInput": true,
  "customInputPlaceholder": "Escribe otra respuesta o directiva..."
}
\`\`\`

Ejemplo de varias preguntas en pasos (Wizard secuencial):
\`\`\`interactive-question
{
  "title": "Briefing de Proyecto y Estrategia",
  "questions": [
    {
      "question": "¿Cuál es la temática o enfoque central de tu proyecto?",
      "options": ["Documental e Historias Reales", "Finanzas y Negocios", "Ciencia y Tecnología", "Desarrollo Personal"]
    },
    {
      "question": "¿A qué público o audiencia buscas dirigirte?",
      "options": ["Jóvenes de 18 a 30 años", "Profesionales y emprendedores", "Audiencia general"],
      "allowCustomInput": true,
      "customInputPlaceholder": "Escribe el público o nicho objetivo..."
    },
    {
      "question": "¿Deseas procesar la estrategia en profundidad con GPT-4o?",
      "options": [
        { "label": "Sí, activar GPT-4o para plan maestro", "badge": "🧠 3 créditos", "recommended": true },
        { "label": "No, continuar en modo estándar", "badge": "⚡ Gratis" }
      ]
    }
  ]
}
\`\`\`
La interfaz del chat de AutoProd interceptará este bloque y renderizará automáticamente un formulario nativo e interactivo integrado en el chat con botones, radio buttons y selector de pasos.`;

        systemPrompt += interactiveQuestionsDirective;
        
        // ──────────────────────────────────────────────
        // Mapear herramientas según el Dominio detectado (Domain Tool Retrieval)
        // ──────────────────────────────────────────────
        const allowedToolNames = getToolsForDomain(semanticMatch.matched ? semanticMatch.domain : undefined);
        const toolNames: string[] = [];

        for (const at of orchestrator.agentTools) {
          const dbTool = at.tool;
          if (!dbTool) continue;

          // Filtrar por dominio: solo instanciar si la herramienta está permitida
          if (allowedToolNames.length > 0 && !allowedToolNames.includes(dbTool.name)) {
            continue;
          }

          toolNames.push(dbTool.name);
          const toolSchemaObj = jsonSchema((dbTool.schema && typeof dbTool.schema === 'object') ? dbTool.schema as any : { type: 'object', properties: {} });

          aiTools[dbTool.name] = (aiTool as any)({
            description: dbTool.description || '',
            parameters: toolSchemaObj,
            execute: async (args: any) => {
              try {
                executedTools.push(dbTool.name);
                console.log(`[Tool Executor] Invocando ${dbTool.name} en ${dbTool.apiEndpoint}`);

                const payload = {
                  ...args,
                  _userContext: {
                    id: userId,
                    name: userRecord?.name,
                    email: userRecord?.email,
                    workspacePath: currentWorkspacePath
                  }
                };

                let url = dbTool.apiEndpoint;
                // Si es un endpoint interno de Next.js (/api/tools/...), resolver dinámicamente con el host actual
                if (url.includes('/api/tools/')) {
                  const host = req.headers.get('host') || 'localhost:3000';
                  const protocol = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
                  const pathname = url.startsWith('http') ? new URL(url).pathname : url;
                  url = `${protocol}://${host}${pathname}`;
                }

                if (dbTool.method === 'GET' && payload && Object.keys(payload).length > 0) {
                  const params = new URLSearchParams();
                  for (const [key, val] of Object.entries(payload)) {
                    if (key !== '_userContext' && val !== undefined && val !== null && typeof val !== 'object') {
                      params.append(key, String(val));
                    }
                  }
                  const qs = params.toString();
                  if (qs) {
                    url += (url.includes('?') ? '&' : '?') + qs;
                  }
                }

                const response = await fetch(url, {
                  method: dbTool.method,
                  headers: { 'Content-Type': 'application/json' },
                  body: dbTool.method !== 'GET' ? JSON.stringify(payload) : undefined
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                  const detail = data.detail || data.error || data.message || response.statusText;
                  return `[Error en ${dbTool.name} (HTTP ${response.status})]: ${detail}.`;
                }

                return JSON.stringify(data);
              } catch (e: any) {
                return `[Fallo de conexión en ${dbTool.name}]: ${e.message}.`;
              }
            }
          });
        }
        
      }


      // Inyectar directiva de Pensamiento Profundo si está activado
      if (isDeepThinking) {
        systemPrompt += `\n\n=== MODO PENSAMIENTO PROFUNDO ACTIVADO (DEEP REASONING) ===
- Tienes activado el modo de Pensamiento Profundo y Razonamiento Estratégico.
- ANTES de ejecutar herramientas o dar tu respuesta definitiva, analiza exhaustivamente el problema paso a paso.
- Evalúa:
  1. La intención del creador y el contexto real que existe en su workspace.
  2. La coherencia de lo que propones con lo que ya existe en sus proyectos.
  3. La viabilidad técnica de las carpetas y archivos necesarios.
  4. Las alternativas y su costo (tiempo, créditos) para que el creador decida.
- Si vas a ejecutar herramientas para crear carpetas o archivos, planifica la estructura con precisión antes de invocarlas y confirma con el creador si algo no está claro.
- Brinda una respuesta estructurada y de alto impacto para el creador.`;
      }
      
    } catch (e) {
      console.warn("Fallo al cargar Orquestador de BD", e);
    }

    // ──────────────────────────────────────────────
    // 2. Configurar Modelo
    // ──────────────────────────────────────────────
    let aiModel;
    let cleanModel = '';
    if (provider === 'openai' || provider === 'chatgpt') {
      let selectedModel = model || 'gpt-4o-mini';
      if (isDeepThinking) {
        selectedModel = (model && (model.includes('o1') || model.includes('o3') || (model.includes('4o') && !model.includes('mini')))) ? model : 'o3-mini';
      }
      cleanModel = selectedModel;
      aiModel = createOpenAI({ apiKey })(selectedModel);
    } else if (provider === 'anthropic') {
      const selectedModel = isDeepThinking ? 'claude-3-7-sonnet-20250219' : (model || 'claude-3-5-sonnet-20240620');
      cleanModel = selectedModel;
      aiModel = createAnthropic({ apiKey })(selectedModel);
    } else if (provider === 'gemini') {
      let rawModel = model || 'gemini-2.5-flash';
      if (isDeepThinking) {
        rawModel = (model && model.includes('pro')) ? model : 'gemini-2.0-flash-thinking-exp-01-21';
      }
      cleanModel = rawModel.replace(/^models\//, '').trim();
      aiModel = createGoogleGenerativeAI({ apiKey })(cleanModel);
    } else {
      throw new Error('Invalid provider');
    }

    // Preparar historial (soporta contenido de texto y partes multimodales de imagen)
    const history = messages.map((m: any) => {
      let content: any = '';
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = m.content;
      } else {
        content = String(m.content || '');
      }
      return { role: m.role as 'user' | 'assistant' | 'system', content };
    });

    // ──────────────────────────────────────────────
    // 3. Generar Texto (Function Calling Nativo)
    // ──────────────────────────────────────────────
    const result: any = await generateText({
      model: aiModel,
      messages: history.filter((h: any) => h.role !== 'system'),
      system: systemPrompt,
      tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
      maxSteps: 5 // Permite al LLM iterar, llamar herramientas y luego responder
    } as any);

    // Guardar token usage y descontar créditos si usó llave maestra
    let updatedBalance: number | null = null;
    if (userId) {
      if (result.usage && result.usage.totalTokens > 0) {
        try {
          if ((prisma as any).tokenUsage) {
            (prisma as any).tokenUsage.create({
              data: {
                userId,
                provider,
                modelName: model || 'unknown',
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                totalTokens: result.usage.totalTokens
              }
            }).catch((err: any) => console.warn("[TokenUsage] Error guardando:", err.message));
          }
        } catch { /* ignorar silenciosamente si la tabla no existe */ }
      }

      // Descuento de créditos
      if (usedSystemKey && userWalletId && requiredCredits > 0) {
        try {
          const [updatedWallet] = await prisma.$transaction([
            prisma.wallet.update({
              where: { id: userWalletId },
              data: { balance: { decrement: requiredCredits } }
            }),
            prisma.creditConsumption.create({
              data: {
                walletId: userWalletId,
                creditsUsed: requiredCredits,
                serviceType: 'CHAT',
                modelName: model || 'unknown',
                description: `Chat interactivo con ${model || 'unknown'}`
              }
            })
          ]);
          updatedBalance = updatedWallet.balance;
        } catch (e: any) {
          console.warn('Error deducting credits:', e.message);
        }
      }
    }
    
    let finalOutput = result.text;
    
    // Si el LLM decidió no escribir texto final pero sí ejecutó herramientas (Falla común en Gemini con Vercel AI SDK)
    // Forzamos una segunda pasada para que sintetice los resultados de las herramientas.
    if (!finalOutput && result.toolResults && result.toolResults.length > 0) {
      try {
        const toolSummaryPrompt = `Acabas de ejecutar una o más herramientas del sistema. Estos fueron los resultados obtenidos:\n\n${JSON.stringify(result.toolResults, null, 2)}\n\nPor favor, responde al usuario explicándole con amabilidad y claridad qué acciones realizaste en su workspace y cuál es el estado actual de su proyecto.`;
        
        const synthesisResult = await generateText({
          model: aiModel,
          messages: [
             ...history.filter((h: any) => h.role !== 'system'),
             { role: 'user', content: toolSummaryPrompt }
          ],
          system: systemPrompt,
        });
        
        finalOutput = synthesisResult.text;
      } catch (synthesisErr: any) {
        console.warn("[Synthesis Error]:", synthesisErr.message);
      }
    }

    // ── GUARDIÁN DE RESPUESTA: Nunca retornar una respuesta vacía ──
    if (!finalOutput || finalOutput.trim() === '') {
      if (result.toolResults && result.toolResults.length > 0) {
        const resumenHerramientas = result.toolResults.map((tr: any) => {
          let outputStr = '';
          if (typeof tr.result === 'string') {
            outputStr = tr.result;
          } else if (tr.result !== undefined && tr.result !== null) {
            outputStr = JSON.stringify(tr.result);
          } else {
            outputStr = 'Ejecutado con éxito';
          }
          if (outputStr && outputStr.length > 180) {
            outputStr = outputStr.substring(0, 180) + '...';
          }
          return `• **${tr.toolName}**: ${outputStr}`;
        }).join('\n');

        finalOutput = `He ejecutado las siguientes acciones en tu workspace:\n\n${resumenHerramientas}\n\n¿Deseas continuar con el siguiente paso?`;
      } else {
        finalOutput = "He procesado tu mensaje. ¿En qué más te puedo colaborar en tu proyecto de AutoProd?";
      }
    }

    // ── GARANTÍA DE RENDERIZADO VISUAL PARA IMÁGENES GENERADAS ──
    if (result.toolResults && Array.isArray(result.toolResults)) {
      for (const tr of result.toolResults) {
        if (tr.toolName === 'generar_imagen') {
          let parsed: any = null;
          if (typeof tr.result === 'string') {
            try { parsed = JSON.parse(tr.result); } catch {}
          } else if (tr.result && typeof tr.result === 'object') {
            parsed = tr.result;
          }
          if (parsed?.imageUrl && !finalOutput.includes(parsed.imageUrl)) {
            finalOutput += `\n\n![${parsed.tipo || 'Miniatura'}](${parsed.imageUrl})\n`;
          }
        }
      }
    }

    // Detección dinámica de mutaciones en el workspace basada en las herramientas ejecutadas
    const readOnlyToolPrefixes = ['listar_', 'leer_', 'consultar_', 'workspace_default', 'verificar_'];
    const workspaceModified = executedTools.some(toolName => {
      const isReadOnly = readOnlyToolPrefixes.some(prefix => toolName.startsWith(prefix));
      return !isReadOnly;
    });

    // ── TELEMETRÍA EN CALIENTE (DATA FLYWHEEL ASÍNCRONO) ──
    logIntentTelemetry({
      userId,
      rawQuery: userQueryText,
      detectedDomain: semanticMatch.domain || null,
      executedTool: executedTools[0] || (semanticMatch.matched ? semanticMatch.toolName : null) || null,
      wasFastPath: false,
      confidenceScore: semanticMatch.confidence || null,
      success: true,
      metadata: { model: cleanModel || model }
    });

    return NextResponse.json({ 
      text: finalOutput, 
      modelName: 'AutoProd',
      workspaceModified,
      executedTools,
      isDeepThinking,
      newBalance: updatedBalance,
      channelId: activeChannel?.id,
      channelName: activeChannel?.name,
      detectedDomain: semanticMatch.domain || null,
      routerConfidence: semanticMatch.confidence || null,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
