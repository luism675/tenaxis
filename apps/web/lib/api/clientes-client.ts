import { apiFetch } from "./base-client";

export interface Direccion {
  id: string;
  departmentId?: string;
  municipioId?: string;
  municipio?: string;
  barrio?: string;
  direccion?: string;
  latitud?: number;
  longitud?: number;
  linkMaps?: string;
  piso?: string;
  bloque?: string;
  unidad?: string;
  tipoUbicacion?: string;
  clasificacionPunto?: string;
  horarioInicio?: string;
  horarioFin?: string;
  restricciones?: string;
  nombreContacto?: string;
  telefonoContacto?: string;
  cargoContacto?: string;
  activa?: boolean;
  bloqueada?: boolean;
  motivoBloqueo?: string;
  precisionGPS?: number;
  validadoPorSistema?: boolean;
  municipioRel?: {
    id: string;
    name: string;
  };
}

export interface ClienteSearchResult {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  telefono?: string | null;
  telefono2?: string | null;
  razonSocial?: string | null;
  nit?: string | null;
  numeroDocumento?: string | null;
  tipoCliente: "PERSONA" | "EMPRESA";
  createdAt?: string;
  direcciones?: Direccion[];
}

export interface Cliente extends ClienteSearchResult {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  telefono: string;
  telefono2?: string | null;
  razonSocial?: string | null;
  nit?: string | null;
  tipoDocumento?: string | null;
  numeroDocumento?: string | null;
  correo?: string | null;
  tipoCliente: "PERSONA" | "EMPRESA";
  clasificacion?: "ORO" | "PLATA" | "BRONCE" | "RIESGO";
  interesId?: string | null;
  segmentoId?: string | null;
  riesgoId?: string | null;
  proximaVisita?: string | null;
  createdAt?: string;
  empresa?: { id: string, nombre: string };
  direcciones?: Direccion[];
  ordenesServicio?: unknown[];
  origenCliente?: string | null;
  actividadEconomica?: string | null;
  metrajeTotal?: number | null;
  segmento?: string | null;
  nivelRiesgo?: string | null;
  tipoInteresId?: string | null;
}

export type ClienteRankingClasificacion = "ORO" | "PLATA" | "BRONCE" | "RIESGO";

export interface ClienteRankingItem {
  rank: number;
  clienteId: string;
  cliente: string;
  tipoCliente: "PERSONA" | "EMPRESA";
  telefono: string;
  empresa?: { id: string; nombre: string } | null;
  clasificacionActual: ClienteRankingClasificacion | null;
  clasificacionSugerida: ClienteRankingClasificacion;
  scoreComercial: number;
  totalPagado: number;
  totalCotizado: number;
  ticketPromedio: number;
  totalServicios: number;
  liquidados: number;
  cancelados: number;
  noTomados: number;
  reprogramados: number;
  porcentajeCancelacion: number;
  porcentajeNoToma: number;
  ultimaVisita: string | null;
}

export interface ClientesRankingResponse {
  items: ClienteRankingItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface ClientesRankingKpisResponse {
  overview: {
    totalClientes: number;
    totalPagado: number;
    totalServicios: number;
    promedioTicket: number;
    porcentajeCancelacion: number;
    porcentajeNoToma: number;
    clientesEnRiesgo: number;
  };
  clasificacion: Record<ClienteRankingClasificacion, number>;
  meta: {
    cached: boolean;
    generatedAt: string;
    cacheTtlSeconds: number;
  };
}

export interface ClientesRankingApplyResponse {
  totalEvaluados: number;
  actualizados: number;
  tareasRetencionCreadas: number;
  tareasRetencionOmitidas: number;
  sinResponsable: number;
  clasificacion: Record<ClienteRankingClasificacion, number>;
}

export interface ClientesRankingQuery {
  page?: number;
  limit?: number;
  search?: string;
  sort?:
    | "ranking"
    | "cliente"
    | "totalPagado"
    | "ticketPromedio"
    | "liquidados"
    | "cancelacion"
    | "noTomados";
  dir?: "asc" | "desc";
  from?: string;
  to?: string;
}

export interface ClientesRankingKpisQuery {
  search?: string;
  from?: string;
  to?: string;
  refresh?: boolean;
}

type ApiWrappedResponse<T> = {
  data?: T;
  statusCode?: number;
  message?: string;
  meta?: unknown;
};

function unwrapApiData<T>(response: T | ApiWrappedResponse<T>): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    response.data
  ) {
    return response.data;
  }

  return response as T;
}

