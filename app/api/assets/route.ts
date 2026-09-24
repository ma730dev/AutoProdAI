import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const channelId = searchParams.get('channelId');
    const search = searchParams.get('search');

    const where: any = { userId: user.id };

    if (type && type !== 'ALL') {
      if (type === 'IMAGE') {
        where.type = { in: ['IMAGE', 'THUMBNAIL'] };
      } else {
        where.type = type;
      }
    }

    if (channelId && channelId !== 'ALL') {
      if (channelId === 'UNASSIGNED') {
        where.channelId = null;
      } else {
        where.channelId = channelId;
      }
    }


    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { prompt: { contains: search.trim(), mode: 'insensitive' } },
      ];
    }

    const assets = await db.asset.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        channel: {
          select: { id: true, name: true }
        }
      }
    });

    // Calcular estadísticas de cuota y desglose por tipo
    const allUserAssets = await db.asset.findMany({
      where: { userId: user.id },
      select: { type: true, sizeBytes: true, storageUrl: true, localPath: true, isCache: true }
    });

    let cloudSizeBytes = 0;
    let localSizeBytes = 0;
    let cacheSizeBytes = 0;
    const countByType: Record<string, number> = {
      ALL: allUserAssets.length,
      IMAGE: 0,
      THUMBNAIL: 0,
      SUBTITLE: 0,
      VIDEO: 0,
      AUDIO: 0,
      OTHER: 0,
    };

    for (const a of allUserAssets) {
      const bytes = Number(a.sizeBytes) || 0;
      if (a.storageUrl) cloudSizeBytes += bytes;
      if (a.localPath) localSizeBytes += bytes;
      if (a.isCache) cacheSizeBytes += bytes;

      if (a.type === 'THUMBNAIL' || a.type === 'IMAGE') {
        countByType.IMAGE = (countByType.IMAGE || 0) + 1;
      }
      countByType[a.type] = (countByType[a.type] || 0) + 1;
    }

    const quotaBytes = 500 * 1024 * 1024; // 500 MB base

    const serializedAssets = assets.map(a => ({
      ...a,
      sizeBytes: Number(a.sizeBytes),
      channelName: a.channel?.name || null,
    }));

    return NextResponse.json({
      success: true,
      assets: serializedAssets,
      stats: {
        totalAssets: allUserAssets.length,
        cloudSizeBytes,
        localSizeBytes,
        cacheSizeBytes,
        quotaBytes,
        quotaUsedPercent: Math.min(100, Math.round((cloudSizeBytes / quotaBytes) * 100)),
        countByType,
      }
    });
  } catch (err: any) {
    console.error('Error fetching assets:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener recursos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json();
    const { name, type, format, prompt, storageUrl, localPath, isCache, sizeBytes, channelId, metadata } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'Nombre y tipo son obligatorios' }, { status: 400 });
    }

    const asset = await db.asset.create({
      data: {
        userId: user.id,
        channelId: channelId || null,
        name: name.trim(),
        type,
        format: format || name.split('.').pop()?.toLowerCase() || 'unknown',
        prompt: prompt || null,
        storageUrl: storageUrl || null,
        localPath: localPath || null,
        isCache: Boolean(isCache),
        sizeBytes: BigInt(sizeBytes || 0),
        metadata: metadata || {},
      },
      include: {
        channel: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({
      success: true,
      asset: {
        ...asset,
        sizeBytes: Number(asset.sizeBytes),
        channelName: asset.channel?.name || null,
      }
    });
  } catch (err: any) {
    console.error('Error creating asset:', err);
    return NextResponse.json({ error: err.message || 'Error al registrar recurso' }, { status: 500 });
  }
}
