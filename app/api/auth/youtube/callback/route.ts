import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/src/prisma/db';

/**
 * GET /api/auth/youtube/callback
 * Callback oficial de OAuth 2.0 que recibe el código de Google, obtiene tokens,
 * extrae el canal legítimo del usuario y sincroniza su ContentHistory inicial.
 */
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const redirectBase = `${origin}/dashboard?view=channels`;

  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.warn('Google OAuth error callback:', error);
      return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent('Cancelado por el usuario')}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent('Parámetros de autorización inválidos')}`);
    }

    // Decodificar state
    let stateData: { userId?: string } = {};
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
    } catch (_) {
      return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent('State inválido')}`);
    }

    const userId = stateData.userId;
    if (!userId) {
      return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent('Sesión de usuario no encontrada')}`);
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent('Credenciales OAuth de Google faltantes en el servidor')}`);
    }

    // 1. Intercambiar código por tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/api/auth/youtube/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error('Error exchanging Google token:', errBody);
      return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent('Error al intercambiar tokens con Google')}`);
    }

    const tokenData = await tokenRes.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // 2. Consultar canal legítimo del usuario mediante YouTube Data API
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true',
      {
        headers: { Authorization: `Bearer ${access_token}` },
      }
    );

    if (!channelRes.ok) {
      const errText = await channelRes.text();
      console.error('Error fetching YouTube channel:', errText);
      return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent('No se pudo obtener el canal de YouTube')}`);
    }

    const channelData = await channelRes.json();
    const channelItem = channelData.items?.[0];

    if (!channelItem) {
      return NextResponse.redirect(
        `${redirectBase}&error=${encodeURIComponent('Tu cuenta de Google no tiene un canal de YouTube creado')}`
      );
    }

    const ytChannelId = channelItem.id;
    const channelTitle = channelItem.snippet.title;
    const profilePicture =
      channelItem.snippet.thumbnails?.high?.url ||
      channelItem.snippet.thumbnails?.default?.url ||
      null;
    const stats = channelItem.statistics || {};
    const uploadsPlaylistId = channelItem.contentDetails?.relatedPlaylists?.uploads;

    // 3. Upsert en la tabla Channel
    const channel = await db.channel.upsert({
      where: { youtubeChannelId: ytChannelId },
      create: {
        userId,
        name: channelTitle,
        youtubeChannelId: ytChannelId,
        profilePicture,
        accessToken: access_token,
        refreshToken: refresh_token || null,
        tokenExpiry: new Date(Date.now() + (expires_in || 3600) * 1000),
      },
      update: {
        userId, // Si cambia de dueño en la app
        name: channelTitle,
        profilePicture,
        accessToken: access_token,
        refreshToken: refresh_token || undefined,
        tokenExpiry: new Date(Date.now() + (expires_in || 3600) * 1000),
      },
    });

    // 4. Sincronizar ContentHistory inicial si tiene playlist de uploads
    if (uploadsPlaylistId) {
      try {
        const videosRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=30`,
          {
            headers: { Authorization: `Bearer ${access_token}` },
          }
        );

        if (videosRes.ok) {
          const videosData = await videosRes.json();
          const items = videosData.items || [];

          for (const item of items) {
            const vidId = item.contentDetails?.videoId;
            const snippet = item.snippet;
            if (!vidId || !snippet) continue;

            const existingHistory = await db.contentHistory.findFirst({
              where: { channelId: channel.id, externalId: vidId },
              select: { id: true },
            });

            const dataPayload = {
              title: snippet.title || 'Video de YouTube',
              description: snippet.description || '',
              thumbnailUrl:
                snippet.thumbnails?.high?.url ||
                snippet.thumbnails?.default?.url ||
                null,
              externalUrl: `https://www.youtube.com/watch?v=${vidId}`,
              publishedAt: snippet.publishedAt ? new Date(snippet.publishedAt) : null,
              platform: 'YOUTUBE',
              contentType: 'VIDEO',
            };

            if (existingHistory) {
              await db.contentHistory.update({
                where: { id: existingHistory.id },
                data: dataPayload,
              });
            } else {
              await db.contentHistory.create({
                data: {
                  channelId: channel.id,
                  externalId: vidId,
                  ...dataPayload,
                },
              });
            }
          }
        }
      } catch (historyErr) {
        console.warn('Advertencia al sincronizar videos iniciales de YouTube:', historyErr);
      }
    }

    return NextResponse.redirect(`${redirectBase}&success=connected&channel=${encodeURIComponent(channelTitle)}`);
  } catch (err: any) {
    console.error('Fatal callback error in YouTube OAuth:', err);
    return NextResponse.redirect(`${redirectBase}&error=${encodeURIComponent(err.message || 'Error inesperado')}`);
  }
}
