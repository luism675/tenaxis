"use client";

import React from "react";
import { Briefcase, TrendingUp, ShieldCheck, CreditCard, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useRouter } from "next/navigation";
import { useDashboardKpis } from "../hooks/useDashboardData";
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

const CircularProgress = ({ progress, color, size = 60 }: { progress: number; color: string; size?: number }) => {
  const radius = size * 0.4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="6"
          fill="transparent"
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-foreground">{progress}%</span>
    </div>
  );
};

interface StatCardsProps {
  enterpriseId?: string;
  isConfiguring?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onHide?: () => void;
}

export const StatCards = React.memo(function StatCards({ enterpriseId, isConfiguring, onMoveUp, onMoveDown, onHide }: StatCardsProps) {
  const router = useRouter();
  const { data: stats, isLoading: loading } = useDashboardKpis(enterpriseId);

  const kpis = [
    {
      title: "Ingresos Mes",
      value: `$${stats?.ingresos.current.toLocaleString() || "0"}`,
      change: `${stats?.ingresos.change || 0}%`,
      trend: (stats?.ingresos.change || 0) >= 0 ? "up" : "down",
      icon: TrendingUp,
      color: "#01ADFB",
      progress: 100,
      href: "/dashboard/contabilidad",
      description: "Pagado/conciliado en el mes actual por fecha de visita."
    },
    {
      title: "Órdenes Activas",
      value: stats?.ordenes.current.toString() || "0",
      change: `${stats?.ordenes.change || 0}%`,
      trend: (stats?.ordenes.change || 0) >= 0 ? "up" : "down",
      icon: Briefcase,
      color: "#01ADFB",
      progress: 100,
      href: "/dashboard/servicios",
      description: "Órdenes creadas este mes vs. mes anterior."
    },
    {
      title: "SLA Cumplimiento",
      value: `${stats?.sla.value || 0}%`,
      change: "Global",
      trend: "up",
      icon: ShieldCheck,
      color: (stats?.sla.value || 0) > 90 ? "#10B981" : "#F59E0B",
      progress: stats?.sla.value || 0,
      href: "/dashboard/servicios?estado=LIQUIDADO",
      description: "Liquidado sobre servicios completados del mes."
    },
    {
      title: "Cobranza Pendiente",
      value: `$${stats?.cobranza.total.toLocaleString() || "0"}`,
      change: "Cartera",
      trend: "neutral",
      icon: CreditCard,
      color: "#64748B",
      progress: 100,
      href: "/dashboard/servicios?preset=PAGO_PENDIENTE",
      description: "Monto cotizado con pago pendiente en órdenes finalizadas."
    },
  ];

  return (
    <section className="relative space-y-6">
      <h3 className="text-xl font-bold uppercase tracking-widest text-foreground pl-2 border-l-4 border-[#01ADFB]">
        Indicadores <span className="text-[#01ADFB]">Críticos</span>
      </h3>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((stat) => (
          <GlassCard 
            key={stat.title} 
            className="group"
            onClick={isConfiguring ? undefined : () => router.push(stat.href)}
          >
            <div className="flex items-start justify-between">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg transition-transform group-hover:scale-110",
                stat.title === "Ingresos Mes" && "bg-[#01ADFB]",
                stat.title === "Órdenes Activas" && "bg-primary dark:bg-[#01ADFB]",
                stat.title === "SLA Cumplimiento" && "bg-emerald-500",
                stat.title === "Cobranza Pendiente" && "bg-slate-500"
              )}>
                <stat.icon className="h-6 w-6" />
              </div>
              <CircularProgress progress={stat.progress} color={stat.color} />
            </div>

            <div className="mt-6 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {stat.title}
              </p>
              <h3 className="text-3xl font-bold tracking-tighter text-foreground">
                {loading ? "..." : stat.value}
              </h3>
              <p className="text-[11px] leading-tight text-muted-foreground/90">
                {stat.description}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
              <div className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold",
                stat.trend === "up" ? "bg-emerald-500/10 text-emerald-600" : 
                stat.trend === "down" ? "bg-destructive/10 text-destructive" : 
                "bg-muted text-muted-foreground"
              )}>
                {stat.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : 
                 stat.trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                {stat.change}
              </div>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Detalles</span>
            </div>
          </GlassCard>
        ))}
      </div>
      {isConfiguring && <WidgetConfigurator onMoveUp={onMoveUp} onMoveDown={onMoveDown} onHide={onHide || (() => {})} />}
    </section>
  );
});
