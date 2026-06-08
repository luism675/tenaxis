import { apiFetch } from "./base-client";

export interface Tenant {
  id: string;
  nombre: string;
  slug: string;
  nit?: string;
  correo?: string;
  isActive: boolean;
}

export interface TenantMembership {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
  departmentIds?: string[];
  municipalityIds?: string[];
  user: {
    nombre: string;
    apellido: string;
    email: string;
  };
}

export interface TenantMembershipUpdatePayload {
  nombre?: string;
  apellido?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  email?: string;
  telefono?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  valorHora?: number;
  placa?: string;
  moto?: boolean;
  direccion?: string;
  municipioId?: string;
  departmentIds?: string[];
  municipalityIds?: string[];
  role?: string;
  empresaIds?: string[];
  activo?: boolean;
  cuentaPagoEmpresaId?: string;
}

export interface TenantMembershipInvitePayload {
  email: string;
  role: string;
  nombre?: string;
  apellido?: string;
  telefono?: string;
  password?: string;
  empresaIds?: string[];
  departmentIds?: string[];
  municipalityIds?: string[];
}

export const tenantsClient = {
  async getAll(): Promise<Tenant[]> {
    return apiFetch<Tenant[]>("/tenants");
  },

  async getById(id: string): Promise<Tenant> {
    return apiFetch<Tenant>(`/tenants/${id}`);
  },

  async getMemberships(tenantId: string): Promise<TenantMembership[]> {
    return apiFetch<TenantMembership[]>(`/tenants/${tenantId}/memberships`, { cache: "no-store" });
  },

  async updateMembership(id: string, data: TenantMembershipUpdatePayload) {
    return apiFetch(`/tenants/memberships/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async getPendingMemberships(tenantId: string): Promise<TenantMembership[]> {
    return apiFetch<TenantMembership[]>(`/tenants/${tenantId}/pending-memberships`, { cache: "no-store" });
  },

  async approveMembership(id: string) {
    return apiFetch(`/tenants/memberships/${id}/approve`, {
      method: "POST",
    });
  },

  async rejectMembership(id: string) {
    return apiFetch(`/tenants/memberships/${id}/reject`, {
      method: "POST",
    });
  },

  async createTenant(data: Record<string, unknown>) {
    return apiFetch("/tenants", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async join(slug: string) {
    return apiFetch("/tenants/join", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
  },

  async inviteMember(tenantId: string, data: TenantMembershipInvitePayload) {
    return apiFetch(`/tenants/${tenantId}/memberships`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
};
