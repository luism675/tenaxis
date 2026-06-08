'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  BadgeCheck,
  Gift,
  Loader2,
  Orbit,
  Phone,
  ShieldCheck,
  Ticket,
  UserRound,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import {
  referralsClient,
  type PublicReferralCodeResponse,
} from '@/lib/api/referrals-client';
import { AuthShell } from '../(auth)/_components/auth-shell';
import { AuthAlert, AuthField, AuthSurface } from '../(auth)/_components/auth-ui';

function normalizeReferralCode(value: string | null) {
  return value?.trim().toUpperCase() ?? '';
}

function getReferralTitle(validation: PublicReferralCodeResponse | null) {
  if (!validation?.valid || !validation.referrer) {
    return 'Déjanos tus datos y te contactaremos';
  }

  const fullName = [validation.referrer.nombre, validation.referrer.apellido]
    .filter(Boolean)
    .join(' ');

  return fullName
    ? `Vas referido por ${fullName}`
    : 'Tu referido ya quedó identificado';
}

function ReferralLeadContent() {
  const searchParams = useSearchParams();
  const codeFromQuery = React.useMemo(
    () => normalizeReferralCode(searchParams.get('code')),
    [searchParams],
  );
  const [formData, setFormData] = React.useState({
    code: codeFromQuery,
    nombre: '',
    apellido: '',
    telefono: '',
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [validation, setValidation] =
    React.useState<PublicReferralCodeResponse | null>(null);
  const [validatingCode, setValidatingCode] = React.useState(false);

  React.useEffect(() => {
    setFormData((prev) => {
      if (!codeFromQuery || prev.code === codeFromQuery) {
        return prev;
      }
      return { ...prev, code: codeFromQuery };
    });
  }, [codeFromQuery]);

  React.useEffect(() => {
    const code = normalizeReferralCode(formData.code);

    if (!code) {
      setValidation(null);
      return;
    }

    let cancelled = false;
    setValidatingCode(true);

    referralsClient
      .resolveCode(code)
      .then((response) => {
        if (!cancelled) {
          setValidation(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setValidation({
            valid: false,
            code,
            empresaId: null,
            referrer: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setValidatingCode(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [formData.code]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'code' ? value.toUpperCase() : value,
    }));
    if (error) setError(null);
    if (successMessage) setSuccessMessage(null);
  };

  const isCodeValid = Boolean(validation?.valid);
  const canSubmit = Boolean(
    formData.code.trim() &&
      formData.nombre.trim() &&
      formData.apellido.trim() &&
      formData.telefono.trim() &&
      isCodeValid,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setError(
        !formData.code.trim()
          ? 'Ingresa un código de referido válido para continuar.'
          : 'Completa nombre, apellido y teléfono para registrar el referido.',
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await referralsClient.createLead({
        code: formData.code.trim(),
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        telefono: formData.telefono.trim(),
      });
      setSuccessMessage(result.message);
      setFormData((prev) => ({
        ...prev,
        nombre: '',
        apellido: '',
        telefono: '',
      }));
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No pudimos registrar tu referido por ahora.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      hideHeroOnMobile
      eyebrow="Registro de referidos"
      title="Déjanos tus datos y te contactaremos."
      description="Este enlace sirve para capturar clientes referidos por un operador. No crea usuarios del sistema."
      heroTitle="Un formulario corto, claro y pensado para convertir leads."
      heroDescription="Capturamos nombre, apellido y teléfono del cliente referido, validando el código del operador antes de guardar la información."
      metrics={[
        { icon: Gift, label: 'Código', value: formData.code.trim() ? 'Detectado' : 'Requerido' },
        { icon: Orbit, label: 'Flujo', value: '1 paso' },
        { icon: BadgeCheck, label: 'Destino', value: 'Lead' },
      ]}
      highlights={[
        {
          icon: Ticket,
          title: 'Código validado antes de guardar',
          description:
            'Si el código del operador no es válido, no registramos el lead en el sistema.',
        },
        {
          icon: ShieldCheck,
          title: 'Sin crear usuarios ni credenciales',
          description:
            'Este flujo solo guarda clientes referidos para posterior seguimiento comercial.',
        },
      ]}
      footer={
        <div className="text-sm text-slate-500 dark:text-slate-400">
          ¿Ya eres parte del equipo?
          <Link
            href="/iniciar-sesion"
            className="ml-2 font-bold text-sky-700 transition hover:text-sky-500 dark:text-sky-300"
          >
            Inicia sesión
          </Link>
        </div>
      }
      contentClassName="py-2 lg:py-0"
    >
      <AuthSurface>
        <div className="space-y-6">
          <AuthAlert
            tone={isCodeValid ? 'success' : 'info'}
            title={getReferralTitle(validation)}
            description={
              formData.code.trim()
                ? isCodeValid
                  ? 'El código fue validado. Completa tus datos y registraremos tu referido.'
                  : validatingCode
                    ? 'Estamos validando el código compartido...'
                    : 'El código no es válido o ya no está disponible. Revisa el enlace antes de continuar.'
                : 'Ingresa el código que te compartió el operador para dejar tus datos.'
            }
          />

          {successMessage ? (
            <AuthAlert
              tone="success"
              title="¡Gracias! Tu referido quedó registrado"
              description={successMessage}
            />
          ) : null}

          {error ? (
            <AuthAlert
              tone="error"
              title="Revisa la información"
              description={error}
            />
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <AuthField
              label="Código de referido"
              hint={codeFromQuery ? 'Detectado desde el enlace' : 'Requerido'}
              icon={Ticket}
            >
              <Input
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="ABC12345"
                className="h-14 rounded-[1.25rem] border-slate-200 bg-white pl-11 uppercase tracking-[0.28em] dark:border-slate-800 dark:bg-slate-950/80"
                required
              />
            </AuthField>

            <div className="grid gap-5 sm:grid-cols-2">
              <AuthField label="Nombre" icon={UserRound}>
                <Input
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="María"
                  className="h-14 rounded-[1.25rem] border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950/80"
                  required
                />
              </AuthField>
              <AuthField label="Apellido" icon={UserRound}>
                <Input
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Gómez"
                  className="h-14 rounded-[1.25rem] border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950/80"
                  required
                />
              </AuthField>
              <AuthField
                label="Teléfono"
                hint="Te contactaremos por este medio"
                icon={Phone}
              >
                <Input
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="+57 300 000 0000"
                  className="h-14 rounded-[1.25rem] border-slate-200 bg-white pl-11 dark:border-slate-800 dark:bg-slate-950/80 sm:col-span-2"
                  required
                />
              </AuthField>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={loading || validatingCode || !canSubmit}
              className="h-14 rounded-[1.1rem] bg-[linear-gradient(135deg,#021359,#0f5bd7)] text-white dark:text-white"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando referido...
                </span>
              ) : (
                'Registrar referido'
              )}
            </Button>
          </form>
        </div>
      </AuthSurface>
    </AuthShell>
  );
}

export default function ReferralRegisterPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3f7ff] px-6 text-slate-600 dark:bg-[#020617] dark:text-slate-300">
          Preparando tu enlace de referido...
        </div>
      }
    >
      <ReferralLeadContent />
    </React.Suspense>
  );
}
