import { apiFetch } from "./base-client";

export type TeamTaskStatus =
  | "PENDIENTE"
  | "EN_PROGRESO"
  | "BLOQUEADA"
  | "COMPLETADA"
  | "CANCELADA";

export type TeamTaskDueFilter = "vencidas" | "hoy" | "semana";

export type TeamTaskPerson = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
};

export type TeamTask = {
  id: string;
  tenantId: string;
  empresaId: string;
  titulo: string;
  descripcion?: string | null;
  observaciones?: string | null;
  estado: TeamTaskStatus;
  fechaLimite?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  responsable: TeamTaskPerson | null;
  asignadaPor: TeamTaskPerson;
};

export type TeamTaskSummary = {
  total: number;
  vencidas: number;
  byStatus: Record<TeamTaskStatus, number>;
};

export type TeamTasksResponse = {
  items: TeamTask[];
  summary: TeamTaskSummary;
  pagination: TeamTaskPagination;
};

export type TeamTaskPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

export type TeamTaskFilters = {
  estado?: TeamTaskStatus;
  responsableMembershipId?: string;
  search?: string;
  vencimiento?: TeamTaskDueFilter;
  page?: number;
  limit?: number;
};

export type CreateTeamTaskPayload = {
  titulo: string;
  descripcion?: string;
  observaciones?: string;
  responsableMembershipId?: string | null;
  fechaLimite?: string;
};

export type UpdateTeamTaskPayload = Partial<Omit<CreateTeamTaskPayload, "fechaLimite">> & {
  fechaLimite?: string | null;
};

const buildQuery = (filters: TeamTaskFilters = {}) => {
  const params = new URLSearchParams();

  if (filters.estado) params.set("estado", filters.estado);
  if (filters.responsableMembershipId) {
    params.set("responsableMembershipId", filters.responsableMembershipId);
  }
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.vencimiento) params.set("vencimiento", filters.vencimiento);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));

  const query = params.toString();
  return query ? `?${query}` : "";
};

export const teamTasksClient = {
  getAll(filters?: TeamTaskFilters) {
    return apiFetch<TeamTasksResponse>(`/equipo-trabajo/tareas${buildQuery(filters)}`);
  },

  getAssignees() {
    return apiFetch<TeamTaskPerson[]>("/equipo-trabajo/tareas/responsables");
  },

  create(payload: CreateTeamTaskPayload) {
    return apiFetch<TeamTask>("/equipo-trabajo/tareas", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateTeamTaskPayload) {
    return apiFetch<TeamTask>(`/equipo-trabajo/tareas/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  changeStatus(id: string, estado: TeamTaskStatus) {
    return apiFetch<TeamTask>(`/equipo-trabajo/tareas/${id}/estado`, {
      method: "PATCH",
      body: JSON.stringify({ estado }),
    });
  },

  delete(id: string) {
    return apiFetch<TeamTask>(`/equipo-trabajo/tareas/${id}`, {
      method: "DELETE",
    });
  },
};
