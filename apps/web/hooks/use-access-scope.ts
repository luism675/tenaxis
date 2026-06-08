"use client";

import { useEffect, useState } from "react";
import {
  AccessScope,
} from "@/lib/access-scope";
import { getBrowserAccessScope } from "@/lib/browser-access-scope";

const EMPTY_SCOPE: AccessScope = {
  role: null,
  mode: "tenant",
  canSeeAllTenants: false,
  canSeeTenantWide: false,
  isEmpresaLocked: false,
  tenantId: null,
  empresaId: null,
  empresaIds: [],
};

export function useAccessScope() {
  const [scope, setScope] = useState<AccessScope>(EMPTY_SCOPE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setTimeout(() => {
        setScope(EMPTY_SCOPE);
        setIsLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      setScope(getBrowserAccessScope());
      setIsLoading(false);
    }, 0);
  }, []);

  return { scope, isLoading };
}
