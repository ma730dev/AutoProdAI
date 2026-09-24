import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/video-projects
 * Lista los proyectos de edición del usuario autenticado con filtros opcionales.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = { userId: user.id };

    if (channelId) {
      if (channelId === 'none' || channelId === 'UNASSIGNED') {
        where.channelId = null;
      } else if (channelId !== 'ALL') {
        where.channelId = channelId;
      }
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (!(db as any).videoProject) {
      console.error('[video-projects] db.videoProject no está compilado en Prisma Client. Ejecuta `pnpm exec prisma generate`.');
      return NextResponse.json({
        error: 'El modelo VideoProject no está compilado en Prisma Client. Por favor ejecuta "pnpm exec prisma generate" en tu terminal para sincronizar Prisma.',
        needsPrismaGenerate: true
      }, { status: 500 });
    }

    const projects = await (db as any).videoProject.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        channel: {
          select: { id: true, name: true, profilePicture: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      total: projects.length,
      projects
    });
  } catch (err: any) {
    console.error('Error fetching video projects:', err);
    return NextResponse.json({ error: err.message || 'Error al listar proyectos' }, { status: 500 });
  }
}

/**
 * POST /api/video-projects
 * Crea un nuevo proyecto de edición técnico independiente o asignado a un canal.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const { title, aspectRatio, resolution, channelId, storageMode, localPath, initialTimelineData } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'El título del proyecto es obligatorio.' }, { status: 400 });
    }

    // Validar si channelId pertenece al usuario (si fue provisto)
    let validChannelId: string | null = null;
    if (channelId && typeof channelId === 'string' && channelId.trim()) {
      const ch = await db.channel.findFirst({
        where: { id: channelId.trim(), userId: user.id },
        select: { id: true }
      });
      if (ch) validChannelId = ch.id;
    }

    const defaultTimeline = initialTimelineData && typeof initialTimelineData === 'object' 
      ? initialTimelineData 
      : {
          cuts: [],
          audio: [],
          overlays: [],
          subtitles: [],
          version: '1.0.0',
        };

    if (!(db as any).videoProject) {
      return NextResponse.json({
        error: 'El modelo VideoProject no está compilado en Prisma Client. Ejecuta "pnpm exec prisma generate" en tu terminal.',
        needsPrismaGenerate: true
      }, { status: 500 });
    }

    const project = await (db as any).videoProject.create({
      data: {
        userId: user.id,
        channelId: validChannelId,
        title: title.trim(),
        aspectRatio: aspectRatio || '16:9',
        resolution: resolution || '1080p',
        timelineData: defaultTimeline,
        storageMode: storageMode === 'CLOUD' ? 'CLOUD' : 'LOCAL',
        localPath: localPath || null,
        status: 'DRAFT',
      },
      include: {
        channel: {
          select: { id: true, name: true, profilePicture: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      project
    }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating video project:', err);
    return NextResponse.json({ error: err.message || 'Error al crear proyecto' }, { status: 500 });
  }
}
