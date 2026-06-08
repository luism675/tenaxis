"use client";

import React from "react";
import { 
  Calendar, Activity, CheckCircle2, TrendingUp, Clock, XCircle, Percent, AlertTriangle,
  Layers, ClipboardCheck, History, Briefcase, BarChart3, CreditCard, FileX, PieChart,
  Zap, Shield, Info
} from "lucide-react";
import { useDashboardOverview } from "../hooks/useDashboardData";
import { cn } from "@/components/ui/utils";
import { WidgetConfigurator } from "./WidgetConfigurator";

interface DashboardOverviewMetricsProps {
  enterpriseId?: string;
  isConfiguring?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onHide?: () => void;
}

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function formatValue(value: number, kind: "number" | "currency" | "percent") {
  if (kind === "currency") return currencyFormatter.format(value);
  if (kind === "percent") return `${value.toFixed(1)}%`;
  return value.toLocaleString("es-CO");
}

type Category = "alert" | "performance" | "pending" | "success";

export const DashboardOverviewMetrics = React.memo(function DashboardOverviewMetrics({
  enterpriseId,
  isConfiguring,
  onMoveUp,
  onMoveDown,
  onHide,
}: DashboardOverviewMetricsProps) {
  const { data } = useDashboardOverview(enterpriseId);

  const categories: Record<Category, { bg: string; iconBg: string; text: string; label: string; icon: React.ElementType }> = {
    alert: { bg: "bg-red-500/10", iconBg: "bg-red-500", text: "text-red-600", label: "Alerta", icon: Zap },
    performance: { bg: "bg-orange-500/10", iconBg: "bg-orange-500", text: "text-orange-600", label: "Métrica", icon: TrendingUp },
    pending: { bg: "bg-blue-500/10", iconBg: "bg-[#01ADFB]", text: "text-[#01ADFB]", label: "Pendiente", icon: Clock },
    success: { bg: "bg-emerald-500/10", iconBg: "bg-emerald-500", text: "text-emerald-600", label: "Completado", icon: Shield },
  };

  const todayItems = [
    { label: "Servicios Agendados", value: data?.today.serviciosAgendados ?? 0, kind: "number" as const, category: "pending" as Category, icon: Calendar, big: true },
    { label: "En Proceso", value: data?.today.enProceso ?? 0, kind: "number" as const, category: "performance" as Category, icon: Activity },
    { label: "Realizados", value: data?.today.realizados ?? 0, kind: "number" as const, category: "success" as Category, icon: CheckCircle2 },
    { label: "Ingresos Hoy", value: data?.today.ingresos ?? 0, kind: "currency" as const, category: "performance" as Category, icon: TrendingUp, big: true },
    { label: "Pendientes Liquidar", value: data?.today.pendientesLiquidar ?? 0, kind: "number" as const, category: "pending" as Category, icon: Clock },
    { label: "Cancelados", value: data?.today.cancelados ?? 0, kind: "number" as const, category: "alert" as Category, icon: XCircle },
    { label: "Tasa Cancelación", value: data?.today.tasaCancelacion ?? 0, kind: "percent" as const, category: "alert" as Category, icon: Percent },
    { label: "Sin Cobrar", value: data?.today.sinCobrar ?? 0, kind: "number" as const, category: "alert" as Category, icon: AlertTriangle },
  ];

  const globalItems = [
    { label: "Servicios Totales", value: data?.global.serviciosTotales ?? 0, kind: "number" as const, category: "pending" as Category, icon: Briefcase, big: true },
    { label: "En Proceso", value: data?.global.enProceso ?? 0, kind: "number" as const, category: "performance" as Category, icon: Layers },
    { label: "Pendientes Liquidar", value: data?.global.pendientesLiquidar ?? 0, kind: "number" as const, category: "pending" as Category, icon: ClipboardCheck },
    { label: "Ingresos Totales", value: data?.global.ingresosTotales ?? 0, kind: "currency" as const, category: "performance" as Category, icon: BarChart3, big: true },
    { label: "Realizados", value: data?.global.realizadosHistorico ?? 0, kind: "number" as const, category: "success" as Category, icon: History },
    { label: "Sin Cobrar", value: data?.global.sinCobrarTotales ?? 0, kind: "number" as const, category: "alert" as Category, icon: CreditCard },
    { label: "Cancelados", value: data?.global.cancelados ?? 0, kind: "number" as const, category: "alert" as Category, icon: FileX },
    { label: "Tasa de Cancelación", value: data?.global.tasaCancelacion ?? 0, kind: "percent" as const, category: "alert" as Category, icon: PieChart },
  ];

  const dailyBentoSpans = [
    "md:col-span-3 md:row-span-2",
    "md:col-span-2 md:row-span-1",
    "md:col-span-1 md:row-span-1",
    "md:col-span-3 md:row-span-2",
    "md:col-span-2 md:row-span-1",
    "md:col-span-1 md:row-span-1",
    "md:col-span-3 md:row-span-1",
    "md:col-span-3 md:row-span-1",
  ];
  const globalBentoSpans = [
    "md:col-span-3 md:row-span-2",
    "md:col-span-2 md:row-span-1",
    "md:col-span-1 md:row-span-1",
    "md:col-span-3 md:row-span-2",
    "md:col-span-2 md:row-span-1",
    "md:col-span-1 md:row-span-1",
    "md:col-span-3 md:row-span-1",
    "md:col-span-3 md:row-span-1",
  ];

  const MetricItem = ({
    item,
    className,
  }: {
    item: typeof todayItems[0];
    className?: string;
  }) => {
    const cat = categories[item.category];
    return (
      <div className={cn(
        "group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/10 p-6 transition-all duration-500 hover:scale-[1.02]",
        cat.bg, "backdrop-blur-3xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]",
        item.big ? "md:col-span-2" : "md:col-span-1",
        className
      )}>
        <div className="flex items-center justify-between">
          <div className={cn("flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-transform duration-500 group-hover:rotate-12", cat.iconBg)}>
            <item.icon className="h-6 w-6" />
          </div>
          <span className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-widest bg-white/20", cat.text)}>
            <cat.icon className="h-3 w-3" /> {cat.label}
          </span>
        </div>
        
        <div className="mt-6 min-w-0">
          <p className="mb-2 break-words pr-6 text-[10px] font-semibold uppercase leading-tight tracking-[0.2em] text-muted-foreground/60">
            {item.label}
          </p>
          <h4 className={cn(
            "break-words font-bold leading-tight tracking-tight text-foreground",
            item.big ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
          )}>
            {formatValue(item.value, item.kind)}
          </h4>
        </div>
        
        <div className="absolute bottom-4 right-8 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
           <Info className="h-4 w-4 text-muted-foreground/40" />
        </div>
      </div>
    );
  };

  return (
    <section className="relative space-y-12">
      <div className="space-y-8">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-2xl font-bold uppercase tracking-[0.2em] text-foreground border-l-8 border-[#01ADFB] pl-4">
            Resumen <span className="text-[#01ADFB]">Diario</span>
          </h3>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 px-4 py-2 rounded-full">En Vivo</span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-6 md:auto-rows-[170px]">
          {todayItems.map((item, idx) => (
            <MetricItem key={item.label + idx} item={item} className={dailyBentoSpans[idx]} />
          ))}
        </div>
      </div>

      <div className="space-y-8">
        <h3 className="text-2xl font-bold uppercase tracking-[0.2em] text-foreground border-l-8 border-[#01ADFB] pl-4">
          Métricas <span className="text-[#01ADFB]">Globales</span>
        </h3>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-6 md:auto-rows-[170px]">
          {globalItems.map((item, idx) => (
            <MetricItem key={item.label + idx} item={item} className={globalBentoSpans[idx]} />
          ))}
        </div>
      </div>
      
      {isConfiguring && (
        <WidgetConfigurator onMoveUp={onMoveUp} onMoveDown={onMoveDown} onHide={onHide || (() => {})} />
      )}
    </section>
  );
});
