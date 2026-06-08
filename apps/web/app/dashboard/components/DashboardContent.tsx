"use client";

import React, { useRef, useState } from "react";
import { useDashboardRefresh, useRecentActivity, useDashboardStats } from "../hooks/useDashboardData";
import { useDashboardConfig, DashboardWidget } from "../hooks/useDashboardConfig";
import { DashboardHeader } from "./DashboardHeader";
import { StatCards } from "./StatCards";
import { DashboardOverviewMetrics } from "./DashboardOverviewMetrics";
import { RevenueChart } from "./RevenueChart";
import { QuickActions } from "./QuickActions";
import { RecentActivity, type RecentService } from "./RecentActivity";
import { OperationActionable } from "./OperationActionable";
import { StatCardSkeleton, RevenueChartSkeleton, TableSkeleton, Skeleton, OverviewMetricsSkeleton, ActionableCardsSkeleton } from "./Skeletons";
import { AlertCircle, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDashboardKpis, useDashboardTrends, useDashboardActionable, useDashboardOverview } from "../hooks/useDashboardData";
import { exportMultiToExcel, exportMultiToPDF, type ExportDataset } from "@/lib/utils/export-helper";
import { formatBogotaDate } from "@/utils/date-utils";
import { toast } from "sonner";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface DashboardContentProps {
  enterpriseId?: string;
}

