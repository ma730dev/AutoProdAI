import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/channels/[id]/history
 * Retorna el historial de publicaciones oficial (ContentHistory) sincronizado con el canal.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { id: channelId } = await context.params;

    // Verificar pertenencia del canal
    const channel = await db.channel.findFirst({
      where: { id: channelId, userId: user.id },
      select: { id: true, name: true }
    });

    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 });
    }

    if (!(db as any).contentHistory) {
      return NextResponse.json({
        error: 'El modelo ContentHistory no está compilado en Prisma Client. Ejecuta "pnpm exec prisma generate" en tu terminal.',
        needsPrismaGenerate: true
      }, { status: 500 });
    }

    const history = await (db as any).contentHistory.findMany({
      where: { channelId },
      orderBy: { publishedAt: 'desc' },
      take: 100
    });

    return NextResponse.json({
      success: true,
      total: history.length,
      history
    });
  } catch (err: any) {
    console.error('Error fetching channel content history:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener historial' }, { status: 500 });
  }
}
