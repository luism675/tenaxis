"use client";

import React from "react";
import { Activity, Zap, CheckCircle2, Server, ChevronRight } from "lucide-react";
import { GlassCard } from "./utils";
import { cn } from "@/components/ui/utils";

import { MonitoringStats } from "../types";

interface KpiCardsProps {
  stats: MonitoringStats;
  latency: number;
  activeTechniciansCount: number;
  onOpenKpi: (type: 'sessions' | 'events' | 'technicians') => void;
  date?: string;
  contextLabel?: string;
}

type KpiId = 'sessions' | 'events' | 'technicians' | 'latency';

export function KpiCards({
  stats,
  latency,
  activeTechniciansCount,
  onOpenKpi,
  date,
  contextLabel = "del dia seleccionado",
}: KpiCardsProps) {
  const kpis: { id: KpiId; title: string; value: string; icon: React.ElementType; trend: string; color: string; interactive: boolean }[] = [
    { 
      id: 'sessions',
      title: "Sesiones Activas", 
      value: stats.activeSessions.toString(), 
      icon: Activity, 
      trend: stats.activeSessions > 0 ? "En línea" : "Sin conexión",
      color: "bg-emerald-500",
      interactive: true
    },
    { 
      id: 'events',
      title: date ? "Eventos del corte" : "Eventos hoy", 
      value: stats.totalEvents.toLocaleString(), 
      icon: Zap, 
      trend: contextLabel,
      color: "bg-amber-500",
      interactive: true
    },
    { 
      id: 'technicians',
      title: "Técnicos Online", 
      value: activeTechniciansCount.toString(), 
      icon: CheckCircle2, 
      trend: "Activos",
      color: "bg-blue-500",
      interactive: true
    },
    { 
      id: 'latency',
      title: "Latencia API", 
      value: `${latency}ms`, 
      icon: Server, 
      trend: latency < 200 ? "Excelente" : "Lento",
      color: "bg-purple-500",
      interactive: false
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 w-full">
      {kpis.map((stat, i) => (
        <GlassCard 
          key={i} 
          className={cn("group transition-all", stat.interactive && "hover:shadow-[#01ADFB]/10")}
          onClick={stat.interactive ? () => onOpenKpi(stat.id as 'sessions' | 'events' | 'technicians') : undefined}
        >
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">{stat.title}</p>
            <div className={cn("p-2 rounded-xl text-white shadow-lg", stat.color)}>
              <stat.icon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-foreground mb-1">{stat.value}</div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-accent uppercase tracking-wider">{stat.trend}</p>
            {stat.interactive && <ChevronRight className="h-3 w-3 text-muted-foreground/40 group-hover:translate-x-1 transition-transform" />}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
