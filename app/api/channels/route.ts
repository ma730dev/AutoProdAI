import { NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser, ensureDbUser } from '@/lib/auth';
import { PLANS_CONFIG } from '@/lib/pricing-config';
import { createClient } from '@supabase/supabase-js';

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    await ensureDbUser(user.id, user.email);

    // 1. Obtener canales desde Prisma (sin relación context inexistente en Prisma)
    const channels = await db.channel.findMany({
      where: { userId: user.id },
      include: {
        videos: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Obtener contextos semánticos desde Supabase si existen
    let contextMap = new Map();
    try {
      const supabase = getSupabaseClient();
      const { data: contexts } = await supabase
        .from('channelContext')
        .select('*')
        .eq('userId', user.id);

      if (contexts && Array.isArray(contexts)) {
        contextMap = new Map(contexts.map((c: any) => [c.channelId, c]));
      }
    } catch (sbErr) {
      console.warn('No se pudieron obtener channelContexts desde Supabase:', sbErr);
    }

    const result = channels.map(ch => ({
      ...ch,
      context: contextMap.get(ch.id) || null
    }));

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error fetching channels:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    await ensureDbUser(user.id, user.email);

    const body = await req.json().catch(() => ({}));
    const { name, localPath, niche, description, folderStatus } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'El nombre del canal es obligatorio.' }, { status: 400 });
    }

    const cleanName = name.trim();

    // 1. Obtener usuario y sus límites de suscripción
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      include: {
        subscription: {
          include: {
            plan: {
              include: { limits: true }
            }
          }
        }
      }
    });

    const userPlan = (dbUser?.subscription?.plan?.name as 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE') || 'FREE';
    const planConfig = PLANS_CONFIG[userPlan] || PLANS_CONFIG.FREE;
    const maxChannels = dbUser?.role === 'ADMIN' ? 9999 : (dbUser?.subscription?.plan?.limits?.maxChannels ?? planConfig.maxChannels);

    // 2. Comprobar si el canal ya existe para este usuario (por nombre insensible a mayúsculas)
    const existingChannel = await db.channel.findFirst({
      where: {
        userId: user.id,
        name: { equals: cleanName, mode: 'insensitive' }
      }
    });

    // 3. Contar canales actuales si es un canal nuevo
    const currentChannelsCount = await db.channel.count({
      where: { userId: user.id }
    });

    if (!existingChannel && currentChannelsCount >= maxChannels) {
      return NextResponse.json({
        error: 'LIMIT_REACHED',
        code: 'MAX_CHANNELS_REACHED',
        currentCount: currentChannelsCount,
        maxAllowed: maxChannels,
        userPlan,
        message: `Has alcanzado el límite máximo de ${maxChannels} canal(es) permitido por tu plan ${planConfig.displayName}. Actualiza a Pro o Enterprise para gestionar más canales simultáneos.`
      }, { status: 403 });
    }

    const supabase = getSupabaseClient();
    const effectiveFolderStatus = folderStatus || (localPath ? 'CREATED' : 'PENDING');

    // 4. Si ya existe, actualizar datos (localPath, niche, folderStatus)
    if (existingChannel) {
      const updated = await db.channel.update({
        where: { id: existingChannel.id },
        data: {
          ...(localPath ? { localPath: localPath.trim() } : {}),
          ...(niche ? { niche: niche.trim() } : {}),
          ...(folderStatus ? { folderStatus } : {}),
        }
      });

      let ctx = null;
      try {
        const { data } = await supabase.from('channelContext').select('*').eq('channelId', existingChannel.id).maybeSingle();
        ctx = data;
      } catch {}

      return NextResponse.json({ ...updated, context: ctx });
    }

    // 5. Crear nuevo canal
    const newChannel = await db.channel.create({
      data: {
        userId: user.id,
        name: cleanName,
        localPath: localPath ? localPath.trim() : null,
        niche: niche ? niche.trim() : null,
        folderStatus: effectiveFolderStatus,
      }
    });

    let createdCtx = null;
    if (niche || description) {
      try {
        const { data } = await supabase.from('channelContext').insert({
          channelId: newChannel.id,
          userId: user.id,
          channelUrl: `local://${encodeURIComponent(cleanName)}`,
          title: niche?.trim() || cleanName,
          description: description?.trim() || `Canal enfocado en ${niche || cleanName}`,
          contextSummary: `Canal temático enfocado en el nicho: ${niche || cleanName}.`
        }).select().maybeSingle();
        createdCtx = data;
      } catch (ctxErr) {
        console.warn('No se pudo inicializar channelContext:', ctxErr);
      }
    }

    return NextResponse.json({ ...newChannel, context: createdCtx }, { status: 201 });
  } catch (err: any) {
    console.error('Error creating/updating channel:', err);
    return NextResponse.json({ error: err.message || 'Error interno al registrar canal' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const { id, name, folderStatus, localPath, niche } = body;

    if (!id && !name) {
      return NextResponse.json({ error: 'Se requiere id o name del canal.' }, { status: 400 });
    }

    const channel = await db.channel.findFirst({
      where: {
        userId: user.id,
        ...(id ? { id } : { name: { equals: name.trim(), mode: 'insensitive' } })
      }
    });

    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado.' }, { status: 404 });
    }

    const updated = await db.channel.update({
      where: { id: channel.id },
      data: {
        ...(folderStatus ? { folderStatus } : {}),
        ...(localPath ? { localPath: localPath.trim() } : {}),
        ...(niche ? { niche: niche.trim() } : {}),
      }
    });

    return NextResponse.json({ success: true, channel: updated });
  } catch (err: any) {
    console.error('Error updating channel:', err);
    return NextResponse.json({ error: err.message || 'Error interno al actualizar canal' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    const body = await req.json().catch(() => ({}));
    const { id, name } = body;

    if (!id && !name) {
      return NextResponse.json({ error: 'Se requiere id o name del canal para eliminar.' }, { status: 400 });
    }

    const channel = await db.channel.findFirst({
      where: {
        userId: user.id,
        ...(id ? { id } : { name: { equals: name.trim(), mode: 'insensitive' } })
      }
    });

    if (!channel) {
      return NextResponse.json({ error: 'Canal no encontrado.' }, { status: 404 });
    }

    // Eliminar de Prisma (cascada a videos, assets, etc.)
    await db.channel.delete({
      where: { id: channel.id }
    });

    // Eliminar channelContext de Supabase si existe
    try {
      const supabase = getSupabaseClient();
      await supabase.from('channelContext').delete().eq('channelId', channel.id);
    } catch {}

    return NextResponse.json({ success: true, deletedChannelId: channel.id });
  } catch (err: any) {
    console.error('Error deleting channel:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar canal' }, { status: 500 });
  }
}
