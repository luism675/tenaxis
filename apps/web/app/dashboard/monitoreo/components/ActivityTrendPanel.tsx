"use client";

import React, { useMemo } from "react";
import { CalendarRange, BarChart3, TrendingUp, Users, TimerReset } from "lucide-react";

import { cn } from "@/components/ui/utils";
import { GlassCard } from "./utils";
import {
  ActivityTrendMode,
  ActivityTrendPoint,
} from "../hooks/use-monitoring-activity-trend";

interface ActivityTrendPanelProps {
  mode: ActivityTrendMode;
  onModeChange: (mode: ActivityTrendMode) => void;
  points: ActivityTrendPoint[];
  isLoading: boolean;
  isRefreshing?: boolean;
}

const modeOptions: { value: ActivityTrendMode; label: string; helper: string }[] = [
  { value: "dias", label: "Dias", helper: "Ultimos 7 cortes diarios" },
  { value: "semanas", label: "Semanas", helper: "Ultimas 6 semanas" },
  { value: "meses", label: "Meses", helper: "Ultimos 6 meses" },
];

export function ActivityTrendPanel({
  mode,
  onModeChange,
  points,
  isLoading,
  isRefreshing = false,
}: ActivityTrendPanelProps) {
  const summary = useMemo(() => {
    const totalEvents = points.reduce((sum, point) => sum + point.totalEvents, 0);
    const totalInactivity = points.reduce((sum, point) => sum + point.totalInactivity, 0);
    const avgActiveSessions = points.length
      ? Math.round(
          points.reduce((sum, point) => sum + point.activeSessions, 0) / points.length,
        )
      : 0;
    const peak = points.reduce<ActivityTrendPoint | null>((current, point) => {
      if (!current || point.totalEvents > current.totalEvents) {
        return point;
      }

      return current;
    }, null);

    return {
      totalEvents,
      totalInactivity,
      avgActiveSessions,
      peak,
    };
  }, [points]);

  const maxEvents = Math.max(...points.map((point) => point.totalEvents), 1);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#01ADFB]">
            Tendencia de Actividad
          </p>
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Comportamiento del equipo a traves del tiempo
          </h2>
          <p className="max-w-3xl text-sm font-medium text-muted-foreground">
            Esta vista deja de mirar solo un dia aislado y resume como vienen
            evolucionando los eventos, las sesiones y la inactividad en cortes
            sucesivos.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {modeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => onModeChange(option.value)}
              className={cn(
                "rounded-[1.6rem] border px-4 py-3 text-left transition-all duration-300",
                mode === option.value
                  ? "border-[#01ADFB]/30 bg-[#01ADFB]/8 shadow-lg shadow-[#01ADFB]/10"
                  : "border-border bg-card hover:border-[#01ADFB]/20 hover:bg-muted/40",
              )}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground">
                {option.label}
              </p>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                {option.helper}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Eventos del Periodo
            </p>
            <BarChart3 className="h-4 w-4 text-[#01ADFB]" />
          </div>
          <p className="mt-4 text-3xl font-black text-foreground">
            {summary.totalEvents.toLocaleString()}
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Sesiones Promedio
            </p>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-4 text-3xl font-black text-foreground">
            {summary.avgActiveSessions}
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Inactividad Acumulada
            </p>
            <TimerReset className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-4 text-3xl font-black text-foreground">
            {summary.totalInactivity.toLocaleString()} min
          </p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Pico de Actividad
            </p>
            <TrendingUp className="h-4 w-4 text-violet-500" />
          </div>
          <p className="mt-4 text-lg font-black uppercase tracking-tight text-foreground">
            {summary.peak?.label || "--"}
          </p>
          <p className="mt-1 text-[11px] font-medium text-muted-foreground">
            {summary.peak
              ? `${summary.peak.totalEvents.toLocaleString()} eventos en ${summary.peak.rangeLabel}`
              : "Esperando datos"}
          </p>
        </GlassCard>
      </div>

      <GlassCard className="overflow-hidden border-2 border-border/50">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-foreground">
                Evolucion por corte
              </h3>
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Cada columna resume la carga operativa del periodo correspondiente.
            </p>
          </div>

          <span
            className={cn(
              "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em]",
              isLoading || isRefreshing
                ? "border-amber-500/20 bg-amber-500/10 text-amber-600"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
            )}
          >
            {isLoading || isRefreshing ? "Actualizando" : "Vista consolidada"}
          </span>
        </div>

        <div className="grid gap-4 px-6 py-6 lg:grid-cols-6">
          {points.map((point) => (
            <div
              key={`${point.from}-${point.to}`}
              className="rounded-[2rem] border border-border bg-muted/20 p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-foreground">
                    {point.label}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted-foreground">
                    {point.rangeLabel}
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#01ADFB]">
                  {point.totalEvents.toLocaleString()}
                </span>
              </div>

              <div className="mb-4 h-28 rounded-[1.5rem] bg-background/80 p-2">
                <div className="flex h-full items-end justify-center">
                  <div
                    className="w-full rounded-[1rem] bg-gradient-to-t from-[#01ADFB] via-cyan-400 to-sky-200 transition-all duration-700"
                    style={{
                      height: `${Math.max(
                        12,
                        Math.round((point.totalEvents / maxEvents) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Sesiones</span>
                  <span className="text-foreground">{point.activeSessions}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Inactividad</span>
                  <span className="text-foreground">{point.totalInactivity} min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
