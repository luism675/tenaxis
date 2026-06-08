import { apiFetch } from "./base-client";
import { GenerateMonitoringPayrollResponse } from "@/app/dashboard/monitoreo/types";

export interface TechnicianRecaudo {
  id: string;
  nombre: string;
  apellido: string;
  saldoPendiente: number;
  ordenesPendientesCount: number;
  ultimaTransferencia: string | null;
  diasSinTransferir: number;
  ordenesIds: string[];
  declaraciones: Array<{
    ordenId: string;
    valorDeclarado: number;
    fechaDeclaracion: string;
  }>;
}

export interface AccountingBalance {
  ingresos: { total: number; change: number };
  egresos: { total: number; change: number };
  utilidad: { total: number; change: number };
  categorias: { label: string; value: number; color: string }[];
  categoriasMeta?: PaginationMeta;
}

export interface MovimientoFinanciero {
  id: string;
  createdAt?: string;
  fechaGeneracion?: string;
  monto?: number;
  totalPagar?: number;
  titulo?: string;
  razon?: string;
  estado?: string;
  membership?: {
    user: {
      nombre: string;
      apellido: string;
    };
  };
}

export interface GenerateMonitoringPayrollPayload {
  empresaId: string;
  fechaInicio: string;
  fechaFin: string;
  membershipIds?: string[];
  includeAllEligible?: boolean;
  observaciones?: string;
}

export interface RegistrarConsignacionPayload {
  tecnicoId: string;
  empresaId: string;
  valorConsignado?: number;
  valorEntregado?: number;
  valorAdelanto?: number;
  referenciaBanco: string;
  ordenIds: string[];
  fechaConsignacion: string;
  observacion?: string;
  comprobantePath: string;
  confirmarEfectivoFisico: boolean;
}

export interface CreateAnticipoPayload {
  membershipId?: string;
  monto: number;
  razon?: string;
  empresaId: string;
  fechaAnticipo?: string;
}

export interface SendLiquidationReminderResponse {
  success: boolean;
  membershipId: string;
  saldoPendiente: number;
  ordenesPendientesCount: number;
  message: string;
}

export interface CuentaCobroShift {
  id: string;
  fecha: string;
  horaEntrada: string;
  horaSalida: string;
  fotoLlegada?: string;
  fotoSalida?: string;
  fotoLlegadaUrl?: string;
  fotoSalidaUrl?: string;
  descansoMinutos: number;
  observacion?: string;
  totalHoras: number;
  valorGenerado: number;
  createdAt: string;
}

export interface CuentaCobroPeriod {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  fechaCierre: string;
  numDias: number;
  valorTotal: number;
  horasTotales: number;
  shifts: CuentaCobroShift[];
  userSnapshot: {
    id?: string;
    membershipId?: string;
    nombre?: string;
    apellido?: string;
    tipoDocumento?: string;
    numeroDocumento?: string;
    email?: string;
    banco?: string;
    tipoCuenta?: string;
    numeroCuenta?: string;
    valorHora?: number;
  };
}

export interface CuentaCobroDashboard {
  empresaId: string;
  valorHora: number;
  userSnapshot: CuentaCobroPeriod["userSnapshot"];
  turnos: CuentaCobroShift[];
  periodos: CuentaCobroPeriod[];
}

export interface CuentaCobroTurnoPayload {
  empresaId: string;
  fecha: string;
  horaEntrada: string;
  horaSalida: string;
  descansoMinutos: number;
  observacion?: string;
  fotoLlegada?: string;
  fotoSalida?: string;
}

