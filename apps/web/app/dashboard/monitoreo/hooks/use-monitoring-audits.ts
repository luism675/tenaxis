"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  Audit,
  AuditFilters,
  AuditFilterOptions,
  AuditMeta,
} from "../types";
import { monitoringClient } from "@/lib/api/monitoreo-client";

const EMPTY_FILTER_OPTIONS: AuditFilterOptions = {
  actions: [],
  entities: [],
  statuses: [],
  users: [],
};

const DEFAULT_META: AuditMeta = {
  total: 0,
  page: 1,
  limit: 20,
  totalPages: 1,
  filterOptions: EMPTY_FILTER_OPTIONS,
};

const createDefaultFilters = (): AuditFilters => ({
  entityId: "",
  actions: [],
  users: [],
  entities: [],
  statuses: [],
});

interface MonitoringAuditsPeriod {
  date?: string;
  startDate?: string;
  endDate?: string;
}

export function useMonitoringAudits(period: MonitoringAuditsPeriod = {}) {
  const { date, startDate, endDate } = period;
  const [filters, setFilters] = useState<AuditFilters>(createDefaultFilters);
  const [debouncedEntityId, setDebouncedEntityId] = useState("");
  const [pageState, setPageState] = useState<{ signature: string; page: number }>({
    signature: "",
    page: 1,
  });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedEntityId(filters.entityId.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [filters.entityId]);

  const pageSignature = useMemo(
    () =>
      [
        date ?? "",
        startDate ?? "",
        endDate ?? "",
        debouncedEntityId,
        filters.actions.join("|"),
        filters.users.join("|"),
        filters.entities.join("|"),
        filters.statuses.join("|"),
      ].join("::"),
    [
      date,
      startDate,
      endDate,
      debouncedEntityId,
      filters.actions,
      filters.users,
      filters.entities,
      filters.statuses,
    ],
  );

  const currentPage = pageState.signature === pageSignature ? pageState.page : 1;

  const setCurrentPage = (page: number) => {
    setPageState({
      signature: pageSignature,
      page,
    });
  };

  const auditsQuery = useQuery({
    queryKey: [
      "monitoring",
      "audits",
      currentPage,
      date,
      startDate,
      endDate,
      debouncedEntityId,
      filters.actions.join("|"),
      filters.users.join("|"),
      filters.entities.join("|"),
      filters.statuses.join("|"),
    ],
    queryFn: async () => {
      const result = (await monitoringClient.getAudits({
        page: currentPage,
        limit: 20,
        date,
        startDate,
        endDate,
        entityId: debouncedEntityId || undefined,
        actions: filters.actions.length > 0 ? filters.actions : undefined,
        users: filters.users.length > 0 ? filters.users : undefined,
        entities: filters.entities.length > 0 ? filters.entities : undefined,
        statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
      })) as {
        results?: Audit[];
        data?: Audit[];
        meta?: AuditMeta;
      };

      return {
        data: Array.isArray(result.results)
          ? result.results
          : Array.isArray(result.data)
            ? result.data
            : [],
        meta: result.meta || DEFAULT_META,
      };
    },
    staleTime: 60000,
    retry: 2,
  });

  useEffect(() => {
    if (auditsQuery.isError) {
      toast.error("Error al sincronizar auditorías del servidor");
    }
  }, [auditsQuery.isError]);

  const auditsData = useMemo(() => {
    const response = auditsQuery.data;

    if (!response) {
      return {
        results: [] as Audit[],
        meta: DEFAULT_META,
      };
    }

    return {
      results: Array.isArray(response.data) ? response.data : [],
      meta: response.meta || DEFAULT_META,
    };
  }, [auditsQuery.data]);

  const updateFilters = (updater: Partial<AuditFilters> | ((prev: AuditFilters) => AuditFilters)) => {
    setFilters((prev) =>
      typeof updater === "function" ? updater(prev) : { ...prev, ...updater },
    );
  };

  const setEntityIdFilter = (value: string) => {
    setFilters((prev) => ({ ...prev, entityId: value }));

    if (!value.trim()) {
      setDebouncedEntityId("");
    }
  };

  const clearFilters = () => {
    setDebouncedEntityId("");
    setFilters(createDefaultFilters());
  };

  return {
    audits: auditsData.results,
    meta: auditsData.meta,
    filterOptions: auditsData.meta.filterOptions || EMPTY_FILTER_OPTIONS,
    filters,
    updateFilters,
    setEntityIdFilter,
    clearFilters,
    currentPage,
    setCurrentPage,
    lastUpdated: auditsQuery.dataUpdatedAt,
    isLoading: auditsQuery.isLoading,
    isRefreshing: auditsQuery.isFetching,
    isError: auditsQuery.isError,
    fetchAudits: () => auditsQuery.refetch(),
  };
}
