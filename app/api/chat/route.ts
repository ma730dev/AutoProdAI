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
import { getWorkspacePath } from '@/harness/setup/detector';
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

    const existingChannels: string[] = [];

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

        // Escanear el estado físico actual del workspace en disco en tiempo real
        let workspaceStructureSnapshot = '';
        try {
          if (currentWorkspacePath && currentWorkspacePath !== 'No configurado' && fs.existsSync(currentWorkspacePath)) {
            const SYSTEM_RESERVED_FOLDERS = [
              'recursos', 'assets', 'node_modules', 'bin', 'public', 'dist', 'build',
              'temp', 'tmp', 'cache', '.git', '.next', 'workspace', 'youtube', 'docs',
              'controlador', 'harness', 'prisma', 'src', 'app', 'components', 'lib'
            ];

            const entries = fs.readdirSync(currentWorkspacePath, { withFileTypes: true });
            const structureLines: string[] = [];
            for (const entry of entries) {
              if (entry.name.startsWith('.')) continue;
              if (entry.isDirectory()) {
                const isReserved = SYSTEM_RESERVED_FOLDERS.includes(entry.name.toLowerCase());
                const subPath = path.join(currentWorkspacePath, entry.name);
                const hasInfoCanal = fs.existsSync(path.join(subPath, 'InfoCanal'));

                // Solo se considera CANAL si no es una carpeta reservada y contiene InfoCanal/
                if (!isReserved && hasInfoCanal) {
                  if (!existingChannels.includes(entry.name)) {
                    existingChannels.push(entry.name);
                  }
                }

                let subDirs: string[] = [];
                try {
                  subDirs = fs.readdirSync(subPath, { withFileTypes: true })
                    .filter(e => !e.name.startsWith('.'))
                    .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`);
                } catch { /* ignorar errores de permisos */ }
                structureLines.push(`• ${hasInfoCanal ? 'Canal' : 'Carpeta'} "${entry.name}": [${subDirs.join(', ') || 'vacío'}]`);
              } else {
                structureLines.push(`• Archivo en raíz: "${entry.name}"`);
              }
            }
            if (structureLines.length > 0) {
              workspaceStructureSnapshot = `\n\n--- ESTADO ACTUAL DEL WORKSPACE EN DISCO (TIEMPO REAL) ---\nUbicación: ${currentWorkspacePath}\nCanales detectados físicamente (${existingChannels.length}): ${existingChannels.join(', ')}\nElementos detectados actualmente:\n${structureLines.join('\n')}\n(Usa esta lista como verdad absoluta de lo que existe físicamente en el disco duro del usuario al momento de responder. Si el usuario pregunta qué tiene o se refiere a un canal o carpeta, básate en este estado).`;
            } else {
              workspaceStructureSnapshot = `\n\n--- ESTADO ACTUAL DEL WORKSPACE EN DISCO (TIEMPO REAL) ---\nUbicación: ${currentWorkspacePath}\nEl workspace está actualmente vacío (sin canales ni archivos).`;
            }
          }
        } catch (scanErr: any) {
          console.warn("[Workspace Scan Error]:", scanErr.message);
        }

        // Sincronizar canales de la base de datos
        if (userId) {
          try {
            const dbChannels = await prisma.channel.findMany({ where: { userId }, select: { name: true } });
            for (const dbc of dbChannels) {
              if (!existingChannels.includes(dbc.name)) {
                existingChannels.push(dbc.name);
              }
            }
          } catch (dbErr: any) {
            console.warn("[DB Channels Sync Error]:", dbErr.message);
          }
        }

        systemPrompt += workspaceStructureSnapshot;

        // ──────────────────────────────────────────────
        // RESOLVER CANAL ACTIVO (DETECCIÓN INTELIGENTE)
        // ──────────────────────────────────────────────
        activeChannel = null;
        activeChannelContext = null;

        const allUserChannels = userId ? await prisma.channel.findMany({ where: { userId } }) : [];

        // 1. Por channelId explícito en la petición
        if (channelId) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId);
          if (isUuid) {
            activeChannel = allUserChannels.find(c => c.id === channelId) || await prisma.channel.findFirst({ where: { id: channelId } });
          }
          if (!activeChannel) {
            activeChannel = allUserChannels.find(c => c.name.toLowerCase() === String(channelId).toLowerCase());
          }
          if (!activeChannel && typeof channelId === 'string' && channelId.trim()) {
            activeChannel = {
              id: channelId,
              name: channelId,
              niche: channelId,
              localPath: currentWorkspacePath ? path.join(currentWorkspacePath, channelId) : null
            };
          }
        }

        // 2. Detección por nombre de canal en el mensaje del usuario si no vino channelId
        if (!activeChannel && messages && messages.length > 0) {
          const recentUserText = messages
            .filter((m: any) => m.role === 'user')
            .slice(-2)
            .map((m: any) => (m.content || '').toLowerCase())
            .join(' ');

          const normUserText = recentUserText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

          // Match directo contra nombres de canales o palabras del canal registrado
          for (const ch of allUserChannels) {
            const normName = ch.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            if (normUserText.includes(normName)) {
              activeChannel = ch;
              break;
            }
            // Coincidencia con palabras significativas del propio nombre del canal (de al menos 4 caracteres)
            const channelWords = normName.split(/[\s_]+/).filter((w: string) => w.length >= 4);
            if (channelWords.some((w: string) => normUserText.includes(w))) {
              activeChannel = ch;
              break;
            }
          }

          // Match contra carpetas físicas en disco si no coincidió en BD
          if (!activeChannel && existingChannels.length > 0) {
            for (const folderName of existingChannels) {
              const normFolder = folderName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              if (normUserText.includes(normFolder)) {
                activeChannel = allUserChannels.find(c => c.name.toLowerCase() === folderName.toLowerCase()) || {
                  id: folderName,
                  name: folderName,
                  niche: folderName,
                  localPath: currentWorkspacePath ? path.join(currentWorkspacePath, folderName) : null
                };
                break;
              }
              const folderWords = normFolder.split(/[\s_]+/).filter((w: string) => w.length >= 4);
              if (folderWords.some((w: string) => normUserText.includes(w))) {
                activeChannel = allUserChannels.find(c => c.name.toLowerCase() === folderName.toLowerCase()) || {
                  id: folderName,
                  name: folderName,
                  niche: folderName,
                  localPath: currentWorkspacePath ? path.join(currentWorkspacePath, folderName) : null
                };
                break;
              }
            }
          }
        }

        // 3. Si el usuario tiene exactamente 1 canal registrado, asumirlo por defecto
        if (!activeChannel && allUserChannels.length === 1) {
          activeChannel = allUserChannels[0];
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
          // 1. Listar canales
          if (semanticMatch.toolName === 'listar_canales') {
            const channelListStr = existingChannels.length > 0
              ? existingChannels.map(c => `• 📁 **${c}**`).join('\n')
              : 'Actualmente no tienes canales creados en tu workspace.';
            const fastText = `He consultado tu workspace en tiempo real:\n\n${channelListStr}\n\n¿Deseas seleccionar alguno para comenzar a producir un video o planificar guiones?`;

            logIntentTelemetry({
              userId,
              rawQuery: userQueryText,
              detectedDomain: semanticMatch.domain,
              executedTool: 'listar_canales',
              wasFastPath: true,
              confidenceScore: semanticMatch.confidence,
              success: true
            });

            return NextResponse.json({
              text: fastText,
              modelName: 'AutoProd',
              workspaceModified: false,
              executedTools: ['listar_canales'],
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

            const fastText = `Diagnóstico del sistema AutoProd:\n\n• **Motor Local (FastAPI):** ${motorOnline ? '🟢 Online (puerto 8000)' : '🔴 Desconectado (inicia el motor para renderizar y usar TTS)'}\n• **Workspace:** \`${currentWorkspacePath}\`\n• **Canales detectados:** ${existingChannels.length} canal(es)\n• **Router Semántico (System 1):** ⚡ Activo (< 50ms)\n\n¿En qué podemos trabajar hoy?`;

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

        // ──────────────────────────────────────────────
        // CARGA PROFUNDA DE ADN, MÉTRICAS E HISTORIAL
        // ──────────────────────────────────────────────
        let topTagsFormatted = '';
        let recentVideosFormatted = '';
        let channelSummary = '';
        let channelNiche = '';
        let channelLocal = '';

        if (activeChannel) {
          channelNiche = activeChannel.niche || activeChannel.name;
          channelLocal = activeChannel.localPath || (currentWorkspacePath ? path.join(currentWorkspacePath, activeChannel.name) : `Workspace/${activeChannel.name}`);

          // Cargar channelContext directamente desde Postgres con raw query (bypasea RLS)
          if (activeChannel.id) {
            try {
              const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activeChannel.id);
              let rows: any[] = [];
              if (isUuid) {
                rows = await prisma.$queryRawUnsafe(
                  `SELECT * FROM public."channelContext" WHERE "channelId" = $1::uuid LIMIT 1`,
                  activeChannel.id
                );
              } else {
                rows = await prisma.$queryRawUnsafe(
                  `SELECT * FROM public."channelContext" WHERE "title" ILIKE $1 LIMIT 1`,
                  `%${activeChannel.name}%`
                );
              }
              if (rows && rows.length > 0) {
                activeChannelContext = rows[0];
              }
            } catch (queryErr: any) {
              console.warn('[DB channelContext query error]:', queryErr?.message);
            }
          }

          // Cargar archivos locales de InfoCanal si existen físicamente en disco
          let localContextText = '';
          let localMetricasText = '';
          let localHistorialText = '';
          if (currentWorkspacePath && activeChannel.name) {
            const infoCanalPath = path.join(currentWorkspacePath, activeChannel.name, 'InfoCanal');
            try {
              if (fs.existsSync(infoCanalPath)) {
                const ctxFile = path.join(infoCanalPath, 'Contexto_canal.md');
                if (fs.existsSync(ctxFile)) localContextText = fs.readFileSync(ctxFile, 'utf-8');
                const metFile = path.join(infoCanalPath, 'Metricas_canal.md');
                if (fs.existsSync(metFile)) localMetricasText = fs.readFileSync(metFile, 'utf-8');
                const histFile = path.join(infoCanalPath, 'Historial_canal.md');
                if (fs.existsSync(histFile)) localHistorialText = fs.readFileSync(histFile, 'utf-8');
              }
            } catch (fsErr: any) {
              console.warn('[InfoCanal physical read error]:', fsErr.message);
            }
          }

          // Resumen de identidad y nicho
          channelSummary = activeChannelContext?.contextSummary
            || activeChannelContext?.description
            || (localContextText ? localContextText.slice(0, 1200) : `Canal de YouTube enfocado en el nicho: ${channelNiche}`);

          if (activeChannelContext?.title && !channelNiche.includes(activeChannelContext.title)) {
            channelNiche = `${channelNiche} (Nombre oficial en YouTube: "${activeChannelContext.title}")`;
          }

          // Formatear mejores etiquetas
          let bestTagsList: any[] = [];
          if (activeChannelContext?.bestTags) {
            bestTagsList = Array.isArray(activeChannelContext.bestTags)
              ? activeChannelContext.bestTags
              : (typeof activeChannelContext.bestTags === 'string' ? JSON.parse(activeChannelContext.bestTags) : []);
          }
          if (bestTagsList.length > 0) {
            topTagsFormatted = bestTagsList.slice(0, 12).map((t: any) => `• "${t.tag}" (Promedio vistas: ${Number(t.avgViews || 0).toLocaleString()} | Total: ${Number(t.totalViews || 0).toLocaleString()})`).join('\n');
          } else if (localMetricasText) {
            topTagsFormatted = localMetricasText.slice(0, 1000);
          }

          // Formatear historial de videos ya publicados
          let coveredList: any[] = [];
          if (activeChannelContext?.topicsCovered) {
            coveredList = Array.isArray(activeChannelContext.topicsCovered)
              ? activeChannelContext.topicsCovered
              : (typeof activeChannelContext.topicsCovered === 'string' ? JSON.parse(activeChannelContext.topicsCovered) : []);
          }
          if (coveredList.length > 0) {
            recentVideosFormatted = coveredList.slice(0, 15).map((v: any) => `• "${v.title}" (${Number(v.views || 0).toLocaleString()} vistas)`).join('\n');
          } else if (localHistorialText) {
            recentVideosFormatted = localHistorialText.slice(0, 1000);
          }
        }

        const isAtChannelLimit = !isAdmin && existingChannels.length >= maxChannels;
        const planLimitsDirective = `\n\n=== REGLAS Y LÍMITES DE SUSCRIPCIÓN DEL USUARIO ===
- Plan de Suscripción Actual: ${userPlan} (${planConfig.displayName})
- Límite de canales permitidos por su plan: ${maxChannels >= 9999 ? 'Ilimitados' : `${maxChannels} canal(es)`}
- Canales existentes actualmente en su workspace (${existingChannels.length}): ${existingChannels.length > 0 ? existingChannels.join(', ') : 'Ninguno'}
${isAtChannelLimit ? `
⚠️ ATENCIÓN: El usuario ha alcanzado el límite máximo de canales permitidos por su plan (${existingChannels.length} de ${maxChannels}).
Si solicita crear o extraer un nuevo canal adicional, no ejecutes herramientas de creación de canales e infórmale de forma muy amable y profesional que ha alcanzado el límite de canales de su plan ${planConfig.displayName} y sugiérele los planes superiores (Pro o Enterprise).` : ''}
`;
        systemPrompt += planLimitsDirective;

        if (activeChannel) {
          const channelSpecificDirective = `\n\n=== 🧠 ADN Y MEMORIA ACTIVA DEL CANAL: "${activeChannel.name}" ===
- Canal: "${activeChannel.name}"
- Nicho / Enfoque: "${channelNiche}"
- Resumen de Identidad: ${channelSummary}
- Ubicación física en Disco: "${channelLocal}"

${topTagsFormatted ? `🔥 TEMAS Y ETIQUETAS MÁS EXITOSAS (DATOS REALES DE AUDIENCIA EN YOUTUBE):
${topTagsFormatted}` : ''}

${recentVideosFormatted ? `🚫 HISTORIAL DE VIDEOS YA PUBLICADOS (PROHIBIDO DUPLICAR O REPETIR ESTOS TEMAS/TÍTULOS):
${recentVideosFormatted}` : ''}

⚡ DIRECTIVA MANDATORIA DE PRODUCCIÓN (CERO PREGUNTAS EN BLANCO):
El usuario te ha pedido crear un video o planificar contenido para "${activeChannel.name}".
⛔ ESTÁ ESTRICTAMENTE PROHIBIDO hacer preguntas genéricas o en blanco como:
- "¿Sobre qué debería tratar el video?"
- "¿Qué estilo buscas (reflexivo, educativo, musical, etc.)?"
- "¿Cuánto debería durar?"
- "¿Qué detalles específicos quieres incluir?"

¡Tú eres el Director Ejecutivo de AutoProd y YA TIENES el ADN y las métricas de este canal en tu memoria!
TU CONDUCTA OBLIGATORIA:
1. Saluda reconociendo con entusiasmo el canal "${activeChannel.name}" y destacando su estilo y audiencia (basándote en su resumen y etiquetas con más visitas).
2. PROPÓN PROACTIVAMENTE 2 O 3 CONCEPTOS O TÍTULOS DE VIDEO GANADORES:
   - Diseñados específicamente utilizando sus mejores etiquetas y temas más vistos.
   - Garantizando que sean ideas NUEVAS y frescas que NO dupliquen ninguno de los videos de su historial.
   - Con una breve explicación de 1 línea de por qué cada idea tendrá éxito basándote en la audiencia del canal.
3. Pregúntale amablemente al usuario cuál de las 3 opciones le gusta más o cómo desea personalizarla para proceder a crear la carpeta del video en su disco (Guiones, Videos, Miniatura, Musica, Ambiente) y redactar el guion.`;

          systemPrompt += channelSpecificDirective;
        } else {
          const generalCapabilitiesDirective = `\n\n=== CONTEXTO GENERAL DEL WORKSPACE ===
- Canales detectados en tu workspace: ${existingChannels.length > 0 ? existingChannels.join(', ') : 'Ninguno aún'}.
Si el usuario dice que desea crear o producir un video pero no ha especificado claramente para cuál de sus canales lo desea, pregúntale amablemente: "¿Para cuál de tus canales (${existingChannels.join(', ')}) te gustaría que preparemos este video?". En cuanto el usuario lo indique, utilizarás de inmediato su memoria y métricas para proponerle ideas ganadoras sin hacer preguntas en blanco.`;

          systemPrompt += generalCapabilitiesDirective;
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
  "title": "Configuración de Nuevo Canal",
  "questions": [
    {
      "question": "¿Cuál será la temática o nicho central del canal?",
      "options": ["Misterio y Crímenes Reales", "Finanzas y Negocios Digitales", "Ciencia y Curiosidades", "Desarrollo Personal"]
    },
    {
      "question": "¿Tienes algún canal de YouTube de referencia o inspiración?",
      "options": ["Deseo que me propongas canales top del nicho", "No tengo referencias aún"],
      "allowCustomInput": true,
      "customInputPlaceholder": "Escribe el nombre o link del canal de referencia..."
    },
    {
      "question": "¿Deseas que analicemos la estrategia con GPT-4o?",
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
        
        // Mapear herramientas de la BD a Vercel AI SDK Tools
        const toolNames: string[] = [];
        for (const at of orchestrator.agentTools) {
          const dbTool = at.tool;
          if (!dbTool) continue;
          
          toolNames.push(dbTool.name);

          const toolSchemaObj = jsonSchema((dbTool.schema && typeof dbTool.schema === 'object') ? dbTool.schema as any : { type: 'object', properties: {} });

          aiTools[dbTool.name] = (aiTool as any)({
            description: dbTool.description || '',
            parameters: toolSchemaObj,
            execute: async (args: any) => {
               try {
                 executedTools.push(dbTool.name);
                 console.log(`[Proxy Tool] Invocando ${dbTool.name} en ${dbTool.apiEndpoint}`);
                 
                 // Inyectar el contexto dinámico del usuario en los argumentos (incluyendo workspacePath)
                 const payload = { ...args, _userContext: { id: userId, name: userRecord?.name, email: userRecord?.email, workspacePath: currentWorkspacePath } };
                  // 1. Normalización inteligente de sinónimos de parámetros (anti-422)
                  if (!payload.path && (payload.file_path || payload.filepath || payload.filename || payload.archivo || payload.file || payload.target_path || payload.target || payload.nombre_archivo)) {
                    payload.path = payload.file_path || payload.filepath || payload.filename || payload.archivo || payload.file || payload.target_path || payload.target || payload.nombre_archivo;
                  }
                  if (!payload.content && (payload.text || payload.body || payload.data || payload.contenido || payload.idea || payload.ideas || payload.resumen || payload.guion)) {
                    payload.content = payload.text || payload.body || payload.data || payload.contenido || payload.idea || payload.ideas || payload.resumen || payload.guion;
                  }
                  if (!payload.folder_name && (payload.folder || payload.name || payload.nombre_carpeta || payload.directory)) {
                    payload.folder_name = payload.folder || payload.name || payload.nombre_carpeta || payload.directory;
                  }
                  if (!payload.target_path && (payload.target || payload.destination || payload.ruta_destino)) {
                    payload.target_path = payload.target || payload.destination || payload.ruta_destino;
                  }
                  if (!payload.channel_name && (payload.channel || payload.canal || payload.nombre_canal)) {
                    payload.channel_name = payload.channel || payload.canal || payload.nombre_canal;
                  }

                  // Sanitizar nombres de carpetas para evitar caracteres ilegales en Windows/POSIX (: * ? " < > |)
                  if (payload.folder_name && typeof payload.folder_name === 'string') {
                    payload.folder_name = payload.folder_name.replace(/[\\/:*?"<>|]/g, ' - ').replace(/\s+/g, ' ').trim();
                  }
                  if (payload.channel_name && typeof payload.channel_name === 'string') {
                    payload.channel_name = payload.channel_name.replace(/[\\/:*?"<>|]/g, ' - ').replace(/\s+/g, ' ').trim();
                  }
                  if (!payload.base_path) {
                    if (payload.path) payload.base_path = payload.path;
                    else if (payload.channel_name) payload.base_path = payload.channel_name;
                    else if (payload.folder_name && (dbTool.name === 'listar_directorio' || dbTool.name === 'listar_directorio_plano')) {
                      payload.base_path = payload.folder_name;
                    }
                  }

                  // Normalización para extraer_canal_youtube
                  if (dbTool.name === 'extraer_canal_youtube') {
                    if (!payload.url_canal && (payload.url || payload.canal_url || payload.channel_url || payload.canal || payload.channel || payload.handle || payload.link)) {
                      payload.url_canal = payload.url || payload.canal_url || payload.channel_url || payload.canal || payload.channel || payload.handle || payload.link;
                    }
                  }

                  // Normalización para crear_canal
                  if (dbTool.name === 'crear_canal') {
                    if (!payload.nombre_canal && (payload.canal || payload.channel || payload.name || payload.nombre)) {
                      payload.nombre_canal = payload.canal || payload.channel || payload.name || payload.nombre;
                    }
                    if (!payload.tematica && (payload.niche || payload.nicho || payload.tema || payload.contexto_del_usuario || payload.description)) {
                      payload.tematica = payload.niche || payload.nicho || payload.tema || payload.contexto_del_usuario || payload.description;
                    }
                    if (!payload.estilo_tono && (payload.estilo || payload.tono || payload.style)) {
                      payload.estilo_tono = payload.estilo || payload.tono || payload.style;
                    }
                    if (!payload.audiencia && (payload.publico_objetivo || payload.audience)) {
                      payload.audiencia = payload.publico_objetivo || payload.audience;
                    }
                  }

                  // 2. Extensión .md o .txt automática para archivos
                  if (dbTool.name === 'guardar_archivo' && payload.path && typeof payload.path === 'string') {
                    if (!payload.path.endsWith('.md') && !payload.path.endsWith('.txt')) {
                      payload.path += '.md';
                    }
                  }

                  // 3. Obtener raíz de workspace efectiva (prioridad: request body -> detector)
                  const effectiveWorkspaceRoot = (workspacePath && typeof workspacePath === 'string' && workspacePath.trim() !== '')
                    ? workspacePath
                    : (getWorkspacePath() || '');

                  // 4. GUARD ESPECÍFICO para listar_directorio y listar_directorio_plano
                  if (dbTool.name === 'listar_directorio' || dbTool.name === 'listar_directorio_plano') {
                    if (!payload.base_path || payload.base_path === '.' || payload.base_path === '/') {
                      if (payload.channel_name) {
                        payload.base_path = effectiveWorkspaceRoot ? path.join(effectiveWorkspaceRoot, payload.channel_name) : payload.channel_name;
                      } else {
                        payload.base_path = effectiveWorkspaceRoot;
                      }
                    } else if (effectiveWorkspaceRoot && !path.isAbsolute(payload.base_path)) {
                      payload.base_path = path.join(effectiveWorkspaceRoot, payload.base_path);
                    }
                  }

                  // 5. GUARD ESPECÍFICO para crear_carpetas: normalización individual y múltiple
                  if (dbTool.name === 'crear_carpetas') {
                    // Normalizar arrays si el modelo los pasó con otros nombres
                    if (Array.isArray(payload.folder_name)) {
                      payload.folders = payload.folder_name;
                      delete payload.folder_name;
                    }
                    if (!payload.folders && (payload.carpetas || payload.folder_names || payload.nombres)) {
                      payload.folders = payload.carpetas || payload.folder_names || payload.nombres;
                    }
                    if (!payload.paths && payload.rutas) {
                      payload.paths = payload.rutas;
                    }
                    if (!payload.subfolders && payload.subcarpetas) {
                      payload.subfolders = payload.subcarpetas;
                    }
                    if (payload.channel && !payload.channel_name) {
                      payload.channel_name = payload.channel;
                    }
                    if (payload.canal && !payload.channel_name) {
                      payload.channel_name = payload.canal;
                    }
                    // Si no hay target_path ni paths, definir target_path por defecto
                    if (!payload.target_path && !payload.paths) {
                      if (payload.channel_name) {
                        payload.target_path = payload.channel_name;
                      } else {
                        payload.target_path = effectiveWorkspaceRoot;
                      }
                    }
                  }

                  // GUARD DE LÍMITES DE SUSCRIPCIÓN PARA CREACIÓN DE CANALES
                  if ((dbTool.name === 'crear_carpetas' || dbTool.name === 'crear_canal') && !isAdmin && existingChannels.length >= maxChannels) {
                    let isNewChannelAttempt = false;
                    let requestedChannelName = '';

                    // 1. Si se indicó channel_name y es diferente a los canales ya existentes
                    if (payload.channel_name && !existingChannels.includes(payload.channel_name)) {
                      isNewChannelAttempt = true;
                      requestedChannelName = payload.channel_name;
                    }

                    // 2. Si el destino es la raíz del workspace (sin target_path o igual a effectiveWorkspaceRoot)
                    const normTarget = (payload.target_path || '').replace(/\\/g, '/').toLowerCase();
                    const normWsRoot = (effectiveWorkspaceRoot || '').replace(/\\/g, '/').toLowerCase();
                    const isRootTarget = !payload.target_path || normTarget === normWsRoot || normTarget === '.' || normTarget === '/';

                    if (isRootTarget && !payload.channel_name) {
                      const candidateFolders = [
                        payload.folder_name,
                        ...(Array.isArray(payload.folders) ? payload.folders : []),
                        ...(Array.isArray(payload.paths) ? payload.paths : [payload.path]),
                      ].filter(Boolean);

                      for (const f of candidateFolders) {
                        if (typeof f === 'string') {
                          const cleanName = path.basename(f.trim().replace(/\\/g, '/'));
                          // Si no es un canal existente ni pertenece a uno existente
                          if (!existingChannels.includes(cleanName) && !existingChannels.some(ch => f.includes(ch))) {
                            isNewChannelAttempt = true;
                            requestedChannelName = cleanName;
                            break;
                          }
                        }
                      }
                    }

                    if (isNewChannelAttempt) {
                      console.warn(`[Plan Limit Guard]: Bloqueada creación del canal "${requestedChannelName}" para usuario en plan ${userPlan}`);
                      return `[LÍMITE DE PLAN ALCANZADO]: No es posible crear el nuevo canal "${requestedChannelName}". El usuario tiene el plan ${planConfig.displayName} (${userPlan}), que solo permite un máximo de ${maxChannels} canal(es). Su workspace ya contiene el canal "${existingChannels[0] || 'existente'}". NO intentes crear la carpeta e informa claramente al usuario que ha alcanzado el límite de su plan, e invítalo a actualizar a Plan Pro ($100 USD para 3 canales) o Enterprise ($150 USD para canales ilimitados).`;
                    }
                  }

                  if (dbTool.name === 'extraer_canal_youtube' && !isAdmin && existingChannels.length >= maxChannels) {
                    console.warn(`[Plan Limit Guard]: Bloqueada extracción de canal para usuario en plan ${userPlan}`);
                    return `[LÍMITE DE PLAN ALCANZADO]: No se puede extraer un nuevo canal de YouTube. El usuario se encuentra en el plan ${planConfig.displayName} (${userPlan}), el cual solo permite un máximo de ${maxChannels} canal(es). Su workspace ya cuenta con el canal '${existingChannels[0] || 'existente'}'. Informa al usuario que ha alcanzado el límite de su plan y debe subir a Plan Pro (hasta 3 canales) o Enterprise (canales ilimitados) para importar nuevos canales.`;
                  }

                  // 6. GUARD ESPECÍFICO para eliminar_carpetas: asegurar soporte individual y múltiple (multiplataforma)
                  if (dbTool.name === 'eliminar_carpetas') {
                    const channelName = payload.channel_name ?? payload.canal ?? payload.channel ?? null;
                    if (channelName) payload.channel_name = String(channelName);

                    const collectedPaths: string[] = [];

                    // Recolectar de arrays
                    const candidateArrays = [payload.paths, payload.rutas, payload.folders, payload.carpetas];
                    for (const arr of candidateArrays) {
                      if (Array.isArray(arr)) {
                        for (const item of arr) {
                          if (item && typeof item === 'string' && item.trim()) {
                            collectedPaths.push(item.trim());
                          }
                        }
                      }
                    }

                    // Recolectar de valores individuales
                    const singleCandidates = [
                      payload.ruta, payload.path, payload.target_path, payload.folder_path,
                      payload.folder_name, payload.folder, payload.name, payload.carpeta
                    ];
                    for (const cand of singleCandidates) {
                      if (cand && typeof cand === 'string' && cand.trim()) {
                        if (!collectedPaths.includes(cand.trim())) {
                          collectedPaths.push(cand.trim());
                        }
                      }
                    }

                    // Limpieza y estandarización a barras /
                    if (collectedPaths.length > 0) {
                      const cleanList = collectedPaths.map(p => {
                        let c = p.replace(/\\/g, '/');
                        const isAbs = c.startsWith('/') || /^[a-zA-Z]:\//.test(c);
                        if (!isAbs && effectiveWorkspaceRoot && !payload.channel_name) {
                          c = path.join(effectiveWorkspaceRoot, c).replace(/\\/g, '/');
                        }
                        return c;
                      });

                      payload.paths = cleanList;
                      if (cleanList.length === 1) {
                        payload.ruta = cleanList[0];
                      }
                    }
                  }

                  // Log args reales para debugging
                  console.log(`[Proxy Tool] Args recibidos para ${dbTool.name}:`, JSON.stringify(args));
                  console.log(`[Proxy Tool] Payload normalizado:`, JSON.stringify(payload));

                  // 7. Garantizar que TODAS las rutas absolutas antepongan effectiveWorkspaceRoot si son relativas
                  if (effectiveWorkspaceRoot) {
                    if (payload.path && typeof payload.path === 'string' && !path.isAbsolute(payload.path)) {
                      payload.path = path.join(effectiveWorkspaceRoot, payload.path);
                    }
                    if (payload.target_path && typeof payload.target_path === 'string' && !path.isAbsolute(payload.target_path)) {
                      payload.target_path = path.join(effectiveWorkspaceRoot, payload.target_path);
                    }
                    if (payload.base_path && typeof payload.base_path === 'string' && !path.isAbsolute(payload.base_path)) {
                      payload.base_path = path.join(effectiveWorkspaceRoot, payload.base_path);
                    }
                    if (Array.isArray(payload.paths) && dbTool.name !== 'eliminar_carpetas' && dbTool.name !== 'crear_carpetas') {
                      payload.paths = payload.paths.map((p: any) => {
                        if (typeof p !== 'string') return p;
                        if (path.isAbsolute(p)) return p;
                        return path.join(effectiveWorkspaceRoot, p);
                      });
                    }
                  }
                  // Para métodos GET, convertir argumentos a query params
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
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: dbTool.method !== 'GET' ? JSON.stringify(payload) : undefined
                  });
                  
                  if (!response.ok) {
                    const errorJson = await response.json().catch(() => ({}));
                    let detail = errorJson.detail || errorJson.error || errorJson.message;
                    if (Array.isArray(detail)) {
                      detail = detail.map((d: any) => `${d.loc ? d.loc.join('.') + ': ' : ''}${d.msg || JSON.stringify(d)}`).join(' | ');
                    } else if (typeof detail === 'object') {
                      detail = JSON.stringify(detail);
                    }
                    return `[Error en ${dbTool.name} (HTTP ${response.status})]: ${detail || response.statusText}.`;
                  }

                  const data = await response.json();
                  return JSON.stringify(data);
                } catch(e: any) {
                  const isMotor = dbTool.apiEndpoint.includes(':8000');
                  const hint = isMotor 
                    ? 'Verifica si el motor local está activo en el puerto 8000.' 
                    : 'Verifica la conexión y configuración de la herramienta del sistema.';
                  return `[Fallo de conexión en ${dbTool.name}]: ${e.message}. ${hint}`;
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
  1. Psicología y retención de la audiencia de YouTube (gancho en los primeros 5 segundos, retención a mitad del video, llamados a la acción sin fricción).
  2. Arquitectura de contenido y coherencia con la temática del canal y el workspace.
  3. Viabilidad técnica de las carpetas y archivos necesarios.
  4. Optimización de CTR, SEO y posicionamiento algorítmico.
- Si vas a ejecutar herramientas para crear canales, videos o archivos, asegúrate de planificar la estructura de carpetas y archivos con máxima precisión antes de invocar la herramienta.
- Brinda una respuesta estructurada, profunda y de alto impacto para el creador.`;
      }

      // Inyectar contexto semántico vectorial de canales importados (pgvector)
      if (userId) {
        try {
          const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user');
          const userQueryText = typeof lastUserMessage?.content === 'string' 
            ? lastUserMessage.content 
            : (Array.isArray(lastUserMessage?.content) ? JSON.stringify(lastUserMessage.content) : '');

          if (userQueryText && userQueryText.trim().length > 3) {
            let oaiKey = process.env.OPENAI_API_KEY;
            if (!oaiKey && userRecord?.openaiVaultId) {
              const { data: sData } = await supabase.rpc('get_decrypted_secret', { p_secret_id: userRecord.openaiVaultId });
              if (sData) oaiKey = typeof sData === 'string' ? sData : sData.get_decrypted_secret || sData;
            }
            if (!oaiKey) {
              const { data: rpcK } = await supabase.rpc('get_api_key', { p_user_id: userId, p_provider: 'openai' });
              if (rpcK && typeof rpcK === 'string') oaiKey = rpcK;
            }

            if (oaiKey) {
              const { embedding } = await embed({
                model: createOpenAI({ apiKey: oaiKey }).embedding('text-embedding-3-small'),
                value: userQueryText.slice(0, 1000),
              });

              const { data: matchedChannels, error: matchErr } = await supabase.rpc('match_channel_contexts', {
                query_embedding: `[${embedding.join(',')}]`,
                match_threshold: 0.45,
                match_count: 2,
                p_user_id: userId,
              });

              if (!matchErr && Array.isArray(matchedChannels) && matchedChannels.length > 0) {
                for (const mc of matchedChannels) {
                  let antiDupSection = '';
                  if (Array.isArray(mc.topics_covered) && mc.topics_covered.length > 0) {
                    const topTitles = mc.topics_covered.slice(0, 15).map((t: any) => `• "${t.title}"`).join('\n');
                    antiDupSection = `\n🚫 TEMAS Y TÍTULOS YA TRATADOS EN ESTE CANAL (REGLA ESTRICTA: NO DUPLICAR NI REPETIR ESTAS IDEAS):\n${topTitles}`;
                  }

                  let bestTagsSection = '';
                  if (Array.isArray(mc.best_tags) && mc.best_tags.length > 0) {
                    const tagNames = mc.best_tags.slice(0, 10).map((t: any) => `"${t.tag}" (${t.avgViews?.toLocaleString()} vistas prom.)`).join(', ');
                    bestTagsSection = `\n🏷️ ETIQUETAS GANADORAS RECOMENDADAS PARA ESTE CANAL:\n${tagNames}`;
                  }

                  systemPrompt += `\n\n=== CANAL HISTÓRICO RELEVANTE DETECTADO (SIMILITUD SEMÁNTICA: ${Math.round((mc.similarity || 0) * 100)}%) ===
Canal: "${mc.title}" (${mc.handle || 'Sin handle'})
Identidad y Resumen: ${mc.context_summary}
${bestTagsSection}
${antiDupSection}
DIRECTIVA ESTRATÉGICA PARA PENSAMIENTO PROFUNDO:
- El usuario se está refiriendo o su consulta se alinea con este canal.
- Prohibido repetir los títulos o conceptos ya realizados listados arriba.
- Utiliza las etiquetas ganadoras comprobadas para optimizar la propuesta.
- Propón enfoques frescos, ángulos complementarios y estructuras de alto CTR.`;
                }
              }
            }
          }
        } catch (vectorErr: any) {
          console.warn('[Vector Context Retrieval]:', vectorErr?.message);
        }
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
    // Filtrado inteligente por dominios (Domain Tool Retrieval)
    let effectiveAiTools = aiTools;
    if (semanticMatch.matched && semanticMatch.domain) {
      const allowedTools = getToolsForDomain(semanticMatch.domain);
      if (allowedTools.length > 0) {
        const filtered: Record<string, any> = {};
        for (const toolName of allowedTools) {
          if (aiTools[toolName]) {
            filtered[toolName] = aiTools[toolName];
          }
        }
        if (Object.keys(filtered).length > 0) {
          effectiveAiTools = filtered;
        }
      }
    }

    const result: any = await generateText({
      model: aiModel,
      messages: history.filter((h: any) => h.role !== 'system'),
      system: systemPrompt,
      tools: Object.keys(effectiveAiTools).length > 0 ? effectiveAiTools : undefined,
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
