"use client";

import { useState } from "react";

export type DashboardWidget = "kpis" | "overview" | "trends" | "actionable" | "recent";

export interface DashboardConfig {
  widgets: DashboardWidget[];
  hidden: DashboardWidget[];
}

const STORAGE_KEY = "tenaxis-dashboard-config-v1";

const DEFAULT_CONFIG: DashboardConfig = {
  widgets: ["kpis", "overview", "trends", "actionable", "recent"],
  hidden: [],
};

const VALID_WIDGETS: DashboardWidget[] = ["kpis", "overview", "trends", "actionable", "recent"];

function normalizeConfig(input: unknown): DashboardConfig {
  if (!input || typeof input !== "object") {
    return DEFAULT_CONFIG;
  }

  const maybeConfig = input as Partial<DashboardConfig>;
  const widgets = Array.isArray(maybeConfig.widgets)
    ? maybeConfig.widgets.filter((w): w is DashboardWidget => VALID_WIDGETS.includes(w as DashboardWidget))
    : [];
  const hidden = Array.isArray(maybeConfig.hidden)
    ? maybeConfig.hidden.filter((w): w is DashboardWidget => VALID_WIDGETS.includes(w as DashboardWidget))
    : [];

  const uniqueWidgets = Array.from(new Set(widgets));
  const uniqueHidden = Array.from(new Set(hidden)).filter((w) => !uniqueWidgets.includes(w));

  // Inject new widgets (like "overview") by default unless explicitly hidden.
  for (const widget of VALID_WIDGETS) {
    if (!uniqueWidgets.includes(widget) && !uniqueHidden.includes(widget)) {
      uniqueWidgets.push(widget);
    }
  }

  return {
    widgets: uniqueWidgets,
    hidden: uniqueHidden,
  };
}

export function useDashboardConfig() {
  const [config, setConfig] = useState<DashboardConfig>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return normalizeConfig(JSON.parse(saved));
        } catch (e) {
          console.error("Error parsing dashboard config", e);
        }
      }
    }
    return DEFAULT_CONFIG;
  });

  const isLoaded = true; // Since we initialize from localStorage, it's effectively loaded on mount in client

  const updateConfig = (newConfig: DashboardConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig));
  };

  const moveWidget = (id: DashboardWidget, direction: "up" | "down") => {
    const currentIndex = config.widgets.indexOf(id);
    if (currentIndex === -1) return;

    const newWidgets = [...config.widgets];
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex >= 0 && targetIndex < newWidgets.length) {
      [newWidgets[currentIndex], newWidgets[targetIndex]] = [
        newWidgets[targetIndex]!,
        newWidgets[currentIndex]!,
      ];
      updateConfig({ ...config, widgets: newWidgets });
    }
  };

  const toggleVisibility = (id: DashboardWidget) => {
    if (config.widgets.includes(id)) {
      updateConfig({
        widgets: config.widgets.filter((w) => w !== id),
        hidden: [...config.hidden, id],
      });
    } else {
      updateConfig({
        widgets: [...config.widgets, id],
        hidden: config.hidden.filter((w) => w !== id),
      });
    }
  };

  return { config, updateConfig, moveWidget, toggleVisibility, isLoaded };
}
