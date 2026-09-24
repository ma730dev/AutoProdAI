import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';

/**
 * Helper para garantizar que la tabla videoProject exista en PostgreSQL
 * de forma idempotente, incluso si el arnés de migraciones no se ha ejecutado aún.
 */
async function ensureVideoProjectTable() {
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "public"."videoProject" (
        "id" UUID NOT NULL DEFAULT gen_random_uuid(),
        "userId" UUID NOT NULL,
        "channelId" UUID,
        "title" TEXT NOT NULL,
        "aspectRatio" TEXT NOT NULL DEFAULT '16:9',
        "resolution" TEXT NOT NULL DEFAULT '1080p',
        "timelineData" JSONB NOT NULL DEFAULT '{}'::jsonb,
        "thumbnailUrl" TEXT,
        "durationSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "status" TEXT NOT NULL DEFAULT 'DRAFT',
        "storageMode" TEXT NOT NULL DEFAULT 'LOCAL',
        "localPath" TEXT,
        "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "videoProject_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "videoProject_userId_idx" ON "public"."videoProject"("userId");
      CREATE INDEX IF NOT EXISTS "videoProject_channelId_idx" ON "public"."videoProject"("channelId");
    `);
  } catch (e) {
    console.warn('[video-projects] Note on ensureVideoProjectTable:', e);
  }
}

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

    // 1. Si Prisma Client ya fue compilado con el modelo VideoProject
    if ((db as any).videoProject) {
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

      if (search && search.trim()) {
        where.title = { contains: search.trim(), mode: 'insensitive' };
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
    }

    // 2. Fallback SQL resiliente en caliente si Prisma Client aún no se ha reiniciado
    await ensureVideoProjectTable();
    const rows: any[] = await db.$queryRawUnsafe(`
      SELECT 
        p.*,
        CASE WHEN c.id IS NOT NULL THEN json_build_object('id', c.id, 'name', c.name, 'profilePicture', c."profilePicture") ELSE NULL END as channel
      FROM "public"."videoProject" p
      LEFT JOIN "public"."Channel" c ON p."channelId" = c.id
      WHERE p."userId" = $1::uuid
      ORDER BY p."updatedAt" DESC
    `, user.id);

    return NextResponse.json({
      success: true,
      total: rows.length,
      projects: rows
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

    // 1. Si Prisma Client ya tiene el modelo compilado
    if ((db as any).videoProject) {
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
    }

    // 2. Fallback SQL resiliente en caliente si Prisma Client aún no se ha recompilado
    await ensureVideoProjectTable();
    const rows: any[] = await db.$queryRawUnsafe(`
      INSERT INTO "public"."videoProject" (
        "userId", "channelId", "title", "aspectRatio", "resolution", "timelineData", "storageMode", "localPath", "status"
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, $5, $6::jsonb, $7, $8, 'DRAFT'
      )
      RETURNING *
    `, user.id, validChannelId, title.trim(), aspectRatio || '16:9', resolution || '1080p', JSON.stringify(defaultTimeline), storageMode === 'CLOUD' ? 'CLOUD' : 'LOCAL', localPath || null);

    const project = rows[0] || null;

    return NextResponse.json({
      success: true,
      project
    }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating video project:', err);
    return NextResponse.json({ error: err.message || 'Error al crear proyecto' }, { status: 500 });
  }
}