export interface CuentaCobroUploadUrlResponse {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl?: string;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

type ApiEnvelope<T> = {
  data?: T;
  meta?: PaginationMeta;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isPaginatedResponse<T>(value: unknown): value is PaginatedResponse<T> {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    isRecord(value.meta)
  );
}

function buildFinanceQuery(
  empresaId?: string,
  pagination?: PaginationParams,
): string {
  const query = new URLSearchParams();

  if (empresaId) query.set("empresaId", empresaId);
  if (pagination?.page) query.set("page", String(pagination.page));
  if (pagination?.pageSize) query.set("pageSize", String(pagination.pageSize));

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

function normalizePaginatedResponse<T>(
  response:
    | PaginatedResponse<T>
    | ApiEnvelope<PaginatedResponse<T> | T[]>
    | T[]
    | null
    | undefined,
  pagination?: PaginationParams,
): PaginatedResponse<T> {
  const requestedPage = Math.max(1, pagination?.page ?? 1);
  const requestedPageSize = Math.max(1, pagination?.pageSize ?? 10);

  if (isPaginatedResponse<T>(response)) {
    return response;
  }

  if (
    response &&
    !Array.isArray(response) &&
    "data" in response &&
    response.data !== undefined
  ) {
    if (response.meta && Array.isArray(response.data)) {
      return {
        items: response.data,
        meta: response.meta,
      };
    }

    const normalized = normalizePaginatedResponse(response.data, pagination);
    return response.meta
      ? {
          items: normalized.items,
          meta: response.meta,
        }
      : normalized;
  }

  if (Array.isArray(response)) {
    const total = response.length;
    const totalPages = Math.max(1, Math.ceil(total / requestedPageSize));
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * requestedPageSize;
    const items = response.slice(start, start + requestedPageSize);

    return {
      items,
      meta: {
        page,
        pageSize: requestedPageSize,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  }

  return {
    items: [],
    meta: {
      page: requestedPage,
      pageSize: requestedPageSize,
      total: 0,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    },
  };
}

export const contabilidadClient = {
  async getRecaudoTecnicos(empresaId?: string): Promise<TechnicianRecaudo[]> {
    const url = `/finanzas/recaudo-tecnicos${buildFinanceQuery(empresaId)}`;
    return apiFetch<TechnicianRecaudo[]>(url, { cache: "no-store" });
  },

  async getRecaudoTecnicosPage(
    empresaId?: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<TechnicianRecaudo>> {
    const url = `/finanzas/recaudo-tecnicos${buildFinanceQuery(empresaId, pagination)}`;
    const response = await apiFetch<
      PaginatedResponse<TechnicianRecaudo> | TechnicianRecaudo[]
    >(url, {
      cache: "no-store",
    });
    return normalizePaginatedResponse(response, pagination);
  },

  async getBalance(
    empresaId?: string,
    pagination?: PaginationParams,
  ): Promise<AccountingBalance | null> {
    const url = `/finanzas/balance${buildFinanceQuery(empresaId, pagination)}`;
    try {
      const response = await apiFetch<AccountingBalance>(url, { cache: "no-store" });
      if (pagination && response && !response.categoriasMeta) {
        const categorias = normalizePaginatedResponse(
          response.categorias ?? [],
          pagination,
        );

        return {
          ...response,
          categorias: categorias.items,
          categoriasMeta: categorias.meta,
        };
      }

      return response;
    } catch (error) {
      console.error("contabilidadClient.getBalance error:", error);
      return null;
    }
  },

  async getEgresos(empresaId?: string): Promise<MovimientoFinanciero[]> {
    const url = `/finanzas/egresos${buildFinanceQuery(empresaId)}`;
    return apiFetch<MovimientoFinanciero[]>(url, { cache: "no-store" });
  },

  async getEgresosPage(
    empresaId?: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<MovimientoFinanciero>> {
    const url = `/finanzas/egresos${buildFinanceQuery(empresaId, pagination)}`;
    const response = await apiFetch<
      PaginatedResponse<MovimientoFinanciero> | MovimientoFinanciero[]
    >(url, {
      cache: "no-store",
    });
    return normalizePaginatedResponse(response, pagination);
  },

  async getNominas(empresaId?: string): Promise<MovimientoFinanciero[]> {
    const url = `/finanzas/nominas${buildFinanceQuery(empresaId)}`;
    return apiFetch<MovimientoFinanciero[]>(url, { cache: "no-store" });
  },

  async getNominasPage(
    empresaId?: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<MovimientoFinanciero>> {
    const url = `/finanzas/nominas${buildFinanceQuery(empresaId, pagination)}`;
    const response = await apiFetch<
      PaginatedResponse<MovimientoFinanciero> | MovimientoFinanciero[]
    >(url, {
      cache: "no-store",
    });
    return normalizePaginatedResponse(response, pagination);
  },

  async getAnticipos(empresaId?: string): Promise<MovimientoFinanciero[]> {
    const url = `/finanzas/anticipos${buildFinanceQuery(empresaId)}`;
    return apiFetch<MovimientoFinanciero[]>(url, { cache: "no-store" });
  },

  async getAnticiposPage(
    empresaId?: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResponse<MovimientoFinanciero>> {
    const url = `/finanzas/anticipos${buildFinanceQuery(empresaId, pagination)}`;
    const response = await apiFetch<
      PaginatedResponse<MovimientoFinanciero> | MovimientoFinanciero[]
    >(url, {
      cache: "no-store",
    });
    return normalizePaginatedResponse(response, pagination);
  },

  async getMovimientos(empresaId?: string): Promise<MovimientoFinanciero[]> {
    const [egresos, nominas, anticipos] = await Promise.all([
      this.getEgresos(empresaId),
      this.getNominas(empresaId),
      this.getAnticipos(empresaId),
    ]);

    return [...egresos, ...nominas, ...anticipos].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.fechaGeneracion || 0);
      const dateB = new Date(b.createdAt || b.fechaGeneracion || 0);
      return dateB.getTime() - dateA.getTime();
    });
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async crearEgreso(data: any) {
    return apiFetch("/finanzas/registrar-egreso", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async crearAnticipo(data: CreateAnticipoPayload) {
    return apiFetch("/finanzas/registrar-anticipo", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async registrarConsignacion(data: RegistrarConsignacionPayload | FormData) {
    if (data instanceof FormData) {
      return apiFetch("/finanzas/registrar-consignacion", {
        method: "POST",
        body: data,
      });
    }

    return apiFetch("/finanzas/registrar-consignacion", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async enviarRecordatorioLiquidacion(
    membershipId: string,
    empresaId?: string,
  ): Promise<SendLiquidationReminderResponse> {
    return apiFetch<SendLiquidationReminderResponse>(
      `/finanzas/recaudo-tecnicos/${membershipId}/recordatorio-liquidacion`,
      {
        method: "POST",
        body: JSON.stringify(empresaId ? { empresaId } : {}),
      },
    );
  },

  async generarNominaDesdeMonitoreo(
    data: GenerateMonitoringPayrollPayload,
  ): Promise<GenerateMonitoringPayrollResponse> {
    return apiFetch<GenerateMonitoringPayrollResponse>(
      "/finanzas/nominas/generar-desde-monitoreo",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  async getCuentaCobro(
    empresaId?: string,
  ): Promise<CuentaCobroDashboard> {
    const query = empresaId ? `?empresaId=${encodeURIComponent(empresaId)}` : "";
    return apiFetch<CuentaCobroDashboard>(`/finanzas/cuenta-cobro${query}`, {
      cache: "no-store",
    });
  },

  async crearCuentaCobroTurno(
    data: CuentaCobroTurnoPayload,
  ): Promise<CuentaCobroShift> {
    return apiFetch<CuentaCobroShift>("/finanzas/cuenta-cobro/turnos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async actualizarCuentaCobroTurno(
    turnoId: string,
    data: CuentaCobroTurnoPayload,
  ): Promise<CuentaCobroShift> {
    return apiFetch<CuentaCobroShift>(`/finanzas/cuenta-cobro/turnos/${turnoId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async eliminarCuentaCobroTurno(turnoId: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(
      `/finanzas/cuenta-cobro/turnos/${turnoId}`,
      { method: "DELETE" },
    );
  },

  async cerrarCuentaCobroPeriodo(
    empresaId: string,
  ): Promise<CuentaCobroPeriod> {
    return apiFetch<CuentaCobroPeriod>("/finanzas/cuenta-cobro/cerrar-periodo", {
      method: "POST",
      body: JSON.stringify({ empresaId }),
    });
  },

  async crearCuentaCobroUploadUrl(data: {
    empresaId: string;
    fileName: string;
    contentType?: string;
    tipo: "llegada" | "salida";
  }): Promise<CuentaCobroUploadUrlResponse> {
    return apiFetch<CuentaCobroUploadUrlResponse>(
      "/finanzas/cuenta-cobro/evidencias/upload-url",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },
};
