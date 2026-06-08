import { Role } from '../generated/client/client';

export interface MonitoringScope {
  tenantId?: string;
  role: Role;
  empresaIds?: string[];
  zonaIds?: string[];
  membershipId?: string;
  isGlobalSuAdmin?: boolean;
}
