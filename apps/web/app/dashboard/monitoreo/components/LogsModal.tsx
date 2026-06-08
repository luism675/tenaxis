"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Terminal, 
  RefreshCcw, 
  Activity, 
  Clock, 
  Fingerprint, 
  Globe, 
  Cpu,
  Hash,
  ArrowRightCircle
} from "lucide-react";
import { formatDistanceToNow, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { sanitizeString } from "./utils";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { formatBogotaDate, formatBogotaTime } from "@/utils/date-utils";

import { Session, Log } from "../types";

interface LogsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  session: Session | null;
  logs: Log[];
  isLoading: boolean;
}

export function LogsModal({ 
  isOpen, 
  onOpenChange, 
  session, 
  logs, 
  isLoading 
}: LogsModalProps) {
  // Filter logs for this specific session if needed, or show all day's logs but highlight current session
  const sessionLogs = session ? logs.filter(l => l.sesionId === session.id) : logs;
  
  const duration = session 
    ? differenceInMinutes(session.fechaFin ? new Date(session.fechaFin) : new Date(), new Date(session.fechaInicio))
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden rounded-[2.5rem] border-2 border-border bg-card shadow-2xl flex flex-col p-0 gap-0">
        
        {/* Modal Header */}
        <DialogHeader className="flex flex-row items-center justify-between p-8 border-b-2 border-border bg-muted/20 space-y-0">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-[1.25rem] bg-accent/10 flex items-center justify-center text-accent border-2 border-accent/20">
              <Terminal className="h-7 w-7" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-foreground text-left">
                Trazabilidad Técnica
              </DialogTitle>
              {session && (
                <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] text-left flex items-center gap-2 mt-1">
                  <Fingerprint className="h-3 w-3" />
                  ID Sesión: <span className="text-accent font-black">{session.id.split('-')[0]}...</span>
                </DialogDescription>
              )}
            </div>
          </div>
          
          {session && (
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className={cn(
                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                session.fechaFin ? "bg-muted text-muted-foreground border-border" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse"
              )}>
                {session.fechaFin ? "Sesión Finalizada" : "Conexión Activa"}
              </span>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {formatBogotaDate(session.fechaInicio, "es-CO")}
              </p>
            </div>
          )}
        </DialogHeader>

        {/* Technical Metadata Bar */}
        {session && (
          <div className="bg-muted/10 border-b border-border p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Globe className="h-3 w-3" /> Dirección IP
              </p>
              <p className="text-sm font-black text-foreground font-mono">{session.ip}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="h-3 w-3" /> Dispositivo / OS
              </p>
              <p className="text-sm font-black text-foreground uppercase truncate">{session.dispositivo}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Duración Total
              </p>
              <p className="text-sm font-black text-foreground uppercase">{duration} Minutos</p>
            </div>
            <div className="space-y-1 text-right md:text-left">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center md:justify-start justify-end gap-1.5">
                <Hash className="h-3 w-3" /> Eventos
              </p>
              <p className="text-sm font-black text-foreground uppercase">{sessionLogs.length} Registrados</p>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-8 space-y-8 bg-zinc-50/50 dark:bg-transparent">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <RefreshCcw className="h-12 w-12 animate-spin text-accent mb-4" />
              <p className="font-black uppercase tracking-[0.2em] text-[10px] text-muted-foreground">Sincronizando correlación de eventos...</p>
            </div>
          ) : sessionLogs.length > 0 ? (
            <div className="relative space-y-6">
              {/* Vertical Line for Timeline */}
              <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-border/50 hidden sm:block" />
              
              {sessionLogs.map((log, index) => (
                <div key={log.id} className="relative flex flex-col sm:flex-row gap-6 group">
                  {/* Timeline Dot/Icon */}
                  <div className="relative z-10 hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background border-2 border-border group-hover:border-accent transition-colors duration-500">
                    <span className="text-[10px] font-black text-muted-foreground group-hover:text-accent">
                      {sessionLogs.length - index}
                    </span>
                  </div>
                  
                  <div className="flex-1 rounded-[2rem] border border-border/60 bg-card p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:border-accent/20 group-hover:translate-x-1">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-white shadow-sm",
                          log.tipo === 'LOGIN' ? "bg-emerald-500" :
                          log.tipo.includes('FOCO') ? "bg-amber-500" :
                          log.tipo.includes('INACTIVIDAD') ? "bg-red-500" : "bg-blue-500"
                        )}>
                          {sanitizeString(log.tipo).replace(/_/g, ' ')}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase font-mono">
                          {formatBogotaTime(log.createdAt, "es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
                        <Clock className="h-3 w-3" />
                        hace {formatDistanceToNow(new Date(log.createdAt), { locale: es })}
                      </div>
                    </div>

                    <p className="text-sm font-black text-foreground/80 leading-relaxed mb-4 italic">
                      &quot;{log.descripcion || "Evento de sistema registrado automáticamente."}&quot;
                    </p>

                    {log.ruta && (
                      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                        <div className="flex items-center gap-1.5">
                          <ArrowRightCircle className="h-3 w-3 text-accent" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ubicación:</span>
                        </div>
                        <code className="text-[10px] font-bold text-accent break-all">
                          {sanitizeString(log.ruta)}
                        </code>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Activity className="h-16 w-16 text-muted-foreground/10 mb-6" />
              <h4 className="text-lg font-black uppercase tracking-tight text-muted-foreground/40">Sin evidencias registradas</h4>
              <p className="max-w-xs mx-auto text-xs font-bold text-muted-foreground/30 uppercase mt-2">No se han capturado eventos técnicos para esta sesión de trabajo.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-8 border-t-2 border-border bg-muted/20">
          <Button 
            onClick={() => onOpenChange(false)}
            className="w-full h-14 rounded-[1.25rem] font-black uppercase tracking-[0.2em] shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            Finalizar Inspección
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
