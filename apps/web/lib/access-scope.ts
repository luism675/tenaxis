export type ScopedRole =
  | "SU_ADMIN"
  | "ADMIN"
  | "COORDINADOR"
  | "ASESOR"
  | "OPERADOR";

export interface ScopeAwareUser {
  role?: string | null;
  permissions?: string[] | null;
  isGlobalSuAdmin?: boolean | null;
  tenantId?: string | null;
  empresaId?: string | null;
  empresaIds?: string[] | null;
  id?: string | null;
  nombre?: string | null;
  email?: string | null;
}

export type AccessScopeMode = "global" | "tenant" | "empresa";

export interface AccessScope {
  role: ScopedRole | null;
  mode: AccessScopeMode;
  canSeeAllTenants: boolean;
  canSeeTenantWide: boolean;
  isEmpresaLocked: boolean;
  tenantId: string | null;
  empresaId: string | null;
  empresaIds: string[];
}

type EmpresaScopedAccess = Pick<
  AccessScope,
  "isEmpresaLocked" | "empresaId" | "empresaIds"
>;

const EMPRESA_SCOPED_ROLES = new Set<ScopedRole>([
  "COORDINADOR",
  "ASESOR",
  "OPERADOR",
]);
const EMPRESA_SELECTION_LOCKED_ROLES = new Set<ScopedRole>(["OPERADOR"]);

export function getScopedRole(role?: string | null): ScopedRole | null {
  if (
    role === "SU_ADMIN" ||
    role === "ADMIN" ||
    role === "COORDINADOR" ||
    role === "ASESOR" ||
    role === "OPERADOR"
  ) {
    return role;
  }

  return null;
}

export function canAccessTenantsView(user?: ScopeAwareUser | null): boolean {
  return getScopedRole(user?.role) === "SU_ADMIN" && !!user?.isGlobalSuAdmin;
}

export function parseStoredScopeAwareUser(
  raw: string | null | undefined,
): ScopeAwareUser | null {
  if (!raw || raw === "undefined") {
    return null;
  }

  try {
    return JSON.parse(raw) as ScopeAwareUser;
  } catch {
    return null;
  }
}

export function buildEffectiveScopeAwareUser(
  user?: ScopeAwareUser | null,
  overrideRole?: string | null,
): ScopeAwareUser | null {
  if (!user) {
    return null;
  }

  const scopedOverrideRole = getScopedRole(overrideRole);

  if (!scopedOverrideRole) {
    return user;
  }

  return {
    ...user,
    role: scopedOverrideRole,
    isGlobalSuAdmin: scopedOverrideRole === "SU_ADMIN",
  };
}

export function isEmpresaSelectionLocked(user?: ScopeAwareUser | null): boolean {
  const role = getScopedRole(user?.role);
  return role ? EMPRESA_SELECTION_LOCKED_ROLES.has(role) : false;
}

export function requiresEmpresaScope(user?: ScopeAwareUser | null): boolean {
  const role = getScopedRole(user?.role);
  return role ? EMPRESA_SCOPED_ROLES.has(role) : false;
}

export function resolveAvailableEmpresaIds(user?: ScopeAwareUser | null): string[] {
  const ids = user?.empresaIds?.filter(Boolean) ?? [];
  if (ids.length > 0) {
    return ids;
  }

  return user?.empresaId ? [user.empresaId] : [];
}

export function resolveAccessScope(user?: ScopeAwareUser | null): AccessScope {
  const role = getScopedRole(user?.role);
  const isGlobalSuAdmin = role === "SU_ADMIN" && !!user?.isGlobalSuAdmin;
  const canSeeTenantWide = !!role && (role === "SU_ADMIN" || role === "ADMIN");
  const empresaIds = resolveAvailableEmpresaIds(user);
  const isEmpresaLocked = requiresEmpresaScope(user);

  return {
    role,
    mode: isGlobalSuAdmin ? "global" : isEmpresaLocked ? "empresa" : "tenant",
    canSeeAllTenants: isGlobalSuAdmin,
    canSeeTenantWide,
    isEmpresaLocked,
    tenantId: user?.tenantId ?? null,
    empresaId: user?.empresaId ?? null,
    empresaIds,
  };
}

export function resolveAccessScopeFromOverride(
  user?: ScopeAwareUser | null,
  overrideRole?: string | null,
): AccessScope {
  return resolveAccessScope(buildEffectiveScopeAwareUser(user, overrideRole));
}

export function resolveScopedEmpresaId(
  scope?: EmpresaScopedAccess | null,
  preferredEmpresaId?: string | null,
): string | undefined {
  if (!scope?.isEmpresaLocked) {
    return undefined;
  }

  if (
    preferredEmpresaId &&
    (scope.empresaIds.length === 0 || scope.empresaIds.includes(preferredEmpresaId))
  ) {
    return preferredEmpresaId;
  }

  return scope.empresaId ?? scope.empresaIds[0] ?? undefined;
}

export function resolveWritableEmpresaId(
  scope?: EmpresaScopedAccess | null,
  preferredEmpresaId?: string | null,
): string | undefined {
  if (scope?.isEmpresaLocked) {
    return resolveScopedEmpresaId(scope, preferredEmpresaId);
  }

  if (preferredEmpresaId) {
    return preferredEmpresaId;
  }

  return scope?.empresaId ?? scope?.empresaIds[0] ?? undefined;
}