export const DashboardContent = React.memo(function DashboardContent({ enterpriseId }: DashboardContentProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { config, moveWidget, toggleVisibility, isLoaded: configLoaded } = useDashboardConfig();
  const { data: dashboardStats } = useDashboardStats(enterpriseId);

  const { isLoading: kpisLoading, isError: kpisError } = useDashboardKpis(enterpriseId);
  const { isLoading: overviewLoading, isError: overviewError } = useDashboardOverview(enterpriseId);
  const { isLoading: trendsLoading, isError: trendsError } = useDashboardTrends(enterpriseId);
  const { isLoading: actionableLoading, isError: actionableError } = useDashboardActionable(enterpriseId);
  
  const { 
    data: recentServices, 
    isLoading: activityLoading, 
    isError: activityError,
  } = useRecentActivity(enterpriseId);

  const { refreshAll } = useDashboardRefresh(enterpriseId);

  const hasAnyError = kpisError || overviewError || trendsError || actionableError || activityError;

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        reduceMotion: "(prefers-reduced-motion: reduce)",
        allowMotion: "(prefers-reduced-motion: no-preference)",
      },
      (context) => {
        const { reduceMotion } = context.conditions as { reduceMotion?: boolean };
        const scope = containerRef.current;

        if (!scope) return;

        const header = scope.querySelector<HTMLElement>("[data-dashboard-header]");
        const widgets = Array.from(
          scope.querySelectorAll<HTMLElement>("[data-dashboard-widget]"),
        );
        const hiddenPanel = scope.querySelector<HTMLElement>("[data-dashboard-hidden-panel]");
        const staticTargets = [header, ...widgets, hiddenPanel].filter(
          (target): target is HTMLElement => Boolean(target),
        );

        if (reduceMotion) {
          if (staticTargets.length > 0) {
            gsap.set(staticTargets, {
              opacity: 1,
              y: 0,
              clearProps: "transform",
            });
          }
          return;
        }

        const timeline = gsap.timeline({ defaults: { ease: "power2.out" } });

        if (header) {
          timeline.from(header, {
            opacity: 0,
            y: 18,
            duration: 0.45,
          });
        }

        if (widgets.length > 0) {
          timeline.from(
            widgets,
            {
              opacity: 0,
              y: 22,
              duration: 0.55,
              stagger: 0.08,
            },
            header ? "-=0.15" : 0,
          );
        }

        if (hiddenPanel) {
          timeline.from(
            hiddenPanel,
            {
              opacity: 0,
              y: 16,
              duration: 0.4,
            },
            widgets.length > 0 || header ? "-=0.2" : 0,
          );
        }
      },
    );

    return () => mm.revert();
  }, { scope: containerRef, dependencies: [configLoaded, config.widgets.length, config.hidden.length], revertOnUpdate: true });

  const handleExport = async (formatType: "excel" | "pdf") => {
    if (!dashboardStats) {
      toast.error("Aún no hay datos cargados para exportar el reporte.");
      return;
    }

    const currency = (value: number) =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(value);

    const percent = (value: number) => `${value.toFixed(1)}%`;

    const kpisDataset: ExportDataset = {
      title: "Indicadores Críticos",
      sheetName: "KPIs",
      headers: ["INDICADOR", "VALOR ACTUAL", "VALOR ANTERIOR", "VARIACIÓN"],
      data: [
        ["Ingresos Mes", currency(dashboardStats.kpis.ingresos.current), currency(dashboardStats.kpis.ingresos.previous), `${dashboardStats.kpis.ingresos.change}%`],
        ["Órdenes Activas", dashboardStats.kpis.ordenes.current, dashboardStats.kpis.ordenes.previous, `${dashboardStats.kpis.ordenes.change}%`],
        ["SLA Cumplimiento", percent(dashboardStats.kpis.sla.value), "—", "Global"],
        ["Cobranza Pendiente", currency(dashboardStats.kpis.cobranza.total), "—", "Cartera"],
      ],
    };

    const todayDataset: ExportDataset = {
      title: "Resumen Diario",
      sheetName: "Resumen Diario",
      headers: ["MÉTRICA", "VALOR"],
      data: [
        ["Servicios Agendados", dashboardStats.overview.today.serviciosAgendados],
        ["En Proceso", dashboardStats.overview.today.enProceso],
        ["Realizados", dashboardStats.overview.today.realizados],
        ["Ingresos Hoy", currency(dashboardStats.overview.today.ingresos)],
        ["Pendientes Liquidar", dashboardStats.overview.today.pendientesLiquidar],
        ["Cancelados", dashboardStats.overview.today.cancelados],
        ["Tasa Cancelación", percent(dashboardStats.overview.today.tasaCancelacion)],
        ["Sin Cobrar", dashboardStats.overview.today.sinCobrar],
      ],
    };

    const globalDataset: ExportDataset = {
      title: "Métricas Globales",
      sheetName: "Global",
      headers: ["MÉTRICA", "VALOR"],
      data: [
        ["Servicios Totales", dashboardStats.overview.global.serviciosTotales],
        ["En Proceso", dashboardStats.overview.global.enProceso],
        ["Pendientes Liquidar", dashboardStats.overview.global.pendientesLiquidar],
        ["Ingresos Totales", currency(dashboardStats.overview.global.ingresosTotales)],
        ["Realizados", dashboardStats.overview.global.realizadosHistorico],
        ["Sin Cobrar", dashboardStats.overview.global.sinCobrarTotales],
        ["Cancelados", dashboardStats.overview.global.cancelados],
        ["Tasa de Cancelación", percent(dashboardStats.overview.global.tasaCancelacion)],
      ],
    };

    const trendsDataset: ExportDataset = {
      title: "Tendencias y Comparativos",
      sheetName: "Tendencias",
      headers: ["TIPO", "ETIQUETA", "VALOR"],
      data: [
        ...dashboardStats.trends.ingresosSemanales.map((amount, index) => [
          "Tendencia semanal",
          ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][index] ?? `Día ${index + 1}`,
          currency(amount),
        ]),
        ...dashboardStats.trends.monthlyComparison.map((item) => [
          "Comparativo mensual",
          item.label,
          currency(item.value),
        ]),
      ],
    };

    const actionableDataset: ExportDataset = {
      title: "Pendientes de Atención",
      sheetName: "Accionables",
      headers: ["MÉTRICA", "VALOR"],
      data: [
        ["Servicios Vencidos", dashboardStats.actionable.vencidas],
        ["Órdenes Sin Asignación", dashboardStats.actionable.sinAsignacion],
        ["Alertas Operativas", dashboardStats.actionable.alertas],
      ],
    };

    const recentActivityDataset: ExportDataset = {
      title: "Actividad Reciente",
      sheetName: "Actividad",
      headers: ["SERVICIO", "CLIENTE", "TÉCNICO", "FECHA", "MONTO", "ESTADO"],
      data: ((recentServices as RecentService[]) || []).map((service) => [
        service.servicioEspecifico || service.servicio?.nombre || "Servicio General",
        service.cliente?.razonSocial || service.cliente?.nombre || "N/A",
        service.tecnico?.user?.nombre
          ? `${service.tecnico.user.nombre} ${service.tecnico.user.apellido || ""}`.trim()
          : service.tecnico?.nombre || "Sin asignar",
        service.fechaVisita ? formatBogotaDate(service.fechaVisita) : "Pendiente",
        currency(service.valorCotizado || 0),
        service.estadoServicio,
      ]),
    };

    const exportOptions = {
      datasets: [
        kpisDataset,
        todayDataset,
        globalDataset,
        trendsDataset,
        actionableDataset,
        recentActivityDataset,
      ],
      filename: `dashboard_reporte_${new Date().getTime()}`,
      mainTitle: "REPORTE EJECUTIVO DEL DASHBOARD",
    };

    toast.info(`Generando reporte en formato ${formatType.toUpperCase()}...`);

    try {
      if (formatType === "excel") await exportMultiToExcel(exportOptions);
      else exportMultiToPDF(exportOptions);
      toast.success(`${formatType.toUpperCase()} generado exitosamente`);
    } catch (error) {
      console.error("Dashboard export error:", error);
      toast.error(`Error al generar el reporte ${formatType.toUpperCase()}`);
    }
  };

  if (hasAnyError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="flex items-center gap-3 text-destructive">
          <AlertCircle className="h-8 w-8" />
          <h2 className="text-2xl font-black uppercase tracking-tight">Error de carga</h2>
        </div>
        <p className="text-muted-foreground font-medium text-center max-w-md">
          No pudimos sincronizar los datos del dashboard. Por favor, verifica tu conexión e intenta de nuevo.
        </p>
        <Button 
          onClick={() => refreshAll()} 
          variant="outline" 
          className="rounded-2xl border-border bg-card font-black uppercase tracking-widest text-foreground hover:bg-muted"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  const renderWidget = (id: DashboardWidget) => {
    const commonProps = {
      isConfiguring,
      onMoveUp: () => moveWidget(id, "up"),
      onMoveDown: () => moveWidget(id, "down"),
      onHide: () => toggleVisibility(id),
    };

    switch (id) {
      case "kpis":
        return kpisLoading ? (
          <div key={id} data-dashboard-widget className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
            </div>
          </div>
        ) : (
          <div key={id} data-dashboard-widget>
            <StatCards enterpriseId={enterpriseId} {...commonProps} />
          </div>
        );

      case "overview":
        return overviewLoading ? (
          <div key={id} data-dashboard-widget>
            <OverviewMetricsSkeleton />
          </div>
        ) : (
          <div key={id} data-dashboard-widget>
            <DashboardOverviewMetrics enterpriseId={enterpriseId} {...commonProps} />
          </div>
        );
      
      case "trends":
        return (
          <div key={id} data-dashboard-widget className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            <div className="lg:col-span-3">
              {trendsLoading ? (
                <RevenueChartSkeleton />
              ) : (
                <RevenueChart enterpriseId={enterpriseId} {...commonProps} />
              )}
            </div>
            {!isConfiguring && (
              <div className="lg:col-span-1 pt-12">
                <QuickActions />
              </div>
            )}
          </div>
        );

      case "actionable":
        return actionableLoading ? (
          <div key={id} data-dashboard-widget>
            <ActionableCardsSkeleton />
          </div>
        ) : (
          <div key={id} data-dashboard-widget>
            <OperationActionable enterpriseId={enterpriseId} {...commonProps} />
          </div>
        );

      case "recent":
        return activityLoading ? (
          <div key={id} data-dashboard-widget><TableSkeleton /></div>
        ) : (
          <div key={id} data-dashboard-widget>
            <RecentActivity 
              recentServices={(recentServices as unknown as RecentService[]) || []} 
              loading={false} 
              refreshData={() => refreshAll()} 
              {...commonProps}
            />
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="mx-auto max-w-7xl space-y-12 pb-20">
      <DashboardHeader 
        isConfiguring={isConfiguring} 
        onToggleConfig={() => setIsConfiguring(!isConfiguring)} 
        onExport={handleExport}
      />
      
      {configLoaded && config.widgets.map(renderWidget)}

      {isConfiguring && config.hidden.length > 0 && (
        <div data-dashboard-hidden-panel className="mt-12 rounded-3xl border-2 border-dashed border-muted bg-muted/5 p-8">
          <h4 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-6 flex items-center gap-2">
            <Eye className="h-4 w-4" /> Widgets Ocultos
          </h4>
          <div className="flex flex-wrap gap-4">
            {config.hidden.map(id => (
              <Button 
                key={id} 
                variant="outline" 
                size="sm" 
                onClick={() => toggleVisibility(id)}
                className="rounded-xl border-border bg-card font-bold text-xs"
              >
                Mostrar {id.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
