"use client";

import React, { useMemo } from "react";
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  Gauge
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { Session } from "../types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface MonitoringHealthProps {
  sessions: Session[];
  latency: number;
  maxLatency: number;
}

export function MonitoringHealth({ sessions, latency, maxLatency }: MonitoringHealthProps) {
  const activeSessions = useMemo(() => sessions.filter(s => !s.fechaFin), [sessions]);
  
  const atRiskSessions = useMemo(() => {
    const now = new Date();
    return activeSessions.filter(s => {
      const lastUpdate = new Date(s.updatedAt);
      const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
      return diffMinutes > 2; // More than 2 minutes without heartbeat
    });
  }, [activeSessions]);

  const status = useMemo(() => {
    if (latency > 1000 || atRiskSessions.length > activeSessions.length / 2) return "CRÍTICO";
    if (latency > 500 || atRiskSessions.length > 0) return "DEGRADADO";
    return "SANO";
  }, [latency, atRiskSessions, activeSessions]);

  const availability = useMemo(() => {
    if (activeSessions.length === 0) return 100;
    const healthySessions = activeSessions.length - atRiskSessions.length;
    const baseScore = (healthySessions / activeSessions.length) * 100;
    
    // Slightly degrade availability metric if latency is high
    const latencyImpact = latency > 500 ? Math.min((latency - 500) / 20, 10) : 0;
    
    return Math.max(0, Math.round((baseScore - latencyImpact) * 10) / 10);
  }, [activeSessions.length, atRiskSessions.length, latency]);

  const statusConfig = {
    "SANO": { color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle2 },
    "DEGRADADO": { color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
    "CRÍTICO": { color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", icon: WifiOff }
  };

  const config = statusConfig[status as keyof typeof statusConfig];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Overall Status Card */}
      <div className={cn(
        "relative overflow-hidden p-6 rounded-[2.5rem] border-2 transition-all duration-500 shadow-sm",
        config.bg, config.border
      )}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={cn("p-3 rounded-2xl shadow-lg", config.color.replace('text', 'bg').replace('/10', ''))}>
              <config.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-70">Estado General</p>
              <h3 className={cn("text-2xl font-black italic tracking-tighter", config.color)}>{status}</h3>
            </div>
          </div>
          <div className="h-12 w-12 rounded-full border-4 border-muted/20 border-t-accent animate-spin" />
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Disponibilidad del Servicio</span>
            <span className={config.color}>{availability}%</span>
          </div>
          <div className="h-2 w-full bg-muted/20 rounded-full overflow-hidden">
            <div className={cn("h-full transition-all duration-1000", config.color.replace('text', 'bg'))} style={{ width: `${availability}%` }} />
          </div>
        </div>
      </div>

      {/* Latency Metrics */}
      <div className="p-6 rounded-[2.5rem] bg-white dark:bg-zinc-950 border-2 border-border/50 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Rendimiento de Red</p>
          <Gauge className="h-4 w-4 text-purple-500" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Promedio</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter text-foreground">{latency}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ms</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Máximo Reciente</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black tracking-tighter text-foreground">{maxLatency}</span>
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">ms</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted/10 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500" style={{ width: `${Math.min((latency / 1000) * 100, 100)}%` }} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            {latency < 200 ? 'Excelente' : latency < 500 ? 'Normal' : 'Lento'}
          </span>
        </div>
      </div>

      {/* Sessions at Risk */}
      <div className="p-6 rounded-[2.5rem] bg-white dark:bg-zinc-950 border-2 border-border/50">
        <div className="flex items-center justify-between mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Salud de Sesiones</p>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            En Riesgo: {atRiskSessions.length}
          </div>
        </div>

        <div className="space-y-4 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
          {atRiskSessions.length > 0 ? atRiskSessions.map(s => (
            <div key={s.id} className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl bg-muted/50 flex items-center justify-center text-xs font-black uppercase text-muted-foreground">
                  {s.membership.user.nombre[0]}
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-tight text-foreground truncate max-w-[120px]">
                    {s.membership.user.nombre}
                  </p>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                    <Clock className="h-2 w-2" />
                    Hace {formatDistanceToNow(new Date(s.updatedAt), { locale: es })}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 uppercase tracking-tighter">SIN HEARTBEAT</span>
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Wifi className="h-8 w-8 text-emerald-500/40 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Todas las sesiones sincronizadas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
