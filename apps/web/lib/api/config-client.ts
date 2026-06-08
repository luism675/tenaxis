import { apiFetch } from "./base-client";

export interface ConfigItem {
  id: string;
  nombre: string;
  descripcion?: string | null;
  frecuenciaSugerida?: number | null;
  riesgoSugerido?: string | null;
  activo?: boolean;
  [key: string]: unknown;
}

export type DiaSemana =
  | "LUNES"
  | "MARTES"
  | "MIERCOLES"
  | "JUEVES"
  | "VIERNES"
  | "SABADO"
  | "DOMINGO";

export interface PicoPlacaRule {
  id?: string;
  tenantId?: string;
  empresaId: string;
  dia: DiaSemana;
  numeroUno: number;
  numeroDos: number;
  activo: boolean;
}

export interface PicoPlacaRestrictionOperator {
  membershipId: string;
  nombre?: string;
  placa: string;
  vehiculo: "MOTO" | "CARRO";
  digito: number;
}

export interface PicoPlacaRestrictionsResponse {
  fecha: string;
  dia: DiaSemana;
  regla: PicoPlacaRule | null;
  operadoresRestringidos: PicoPlacaRestrictionOperator[];
}

type ApiListResponse<T> = T[] | { data?: T[] };

const unwrapList = <T>(response: ApiListResponse<T>): T[] => {
  if (Array.isArray(response)) {
    return response;
  }

  return Array.isArray(response.data) ? response.data : [];
};

export const configClient = {
  async getSegmentos(options?: { signal?: AbortSignal }): Promise<ConfigItem[]> {
    const res = await apiFetch<ApiListResponse<ConfigItem>>("/config-clientes/segmentos", {
      signal: options?.signal,
    });
    return unwrapList(res);
  },
  async getRiesgos(options?: { signal?: AbortSignal }): Promise<ConfigItem[]> {
    const res = await apiFetch<ApiListResponse<ConfigItem>>("/config-clientes/riesgos", {
      signal: options?.signal,
    });
    return unwrapList(res);
  },
  async getIntereses(options?: { signal?: AbortSignal }): Promise<ConfigItem[]> {
    const res = await apiFetch<ApiListResponse<ConfigItem>>("/config-clientes/intereses", {
      signal: options?.signal,
    });
    return unwrapList(res);
  },
  async createInteres(data: Record<string, unknown>) {
    return apiFetch("/config-clientes/intereses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async updateInteres(id: string, data: Record<string, unknown>) {
    return apiFetch(`/config-clientes/intereses/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  async getTiposServicio(empresaId: string): Promise<ConfigItem[]> {
    const res = await apiFetch<ApiListResponse<ConfigItem>>(
      `/config-clientes/tipos-servicio?empresaId=${empresaId}`,
    );
    return unwrapList(res);
  },
  async getMetodosPago(empresaId: string): Promise<ConfigItem[]> {
    const res = await apiFetch<ApiListResponse<ConfigItem>>(
      `/config-clientes/metodos-pago?empresaId=${empresaId}`,
    );
    return unwrapList(res);
  },
  async getZonas(empresaId: string): Promise<ConfigItem[]> {
    const res = await apiFetch<ApiListResponse<ConfigItem>>(
      `/config-clientes/zonas?empresaId=${empresaId}`,
    );
    return unwrapList(res);
  },
  async getServicios(empresaId?: string): Promise<ConfigItem[]> {
    const url = empresaId ? `/config-clientes/servicios?empresaId=${empresaId}` : "/config-clientes/servicios";
    const res = await apiFetch<ApiListResponse<ConfigItem>>(url);
    return unwrapList(res);
  },
  async createServicio(data: Record<string, unknown>) {
    return apiFetch("/config-clientes/servicios", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async updateServicio(id: string, data: Record<string, unknown>) {
    return apiFetch(`/config-clientes/servicios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  async deleteServicio(id: string) {
    return apiFetch(`/config-clientes/servicios/${id}`, {
      method: "DELETE",
    });
  },
  async getPicoPlaca(empresaId: string): Promise<PicoPlacaRule[]> {
    const query = new URLSearchParams({ empresaId });
    const res = await apiFetch<ApiListResponse<PicoPlacaRule>>(
      `/config-clientes/pico-placa?${query.toString()}`,
    );
    return unwrapList(res);
  },
  async updatePicoPlaca(
    empresaId: string,
    reglas: Array<Omit<PicoPlacaRule, "id" | "tenantId" | "empresaId">>,
  ): Promise<PicoPlacaRule[]> {
    const res = await apiFetch<ApiListResponse<PicoPlacaRule>>(
      `/config-clientes/pico-placa/${encodeURIComponent(empresaId)}`,
      {
        method: "PUT",
        body: JSON.stringify({ reglas }),
      },
    );
    return unwrapList(res);
  },
  async getPicoPlacaRestrictions(
    empresaId: string,
    fecha?: string,
  ): Promise<PicoPlacaRestrictionsResponse> {
    const query = new URLSearchParams({ empresaId });
    if (fecha) query.set("fecha", fecha);

    return apiFetch<PicoPlacaRestrictionsResponse>(
      `/config-clientes/pico-placa/restricciones?${query.toString()}`,
    );
  },
  async getClienteOperativa(clienteId: string): Promise<unknown[]> {
    const res = await apiFetch<ApiListResponse<unknown>>(
      `/config-clientes/operativa/${clienteId}`,
    );
    return unwrapList(res);
  },
  async upsertOperativa(payload: Record<string, unknown>) {
    return apiFetch("/config-clientes/operativa", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
};
