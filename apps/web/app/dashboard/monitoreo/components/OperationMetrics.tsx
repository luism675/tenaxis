"use client";

import React from "react";
import { Clock, TrendingUp, Users, Target, MousePointer2, AlertCircle } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { MonitoringMetrics } from "../types";

interface OperationMetricsProps {
  metrics: MonitoringMetrics;
  contextLabel?: string;
}

export function OperationMetrics({
  metrics,
  contextLabel = "del dia seleccionado",
}: OperationMetricsProps) {
  const cards = [
    {
      title: "Tiempo Activo Promedio",
      value: `${metrics.avgActiveTimeMin} min`,
      sub: `Por usuario ${contextLabel}`,
      icon: Clock,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Inactividad Total",
      value: `${metrics.totalInactivityMin} min`,
      sub: `Acumulado ${contextLabel}`,
      icon: TrendingUp,
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      title: "Reacción Media",
      value: `${metrics.mttfeSec} seg`,
      sub: "Hasta primer evento",
      icon: MousePointer2,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    },
    {
      title: "Base de Usuarios",
      value: metrics.userCount.toString(),
      sub: `Con actividad ${contextLabel}`,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-1000">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-4 w-4 text-accent" />
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Métricas de Productividad</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, i) => (
          <div key={i} className="p-6 rounded-[2.5rem] bg-white dark:bg-zinc-950 border-2 border-border/50 hover:border-accent/30 transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-2.5 rounded-2xl", card.bg, card.color)}>
                <card.icon className="h-5 w-5" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 group-hover:text-accent/60 transition-colors">KPI {i+1}</span>
            </div>
            <div className="space-y-1">
              <h4 className="text-2xl font-black italic tracking-tighter text-foreground">{card.value}</h4>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{card.title}</p>
              <p className="text-[9px] font-medium text-muted-foreground/60 italic leading-none">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Inactivity Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <div className="p-8 rounded-[3rem] bg-zinc-950 border-2 border-zinc-800/50 shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <AlertCircle className="h-32 w-32 text-amber-500" />
          </div>
          
          <div className="relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-white">Ranking de Inactividad</h3>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                  Top 5 usuarios con mayor tiempo inactivo {contextLabel}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full border-2 border-amber-500/20 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-amber-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {metrics.topInactivity.length > 0 ? metrics.topInactivity.map((user, i) => (
                <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-[2rem] hover:border-amber-500/30 transition-all group/item">
                  <div className="flex items-center justify-between mb-4">
                    <span className="h-6 w-6 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-amber-500">#{i+1}</span>
                    <span className="text-[10px] font-black text-zinc-600">{user.minutes}m</span>
                  </div>
                  <p className="text-xs font-black uppercase tracking-tight text-zinc-300 group-hover/item:text-white transition-colors truncate">
                    {user.name}
                  </p>
                  <div className="mt-3 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-500 transition-all duration-1000" 
                      style={{ width: `${Math.max(10, (user.minutes / metrics.topInactivity[0].minutes) * 100)}%` }} 
                    />
                  </div>
                </div>
              )) : (
                <div className="col-span-5 py-8 text-center">
                  <p className="text-xs font-bold text-zinc-600 uppercase tracking-widest italic">
                    No hay datos de inactividad registrados para este corte
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
