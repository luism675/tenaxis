import { apiFetch } from "./base-client";

export interface PublicReferralCodeResponse {
  valid: boolean;
  code: string;
  empresaId: string | null;
  referrer: {
    membershipId: string;
    nombre: string | null;
    apellido: string | null;
  } | null;
}

export interface CreatePublicReferralPayload {
  code: string;
  nombre: string;
  apellido: string;
  telefono: string;
}

export interface CreatePublicReferralResponse {
  success: boolean;
  message: string;
}

export const referralsClient = {
  async resolveCode(code: string) {
    return apiFetch<PublicReferralCodeResponse>(
      `/public/referrals/${encodeURIComponent(code)}`,
      {
        includeEnterpriseId: false,
      },
    );
  },

  async createLead(data: CreatePublicReferralPayload) {
    return apiFetch<CreatePublicReferralResponse>("/public/referrals", {
      method: "POST",
      body: JSON.stringify(data),
      includeEnterpriseId: false,
    });
  },
};
