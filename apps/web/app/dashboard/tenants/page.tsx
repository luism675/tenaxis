import React from "react";
import { DashboardLayout } from "@/components/dashboard";
import { isTenantAdminAction, getTenantsAction, getPlansAction } from "../actions";
import { redirect } from "next/navigation";
import { TenantList, type Tenant, type Plan } from "./tenant-list";

export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const isAdmin = await isTenantAdminAction();

  if (!isAdmin) {
    redirect("/dashboard");
  }

  const [tenants, plans] = await Promise.all([
    getTenantsAction(),
    getPlansAction(),
  ]);

  return (
    <DashboardLayout>
      <div className="space-y-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50">
              Gestión de Tenants
            </h1>
            <p className="text-zinc-500 font-medium">
              Administra las organizaciones y sus configuraciones.
            </p>
          </div>
        </div>

        <TenantList initialTenants={tenants as Tenant[]} availablePlans={plans as unknown as Plan[]} />
      </div>
    </DashboardLayout>
  );
}
