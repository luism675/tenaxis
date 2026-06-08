"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { toBogotaYmd } from "@/utils/date-utils";
import { apiFetch } from "@/lib/api/base-client";
import { geoClient, type Department, type Municipality } from "@/lib/api/geo-client";
import { tenantsClient, type TenantMembershipUpdatePayload } from "@/lib/api/tenants-client";

export type TeamTab = "ranking" | "usuarios";
export type RankingScope = "operativo" | "todos";

type TeamFilters = {
  from: string;
  to: string;
  empresaId?: string;
  zonaId?: string;
  municipioId?: string;
  role?: string;
  activo?: boolean;
  search: string;
  scope: RankingScope;
  page: number;
  pageSize: number;
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  joinDate: string;
  placa?: string | null;
  moto?: boolean | null;
  direccion?: string | null;
  municipioId?: string | null;
  municipioNombre?: string | null;
  departmentIds?: string[];
  municipalityIds?: string[];
  empresaIds: string[];
  empresaNombres: string[];
  zonaIds: string[];
  zonaNombres: string[];
  totalServicios: number;
  serviciosLiquidados: number;
  pendientes: number;
  totalRecaudo: number;
  recaudoNuevos: number;
  recaudoRefuerzo: number;
  efectividad: number;
  // Role-specific metrics
  clientesCreados: number;
  conversionRate: number;
  avgTicket: number;
  avgLiquidationDays: number;
  overdueDebt: number;
  cancellations: number;
  reschedulings: number;
  agedPending: number;
  reworkRate: number;
};

export type TeamOrder = {
  id: string;
  orderNumber: string;
  date: string | null;
  status: string;
  paidValue: number;
  type?: string | null;
  client: string;
};

