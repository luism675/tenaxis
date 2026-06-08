"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/components/ui/utils";
import { useUserRole } from "@/hooks/use-user-role";
import { exportToExcel } from "@/lib/utils/export-helper";
import {
  Award,
  Check,
  ChevronDown,
  Download,
  Eye,
  Loader2,
  Plus,
  Save,
  Search,
  Users,
  Mail,
  Phone,
  Car,
  MapPin,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { type Department, type Municipality } from "@/lib/api/geo-client";
import { TeamAlertsPanel } from "./team-alerts-panel";
import { TeamKpiStrip } from "./team-kpi-strip";
import { TeamMember, useTeamPerformance, type TeamTab } from "../hooks/use-team-performance";
import { formatBogotaDate, toBogotaYmd } from "@/utils/date-utils";

const RANKING_ROLES = ["ADMIN", "SU_ADMIN", "COORDINADOR", "ASESOR"];
type PerformanceView = "comercial" | "coordinacion" | "gerencia";

const PERFORMANCE_VIEWS: Array<{
  id: PerformanceView;
  label: string;
  description: string;
  roles: string[];
  accentClass: string;
}> = [
  {
    id: "comercial",
    label: "Vista Comercial",
    description: "Asesores con foco en conversión, ticket y recaudo.",
    roles: ["ASESOR"],
    accentClass: "text-[#01ADFB]",
  },
  {
    id: "coordinacion",
    label: "Vista Coordinación",
    description: "Coordinadores con foco en control operativo y calidad.",
    roles: ["COORDINADOR"],
    accentClass: "text-amber-600",
  },
  {
    id: "gerencia",
    label: "Vista Gerencia",
    description: "Administradores con foco en cartera, volumen y recaudo.",
    roles: ["ADMIN", "SU_ADMIN"],
    accentClass: "text-indigo-600",
  },
];

type ManageableRole = "SU_ADMIN" | "ADMIN" | "COORDINADOR" | "ASESOR" | "OPERADOR";

const ROLE_LABELS: Record<ManageableRole, string> = {
  SU_ADMIN: "Superadministrador",
  ADMIN: "Administrador",
  COORDINADOR: "Coordinador",
  ASESOR: "Asesor",
  OPERADOR: "Operador",
};

const MANAGEABLE_MEMBER_ROLES_BY_ACTOR: Record<ManageableRole, ManageableRole[]> = {
  SU_ADMIN: ["ADMIN", "COORDINADOR", "ASESOR", "OPERADOR"],
  ADMIN: ["ADMIN", "COORDINADOR", "ASESOR", "OPERADOR"],
  COORDINADOR: ["ASESOR", "OPERADOR"],
  ASESOR: [],
  OPERADOR: [],
};

const getPerformanceViewForRole = (role: string): PerformanceView => {
  if (role === "ASESOR") return "comercial";
  if (role === "COORDINADOR") return "coordinacion";
  return "gerencia";
};

const sortMembersByView = (members: TeamMember[], view: PerformanceView) => {
  const rows = [...members];

  if (view === "comercial") {
    return rows.sort((a, b) =>
      (b.conversionRate ?? 0) - (a.conversionRate ?? 0)
      || (b.avgTicket ?? 0) - (a.avgTicket ?? 0)
      || b.totalRecaudo - a.totalRecaudo,
    );
  }

  if (view === "coordinacion") {
    return rows.sort((a, b) =>
      (a.agedPending ?? 0) - (b.agedPending ?? 0)
      || (a.reworkRate ?? 0) - (b.reworkRate ?? 0)
      || b.efectividad - a.efectividad,
    );
  }

  return rows.sort((a, b) =>
    (a.overdueDebt ?? 0) - (b.overdueDebt ?? 0)
    || b.totalRecaudo - a.totalRecaudo
    || b.totalServicios - a.totalServicios,
  );
};

const VIEW_EXPLANATIONS: Record<
  PerformanceView,
  {
    ranking: string;
    panel: string;
    detail: string;
  }
> = {
  comercial: {
    ranking: "Ordena a los asesores priorizando conversion, ticket promedio y recaudo del periodo.",
    panel: "Estas tarjetas resumen resultados comerciales individuales del asesor seleccionado.",
    detail: "Aqui ves produccion, conversion y riesgo del asesor dentro del periodo filtrado.",
  },
  coordinacion: {
    ranking: "Ordena a los coordinadores priorizando menos pendientes vencidos, menor retrabajo y mejor efectividad.",
    panel: "Estas tarjetas resumen control operativo y calidad del coordinador seleccionado.",
    detail: "Aqui ves seguimiento operativo, riesgo y salud de ejecucion del coordinador en el periodo.",
  },
  gerencia: {
    ranking: "Ordena a administradores y superadministradores priorizando menor cartera pendiente, mayor recaudo y volumen de gestion.",
    panel: "Estas tarjetas resumen salud financiera y cumplimiento general del perfil gerencial seleccionado.",
    detail: "Aqui ves resultados consolidados y alertas de salud operativa para el perfil gerencial.",
  },
};

const teamComboboxTriggerClass =
  "h-9 rounded-[4px] border-border bg-background px-3 py-2 text-left text-[12px] font-medium text-foreground shadow-sm transition-all hover:bg-muted/40 focus:border-[#01ADFB]/30 focus:bg-card focus:ring-2 focus:ring-[#01ADFB]/15 disabled:bg-muted/40";
const teamComboboxContentClass =
  "mt-1 rounded-[5px] border-border bg-card shadow-xl [&_input]:h-9 [&_input]:text-[12px] [&_button]:rounded-[4px] [&_button]:py-2 [&_button]:text-[11px] [&_button]:font-medium";

type GeoScopeInput = {
  departmentIds?: string[] | null;
  municipalityIds?: string[] | null;
  municipioId?: string | null;
};

type GeoScopeResolution = {
  departmentIds: string[];
  municipalityIds: string[];
  departmentNames: string[];
  municipalityNames: string[];
  legacyMunicipioId: string | null;
  hasExplicitScope: boolean;
  summary: string;
};

type GeoOption = {
  value: string;
  label: string;
  hint?: string;
};

const normalizeIdList = (ids?: string[] | null) =>
  Array.from(new Set((ids ?? []).filter((id): id is string => Boolean(id))));

const resolveGeoScope = (
  source: GeoScopeInput | null | undefined,
  departments: Department[],
  municipalities: Municipality[],
): GeoScopeResolution => {
  const departmentIdMap = new Map(departments.map((department) => [department.id, department.name]));
  const municipalityById = new Map(municipalities.map((municipality) => [municipality.id, municipality]));

  const explicitDepartmentIds = normalizeIdList(source?.departmentIds);
  const explicitMunicipalityIds = normalizeIdList(source?.municipalityIds);
  const legacyMunicipioId = source?.municipioId || null;

  const municipalityIds = explicitMunicipalityIds.length
    ? explicitMunicipalityIds
    : legacyMunicipioId
      ? [legacyMunicipioId]
      : [];

  const municipalityDepartmentIds = municipalityIds
    .map((municipalityId) => municipalityById.get(municipalityId)?.departmentId)
    .filter((departmentId): departmentId is string => Boolean(departmentId));

  const departmentIds = explicitDepartmentIds.length
    ? explicitDepartmentIds
    : Array.from(new Set(municipalityDepartmentIds));

  const departmentNames = departmentIds
    .map((departmentId) => departmentIdMap.get(departmentId))
    .filter((departmentName): departmentName is string => Boolean(departmentName));

  const municipalityNames = municipalityIds
    .map((municipalityId) => municipalityById.get(municipalityId)?.name || (municipalityId === legacyMunicipioId ? "Municipio legacy" : null))
    .filter((municipalityName): municipalityName is string => Boolean(municipalityName));

  const hasExplicitScope = departmentIds.length > 0 || explicitMunicipalityIds.length > 0 || Boolean(legacyMunicipioId);

  let summary = "Sin restricción geográfica explícita";
  if (departmentIds.length && municipalityIds.length) {
    summary = `Restringido por ${departmentIds.length} departamento${departmentIds.length === 1 ? "" : "s"} y ${municipalityIds.length} municipio${municipalityIds.length === 1 ? "" : "s"}`;
  } else if (departmentIds.length) {
    summary = `Restringido por ${departmentIds.length} departamento${departmentIds.length === 1 ? "" : "s"}`;
  } else if (municipalityIds.length) {
    summary = `Restringido por ${municipalityIds.length} municipio${municipalityIds.length === 1 ? "" : "s"}`;
  }

  return {
    departmentIds,
    municipalityIds,
    departmentNames,
    municipalityNames,
    legacyMunicipioId,
    hasExplicitScope,
    summary,
  };
};

interface GeoMultiSelectProps {
  label: string;
  placeholder: string;
  options: GeoOption[];
  value: string[];
  onChange: (nextValue: string[]) => void;
  disabled?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
}

function GeoMultiSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  emptyMessage = "No hay opciones para mostrar.",
  searchPlaceholder = "Buscar...",
}: GeoMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedCount = value.length;
  const selectedOptions = useMemo(
    () => options.filter((option) => value.includes(option.value)),
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const term = search.toLowerCase().trim();
    return options.filter((option) =>
      option.label.toLowerCase().includes(term)
      || (option.hint || "").toLowerCase().includes(term),
    );
  }, [options, search]);

  const toggleValue = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((currentValue) => currentValue !== optionValue));
      return;
    }

    onChange([...value, optionValue]);
  };

  return (
    <div className="space-y-2">
      <Label className="text-[9px] font-black uppercase text-muted-foreground ml-1">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "flex h-9 w-full justify-between rounded-[4px] border border-border bg-background px-3 text-left text-[12px] font-medium text-foreground shadow-sm hover:bg-muted/40 focus:border-[#01ADFB]/30 focus:bg-card focus:ring-2 focus:ring-[#01ADFB]/15",
              !selectedCount && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {selectedCount
                ? `${selectedCount} seleccionado${selectedCount === 1 ? "" : "s"}`
                : placeholder}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] rounded-[5px] border-border p-3 shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </p>
              {value.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-[10px]"
                  onClick={() => onChange([])}
                >
                  Limpiar
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="border-none bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
              />
            </div>

            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => {
                  const selected = value.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleValue(option.value)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-all hover:bg-muted/60",
                        selected ? "border-[#01ADFB]/30 bg-[#01ADFB]/10 text-foreground" : "border-border bg-background",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{option.label}</span>
                        {option.hint ? (
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                            {option.hint}
                          </span>
                        ) : null}
                      </span>
                      {selected ? (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#01ADFB] text-white">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="h-6 w-6 shrink-0 rounded-full border border-border" />
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center gap-1 py-8 text-center">
                  <p className="text-sm font-semibold text-muted-foreground">{emptyMessage}</p>
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {selectedOptions.slice(0, 4).map((option) => (
            <Badge key={option.value} variant="outline" className="rounded-[4px] border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-foreground">
              {option.label}
            </Badge>
          ))}
          {selectedOptions.length > 4 ? (
            <Badge variant="outline" className="rounded-[4px] border-border bg-muted/40 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              +{selectedOptions.length - 4}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TeamPageContent({ view }: { view: TeamTab }) {
  const { tenantId, role: currentRole, isGlobalSuAdmin, checkPermission, isLoading: isLoadingRole } = useUserRole();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchSnapshot = useMemo(
    () => new URLSearchParams(searchParams.toString()),
    [searchParams],
  );
  const [rankingView, setRankingView] = useState<PerformanceView>("comercial");
  const activeRankingView = useMemo(
    () => PERFORMANCE_VIEWS.find((option) => option.id === rankingView) ?? PERFORMANCE_VIEWS[0],
    [rankingView],
  );
  const rankingRoleOverride =
    view === "ranking"
      ? activeRankingView.roles
      : undefined;

  // Redirigir o bloquear si no tiene permisos
  useEffect(() => {
    if (!isLoadingRole && !checkPermission("TEAM_VIEW")) {
      router.replace("/dashboard");
    }
  }, [isLoadingRole, checkPermission, router]);

  const {
    filters,
    setFilters,
    loading,
    error,
    refresh,
    data,
    members,
    allRoles,
    departments,
    municipalities,
    selectedMemberId,
    setSelectedMemberId,
    memberDetailById,
    fetchMemberDetail,
    loadingDetail,
    updateMemberProfile,
    savingProfile,
  } = useTeamPerformance(
    isGlobalSuAdmin ? "global" : (tenantId ?? null),
    searchSnapshot,
    {
      ignoreRoleFilter: view === "ranking",
      roleOverride: rankingRoleOverride,
    },
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<TeamMember | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const selectedUser = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || null,
    [members, selectedMemberId],
  );

  const selectedDetail = selectedUser ? memberDetailById[selectedUser.id] : null;

  const editGeoScope = useMemo(
    () => resolveGeoScope(editForm, departments, municipalities),
    [departments, editForm, municipalities],
  );

  const selectedGeoScope = selectedUser
    ? resolveGeoScope(
      {
        departmentIds: selectedUser.departmentIds,
        municipalityIds: selectedUser.municipalityIds,
        municipioId: selectedUser.municipioId,
      },
      departments,
      municipalities,
    )
    : selectedDetail?.member
      ? resolveGeoScope(
        {
          departmentIds: selectedDetail.member.departmentIds,
          municipalityIds: selectedDetail.member.municipalityIds,
        },
        departments,
        municipalities,
      )
      : resolveGeoScope(null, departments, municipalities);

  const rankingMembers = useMemo(() => {
    return sortMembersByView(
      members.filter(
        (member) =>
          RANKING_ROLES.includes(member.role)
          && activeRankingView.roles.includes(member.role),
      ),
      rankingView,
    );
  }, [activeRankingView, members, rankingView]);
  const selectedUserView = selectedUser
    ? getPerformanceViewForRole(selectedUser.role)
    : rankingView;
  const selectedViewMeta =
    PERFORMANCE_VIEWS.find((view) => view.id === selectedUserView) ?? PERFORMANCE_VIEWS[0];

  const getRankingColumns = (view: PerformanceView) => {
    if (view === "comercial") {
      return {
        primaryLabel: "Conversión",
        secondaryLabel: "Ticket Promedio",
        tertiaryLabel: "Recaudo",
      };
    }

    if (view === "coordinacion") {
      return {
        primaryLabel: "Pend. Vencidos",
        secondaryLabel: "Re-trabajo",
        tertiaryLabel: "Efectividad",
      };
    }

    return {
      primaryLabel: "Cartera",
      secondaryLabel: "Servicios",
      tertiaryLabel: "Recaudo",
    };
  };

  const getRankingMetrics = (member: TeamMember, view: PerformanceView) => {
    if (view === "comercial") {
      return {
        primary: `${member.conversionRate ?? 0}%`,
        primaryClass: "text-[#01ADFB]",
        secondary: `$${(member.avgTicket ?? 0).toLocaleString("es-CO")}`,
        tertiary: `$${member.totalRecaudo.toLocaleString("es-CO")}`,
      };
    }

    if (view === "coordinacion") {
      return {
        primary: `${member.agedPending ?? 0}`,
        primaryClass: "text-amber-600",
        secondary: `${member.reworkRate ?? 0}%`,
        tertiary: `${member.efectividad}%`,
      };
    }

    return {
      primary: `$${(member.overdueDebt ?? 0).toLocaleString("es-CO")}`,
      primaryClass: "text-indigo-600",
      secondary: `${member.totalServicios}`,
      tertiary: `$${member.totalRecaudo.toLocaleString("es-CO")}`,
    };
  };

  const detailSections = selectedDetail ? (() => {
    if (selectedUserView === "comercial") {
      return [
        {
          title: "Producción Comercial",
          description: "Mide captacion, conversion y monetizacion de los servicios creados por el asesor.",
          cards: [
            { label: "Clientes creados", value: selectedDetail.metrics.clientesCreados.toString(), valueClass: "text-foreground" },
            { label: "Conversión", value: `${selectedDetail.metrics.conversionRate ?? 0}%`, valueClass: "text-indigo-600" },
            { label: "Ticket Promedio", value: `$${(selectedDetail.metrics.avgTicket ?? 0).toLocaleString("es-CO")}`, valueClass: "text-emerald-600" },
            { label: "Días Liquidación", value: `${selectedDetail.metrics.avgLiquidationDays ?? 0}d`, valueClass: "text-amber-600" },
            { label: "Efectividad", value: `${selectedDetail.metrics.efectividad ?? 0}%`, valueClass: "text-[#01ADFB]" },
          ],
        },
        {
          title: "Riesgo Operativo",
          description: "Resume fricciones que afectan el cierre, la cobranza y la calidad del servicio.",
          cards: [
            { label: "Cartera Pendiente", value: `$${(selectedDetail.metrics.overdueDebt ?? 0).toLocaleString("es-CO")}`, valueClass: "text-red-600" },
            { label: "Cancelaciones", value: `${selectedDetail.metrics.cancellations ?? 0}`, valueClass: "text-zinc-600" },
            { label: "Pendientes Vencidos", value: `${selectedDetail.metrics.agedPending ?? 0}`, valueClass: "text-orange-600" },
            { label: "Tasa Re-trabajo", value: `${selectedDetail.metrics.reworkRate ?? 0}%`, valueClass: "text-purple-600" },
          ],
        },
      ];
    }

    if (selectedUserView === "coordinacion") {
      return [
        {
          title: "Control Operativo",
          description: "Muestra capacidad de seguimiento, cumplimiento y calidad de ejecucion del coordinador.",
          cards: [
            { label: "Servicios liderados", value: selectedDetail.metrics.totalServicios.toString(), valueClass: "text-foreground" },
            { label: "Liquidados", value: selectedDetail.metrics.serviciosLiquidados.toString(), valueClass: "text-emerald-600" },
            { label: "Pend. Vencidos", value: `${selectedDetail.metrics.agedPending ?? 0}`, valueClass: "text-amber-600" },
            { label: "Re-trabajo", value: `${selectedDetail.metrics.reworkRate ?? 0}%`, valueClass: "text-purple-600" },
            { label: "Efectividad", value: `${selectedDetail.metrics.efectividad ?? 0}%`, valueClass: "text-[#01ADFB]" },
          ],
        },
        {
          title: "Riesgo y Seguimiento",
          description: "Agrupa alertas de pendientes, cancelaciones, cartera y recaudo del periodo.",
          cards: [
            { label: "Pendientes", value: `${selectedDetail.metrics.pendientes ?? 0}`, valueClass: "text-orange-600" },
            { label: "Cancelaciones", value: `${selectedDetail.metrics.cancellations ?? 0}`, valueClass: "text-zinc-600" },
            { label: "Cartera Pendiente", value: `$${(selectedDetail.metrics.overdueDebt ?? 0).toLocaleString("es-CO")}`, valueClass: "text-red-600" },
            { label: "Recaudo", value: `$${(selectedDetail.metrics.totalRecaudo ?? 0).toLocaleString("es-CO")}`, valueClass: "text-emerald-600" },
          ],
        },
      ];
    }

    return [
      {
        title: "Resumen Gerencial",
        description: "Consolida volumen, recaudo, cartera y efectividad para evaluar gestion general.",
        cards: [
          { label: "Servicios", value: selectedDetail.metrics.totalServicios.toString(), valueClass: "text-foreground" },
          { label: "Liquidados", value: selectedDetail.metrics.serviciosLiquidados.toString(), valueClass: "text-emerald-600" },
          { label: "Recaudo", value: `$${(selectedDetail.metrics.totalRecaudo ?? 0).toLocaleString("es-CO")}`, valueClass: "text-emerald-600" },
          { label: "Cartera", value: `$${(selectedDetail.metrics.overdueDebt ?? 0).toLocaleString("es-CO")}`, valueClass: "text-red-600" },
          { label: "Efectividad", value: `${selectedDetail.metrics.efectividad ?? 0}%`, valueClass: "text-indigo-600" },
        ],
      },
      {
        title: "Salud Operativa",
        description: "Resume fricciones operativas que pueden impactar el cumplimiento del equipo.",
        cards: [
          { label: "Pendientes", value: `${selectedDetail.metrics.pendientes ?? 0}`, valueClass: "text-orange-600" },
          { label: "Pend. Vencidos", value: `${selectedDetail.metrics.agedPending ?? 0}`, valueClass: "text-amber-600" },
          { label: "Re-trabajo", value: `${selectedDetail.metrics.reworkRate ?? 0}%`, valueClass: "text-purple-600" },
          { label: "Cancelaciones", value: `${selectedDetail.metrics.cancellations ?? 0}`, valueClass: "text-zinc-600" },
        ],
      },
    ];
  })() : [];

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("from", filters.from);
    params.set("to", filters.to);
    params.set("scope", filters.scope);
    if (filters.search) params.set("q", filters.search);
    if (view !== "ranking" && filters.role) params.set("role", filters.role);
    if (filters.municipioId) params.set("municipioId", filters.municipioId);
    if (filters.empresaId) params.set("empresaId", filters.empresaId);
    if (filters.zonaId) params.set("zonaId", filters.zonaId);
    if (filters.activo !== undefined) params.set("activo", String(filters.activo));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [filters, pathname, router, view]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchMemberDetail(selectedMemberId);
    }
  }, [fetchMemberDetail, selectedMemberId]);

  const departmentScopeOptions = useMemo<GeoOption[]>(
    () => departments.map((department) => ({ value: department.id, label: department.name, hint: department.code })),
    [departments],
  );

  const municipalityScopeOptions = useMemo<GeoOption[]>(() => {
    const scopedDepartmentIds = normalizeIdList(editForm?.departmentIds);
    const visibleMunicipalities = scopedDepartmentIds.length > 0
      ? municipalities.filter((municipality) => scopedDepartmentIds.includes(municipality.departmentId))
      : municipalities;

    return visibleMunicipalities.map((municipality) => {
      const parentDepartment = departments.find((department) => department.id === municipality.departmentId);
      return {
        value: municipality.id,
        label: municipality.name,
        hint: parentDepartment ? parentDepartment.name : municipality.code,
      };
    });
  }, [departments, editForm?.departmentIds, municipalities]);

  const manageableRoles = useMemo<ManageableRole[]>(() => {
    const actorRole = (currentRole && currentRole in MANAGEABLE_MEMBER_ROLES_BY_ACTOR)
      ? (currentRole as ManageableRole)
      : null;
    const baseRoles = actorRole ? MANAGEABLE_MEMBER_ROLES_BY_ACTOR[actorRole] : [];
    return isGlobalSuAdmin ? ["SU_ADMIN", ...baseRoles] : baseRoles;
  }, [currentRole, isGlobalSuAdmin]);

  const editableRoleOptions = useMemo(
    () => manageableRoles.map((role: ManageableRole) => ({ value: role, label: ROLE_LABELS[role] })),
    [manageableRoles],
  );

  const canManageMemberRole = (role: string) => {
    if (!(role in ROLE_LABELS)) {
      return false;
    }

    return manageableRoles.includes(role as ManageableRole);
  };

  const handleOpenEdit = () => {
    if (!selectedUser) return;
    if (!canManageMemberRole(selectedUser.role)) {
      toast.error("No puedes editar usuarios con ese rol desde tu perfil actual");
      return;
    }

    const initialMunicipalityIds = normalizeIdList(
      selectedDetail?.member.municipalityIds
      ?? selectedUser.municipalityIds
      ?? (selectedUser.municipioId ? [selectedUser.municipioId] : []),
    );

    const initialDepartmentIds = normalizeIdList(
      selectedDetail?.member.departmentIds
      ?? selectedUser.departmentIds
      ?? initialMunicipalityIds
        .map((municipalityId) => municipalities.find((municipality) => municipality.id === municipalityId)?.departmentId)
        .filter((departmentId): departmentId is string => Boolean(departmentId)),
    );

    const nextDepartmentIds = initialDepartmentIds.length
      ? initialDepartmentIds
      : Array.from(
        new Set(
          initialMunicipalityIds
            .map((municipalityId) => municipalities.find((municipality) => municipality.id === municipalityId)?.departmentId)
            .filter((departmentId): departmentId is string => Boolean(departmentId)),
        ),
      );

    setEditForm({
      ...selectedUser,
      departmentIds: nextDepartmentIds,
      municipalityIds: initialMunicipalityIds,
    });
    setIsEditing(true);
  };

  const handleDepartmentScopeChange = (nextDepartmentIds: string[]) => {
    setEditForm((prev) => {
      if (!prev) return prev;

      const allowedMunicipalityIds = new Set(
        nextDepartmentIds.length > 0
          ? municipalities
            .filter((municipality) => nextDepartmentIds.includes(municipality.departmentId))
            .map((municipality) => municipality.id)
          : municipalities.map((municipality) => municipality.id),
      );

      const preservedMunicipalityIds = normalizeIdList(prev.municipalityIds).filter((municipalityId) => allowedMunicipalityIds.has(municipalityId));

      return {
        ...prev,
        departmentIds: normalizeIdList(nextDepartmentIds),
        municipalityIds: preservedMunicipalityIds,
      };
    });
  };

  const handleMunicipalityScopeChange = (nextMunicipalityIds: string[]) => {
    setEditForm((prev) => {
      if (!prev) return prev;

      const normalizedMunicipalityIds = normalizeIdList(nextMunicipalityIds);
      const inferredDepartmentIds = normalizedMunicipalityIds.length > 0
        ? Array.from(
          new Set(
            normalizedMunicipalityIds
              .map((municipalityId) => municipalities.find((municipality) => municipality.id === municipalityId)?.departmentId)
              .filter((departmentId): departmentId is string => Boolean(departmentId)),
          ),
        )
        : [];

      return {
        ...prev,
        departmentIds: prev.departmentIds?.length ? normalizeIdList(prev.departmentIds) : inferredDepartmentIds,
        municipalityIds: normalizedMunicipalityIds,
      };
    });
  };

  const handleClearGeoScope = () => {
    setEditForm((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        municipioId: undefined,
        municipioNombre: "",
        departmentIds: [],
        municipalityIds: [],
      };
    });
  };

  const handleSave = async () => {
    if (!editForm) return;
    const parts = editForm.name.trim().split(" ");
    const nombre = parts[0] || "";
    const apellido = parts.slice(1).join(" ");
    const explicitMunicipalityIds = normalizeIdList(editForm.municipalityIds);
    const effectiveMunicipalityIds = explicitMunicipalityIds.length
      ? explicitMunicipalityIds
      : editForm.municipioId
        ? [editForm.municipioId]
        : [];
    const effectiveDepartmentIds = normalizeIdList(
      editForm.departmentIds?.length
        ? editForm.departmentIds
        : effectiveMunicipalityIds
          .map((municipalityId) => municipalities.find((municipality) => municipality.id === municipalityId)?.departmentId)
          .filter((departmentId): departmentId is string => Boolean(departmentId)),
    );

    const ok = await updateMemberProfile(editForm.id, {
      nombre,
      apellido,
      email: editForm.email,
      telefono: editForm.phone,
      placa: editForm.placa || undefined,
      moto: editForm.moto ?? undefined,
      direccion: editForm.direccion || undefined,
      municipioId: editForm.municipioId || effectiveMunicipalityIds[0] || undefined,
      departmentIds: effectiveDepartmentIds,
      municipalityIds: effectiveMunicipalityIds,
      role: editForm.role,
      empresaIds: editForm.empresaIds,
    });

    if (ok) {
      setIsEditing(false);
      setEditForm(null);
    }
  };

  const handleExport = () => {
    const headers = [
      "Nombre",
      "Email",
      "Teléfono",
      "Rol",
      "Municipio",
      "Total Servicios",
      "Liquidados",
      "Pendientes",
      "Efectividad (%)",
      "Total Recaudo",
    ];
    const rows = members.map((u) => [
      u.name,
      u.email,
      u.phone,
      u.role,
      u.municipioNombre || "",
      u.totalServicios,
      u.serviciosLiquidados,
      u.pendientes,
      u.efectividad,
      u.totalRecaudo,
    ]);

    const date = toBogotaYmd();
    exportToExcel({
      headers,
      data: rows,
      filename: `equipo_trabajo_${date}`,
      title: "Reporte de Equipo de Trabajo",
    });
  };

  const handleExportSelectedDetail = () => {
    if (!selectedUser || !selectedDetail) return;

    const headers = [
      "Orden",
      "Fecha",
      "Cliente",
      "Estado",
      "Valor pagado",
    ];
    const rows = selectedDetail.orders.map((order) => [
      order.orderNumber,
      order.date ? formatBogotaDate(order.date, "es-CO") : "N/A",
      order.client,
      order.status,
      order.paidValue,
    ]);

    const date = toBogotaYmd();
    exportToExcel({
      headers,
      data: rows,
      filename: `detalle_equipo_${selectedUser.name.toLowerCase().replace(/\s+/g, "_")}_${date}`,
      title: `Detalle de ${selectedUser.name}`,
    });
  };

  if ((loading && !data) || isLoadingRole) {
    return (
      <DashboardLayout>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#01ADFB]" />
        </div>
      </DashboardLayout>
    );
  }

  // Si después de cargar el rol, no tiene permiso para ver el equipo, no renderizamos el contenido
  if (!checkPermission("TEAM_VIEW")) {
    return null; // O un layout de fallback. El useEffect ya se encargará de redirigir.
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1600px] space-y-4">
        {/* Header Section */}
        <div className="rounded-[5px] border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/40 text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Equipo de trabajo
                </p>
                <h1 className="truncate text-[18px] font-medium tracking-tight text-foreground">
                  {view === "ranking" ? "Ranking de desempeño" : "Gestión de usuarios"}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-muted/40 px-2 py-1">
                    <Users className="h-3 w-3 text-[#01ADFB]" />
                    <span>{members.length} Integrantes</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-muted/40 px-2 py-1">
                    <Award className="h-3 w-3 text-[#01ADFB]" />
                    <span>Vista gerencial</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {checkPermission("TEAM_EXPORT") && (
                <button
                  onClick={handleExport}
                  className="inline-flex h-8 items-center gap-2 rounded-[4px] border border-border bg-card px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>
              )}
              <button
                onClick={refresh}
                className="inline-flex h-8 items-center gap-2 rounded-[4px] bg-[#01ADFB] px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 transition-colors hover:bg-[#0197dc] disabled:opacity-50"
                disabled={loading}
              >
                <Loader2 className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                Refrescar
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="flex items-center justify-between rounded-[5px] border border-red-500/20 bg-red-500/10 p-4 text-red-600">
            <p className="text-[12px] font-medium">{error}</p>
            <button className="h-8 rounded-[4px] bg-red-500 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white" onClick={refresh}>Reintentar</button>
          </div>
        ) : null}

        {view === "ranking" && data?.kpis ? <TeamKpiStrip kpis={data.kpis} /> : null}
        {view === "ranking" && data?.alerts ? <TeamAlertsPanel alerts={data.alerts} /> : null}

        {/* Filters and Tabs Section */}
        <div className="rounded-[5px] border border-border bg-card shadow-sm">
          <div className="grid gap-3 border-b border-border px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:px-5">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {view === "ranking" ? "Rendimiento del equipo" : "Gestión de usuarios"}
              </p>
              <h2 className="mt-1 text-[15px] font-medium tracking-tight text-foreground">
                {view === "ranking" ? "Ranking" : "Usuarios"}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[240px] flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 rounded-[4px] border-border bg-muted/50 pl-9 text-[12px] font-medium text-foreground shadow-sm transition-all focus:border-[#01ADFB]/30 focus:bg-card focus:ring-2 focus:ring-[#01ADFB]/15"
                  placeholder="Buscar integrante..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({
                      ...prev,
                      search: e.target.value,
                      page: 1,
                    }))
                  }
                />
              </div>
              {checkPermission("TEAM_CREATE") && (
                <Link
                  href="/dashboard/equipo-trabajo/nuevo"
                  className="inline-flex h-9 min-w-[150px] items-center justify-center gap-2 rounded-[4px] bg-[#01ADFB] px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 transition-colors hover:bg-[#0197dc]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo Usuario
                </Link>
              )}
            </div>
          </div>

          <div
            className={cn(
              "grid gap-3 px-4 py-3 lg:px-5",
              view === "ranking"
                ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-5"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {view === "ranking" ? (
              <>
                <Input
                  type="date"
                  className="h-9 rounded-[4px] border-border bg-background text-[12px] font-medium"
                  value={filters.from}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, from: e.target.value }))
                  }
                />
                <Input
                  type="date"
                  className="h-9 rounded-[4px] border-border bg-background text-[12px] font-medium"
                  value={filters.to}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, to: e.target.value }))
                  }
                />
              </>
            ) : null}
            {view !== "ranking" ? (
              <Combobox
                options={[
                  { value: "", label: "Todos los roles" },
                  ...allRoles.map((role) => ({ value: role, label: role })),
                ]}
                value={filters.role || ""}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    role: value || undefined,
                    page: 1,
                  }))
                }
                placeholder="Filtrar rol"
                triggerClassName={teamComboboxTriggerClass}
                contentClassName={teamComboboxContentClass}
                hideSearch
              />
            ) : null}
            <Combobox
              options={[
                { value: "", label: "Todos los municipios" },
                ...municipalities.map((m) => ({
                  value: m.id,
                  label: m.name,
                })),
              ]}
              value={filters.municipioId || ""}
              onChange={(value) =>
                setFilters((prev) => ({
                  ...prev,
                  municipioId: value || undefined,
                  page: 1,
                }))
              }
              placeholder="Filtrar municipio"
              triggerClassName={teamComboboxTriggerClass}
              contentClassName={teamComboboxContentClass}
            />
            {(currentRole === "ADMIN" || currentRole === "SU_ADMIN") && (
              <Combobox
                options={[
                  { value: "true", label: "Solo Activos" },
                  { value: "false", label: "Solo Suspendidos" },
                  { value: "all", label: "Todos los estados" },
                ]}
                value={filters.activo === true ? "true" : filters.activo === false ? "false" : "all"}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    activo: value === "true" ? true : value === "false" ? false : undefined,
                    page: 1,
                  }))
                }
                placeholder="Estado de usuario"
                triggerClassName={teamComboboxTriggerClass}
                contentClassName={teamComboboxContentClass}
                hideSearch
              />
            )}
            {view === "ranking" ? (
              <Combobox
                options={[
                  { value: "todos", label: "Todo el equipo" },
                  { value: "operativo", label: "Solo operación" },
                ]}
                value={filters.scope}
                onChange={(value) =>
                  setFilters((prev) => ({
                    ...prev,
                    scope: (value as "operativo" | "todos") || "todos",
                  }))
                }
                placeholder="Cobertura"
                triggerClassName={teamComboboxTriggerClass}
                contentClassName={teamComboboxContentClass}
                hideSearch
              />
            ) : null}
          </div>
        </div>

        {/* Content Tables */}
        <div>
          {view === "ranking" ? (
            <div className="overflow-hidden rounded-[5px] border border-border bg-card shadow-sm">
              <div className="border-b border-border bg-card px-4 py-3 lg:px-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Ranking por vista
                    </p>
                    <h3 className="mt-1 text-[15px] font-medium tracking-tight text-foreground">
                      {activeRankingView.label}
                    </h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {activeRankingView.description}
                    </p>
                    <p className="mt-2 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                      {VIEW_EXPLANATIONS[rankingView].ranking}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PERFORMANCE_VIEWS.map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => {
                          setRankingView(view.id);
                          setSelectedMemberId(null);
                          setFilters((prev) => ({ ...prev, page: 1 }));
                        }}
                        className={cn(
                          "h-8 rounded-[4px] border px-3 text-[10px] font-medium uppercase tracking-[0.08em] transition-colors",
                          rankingView === view.id
                            ? "border-[#01ADFB] bg-[#01ADFB] text-white shadow-sm shadow-[#01ADFB]/20"
                            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-3 border-b border-border bg-muted/30 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3 lg:px-5">
                <p>
                  <span className="font-medium text-foreground">{getRankingColumns(rankingView).primaryLabel}:</span>{" "}
                  {rankingView === "comercial"
                    ? "porcentaje de clientes o servicios que convierten en resultado efectivo."
                    : rankingView === "coordinacion"
                      ? "cantidad de casos atrasados que aun requieren gestion."
                      : "valor pendiente por cobrar dentro del periodo analizado."}
                </p>
                <p>
                  <span className="font-medium text-foreground">{getRankingColumns(rankingView).secondaryLabel}:</span>{" "}
                  {rankingView === "comercial"
                    ? "valor promedio recaudado por cada servicio liquidado."
                    : rankingView === "coordinacion"
                      ? "porcentaje de casos que debieron corregirse o rehacerse."
                      : "numero total de servicios gestionados en el periodo."}
                </p>
                <p>
                  <span className="font-medium text-foreground">{getRankingColumns(rankingView).tertiaryLabel}:</span>{" "}
                  {rankingView === "coordinacion"
                    ? "porcentaje de servicios liquidados frente a los gestionados."
                    : "valor total recaudado dentro del rango de fechas seleccionado."}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:px-4">Pos</th>
                      <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:px-4">Usuario</th>
                      <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:px-4">Rol</th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:px-4">{getRankingColumns(rankingView).primaryLabel}</th>
                      <th className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:px-4">{getRankingColumns(rankingView).secondaryLabel}</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:px-4">{getRankingColumns(rankingView).tertiaryLabel}</th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:px-4">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rankingMembers.map((member, index) => (
                      <tr
                        key={member.id}
                        className={cn(
                          "group transition-colors hover:bg-muted/40",
                          index === 0 && "bg-amber-500/5",
                          index === 1 && "bg-slate-400/5",
                          index === 2 && "bg-orange-500/5",
                        )}
                      >
                        <td className="px-3 py-3 lg:px-4">
                          <span className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-[4px] text-[11px] font-medium",
                            index === 0 ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20" :
                            index === 1 ? "bg-slate-400 text-white shadow-sm shadow-slate-400/20" :
                            index === 2 ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3 lg:px-4">
                          <div className="flex flex-col">
                            <span className="text-[12px] font-medium leading-5 text-foreground">{member.name}</span>
                            <span className="text-[10px] text-muted-foreground">{member.email}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 lg:px-4">
                          <span className="inline-flex rounded border border-border bg-muted/50 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            {member.role}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center lg:px-4">
                          <span className={cn("text-[13px] font-semibold tabular-nums", getRankingMetrics(member, rankingView).primaryClass)}>
                            {getRankingMetrics(member, rankingView).primary}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center lg:px-4">
                          <span className="text-[12px] font-medium tabular-nums text-foreground">
                            {getRankingMetrics(member, rankingView).secondary}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right text-[12px] font-semibold tabular-nums text-emerald-600 lg:px-4">
                          {getRankingMetrics(member, rankingView).tertiary}
                        </td>
                        <td className="px-3 py-3 text-right lg:px-4">
                          <button
                            className="inline-flex h-8 w-8 items-center justify-center rounded-[4px] border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              setSelectedMemberId(member.id);
                              setShowDetailsModal(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rankingMembers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-16 text-center">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            No hay usuarios para esta vista con los filtros actuales
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="overflow-hidden rounded-[5px] border border-border bg-card shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Usuario</th>
                        <th className="px-4 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Rol</th>
                        <th className="px-4 py-2 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Servicios</th>
                        <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Recaudo</th>
                        <th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {members.map((member) => (
                        <tr key={member.id} className="group transition-colors hover:bg-muted/40">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-border bg-muted text-[11px] font-medium uppercase text-muted-foreground">
                                {member.name[0]}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[12px] font-medium text-foreground">
                                  {member.name}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground">
                                  {member.email || "Sin correo"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex rounded-[4px] border border-border bg-muted/50 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                              {member.role}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-[12px] font-medium tabular-nums text-foreground">{member.totalServicios}</td>
                          <td className="px-4 py-3 text-right text-[12px] font-semibold tabular-nums text-emerald-600">
                            ${member.totalRecaudo.toLocaleString("es-CO")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              className={cn(
                                "inline-flex h-8 w-8 items-center justify-center rounded-[4px] border transition-colors",
                                selectedMemberId === member.id
                                  ? "border-[#01ADFB] bg-[#01ADFB] text-white"
                                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                              onClick={() => {
                                setSelectedMemberId(member.id);
                                setIsEditing(false);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {members.length === 0 ? (
                    <div className="py-12 text-center">
                      <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">No se encontraron integrantes</p>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Selection Detail Card */}
              <div className="sticky top-4">
                {!selectedUser ? (
                  <Card className="flex min-h-[280px] flex-col items-center justify-center rounded-[5px] border border-dashed border-border bg-muted/30 p-6 text-center shadow-none">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[5px] border border-border bg-card">
                      <Users className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Panel de gestión</h3>
                    <p className="mt-2 max-w-[220px] text-xs text-muted-foreground">
                      Seleccioná un usuario para revisar o editar su perfil.
                    </p>
                  </Card>
                ) : (
                  <Card className="overflow-hidden rounded-[5px] border-border bg-card shadow-sm">
                    <div className="flex items-center gap-3 border-b border-border bg-muted/50 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-border bg-card text-[12px] font-medium uppercase text-foreground">
                        {(isEditing ? editForm?.name : selectedUser.name)?.[0] || "U"}
                      </div>
                      <div className="min-w-0">
                        <h2 className="line-clamp-1 text-[14px] font-medium text-foreground">
                          {isEditing ? (editForm?.name || "Editando...") : selectedUser.name}
                        </h2>
                        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          {isEditing ? (editForm?.role || "...") : selectedUser.role}
                        </span>
                      </div>
                    </div>

                    <CardContent className="px-0 py-4">
                      {!isEditing ? (
                        <div className="space-y-4">
                          {/* Info Detallada */}
                          <div className="space-y-3 px-4 text-[11px] font-medium text-foreground">
                            <div className="flex items-center gap-3">
                              <Mail className="h-4 w-4 text-muted-foreground/60" />
                              <p className="truncate">{selectedUser.email || "Sin correo"}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Phone className="h-4 w-4 text-muted-foreground/60" />
                              <p>{selectedUser.phone || "Sin teléfono"}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Car className="h-4 w-4 text-muted-foreground/60" />
                              <p className="uppercase">
                                {selectedUser.placa || "S/P"} - {selectedUser.moto ? "MOTO" : "CARRO"}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <MapPin className="h-4 w-4 text-muted-foreground/60" />
                              <p className="line-clamp-1">
                                {selectedUser.municipioNombre ? `${selectedUser.municipioNombre}, ` : ""}
                                {selectedUser.direccion || "Dirección no asignada"}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                              <Download className="h-4 w-4 text-emerald-500" />
                              <p className="text-sm font-semibold text-emerald-600">
                                ${selectedUser.totalRecaudo.toLocaleString("es-CO")}
                              </p>
                            </div>
                          </div>

                          <div className="px-4">
                            <div className="rounded-[5px] border border-border bg-muted/30 px-3 py-3">
                              <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                Alcance geográfico
                              </p>
                              <p className="mt-1 text-xs font-medium text-foreground">
                                {selectedGeoScope.summary}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {selectedGeoScope.departmentNames.length > 0 ? (
                                  selectedGeoScope.departmentNames.map((departmentName) => (
                                    <Badge
                                      key={departmentName}
                                      variant="outline"
                                      className="rounded-[4px] border-border bg-background px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-foreground"
                                    >
                                      {departmentName}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="rounded-[4px] border-dashed border-border bg-background px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                                  >
                                    Sin departamentos
                                  </Badge>
                                )}
                                {selectedGeoScope.municipalityNames.length > 0 ? (
                                  selectedGeoScope.municipalityNames.map((municipalityName) => (
                                    <Badge
                                      key={municipalityName}
                                      variant="outline"
                                      className="rounded-[4px] border-border bg-[#01ADFB]/5 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-[#01ADFB]"
                                    >
                                      {municipalityName}
                                    </Badge>
                                  ))
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="rounded-[4px] border-dashed border-border bg-background px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                                  >
                                    Sin municipios
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Acciones */}
                          <div className="flex flex-col gap-2 border-t border-border px-4 pt-4">
                            <div className="flex gap-2">
                              {checkPermission("TEAM_EDIT") && canManageMemberRole(selectedUser.role) && (
                                <button
                                  onClick={handleOpenEdit}
                                  className="h-8 flex-1 rounded-[4px] bg-[#01ADFB] text-[10px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#0195d9]"
                                >
                                  Editar perfil
                                </button>
                              )}
                              <button
                                onClick={() => setSelectedMemberId("")}
                                className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>

                            {checkPermission("TEAM_DELETE") && (
                              <button
                                onClick={async () => {
                                  if (confirm(`¿Estás seguro de que deseas eliminar a ${selectedUser.name} del equipo?`)) {
                                    const ok = await updateMemberProfile(selectedUser.id, {
                                      nombre: selectedUser.name,
                                      email: selectedUser.email,
                                      activo: false,
                                    });
                                    if (ok) {
                                      toast.success("Usuario inactivado correctamente");
                                      setSelectedMemberId(null);
                                    }
                                  }
                                }}
                                className="h-8 w-full rounded-[4px] border border-red-500/20 text-[10px] font-medium uppercase tracking-[0.08em] text-red-500 transition-colors hover:bg-red-500 hover:text-white"
                              >
                                Suspender integrante
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="max-h-[calc(100vh-260px)] space-y-4 overflow-y-auto px-4 pr-2 scrollbar-thin scrollbar-thumb-border">
                          <div className="space-y-1.5">
                            <Label className="ml-1 text-[9px] font-medium uppercase text-muted-foreground">Nombre completo</Label>
                            <Input
                              value={editForm?.name || ""}
                              onChange={(e) => setEditForm(prev => prev ? { ...prev, name: e.target.value } : null)}
                              className="h-9 rounded-[4px] border-border bg-background text-[12px] font-medium"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="ml-1 text-[9px] font-medium uppercase text-muted-foreground">Teléfono</Label>
                            <Input
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel"
                              value={editForm?.phone || ""}
                              onChange={(e) => setEditForm(prev => prev ? { ...prev, phone: e.target.value } : null)}
                              placeholder="+57 300 123 4567"
                              className="h-9 rounded-[4px] border-border bg-background text-[12px] font-medium"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="ml-1 text-[9px] font-medium uppercase text-muted-foreground">Rol</Label>
                              <Combobox
                                options={editableRoleOptions}
                                value={editForm?.role || ""}
                                onChange={(role) => setEditForm(prev => prev ? { ...prev, role } : null)}
                                triggerClassName={teamComboboxTriggerClass}
                                contentClassName={teamComboboxContentClass}
                                hideSearch
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="ml-1 text-[9px] font-medium uppercase text-muted-foreground">Municipio</Label>
                              <Combobox
                                options={municipalities.map(m => ({ value: m.id, label: m.name }))}
                                value={editForm?.municipioId || ""}
                                onChange={(mId) => {
                                  const mName = municipalities.find(m => m.id === mId)?.name || "";
                                  setEditForm(prev => prev ? { ...prev, municipioId: mId, municipioNombre: mName } : null);
                                }}
                                triggerClassName={teamComboboxTriggerClass}
                                contentClassName={teamComboboxContentClass}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="ml-1 text-[9px] font-medium uppercase text-muted-foreground">Placa</Label>
                              <Input
                                value={editForm?.placa || ""}
                                onChange={(e) => setEditForm(prev => prev ? { ...prev, placa: e.target.value.toUpperCase() } : null)}
                                className="h-9 rounded-[4px] border-border bg-background text-[12px] font-medium"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="ml-1 text-[9px] font-medium uppercase text-muted-foreground">Vehículo</Label>
                              <Combobox
                                options={[{ value: "MOTO", label: "Moto" }, { value: "CARRO", label: "Carro" }]}
                                value={editForm?.moto ? "MOTO" : "CARRO"}
                                onChange={(val) => setEditForm(prev => prev ? { ...prev, moto: val === "MOTO" } : null)}
                                triggerClassName={teamComboboxTriggerClass}
                                contentClassName={teamComboboxContentClass}
                                hideSearch
                              />
                            </div>
                          </div>

                            <div className="space-y-1.5">
                              <Label className="ml-1 text-[9px] font-medium uppercase text-muted-foreground">Dirección</Label>
                              <Input
                                value={editForm?.direccion || ""}
                                onChange={(e) => setEditForm(prev => prev ? { ...prev, direccion: e.target.value } : null)}
                                className="h-9 rounded-[4px] border-border bg-background text-[12px] font-medium"
                              />
                            </div>

                          <div className="space-y-3 rounded-[5px] border border-border bg-muted/20 px-3 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="ml-1 text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                  Alcance geográfico
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Elegí departamentos y municipios explícitos. Si seleccionás departamentos, la lista de municipios se ajusta a esos departamentos.
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {!editGeoScope.hasExplicitScope && (
                                  <div className="rounded-[4px] border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-emerald-600">
                                    Sin restricciones
                                  </div>
                                )}
                                <div className="rounded-[4px] border border-border bg-background px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-[#01ADFB]">
                                  {editGeoScope.summary}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleClearGeoScope}
                                className="rounded-[4px] border border-border bg-background px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600"
                              >
                                Quitar restricciones
                              </button>
                              <p className="text-[11px] text-muted-foreground">
                                Deja departamentos y municipios vacíos para permitir operación sin restricción geográfica.
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                              <GeoMultiSelect
                                label="Departamentos"
                                placeholder={departments.length > 0 ? "Seleccionar departamentos" : "Cargando departamentos..."}
                                options={departmentScopeOptions}
                                value={editGeoScope.departmentIds}
                                onChange={handleDepartmentScopeChange}
                                disabled={departments.length === 0}
                                emptyMessage="No hay departamentos disponibles."
                                searchPlaceholder="Buscar departamento..."
                              />

                              <GeoMultiSelect
                                label="Municipios"
                                placeholder={editGeoScope.departmentIds.length > 0 ? "Seleccionar municipios filtrados" : "Seleccionar municipios"}
                                options={municipalityScopeOptions}
                                value={editGeoScope.municipalityIds}
                                onChange={handleMunicipalityScopeChange}
                                disabled={municipalities.length === 0}
                                emptyMessage={editGeoScope.departmentIds.length > 0
                                  ? "No hay municipios para los departamentos elegidos."
                                  : "No hay municipios disponibles."}
                                searchPlaceholder="Buscar municipio..."
                              />
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {!editGeoScope.hasExplicitScope && (
                                <Badge
                                  variant="outline"
                                  className="rounded-[4px] border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-emerald-600"
                                >
                                  Sin restricciones geográficas
                                </Badge>
                              )}

                              {editGeoScope.departmentNames.length > 0 ? (
                                editGeoScope.departmentNames.map((departmentName) => (
                                  <Badge
                                    key={departmentName}
                                    variant="outline"
                                    className="rounded-[4px] border-border bg-background px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-foreground"
                                  >
                                    {departmentName}
                                  </Badge>
                                ))
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="rounded-[4px] border-dashed border-border bg-background px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                                >
                                  Sin departamentos seleccionados
                                </Badge>
                              )}

                              {editGeoScope.municipalityNames.length > 0 ? (
                                editGeoScope.municipalityNames.map((municipalityName) => (
                                  <Badge
                                    key={municipalityName}
                                    variant="outline"
                                    className="rounded-[4px] border-border bg-[#01ADFB]/5 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-[#01ADFB]"
                                  >
                                    {municipalityName}
                                  </Badge>
                                ))
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="rounded-[4px] border-dashed border-border bg-background px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
                                >
                                  Sin municipios seleccionados
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-3">
                            <button
                              onClick={handleSave}
                              disabled={savingProfile}
                              className="flex h-8 items-center justify-center gap-1.5 rounded-[4px] bg-[#01ADFB] text-[10px] font-medium uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#0197dd] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Save className="h-3.5 w-3.5" /> Guardar
                            </button>
                            <button
                              onClick={() => setIsEditing(false)}
                              className="h-8 rounded-[4px] border border-border text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:bg-muted"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>

        {view === "ranking" ? (
          <div className="flex items-center gap-2 border-t border-border pt-4">
            <Award className="h-4 w-4 text-[#01ADFB]" />
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Período analizado: <span className="text-foreground">{filters.from}</span> a <span className="text-foreground">{filters.to}</span>
            </p>
          </div>
        ) : null}
      </div>

      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto border-border bg-background p-0 shadow-xl">
          {selectedUser ? (
            <div>
              <DialogTitle className="sr-only">
                Detalle de {selectedUser.name}
              </DialogTitle>
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card px-5 py-4">
                <div>
                  <h2 className="text-[15px] font-medium tracking-tight text-foreground">
                    Detalle de Usuario
                  </h2>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    {selectedViewMeta.label}
                  </p>
                </div>
                {checkPermission("TEAM_EXPORT") && (
                  <button
                    onClick={handleExportSelectedDetail}
                    className="inline-flex h-8 items-center gap-2 rounded-[4px] border border-emerald-500/20 bg-emerald-500/10 px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-600 transition-colors hover:bg-emerald-500/15"
                    disabled={!selectedDetail}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar
                  </button>
                )}
              </div>

              <div className="space-y-5 px-5 py-4">
                <div className="rounded-[5px] border border-border bg-muted/30 px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Vista activa del detalle
                  </p>
                  <p className={cn("mt-1 text-[12px] font-semibold uppercase tracking-[0.08em]", selectedViewMeta.accentClass)}>
                    {selectedViewMeta.label}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {selectedViewMeta.description}
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {VIEW_EXPLANATIONS[selectedUserView].detail}
                  </p>
                </div>

                {detailSections.map((section) => (
                  <div key={section.title} className="space-y-3">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        {section.title}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
                      {section.cards.map((card) => (
                        <Card
                          key={`${section.title}-${card.label}`}
                          className="rounded-[4px] border-border bg-card shadow-sm"
                        >
                          <CardContent className="p-3">
                            <p className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                              {card.label}
                            </p>
                            <p className={cn("mt-2 truncate text-[17px] font-semibold leading-none tabular-nums", card.valueClass)}>
                              {card.value}
                            </p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}

                <Card className="rounded-[5px] border-border shadow-sm">
                  <CardContent className="p-4">
                    <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Servicios registrados
                    </p>
                    {loadingDetail ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Cargando servicios...
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="border-b border-border bg-muted/50">
                              <th className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Orden</th>
                              <th className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Fecha</th>
                              <th className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Cliente</th>
                              <th className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground text-center">Estado</th>
                              <th className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground text-right">Valor pagado</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {(selectedDetail?.orders || []).map((order) => (
                              <tr key={order.id}>
                                <td className="px-3 py-2 text-xs font-bold">{order.orderNumber}</td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">{order.date ? formatBogotaDate(order.date, "es-CO") : "N/A"}</td>
                                <td className="px-3 py-2 text-xs">{order.client}</td>
                                <td className="px-3 py-2 text-center"><span className={cn("rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-widest", order.status === "LIQUIDADO" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600")}>{order.status}</span></td>
                                <td className="px-3 py-2 text-right text-xs font-black">${order.paidValue.toLocaleString("es-CO")}</td>
                              </tr>
                            ))}
                            {(selectedDetail?.orders || []).length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">No hay servicios en el período.</td>
                              </tr>
                            ) : null}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export function TeamPerformancePage({ view }: { view: TeamTab }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-[#01ADFB]" />
        </div>
      }
    >
      <TeamPageContent view={view} />
    </Suspense>
  );
}
