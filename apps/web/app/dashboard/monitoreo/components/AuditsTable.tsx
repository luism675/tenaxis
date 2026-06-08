"use client";

import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  Filter,
  History,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { formatBogotaDateTime } from "@/utils/date-utils";

import { GlassCard } from "./utils";
import { AuditFilterMultiSelect } from "./AuditFilterMultiSelect";
import { Audit, AuditFilters, AuditFilterOptions, AuditMeta } from "../types";

interface AuditsTableProps {
  audits: Audit[];
  meta: AuditMeta;
  currentPage: number;
  isLoading: boolean;
  entityIdQuery: string;
  filters: AuditFilters;
  filterOptions: AuditFilterOptions;
  onEntityIdChange: (value: string) => void;
  onFiltersChange: (updater: Partial<AuditFilters> | ((prev: AuditFilters) => AuditFilters)) => void;
  onClearFilters: () => void;
  onExportCrud: () => void;
  isExportingCrud?: boolean;
  onPageChange: (page: number) => void;
  onOpenAudit: (audit: Audit) => void;
}

export function AuditsTable({
  audits,
  meta,
  currentPage,
  isLoading,
  entityIdQuery,
  filters,
  filterOptions,
  onEntityIdChange,
  onFiltersChange,
  onClearFilters,
  onExportCrud,
  isExportingCrud = false,
  onPageChange,
  onOpenAudit,
}: AuditsTableProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

  const totalPages = meta.totalPages ?? 1;
  const activeAdvancedFiltersCount =
    filters.actions.length +
    filters.users.length +
    filters.entities.length +
    filters.statuses.length;
  const hasAnyFilters = activeAdvancedFiltersCount > 0 || entityIdQuery.trim().length > 0;

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors" />
            <Input
              placeholder="Buscar por ID de entidad (cliente, servicio, etc.)..."
              aria-label="Buscar registros de auditoría por ID de entidad"
              className="h-14 rounded-2xl border border-border bg-card pl-12 pr-12 text-sm font-bold shadow-sm"
              value={entityIdQuery}
              onChange={(e) => onEntityIdChange(e.target.value)}
            />
            {entityIdQuery && (
              <button
                type="button"
                onClick={() => onEntityIdChange("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Limpiar búsqueda por ID de entidad"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={cn(
              "flex h-14 items-center gap-2 rounded-2xl border px-6 font-black uppercase tracking-widest text-[11px] shadow-sm transition-all active:scale-95",
              showAdvancedFilters || activeAdvancedFiltersCount > 0
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-card text-muted-foreground hover:bg-accent/5 hover:text-foreground",
            )}
          >
            <Filter className="h-4 w-4" />
            Filtros Avanzados
            {activeAdvancedFiltersCount > 0 && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-white">
                {activeAdvancedFiltersCount}
              </span>
            )}
          </button>

          <Button
            type="button"
            variant="outline"
            onClick={onExportCrud}
            disabled={isExportingCrud || (meta.total ?? 0) === 0}
            className={cn(
              "h-14 rounded-2xl border px-6 text-[11px] font-black uppercase tracking-widest shadow-sm",
              isExportingCrud && "cursor-wait",
            )}
          >
            <Download className={cn("mr-2 h-4 w-4", isExportingCrud && "animate-pulse")} />
            {isExportingCrud ? "Exportando..." : "Descargar Excel CRUD"}
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="rounded-[2rem] border border-border bg-card/70 p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-foreground">
                  Filtros Avanzados de Auditoría
                </p>
                <p className="mt-1 text-sm font-medium text-muted-foreground">
                  Combiná múltiples usuarios, acciones, entidades y estados para aislar cambios específicos.
                </p>
              </div>

              {hasAnyFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full px-4 text-[10px] font-black uppercase tracking-[0.18em]"
                  onClick={onClearFilters}
                >
                  Limpiar todo
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4">
              <AuditFilterMultiSelect
                label="Acción"
                placeholder="Todas las acciones"
                options={filterOptions.actions}
                values={filters.actions}
                onChange={(values) => onFiltersChange({ actions: values })}
                emptyMessage="No hay acciones disponibles."
              />

              <AuditFilterMultiSelect
                label="Usuario"
                placeholder="Todos los usuarios"
                options={filterOptions.users}
                values={filters.users}
                onChange={(values) => onFiltersChange({ users: values })}
                emptyMessage="No hay usuarios disponibles."
              />

              <AuditFilterMultiSelect
                label="Entidad"
                placeholder="Todas las entidades"
                options={filterOptions.entities}
                values={filters.entities}
                onChange={(values) => onFiltersChange({ entities: values })}
                emptyMessage="No hay entidades disponibles."
              />

              <AuditFilterMultiSelect
                label="Estado"
                placeholder="Todos los estados"
                options={filterOptions.statuses}
                values={filters.statuses}
                onChange={(values) => onFiltersChange({ statuses: values })}
                emptyMessage="No hay estados disponibles."
              />
            </div>
          </div>
        )}
      </div>

      <GlassCard className="w-full overflow-hidden">
        <div className="mb-6 border-b border-border px-2 pb-8 pt-2">
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground">
            Registros de Auditoría
          </h3>
          <p className="text-sm font-medium text-muted-foreground">
            Historial detallado de cambios y transacciones (CRUD).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Fecha
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Usuario
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Acción
                </th>
                <th className="px-6 py-5 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Entidad
                </th>
                <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Estado
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {audits.length > 0 ? (
                audits.map((audit) => {
                  const isSuccess = !audit.accion.includes("FAILED");
                  const actionName = audit.accion.split("_")[0];
                  const fullName = `${audit.membership?.user?.nombre ?? ""} ${audit.membership?.user?.apellido ?? ""}`.trim();
                  const username = audit.membership?.username?.trim();
                  const userLabel =
                    fullName || username ? fullName || `@${username}` : "Sistema";

                  return (
                    <tr key={audit.id} className="group transition-colors hover:bg-accent/5">
                      <td className="px-6 py-5 text-xs font-medium text-muted-foreground">
                        {formatBogotaDateTime(audit.createdAt, "es-CO")}
                      </td>

                      <td className="px-6 py-5">
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate text-sm font-black uppercase tracking-tight text-foreground">
                            {userLabel}
                          </p>
                          <p className="truncate text-[10px] font-bold uppercase text-muted-foreground">
                            {username ? `@${username}` : "sistema"}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-5">
                        <span
                          className={cn(
                            "text-sm font-bold uppercase tracking-tight",
                            actionName === "CREACIÓN"
                              ? "text-emerald-500"
                              : actionName === "ACTUALIZACIÓN"
                                ? "text-amber-500"
                                : actionName === "ELIMINACIÓN"
                                  ? "text-red-500"
                                  : "text-accent",
                          )}
                        >
                          {actionName}
                        </span>
                      </td>

                      <td className="px-6 py-5">
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="rounded-lg bg-muted p-1.5 text-muted-foreground">
                              <Database className="h-3.5 w-3.5" />
                            </div>
                            <span className="truncate text-xs font-black uppercase tracking-tight text-foreground">
                              {audit.entidad}
                            </span>
                          </div>
                          <span className="w-fit max-w-full truncate rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground/70">
                            ID: {audit.entidadId}
                          </span>
                        </div>
                      </td>

                      <td className="flex items-center justify-end gap-3 px-6 py-5 text-right">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest shadow-sm",
                            isSuccess
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                              : "border-red-500/20 bg-red-500/10 text-red-500",
                          )}
                        >
                          {isSuccess ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <ShieldAlert className="h-3 w-3" />
                          )}
                          {isSuccess ? "EXITOSA" : "FALLIDA"}
                        </span>

                        <button
                          onClick={() => onOpenAudit(audit)}
                          aria-label={`Ver detalles de auditoría para ${audit.entidad}`}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-accent/10 hover:text-accent"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <History className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      No se encontraron registros
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/10 px-6 py-6">
          <div className="flex items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Mostrando {audits.length} de {meta.total} registros
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1 || isLoading}
              className="h-9 w-9 rounded-xl p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum = currentPage;
                if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;

                if (pageNum <= 0 || pageNum > totalPages) return null;

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    className={cn(
                      "h-9 w-9 rounded-xl p-0 text-[10px] font-black",
                      currentPage === pageNum
                        ? "bg-[#01ADFB] text-white shadow-lg shadow-[#01ADFB]/20"
                        : "",
                    )}
                    disabled={isLoading}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || isLoading}
              className="h-9 w-9 rounded-xl p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
