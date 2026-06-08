import { Role } from '../../generated/client/client';

export function resolveDevRoleOverride(
  testRole?: string | string[],
): Role | undefined {
  if (process.env.NODE_ENV === 'production' || !testRole) {
    return undefined;
  }

  const normalizedRole = Array.isArray(testRole) ? testRole[0] : testRole;

  if (normalizedRole && Object.values(Role).includes(normalizedRole as Role)) {
    return normalizedRole as Role;
  }

  return undefined;
}

export function applyDevRoleOverride<
  T extends { role: Role; isGlobalSuAdmin?: boolean },
>(target: T, testRole?: string | string[]): Role | undefined {
  const roleOverride = resolveDevRoleOverride(testRole);

  if (roleOverride) {
    target.role = roleOverride;
    target.isGlobalSuAdmin = roleOverride === Role.SU_ADMIN;
  }

  return roleOverride;
}

export function resolveEffectiveRoleState(
  base: { role: Role; isGlobalSuAdmin?: boolean },
  testRole?: string | string[],
): { role: Role; isGlobalSuAdmin: boolean } {
  const roleOverride = resolveDevRoleOverride(testRole);

  return {
    role: roleOverride || base.role,
    isGlobalSuAdmin: roleOverride
      ? roleOverride === Role.SU_ADMIN
      : !!base.isGlobalSuAdmin,
  };
}