export interface ContratoCliente {
  id: string;
  tenantId: string;
  clienteId: string;
  empresaId: string;
  estado: "ACTIVO" | "PAUSADO" | "VENCIDO" | "CANCELADO";
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
  observaciones?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContratoClientePayload {
  empresaId: string;
  fechaInicio: string;
  fechaFin?: string | null;
  serviciosComprometidos?: number | null;
  frecuenciaServicio?: number | null;
  tipoFacturacion: ContratoCliente["tipoFacturacion"];
  estado?: ContratoCliente["estado"];
  observaciones?: string | null;
}

type ContratoClienteApiResponse = Partial<ContratoCliente> & {
  contratoId?: string;
  contrato_id?: string;
  tenant_id?: string;
  cliente_id?: string;
  empresa_id?: string;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  servicios_comprometidos?: number | null;
  frecuencia_servicio?: number | null;
  tipo_facturacion?: ContratoCliente["tipoFacturacion"];
  created_at?: string;
  updated_at?: string;
};

function normalizeContratoCliente(
  contrato: ContratoClienteApiResponse | null,
): ContratoCliente | null {
  if (!contrato) {
    return null;
  }

  const contractId = contrato.id ?? contrato.contratoId ?? contrato.contrato_id;
  if (!contractId) {
    return null;
  }

  return {
    id: contractId,
    tenantId: contrato.tenantId ?? contrato.tenant_id ?? "",
    clienteId: contrato.clienteId ?? contrato.cliente_id ?? "",
    empresaId: contrato.empresaId ?? contrato.empresa_id ?? "",
    estado: contrato.estado ?? "ACTIVO",
    fechaInicio: contrato.fechaInicio ?? contrato.fecha_inicio ?? "",
    fechaFin: contrato.fechaFin ?? contrato.fecha_fin ?? null,
    serviciosComprometidos:
      contrato.serviciosComprometidos ?? contrato.servicios_comprometidos ?? null,
    frecuenciaServicio:
      contrato.frecuenciaServicio ?? contrato.frecuencia_servicio ?? null,
    tipoFacturacion:
      contrato.tipoFacturacion ?? contrato.tipo_facturacion ?? "CONTRATO_MENSUAL",
    observaciones: contrato.observaciones ?? null,
    createdAt: contrato.createdAt ?? contrato.created_at,
    updatedAt: contrato.updatedAt ?? contrato.updated_at,
  };
}

export const clientesClient = {
  async getAll(options?: {
    includeEnterpriseId?: boolean;
  }): Promise<Cliente[]> {
    return apiFetch<Cliente[]>("/clientes/list", {
      cache: "no-store",
      includeEnterpriseId: options?.includeEnterpriseId,
    });
  },

  async search(
    query: string,
    options?: {
      limit?: number;
      includeEnterpriseId?: boolean;
    },
  ): Promise<ClienteSearchResult[]> {
    const params = new URLSearchParams();
    const normalizedQuery = query.trim();

    if (normalizedQuery) {
      params.set("q", normalizedQuery);
    }

    params.set("limit", String(options?.limit ?? 10));

    const result = await apiFetch<
      ClienteSearchResult[] | { data?: ClienteSearchResult[]; items?: ClienteSearchResult[] }
    >(`/clientes/search?${params.toString()}`, {
      cache: "no-store",
      includeEnterpriseId: options?.includeEnterpriseId,
    });

    if (Array.isArray(result)) {
      return result;
    }

    return result.data ?? result.items ?? [];
  },

  async getById(
    id: string,
    options?: {
      signal?: AbortSignal;
    },
  ): Promise<Cliente | null> {
    try {
      return await apiFetch<Cliente>(`/clientes/${id}`, {
        cache: "no-store",
        signal: options?.signal,
    });
  } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "name" in error &&
        error.name === "AbortError"
      ) {
        throw error;
      }

      console.error("clientesClient.getById error:", error);
      return null;
    }
  },

  async getRanking(query: ClientesRankingQuery = {}) {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();

    const response = await apiFetch<
      ClientesRankingResponse | ApiWrappedResponse<ClientesRankingResponse>
    >(
      `/clientes/ranking${queryString ? `?${queryString}` : ""}`,
      { cache: "no-store", includeEnterpriseId: false },
    );

    return unwrapApiData<ClientesRankingResponse>(response);
  },

  async getRankingKpis(query: ClientesRankingKpisQuery = {}) {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();

    const response = await apiFetch<
      | ClientesRankingKpisResponse
      | ApiWrappedResponse<ClientesRankingKpisResponse>
    >(
      `/clientes/ranking-kpis${queryString ? `?${queryString}` : ""}`,
      { cache: "no-store", includeEnterpriseId: false },
    );

    return unwrapApiData<ClientesRankingKpisResponse>(response);
  },

  async applyRankingClassifications(query: ClientesRankingKpisQuery = {}) {
    const params = new URLSearchParams();

    (["search", "from", "to"] as const).forEach((key) => {
      const value = query[key];
      if (value !== undefined && value !== null && value !== "") {
        params.set(key, String(value));
      }
    });

    const queryString = params.toString();

    const response = await apiFetch<
      | ClientesRankingApplyResponse
      | ApiWrappedResponse<ClientesRankingApplyResponse>
    >(
      `/clientes/ranking/apply-classifications${queryString ? `?${queryString}` : ""}`,
      { method: "POST", cache: "no-store", includeEnterpriseId: false },
    );

    return unwrapApiData<ClientesRankingApplyResponse>(response);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async create(data: any) {
    return apiFetch<Cliente>("/clientes/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async update(id: string, data: any) {
    return apiFetch<Cliente>(`/clientes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiFetch(`/clientes/${id}`, {
      method: "DELETE",
    });
  },

  async getActiveContrato(
    id: string,
    empresaId?: string,
    options?: {
      signal?: AbortSignal;
    },
  ) {
    const params = new URLSearchParams();
    if (empresaId) {
      params.set("empresaId", empresaId);
    }
    const query = params.toString();
    const contrato = await apiFetch<ContratoClienteApiResponse | null>(
      `/clientes/${id}/contrato-activo${query ? `?${query}` : ""}`,
      { cache: "no-store", signal: options?.signal },
    );
    return normalizeContratoCliente(contrato);
  },

  async createContrato(id: string, data: ContratoClientePayload) {
    const contrato = await apiFetch<ContratoClienteApiResponse>(
      `/clientes/${id}/contratos`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
    const normalizedContrato = normalizeContratoCliente(contrato);
    if (!normalizedContrato) {
      throw new Error("La API devolvio un contrato sin identificador.");
    }
    return normalizedContrato;
  },

  async updateContrato(id: string, data: Partial<ContratoClientePayload>) {
    const contrato = await apiFetch<ContratoClienteApiResponse>(
      `/clientes/contratos/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
    );
    const normalizedContrato = normalizeContratoCliente(contrato);
    if (!normalizedContrato) {
      throw new Error("La API devolvio un contrato sin identificador.");
    }
    return normalizedContrato;
  }
};
