import { Role } from '../../generated/client/client';

export interface OperatorProductScope {
  tenantId: string;
  membershipId: string;
  role: Role;
  empresaIds: string[];
  zonaIds?: string[];
}
