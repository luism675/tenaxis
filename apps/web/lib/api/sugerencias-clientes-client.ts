import { apiFetch } from "./base-client";

export interface SugerenciaItem {
  id: string;
  clienteId: string;
  tipo: string;
  prioridad: string;
  estado: string;
  titulo: string;
  descripcion: string;
  creadoAt: string;
  cliente?: Record<string, unknown> | null;
}

export interface SugerenciasPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface SugerenciaStats {
  pendientesPorPrioridad: Record<string, number>;
  tasaAceptacion: number;
  tiempoPromedioEjecucionMin: number;
  totalHoy: number;
}

export interface SugerenciasPageResponse {
  sugerencias: SugerenciaItem[];
  pagination: SugerenciasPagination | null;
}

type WrappedResponse = {
  data?: unknown;
  pagination?: unknown;
  sugerencias?: unknown;
  items?: unknown;
  statusCode?: number;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function normalizePagination(value: unknown): SugerenciasPagination | null {
  if (!isRecord(value)) {
    return null;
  }

  const page = Number(value.page);
  const limit = Number(value.limit);
  const total = Number(value.total);
  const totalPages = Number(value.totalPages);
  const hasNextPage = Boolean(value.hasNextPage);
  const hasPrevPage = Boolean(value.hasPrevPage);

  if (
    Number.isNaN(page) ||
    Number.isNaN(limit) ||
    Number.isNaN(total) ||
    Number.isNaN(totalPages)
  ) {
    return null;
  }

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
}

function normalizePageResponse(raw: unknown): SugerenciasPageResponse {
  if (Array.isArray(raw)) {
    return { sugerencias: raw as SugerenciaItem[], pagination: null };
  }

  if (!isRecord(raw)) {
    return { sugerencias: [], pagination: null };
  }

  const candidate = raw as WrappedResponse;
  const fromData = candidate.data;

  if (Array.isArray(fromData)) {
    return {
      sugerencias: fromData as SugerenciaItem[],
      pagination: normalizePagination(candidate.pagination),
    };
  }

  if (isRecord(fromData)) {
    if (Array.isArray(fromData.sugerencias)) {
      return {
        sugerencias: fromData.sugerencias as SugerenciaItem[],
        pagination: normalizePagination(fromData.pagination),
      };
    }

    if (Array.isArray(fromData.items)) {
      return {
        sugerencias: fromData.items as SugerenciaItem[],
        pagination: normalizePagination(fromData.pagination),
      };
    }
  }

  if (Array.isArray(candidate.sugerencias)) {
    return {
      sugerencias: candidate.sugerencias as SugerenciaItem[],
      pagination: normalizePagination(candidate.pagination),
    };
  }

  if (Array.isArray(candidate.items)) {
    return {
      sugerencias: candidate.items as SugerenciaItem[],
      pagination: normalizePagination(candidate.pagination),
    };
  }

  return { sugerencias: [], pagination: null };
}

function normalizeStatsResponse(raw: unknown): SugerenciaStats {
  if (!isRecord(raw)) {
    return {
      pendientesPorPrioridad: {},
      tasaAceptacion: 0,
      tiempoPromedioEjecucionMin: 0,
      totalHoy: 0,
    };
  }

  const candidate = raw as WrappedResponse;
  const data = (isRecord(candidate.data) ? candidate.data : candidate) as Record<string, unknown>;

  return {
    pendientesPorPrioridad:
      (data["pendientesPorPrioridad"] as Record<string, number>) || {},
    tasaAceptacion: Number(data["tasaAceptacion"] || 0),
    tiempoPromedioEjecucionMin: Number(data["tiempoPromedioEjecucionMin"] || 0),
    totalHoy: Number(data["totalHoy"] || 0),
  };
}

export const sugerenciasClient = {
  async getPage(
    page = 1,
    limit = 12,
  ): Promise<SugerenciasPageResponse> {
    const response = await apiFetch<unknown>(
      `/sugerencias-clientes?page=${page}&limit=${limit}`,
      {
        cache: "no-store",
      },
    );

    return normalizePageResponse(response);
  },

  async getStats(): Promise<SugerenciaStats> {
    const response = await apiFetch<unknown>("/sugerencias-clientes/stats", {
      cache: "no-store",
    });

    return normalizeStatsResponse(response);
  },
};
