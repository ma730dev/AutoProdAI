import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { embed } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { db as prisma } from '@/src/prisma/db';
import fs from 'fs/promises';
import path from 'path';
import { getWorkspacePath } from '@/lib/setup/detector';
import { extractFullChannel } from '@/lib/youtube/extractor';
import { processChannelAnalytics } from '@/lib/youtube/analytics';
import { PLANS_CONFIG } from '@/lib/pricing-config';

// Función auxiliar para obtener la YouTube API Key
async function getYouTubeApiKey(supabase: any, userId: string): Promise<string> {
  // 1. Vault de Supabase a través del RPC get_api_key (Prioridad de usuario / BYOK)
  try {
    const { data: ytKey } = await supabase.rpc('get_api_key', { p_user_id: userId, p_provider: 'youtube' });
    if (ytKey && typeof ytKey === 'string' && ytKey.trim() !== '') {
      return ytKey.trim();
    }
  } catch (e) {
    console.warn('Error consultando YouTube API Key en Vault:', e);
  }

  // 2. Variable de entorno cargada por Next.js
  if (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY.trim() !== '') {
    return process.env.YOUTUBE_API_KEY.trim();
  }

  // 3. Fallback a GOOGLE_API_KEY si está disponible
  if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim() !== '') {
    return process.env.GOOGLE_API_KEY.trim();
  }

  throw new Error('No se encontró ninguna clave de YouTube API (YOUTUBE_API_KEY). Por favor configúrala en Ajustes o en tu archivo .env.local.');
}

// Función auxiliar para obtener la OpenAI API Key para embeddings
async function getOpenAiApiKey(supabase: any, userId: string): Promise<string> {
  // 1. Vault de Supabase (Prioridad BYOK por usuario)
  try {
    const { data: oaiKey } = await supabase.rpc('get_api_key', { p_user_id: userId, p_provider: 'openai' });
    if (oaiKey && typeof oaiKey === 'string' && oaiKey.trim() !== '') {
      return oaiKey.trim();
    }
  } catch (e) {
    console.warn('Error consultando OpenAI API Key en Vault:', e);
  }

  // 2. Variable de entorno del servidor (fallback)
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
    return process.env.OPENAI_API_KEY.trim();
  }

  throw new Error('No se encontró ninguna clave de OpenAI (OPENAI_API_KEY) para generar el vector embedding.');
}

