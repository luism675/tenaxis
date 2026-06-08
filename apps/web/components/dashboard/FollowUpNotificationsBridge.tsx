"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  buildFollowUpNotificationsStreamPath,
  type FollowUpNotificationItem,
  type FollowUpNotificationsSummary,
} from "@/lib/api/follow-up-notifications-client";
import {
  buildFollowUpNotificationsQueryKey,
  useFollowUpNotifications,
} from "@/hooks/use-follow-up-notifications";

const formatDueLabel = (value: string) => {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(parsed);
};

const notifyNewPendingItems = (
  nextSummary: FollowUpNotificationsSummary,
  previousSummary: FollowUpNotificationsSummary | null,
) => {
  if (!previousSummary) {
    return;
  }

  const previousIds = new Set(previousSummary.items.map((item) => item.id));
  const newItems = nextSummary.items.filter((item) => !previousIds.has(item.id));

  if (newItems.length === 1) {
    const item = newItems[0] as FollowUpNotificationItem;
    toast.info("Nueva acción pendiente", {
      description: `${item.cliente} · ${item.servicio} · ${formatDueLabel(item.dueAt)}`,
    });
    return;
  }

  if (newItems.length > 1) {
    toast.info(`${newItems.length} nuevas acciones pendientes`, {
      description: "Revisalas en Notificaciones o en la TAB de seguimientos.",
    });
    return;
  }

  if (nextSummary.totalPending > previousSummary.totalPending) {
    toast.info("Subieron las acciones pendientes", {
      description: `Ahora hay ${nextSummary.totalPending} pendientes visibles en tu tablero.`,
    });
  }
};

export function FollowUpNotificationsBridge() {
  const queryClient = useQueryClient();
  const { empresaId, isResolved } = useFollowUpNotifications();
  const lastSummaryRef = useRef<FollowUpNotificationsSummary | null>(null);

  useEffect(() => {
    if (!isResolved) {
      return;
    }

    const streamUrl = buildFollowUpNotificationsStreamPath(empresaId);
    const source = new EventSource(streamUrl);
    const queryKey = buildFollowUpNotificationsQueryKey(empresaId);

    const handleSummary = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as FollowUpNotificationsSummary;
        notifyNewPendingItems(payload, lastSummaryRef.current);
        lastSummaryRef.current = payload;
        queryClient.setQueryData(queryKey, payload);
      } catch (error) {
        console.error("Error parsing follow-up notifications stream payload", error);
      }
    };

    const handleError = () => {
      queryClient.invalidateQueries({ queryKey });
    };

    source.addEventListener("summary", handleSummary as EventListener);
    source.addEventListener("error", handleError as EventListener);

    return () => {
      lastSummaryRef.current = null;
      source.removeEventListener("summary", handleSummary as EventListener);
      source.removeEventListener("error", handleError as EventListener);
      source.close();
    };
  }, [empresaId, isResolved, queryClient]);

  return null;
}
