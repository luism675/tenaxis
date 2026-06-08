import { apiFetch } from "./base-client";

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
  nombre?: string;
  apellido?: string;
  telefono?: string;
  tipoDocumento?: string;
  numeroDocumento?: string;
  banco?: string;
  tipoCuenta?: string;
  numeroCuenta?: string;
  valorHora?: number;
  isTenantAdmin?: boolean;
  isGlobalSuAdmin?: boolean;
  membershipId?: string;
  tenantId?: string;
  empresaId?: string;
  empresaIds?: string[];
  sesionId?: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token?: string;
  user: UserProfile;
}

export interface ForgotPasswordResponse {
  message: string;
  resetUrl?: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  tipoDocumento: string;
  numeroDocumento: string;
}

export const authClient = {
  async login(data: Record<string, unknown>) {
    return apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
      skip401Redirect: true,
    });
  },

  async register(data: RegisterPayload) {
    return apiFetch<UserProfile>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async forgotPassword(email: string): Promise<ForgotPasswordResponse> {
    return apiFetch<ForgotPasswordResponse>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(data: { token: string; password: string }) {
    return apiFetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
      skip401Redirect: true,
    });
  },

  async getProfile(
    options: { skip401Redirect?: boolean } = {},
  ): Promise<UserProfile> {
    return apiFetch<UserProfile>("/auth/profile", {
      includeEnterpriseId: false,
      skip401Redirect: options.skip401Redirect,
    });
  },

  async updateTestRole(role: string) {
    return apiFetch("/auth/test-role", {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  },

  async logout() {
    return apiFetch("/auth/logout", {
      method: "POST",
    });
  },
};
