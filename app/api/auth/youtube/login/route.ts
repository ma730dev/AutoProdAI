import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

/**
 * GET /api/auth/youtube/login
 * Inicia el flujo oficial de OAuth 2.0 con Google para vincular canales de YouTube.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const origin = new URL(req.url).origin;
    const redirectBase = `${origin}/dashboard?view=channels`;

    const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${redirectBase}&error=${encodeURIComponent('Credenciales de Google OAuth no configuradas. Agrega YOUTUBE_CLIENT_ID y YOUTUBE_CLIENT_SECRET en tu .env')}`
      );
    }
    const redirectUri = `${origin}/api/auth/youtube/callback`;
    const scopes = [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
    ].join(' ');

    const state = Buffer.from(JSON.stringify({ userId: auth.user.id })).toString('base64url');

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', scopes);
    googleAuthUrl.searchParams.set('access_type', 'offline');
    googleAuthUrl.searchParams.set('prompt', 'consent');
    googleAuthUrl.searchParams.set('state', state);

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (err: any) {
    console.error('Error starting YouTube OAuth:', err);
    return NextResponse.json({ error: err.message || 'Error al iniciar vinculación con YouTube' }, { status: 500 });
  }
}
