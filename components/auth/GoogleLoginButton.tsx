'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface GoogleLoginButtonProps {
  onError?: (error: string) => void;
}

export default function GoogleLoginButton({ onError }: GoogleLoginButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setLoading(false);
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      const msg = err.message || 'Error al conectar con Google';
      toast.error(msg);
      if (onError) {
        onError(msg);
      } else {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      type="button"
      className="w-full py-3 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2.5 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.04,3.1v2.58h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.4C21.68,11.72 21.56,11.4 21.35,11.1z" fill="#4285F4" />
          <path d="M12,20.73c2.63,0 4.84,-0.87 6.45,-2.37l-3.3,-2.58c-0.91,0.61 -2.08,0.98 -3.15,0.98 -2.42,0 -4.48,-1.64 -5.21,-3.84H3.38v2.66C4.99,16.74 8.27,20.73 12,20.73z" fill="#34A853" />
          <path d="M6.79,12.91c-0.18,-0.55 -0.29,-1.13 -0.29,-1.73s0.1,-1.18 0.29,-1.73V6.79H3.38C2.73,8.08 2.36,9.54 2.36,11.18s0.37,3.1 1.02,4.39L6.79,12.91z" fill="#FBBC05" />
          <path d="M12,5.18c1.43,0 2.71,0.49 3.72,1.46l2.79,-2.79C16.83,2.32 14.62,1.45 12,1.45c-3.73,0 -7.01,3.99 -8.62,8.12l3.41,2.66C7.52,6.82 9.58,5.18 12,5.18z" fill="#EA4335" />
        </svg>
      )}
      Google
    </button>
  );
}
