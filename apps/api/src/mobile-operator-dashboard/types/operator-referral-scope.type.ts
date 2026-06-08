import { Role } from '../../generated/client/client';

export interface OperatorReferralScope {
  tenantId: string;
  membershipId: string;
  role: Role;
  empresaIds: string[];
  zonaIds?: string[];
}
