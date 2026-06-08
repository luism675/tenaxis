"use client";

import React from "react";
import { Download, RefreshCcw, Clock, Globe, CloudSync } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { format } from "date-fns";

interface MonitoreoHeaderProps {
  isLoading: boolean;
  onRefresh: () => void;
  lastUpdated?: number;
  onExport: () => void;
}

export function MonitoreoHeader({ isLoading, onRefresh, lastUpdated, onExport }: MonitoreoHeaderProps) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between border-b border-border pb-10">
      <div className="space-y-3">
        <h1 className="text-4xl font-black tracking-tight text-foreground lg:text-6xl">
          Monitoreo <span className="text-[#01ADFB] italic">Sistema</span>
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-muted-foreground uppercase tracking-widest">
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
            <Clock className="h-3.5 w-3.5 text-accent" />
            <span>
              {lastUpdated ? `Sincronizado: ${format(lastUpdated, "HH:mm:ss")}` : "Sincronizando..."}
            </span>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full border border-border">
            <Globe className="h-3.5 w-3.5 text-accent" />
            <span>Zona: {timezone}</span>
          </div>
          <div className="flex items-center gap-2">
            <CloudSync className={cn("h-4 w-4", isLoading ? "text-amber-500 animate-pulse" : "text-emerald-500")} />
            <span className={cn(isLoading ? "text-amber-500" : "text-emerald-500")}>
              {isLoading ? "Actualizando..." : "Datos al día"}
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={onExport}
          className="group flex h-14 items-center gap-3 rounded-[1.25rem] bg-card px-8 text-xs font-black uppercase tracking-[0.2em] text-muted-foreground shadow-sm border-2 border-border transition-all hover:bg-accent/5 hover:text-accent hover:border-accent/20 active:scale-95"
        >
          <Download className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" />
          Exportar
        </button>
        <button 
          onClick={onRefresh}
          className="group flex h-14 items-center gap-3 rounded-[1.25rem] bg-[#01ADFB] px-8 text-xs font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-[#01ADFB]/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          disabled={isLoading}
        >
          <RefreshCcw className={cn("h-4 w-4 transition-transform group-hover:rotate-180 duration-500", isLoading && "animate-spin")} />
          Refrescar
        </button>
      </div>
    </div>
  );
}
