"use client";

import { getBrowserCookie } from "@/lib/api/browser-client";
import {
  buildEffectiveScopeAwareUser,
  parseStoredScopeAwareUser,
  resolveAccessScopeFromOverride,
  resolveScopedEmpresaId,
  type AccessScope,
  type ScopeAwareUser,
} from "@/lib/access-scope";

const USER_STORAGE_KEY = "user";
const ENTERPRISE_STORAGE_KEY = "current-enterprise-id";

export function getStoredBrowserScopeAwareUser(): ScopeAwareUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  return parseStoredScopeAwareUser(localStorage.getItem(USER_STORAGE_KEY));
}

export function getBrowserEffectiveScopeAwareUser(): ScopeAwareUser | null {
  const storedUser = getStoredBrowserScopeAwareUser();
  return buildEffectiveScopeAwareUser(storedUser, getBrowserCookie("x-test-role"));
}

export function getBrowserAccessScope(): AccessScope {
  return resolveAccessScopeFromOverride(
    getStoredBrowserScopeAwareUser(),
    getBrowserCookie("x-test-role"),
  );
}

export function getBrowserScopedEnterpriseId(
  scope?: AccessScope | null,
): string | undefined {
  const resolvedScope = scope ?? getBrowserAccessScope();

  if (!resolvedScope.isEmpresaLocked) {
    return undefined;
  }

  const storedEnterpriseId =
    typeof window === "undefined"
      ? undefined
      : localStorage.getItem(ENTERPRISE_STORAGE_KEY) || undefined;

  return resolveScopedEmpresaId(resolvedScope, storedEnterpriseId);
}
