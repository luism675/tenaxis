"use client";

import React from "react";
import { AlertTriangle, BadgeDollarSign, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { GlassCard } from "./utils";
import { MonitoringPayrollPreview } from "../types";

interface PayrollPreviewPanelProps {
  preview: MonitoringPayrollPreview;
  isLoading: boolean;
  isRefreshing?: boolean;
  isGenerating: boolean;
  onGenerate: () => void;
  periodLabel?: string;
  canGenerate?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const statusStyles = {
  OK: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  SIN_VALOR_HORA: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  SIN_SESIONES_CERRADAS: "bg-slate-500/10 text-slate-600 border-slate-500/20",
} as const;

const statusLabels = {
  OK: "Listo para generar",
  SIN_VALOR_HORA: "Falta valor por hora",
  SIN_SESIONES_CERRADAS: "Sin sesiones cerradas",
} as const;

export function PayrollPreviewPanel({
  preview,
  isLoading,
  isRefreshing = false,
  isGenerating,
  onGenerate,
  periodLabel = "del dia",
  canGenerate = true,
}: PayrollPreviewPanelProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#01ADFB]">
            {`Pre-Nomina ${periodLabel}`}
          </p>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Pago estimado por horas netas trabajadas
          </h2>
          <p className="text-sm font-medium text-muted-foreground">
            El sistema descuenta inactividad y solo habilita generacion para quienes
            ya tienen valor por hora configurado.
          </p>
        </div>

        <button
          onClick={onGenerate}
          disabled={
            isGenerating || isLoading || preview.summary.elegibles === 0 || !canGenerate
          }
          className="flex h-12 items-center justify-center gap-3 rounded-2xl bg-[#01ADFB] px-6 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-[#01ADFB]/20 transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeDollarSign className="h-4 w-4" />}
          {canGenerate ? "Generar Nomina" : "Disponible solo en vista diaria"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <GlassCard>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Colaboradores</p>
          <p className="mt-3 text-3xl font-black text-foreground">{preview.summary.totalPersonas}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Elegibles</p>
          <p className="mt-3 text-3xl font-black text-emerald-600">{preview.summary.elegibles}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Horas Pagables</p>
          <p className="mt-3 text-3xl font-black text-foreground">{preview.summary.horasPagables}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total Estimado</p>
          <p className="mt-3 text-3xl font-black text-foreground">{currencyFormatter.format(preview.summary.totalEstimado)}</p>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden p-0">
        {isLoading || isRefreshing ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#01ADFB]" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Calculando pre-nomina
            </span>
          </div>
        ) : preview.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
            <Clock3 className="h-10 w-10 text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-foreground">
                No hay sesiones para este corte
              </p>
              <p className="text-sm font-medium text-muted-foreground">
                Cambia la fecha o espera nuevos cierres de sesion para obtener la pre-nomina.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left">
              <thead className="bg-muted/40">
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Colaborador</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Rol</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Valor Hora</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Horas Netas</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Inactividad</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-right">Pago</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.items.map((item) => (
                  <tr key={`${item.membershipId}-${item.empresaId}`} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-black uppercase text-foreground">
                          {item.nombre} {item.apellido}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                          {item.sesionesCerradas} cerradas / {item.sesionesAbiertas} abiertas
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[11px] font-black uppercase text-muted-foreground">{item.role}</td>
                    <td className="px-6 py-4 text-right text-sm font-black text-foreground">
                      {item.valorHora === null ? "Sin configurar" : currencyFormatter.format(item.valorHora)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-black text-foreground">
                      {item.horasPagables.toFixed(2)} h
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-bold text-muted-foreground">
                      {item.minutosInactivos} min
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-black text-foreground">
                      {currencyFormatter.format(item.pagoEstimado)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.15em]",
                          statusStyles[item.estado],
                        )}
                      >
                        {item.estado === "OK" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {statusLabels[item.estado]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </section>
  );
}
