"use client";

import React from "react";
import { Clock, UserX, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useRouter } from "next/navigation";
import { useDashboardActionable } from "../hooks/useDashboardData";
import { WidgetConfigurator } from "./WidgetConfigurator";

const GlassCard = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn(
      "relative overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md",
      onClick && "cursor-pointer hover:border-[#01ADFB]/50 hover:bg-card/60",
      className
    )}
  >
    {children}
  </div>
);

interface OperationActionableProps {
  enterpriseId?: string;
  isConfiguring?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onHide?: () => void;
}

export const OperationActionable = React.memo(function OperationActionable({ enterpriseId, isConfiguring, onMoveUp, onMoveDown, onHide }: OperationActionableProps) {
  const router = useRouter();
  const { data: stats } = useDashboardActionable(enterpriseId);
  
  const alerts = [
    {
      id: "vencidas",
      label: "Tareas Vencidas",
      value: stats?.vencidas || 0,
      description: "Fecha de visita pasada y aún no liquidada/cancelada.",
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
      href: "/dashboard/servicios?estado=PENDIENTE&vencido=true"
    },
    {
      id: "sin-asignacion",
      label: "Sin Asignación",
      value: stats?.sinAsignacion || 0,
      description: "Órdenes nuevas sin técnico asignado.",
      icon: UserX,
      color: "text-[#01ADFB]",
      bgColor: "bg-[#01ADFB]/10",
      href: "/dashboard/servicios?asignado=false"
    },
    {
      id: "alertas",
      label: "Alertas Críticas",
      value: stats?.alertas || 0,
      description: "Urgencia crítica todavía abierta.",
      icon: AlertCircle,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      href: "/dashboard/servicios?urgencia=CRITICA"
    }
  ];

  return (
    <section className="relative space-y-6">
      <h3 className="text-xl font-black uppercase tracking-widest text-foreground pl-2 border-l-4 border-[#01ADFB]">
        Gestión <span className="text-[#01ADFB]">Operativa</span>
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {alerts.map((alert) => (
          <GlassCard 
            key={alert.id} 
            className="group" 
            onClick={isConfiguring ? undefined : () => router.push(alert.href)}
          >
            <div className="flex items-center justify-between">
              <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-110", alert.bgColor, alert.color)}>
                <alert.icon className="h-6 w-6" />
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
            </div>
            
            <div className="mt-6 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-1">
                  {alert.label}
                </p>
                <h4 className={cn("text-3xl font-black tracking-tighter", alert.value > 0 ? alert.color : "text-muted-foreground/30")}>
                  {alert.value}
                </h4>
                <p className="mt-1 text-[11px] leading-tight text-muted-foreground/90">
                  {alert.description}
                </p>
              </div>
              
              <span className={cn(
                "px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                alert.value > 0 ? alert.bgColor + " " + alert.color : "bg-muted text-muted-foreground/40"
              )}>
                {alert.value > 0 ? "Acción Requerida" : "Al Día"}
              </span>
            </div>
          </GlassCard>
        ))}
      </div>
      {isConfiguring && <WidgetConfigurator onMoveUp={onMoveUp} onMoveDown={onMoveDown} onHide={onHide || (() => {})} />}
    </section>
  );
});
