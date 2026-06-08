import { apiFetch } from "./base-client";

export interface ClientesDashboardKpisResponse {
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
}

interface ClientesDashboardKpisWrappedResponse {
  statusCode?: number;
  message?: string;
  data?: ClientesDashboardKpisResponse;
  meta?: {
    cached?: boolean;
    generatedAt?: string;
    cacheTtlSeconds?: number;
  };
}

export const clientesKpisClient = {
  async getDashboardKpis(
    options?: { refresh?: boolean; signal?: AbortSignal; timeoutMs?: number },
  ): Promise<ClientesDashboardKpisResponse> {
    const params = new URLSearchParams();
    if (options?.refresh) {
      params.set("refresh", "true");
    }

    const response = await apiFetch<
      ClientesDashboardKpisResponse | ClientesDashboardKpisWrappedResponse
    >(
      `/clientes/dashboard-kpis${params.toString() ? `?${params.toString()}` : ""}`,
      {
        cache: "no-store",
        includeEnterpriseId: true,
        signal: options?.signal,
        timeoutMs: options?.timeoutMs ?? 12_000,
      },
    );

    if (
      response &&
      typeof response === "object" &&
      "data" in response &&
      response.data
    ) {
      return response.data;
    }

    return response as ClientesDashboardKpisResponse;
  },
};
