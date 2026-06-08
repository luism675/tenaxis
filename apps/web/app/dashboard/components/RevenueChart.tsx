"use client";

import React from "react";
import { Download, Info } from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useDashboardTrends } from "../hooks/useDashboardData";
import { WidgetConfigurator } from "./WidgetConfigurator";

const GlassCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn(
    "relative overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md transition-all duration-300 hover:shadow-md",
    className
  )}>
    {children}
  </div>
);

interface RevenueChartProps {
  enterpriseId?: string;
  isConfiguring?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onHide?: () => void;
}

export const RevenueChart = React.memo(function RevenueChart({ enterpriseId, isConfiguring, onMoveUp, onMoveDown, onHide }: RevenueChartProps) {
  const { data: stats } = useDashboardTrends(enterpriseId);

  const maxWeeklyRevenue = stats?.ingresosSemanales ? Math.max(...stats.ingresosSemanales, 1) : 1;
  const monthlyComp = stats?.monthlyComparison || [];
  const maxMonthly = Math.max(...monthlyComp.map(c => c.value), 1);

  return (
    <section className="relative space-y-6">
      <h3 className="text-xl font-black uppercase tracking-widest text-foreground pl-2 border-l-4 border-[#01ADFB]">
        Tendencias y <span className="text-[#01ADFB]">Comparativos</span>
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Weekly Trend (Large) */}
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground uppercase">Tendencia Semanal</h2>
              <p className="text-sm font-medium text-muted-foreground">Flujo de caja 7 días</p>
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-card px-4 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground shadow-sm border border-border hover:bg-muted hover:text-foreground">
              <Download className="h-4 w-4" />
            </button>
          </div>

          <div className="flex h-48 items-end justify-between gap-4 px-2">
            {(stats?.ingresosSemanales || [0, 0, 0, 0, 0, 0, 0]).map((amount, i) => (
              <div key={i} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-full w-full items-end">
                  <div
                    className={cn(
                      "w-full rounded-2xl transition-all duration-700 ease-out group-hover:brightness-110",
                      amount === maxWeeklyRevenue && amount > 0 ? "bg-[#01ADFB] shadow-[0_0_20px_rgba(1,173,251,0.3)]" : "bg-muted"
                    )}
                    style={{ height: `${(amount / maxWeeklyRevenue) * 100}%`, minHeight: amount > 0 ? '4px' : '2px' }}
                    title={`${["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i]}: $${amount.toLocaleString("es-CO")}`}
                  />
                </div>
                <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
                  {["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"][i]}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Monthly Comparison (Side) */}
        <GlassCard>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-black tracking-tight text-foreground uppercase leading-tight">Crecimiento Mensual</h2>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="space-y-8 mt-10">
            {monthlyComp.map((item, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-foreground">${item.value.toLocaleString()}</span>
                </div>
                <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full transition-all duration-1000",
                      i === 0 ? "bg-slate-400" : "bg-[#01ADFB]"
                    )}
                    style={{ width: `${(item.value / maxMonthly) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
      {isConfiguring && <WidgetConfigurator onMoveUp={onMoveUp} onMoveDown={onMoveDown} onHide={onHide || (() => {})} />}
    </section>
  );
});
