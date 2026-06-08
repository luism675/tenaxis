import React from "react";
import { DashboardLayout } from "@/components/dashboard";
import { 
  getProductosStockAction, 
  getProductosSolicitudesAction, 
  getProveedoresAction, 
  getTenantMembershipsAction 
} from "../actions";
import { InsumosClient } from "./insumos-client";

export const dynamic = "force-dynamic";

export default async function InsumosPage() {
  const [stock, solicitudes, proveedores, memberships] = await Promise.all([
    getProductosStockAction(),
    getProductosSolicitudesAction(),
    getProveedoresAction(),
    getTenantMembershipsAction(),
  ]);

  return (
    <DashboardLayout overflowHidden>
      <InsumosClient 
        initialStock={Array.isArray(stock) ? stock : []} 
        initialSolicitudes={Array.isArray(solicitudes) ? solicitudes : []} 
        proveedores={Array.isArray(proveedores) ? proveedores : []}
        memberships={Array.isArray(memberships) ? memberships : []}
      />
    </DashboardLayout>
  );
}
