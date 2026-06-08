import { MembershipPermission, Role } from '../generated/client/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  permissions?: MembershipPermission[];
  granularPermissions?: MembershipPermission[];
  tenantId?: string;
  empresaId?: string;
  empresaIds?: string[];
  zonaIds?: string[];
  municipalityIds?: string[];
  departmentIds?: string[];
  membershipId?: string;
  sesionId?: string;
  authSessionId?: string;
  isGlobalSuAdmin?: boolean;
}
