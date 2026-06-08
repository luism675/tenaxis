import { apiFetch } from "./base-client";

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface Municipality {
  id: string;
  name: string;
  code: string;
  departmentId: string;
}

type ApiListResponse<T> = T[] | { data?: T[] };

const unwrapList = <T>(response: ApiListResponse<T>): T[] => {
  if (Array.isArray(response)) {
    return response;
  }

  return Array.isArray(response.data) ? response.data : [];
};

export const geoClient = {
  async getDepartments(options?: { signal?: AbortSignal }): Promise<Department[]> {
    const res = await apiFetch<ApiListResponse<Department>>("/geo/departments", {
      signal: options?.signal,
    });
    return unwrapList(res);
  },
  async getMunicipalities(options?: { signal?: AbortSignal }): Promise<Municipality[]> {
    const res = await apiFetch<ApiListResponse<Municipality>>("/geo/municipalities", {
      signal: options?.signal,
    });
    return unwrapList(res);
  }
};
