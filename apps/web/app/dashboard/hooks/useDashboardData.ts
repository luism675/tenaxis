"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/base-client";
import { serviciosClient } from "@/lib/api/servicios-client";
import type {
  DashboardKpisType,
  DashboardTrendsType,
  DashboardActionableType,
  DashboardOverviewType,
} from "../schemas/dashboard.schema";

export const DASHBOARD_STATS_KEY = "dashboard-stats";
export const RECENT_ACTIVITY_KEY = "recent-activity";

async function getDashboardStats(empresaId?: string) {
  const cleanId =
    empresaId === "all" || empresaId === "undefined" || !empresaId ? undefined : empresaId;
  const url = cleanId ? `/dashboard/stats?empresaId=${cleanId}` : "/dashboard/stats";
  return apiFetch<{
    kpis: DashboardKpisType;
    trends: DashboardTrendsType;
    actionable: DashboardActionableType;
    overview: DashboardOverviewType;
  }>(url, { cache: "no-store" });
}

export function useDashboardStats(empresaId?: string) {
  return useQuery({
    queryKey: [DASHBOARD_STATS_KEY, empresaId],
    queryFn: () => getDashboardStats(empresaId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Selectors
export function useDashboardKpis(empresaId?: string) {
  return useQuery({
    queryKey: [DASHBOARD_STATS_KEY, empresaId],
    queryFn: () => getDashboardStats(empresaId),
    select: (data): DashboardKpisType => data.kpis,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardTrends(empresaId?: string) {
  return useQuery({
    queryKey: [DASHBOARD_STATS_KEY, empresaId],
    queryFn: () => getDashboardStats(empresaId),
    select: (data): DashboardTrendsType => data.trends,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardActionable(empresaId?: string) {
  return useQuery({
    queryKey: [DASHBOARD_STATS_KEY, empresaId],
    queryFn: () => getDashboardStats(empresaId),
    select: (data): DashboardActionableType => data.actionable,
    staleTime: 1000 * 60 * 5,
  });
}

export function useDashboardOverview(empresaId?: string) {
  return useQuery({
    queryKey: [DASHBOARD_STATS_KEY, empresaId],
    queryFn: () => getDashboardStats(empresaId),
    select: (data): DashboardOverviewType => data.overview,
    staleTime: 1000 * 60 * 5,
  });
}

export function useRecentActivity(empresaId?: string) {
  return useQuery({
    queryKey: [RECENT_ACTIVITY_KEY, empresaId],
    queryFn: async () => {
      const data = await serviciosClient.getAll(empresaId);
      return Array.isArray(data) ? data.slice(0, 4) : [];
    },
    staleTime: 1000 * 60 * 2, // 2 minutes for activity
  });
}

export function useDashboardRefresh(empresaId?: string) {
  const queryClient = useQueryClient();

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [DASHBOARD_STATS_KEY, empresaId] }),
      queryClient.invalidateQueries({ queryKey: [RECENT_ACTIVITY_KEY, empresaId] }),
    ]);
  };

  return { refreshAll };
}
