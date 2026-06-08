"use client";

import React, { useEffect, useState } from "react";
import { DashboardLayout, JoinOrganization } from "@/components/dashboard";
import { type AccessScope } from "@/lib/access-scope";
import { getBrowserAccessScope, getBrowserScopedEnterpriseId } from "@/lib/browser-access-scope";
import { DashboardProviders } from "./components/DashboardProviders";
import { DashboardContent } from "./components/DashboardContent";

const TENANT_COOKIE_KEY = "tenant-id";
const ENTERPRISE_COOKIE_KEY = "x-enterprise-id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;
const COOKIE_PATH = "/";
const COOKIE_SAME_SITE = "Lax";

function setCookie(cookieName: string, value: string) {
  const secureFlag = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${cookieName}=${encodeURIComponent(value)}; path=${COOKIE_PATH}; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=${COOKIE_SAME_SITE}${secureFlag}`;
}

export default function DashboardPage() {
  const [hasTenant, setHasTenant] = useState<boolean | null>(null);
  const [enterpriseId, setEnterpriseId] = useState<string | undefined>();

  useEffect(() => {
    const scope: AccessScope = getBrowserAccessScope();
    const tenantExists = !!scope.tenantId;

    if (scope.tenantId) {
      const cookieEntries = document.cookie.split("; ");
      const hasTenantCookie = cookieEntries.some((row) => row.startsWith(`${TENANT_COOKIE_KEY}=`));
      if (!hasTenantCookie) {
        setCookie(TENANT_COOKIE_KEY, scope.tenantId);
      }
    }

    const currentEnterpriseId = getBrowserScopedEnterpriseId(scope);

    if (currentEnterpriseId) {
      const cookieEntries = document.cookie.split("; ");
      const currentEnterpriseCookie = cookieEntries.find((row) =>
        row.startsWith(`${ENTERPRISE_COOKIE_KEY}=`),
      );
      const decodedCookieValue = currentEnterpriseCookie
        ? decodeURIComponent(currentEnterpriseCookie.split("=")[1] || "")
        : undefined;

      if (decodedCookieValue !== currentEnterpriseId) {
        setCookie(ENTERPRISE_COOKIE_KEY, currentEnterpriseId);
      }
    }

    // Defer state updates to the next tick to avoid cascading renders warning
    const timer = setTimeout(() => {
      setHasTenant(tenantExists);
      setEnterpriseId(currentEnterpriseId);
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  if (hasTenant === null) return null;

  if (!hasTenant) {
    return (
      <DashboardLayout>
        <JoinOrganization />
      </DashboardLayout>
    );
  }

  return (
    <DashboardProviders>
      <DashboardLayout>
        <DashboardContent enterpriseId={enterpriseId} />
      </DashboardLayout>
    </DashboardProviders>
  );
}