export type TeamMemberDetail = {
  member: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    departmentIds?: string[];
    municipalityIds?: string[];
  };
  metrics: {
    clientesCreados: number;
    totalServicios: number;
    serviciosLiquidados: number;
    pendientes: number;
    totalRecaudo: number;
    recaudoNuevos: number;
    recaudoRefuerzo: number;
    efectividad: number;
    conversionRate: number;
    avgTicket: number;
    avgLiquidationDays: number;
    overdueDebt: number;
    cancellations: number;
    reschedulings: number;
    agedPending: number;
    reworkRate: number;
  };
  orders: TeamOrder[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type TeamPerformanceResponse = {
  range: {
    from: string;
    to: string;
  };
  kpis: {
    totalRecaudo: number;
    totalServicios: number;
    serviciosLiquidados: number;
    serviciosPendientes: number;
    efectividadEquipo: number;
    ticketPromedio: number;
    comparison: {
      totalRecaudoChangePct: number;
      serviciosLiquidadosChangePct: number;
      efectividadChangePct: number;
    };
  };
  alerts: {
    noActivity: Array<{ membershipId: string; name: string; role: string }>;
    lowEffectiveness: Array<{
      membershipId: string;
      name: string;
      efectividad: number;
    }>;
    pendingLiquidation: Array<{
      membershipId: string;
      name: string;
      pendientes: number;
    }>;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  members: TeamMember[];
};

const defaultDateRange = () => {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return {
    from: toBogotaYmd(from),
    to: toBogotaYmd(to),
  };
};

export function useTeamPerformance(
  tenantId: string | null,
  initialSearch?: URLSearchParams,
  options?: {
    ignoreRoleFilter?: boolean;
    roleOverride?: string | string[];
  },
) {
  const range = defaultDateRange();
  const ignoreRoleFilter = Boolean(options?.ignoreRoleFilter);
  const roleOverrideParam = Array.isArray(options?.roleOverride)
    ? options.roleOverride.filter(Boolean).join(",")
    : options?.roleOverride || "";
  const [filters, setFilters] = useState<TeamFilters>({
    from: initialSearch?.get("from") || range.from,
    to: initialSearch?.get("to") || range.to,
    empresaId: initialSearch?.get("empresaId") || undefined,
    zonaId: initialSearch?.get("zonaId") || undefined,
    municipioId: initialSearch?.get("municipioId") || undefined,
    role: ignoreRoleFilter ? undefined : initialSearch?.get("role") || undefined,
    activo: initialSearch?.get("activo") === "false" ? false : initialSearch?.get("activo") === "true" ? true : undefined,
    search: initialSearch?.get("q") || "",
    scope: (initialSearch?.get("scope") as RankingScope) || "todos",
    page: ignoreRoleFilter ? 1 : Number(initialSearch?.get("page") || 1),
    pageSize: 50,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [data, setData] = useState<TeamPerformanceResponse | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberDetailById, setMemberDetailById] = useState<
    Record<string, TeamMemberDetail>
  >({});
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 250);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const fetchGeoData = useCallback(async () => {
    try {
      const [departmentRows, municipalityRows] = await Promise.all([
        geoClient.getDepartments(),
        geoClient.getMunicipalities(),
      ]);

      setDepartments(Array.isArray(departmentRows) ? departmentRows : []);
      setMunicipalities(Array.isArray(municipalityRows) ? municipalityRows : []);
    } catch (err) {
      console.error("No se pudo cargar la configuración geográfica:", err);
      toast.error("No se pudo cargar la configuración geográfica");
      setDepartments([]);
      setMunicipalities([]);
    }
  }, []);

  const fetchPerformance = useCallback(async () => {
    if (!tenantId) return;
    const params = new URLSearchParams();
    params.set("from", filters.from);
    params.set("to", filters.to);
    params.set("scope", filters.scope);
    params.set("page", String(filters.page));
    params.set("pageSize", String(filters.pageSize));
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (roleOverrideParam) {
      params.set("roles", roleOverrideParam);
    } else if (!ignoreRoleFilter && filters.role) {
      params.set("role", filters.role);
    }
    if (filters.municipioId) params.set("municipioId", filters.municipioId);
    if (filters.empresaId) params.set("empresaId", filters.empresaId);
    if (filters.zonaId) params.set("zonaId", filters.zonaId);
    if (filters.activo !== undefined) params.set("activo", String(filters.activo));

    const payload = await apiFetch<TeamPerformanceResponse>(
      `/tenants/${tenantId}/team/performance?${params.toString()}`,
    );
    setData(payload);
  }, [
    debouncedSearch,
    filters.empresaId,
    filters.from,
    filters.municipioId,
    filters.page,
    filters.pageSize,
    filters.role,
    filters.scope,
    filters.to,
    filters.zonaId,
    filters.activo,
    ignoreRoleFilter,
    roleOverrideParam,
    tenantId,
  ]);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchPerformance(), fetchGeoData()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [fetchGeoData, fetchPerformance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fetchMemberDetail = useCallback(
    async (membershipId: string) => {
      if (!tenantId) return;
      if (memberDetailById[membershipId]) return;

      try {
        setLoadingDetail(true);
        const params = new URLSearchParams({
          from: filters.from,
          to: filters.to,
          page: "1",
          pageSize: "100",
        });
        if (filters.empresaId) params.set("empresaId", filters.empresaId);
        if (filters.zonaId) params.set("zonaId", filters.zonaId);

        const detail = await apiFetch<TeamMemberDetail>(
          `/tenants/${tenantId}/team/members/${membershipId}/detail?${params.toString()}`,
        );
        setMemberDetailById((prev) => ({ ...prev, [membershipId]: detail }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error en detalle");
      } finally {
        setLoadingDetail(false);
      }
    },
    [
      filters.empresaId,
      filters.from,
      filters.to,
      filters.zonaId,
      memberDetailById,
      tenantId,
    ],
  );

  const updateMemberProfile = useCallback(
    async (
      membershipId: string,
      payload: TenantMembershipUpdatePayload,
    ) => {
      if (!tenantId) return false;

      try {
        setSavingProfile(true);
        await tenantsClient.updateMembership(membershipId, payload);

        toast.success("Perfil actualizado correctamente");
        await fetchPerformance();
        setMemberDetailById((prev) => {
          const clone = { ...prev };
          delete clone[membershipId];
          return clone;
        });
        return true;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al actualizar");
        return false;
      } finally {
        setSavingProfile(false);
      }
    },
    [fetchPerformance, tenantId],
  );

  const members = useMemo(() => data?.members || [], [data]);

  const allRoles = useMemo(
    () => Array.from(new Set(members.map((m) => m.role))).sort(),
    [members],
  );

  return {
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
  };
}
