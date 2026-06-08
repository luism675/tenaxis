import { apiFetch } from "./base-client";

type PaginatedResponse<T> = {
  data?: T[];
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
};

type ServiciosListResponse = unknown[] | PaginatedResponse<unknown>;

type ServiciosMutationOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

type ServiciosGetAllOptions = {
  estado?: string;
  fechaFin?: string;
  fechaInicio?: string;
  fetchAllPages?: boolean;
  limit?: number;
  page?: number;
  preset?: string;
  tecnicoId?: string;
};

const MAX_SERVICIOS_PAGE_SIZE = 200;

function buildServiciosListUrl(
  empresaId?: string,
  clienteId?: string,
  options: ServiciosGetAllOptions = {},
) {
  let url = "/ordenes-servicio";
  const params = new URLSearchParams();

  if (empresaId && empresaId !== "all") params.append("empresaId", empresaId);
  if (clienteId) params.append("clienteId", clienteId);

  Object.entries(options).forEach(([key, value]) => {
    if (
      key === "fetchAllPages" ||
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return;
    }

    params.append(key, String(value));
  });

  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;

  return url;
}

function extractServiciosData(response: ServiciosListResponse) {
  if (!Array.isArray(response) && Array.isArray(response.data)) {
    return response.data;
  }

  return Array.isArray(response) ? response : [];
}

export const serviciosClient = {
  async getAll(
    empresaId?: string,
    clienteId?: string,
    options: ServiciosGetAllOptions = {},
  ): Promise<unknown[]> {
    const firstPage = options.page ?? 1;
    const shouldFetchAllPages = options.fetchAllPages === true;
    const pageSize =
      options.limit ?? (shouldFetchAllPages ? MAX_SERVICIOS_PAGE_SIZE : undefined);

    const fetchPage = async (page: number) => {
      const pageOptions: ServiciosGetAllOptions = { ...options };

      if (pageSize !== undefined) {
        pageOptions.limit = pageSize;
      }

      if (shouldFetchAllPages || options.page !== undefined || page > 1) {
        pageOptions.page = page;
      }

      const url = buildServiciosListUrl(empresaId, clienteId, {
        ...pageOptions,
      });

      return apiFetch<ServiciosListResponse>(url, { cache: "no-store" });
    };

    const firstResponse = await fetchPage(firstPage);
    const firstPageData = extractServiciosData(firstResponse);

    if (
      !shouldFetchAllPages ||
      Array.isArray(firstResponse) ||
      !firstResponse.meta ||
      firstResponse.meta.totalPages <= firstPage
    ) {
      return firstPageData;
    }

    const allData = [...firstPageData];

    for (
      let page = firstPage + 1;
      page <= firstResponse.meta.totalPages;
      page += 1
    ) {
      const response = await fetchPage(page);
      allData.push(...extractServiciosData(response));
    }

    return allData;
  },

  async getById(id: string): Promise<Record<string, unknown> | null> {
    try {
      return await apiFetch<Record<string, unknown>>(`/ordenes-servicio/${id}`, { cache: "no-store" });
    } catch (error) {
      console.error("serviciosClient.getById error:", error);
      return null;
    }
  },

  async create(
    data: Record<string, unknown>,
    options: ServiciosMutationOptions = {},
  ) {
    return apiFetch("/ordenes-servicio", {
      method: "POST",
      body: JSON.stringify(data),
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? 25_000,
    });
  },

  async update(id: string, payload: Record<string, unknown> | FormData) {
    const isFormData = payload instanceof FormData;
    return apiFetch(`/ordenes-servicio/${id}`, {
      method: "PATCH",
      body: isFormData ? payload : JSON.stringify(payload),
    });
  },

  async addEvidencias(id: string, formData: FormData) {
    return apiFetch(`/ordenes-servicio/${id}/evidencias`, {
      method: "POST",
      body: formData,
    });
  },

  async delete(id: string) {
    return apiFetch(`/ordenes-servicio/${id}`, {
      method: "DELETE",
    });
  }
};