function sanitizeFolderName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Canal_YouTube';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url_canal, url, canal_url, channel_url, handle, max_videos = 50, _userContext } = body;
    const targetUrl = (url_canal || url || canal_url || channel_url || handle || '').trim();

    if (!targetUrl) {
      return NextResponse.json({ 
        error: 'El parámetro "url_canal" es obligatorio. Proporciona la URL o el @handle del canal de YouTube.' 
      }, { status: 400 });
    }

    const userId = _userContext?.id;
    if (!userId) {
      return NextResponse.json({ error: 'No autorizado. Falta contexto de usuario (_userContext).' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false }
    });

    // 0. Validar límite de canales del plan del usuario
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: { include: { plan: { include: { limits: true } } } },
        channels: true,
      }
    });

    const userPlan = (userRecord?.subscription?.plan?.name as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE') || 'FREE';
    const planConfig = PLANS_CONFIG[userPlan] || PLANS_CONFIG.FREE;
    const maxChannels = userRecord?.subscription?.plan?.limits?.maxChannels ?? planConfig.maxChannels;
    const currentChannelsCount = userRecord?.channels?.length ?? 0;

    if (userRecord?.role !== 'ADMIN' && currentChannelsCount >= maxChannels) {
      return NextResponse.json({
        success: false,
        requiresUpgrade: true,
        error: `Has alcanzado el límite de tu plan ${planConfig.displayName} (${maxChannels} canal${maxChannels > 1 ? 'es' : ''}). Para conectar más canales simultáneos, actualiza a Plan Pro ($100 USD) o Enterprise ($150 USD).`
      }, { status: 403 });
    }

    // ──────────────────────────────────────────────
    // 1. Obtener API Keys
    // ──────────────────────────────────────────────
    const ytApiKey = await getYouTubeApiKey(supabase, userId);
    const oaiApiKey = await getOpenAiApiKey(supabase, userId);

    // ──────────────────────────────────────────────
    // 2. Extraer datos con YouTube Data API v3
    // ──────────────────────────────────────────────
    console.log(`[YouTube Tool] Extrayendo canal: "${targetUrl}" (límite: ${max_videos} videos)...`);
    const channelData = await extractFullChannel(targetUrl, ytApiKey, Math.min(Number(max_videos) || 50, 100));

    // ──────────────────────────────────────────────
    // 3. Procesamiento Analítico & Data Mining
    // ──────────────────────────────────────────────
    const analytics = processChannelAnalytics(channelData);

    // ──────────────────────────────────────────────
    // 4. Generación de Vector Embedding (OpenAI text-embedding-3-small)
    // ──────────────────────────────────────────────
    console.log(`[YouTube Tool] Generando embedding de contexto para "${channelData.channel.title}"...`);
    const customOpenAi = createOpenAI({ apiKey: oaiApiKey });
    const { embedding } = await embed({
      model: customOpenAi.embedding('text-embedding-3-small'),
      value: analytics.contextSummaryText,
    });

    const vectorString = `[${embedding.join(',')}]`;

    // ──────────────────────────────────────────────
    // 5. Persistencia en Base de Datos (Prisma + Supabase)
    // ──────────────────────────────────────────────
    const workspaceRoot = _userContext?.workspacePath || getWorkspacePath();
    const cleanChannelName = sanitizeFolderName(channelData.channel.title);
    const channelLocalPath = workspaceRoot ? path.join(/*turbopackIgnore: true*/ workspaceRoot, cleanChannelName) : null;
    const channelNiche = analytics.topTags?.[0]?.tag || channelData.channel.title;

    // 5a. Upsert del Canal en tabla Channel
    let channelRecord = await prisma.channel.findFirst({
      where: {
        userId,
        OR: [
          { youtubeChannelId: channelData.channel.id },
          { name: channelData.channel.title }
        ]
      }
    });

    if (channelRecord) {
      channelRecord = await prisma.channel.update({
        where: { id: channelRecord.id },
        data: {
          name: channelData.channel.title,
          youtubeChannelId: channelData.channel.id,
          profilePicture: channelData.channel.thumbnailUrl || channelRecord.profilePicture,
          localPath: channelLocalPath || channelRecord.localPath,
          niche: channelNiche || channelRecord.niche,
        }
      });
    } else {
      channelRecord = await prisma.channel.create({
        data: {
          name: channelData.channel.title,
          youtubeChannelId: channelData.channel.id,
          profilePicture: channelData.channel.thumbnailUrl,
          localPath: channelLocalPath,
          niche: channelNiche,
          userId,
        }
      });
    }

    // 5b. Guardar/Actualizar ChannelContext con pgvector
    const topicsCoveredJson = JSON.stringify(channelData.videos.map(v => ({
      id: v.id,
      title: v.title,
      publishedAt: v.publishedAt,
      views: v.viewCount,
      url: v.url,
      tags: v.tags.slice(0, 5)
    })));

    const bestTagsJson = JSON.stringify(analytics.topTags);

    await prisma.$executeRawUnsafe(`
      INSERT INTO public."channelContext" (
        "id", "channelId", "userId", "channelUrl", "handle", "title", "description",
        "subscriberCount", "videoCount", "viewCount", "contextSummary", "topicsCovered",
        "bestTags", "embedding", "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        $1::uuid,
        $2::uuid,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11::jsonb,
        $12::jsonb,
        $13::vector,
        now()
      )
      ON CONFLICT ("channelId") DO UPDATE SET
        "channelUrl" = EXCLUDED."channelUrl",
        "handle" = EXCLUDED."handle",
        "title" = EXCLUDED."title",
        "description" = EXCLUDED."description",
        "subscriberCount" = EXCLUDED."subscriberCount",
        "videoCount" = EXCLUDED."videoCount",
        "viewCount" = EXCLUDED."viewCount",
        "contextSummary" = EXCLUDED."contextSummary",
        "topicsCovered" = EXCLUDED."topicsCovered",
        "bestTags" = EXCLUDED."bestTags",
        "embedding" = EXCLUDED."embedding",
        "updatedAt" = now();
    `,
      channelRecord.id,
      userId,
      channelData.channel.customUrl ? `https://www.youtube.com/${channelData.channel.customUrl}` : targetUrl,
      channelData.channel.customUrl || null,
      channelData.channel.title,
      channelData.channel.description || '',
      channelData.channel.subscriberCount,
      channelData.channel.videoCount,
      channelData.channel.viewCount,
      analytics.contextSummaryText,
      topicsCoveredJson,
      bestTagsJson,
      vectorString
    );

    // 5c. Sincronizar videos en la tabla Video (status: PUBLISHED)
    for (const v of channelData.videos) {
      try {
        await prisma.video.upsert({
          where: { youtubeVideoId: v.id },
          create: {
            channelId: channelRecord.id,
            name: v.title.slice(0, 100),
            title: v.title,
            description: v.description,
            tags: v.tags.join(', '),
            status: 'PUBLISHED',
            youtubeVideoId: v.id,
          },
          update: {
            title: v.title,
            description: v.description,
            tags: v.tags.join(', '),
            status: 'PUBLISHED',
          }
        });
      } catch (videoErr) {
        // Continuar si falla un video individual para no abortar el flujo
        console.warn(`[Video Sync] Omitiendo video ${v.id}:`, videoErr);
      }
    }

    // ──────────────────────────────────────────────
    // 6. Generación de Archivos en el Workspace Local
    // ──────────────────────────────────────────────
    let writtenFiles: string[] = [];
    let localFolderPath = '';

    if (workspaceRoot) {
      const cleanChannelName = sanitizeFolderName(channelData.channel.title);
      localFolderPath = path.join(workspaceRoot, cleanChannelName, 'InfoCanal');
      await fs.mkdir(localFolderPath, { recursive: true });

      const pathContexto = path.join(localFolderPath, 'Contexto_canal.md');
      const pathMetricas = path.join(localFolderPath, 'Metricas_canal.md');
      const pathHistorial = path.join(localFolderPath, 'Historial_canal.md');

      await fs.writeFile(pathContexto, analytics.markdownContexto, 'utf-8');
      await fs.writeFile(pathMetricas, analytics.markdownMetricas, 'utf-8');
      await fs.writeFile(pathHistorial, analytics.markdownHistorial, 'utf-8');

      writtenFiles = [pathContexto, pathMetricas, pathHistorial];
      console.log(`[YouTube Tool] Archivos de contexto guardados exitosamente en: ${localFolderPath}`);
    }

    // ──────────────────────────────────────────────
    // 7. Respuesta Estructurada
    // ──────────────────────────────────────────────
    const top5Tags = analytics.topTags.slice(0, 5).map(t => `${t.tag} (${t.avgViews.toLocaleString()} vistas prom.)`);

    return NextResponse.json({
      status: 'success',
      channel: {
        id: channelRecord.id,
        youtubeChannelId: channelData.channel.id,
        title: channelData.channel.title,
        handle: channelData.channel.customUrl,
        subscribers: channelData.channel.subscriberCount,
        totalVideos: channelData.channel.videoCount,
        extractedVideosCount: channelData.videos.length,
        averageViews: analytics.averageViews,
      },
      topWinningTags: top5Tags,
      localFolder: localFolderPath,
      filesCreated: writtenFiles.map(f => path.basename(f)),
      message: `El canal "${channelData.channel.title}" fue extraído y analizado exitosamente. Se indexó el vector de contexto en BD y se generó la carpeta física con los archivos: Contexto_canal.md, Metricas_canal.md y Historial_canal.md.`,
    });

  } catch (error: any) {
    console.error('[Error extraer_canal_youtube]:', error);
    return NextResponse.json({ 
      error: error.message || 'Error interno durante la extracción del canal de YouTube' 
    }, { status: 500 });
  }
}
