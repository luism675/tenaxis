import React from "react";
import { DashboardLayout } from "@/components/dashboard";
import { getClientesDashboardAction } from "../actions";
import { ClienteList, type Cliente, type Sugerencia } from "./cliente-list";

export const dynamic = "force-dynamic";

type PageSearchParams = Record<string, string | string[] | undefined>;

const CLIENTES_DASHBOARD_QUERY_PARAMS = new Set([
  "segment",
  "search",
  "page",
  "sort",
  "dir",
  "sinVisita",
  "pendingPayments",
  "sinServicios",
  "empresas",
  "dept",
  "muni",
  "barrio",
  "class",
  "seg",
  "risk",
  "tipoCliente",
  "from",
  "to",
]);

function getFirstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getClientesDashboardQuery(searchParams: PageSearchParams) {
  return Object.fromEntries(
    Object.entries(searchParams).flatMap(([key, value]) => {
      if (!CLIENTES_DASHBOARD_QUERY_PARAMS.has(key)) return [];

      const firstValue = getFirstParam(value);
      return firstValue ? [[key, firstValue]] : [];
    }),
  );
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
}) {
  const resolvedSearchParams = (await searchParams) || {};
  const dashboardQuery = getClientesDashboardQuery(resolvedSearchParams);

  const dashboardData = await getClientesDashboardAction<Cliente>(dashboardQuery);

  return (
    <DashboardLayout overflowHidden>
      <ClienteList
        initialClientes={dashboardData.clientes}
        initialPagination={dashboardData.pagination}
        initialSugerencias={[] as Sugerencia[]}
        sugerenciasStats={null}
        initialDepartments={[]}
        initialMunicipalities={[]}
      />
    </DashboardLayout>
  );
}
