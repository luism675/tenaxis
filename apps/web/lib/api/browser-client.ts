"use client";

import { buildApiUrl, getClientApiUrl } from "@/lib/api/url";

export const getBrowserCookie = (name: string) => {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return undefined;
};

export const setBrowserCookie = (
  name: string,
  value: string,
  options?: {
    expiresAt?: Date;
    path?: string;
    sameSite?: "Lax" | "Strict" | "None";
  },
) => {
  if (typeof document === "undefined") return;

  const expires = options?.expiresAt
    ? `; expires=${options.expiresAt.toUTCString()}`
    : "";
  const path = options?.path || "/";
  const sameSite = options?.sameSite || "Lax";

  document.cookie = `${name}=${value}; path=${path}${expires}; SameSite=${sameSite}`;
};

export const deleteBrowserCookie = (name: string, path = "/") => {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax`;
};

export const getBrowserAuthHeaders = (options?: {
  enterpriseId?: string;
  includeContentType?: boolean;
}) => {
  const token = getBrowserCookie("access_token");
  const cookieEnterpriseId = getBrowserCookie("x-enterprise-id");
  const testRole = getBrowserCookie("x-test-role");
  const effectiveEnterpriseId = options?.enterpriseId || cookieEnterpriseId;

  const headers: Record<string, string> = {};

  if (options?.includeContentType) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (effectiveEnterpriseId) {
    headers["x-enterprise-id"] = effectiveEnterpriseId;
  }

  if (testRole) {
    headers["x-test-role"] = testRole;
  }

  return headers;
};

export const getBrowserApiUrl = getClientApiUrl;

export const buildBrowserApiUrl = (path: string) => buildApiUrl(path);
