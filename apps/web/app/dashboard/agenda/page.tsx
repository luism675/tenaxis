"use client";

import Link from "next/link";
import React, { Suspense, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard";
import {
  Button,
  Combobox,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { resolveScopedEmpresaId } from "@/lib/access-scope";
import { enterpriseClient, type Enterprise } from "@/lib/api/enterprise-client";
import { serviciosClient } from "@/lib/api/servicios-client";
import { useAccessScope } from "@/hooks/use-access-scope";
import {
  addDaysToYmd,
  startOfBogotaWeekYmd,
  toBogotaYmd,
  utcIsoToBogotaHm,
  utcIsoToBogotaYmd,
} from "@/utils/date-utils";
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  RotateCcw,
  User,
} from "lucide-react";

type ViewType = "SEMANA" | "DIA";
type AgendaPanel = "HORARIO" | "TECNICOS" | "MUNICIPIOS";
const ALL_EMPRESAS_OPTION = "TODAS";
const agendaPanelClass = "rounded-lg border border-border bg-card shadow-sm";
const agendaTabClass =
  "flex h-10 items-center gap-2 border-b-2 px-4 text-[11px] font-medium tracking-[0.02em] transition-colors";
const agendaControlClass =
  "h-9 rounded-md border-border bg-card text-[11px] font-medium text-foreground shadow-sm";
const agendaComboboxTriggerClass =
  "h-9 rounded-md border-border bg-card px-3 text-[11px] font-medium tracking-[0.01em] text-foreground shadow-sm hover:bg-muted/40 focus:border-[#01ADFB]/30 focus:bg-card";
const agendaComboboxContentClass =
  "mt-1 rounded-lg border-border bg-card shadow-xl [&_input]:h-9 [&_input]:text-[11px] [&_button]:rounded-md [&_button]:py-2 [&_button]:text-[11px] [&_button]:font-medium";
const agendaPillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[10px] font-medium text-muted-foreground";

interface Operador {
  id: string;
  nombre: string;
  user?: {
    nombre?: string;
    apellido?: string;
  };
}

interface OrdenServicio {
  id: string;
  cliente?: {
    nombre?: string;
    apellido?: string;
    razonSocial?: string;
    numeroDocumento?: string;
  };
  servicio?: {
    id?: string;
    nombre?: string;
  };
  fechaVisita?: string;
  horaInicio: string;
  horaFin?: string;
  tecnicoId?: string | null;
  tecnico?: {
    user?: {
      nombre?: string;
      apellido?: string;
    };
  };
  direccionTexto?: string;
  barrio?: string;
  municipio?: string;
  departamento?: string;
  zonaId?: string;
  zona?: {
    id: string;
    nombre: string;
  };
  numeroOrden?: string;
  estadoServicio?: string;
  seguimientos?: Array<{
    status?: string | null;
  }>;
  valorCotizado?: number | string | null;
}

interface AgendaOrden extends OrdenServicio {
  addressLabel: string;
  clientName: string;
  localityLabel?: string;
  orderLabel: string;
  serviceName: string;
  startHm?: string;
  startHourSlot?: string;
  startYmd?: string;
  statusLabel: string;
  tecnicoName: string;
}

interface TechnicianAgendaRow {
  tecnicoId: string;
  tecnicoName: string;
  servicios: AgendaOrden[];
}

const ESTADO_STYLING: Record<string, string> = {
  NUEVO: "bg-muted text-muted-foreground border-border",
  PROCESO: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "EN PROCESO": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  CANCELADO: "bg-destructive/10 text-destructive border-destructive/20",
  PROGRAMADO: "bg-[#01ADFB]/10 text-[#01ADFB] border-[#01ADFB]/20",
  LIQUIDADO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  TECNICO_FINALIZO: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "TECNICO FINALIZO": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "TECNICO FINALIZADO": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  REPROGRAMADO: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  SIN_CONCRETAR: "bg-muted text-muted-foreground border-border",
  "SIN CONCRETAR": "bg-muted text-muted-foreground border-border",
  DEFAULT: "bg-muted text-muted-foreground border-border",
};

const ESTADO_CARD_SURFACE: Record<string, string> = {
  NUEVO:
    "border-border bg-card text-muted-foreground",
  PROCESO:
    "border-amber-500/25 bg-amber-500/10 text-amber-600",
  "EN PROCESO":
    "border-amber-500/25 bg-amber-500/10 text-amber-600",
  CANCELADO:
    "border-destructive/25 bg-destructive/10 text-destructive",
  PROGRAMADO:
    "border-[#01ADFB]/25 bg-[#01ADFB]/10 text-[#01ADFB]",
  LIQUIDADO:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
  TECNICO_FINALIZO:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
  "TECNICO FINALIZO":
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
  "TECNICO FINALIZADO":
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-600",
  REPROGRAMADO:
    "border-amber-500/25 bg-amber-500/10 text-amber-600",
  SIN_CONCRETAR:
    "border-border bg-muted/30 text-muted-foreground",
  "SIN CONCRETAR":
    "border-border bg-muted/30 text-muted-foreground",
  DEFAULT:
    "border-border bg-card text-muted-foreground",
};

const ESTADO_CARD_HOVER: Record<string, string> = {
  NUEVO: "hover:bg-muted/50",
  PROCESO: "hover:bg-amber-500/15",
  "EN PROCESO": "hover:bg-amber-500/15",
  CANCELADO: "hover:bg-destructive/15",
  PROGRAMADO: "hover:bg-[#01ADFB]/15",
  LIQUIDADO: "hover:bg-emerald-500/15",
  TECNICO_FINALIZO: "hover:bg-emerald-500/15",
  "TECNICO FINALIZO": "hover:bg-emerald-500/15",
  "TECNICO FINALIZADO": "hover:bg-emerald-500/15",
  REPROGRAMADO: "hover:bg-amber-500/15",
  SIN_CONCRETAR: "hover:bg-muted/50",
  "SIN CONCRETAR": "hover:bg-muted/50",
  DEFAULT: "hover:bg-muted/50",
};

const HOURS = Array.from({ length: 24 }, (_, i) =>
  `${i.toString().padStart(2, "0")}:00`,
);

function parseYmd(dateYmd: string) {
  const [year, month, day] = dateYmd.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getDaysInWeek(dateYmd: string) {
  const mondayYmd = startOfBogotaWeekYmd(dateYmd);
  return Array.from({ length: 7 }, (_, i) => addDaysToYmd(mondayYmd, i));
}

function getOperatorDisplayName(operador?: Operador) {
  if (!operador) {
    return "TÉCNICO SIN NOMBRE";
  }

  const nombre = [operador.user?.nombre, operador.user?.apellido]
    .filter(Boolean)
    .join(" ")
    .trim();

  return nombre || operador.nombre || "TÉCNICO SIN NOMBRE";
}

function normalizeEmpresaFilterId(value?: string | null) {
  if (
    !value ||
    value === "all" ||
    value === "undefined" ||
    value === ALL_EMPRESAS_OPTION
  ) {
    return undefined;
  }

  return value;
}

function normalizeOperators(operators: Operador[]) {
  return Array.from(
    new Map(operators.map((operador) => [operador.id, operador])).values(),
  ).sort((a, b) =>
    getOperatorDisplayName(a).localeCompare(getOperatorDisplayName(b), "es"),
  );
}

function deriveOperatorsFromOrders(ordenes: OrdenServicio[]) {
  return normalizeOperators(
    Array.from(
      new Map(
        ordenes
          .filter((orden) => orden.tecnicoId)
          .map((orden) => [
            orden.tecnicoId as string,
            {
              id: orden.tecnicoId as string,
              nombre:
                [orden.tecnico?.user?.nombre, orden.tecnico?.user?.apellido]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || (orden.tecnicoId as string),
              user: orden.tecnico?.user,
            } satisfies Operador,
          ]),
      ).values(),
    ),
  );
}

function getOrderLabel(orden: OrdenServicio) {
  return `#${orden.numeroOrden || orden.id.slice(0, 8).toUpperCase()}`;
}

function getClientName(orden: OrdenServicio) {
  const businessName = orden.cliente?.razonSocial?.trim();

  if (businessName) {
    return businessName;
  }

  const personName = [orden.cliente?.nombre, orden.cliente?.apellido]
    .filter(Boolean)
    .join(" ")
    .trim();

  return personName || "CLIENTE SIN IDENTIFICAR";
}

function getAddressLabel(orden: OrdenServicio) {
  return orden.direccionTexto?.trim() || "Sin dirección registrada";
}

function getLocalityLabel(orden: OrdenServicio) {
  const locality = [orden.barrio, orden.municipio].filter(Boolean).join(" · ");

  return locality || orden.zona?.nombre || orden.departamento || undefined;
}

function getMunicipioLabel(orden: OrdenServicio) {
  return (
    orden.municipio?.trim() ||
    orden.zona?.nombre?.trim() ||
    orden.departamento?.trim() ||
    "Sin municipio"
  );
}

function normalizeStatus(value?: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "_") || "";
}

function hasPendingFollowUp(orden: OrdenServicio) {
  return orden.seguimientos?.some(
    (seguimiento) => normalizeStatus(seguimiento.status) === "PENDIENTE",
  );
}

function getLatestFollowUpStatus(orden: OrdenServicio) {
  return normalizeStatus(orden.seguimientos?.[0]?.status);
}

function shouldHideRejectedAgendaOrder(orden: OrdenServicio) {
  if (normalizeStatus(orden.estadoServicio) === "RECHAZADO") {
    return true;
  }

  if (hasPendingFollowUp(orden)) {
    return false;
  }

  return getLatestFollowUpStatus(orden) === "RECHAZADO";
}

function compareAgendaOrders(a: AgendaOrden, b: AgendaOrden) {
  const timeCompare = (a.startHm || "").localeCompare(b.startHm || "", "es");
  if (timeCompare !== 0) {
    return timeCompare;
  }

  return a.clientName.localeCompare(b.clientName, "es");
}

function formatCurrency(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

function getEstadoBadgeClasses(status: string) {
  return ESTADO_STYLING[status] || ESTADO_STYLING.DEFAULT;
}

function getEstadoCardSurface(status: string) {
  return ESTADO_CARD_SURFACE[status] || ESTADO_CARD_SURFACE.DEFAULT;
}

function getEstadoCardHover(status: string) {
  return ESTADO_CARD_HOVER[status] || ESTADO_CARD_HOVER.DEFAULT;
}

function formatPeriodLabel(currentDate: string, panel: AgendaPanel, view: ViewType) {
  if (panel !== "HORARIO" || view === "DIA") {
    return parseYmd(currentDate).toLocaleDateString("es-CO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  const weekDays = getDaysInWeek(currentDate);
  const firstDate = parseYmd(weekDays[0]);
  const lastDate = parseYmd(weekDays[weekDays.length - 1]);

  if (
    firstDate.getMonth() === lastDate.getMonth() &&
    firstDate.getFullYear() === lastDate.getFullYear()
  ) {
    return `${firstDate.getDate()} - ${lastDate.getDate()} ${lastDate.toLocaleDateString(
      "es-CO",
      {
        month: "long",
        year: "numeric",
      },
    )}`;
  }

  return `${firstDate.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
  })} - ${lastDate.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function Loader2({ className }: { className?: string }) {
  return (
    <div className={cn("animate-spin text-[#01ADFB]", className)}>
      <RotateCcw />
    </div>
  );
}

function EmptyAgendaState({
  title,
  description,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-[360px] items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-lg border border-dashed border-border bg-muted/30 px-8 py-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card text-[#01ADFB] shadow-sm">
          <CalendarClock className="h-5 w-5" />
        </div>
        <h3 className="mt-5 text-sm font-medium tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-xs font-medium text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

function ServiceMetaItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-[#01ADFB]" />
        {label}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function ServicePopoverCard({
  orden,
  variant,
}: {
  orden: AgendaOrden;
  variant: "grid" | "lane";
}) {
  const amountLabel = formatCurrency(orden.valorCotizado);
  const statusBadgeClasses = getEstadoBadgeClasses(orden.statusLabel);
  const cardSurfaceClasses = getEstadoCardSurface(orden.statusLabel);
  const cardHoverClasses = getEstadoCardHover(orden.statusLabel);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "group relative overflow-hidden text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#01ADFB] focus-visible:ring-offset-2",
            cardSurfaceClasses,
            cardHoverClasses,
            variant === "grid"
              ? "min-h-[42px] w-full min-w-0 rounded-md border px-2.5 py-2 shadow-sm"
              : "min-w-[180px] max-w-[240px] rounded-lg border p-3 shadow-sm hover:-translate-y-0.5 hover:shadow-md",
          )}
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-current opacity-15" />

          <div className="flex h-full items-start justify-between gap-3">
            <div
              className={cn(
                "min-w-0 flex-1",
                variant === "grid" && "flex h-full flex-col",
              )}
            >
              <div
                className={cn(
                  "items-center gap-2",
                  variant === "grid"
                    ? "flex min-w-0 flex-nowrap"
                    : "flex flex-wrap",
                )}
              >
                <span className="shrink-0 rounded border border-background/70 bg-background/75 px-2 py-1 text-[9px] font-medium tracking-[0.06em] text-foreground/80 shadow-sm backdrop-blur-sm">
                  {orden.orderLabel}
                </span>
                <span
                  className={cn(
                    "min-w-0 max-w-full rounded px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] shadow-sm",
                    variant === "grid" ? "hidden" : "inline-flex",
                    statusBadgeClasses,
                  )}
                >
                  <span className="truncate">{orden.statusLabel}</span>
                </span>
              </div>

              <h3
                className={cn(
                  "font-medium leading-tight text-foreground",
                  variant === "grid"
                    ? "mt-1 line-clamp-1 text-[10px]"
                    : "mt-3 line-clamp-2 text-xs",
                )}
                title={orden.clientName}
              >
                {orden.clientName}
              </h3>

              <div
                className={cn(
                  "mt-3 flex min-w-0 items-start gap-2 font-semibold text-foreground/80",
                  variant === "grid"
                    ? "hidden"
                    : "text-[11px] leading-snug",
                )}
              >
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/55" />
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    variant === "grid" ? "line-clamp-2" : "truncate",
                  )}
                  title={orden.serviceName}
                >
                  {orden.serviceName}
                </span>
              </div>

              <div
                className={cn(
                  "mt-2 flex min-w-0 items-start gap-2 font-medium text-foreground/70",
                  variant === "grid"
                    ? "hidden"
                    : "text-[11px] leading-snug",
                )}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/50" />
                <span
                  className={cn(
                    "min-w-0 flex-1",
                    variant === "grid" ? "line-clamp-2" : "truncate",
                  )}
                  title={orden.localityLabel || orden.addressLabel}
                >
                  {orden.localityLabel || orden.addressLabel}
                </span>
              </div>
            </div>

            <div className="shrink-0 rounded-md border border-background/70 bg-background/80 px-2 py-1.5 text-right shadow-sm backdrop-blur-sm">
              <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Hora
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground">
                {orden.startHm || "--:--"}
              </p>
            </div>
          </div>
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[min(26rem,calc(100vw-2rem))] rounded-lg border border-border p-0 shadow-xl"
      >
        <div className="overflow-hidden rounded-lg bg-card">
          <div
            className={cn(
              "border-b border-border px-5 py-5",
              cardSurfaceClasses,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#01ADFB]">
                  {orden.orderLabel}
                </p>
                <h3 className="mt-2 text-sm font-medium tracking-tight text-foreground">
                  {orden.clientName}
                </h3>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {orden.serviceName}
                </p>
              </div>
              <span
                className={cn(
                  "inline-flex shrink-0 rounded border px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em]",
                  statusBadgeClasses,
                )}
              >
                {orden.statusLabel}
              </span>
            </div>
          </div>

          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <ServiceMetaItem
                icon={Clock}
                label="Hora"
                value={
                  orden.horaFin
                    ? `${orden.startHm || "--:--"} → ${(() => {
                        try {
                          return utcIsoToBogotaHm(orden.horaFin ?? "");
                        } catch {
                          return "--:--";
                        }
                      })()}`
                    : orden.startHm || "Sin hora"
                }
              />
              <ServiceMetaItem
                icon={User}
                label="Técnico"
                value={orden.tecnicoName}
              />
              <ServiceMetaItem
                icon={MapPin}
                label="Dirección"
                value={orden.addressLabel}
              />
              <ServiceMetaItem
                icon={FileText}
                label="Cobertura"
                value={orden.localityLabel || "Sin zona registrada"}
              />
            </div>

            {amountLabel ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Valor referencial
                </p>
                <p className="mt-2 text-base font-medium text-foreground">
                  {amountLabel}
                </p>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-end border-t border-border bg-muted/20 px-5 py-3">
            <Button
              asChild
              size="sm"
              className="h-8 rounded-md border-none bg-[#01ADFB] px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-[#0197dc]"
            >
              <Link href={`/dashboard/servicios/${orden.id}/editar`}>
                Abrir servicio
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function HorarioView({
  daysToShow,
  view,
  scheduleCellMap,
}: {
  daysToShow: string[];
  scheduleCellMap: Map<string, AgendaOrden[]>;
  view: ViewType;
}) {
  const scheduleGridTemplate =
    view === "SEMANA"
      ? `64px repeat(${daysToShow.length}, minmax(150px, 1fr))`
      : "64px minmax(0, 1fr)";

  const scheduleGridMinWidth =
    view === "SEMANA" ? `${64 + daysToShow.length * 150}px` : "100%";

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-card custom-scrollbar">
      <div className="min-w-full" style={{ minWidth: scheduleGridMinWidth }}>
        <div
          className="sticky top-0 z-10 grid border-b border-border bg-muted/60 backdrop-blur-sm"
          style={{ gridTemplateColumns: scheduleGridTemplate }}
        >
          <div className="h-16 border-r border-border/60" />
          {daysToShow.map((day) => {
            const dayDate = parseYmd(day);
            const isToday = day === toBogotaYmd();

            return (
              <div
                key={day}
                className={cn(
                  "flex h-16 min-w-0 flex-col items-center justify-center border-r border-border/60 last:border-r-0",
                  isToday && "bg-[#01ADFB]/8",
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {dayDate.toLocaleDateString("es-CO", { weekday: "short" })}
                </span>
                <span
                  className={cn(
                    "mt-1 text-xl font-medium tracking-tight",
                    isToday ? "text-[#01ADFB]" : "text-foreground",
                  )}
                >
                  {dayDate.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        <div className="relative">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid min-h-14 border-b border-border/60"
              style={{ gridTemplateColumns: scheduleGridTemplate }}
            >
              <div className="border-r border-border/60 bg-muted/30 px-2 py-3 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {hour}
              </div>

              {daysToShow.map((day) => {
                const cellOrders = scheduleCellMap.get(`${day}__${hour}`) || [];

                return (
                  <div
                    key={`${day}-${hour}`}
                    className={cn(
                      "min-w-0 border-r border-border/60 p-1.5 last:border-r-0 hover:bg-muted/20",
                      day === toBogotaYmd() && "bg-[#01ADFB]/5",
                    )}
                  >
                    <div className="flex min-w-0 flex-col gap-2">
                      {cellOrders.map((orden) => (
                        <ServicePopoverCard
                          key={orden.id}
                          orden={orden}
                          variant="grid"
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TecnicosView({
  rows,
}: {
  rows: TechnicianAgendaRow[];
}) {
  return (
    <div className="flex-1 overflow-auto bg-card custom-scrollbar">
      <div className="space-y-3 p-4">
        {rows.map((row) => {
          const hasServices = row.servicios.length > 0;

          return (
            <section
              key={row.tecnicoId}
              className={cn(
                "grid overflow-hidden rounded-lg border border-border bg-card shadow-sm xl:grid-cols-[180px_1fr]",
                !hasServices && "border-dashed bg-muted/10",
              )}
            >
              <div className="border-b border-border bg-muted/40 p-4 xl:border-b-0 xl:border-r">
                <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {hasServices ? "Técnico asignado" : "Técnico sin carga"}
                </p>
                <h3 className="mt-2 text-sm font-medium tracking-tight text-foreground">
                  {row.tecnicoName}
                </h3>
                <div
                  className={cn(
                    "mt-3 inline-flex rounded px-2 py-1 text-[10px] font-medium",
                    hasServices
                      ? "border-[#01ADFB]/15 bg-[#01ADFB]/8 text-[#01ADFB]"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {hasServices
                    ? `${row.servicios.length} servicios del día`
                    : "Sin servicios asignados"}
                </div>
              </div>

              <div className="overflow-x-auto p-3 custom-scrollbar">
                <div className="flex min-w-max gap-2">
                  {hasServices ? (
                    row.servicios.map((orden) => (
                      <ServicePopoverCard
                        key={orden.id}
                        orden={orden}
                        variant="lane"
                      />
                    ))
                  ) : (
                    <div className="flex min-h-[112px] min-w-[220px] max-w-[280px] flex-col justify-center rounded-lg border border-dashed border-emerald-500/20 bg-emerald-500/10 p-4 text-left">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
                        Disponible
                      </p>
                      <p className="mt-2 text-xs font-medium leading-snug text-foreground">
                        Este técnico no tiene servicios asignados para el día
                        seleccionado.
                      </p>
                      <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                        Útil para balancear carga operativa antes de reasignar
                        rutas.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function MunicipiosView({
  rows,
}: {
  rows: Array<{
    municipio: string;
    servicios: AgendaOrden[];
    tecnicosActivos: number;
  }>;
}) {
  return (
    <div className="flex-1 overflow-auto bg-card custom-scrollbar">
      <div className="space-y-3 p-4">
        {rows.map((row) => (
          <section
            key={row.municipio}
            className="grid overflow-hidden rounded-lg border border-border bg-card shadow-sm xl:grid-cols-[180px_1fr]"
          >
            <div className="border-b border-border bg-muted/40 p-4 xl:border-b-0 xl:border-r">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Municipio operativo
              </p>
              <h3 className="mt-2 text-sm font-medium tracking-tight text-foreground">
                {row.municipio}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <div className="inline-flex rounded border border-[#01ADFB]/15 bg-[#01ADFB]/8 px-2 py-1 text-[10px] font-medium text-[#01ADFB]">
                  {row.servicios.length} servicios
                </div>
                <div className="inline-flex rounded border border-border bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  {row.tecnicosActivos} técnicos
                </div>
              </div>
            </div>

            <div className="overflow-x-auto p-3 custom-scrollbar">
              <div className="flex min-w-max gap-2">
                {row.servicios.map((orden) => (
                  <ServicePopoverCard
                    key={orden.id}
                    orden={orden}
                    variant="lane"
                  />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AgendaContent() {
  const { scope, isLoading: isLoadingScope } = useAccessScope();
  const [panel, setPanel] = useState<AgendaPanel>("HORARIO");
  const [view, setView] = useState<ViewType>("SEMANA");
  const [currentDate, setCurrentDate] = useState<string>(() => toBogotaYmd());
  const [empresas, setEmpresas] = useState<Enterprise[]>([]);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(() => {
    if (typeof window === "undefined") {
      return ALL_EMPRESAS_OPTION;
    }

    return (
      normalizeEmpresaFilterId(localStorage.getItem("current-enterprise-id")) ||
      ALL_EMPRESAS_OPTION
    );
  });
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState("TODOS");
  const [loading, setLoading] = useState(true);
  const canFilterEmpresas = scope.canSeeTenantWide && !scope.isEmpresaLocked;

  const navigationStep = panel !== "HORARIO" ? 1 : view === "SEMANA" ? 7 : 1;
  const weekDays = useMemo(() => getDaysInWeek(currentDate), [currentDate]);
  const daysToShow = useMemo(
    () => (view === "SEMANA" ? weekDays : [currentDate]),
    [currentDate, view, weekDays],
  );
  const agendaFetchRange = useMemo(() => {
    const daysToFetch = panel === "HORARIO" ? weekDays : [currentDate];

    return {
      fechaInicio: daysToFetch[0],
      fechaFin: daysToFetch[daysToFetch.length - 1],
    };
  }, [currentDate, panel, weekDays]);

  useEffect(() => {
    if (isLoadingScope) {
      return;
    }

    if (!canFilterEmpresas) {
      setEmpresas([]);
      return;
    }

    let cancelled = false;

    const loadEmpresas = async () => {
      try {
        const loadedEmpresas = await enterpriseClient.getAll();
        const sortedEmpresas = loadedEmpresas.sort((a, b) =>
          a.nombre.localeCompare(b.nombre, "es"),
        );

        if (cancelled) {
          return;
        }

        setEmpresas(sortedEmpresas);
        setSelectedEmpresaId((currentEmpresaId) =>
          currentEmpresaId === ALL_EMPRESAS_OPTION ||
          sortedEmpresas.some((empresa) => empresa.id === currentEmpresaId)
            ? currentEmpresaId
            : ALL_EMPRESAS_OPTION,
        );
      } catch (_error) {
        console.error("Error loading agenda enterprises", _error);
        if (!cancelled) {
          setEmpresas([]);
          setSelectedEmpresaId(ALL_EMPRESAS_OPTION);
        }
      }
    };

    loadEmpresas();

    return () => {
      cancelled = true;
    };
  }, [canFilterEmpresas, isLoadingScope]);

  useEffect(() => {
    setSelectedTecnico("TODOS");
  }, [selectedEmpresaId]);

  useEffect(() => {
    if (isLoadingScope) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      try {
        setLoading(true);

        const preferredEmpresaId = localStorage.getItem("current-enterprise-id");
        let scopedEmpresaId = resolveScopedEmpresaId(scope, preferredEmpresaId);

        if (scope.isEmpresaLocked && !scopedEmpresaId) {
          const scopedEmpresas = await enterpriseClient.getAll();
          scopedEmpresaId = scopedEmpresas[0]?.id;
        }

        const requestedEmpresaId = scope.isEmpresaLocked
          ? scopedEmpresaId
          : canFilterEmpresas
            ? selectedEmpresaId
            : preferredEmpresaId;
        const cleanEmpresaId =
          normalizeEmpresaFilterId(requestedEmpresaId);

        if (scope.isEmpresaLocked && !cleanEmpresaId) {
          if (cancelled) {
            return;
          }

          setOrdenes([]);
          setOperadores([]);
          return;
        }

        const ords = await serviciosClient.getAll(cleanEmpresaId, undefined, {
          fechaInicio: agendaFetchRange.fechaInicio,
          fechaFin: agendaFetchRange.fechaFin,
          fetchAllPages: true,
        });
        const parsedOrdenes = Array.isArray(ords)
          ? (ords as OrdenServicio[]).filter(
              (orden) => !shouldHideRejectedAgendaOrder(orden),
            )
          : [];

        if (cancelled) {
          return;
        }

        setOrdenes(parsedOrdenes);

        let parsedOperators: Operador[] = [];

        try {
          const ops = await enterpriseClient.getOperators(cleanEmpresaId);
          parsedOperators = Array.isArray(ops) ? (ops as Operador[]) : [];
        } catch (_operatorError) {
          console.error("Error loading agenda operators", _operatorError);
          parsedOperators = deriveOperatorsFromOrders(parsedOrdenes);
        }

        if (cancelled) {
          return;
        }

        setOperadores(normalizeOperators(parsedOperators));
      } catch (_error) {
        console.error("Error loading agenda data", _error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [
    agendaFetchRange.fechaFin,
    agendaFetchRange.fechaInicio,
    canFilterEmpresas,
    isLoadingScope,
    scope,
    selectedEmpresaId,
  ]);

  const operatorLookup = useMemo(
    () => new Map(operadores.map((operador) => [operador.id, getOperatorDisplayName(operador)])),
    [operadores],
  );

  useEffect(() => {
    if (
      selectedTecnico !== "TODOS" &&
      !operadores.some((operador) => operador.id === selectedTecnico)
    ) {
      setSelectedTecnico("TODOS");
    }
  }, [operadores, selectedTecnico]);

  const normalizedOrdenes = useMemo<AgendaOrden[]>(() => {
    const mapped = ordenes.map((orden) => {
      let startYmd: string | undefined;
      let startHm: string | undefined;
      let startHourSlot: string | undefined;

      try {
        startYmd = utcIsoToBogotaYmd(orden.horaInicio);
        startHm = utcIsoToBogotaHm(orden.horaInicio);
        startHourSlot = `${startHm.split(":")[0]}:00`;
      } catch {
        startYmd = undefined;
        startHm = undefined;
        startHourSlot = undefined;
      }

      const tecnicoName =
        (orden.tecnicoId ? operatorLookup.get(orden.tecnicoId) : undefined) ||
        [orden.tecnico?.user?.nombre, orden.tecnico?.user?.apellido]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        "Sin técnico asignado";

      return {
        ...orden,
        addressLabel: getAddressLabel(orden),
        clientName: getClientName(orden),
        localityLabel: getLocalityLabel(orden),
        orderLabel: getOrderLabel(orden),
        serviceName: orden.servicio?.nombre || "SERVICIO GENERAL",
        startHm,
        startHourSlot,
        startYmd,
        statusLabel: orden.estadoServicio || "NUEVO",
        tecnicoName,
      } satisfies AgendaOrden;
    });

    return mapped.sort(compareAgendaOrders);
  }, [operatorLookup, ordenes]);

  const ordenesFiltradas = useMemo(
    () =>
      normalizedOrdenes.filter((orden) =>
        selectedTecnico === "TODOS" ? true : orden.tecnicoId === selectedTecnico,
      ),
    [normalizedOrdenes, selectedTecnico],
  );

  const scheduleCellMap = useMemo(() => {
    const map = new Map<string, AgendaOrden[]>();

    for (const orden of ordenesFiltradas) {
      if (!orden.startYmd || !orden.startHourSlot) {
        continue;
      }

      const key = `${orden.startYmd}__${orden.startHourSlot}`;
      const bucket = map.get(key) || [];
      bucket.push(orden);
      map.set(key, bucket);
    }

    for (const bucket of map.values()) {
      bucket.sort(compareAgendaOrders);
    }

    return map;
  }, [ordenesFiltradas]);

  const visibleScheduleOrders = useMemo(
    () =>
      ordenesFiltradas.filter(
        (orden) => orden.startYmd && daysToShow.includes(orden.startYmd),
      ),
    [daysToShow, ordenesFiltradas],
  );

  const technicianRows = useMemo<TechnicianAgendaRow[]>(() => {
    const grouped = new Map<string, TechnicianAgendaRow>();

    const visibleOperators =
      selectedTecnico === "TODOS"
        ? operadores
        : operadores.filter((operador) => operador.id === selectedTecnico);

    for (const operador of visibleOperators) {
      grouped.set(operador.id, {
        tecnicoId: operador.id,
        tecnicoName: getOperatorDisplayName(operador),
        servicios: [],
      });
    }

    for (const orden of ordenesFiltradas) {
      if (!orden.tecnicoId || orden.startYmd !== currentDate) {
        continue;
      }

      const existingRow = grouped.get(orden.tecnicoId);

      if (existingRow) {
        existingRow.servicios.push(orden);
        continue;
      }

      grouped.set(orden.tecnicoId, {
        tecnicoId: orden.tecnicoId,
        tecnicoName: orden.tecnicoName,
        servicios: [orden],
      });
    }

    return Array.from(grouped.values())
      .map((row) => ({
        ...row,
        servicios: row.servicios.sort(compareAgendaOrders),
      }))
      .sort((a, b) => a.tecnicoName.localeCompare(b.tecnicoName, "es"));
  }, [currentDate, operadores, ordenesFiltradas, selectedTecnico]);

  const municipalityRows = useMemo(() => {
    const grouped = new Map<
      string,
      {
        municipio: string;
        servicios: AgendaOrden[];
        tecnicos: Set<string>;
      }
    >();

    for (const orden of ordenesFiltradas) {
      if (orden.startYmd !== currentDate) {
        continue;
      }

      const municipio = getMunicipioLabel(orden);
      const existingRow = grouped.get(municipio);

      if (existingRow) {
        existingRow.servicios.push(orden);
        if (orden.tecnicoId) {
          existingRow.tecnicos.add(orden.tecnicoId);
        }
        continue;
      }

      grouped.set(municipio, {
        municipio,
        servicios: [orden],
        tecnicos: new Set(orden.tecnicoId ? [orden.tecnicoId] : []),
      });
    }

    return Array.from(grouped.values())
      .map((row) => ({
        municipio: row.municipio,
        servicios: row.servicios.sort(compareAgendaOrders),
        tecnicosActivos: row.tecnicos.size,
      }))
      .sort((a, b) => a.municipio.localeCompare(b.municipio, "es"));
  }, [currentDate, ordenesFiltradas]);

  const daySummary = useMemo(() => {
    const sameDayOrders = ordenesFiltradas.filter(
      (orden) => orden.startYmd === currentDate,
    );
    const activeTecnicos = new Set(
      sameDayOrders.map((orden) => orden.tecnicoId).filter(Boolean),
    ).size;

    return {
      servicios: sameDayOrders.length,
      tecnicos: activeTecnicos,
      municipios: new Set(sameDayOrders.map((orden) => getMunicipioLabel(orden))).size,
    };
  }, [currentDate, ordenesFiltradas]);

  const technicianAvailabilitySummary = useMemo(
    () => ({
      visibles: technicianRows.length,
      sinServicios: technicianRows.filter((row) => row.servicios.length === 0).length,
    }),
    [technicianRows],
  );

  const weekSummary = useMemo(
    () => ({
      servicios: ordenesFiltradas.filter(
        (orden) => orden.startYmd && weekDays.includes(orden.startYmd),
      ).length,
    }),
    [ordenesFiltradas, weekDays],
  );

  const periodLabel = useMemo(
    () => formatPeriodLabel(currentDate, panel, view),
    [currentDate, panel, view],
  );

  const title =
    panel === "HORARIO"
      ? `Agenda ${view === "SEMANA" ? "Semanal" : "Diaria"}`
      : panel === "TECNICOS"
        ? "Agenda por Técnicos"
        : "Agenda por Municipios";

  const subtitle =
    panel === "HORARIO"
      ? "Lectura horaria con foco en cada servicio y su contexto operativo."
      : panel === "TECNICOS"
        ? "Panel diario por técnico, incluyendo servicios asignados y técnicos sin carga."
        : "Panel diario agrupado por municipio para leer cobertura y carga operativa.";

  const secondarySummaryLabel =
    panel === "MUNICIPIOS"
      ? `${daySummary.municipios} municipios activos`
      : panel === "TECNICOS"
        ? `${technicianAvailabilitySummary.visibles} técnicos visibles`
        : `${daySummary.tecnicos} técnicos activos`;

  const empresaOptions = useMemo(
    () => [
      { value: ALL_EMPRESAS_OPTION, label: "TODAS LAS EMPRESAS" },
      ...empresas.map((empresa) => ({
        value: empresa.id,
        label: empresa.nombre.toUpperCase(),
        searchText: empresa.nombre,
      })),
    ],
    [empresas],
  );

  const operadorOptions = useMemo(
    () => [
      { value: "TODOS", label: "TODOS LOS TÉCNICOS" },
      ...operadores.map((operador) => ({
        value: operador.id,
        label: getOperatorDisplayName(operador).toUpperCase(),
      })),
    ],
    [operadores],
  );

  if (loading || isLoadingScope) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-12 w-12" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#01ADFB]">
              Programación operativa
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-1 max-w-3xl text-sm font-medium text-muted-foreground">
              {subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              {periodLabel}
            </div>
            <div className="rounded-md border border-[#01ADFB]/20 bg-[#01ADFB]/10 px-3 py-1.5 text-[11px] font-medium text-[#01ADFB]">
              {daySummary.servicios} servicios hoy
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-10">
        <div className={cn("mx-auto flex h-full w-full max-w-[1600px] flex-col overflow-hidden", agendaPanelClass)}>
          <div className="shrink-0 border-b border-border bg-card px-4 pt-3 sm:px-5">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap border-b border-border">
                    {([
                      { value: "HORARIO", label: "Horario", hint: "Grilla detallada" },
                      { value: "TECNICOS", label: "Técnicos", hint: "Vista operativa" },
                      { value: "MUNICIPIOS", label: "Municipios", hint: "Cobertura diaria" },
                    ] as const).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setPanel(option.value)}
                        className={cn(
                          agendaTabClass,
                          panel === option.value
                            ? "border-[#01ADFB] text-[#01ADFB]"
                            : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 pb-3 lg:flex-row lg:items-center">
                    {canFilterEmpresas ? (
                      <div className="w-full lg:w-64">
                        <Combobox
                          options={empresaOptions}
                          value={selectedEmpresaId}
                          onChange={setSelectedEmpresaId}
                          placeholder="Empresas"
                          emptyMessage="No hay empresas disponibles."
                          triggerClassName={agendaComboboxTriggerClass}
                          contentClassName={agendaComboboxContentClass}
                        />
                      </div>
                    ) : null}

                    <div className="w-full lg:w-56">
                      <Combobox
                        options={operadorOptions}
                        value={selectedTecnico}
                        onChange={setSelectedTecnico}
                        placeholder="Técnicos"
                        triggerClassName={agendaComboboxTriggerClass}
                        contentClassName={agendaComboboxContentClass}
                      />
                    </div>

                    {panel === "HORARIO" ? (
                      <div className="inline-flex flex-wrap items-center rounded-md border border-border bg-muted/50 p-1">
                        {(["DIA", "SEMANA"] as ViewType[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setView(mode)}
                            className={cn(
                              "rounded px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-all",
                              view === mode
                                ? "bg-card text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="inline-flex h-9 items-center rounded-md border border-border bg-muted/40 px-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        Día operativo seleccionado
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 pb-3 xl:items-end">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentDate((previousDate) =>
                          addDaysToYmd(previousDate, -navigationStep),
                        )
                      }
                      className={cn("h-9 w-9", agendaControlClass)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="rounded-md border border-border bg-card px-4 py-2 text-center shadow-sm">
                      <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Periodo activo
                      </p>
                      <p className="mt-0.5 text-xs font-medium capitalize tracking-tight text-foreground">
                        {periodLabel}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCurrentDate((previousDate) =>
                          addDaysToYmd(previousDate, navigationStep),
                        )
                      }
                      className={cn("h-9 w-9", agendaControlClass)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className={cn(agendaPillClass, "border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB]")}>
                      <strong className="font-semibold">{daySummary.servicios}</strong> servicios hoy
                    </div>
                    {panel === "HORARIO" ? (
                      <div className={agendaPillClass}>
                        <strong className="font-semibold text-[#01ADFB]">{weekSummary.servicios}</strong> esta semana
                      </div>
                    ) : null}
                    <div className={agendaPillClass}>
                      {secondarySummaryLabel}
                    </div>
                    {panel === "TECNICOS" &&
                    technicianAvailabilitySummary.sinServicios > 0 ? (
                      <div className={cn(agendaPillClass, "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300")}>
                        {technicianAvailabilitySummary.sinServicios} sin servicios
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {panel === "HORARIO" ? (
            visibleScheduleOrders.length > 0 ? (
              <HorarioView
                daysToShow={daysToShow}
                scheduleCellMap={scheduleCellMap}
                view={view}
              />
            ) : (
              <EmptyAgendaState
                title="No hay servicios en este rango"
                description="Probá cambiar la fecha, el técnico o la vista para revisar otras programaciones."
              />
            )
          ) : panel === "TECNICOS" ? (
            technicianRows.length > 0 ? (
              <TecnicosView rows={technicianRows} />
            ) : (
              <EmptyAgendaState
                title="Sin técnicos programados para este día"
                description="Todavía no hay asignaciones visibles en la fecha seleccionada con el filtro actual."
              />
            )
          ) : municipalityRows.length > 0 ? (
            <MunicipiosView rows={municipalityRows} />
          ) : (
            <EmptyAgendaState
              title="Sin municipios operativos para este día"
              description="No hay cobertura visible por municipio con la fecha y filtros actuales."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgendaPage() {
  return (
    <DashboardLayout overflowHidden>
      <Suspense
        fallback={
          <div className="flex h-[80vh] items-center justify-center text-[10px] font-medium uppercase tracking-widest text-muted-foreground animate-pulse">
            Sincronizando cronograma operativo...
          </div>
        }
      >
        <AgendaContent />
      </Suspense>
    </DashboardLayout>
  );
}
