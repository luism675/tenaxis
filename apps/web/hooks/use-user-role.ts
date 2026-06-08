"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserRole, hasPermission, PermissionKey } from "@/lib/rbac";
import { getScopedRole } from "@/lib/access-scope";
import { getBrowserEffectiveScopeAwareUser } from "@/lib/browser-access-scope";

export type UserData = {
  tenantId: string | null;
  role: UserRole | null;
  permissions: string[];
  id: string | null;
  nombre: string | null;
  email: string | null;
  isGlobalSuAdmin: boolean;
};

export function useUserRole() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setTimeout(() => {
        setIsLoading(false);
      }, 0);
      return;
    }

    const effectiveUser = getBrowserEffectiveScopeAwareUser();

    setTimeout(() => {
      if (!effectiveUser) {
        setUserData(null);
        setIsLoading(false);
        return;
      }

      setUserData({
        tenantId: effectiveUser.tenantId || null,
        role: getScopedRole(effectiveUser.role) as UserRole | null,
        permissions: effectiveUser.permissions || [],
        id: effectiveUser.id || null,
        nombre: effectiveUser.nombre || null,
        email: effectiveUser.email || null,
        isGlobalSuAdmin: !!effectiveUser.isGlobalSuAdmin,
      });
      setIsLoading(false);
    }, 0);
  }, []);

  const checkPermission = useCallback((action: PermissionKey) => {
    if (userData?.permissions?.includes(action)) {
      return true;
    }

    return hasPermission(userData?.role, action);
  }, [userData?.permissions, userData?.role]);

  return useMemo(
    () => ({
      ...userData,
      tenantId: userData?.tenantId,
      isLoading,
      checkPermission,
      hasRole: !!userData?.role,
    }),
    [checkPermission, isLoading, userData],
  );
}
