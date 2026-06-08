"use client";

import Link from "next/link";
import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard";
import { cn } from "@/components/ui/utils";
import {
  buildPendingFollowUpsHref,
  type FollowUpNotificationItem,
} from "@/lib/api/follow-up-notifications-client";
import { useFollowUpNotifications } from "@/hooks/use-follow-up-notifications";

const notificationsPanelClass =
  "rounded-lg border border-border bg-card shadow-sm";
const notificationsPrimaryButtonClass =
  "rounded-md border-none bg-[#01ADFB] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-blue-700";
const notificationsSecondaryButtonClass =
  "rounded-md border-border bg-card text-foreground shadow-sm hover:bg-muted";
const NOTIFICATIONS_PAGE_SIZE = 8;
const ALL_CATEGORIES = "all";

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es-CO").format(value);

const formatDueLabel = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(parsed);
};

const bogotaDayKey = (value: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "America/Bogota",
  }).format(value);

const isDueToday = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return bogotaDayKey(parsed) === bogotaDayKey(new Date());
};

const getItemTone = (item: FollowUpNotificationItem) => {
  if (item.isOverdue) {
    return {
      label: "Vencida",
      icon: AlertTriangle,
      itemClass: "border-l-2 border-l-rose-500",
      iconClass:
        "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
      tagClass: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
    };
  }

  if (isDueToday(item.dueAt)) {
    return {
      label: "Para hoy",
      icon: Clock3,
      itemClass: "border-l-2 border-l-amber-500",
      iconClass:
        "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
      tagClass: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    };
  }

  return {
    label: "Pendiente",
    icon: CheckCircle2,
    itemClass: "border-l-2 border-l-transparent",
    iconClass: "border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB]",
    tagClass: "bg-[#01ADFB]/10 text-[#01ADFB]",
  };
};

