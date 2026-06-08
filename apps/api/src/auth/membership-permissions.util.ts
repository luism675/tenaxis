import { MembershipPermission, Role } from '../generated/client/client';

const IMPLICIT_MEMBERSHIP_PERMISSIONS: Partial<
  Record<Role, MembershipPermission[]>
> = {
  [Role.SU_ADMIN]: [
    MembershipPermission.TEAM_CREATE,
    MembershipPermission.TEAM_EDIT,
  ],
  [Role.ADMIN]: [
    MembershipPermission.TEAM_CREATE,
    MembershipPermission.TEAM_EDIT,
  ],
  [Role.COORDINADOR]: [
    MembershipPermission.TEAM_CREATE,
    MembershipPermission.TEAM_EDIT,
  ],
};

export interface MembershipPermissionState {
  granularPermissions: MembershipPermission[];
  permissions: MembershipPermission[];
}

function dedupePermissions(
  permissions?: MembershipPermission[] | null,
): MembershipPermission[] {
  return Array.from(new Set((permissions || []).filter(Boolean)));
}

export function canAssignGranularPermissions(role: Role): boolean {
  return role === Role.COORDINADOR;
}

export function resolveStoredGranularPermissions(
  role: Role,
  granularPermissions?: MembershipPermission[] | null,
): MembershipPermission[] {
  const normalizedPermissions = dedupePermissions(granularPermissions);

  if (!canAssignGranularPermissions(role)) {
    return [];
  }

  return normalizedPermissions;
}

export function findUnsupportedGranularPermissions(
  role: Role,
  granularPermissions?: MembershipPermission[] | null,
): MembershipPermission[] {
  const normalizedPermissions = dedupePermissions(granularPermissions);

  if (canAssignGranularPermissions(role)) {
    return [];
  }

  return normalizedPermissions;
}

export function getImplicitMembershipPermissions(
  role: Role,
): MembershipPermission[] {
  return dedupePermissions(IMPLICIT_MEMBERSHIP_PERMISSIONS[role]);
}

export function buildMembershipPermissionState(
  role: Role,
  granularPermissions?: MembershipPermission[] | null,
): MembershipPermissionState {
  const normalizedGranularPermissions = resolveStoredGranularPermissions(
    role,
    granularPermissions,
  );

  return {
    granularPermissions: normalizedGranularPermissions,
    permissions: dedupePermissions([
      ...getImplicitMembershipPermissions(role),
      ...normalizedGranularPermissions,
    ]),
  };
}

export function hasMembershipPermission(
  role: Role,
  granularPermissions: MembershipPermission[] | null | undefined,
  permission: MembershipPermission,
): boolean {
  return buildMembershipPermissionState(
    role,
    granularPermissions,
  ).permissions.includes(permission);
}
