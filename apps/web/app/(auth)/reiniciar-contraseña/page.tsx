'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { authClient } from '@/lib/api/auth-client';
import { AuthShell } from '../_components/auth-shell';
import { getAuthErrorMessage } from '../_components/auth-error';
import { AuthAlert, AuthField, AuthSurface, PasswordStrength } from '../_components/auth-ui';

function getPasswordScore(password: string) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

function ResetPasswordForm() {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const passwordScore = React.useMemo(() => getPasswordScore(password), [password]);

  const isValid = Boolean(
    password &&
    confirmPassword &&
    password === confirmPassword &&
    password.length >= 6
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!isValid) {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
      } else if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
      }
      return;
    }

    if (!token) {
      setError('El enlace de recuperación no es válido o ya expiró.');
      return;
    }

    setIsLoading(true);

    try {
      await authClient.resetPassword({ token, password });
      setIsSuccess(true);
      window.setTimeout(() => {
        router.push('/iniciar-sesion');
      }, 2000);
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, 'No fue posible actualizar tu contraseña.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Restablecer Contraseña"
      description="Ingresa tu nueva contraseña corporativa para restablecer tu acceso."
      footer={
        <div className="flex flex-col gap-4 text-center mt-2 text-xs font-mono">
          <div className="h-px bg-white/[0.06] w-full" />
          <div className="text-zinc-500">
            <Link href="/iniciar-sesion" className="font-bold text-emerald-500 hover:text-emerald-400 transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver al inicio de sesión
            </Link>
          </div>
        </div>
      }
    >
      <AuthSurface className="border-0 bg-transparent p-0 shadow-none dark:bg-transparent">
        {isSuccess ? (
          <div className="space-y-6">
            <AuthAlert
              tone="success"
              title="Contraseña actualizada"
              description="Tu contraseña ha sido restablecida. Te redirigiremos al inicio de sesión en unos instantes."
            />
            <Button asChild variant="emerald" className="h-12 w-full rounded-lg font-mono text-sm shadow-none">
              <Link href="/iniciar-sesion">Ir al login ahora</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <AuthAlert tone="error" title="No pudimos actualizar la contraseña" description={error} />
            ) : null}

            <AuthField label="Nueva contraseña" hint="Mínimo 6 caracteres" icon={Lock} required>
              <Input
                type="password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Nueva contraseña"
                className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0"
              />
            </AuthField>

            <AuthField label="Confirmar contraseña" hint="Debe coincidir" icon={Lock} required>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="Repite la contraseña"
                className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0"
              />
            </AuthField>

            <PasswordStrength score={passwordScore} />

            <Button
              type="submit"
              variant="emerald"
              disabled={isLoading || !isValid}
              className="h-12 w-full rounded-lg font-mono font-semibold text-sm shadow-none"
            >
              {isLoading ? 'Actualizando contraseña...' : 'Restablecer contraseña'}
            </Button>
          </form>
        )}
      </AuthSurface>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}
