import { apiFetch } from "./base-client";

interface MonitoringParams {
  date?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  actions?: string[];
  users?: string[];
  entities?: string[];
  statuses?: string[];
  entityId?: string;
}

const buildQuery = (params: MonitoringParams) => {
  const q = new URLSearchParams();
  if (params.date) q.append("date", params.date);
  if (params.startDate) q.append("startDate", params.startDate);
  if (params.endDate) q.append("endDate", params.endDate);
  if (params.page) q.append("page", params.page.toString());
  if (params.limit) q.append("limit", params.limit.toString());
  params.actions?.forEach((value) => q.append("actions", value));
  params.users?.forEach((value) => q.append("users", value));
  params.entities?.forEach((value) => q.append("entities", value));
  params.statuses?.forEach((value) => q.append("statuses", value));
  if (params.entityId) q.append("entityId", params.entityId);
  const str = q.toString();
  return str ? `?${str}` : "";
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAuditsResponse(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return { results: [], meta: { total: 0, page: 1, limit: 20, totalPages: 1 } };
  }

  const nestedData = isRecord(payload.data) ? payload.data : null;

  const results =
    (Array.isArray(payload.results) ? payload.results : undefined) ||
    (nestedData && Array.isArray(nestedData.results) ? nestedData.results : undefined) ||
    (Array.isArray(payload.data) ? payload.data : undefined) ||
    [];

  const meta =
    (isRecord(payload.meta) ? payload.meta : undefined) ||
    (nestedData && isRecord(nestedData.meta) ? nestedData.meta : undefined) ||
    { total: results.length, page: 1, limit: 20, totalPages: 1 };

  return {
    results,
    meta,
  };
}

export const monitoringClient = {
  async getSessions(params: MonitoringParams = {}): Promise<unknown[]> {
    return apiFetch<unknown[]>(`/monitoring/sessions${buildQuery(params)}`);
  },
  async getStats(params: MonitoringParams = {}): Promise<Record<string, unknown>> {
    return apiFetch<Record<string, unknown>>(`/monitoring/stats${buildQuery(params)}`);
  },
  async getAlerts(params: MonitoringParams = {}): Promise<unknown[]> {
    return apiFetch<unknown[]>(`/monitoring/alerts${buildQuery(params)}`);
  },
  async getMetrics(params: MonitoringParams = {}): Promise<Record<string, unknown>> {
    return apiFetch<Record<string, unknown>>(`/monitoring/metrics${buildQuery(params)}`);
  },
  async getExecutiveAudit(params: MonitoringParams = {}): Promise<Record<string, unknown>> {
    return apiFetch<Record<string, unknown>>(`/monitoring/executive-audit${buildQuery(params)}`);
  },
  async getAudits(params: MonitoringParams = {}): Promise<Record<string, unknown>> {
    const response = await apiFetch<Record<string, unknown>>(`/monitoring/audits${buildQuery(params)}`);
    return normalizeAuditsResponse(response);
  },
  async getRecentLogs(params: MonitoringParams = {}): Promise<unknown[]> {
    return apiFetch<unknown[]>(`/monitoring/recent-logs${buildQuery(params)}`);
  },
  async getPayrollPreview(params: MonitoringParams = {}): Promise<Record<string, unknown>> {
    return apiFetch<Record<string, unknown>>(`/monitoring/payroll-preview${buildQuery(params)}`);
  },
  async getLogsByMembership(membershipId: string, params: MonitoringParams = {}): Promise<unknown[]> {
    return apiFetch<unknown[]>(`/monitoring/logs/${membershipId}${buildQuery(params)}`);
  },
  async trackEvent(data: Record<string, unknown>) {
    return apiFetch("/monitoring/event", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  async sendHeartbeat(inactiveMinutes: number = 0) {
    return apiFetch("/monitoring/heartbeat", {
      method: "POST",
      body: JSON.stringify({ inactiveMinutes }),
    });
  }
};
