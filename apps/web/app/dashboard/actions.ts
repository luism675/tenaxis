"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import {
  contabilidadClient,
  type CreateAnticipoPayload,
} from "@/lib/api/contabilidad-client";
import { tenantsClient } from "@/lib/api/tenants-client";
import { clientesClient } from "@/lib/api/clientes-client";
import { configClient } from "@/lib/api/config-client";
import { enterpriseClient } from "@/lib/api/enterprise-client";
import { serviciosClient } from "@/lib/api/servicios-client";
import { authClient } from "@/lib/api/auth-client";
import { canAccessTenantsView } from "@/lib/access-scope";
import { apiFetch, } from "@/lib/api/base-client";
import type { TenantMembershipInvitePayload, TenantMembershipUpdatePayload } from "@/lib/api/tenants-client";
import { DashboardStatsSchema, type DashboardStatsType } from "./schemas/dashboard.schema";

export type DashboardStats = DashboardStatsType;
export interface ElementoPredefinido {
  nombre: string;
  tipo: string;
  ubicacion?: string;
}
export interface ConfiguracionOperativa {
  id: string;
  direccionId?: string | null;
  direccion?: {
    id: string;
    direccion: string;
  } | null;
  protocoloServicio?: string | null;
  observacionesFijas?: string | null;
  requiereFirmaDigital: boolean;
  requiereFotosEvidencia: boolean;
  duracionEstimada?: number | null;
  frecuenciaSugerida?: number | null;
  elementosPredefinidos?: ElementoPredefinido[] | null;
}

// --- DTO Interfaces ---
export interface TipoInteresDTO {
  nombre: string;
  descripcion?: string | null;
  frecuenciaSugerida?: number | null;
  riesgoSugerido?: string | null;
  activo?: boolean;
}

export interface ServicioDTO {
  nombre: string;
  empresaId: string;
  activo?: boolean;
  requiereSeguimiento?: boolean;
  primerSeguimientoDias?: number;
  requiereSeguimientoTresMeses?: boolean;
}

export interface DireccionDTO {
  direccion: string;
  piso?: string | null;
  bloque?: string | null;
  unidad?: string | null;
  barrio?: string | null;
  municipio?: string | null;
  linkMaps?: string | null;
  cargoContacto?: string | null;
  clasificacionPunto?: string | null;
  departmentId?: string | null;
  horarioFin?: string | null;
  horarioInicio?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  motivoBloqueo?: string | null;
  municipioId?: string | null;
  nombreContacto?: string | null;
  nombreSede?: string | null;
  precisionGPS?: number | null;
  restricciones?: string | null;
  telefonoContacto?: string | null;
  tipoUbicacion?: string | null;
  validadoPorSistema?: boolean;
}

export interface ClienteDTO {
  tipoCliente: "PERSONA" | "EMPRESA";
  nombre?: string | null;
  apellido?: string | null;
  telefono: string;
  telefono2?: string | null;
  correo?: string | null;
  origenCliente?: string | null;
  tipoInteresId?: string | null;
  razonSocial?: string | null;
  nit?: string | null;
  numeroDocumento?: string | null;
  tipoDocumento?: string | null;
  actividadEconomica?: string | null;
  metrajeTotal?: number | null;
  empresaId?: string;
  segmento?: "HOGAR" | "COMERCIO" | "INDUSTRIA" | "SALUD" | "EDUCACION" | "HORECA" | "OFICINA" | "OTRO" | null;
  nivelRiesgo?: "BAJO" | "MEDIO" | "ALTO" | "CRITICO" | null;
  direcciones?: DireccionDTO[];
}

export interface ContratoClienteDTO {
  empresaId: string;
  fechaInicio: string;
  fechaFin?: string | null;
  serviciosComprometidos?: number | null;
  frecuenciaServicio?: number | null;
  tipoFacturacion:
    | "UNICO"
    | "CONTRATO_MENSUAL"
    | "PLAN_TRIMESTRAL"
    | "PLAN_SEMESTRAL"
    | "PLAN_ANUAL";
  estado?: "ACTIVO" | "PAUSADO" | "VENCIDO" | "CANCELADO";
  observaciones?: string | null;
}

