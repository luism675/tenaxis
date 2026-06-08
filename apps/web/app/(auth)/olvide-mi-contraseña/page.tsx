'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail, ShieldAlert } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { authClient } from '@/lib/api/auth-client';
import { AuthShell } from '../_components/auth-shell';
import { getAuthErrorMessage } from '../_components/auth-error';
import { AuthAlert, AuthField, AuthSurface } from '../_components/auth-ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const [resetUrl, setResetUrl] = React.useState<string | null>(null);

  const canSubmit = email.trim() !== '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await authClient.forgotPassword(email);
      setResetUrl(response.resetUrl ?? null);
      setIsSubmitted(true);
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, 'No fue posible enviar el enlace de recuperación.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar Acceso"
      description="Introduce tu correo corporativo para recibir instrucciones de recuperación."
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
        {isSubmitted ? (
          <div className="space-y-6">
            <AuthAlert
              tone="success"
              title="Enlace enviado con éxito"
              description={`Si ${email} está registrado en Tenaxis, recibirás un correo con las instrucciones.`}
            />
            
            {resetUrl && (
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 text-xs text-yellow-400/90 font-mono space-y-2">
                <div className="flex items-center gap-2 font-bold text-yellow-400">
                  <ShieldAlert className="h-4 w-4" />
                  <span>Entorno de Desarrollo:</span>
                </div>
                <p>Usa este enlace directo para restablecer la contraseña sin revisar tu correo simulado:</p>
                <Button asChild variant="outline" className="h-9 w-full rounded-md border-yellow-500/30 text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10 hover:text-yellow-300 font-mono text-xs">
                  <Link href={resetUrl}>Proceder a restablecer</Link>
                </Button>
              </div>
            )}

            <Button asChild variant="outline" className="h-12 w-full rounded-lg border border-white/[0.06] text-zinc-300 bg-white/[0.02] hover:bg-white/[0.04] hover:text-white transition-all cursor-pointer font-mono text-sm shadow-none">
              <Link href="/iniciar-sesion">Ir al inicio de sesión</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <AuthAlert tone="error" title="Revisa la solicitud" description={error} />
            ) : null}

            <AuthField label="Correo corporativo" icon={Mail} required>
              <Input
                type="email"
                required
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0"
                placeholder="equipo@empresa.com"
              />
            </AuthField>

            <Button
              type="submit"
              variant="emerald"
              disabled={isLoading || !canSubmit}
              className="h-12 w-full rounded-lg font-mono font-semibold text-sm shadow-none"
            >
              {isLoading ? 'Enviando enlace...' : 'Enviar enlace seguro'}
            </Button>
          </form>
        )}
      </AuthSurface>
    </AuthShell>
  );
}
