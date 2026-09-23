'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';
import { toast } from 'sonner';
import { AutoProdLogo } from '@/components/AutoProdLogo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('confirmed') === 'true') {
        toast.success('¡Cuenta confirmada con éxito!', {
          description: 'Tu correo ha sido verificado. Ya puedes iniciar sesión en tu cuenta.',
        });
      }
      const urlError = params.get('error');
      if (urlError) {
        setError(urlError);
        toast.error('Error de autenticación', {
          description: urlError,
        });
      }
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isForgotPassword) {
        if (!email) {
          throw new Error('Por favor ingresa tu correo electrónico');
        }
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;

        toast.success('¡Correo de recuperación enviado!', {
          description: 'Revisa tu bandeja de entrada para restablecer tu contraseña.',
        });
        setIsForgotPassword(false);
        return;
      }

      if (isSignUp) {
        // Detect language preference (from localStorage or browser)
        const clientLang = typeof window !== 'undefined'
          ? (localStorage.getItem('autoprod_lang') || (navigator.language.startsWith('es') ? 'es' : 'en'))
          : 'es';

        // Sign Up with Supabase Auth
        const redirectUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/login?confirmed=true`
          : 'https://www.autoprodai.com/login?confirmed=true';

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              full_name: name,
              lang: clientLang,
            },
          },
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Sync user to Prisma database via the API
          const syncRes = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!syncRes.ok) {
            console.error('Error synchronizing user to database');
          }

          toast.success('¡Registro exitoso!', {
            description: 'Por favor verifica tu correo electrónico si es necesario.',
          });
          setIsSignUp(false);
        }
      } else {
        // Login with Supabase Auth
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;

        if (data.user) {
          // Sync user to Prisma database
          await fetch('/api/auth/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          toast.success('¡Inicio de sesión exitoso!', {
            description: 'Bienvenido de vuelta, redirigiendo al panel...',
          });

          setTimeout(() => {
            router.push('/dashboard');
            router.refresh();
          }, 1200);
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Ocurrió un error inesperado';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex items-center justify-center relative overflow-hidden px-4">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-indigo-900/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-zinc-950/70 border border-zinc-800/80 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative z-10">
        
        {/* Logo/Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-3 mb-3 group">
            <div className="h-10 w-10 flex items-center justify-center group-hover:scale-105 transition-transform">
              <AutoProdLogo className="h-10 w-10 drop-shadow-[0_0_18px_rgba(134,41,254,0.6)]" />
            </div>
            <span className="font-logo text-2xl font-extrabold tracking-tight text-white">
              AutoProd
            </span>
          </Link>
          <p className="text-xs text-zinc-400">
            {isForgotPassword
              ? 'Recupera el acceso a tu cuenta'
              : isSignUp
              ? 'Crea tu cuenta para comenzar'
              : 'Inicia sesión para continuar al panel'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 text-center font-medium animate-shake">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {!isForgotPassword && isSignUp && (
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Nombre Completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-purple-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
              Correo Electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-purple-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>

          {!isForgotPassword && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Contraseña
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setError(null);
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-zinc-900/60 border border-zinc-800 focus:border-purple-500 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 rounded-xl text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
          >
            {loading ? (
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isForgotPassword ? (
              'Enviar enlace de recuperación'
            ) : isSignUp ? (
              'Registrarse'
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>

        {!isForgotPassword && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-900" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-zinc-950 px-2 text-zinc-500 font-semibold tracking-wider">O continuar con</span>
              </div>
            </div>

            <GoogleLoginButton onError={(msg) => setError(msg)} />
          </>
        )}

        <div className="mt-8 pt-6 border-t border-zinc-900 text-center">
          {isForgotPassword ? (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setError(null);
              }}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
            >
              ← Volver al inicio de sesión
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-xs text-purple-400 hover:text-purple-300 font-semibold transition-colors"
            >
              {isSignUp ? '¿Ya tienes una cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate aquí'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
