"use client";

import React from "react";
import { AlertTriangle, Info, Bell, ShieldAlert } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { MonitoringAlert } from "../types";

interface MonitoringAlertsProps {
  alerts: MonitoringAlert[];
}

export function MonitoringAlerts({ alerts }: MonitoringAlertsProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-700">
      <div className="flex items-center gap-2 mb-2">
        <Bell className="h-4 w-4 text-accent" />
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Alertas Operativas</h2>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-white shadow-sm">
          {alerts.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={cn(
              "group relative overflow-hidden flex items-start gap-4 p-5 rounded-[2rem] border-2 transition-all duration-300 hover:shadow-lg",
              alert.type === 'danger' ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40" : 
              alert.type === 'warning' ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40" :
              "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40"
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110 duration-500",
              alert.type === 'danger' ? "bg-red-500 text-white" : 
              alert.type === 'warning' ? "bg-amber-500 text-white" :
              "bg-blue-500 text-white"
            )}>
              {alert.type === 'danger' ? <ShieldAlert className="h-5 w-5" /> : 
               alert.type === 'warning' ? <AlertTriangle className="h-5 w-5" /> :
               <Info className="h-5 w-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  "text-[8px] font-black uppercase px-1.5 py-0.5 rounded border tracking-tighter",
                  alert.severity === 'alta' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                  alert.severity === 'media' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                  "bg-blue-500/10 text-blue-500 border-blue-500/20"
                )}>
                  Prioridad {alert.severity}
                </span>
              </div>
              <p className="text-[13px] font-black uppercase tracking-tight text-foreground leading-tight">
                {alert.title}
              </p>
            </div>
            
            {/* Background Icon Decoration */}
            <div className="absolute -right-2 -bottom-2 opacity-[0.03] transition-opacity group-hover:opacity-[0.07]">
              {alert.type === 'danger' ? <ShieldAlert className="h-16 w-16" /> : 
               alert.type === 'warning' ? <AlertTriangle className="h-16 w-16" /> :
               <Info className="h-16 w-16" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
