import { NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';
import { getAuthUser, ensureDbUser } from '@/lib/auth';

export async function GET() {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    await ensureDbUser(user.id, user.email);

    // Fetch conversations lightweight (no messages included)
    const conversations = await db.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(conversations);
  } catch (err: any) {
    console.error('Error fetching conversations:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    await ensureDbUser(user.id, user.email);

    const body = await request.json();
    const { title, channelId, videoId, systemPrompt, welcomeText } = body;

    // Validate foreign keys to avoid FK constraint violation errors
    let validChannelId: string | null = null;
    if (channelId && typeof channelId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(channelId)) {
      const ch = await db.channel.findFirst({ where: { id: channelId, userId: user.id } });
      if (ch) validChannelId = ch.id;
    }

    let validVideoId: string | null = null;
    if (videoId && typeof videoId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(videoId)) {
      const vid = await db.video.findFirst({ where: { id: videoId, channel: { userId: user.id } } });
      if (vid) validVideoId = vid.id;
    }

    // Create the conversation
    const conversation = await db.conversation.create({
      data: {
        title: title || 'Nueva conversación',
        userId: user.id,
        systemPrompt: systemPrompt || null,
        channelId: validChannelId,
        videoId: validVideoId,
      }
    });

    // Create default welcome message from Gemini
    const welcomeMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        sender: 'GEMINI',
        text: welcomeText || '¡Hola! Soy tu Co-Pilot de AutoProd. Selecciona un proyecto y configuramos el prompt SEO o preparemos el renderizado.',
      }
    });

    // Structure conversation response with messages array
    const result = {
      ...conversation,
      messages: [welcomeMessage],
    };

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error creating conversation:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;
    const { user } = auth;

    await ensureDbUser(user.id, user.email);

    const userConvs = await db.conversation.findMany({
      where: { userId: user.id },
      select: { id: true }
    });
    const convIds = userConvs.map(c => c.id);

    if (convIds.length > 0) {
      await db.message.deleteMany({
        where: { conversationId: { in: convIds } }
      });
      await db.conversation.deleteMany({
        where: { id: { in: convIds } }
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting all conversations:', err);
    return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
  }
}

