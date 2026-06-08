"use client";

import React from "react";
import { Activity, RefreshCcw, ExternalLink, Monitor, Globe } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { GlassCard } from "./utils";
import { cn } from "@/components/ui/utils";
import { formatBogotaTime } from "@/utils/date-utils";

import { Session } from "../types";

interface SessionsTableProps {
  sessions: Session[];
  isLoading: boolean;
  onOpenLogs: (session: Session) => void;
  title?: string;
  description?: string;
}

export function SessionsTable({
  sessions,
  isLoading,
  onOpenLogs,
  title = "Estado de Usuarios del Dia",
  description = "Monitoreo detallado de actividad, sesiones y trazabilidad técnica.",
}: SessionsTableProps) {
  return (
    <GlassCard className="w-full overflow-hidden border-2 border-border/50">
      <div className="pb-8 pt-2 border-b border-border mb-6 px-4">
        <div className="flex items-center gap-3 mb-1">
          <Activity className="h-5 w-5 text-accent" />
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground">{title}</h3>
        </div>
        <p className="text-sm font-medium text-muted-foreground">{description}</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Usuario / Rol</th>
              <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Trazabilidad</th>
              <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Conexión</th>
              <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Estado Actual</th>
              <th className="px-6 py-5 text-left font-black uppercase tracking-widest text-[10px] text-muted-foreground">Último Evento</th>
              <th className="px-6 py-5 text-right font-black uppercase tracking-widest text-[10px] text-muted-foreground">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.isArray(sessions) && sessions.length > 0 ? (
              sessions.map((session) => {
                const lastEvent = session.logs?.[0];
                const isActive = !session.fechaFin;
                const isAway = (session.tiempoInactivo || 0) > 0;
                
                return (
                  <tr key={session.id} className="hover:bg-accent/5 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black border border-accent/20">
                          {session.membership?.user?.nombre?.[0] || "?"}
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-black text-foreground uppercase tracking-tight text-sm">
                            {session.membership?.user?.nombre} {session.membership?.user?.apellido}
                          </p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            {session.membership?.role} • @{session.membership?.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-foreground uppercase tracking-tight flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          {session.ip || "0.0.0.0"}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase truncate max-w-[150px] flex items-center gap-1.5">
                          <Monitor className="h-3 w-3" />
                          {session.dispositivo || "Desconocido"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1">
                        <p className="text-[11px] font-black text-foreground uppercase tracking-tight">
                          In: {formatBogotaTime(session.fechaInicio, "es-CO")}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                          Out: {session.fechaFin ? formatBogotaTime(session.fechaFin, "es-CO") : "--:--"}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {isActive ? (
                        <span className={cn(
                          "inline-flex items-center rounded-lg px-3 py-1.5 text-[9px] font-black uppercase tracking-widest border shadow-sm",
                          isAway 
                            ? "bg-amber-500/10 text-amber-500 border-amber-500/20" 
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        )}>
                          {isAway ? `Inactivo (${session.tiempoInactivo}m)` : "Sincronizado"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-lg bg-muted/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground border border-border shadow-sm italic">
                          Desconectado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {lastEvent ? (
                        <div className="space-y-0.5">
                          <p className="text-xs font-black text-foreground tracking-tight uppercase">
                            {lastEvent.tipo.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] font-medium text-muted-foreground lowercase italic">
                            hace {formatDistanceToNow(new Date(lastEvent.createdAt), { locale: es })}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest italic">Sin eventos</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button 
                        onClick={() => onOpenLogs(session)}
                        className="inline-flex items-center gap-2 rounded-xl bg-card px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-accent border-2 border-accent/20 shadow-sm hover:bg-accent hover:text-white hover:border-accent transition-all duration-300 active:scale-95"
                      >
                        Auditar
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-24 text-center">
                  {isLoading ? (
                    <RefreshCcw className="h-10 w-10 animate-spin mx-auto text-accent mb-4 opacity-40" />
                  ) : (
                    <Activity className="h-10 w-10 mx-auto text-muted-foreground mb-4 opacity-20" />
                  )}
                  <p className="font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground">
                    {isLoading ? "Extrayendo datos de red..." : "No se detectaron sesiones activas en el perímetro"}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
