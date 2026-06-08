"use client";

import React from "react";
import { cn } from "@/components/ui/utils";

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div 
      className={cn("animate-pulse rounded-md bg-muted/50", className)} 
      style={style}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-start justify-between">
        <Skeleton className="h-12 w-12 rounded-2xl" />
        <Skeleton className="h-[60px] w-[60px] rounded-full" />
      </div>
      <div className="mt-6 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
        <Skeleton className="h-5 w-12 rounded-lg" />
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-1.5 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className="lg:col-span-2 rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between mb-8">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
      <div className="flex h-64 items-end justify-between gap-4 px-2">
        {[60, 40, 75, 50, 90, 35, 65].map((height, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton 
              className="w-full rounded-2xl" 
              style={{ height: `${height}%` }} 
            />
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="lg:col-span-3 rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActionableCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md">
          <div className="flex items-center justify-between">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="h-5 w-5 rounded" />
          </div>
          <div className="mt-6 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <Skeleton className="h-5 w-28 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function OverviewMetricsSkeleton() {
  const section = (
    <div className="rounded-3xl border border-border bg-card/40 p-6 shadow-sm backdrop-blur-md">
      <Skeleton className="h-7 w-56" />
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-20" />
            <Skeleton className="mt-2 h-3 w-40" />
          </div>
        ))}
      </div>
    </div>
  );

  return <div className="space-y-6">{section}{section}</div>;
}
