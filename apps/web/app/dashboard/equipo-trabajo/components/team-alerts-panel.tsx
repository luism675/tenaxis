"use client";

import React from "react";
import { AlertTriangle, UserMinus, ShieldAlert, Bell } from "lucide-react";
import { cn } from "@/components/ui/utils";

type Alerts = {
  noActivity: Array<{ membershipId: string; name: string; role: string }>;
  lowEffectiveness: Array<{ membershipId: string; name: string; efectividad: number }>;
  pendingLiquidation: Array<{ membershipId: string; name: string; pendientes: number }>;
};

export function TeamAlertsPanel({ alerts }: { alerts: Alerts }) {
  const totalAlerts = alerts.noActivity.length + alerts.lowEffectiveness.length + alerts.pendingLiquidation.length;

  if (totalAlerts === 0) return null;

  const alertGroups = [
    {
      id: 'no-activity',
      title: "Sin actividad operativa",
      items: alerts.noActivity.slice(0, 3).map(i => ({ name: i.name, meta: i.role })),
      type: 'danger',
      icon: UserMinus,
      priority: 'alta'
    },
    {
      id: 'low-eff',
      title: "Rendimiento crítico",
      items: alerts.lowEffectiveness.slice(0, 3).map(i => ({ name: i.name, meta: `${i.efectividad}%` })),
      type: 'warning',
      icon: AlertTriangle,
      priority: 'media'
    },
    {
      id: 'pending',
      title: "Pendientes por liquidar",
      items: alerts.pendingLiquidation.slice(0, 3).map(i => ({ name: i.name, meta: `${i.pendientes} serv.` })),
      type: 'info',
      icon: ShieldAlert,
      priority: 'media'
    }
  ];

  return (
    <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-left-4 duration-700">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-4 w-4 text-accent" />
        <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-foreground">Alertas de Equipo</h2>
        <span className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-accent text-[10px] font-black text-white shadow-sm">
          {totalAlerts}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {alertGroups.map((group) => (
          group.items.length > 0 && (
            <div
              key={group.id}
              className={cn(
                "group relative overflow-hidden rounded-[5px] border-2 p-6 transition-all duration-300 hover:shadow-lg",
                group.type === 'danger' ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40" :
                group.type === 'warning' ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40" :
                "bg-[#01ADFB]/5 border-[#01ADFB]/20 hover:border-[#01ADFB]/40"
              )}
            >
              <div className="mb-4 flex items-start gap-4">
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-[5px] shadow-sm transition-transform duration-500 group-hover:scale-110",
                  group.type === 'danger' ? "bg-red-500 text-white" :
                  group.type === 'warning' ? "bg-amber-500 text-white" :
                  "bg-[#01ADFB] text-white"
                )}>
                  <group.icon className="h-6 w-6" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cn(
                      "rounded-[4px] border px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter",
                      group.priority === 'alta' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                      "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                      Prioridad {group.priority}
                    </span>
                  </div>
                  <h3 className="text-sm font-black uppercase leading-tight tracking-tight text-foreground">
                    {group.title}
                  </h3>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                {group.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-[5px] border border-border/50 bg-background/40 p-2">
                    <span className="max-w-[120px] truncate text-[11px] font-black uppercase">{item.name}</span>
                    <span className={cn(
                      "rounded-[4px] px-2 py-0.5 text-[10px] font-bold",
                      group.type === 'danger' ? "bg-red-500/10 text-red-500" :
                      group.type === 'warning' ? "bg-amber-500/10 text-amber-500" :
                      "bg-[#01ADFB]/10 text-[#01ADFB]"
                    )}>
                      {item.meta}
                    </span>
                  </div>
                ))}
              </div>

              <div className="absolute -right-4 -bottom-4 opacity-[0.03] transition-opacity group-hover:opacity-[0.07]">
                <group.icon className="h-24 w-24" />
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