export interface ProductoCreateDTO {
  nombre: string;
  categoria: string;
  unidadMedida: string;
  stockActual: number | string;
  stockMinimo: number | string;
  proveedorId?: string | null;
}

export interface SolicitudCreateDTO {
  productoId: string;
  cantidad: number | string;
  unidadMedida: string;
  membershipId?: string | null;
}

// --- Auth Actions ---
export async function isTenantAdminAction() {
  try {
    const profile = await authClient.getProfile();
    return canAccessTenantsView(profile);
  } catch (error) {
    console.error("Error checking tenant admin status:", error);
    return false;
  }
}

export async function updateTestRoleAction(role: string) {
  try {
    // Intentar actualizar en base de datos (opcional para SU_ADMINs globales)
    try {
      await authClient.updateTestRole(role);
    } catch (e) {
      console.warn("No se pudo actualizar el rol en la DB, se usará solo cookie:", e);
    }

    // SIEMPRE establecer la cookie para que el override funcione en los interceptores/guards
    const cookieStore = await cookies();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    cookieStore.set("x-test-role", role, { path: "/", expires, sameSite: "lax" });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

// --- Tenant Actions ---
export async function getTenantsAction() {
  try {
    return await tenantsClient.getAll();
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return [];
  }
}

export async function getTenantDetailAction(tenantId: string) {
  try {
    return await tenantsClient.getById(tenantId);
  } catch (error) {
    console.error("Error fetching tenant detail:", error);
    throw error;
  }
}

export async function getPendingMembershipsAction(tenantId: string) {
  try {
    return await tenantsClient.getPendingMemberships(tenantId);
  } catch (error) {
    console.error("Error fetching pending memberships:", error);
    return [];
  }
}

export async function approveMembershipAction(id: string) {
  try {
    await tenantsClient.approveMembership(id);
    revalidatePath("/dashboard/solicitudes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function rejectMembershipAction(id: string) {
  try {
    await tenantsClient.rejectMembership(id);
    revalidatePath("/dashboard/solicitudes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function createTenantAction(formData: Record<string, unknown>) {
  try {
    return await tenantsClient.createTenant(formData);
  } catch (error) {
    console.error("Error creating tenant:", error);
    throw error;
  }
}

export async function joinTenantAction(slug: string) {
  try {
    const result = await tenantsClient.join(slug);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function updateMembershipAction(membershipId: string, data: TenantMembershipUpdatePayload) {
  try {
    const result = await tenantsClient.updateMembership(membershipId, data);
    revalidatePath("/dashboard/equipo-trabajo");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function getTenantMembershipsAction() {
  try {
    const profile = await authClient.getProfile();
    const tenantId = profile.tenantId;
    if (!tenantId) return [];
    return await tenantsClient.getMemberships(tenantId);
  } catch (error) {
    console.error("Error fetching memberships:", error);
    return [];
  }
}

export async function inviteMemberAction(tenantId: string, data: TenantMembershipInvitePayload) {
  try {
    const result = await tenantsClient.inviteMember(tenantId, data);
    revalidatePath("/dashboard/equipo-trabajo");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

// --- Plan Actions ---
export async function getPlansAction() {
  try {
    return await apiFetch<unknown[]>("/plans");
  } catch (error) {
    console.error("Error fetching plans:", error);
    return [];
  }
}

// --- Client Actions ---
export interface ClientesDashboardDataResponse<T = unknown> {
  clientes: T[];
  segmentacion: {
    riesgoFuga: { count: number };
    upsellPotencial: { count: number };
    dormidos: { count: number };
    operacionEstable: { count: number };
  } | null;
  overview: {
    total: number;
    empresas: number;
    oro: number;
    riesgoCritico: number;
    avgScore: number;
  } | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null;
}

export async function getClientesAction() {
  try {
    return await clientesClient.getAll();
  } catch (error) {
    console.error("Error fetching clients:", error);
    return [];
  }
}

export async function getClienteByIdAction(id: string) {
  try {
    return await clientesClient.getById(id);
  } catch (error) {
    console.error("Error fetching client by id:", error);
    return null;
  }
}

export async function getClientesDashboardAction<T = unknown>(
  query?: Record<string, string | undefined>,
): Promise<ClientesDashboardDataResponse<T>> {
  try {
    const params = new URLSearchParams();

    Object.entries(query || {}).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    const endpoint = `/clientes/dashboard-data${params.toString() ? `?${params.toString()}` : ""}`;

    const data = await apiFetch<ClientesDashboardDataResponse<T>>(endpoint, {
      cache: "no-store",
      includeEnterpriseId: true,
    });

    return {
      clientes: (data?.clientes || []) as T[],
      segmentacion: (data?.segmentacion || null) as ClientesDashboardDataResponse<T>["segmentacion"],
      overview: (data?.overview || null) as ClientesDashboardDataResponse<T>["overview"],
      pagination: (data?.pagination || null) as ClientesDashboardDataResponse<T>["pagination"],
    };
  } catch (error) {
    console.error("Error fetching clientes dashboard data:", error);
    return { clientes: [], segmentacion: null, overview: null, pagination: null };
  }
}

export async function getSegmentedClientesAction() {
  try {
    return await apiFetch("/clientes/segmentacion", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Error fetching segmented clients:", error);
    return null;
  }
}

export async function getSugerenciasAction() {
  try {
    return await apiFetch<unknown[]>("/sugerencias-clientes", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Error fetching suggestions:", error);
    return [];
  }
}

export async function getSugerenciasStatsAction() {
  try {
    return await apiFetch<Record<string, unknown>>("/sugerencias-clientes/stats", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Error fetching suggestions stats:", error);
    return null;
  }
}

export async function updateSugerenciaEstadoAction(id: string, estado: string) {
  try {
    await apiFetch(`/sugerencias-clientes/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });

    revalidatePath("/dashboard/clientes");
    return { success: true };
  } catch (error) {
    console.error("Error updating suggestion status:", error);
    return { success: false };
  }
}

export async function createClienteAction(payload: ClienteDTO) {
  try {
    const result = await clientesClient.create(payload);
    revalidatePath("/dashboard/clientes");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function updateClienteAction(id: string, payload: Partial<ClienteDTO>) {
  try {
    const result = await clientesClient.update(id, payload);
    revalidatePath("/dashboard/clientes");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function deleteClienteAction(id: string) {
  try {
    await clientesClient.delete(id);
    revalidatePath("/dashboard/clientes");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function getMyProfileAction() {
  try {
    return await authClient.getProfile();
  } catch (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
}

export async function getContratoClienteActivoAction(clienteId: string, empresaId?: string) {
  try {
    return await clientesClient.getActiveContrato(clienteId, empresaId);
  } catch (error) {
    console.error("Error fetching active contract:", error);
    return null;
  }
}

export async function createContratoClienteAction(clienteId: string, payload: ContratoClienteDTO) {
  try {
    const result = await clientesClient.createContrato(clienteId, payload);
    revalidatePath("/dashboard/clientes");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function updateContratoClienteAction(id: string, payload: Partial<ContratoClienteDTO>) {
  try {
    const result = await clientesClient.updateContrato(id, payload);
    revalidatePath("/dashboard/clientes");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

// --- Config Actions ---
export async function getSegmentosAction() {
  try {
    return await configClient.getSegmentos();
  } catch (error) {
    console.error("Error fetching segments:", error);
    return [];
  }
}

export async function createSegmentoAction(data: Record<string, unknown>) {
  try {
    return await apiFetch("/config-clientes/segmentos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function updateSegmentoAction(id: string, data: Record<string, unknown>) {
  try {
    return await apiFetch(`/config-clientes/segmentos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function getRiesgosAction() {
  try {
    return await configClient.getRiesgos();
  } catch (error) {
    console.error("Error fetching risks:", error);
    return [];
  }
}

export async function createRiesgoAction(data: Record<string, unknown>) {
  try {
    return await apiFetch("/config-clientes/riesgos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function updateRiesgoAction(id: string, data: Record<string, unknown>) {
  try {
    return await apiFetch(`/config-clientes/riesgos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function getTiposInteresAction() {
  try {
    return await configClient.getIntereses();
  } catch (error) {
    console.error("Error fetching interest types:", error);
    return [];
  }
}

export async function createTipoInteresAction(data: TipoInteresDTO) {
  try {
    return await apiFetch("/config-clientes/intereses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function updateTipoInteresAction(id: string, data: Partial<TipoInteresDTO>) {
  try {
    return await apiFetch(`/config-clientes/intereses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function getTiposServicioAction(empresaId: string) {
  if (!empresaId) return [];
  try {
    return await configClient.getTiposServicio(empresaId);
  } catch (error) {
    console.error("Error fetching service types:", error);
    return [];
  }
}

export async function getMetodosPagoAction(empresaId?: string) {
  if (!empresaId) return [];
  try {
    return await configClient.getMetodosPago(empresaId);
  } catch (error) {
    console.error("Error fetching payment methods:", error);
    return [];
  }
}

export async function getZonasAction(empresaId: string) {
  if (!empresaId) return [];
  try {
    return await configClient.getZonas(empresaId);
  } catch (error) {
    console.error("Error fetching zones:", error);
    return [];
  }
}

export async function getServiciosAction(empresaId?: string) {
  try {
    return await configClient.getServicios(empresaId);
  } catch (error) {
    console.error("Error fetching services:", error);
    return [];
  }
}

export async function createServicioAction(data: ServicioDTO) {
  try {
    return await apiFetch("/config-clientes/servicios", {
      method: "POST",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function updateServicioAction(id: string, data: Partial<ServicioDTO>) {
  try {
    return await apiFetch(`/config-clientes/servicios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  } catch (error) {
    throw error;
  }
}

export async function deleteServicioAction(id: string) {
  try {
    return await apiFetch(`/config-clientes/servicios/${id}`, {
      method: "DELETE",
    });
  } catch (error) {
    throw error;
  }
}

export async function getClienteConfigsAction(clienteId: string) {
  try {
    return await configClient.getClienteOperativa(clienteId);
  } catch (error) {
    console.error("Error fetching client configs:", error);
    return [];
  }
}

export async function upsertClienteConfigAction(payload: Record<string, unknown>) {
  try {
    const result = await configClient.upsertOperativa(payload);
    revalidatePath("/dashboard/clientes");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function getEstadoServiciosAction(empresaId?: string) {
  if (!empresaId) return [];
  try {
    return await apiFetch<unknown[]>(`/config-clientes/estados-servicio?empresaId=${empresaId}`);
  } catch (error) {
    console.error("Error fetching service states:", error);
    return [];
  }
}

// --- Enterprise Actions ---
export async function getOperatorsAction(empresaId: string) {
  if (!empresaId) return [];
  try {
    return await enterpriseClient.getOperators(empresaId);
  } catch (error) {
    console.error("Error fetching operators:", error);
    return [];
  }
}

export async function getEnterprisesAction() {
  try {
    return await enterpriseClient.getAll();
  } catch (error) {
    console.error("Error fetching enterprises:", error);
    return [];
  }
}

export async function createEnterpriseAction(data: Record<string, unknown>) {
  try {
    return await enterpriseClient.create(data);
  } catch (error) {
    throw error;
  }
}

export async function updateEnterpriseAction(id: string, data: Record<string, unknown>) {
  try {
    return await enterpriseClient.update(id, data);
  } catch (error) {
    throw error;
  }
}

export async function deleteEnterpriseAction(id: string) {
  try {
    return await enterpriseClient.delete(id);
  } catch (error) {
    throw error;
  }
}

// --- Service Order Actions ---
export async function getOrdenesServicioAction(empresaId?: string) {
  try {
    const cleanId = (empresaId === "all" || empresaId === "undefined" || !empresaId) ? undefined : empresaId;
    return await serviciosClient.getAll(cleanId);
  } catch (error) {
    console.error("Error fetching service orders:", error);
    return [];
  }
}

export async function getOrdenesServicioByClienteAction(clienteId: string) {
  try {
    return await serviciosClient.getAll(undefined, clienteId);
  } catch (error) {
    console.error("Error fetching client service orders:", error);
    return [];
  }
}

export async function getOrdenServicioByIdAction(id: string) {
  try {
    return await serviciosClient.getById(id);
  } catch (error) {
    console.error("Error fetching order by id:", error);
    return null;
  }
}

export async function createOrdenServicioAction(payload: Record<string, unknown>) {
  try {
    const result = await serviciosClient.create(payload);
    revalidatePath('/dashboard/servicios');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado' };
  }
}

export async function updateOrdenServicioAction(id: string, payload: Record<string, unknown> | FormData) {
  try {
    const result = await serviciosClient.update(id, payload);
    revalidatePath('/dashboard/servicios');
    revalidatePath('/dashboard');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado' };
  }
}

export async function deleteOrdenServicioAction(id: string) {
  try {
    await serviciosClient.delete(id);
    revalidatePath('/dashboard/servicios');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Error inesperado' };
  }
}

export async function addOrdenServicioEvidenciasAction(id: string, formData: FormData) {
  try {
    const result = await serviciosClient.addEvidencias(id, formData);
    revalidatePath("/dashboard/servicios");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

// --- Finance Actions (Using unified contabilidadClient) ---
export async function getRecaudoTecnicosAction(empresaId?: string) {
  try {
    return await contabilidadClient.getRecaudoTecnicos(empresaId);
  } catch (error) {
    console.error("Error fetching technician collection:", error);
    return [];
  }
}

export async function getAccountingBalanceAction(empresaId?: string) {
  try {
    return await contabilidadClient.getBalance(empresaId);
  } catch (error) {
    console.error("Error fetching balance:", error);
    return null;
  }
}

export async function getEgresosAction(empresaId?: string) {
  try {
    return await contabilidadClient.getEgresos(empresaId);
  } catch (error) {
    console.error("Error fetching egresos:", error);
    return [];
  }
}

export async function getNominasAction(empresaId?: string) {
  try {
    return await contabilidadClient.getNominas(empresaId);
  } catch (error) {
    console.error("Error fetching nominas:", error);
    return [];
  }
}

export async function getAnticiposAction(empresaId?: string) {
  try {
    return await contabilidadClient.getAnticipos(empresaId);
  } catch (error) {
    console.error("Error fetching anticipos:", error);
    return [];
  }
}

export async function getMovimientosAction(empresaId?: string) {
  try {
    return await contabilidadClient.getMovimientos(empresaId);
  } catch (error) {
    console.error("Error fetching movements:", error);
    return [];
  }
}

export async function createEgresoAction(data: Record<string, unknown>) {
  try {
    const result = await contabilidadClient.crearEgreso(data);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function createAnticipoAction(data: CreateAnticipoPayload) {
  try {
    const result = await contabilidadClient.crearAnticipo(data);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

export async function registrarConsignacionAction(formData: FormData) {
  try {
    const result = await contabilidadClient.registrarConsignacion(formData);
    revalidatePath("/dashboard/contabilidad");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Error inesperado" };
  }
}

import { geoClient } from "@/lib/api/geo-client";

// --- Geo Actions ---
export async function getMunicipalitiesAction() {
  try {
    return await geoClient.getMunicipalities();
  } catch (error) {
    console.error("Error fetching municipalities:", error);
    return [];
  }
}

export async function getDepartmentsAction() {
  try {
    return await geoClient.getDepartments();
  } catch (error) {
    console.error("Error fetching departments:", error);
    return [];
  }
}

// --- Dashboard Actions ---
export async function getDashboardStatsAction(empresaId?: string): Promise<DashboardStats> {
  const fallbackStats: DashboardStats = {
    kpis: {
      ingresos: { current: 0, previous: 0, change: 0 },
      ordenes: { current: 0, previous: 0, change: 0 },
      sla: { value: 0 },
      cobranza: { total: 0 },
    },
    trends: {
      ingresosSemanales: [0, 0, 0, 0, 0, 0, 0],
      monthlyComparison: [
        { label: 'Anterior', value: 0 },
        { label: 'Actual', value: 0 }
      ]
    },
    actionable: {
      vencidas: 0,
      sinAsignacion: 0,
      alertas: 0
    },
    overview: {
      today: {
        serviciosAgendados: 0,
        enProceso: 0,
        realizados: 0,
        ingresos: 0,
        pendientesLiquidar: 0,
        cancelados: 0,
        tasaCancelacion: 0,
        sinCobrar: 0
      },
      global: {
        enProceso: 0,
        pendientesLiquidar: 0,
        realizadosHistorico: 0,
        serviciosTotales: 0,
        ingresosTotales: 0,
        sinCobrarTotales: 0,
        cancelados: 0,
        tasaCancelacion: 0
      }
    }
  };

  try {
    const cleanId = (empresaId === "all" || empresaId === "undefined" || !empresaId) ? undefined : empresaId;
    const url = cleanId ? `/dashboard/stats?empresaId=${cleanId}` : "/dashboard/stats";
    const data = await apiFetch<unknown>(url, { cache: "no-store" });
    const parsed = DashboardStatsSchema.safeParse(data);
    if (!parsed.success) {
      console.error("getDashboardStatsAction: Zod parsing failed", parsed.error);
      return fallbackStats;
    }
    return parsed.data;
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return fallbackStats;
  }
}

// --- Webhook Actions ---
export async function notifyLiquidationWebhookAction(data: {
  telefono: string;
  cliente: string;
  fecha: string;
  servicio: string;
  idServicio: string;
}) {
  try {
    const res = await apiFetch<{ success: boolean; error?: string }>(
      "/ordenes-servicio/notifications/liquidation",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return res;
  } catch (error) {
    console.error("Error in notifyLiquidationWebhookAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error notifying webhook",
    };
  }
}

export async function notifyServiceOperatorWebhookAction(data: {
  idServicio: string;
  [key: string]: unknown;
}) {
  try {
    const res = await apiFetch<{ success: boolean; error?: string }>(
      "/ordenes-servicio/notifications/operator",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    return res;
  } catch (error) {
    console.error("Error in notifyServiceOperatorWebhookAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error notifying webhook",
    };
  }
}

// --- Insumos / Productos Actions ---
type ProductoStockItem = {
  id: string;
  nombre: string;
  categoria?: string | null;
  unidadMedida?: string | null;
  stockActual?: number | null;
  stockMinimo?: number | null;
};

type ProductoSolicitudItem = {
  id: string;
  createdAt?: string | Date | null;
  cantidad: number | string;
  unidadMedida?: string | null;
  estado?: string;
  membership?: {
    user?: {
      nombre?: string | null;
      apellido?: string | null;
    } | null;
  } | null;
  producto?: {
    nombre?: string | null;
    categoria?: string | null;
    unidadMedida?: string | null;
  } | null;
};

type ProveedorItem = {
  id: string;
  nombre: string;
};

export async function getProductosStockAction(): Promise<ProductoStockItem[]> {
  try {
    return await apiFetch<ProductoStockItem[]>("/productos/stock", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Error fetching stock:", error);
    return [];
  }
}

export async function getProductosSolicitudesAction(): Promise<ProductoSolicitudItem[]> {
  try {
    return await apiFetch<ProductoSolicitudItem[]>("/productos/solicitudes", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Error fetching solicitudes:", error);
    return [];
  }
}

export async function getProveedoresAction(): Promise<ProveedorItem[]> {
  try {
    return await apiFetch<ProveedorItem[]>("/productos/proveedores", {
      cache: "no-store",
    });
  } catch (error) {
    console.error("Error fetching proveedores:", error);
    return [];
  }
}

export async function createProductoAction(data: ProductoCreateDTO) {
  try {
    const res = await apiFetch("/productos/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
    revalidatePath("/dashboard/insumos");
    return { success: true, data: res };
  } catch (error) {
    console.error("Error creating producto:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error creating producto" };
  }
}

export async function createSolicitudAction(data: SolicitudCreateDTO) {
  try {
    const res = await apiFetch("/productos/solicitudes", {
      method: "POST",
      body: JSON.stringify(data),
    });
    revalidatePath("/dashboard/insumos");
    return { success: true, data: res };
  } catch (error) {
    console.error("Error creating solicitud:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error creating solicitud" };
  }
}

export async function updateSolicitudStatusAction(id: string, estado: string) {
  try {
    const res = await apiFetch(`/productos/solicitudes/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
    revalidatePath("/dashboard/insumos");
    return { success: true, data: res };
  } catch (error) {
    console.error("Error updating solicitud status:", error);
    return { success: false, error: error instanceof Error ? error.message : "Error updating status" };
  }
}
