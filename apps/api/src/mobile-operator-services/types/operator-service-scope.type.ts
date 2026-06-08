import { Role } from '../../generated/client/client';

export interface OperatorServiceScope {
  tenantId: string;
  membershipId: string;
  role: Role;
  empresaIds: string[];
  zonaIds?: string[];
}
