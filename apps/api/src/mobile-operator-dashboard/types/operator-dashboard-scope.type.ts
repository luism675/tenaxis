import { Role } from '../../generated/client/client';

export interface OperatorDashboardScope {
  tenantId: string;
  membershipId: string;
  role: Role;
  empresaIds: string[];
  zonaIds?: string[];
}