export default function NotificacionesPage() {
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [currentPage, setCurrentPage] = useState(1);
  const { summary, isLoading } = useFollowUpNotifications({
    category: selectedCategory,
    page: currentPage,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
  });
  const pendingHref = buildPendingFollowUpsHref();
  const items = summary?.items ?? [];
  const categories = summary?.categories ?? [];
  const meta = summary?.meta ?? {
    page: currentPage,
    pageSize: NOTIFICATIONS_PAGE_SIZE,
    total: items.length,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  };
  const selectedCategoryLabel =
    selectedCategory === ALL_CATEGORIES
      ? "Todas"
      : categories.find((category) => category.value === selectedCategory)?.label ??
        selectedCategory;
  const pageStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const pageEnd = Math.min(meta.total, meta.page * meta.pageSize);

  const metrics = [
    {
      label: "Total activo",
      value: summary?.totalPending ?? 0,
      description:
        summary?.scope === "team"
          ? "Pendientes visibles para el equipo seleccionado"
          : "Pendientes asignados a vos",
      valueClass: "text-foreground",
    },
    {
      label: "Vencidas",
      value: summary?.overdueCount ?? 0,
      description: "Acciones que requieren prioridad operativa",
      valueClass: "text-rose-600 dark:text-rose-300",
    },
    {
      label: "Para hoy",
      value: summary?.todayCount ?? 0,
      description: "Compromisos con vencimiento durante el día",
      valueClass: "text-amber-600 dark:text-amber-300",
    },
  ];

  return (
    <DashboardLayout>
      <h2 className="sr-only">Centro de notificaciones y acciones pendientes</h2>

      <div className="flex min-h-0 flex-col bg-background">
        <div className="shrink-0 border-b border-border bg-background px-4 py-4 sm:px-6 lg:px-10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-[15px] font-medium tracking-tight text-foreground">
                Notificaciones
              </h1>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Seguimientos · Vencimientos · Acciones pendientes
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                Vista operativa
              </div>
              <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                {summary?.scope === "team" ? "Equipo" : "Personal"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6 lg:px-10">
          <section className={cn(notificationsPanelClass, "overflow-hidden")}>
            <div className="flex flex-col gap-4 border-b border-border bg-card px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#01ADFB]">
                  Centro operativo
                </p>
                <h2 className="mt-1 text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">
                  Acciones por gestionar
                </h2>
                <p className="mt-1 max-w-2xl text-[11px] font-medium leading-5 text-muted-foreground">
                  Los vencimientos críticos aparecen primero para que el equipo gestione lo urgente sin perder contexto.
                </p>
              </div>

              <Link
                href={pendingHref}
                className={cn(
                  "inline-flex h-8 items-center justify-center gap-2 px-3 text-[10px] font-medium tracking-[0.03em]",
                  notificationsPrimaryButtonClass,
                )}
              >
                Ir a pendientes
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-3">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-lg border border-border bg-muted/30 p-4"
                >
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {metric.label}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums",
                      metric.valueClass,
                    )}
                  >
                    {formatNumber(metric.value)}
                  </p>
                  <p className="mt-2 text-[11px] font-medium leading-5 text-muted-foreground">
                    {metric.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={cn(notificationsPanelClass, "overflow-hidden")}>
            <div className="flex flex-col gap-3 border-b border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">
                  Acciones pendientes
                </h2>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {selectedCategory === ALL_CATEGORIES
                    ? "Ordenadas por prioridad y fecha de vencimiento."
                    : `Categoría activa: ${selectedCategoryLabel}.`}
                </p>
              </div>

              <div className="inline-flex w-fit items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                En seguimiento
              </div>
            </div>

            <div className="border-b border-border bg-muted/20 px-4 py-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Categorías
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    Filtrá la lista por tipo de seguimiento.
                  </p>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 lg:justify-end lg:pb-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(ALL_CATEGORIES);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "h-8 shrink-0 rounded-md border px-3 text-[10px] font-medium transition-colors",
                      selectedCategory === ALL_CATEGORIES
                        ? "border-[#01ADFB]/30 bg-[#01ADFB]/10 text-[#01ADFB]"
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    Todas
                    {categories.length > 0 ? (
                      <span className="ml-2 text-[10px]">
                        {formatNumber(
                          categories.reduce(
                            (total, category) => total + category.count,
                            0,
                          ),
                        )}
                      </span>
                    ) : null}
                  </button>

                  {categories.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(category.value);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "h-8 shrink-0 rounded-md border px-3 text-[10px] font-medium transition-colors",
                        selectedCategory === category.value
                          ? "border-[#01ADFB]/30 bg-[#01ADFB]/10 text-[#01ADFB]"
                          : "border-border bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {category.label}
                      <span className="ml-2 text-[10px]">
                        {formatNumber(category.count)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="divide-y divide-border">
                {items.map((item) => {
                  const tone = getItemTone(item);
                  const StatusIcon = tone.icon;

                  return (
                    <Link
                      key={item.id}
                      href={pendingHref}
                      className={cn(
                        "group flex flex-col gap-3 bg-card px-4 py-4 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center",
                        tone.itemClass,
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                          tone.iconClass,
                        )}
                      >
                        <StatusIcon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "rounded px-2 py-1 text-[10px] font-medium uppercase tracking-[0.04em]",
                              tone.tagClass,
                            )}
                          >
                            {tone.label}
                          </span>
                          <span className="rounded border border-border bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                            {item.followUpType}
                          </span>
                          {item.numeroOrden ? (
                            <span className="rounded border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
                              #{item.numeroOrden}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2">
                          <h3 className="truncate text-[13px] font-medium text-foreground">
                            {item.cliente}
                          </h3>
                          <p className="mt-1 truncate text-[11px] font-medium text-muted-foreground">
                            {item.servicio}
                          </p>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-medium text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3 w-3" />
                            {formatDueLabel(item.dueAt)}
                          </span>
                          <span>
                            Responsable: {item.responsibleName || "Sin responsable"}
                            {item.isMine ? " · Vos" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-[#01ADFB] sm:self-center">
                        Gestionar
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-muted/50">
                  {isLoading ? (
                    <Bell className="h-8 w-8 animate-pulse text-muted-foreground/40" />
                  ) : (
                    <BellOff className="h-8 w-8 text-muted-foreground/30" />
                  )}
                </div>
                <div className="mt-5 space-y-1">
                  <h3 className="text-[13px] font-medium uppercase tracking-[0.12em] text-foreground">
                    {isLoading ? "Cargando acciones" : "Sin acciones pendientes"}
                  </h3>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {isLoading
                      ? "Estamos preparando el estado actual de los seguimientos."
                      : selectedCategory === ALL_CATEGORIES
                        ? "No hay pendientes para la empresa seleccionada."
                        : "No hay pendientes en esta categoría."}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Mostrando{" "}
                <span className="text-foreground">
                  {formatNumber(pageStart)}-{formatNumber(pageEnd)}
                </span>{" "}
                de <span className="text-foreground">{formatNumber(meta.total)}</span>{" "}
                acciones
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-45"
                  onClick={() => setCurrentPage(Math.max(1, meta.page - 1))}
                  disabled={!meta.hasPreviousPage}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Anterior
                </button>
                <span className="min-w-14 rounded-md border border-border bg-muted px-3 py-2 text-center text-[10px] font-medium text-foreground">
                  {meta.page}/{meta.totalPages}
                </span>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-45"
                  onClick={() =>
                    setCurrentPage(Math.min(meta.totalPages, meta.page + 1))
                  }
                  disabled={!meta.hasNextPage}
                >
                  Siguiente
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Link
              href={pendingHref}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-2 px-3 text-[10px] font-medium tracking-[0.03em]",
                notificationsSecondaryButtonClass,
              )}
            >
              Ver seguimiento completo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
