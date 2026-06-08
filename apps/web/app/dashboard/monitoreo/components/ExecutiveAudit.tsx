"use client";

import React from "react";
import { 
  BarChart3, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  PieChart, 
  Users2, 
  CheckCircle2,
  TrendingUp,
  FileJson
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { ExecutiveAuditMetrics } from "../types";

interface ExecutiveAuditProps {
  metrics: ExecutiveAuditMetrics;
  date?: string;
  contextLabel?: string;
  isRange?: boolean;
}

export function ExecutiveAudit({
  metrics,
  date,
  contextLabel = date ? "del día seleccionado" : "de hoy",
  isRange = false,
}: ExecutiveAuditProps) {
  const summaryCards = [
    { label: "Creados", value: metrics.today.created, icon: PlusCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", week: metrics.week.created },
    { label: "Editados", value: metrics.today.updated, icon: Edit3, color: "text-blue-500", bg: "bg-blue-500/10", week: metrics.week.updated },
    { label: "Eliminados", value: metrics.today.deleted, icon: Trash2, color: "text-red-500", bg: "bg-red-500/10", week: metrics.week.deleted },
    { label: isRange ? "Total Periodo" : date ? "Total Día" : "Total Hoy", value: metrics.today.total, icon: BarChart3, color: "text-purple-500", bg: "bg-purple-500/10", week: metrics.week.total },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex items-center gap-2 mb-2">
        <PieChart className="h-4 w-4 text-accent" />
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Auditoría Ejecutiva</h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground">Actividad {contextLabel}</p>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, i) => (
          <div key={i} className="p-6 rounded-[2.5rem] bg-white dark:bg-zinc-950 border-2 border-border/50 hover:border-accent/30 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2.5 rounded-2xl", card.bg, card.color)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">Semana</p>
                <p className="text-xs font-black text-foreground/60">+{card.week}</p>
              </div>
            </div>
            <div className="space-y-1">
              <h4 className="text-3xl font-black italic tracking-tighter text-foreground">{card.value}</h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most Modified Entities */}
        <div className="p-8 rounded-[3rem] bg-white dark:bg-zinc-950 border-2 border-border/50 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tighter text-foreground">Entidades Críticas</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mayor volumen de modificaciones (7d)</p>
            </div>
            <FileJson className="h-6 w-6 text-purple-500 opacity-40" />
          </div>

          <div className="space-y-5">
            {metrics.topEntities.length > 0 ? metrics.topEntities.map((entity, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[11px] font-black uppercase tracking-tight text-foreground">{entity.name}</span>
                  <span className="text-[10px] font-black text-accent bg-accent/10 px-2 py-0.5 rounded-full">{entity.count} cambios</span>
                </div>
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 to-accent transition-all duration-1000 ease-out" 
                    style={{ width: `${(entity.count / metrics.topEntities[0].count) * 100}%` }} 
                  />
                </div>
              </div>
            )) : (
              <p className="text-center py-10 text-xs font-bold text-muted-foreground uppercase tracking-widest italic">No hay datos de entidades aún</p>
            )}
          </div>
        </div>

        {/* Top Active Users */}
        <div className="p-8 rounded-[3rem] bg-zinc-950 border-2 border-zinc-800 shadow-2xl relative overflow-hidden group">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tighter text-white">Usuarios más Activos</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Volumen de transacciones (7d)</p>
            </div>
            <Users2 className="h-6 w-6 text-accent opacity-40" />
          </div>

          <div className="grid gap-4">
            {metrics.topUsers.length > 0 ? metrics.topUsers.map((user, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-accent/30 transition-all group/item">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-black text-accent border border-zinc-700">
                    {user.name[0]}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-tight text-zinc-200 group-hover/item:text-white transition-colors">
                      {user.name}
                    </p>
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Operador Sistema</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black italic text-white tracking-tighter">{user.count}</span>
                  <p className="text-[8px] font-black text-zinc-600 uppercase tracking-tighter leading-none">Acciones</p>
                </div>
              </div>
            )) : (
              <p className="text-center py-10 text-xs font-bold text-zinc-600 uppercase tracking-widest italic">No hay actividad de usuarios</p>
            )}
          </div>
        </div>
      </div>

      {/* Success Rate Footer */}
      <div className="flex items-center justify-between p-6 rounded-[2rem] bg-emerald-500/5 border-2 border-emerald-500/20">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase text-foreground">Tasa de Integridad Operativa</h4>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Todas las transacciones auditadas sin errores de secuencia</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 text-3xl font-black italic tracking-tighter text-emerald-500">
            <TrendingUp className="h-6 w-6" />
            {metrics.successRate}%
          </div>
        </div>
      </div>
    </div>
  );
}
