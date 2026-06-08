'use client';

import * as React from 'react';
import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input } from '@/components/ui';
import { authClient } from '@/lib/api/auth-client';
import { AuthShell } from '../_components/auth-shell';
import { getAuthErrorMessage } from '../_components/auth-error';
import { AuthAlert, AuthField, AuthSurface } from '../_components/auth-ui';

function LoginForm() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = React.useState({ email: '', password: '' });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const expired = searchParams.get('expired');
    if (expired === 'true') {
      toast.error('Tu sesión expiró', {
        description: 'Por seguridad, vuelve a iniciar sesión para seguir trabajando.',
        duration: 5000,
      });
      window.history.replaceState({}, '', '/iniciar-sesion');
    }
  }, [searchParams]);

  const canSubmit = formData.email.trim() !== '' && formData.password.trim() !== '';

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const data = await authClient.login(formData);

      if (data?.access_token) {
        const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `access_token=${data.access_token}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
      }

      if (data?.user?.sesionId) {
        document.cookie = `sesion_id=${data.user.sesionId}; path=/; max-age=86400; SameSite=Lax`;
      }

      if (data?.user?.tenantId) {
        document.cookie = `tenant-id=${data.user.tenantId}; path=/; max-age=86400; SameSite=Lax`;
      }

      if (data?.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      window.location.href = '/dashboard';
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, 'No pudimos iniciar tu sesión.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Iniciar Sesión"
      description="Ingresa tus credenciales corporativas para acceder a la consola de control."
      footer={
        <div className="flex flex-col gap-4 text-center mt-2 text-xs font-mono">
          <Link href="/olvide-mi-contraseña" className="text-zinc-500 hover:text-emerald-400 transition-colors">
            ¿Olvidaste tu contraseña?
          </Link>
          <div className="h-px bg-white/[0.06] w-full" />
          <div className="text-zinc-500">
            ¿Primera vez en Tenaxis?{' '}
            <Link href="/registro" className="font-bold text-emerald-500 hover:text-emerald-400 transition-colors">
              Crea una cuenta
            </Link>
          </div>
        </div>
      }
    >
      <AuthSurface className="border-0 bg-transparent p-0 shadow-none dark:bg-transparent">
        <div className="space-y-5">
          {error ? (
            <AuthAlert
              tone="error"
              title="No pudimos autenticarte"
              description={error}
            />
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <AuthField label="Correo corporativo" icon={Mail}>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="equipo@empresa.com"
                className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0"
                required
              />
            </AuthField>

            <AuthField label="Contraseña" icon={Lock}>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0"
                required
              />
            </AuthField>

            <Button
              type="submit"
              variant="emerald"
              disabled={!canSubmit || loading}
              className="h-12 w-full rounded-lg font-mono font-semibold text-sm shadow-none"
            >
              {loading ? (
                'Verificando...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Entrar al Sistema
                </span>
              )}
            </Button>
          </form>
        </div>
      </AuthSurface>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
