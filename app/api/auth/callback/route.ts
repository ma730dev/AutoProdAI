import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/src/prisma/db';
import { getClientIp, evaluateWelcomeBonusEligibility, recordIpBonusGranted } from '@/lib/anti-abuse';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams, origin } = requestUrl;
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';
  const errorParam = searchParams.get('error');
  const errorDesc = searchParams.get('error_description');

  // Si Google o Supabase devolvieron un error explícito en el callback
  if (errorParam || errorDesc) {
    console.error('[Google Auth Callback Error]:', errorParam, errorDesc);
    const userMsg = errorDesc || errorParam || 'Error al autenticar con Google';
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(userMsg)}`);
  }

  if (code) {
    try {
      const supabase = await createClient();

      // Intercambiar el código de autorización por la sesión de Supabase
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[Google Auth Exchange Error]:', error.message);
        return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
      }

      if (data?.user) {
        const supabaseUser = data.user;

        // Sincronizar usuario con PostgreSQL Prisma usando el mismo UUID de Supabase
        let user = await db.user.findFirst({
          where: {
            OR: [
              { id: supabaseUser.id },
              { email: supabaseUser.email! }
            ]
          },
          include: { wallet: true, subscription: true }
        });

        if (!user) {
          const role = supabaseUser.email === 'mateo@autoprod.io' ? 'ADMIN' : 'USER';
          user = await db.user.create({
            data: {
              id: supabaseUser.id,
              email: supabaseUser.email!,
              name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email!.split('@')[0],
              role: role,
            },
            include: { wallet: true, subscription: true }
          });
        }

        // Asegurar que el usuario tenga Wallet inicial y bono de bienvenida (evaluado con anti-abuso)
        if (!user.wallet) {
          const clientIp = getClientIp(request);
          const { eligible, ipHash, reason } = await evaluateWelcomeBonusEligibility(
            supabaseUser.email!,
            clientIp,
            db
          );

          const initialBalance = eligible ? 50 : 0;
          if (eligible) {
            await recordIpBonusGranted(ipHash, db);
          } else {
            console.warn(`[AntiAbuse] Cuenta Google ${supabaseUser.email} no elegible para bono de cortesía. Razón: ${reason}`);
          }

          await db.wallet.create({
            data: {
              userId: user.id,
              balance: initialBalance
            }
          });
        }

        // Asegurar que el usuario tenga suscripción FREE activa
        if (!user.subscription) {
          let freePlan = await db.plan.findUnique({
            where: { name: 'FREE' }
          });

          if (!freePlan) {
            freePlan = await db.plan.create({
              data: {
                name: 'FREE',
                limits: {
                  create: {
                    maxChannels: 1,
                    maxVideosPerChannel: 5,
                    canRenderInCloud: false,
                    hasAdvancedTemplates: false,
                    maxMonthlyRenderMinutes: 0
                  }
                }
              }
            });
          }

          await db.userSubscription.create({
            data: {
              userId: user.id,
              planId: freePlan.id,
              status: 'active'
            }
          });
        }

        // Redirección al destino solicitado
        const forwardedHost = request.headers.get('x-forwarded-host');
        const isLocalEnv = process.env.NODE_ENV === 'development';
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
          return NextResponse.redirect(`${origin}${next}`);
        }
      }
    } catch (dbErr: any) {
      console.error('[Google Auth Internal Error]:', dbErr);
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(dbErr.message || 'Error interno al sincronizar sesión')}`);
    }
  }

  // Si no hubo código ni error explícito
  return NextResponse.redirect(`${origin}/login?error=No se recibió código de autorización de Google`);
}
