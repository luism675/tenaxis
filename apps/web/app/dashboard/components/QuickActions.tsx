"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/components/ui/utils";

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "relative overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md",
    className
  )}>
    {children}
  </div>
);

export function QuickActions() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <GlassCard className="bg-gradient-to-br from-[#021359] to-[#01ADFB] dark:from-[#021359] dark:to-[#01ADFB]/40 border-none text-white overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="text-xl font-black tracking-tight text-white/90 dark:text-gray-50">Nueva Orden de Servicio</h3>
          <p className="mt-2 text-sm font-medium text-white/80 dark:text-gray-50">Genera una nueva solicitud de mantenimiento rápidamente.</p>
          <button
            onClick={() => router.push('/dashboard/servicios/nuevo')}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black uppercase tracking-widest text-[#021359] shadow-xl transition-transform hover:scale-[1.02] active:scale-95 dark:text-gray-50"
          >
            Comenzar Ahora
            <ArrowUpRight className="h-5 w-5" />
          </button>
        </div>
        <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-[#01ADFB]/30 blur-3xl" />
      </GlassCard>

      <GlassCard>
        <h3 className="text-lg font-black tracking-tight text-foreground">Acciones Recomendadas</h3>
        <div className="mt-6 space-y-3">
          {[
            { label: "Validar Facturas Pendientes", color: "bg-[#01ADFB]", onClick: () => toast.info("Módulo de facturación próximamente") },
            { label: "Actualizar Inventario", color: "bg-primary dark:bg-[#01ADFB]", onClick: () => router.push('/dashboard/insumos') },
            { label: "Revisar Alertas Críticas", color: "bg-muted-foreground", onClick: () => router.push('/dashboard/servicios?urgencia=ALTA') },
          ].map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="flex w-full items-center gap-4 rounded-2xl bg-card p-4 transition-colors hover:bg-muted border border-border"
            >
              <div className={cn("h-2 w-2 rounded-full", action.color)} />
              <span className="text-xs font-bold text-foreground">{action.label}</span>
            </button>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
