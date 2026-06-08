"use client";

import { apiFetch } from "@/lib/api/base-client";

export type DashboardPresetModule = "SERVICIOS" | "CLIENTES";
export type DashboardPresetColorToken =
  | "slate"
  | "red"
  | "orange"
  | "amber"
  | "emerald"
  | "teal"
  | "sky"
  | "blue"
  | "indigo"
  | "pink";

export interface DashboardPreset {
  id: string;
  module: DashboardPresetModule;
  name: string;
  colorToken: DashboardPresetColorToken;
  isShared: boolean;
  filters: Record<string, unknown>;
  createdByMembershipId: string;
  createdAt: string;
  updatedAt: string;
}

export async function listDashboardPresets(module: DashboardPresetModule) {
  const params = new URLSearchParams({ module });
  return apiFetch<DashboardPreset[]>(
    `/dashboard-presets?${params.toString()}`,
  );
}

export async function createDashboardPreset(input: {
  module: DashboardPresetModule;
  name: string;
  colorToken: DashboardPresetColorToken;
  isShared: boolean;
  filters: Record<string, unknown>;
}) {
  return apiFetch<DashboardPreset>("/dashboard-presets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateDashboardPreset(
  id: string,
  input: Partial<{
    name: string;
    colorToken: DashboardPresetColorToken;
    isShared: boolean;
    filters: Record<string, unknown>;
  }>,
) {
  return apiFetch<DashboardPreset>(`/dashboard-presets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteDashboardPreset(id: string) {
  return apiFetch<{ success: boolean }>(`/dashboard-presets/${id}`, {
    method: "DELETE",
  });
}

export const PRESET_COLOR_STYLES: Record<DashboardPresetColorToken, string> = {
  slate: "border-slate-300 bg-slate-50 text-slate-700",
  red: "border-red-300 bg-red-50 text-red-700",
  orange: "border-orange-300 bg-orange-50 text-orange-700",
  amber: "border-amber-300 bg-amber-50 text-amber-700",
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-700",
  teal: "border-teal-300 bg-teal-50 text-teal-700",
  sky: "border-sky-300 bg-sky-50 text-sky-700",
  blue: "border-blue-300 bg-blue-50 text-blue-700",
  indigo: "border-indigo-300 bg-indigo-50 text-indigo-700",
  pink: "border-pink-300 bg-pink-50 text-pink-700",
};
