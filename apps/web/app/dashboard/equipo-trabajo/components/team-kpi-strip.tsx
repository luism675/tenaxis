"use client";

import React from "react";
import { TrendingUp, Users, CheckCircle2, DollarSign } from "lucide-react";
import { cn } from "@/components/ui/utils";

type TeamKpis = {
  totalRecaudo: number;
  totalServicios: number;
  serviciosLiquidados: number;
  serviciosPendientes: number;
  efectividadEquipo: number;
  ticketPromedio: number;
  comparison: {
    totalRecaudoChangePct: number;
    serviciosLiquidadosChangePct: number;
    efectividadChangePct: number;
  };
};

const formatCurrency = (value: number) =>
  `$${value.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;

const formatDelta = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;

export function TeamKpiStrip({ kpis }: { kpis: TeamKpis }) {
  const cards = [
    {
      title: "Recaudo total",
      value: formatCurrency(kpis.totalRecaudo),
      trend: formatDelta(kpis.comparison.totalRecaudoChangePct),
      icon: DollarSign,
      color: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
      description: "Crecimiento vs período anterior"
    },
    {
      title: "Efectividad",
      value: `${kpis.efectividadEquipo}%`,
      trend: formatDelta(kpis.comparison.efectividadChangePct),
      icon: TrendingUp,
      color: "border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB]",
      description: "Servicios liquidados vs creados"
    },
    {
      title: "Liquidados",
      value: kpis.serviciosLiquidados.toString(),
      trend: `${kpis.serviciosPendientes} pendientes`,
      icon: CheckCircle2,
      color: "border-amber-500/20 bg-amber-500/10 text-amber-600",
      description: "Meta de cumplimiento diaria"
    },
    {
      title: "Ticket promedio",
      value: formatCurrency(kpis.ticketPromedio),
      trend: `${kpis.totalServicios} servicios`,
      icon: Users,
      color: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300",
      description: "Valor medio por operación"
    },
  ];

  return (
    <div className="shrink-0 overflow-x-auto pb-1">
      <div className="grid min-w-max grid-flow-col auto-cols-[minmax(180px,1fr)] gap-2 lg:min-w-0 lg:grid-flow-row lg:grid-cols-4">
      {cards.map((item, i) => (
        <div 
          key={i}
          className="flex min-h-[74px] items-center gap-3 rounded-[4px] border border-border bg-card p-3 shadow-sm transition-colors hover:bg-muted/40"
        >
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border", item.color)}>
            <item.icon className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {item.title}
            </p>
            <p className="mt-1 truncate text-[17px] font-semibold leading-none tabular-nums text-foreground">
              {item.value}
            </p>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2 border-t border-border/60 pt-2">
              <p className="shrink-0 text-[10px] font-medium uppercase tracking-[0.08em] text-[#01ADFB]">
                {item.trend}
              </p>
              <p className="truncate text-right text-[9px] text-muted-foreground">
              {item.description}
            </p>
            </div>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
