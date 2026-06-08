import { apiFetch } from "@/lib/api/base-client";

export interface FollowUpNotificationItem {
  id: string;
  ordenServicioId: string;
  empresaId: string;
  numeroOrden: string | null;
  dueAt: string;
  followUpType: string;
  cliente: string;
  servicio: string;
  responsibleName: string | null;
  responsibleMembershipId: string | null;
  isMine: boolean;
  isOverdue: boolean;
}

export interface FollowUpNotificationsSummary {
  scope: "mine" | "team";
  totalPending: number;
  overdueCount: number;
  todayCount: number;
  generatedAt: string;
  categories: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  items: FollowUpNotificationItem[];
}

export interface FollowUpNotificationsParams {
  empresaId?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

type ApiEnvelope<T> = {
  data?: T;
  meta?: FollowUpNotificationsSummary["meta"];
};

const normalizeEmpresaId = (empresaId?: string | null) => {
  if (!empresaId || empresaId === "all" || empresaId === "undefined") {
    return undefined;
  }

  return empresaId;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const buildFallbackMeta = (
  options: FollowUpNotificationsParams = {},
): FollowUpNotificationsSummary["meta"] => ({
  page: Math.max(1, options.page ?? 1),
  pageSize: Math.max(1, options.pageSize ?? 8),
  total: 0,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
});

function normalizeFollowUpNotificationsSummary(
  response:
    | FollowUpNotificationsSummary
    | ApiEnvelope<FollowUpNotificationsSummary>
    | null
    | undefined,
  options: FollowUpNotificationsParams = {},
): FollowUpNotificationsSummary {
  const envelope: Record<string, unknown> = isRecord(response) ? response : {};
  const payload: Record<string, unknown> = isRecord(envelope.data)
    ? envelope.data
    : envelope;
  const fallbackMeta = buildFallbackMeta(options);
  const meta = isRecord(payload.meta)
    ? (payload.meta as FollowUpNotificationsSummary["meta"])
    : isRecord(envelope.meta)
      ? envelope.meta
      : fallbackMeta;

  return {
    scope: payload.scope === "team" ? "team" : "mine",
    totalPending:
      typeof payload.totalPending === "number" ? payload.totalPending : 0,
    overdueCount:
      typeof payload.overdueCount === "number" ? payload.overdueCount : 0,
    todayCount: typeof payload.todayCount === "number" ? payload.todayCount : 0,
    generatedAt:
      typeof payload.generatedAt === "string"
        ? payload.generatedAt
        : new Date().toISOString(),
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    meta: {
      ...fallbackMeta,
      ...meta,
    },
    items: Array.isArray(payload.items) ? payload.items : [],
  };
}

export async function getFollowUpNotificationsSummary(
  options: FollowUpNotificationsParams = {},
) {
  const cleanEmpresaId = normalizeEmpresaId(options.empresaId);
  const params = new URLSearchParams();

  if (cleanEmpresaId) {
    params.set("empresaId", cleanEmpresaId);
  }

  if (options.category && options.category !== "all") {
    params.set("category", options.category);
  }

  if (options.page && options.page > 0) {
    params.set("page", `${options.page}`);
  }

  if (options.pageSize && options.pageSize > 0) {
    params.set("pageSize", `${options.pageSize}`);
  }

  const query = params.toString();

  const response = await apiFetch<
    FollowUpNotificationsSummary | ApiEnvelope<FollowUpNotificationsSummary>
  >(
    `/ordenes-servicio/follow-ups/notifications-summary${query ? `?${query}` : ""}`,
  );

  return normalizeFollowUpNotificationsSummary(response, options);
}

export function buildFollowUpNotificationsStreamPath(empresaId?: string) {
  const cleanEmpresaId = normalizeEmpresaId(empresaId);
  const params = new URLSearchParams();

  if (cleanEmpresaId) {
    params.set("empresaId", cleanEmpresaId);
  }

  const query = params.toString();
  return `/api/follow-ups/notifications-stream${query ? `?${query}` : ""}`;
}

export function buildPendingFollowUpsHref() {
  return "/dashboard/servicios?tab=seguimientos&preset=ACCIONES_PENDIENTES";
}
