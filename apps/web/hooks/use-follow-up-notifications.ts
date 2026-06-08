"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getBrowserCookie } from "@/lib/api/browser-client";
import { getBrowserScopedEnterpriseId } from "@/lib/browser-access-scope";
import {
  getFollowUpNotificationsSummary,
  type FollowUpNotificationsParams,
  type FollowUpNotificationsSummary,
} from "@/lib/api/follow-up-notifications-client";

export const FOLLOW_UP_NOTIFICATIONS_QUERY_KEY = "follow-up-notifications";

const resolveCurrentEmpresaId = () =>
  getBrowserScopedEnterpriseId() ?? getBrowserCookie("x-enterprise-id") ?? undefined;

export function useFollowUpNotificationsEnterpriseId() {
  const [empresaId, setEmpresaId] = useState<string | undefined>(undefined);
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    const syncEmpresaId = () => {
      setEmpresaId(resolveCurrentEmpresaId());
      setIsResolved(true);
    };

    syncEmpresaId();
    window.addEventListener("focus", syncEmpresaId);
    window.addEventListener("storage", syncEmpresaId);

    return () => {
      window.removeEventListener("focus", syncEmpresaId);
      window.removeEventListener("storage", syncEmpresaId);
    };
  }, []);

  return { empresaId, isResolved };
}

export function buildFollowUpNotificationsQueryKey(
  empresaId?: string,
  params: Omit<FollowUpNotificationsParams, "empresaId"> = {},
) {
  return [
    FOLLOW_UP_NOTIFICATIONS_QUERY_KEY,
    empresaId ?? "all",
    params.category ?? "all",
    params.page ?? 1,
    params.pageSize ?? 8,
  ] as const;
}

export function useFollowUpNotifications(
  params: Omit<FollowUpNotificationsParams, "empresaId"> = {},
) {
  const { empresaId, isResolved } = useFollowUpNotificationsEnterpriseId();
  const { category, page, pageSize } = params;
  const queryKey = useMemo(
    () => buildFollowUpNotificationsQueryKey(empresaId, { category, page, pageSize }),
    [empresaId, category, page, pageSize],
  );

  const query = useQuery<FollowUpNotificationsSummary>({
    queryKey,
    queryFn: () =>
      getFollowUpNotificationsSummary({
        empresaId,
        category,
        page,
        pageSize,
      }),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: isResolved,
  });

  return {
    ...query,
    empresaId,
    isResolved,
    summary: query.data,
  };
}
