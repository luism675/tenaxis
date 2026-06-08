import { apiFetch } from "./base-client";

export interface Enterprise {
  id: string;
  nombre: string;
  nit?: string;
  address?: string;
  phone?: string;
  email?: string;
}

type EnterpriseListResponse =
  | Enterprise[]
  | {
      items?: Enterprise[];
      data?: Enterprise[];
    };

export const enterpriseClient = {
  async getAll(): Promise<Enterprise[]> {
    const result = await apiFetch<EnterpriseListResponse>("/enterprise");
    if (!Array.isArray(result) && Array.isArray(result.items)) {
      return result.items;
    }
    if (!Array.isArray(result) && Array.isArray(result.data)) {
      return result.data;
    }
    return Array.isArray(result) ? result : [];
  },
  async getOperators(empresaId?: string): Promise<unknown[]> {
    return apiFetch<unknown[]>(
      empresaId ? `/enterprise/${empresaId}/operators` : "/enterprise/operators",
    );
  },
  async create(data: Record<string, unknown>) {
    return apiFetch<Enterprise>("/enterprise/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async update(id: string, data: Record<string, unknown>) {
    return apiFetch<Enterprise>(`/enterprise/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  async delete(id: string) {
    return apiFetch(`/enterprise/${id}`, {
      method: "DELETE",
    });
  }
};
