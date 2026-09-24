import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/video-projects/[id]
 * Obtiene el proyecto completo con su timelineData para montarlo en el editor.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { id } = await context.params;

    if (!(db as any).videoProject) {
      return NextResponse.json({
        error: 'El modelo VideoProject no está compilado en Prisma Client. Ejecuta "pnpm exec prisma generate" en tu terminal.',
        needsPrismaGenerate: true
      }, { status: 500 });
    }

    const project = await (db as any).videoProject.findFirst({
      where: {
        id,
        userId: user.id
      },
      include: {
        channel: {
          select: { id: true, name: true, profilePicture: true }
        }
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project
    });
  } catch (err: any) {
    console.error('Error fetching video project by id:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener proyecto' }, { status: 500 });
  }
}

/**
 * PUT /api/video-projects/[id]
 * Actualiza el proyecto (soporta auto-guardado de timelineData, títulos, duración y metadatos).
 */
export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    // Verificar propiedad
    if (!(db as any).videoProject) {
      return NextResponse.json({
        error: 'El modelo VideoProject no está compilado en Prisma Client. Ejecuta "pnpm exec prisma generate" en tu terminal.',
        needsPrismaGenerate: true
      }, { status: 500 });
    }

    const existing = await (db as any).videoProject.findFirst({
      where: { id, userId: user.id },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    const {
      title,
      aspectRatio,
      resolution,
      timelineData,
      thumbnailUrl,
      durationSeconds,
      status,
      storageMode,
      localPath,
      channelId
    } = body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (title && typeof title === 'string') updateData.title = title.trim();
    if (aspectRatio && typeof aspectRatio === 'string') updateData.aspectRatio = aspectRatio;
    if (resolution && typeof resolution === 'string') updateData.resolution = resolution;
    if (timelineData && typeof timelineData === 'object') updateData.timelineData = timelineData;
    if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
    if (durationSeconds !== undefined && typeof durationSeconds === 'number') {
      updateData.durationSeconds = durationSeconds;
    }
    if (status && typeof status === 'string') updateData.status = status;
    if (storageMode && typeof storageMode === 'string') updateData.storageMode = storageMode;
    if (localPath !== undefined) updateData.localPath = localPath;

    if (channelId !== undefined) {
      if (!channelId) {
        updateData.channelId = null;
      } else {
        const ch = await db.channel.findFirst({
          where: { id: channelId, userId: user.id },
          select: { id: true }
        });
        updateData.channelId = ch ? ch.id : null;
      }
    }

    const updated = await (db as any).videoProject.update({
      where: { id },
      data: updateData,
      include: {
        channel: {
          select: { id: true, name: true, profilePicture: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      project: updated
    });
  } catch (err: any) {
    console.error('Error updating video project:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar proyecto' }, { status: 500 });
  }
}

/**
 * DELETE /api/video-projects/[id]
 * Elimina un proyecto de edición.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { id } = await context.params;

    if (!(db as any).videoProject) {
      return NextResponse.json({
        error: 'El modelo VideoProject no está compilado en Prisma Client. Ejecuta "pnpm exec prisma generate" en tu terminal.',
        needsPrismaGenerate: true
      }, { status: 500 });
    }

    const existing = await (db as any).videoProject.findFirst({
      where: { id, userId: user.id },
      select: { id: true }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 });
    }

    await (db as any).videoProject.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'Proyecto eliminado correctamente'
    });
  } catch (err: any) {
    console.error('Error deleting video project:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar proyecto' }, { status: 500 });
  }
}
