import * as React from "react";
import { AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import { cn } from "@/components/ui/utils";

export function AuthSurface({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "auth-shell__form relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#121214] p-6 shadow-xl dark:border-white/[0.06] dark:bg-[#121214] sm:p-8",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 auth-noise opacity-20 dark:opacity-15" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
      {children}
    </div>
  );
}

export function AuthAlert({
  tone = "error",
  title,
  description,
  className,
}: {
  tone?: "error" | "success" | "info";
  title: string;
  description?: string;
  className?: string;
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  const tones = {
    error:
      "border-rose-200/80 bg-rose-50/90 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
    success:
      "border-emerald-200/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
    info:
      "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 dark:border-emerald-500/20 dark:bg-emerald-500/5 dark:text-emerald-400",
  } as const;

  return (
    <div className={cn("rounded-lg border px-4 py-4", tones[tone], className)}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-white/70 p-1.5 dark:bg-white/8">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold">{title}</p>
          {description ? <p className="text-sm/6 opacity-85">{description}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function AuthField({
  label,
  hint,
  error,
  icon: Icon,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  icon?: LucideIcon;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-[0.68rem] font-black uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
          {label}
          {required && <span className="text-red-500 font-bold ml-1">*</span>}
        </label>
        {hint ? (
          <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>
        ) : null}
      </div>
      <div className="relative">
        {Icon ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 dark:text-slate-500">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
        {children}
      </div>
      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}

export function AuthMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="auth-shell__metric rounded-[1.5rem] border border-white/15 bg-white/10 p-4 backdrop-blur-xl dark:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-white/65">
            {label}
          </p>
          <p className="mt-2 text-xl font-black tracking-[-0.04em] text-white">
            {value}
          </p>
        </div>
        <div className="rounded-full bg-white/12 p-2 text-white shadow-[0_10px_30px_rgba(16,185,129,0.22)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

export function PasswordStrength({ score }: { score: number }) {
  const palette = [
    "bg-rose-400/30",
    "bg-amber-400/60",
    "bg-teal-400/70",
    "bg-emerald-400/80",
  ];

  const label =
    ["Muy baja", "Baja", "Media", "Alta"][Math.max(0, Math.min(score - 1, 3))] ??
    "Sin definir";

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800",
              index < score ? palette[Math.min(score - 1, palette.length - 1)] : undefined,
            )}
          />
        ))}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Seguridad estimada: {label}
      </p>
    </div>
  );
}
