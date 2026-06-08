'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Lock, Mail, Phone, UserRound } from 'lucide-react';
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

export default function RegisterPage() {
  const [formData, setFormData] = React.useState({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    telefono: '',
    tipoDocumento: '',
    numeroDocumento: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [step, setStep] = React.useState<1 | 2>(1);
  const [stepError, setStepError] = React.useState<string | null>(null);

  const passwordScore = React.useMemo(() => getPasswordScore(formData.password), [formData.password]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
    if (stepError) setStepError(null);
  };

  const isStepOneValid = Boolean(
    formData.nombre.trim() &&
      formData.apellido.trim() &&
      formData.tipoDocumento.trim() &&
      formData.numeroDocumento.trim(),
  );
  const isStepTwoValid = Boolean(formData.email.trim() && formData.password.trim());

  const handleNextStep = () => {
    if (!isStepOneValid) {
      setStepError('Completa nombre, apellido y documento para continuar.');
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isStepTwoValid) {
      setStepError('Completa correo y contraseña para crear tu cuenta.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authClient.register(formData);
      setSuccess(true);
    } catch (submitError) {
      setError(getAuthErrorMessage(submitError, 'No pudimos crear tu cuenta por ahora.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Crear tu Cuenta"
      description="Configura el acceso inicial para administrar tus operaciones en campo."
      footer={
        <div className="flex flex-col gap-4 text-center mt-2 text-xs font-mono">
          <div className="h-px bg-white/[0.06] w-full" />
          <div className="text-zinc-500">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/iniciar-sesion" className="font-bold text-emerald-500 hover:text-emerald-400 transition-colors">
              Inicia sesión
            </Link>
          </div>
        </div>
      }
    >
      <AuthSurface className="border-0 bg-transparent p-0 shadow-none dark:bg-transparent">
        {success ? (
          <div className="space-y-6">
            <AuthAlert
              tone="success"
              title="Cuenta creada con éxito"
              description="Ya puedes acceder con tus credenciales y comenzar a configurar tu operación en la consola."
            />
            <Button asChild className="h-12 w-full rounded-lg bg-emerald-600 text-white font-mono hover:bg-emerald-500 active:translate-y-[1px] cursor-pointer">
              <Link href="/iniciar-sesion">
                Entrar ahora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-wider text-emerald-500">
                <span>Paso {step} de 2</span>
                <span className="text-zinc-500">{step === 1 ? 'Identidad' : 'Credenciales'}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div className={`h-full bg-emerald-600 transition-all duration-500 ${step === 1 ? 'w-1/2' : 'w-full'}`} />
              </div>
            </div>

            {error || stepError ? (
              <AuthAlert tone="error" title="Revisa la información" description={error ?? stepError ?? undefined} />
            ) : null}

            {step === 1 ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <AuthField label="Nombre" icon={UserRound} required>
                    <Input name="nombre" value={formData.nombre} onChange={handleChange} placeholder="María" className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0" required />
                  </AuthField>
                  <AuthField label="Apellido" icon={UserRound} required>
                    <Input name="apellido" value={formData.apellido} onChange={handleChange} placeholder="Gómez" className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0" required />
                  </AuthField>
                </div>

                {/* Unified Document Field: Selector + Input */}
                <AuthField label="Documento" required>
                  <div className="flex h-12 rounded-lg border border-white/[0.06] bg-[#101012] overflow-hidden focus-within:ring-1 focus-within:ring-emerald-600 focus-within:border-emerald-600 transition-all">
                    <select
                      name="tipoDocumento"
                      value={formData.tipoDocumento}
                      onChange={handleChange}
                      className="h-full w-24 bg-transparent px-3 text-xs text-white focus:outline-none border-r border-white/[0.06] cursor-pointer"
                      required
                    >
                      <option value="" className="bg-[#121214] text-zinc-500">Doc...</option>
                      <option value="CC" className="bg-[#121214] text-white">C.C.</option>
                      <option value="CE" className="bg-[#121214] text-white">C.E.</option>
                      <option value="NIT" className="bg-[#121214] text-white">NIT</option>
                      <option value="PASAPORTE" className="bg-[#121214] text-white">Pasaporte</option>
                    </select>
                    <input
                      name="numeroDocumento"
                      type="text"
                      value={formData.numeroDocumento}
                      onChange={handleChange}
                      placeholder="Número de documento"
                      className="h-full flex-1 bg-transparent px-4 text-sm text-white placeholder:text-zinc-700 focus:outline-none"
                      required
                    />
                  </div>
                </AuthField>

                <AuthField label="Teléfono (Opcional)" icon={Phone}>
                  <Input name="telefono" value={formData.telefono} onChange={handleChange} placeholder="+57 300 000 0000" className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0" />
                </AuthField>
              </div>
            ) : (
              <div className="space-y-5">
                <AuthField label="Correo corporativo" icon={Mail} required>
                  <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="equipo@empresa.com" className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0" required />
                </AuthField>
                <AuthField label="Contraseña" icon={Lock} required>
                  <Input name="password" type="password" value={formData.password} onChange={handleChange} placeholder="Crea una contraseña" className="h-12 rounded-lg border-white/[0.06] bg-[#101012] pl-11 text-white placeholder:text-zinc-700 focus-visible:border-emerald-600 focus-visible:bg-[#101012] focus-visible:ring-1 focus-visible:ring-emerald-600 focus-visible:ring-offset-0" required />
                </AuthField>
                <PasswordStrength score={passwordScore} />
              </div>
            )}

            <div className="flex gap-3">
              {step === 2 && (
                <Button type="button" variant="outline" className="h-12 flex-1 rounded-lg border border-white/[0.06] text-zinc-300 bg-white/[0.02] hover:bg-white/[0.04] hover:text-white transition-all cursor-pointer font-mono text-sm shadow-none" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Button>
              )}

              {step === 1 ? (
                <Button type="button" variant="emerald" disabled={!isStepOneValid} className="h-12 flex-1 rounded-lg font-mono text-sm shadow-none" onClick={handleNextStep}>
                  Continuar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" variant="emerald" disabled={loading || !isStepTwoValid} className="h-12 flex-1 rounded-lg font-mono text-sm shadow-none">
                  {loading ? 'Registrando...' : 'Crear cuenta'}
                </Button>
              )}
            </div>
          </form>
        )}
      </AuthSurface>
    </AuthShell>
  );
}
