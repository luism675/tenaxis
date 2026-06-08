import React from "react";
import { DashboardLayout } from "@/components/dashboard";

function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted/50 ${className}`} />;
}

export default function LoadingClientesPage() {
  return (
    <DashboardLayout overflowHidden>
      <div className="flex h-full flex-col px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Block className="h-8 w-64" />
                <Block className="h-4 w-96 max-w-full" />
              </div>
              <div className="flex gap-3">
                <Block className="h-11 w-36" />
                <Block className="h-11 w-40" />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-background/70 p-4">
                  <Block className="h-3 w-24" />
                  <Block className="mt-3 h-8 w-16" />
                  <Block className="mt-2 h-3 w-32" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-center lg:justify-between">
              <Block className="h-12 w-full max-w-xl" />
              <div className="flex flex-wrap gap-3">
                <Block className="h-11 w-28" />
                <Block className="h-11 w-28" />
                <Block className="h-11 w-28" />
                <Block className="h-11 w-28" />
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-border">
              <div className="grid grid-cols-12 gap-4 border-b border-border bg-muted/40 px-5 py-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Block key={i} className="col-span-2 h-3 w-20" />
                ))}
              </div>

              <div className="divide-y divide-border">
                {Array.from({ length: 8 }).map((_, row) => (
                  <div key={row} className="grid grid-cols-12 items-center gap-4 px-5 py-4">
                    <div className="col-span-3 space-y-2">
                      <Block className="h-4 w-40" />
                      <Block className="h-3 w-24" />
                    </div>
                    <div className="col-span-2">
                      <Block className="h-6 w-24 rounded-full" />
                    </div>
                    <div className="col-span-2">
                      <Block className="h-6 w-20 rounded-full" />
                    </div>
                    <div className="col-span-2">
                      <Block className="h-4 w-28" />
                    </div>
                    <div className="col-span-2">
                      <Block className="h-4 w-24" />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <Block className="h-9 w-9 rounded-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
