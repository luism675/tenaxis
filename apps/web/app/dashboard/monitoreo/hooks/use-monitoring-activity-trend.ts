"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";

import { monitoringClient } from "@/lib/api/monitoreo-client";
import { toBogotaYmd, ymdToPickerDate } from "@/utils/date-utils";

export type ActivityTrendMode = "dias" | "semanas" | "meses";

export interface ActivityTrendPoint {
  from: string;
  to: string;
  label: string;
  rangeLabel: string;
  totalEvents: number;
  activeSessions: number;
  totalInactivity: number;
}

interface TrendBucket {
  from: string;
  to: string;
  label: string;
  rangeLabel: string;
}

function buildTrendBuckets(anchorDate: Date, mode: ActivityTrendMode): TrendBucket[] {
  if (mode === "dias") {
    return Array.from({ length: 7 }, (_, index) => {
      const day = subDays(anchorDate, 6 - index);
      const ymd = toBogotaYmd(day);

      return {
        from: ymd,
        to: ymd,
        label: format(day, "EEE d", { locale: es }),
        rangeLabel: format(day, "d 'de' MMMM", { locale: es }),
      };
    });
  }

  if (mode === "semanas") {
    return Array.from({ length: 6 }, (_, index) => {
      const weekDate = subWeeks(anchorDate, 5 - index);
      const start = startOfWeek(weekDate, { weekStartsOn: 1 });
      const rawEnd = endOfWeek(weekDate, { weekStartsOn: 1 });
      const end = rawEnd > anchorDate ? anchorDate : rawEnd;

      return {
        from: toBogotaYmd(start),
        to: toBogotaYmd(end),
        label: format(start, "d MMM", { locale: es }),
        rangeLabel: `${format(start, "d MMM", { locale: es })} - ${format(end, "d MMM", { locale: es })}`,
      };
    });
  }

  return Array.from({ length: 6 }, (_, index) => {
    const monthDate = subMonths(anchorDate, 5 - index);
    const start = startOfMonth(monthDate);
    const rawEnd = endOfMonth(monthDate);
    const end = rawEnd > anchorDate ? anchorDate : rawEnd;

    return {
      from: toBogotaYmd(start),
      to: toBogotaYmd(end),
      label: format(monthDate, "MMM", { locale: es }),
      rangeLabel: format(monthDate, "MMMM yyyy", { locale: es }),
    };
  });
}

export function useMonitoringActivityTrend(
  anchorDate: Date | undefined,
  mode: ActivityTrendMode,
) {
  const anchorYmd = toBogotaYmd(anchorDate ?? new Date());
  const resolvedAnchorDate = useMemo(
    () => ymdToPickerDate(anchorYmd) ?? new Date(anchorYmd),
    [anchorYmd],
  );

  const buckets = useMemo(
    () => buildTrendBuckets(resolvedAnchorDate, mode),
    [resolvedAnchorDate, mode],
  );

  const trendQuery = useQuery({
    queryKey: [
      "monitoring",
      "activity-trend",
      mode,
      anchorYmd,
    ],
    queryFn: async () => {
        const points = await Promise.all(
          buckets.map(async (bucket) => {
          const stats = await monitoringClient.getStats({
            startDate: bucket.from,
            endDate: bucket.to,
          }) as {
            totalEvents?: number;
            activeSessions?: number;
            totalInactivity?: number;
          };

          return {
            ...bucket,
            totalEvents: stats.totalEvents || 0,
            activeSessions: stats.activeSessions || 0,
            totalInactivity: stats.totalInactivity || 0,
          } satisfies ActivityTrendPoint;
        }),
      );

      return points;
    },
    staleTime: 60000,
    retry: 1,
  });

  return {
    points: trendQuery.data || ([] as ActivityTrendPoint[]),
    isLoading: trendQuery.isLoading,
    isRefreshing: trendQuery.isFetching,
    refetch: trendQuery.refetch,
  };
}
