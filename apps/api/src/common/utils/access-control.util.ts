import { UnauthorizedException } from '@nestjs/common';
import { Role } from '../../generated/client/client';
import { JwtPayload } from '../../auth/jwt-payload.interface';

export interface PrismaAccessFilter {
  tenantId?: string;
  empresaId?: string | { in: string[] };
  zonaIds?: string[];
  municipalityIds?: string[];
  departmentIds?: string[];
}

export type AccessScopeLevel = 'global' | 'tenant' | 'empresa';

const BLOCKED_EMPRESA_ID = '00000000-0000-0000-0000-000000000000';

const resolveUserEmpresaIds = (user: JwtPayload): string[] =>
  Array.from(
    new Set([...(user.empresaIds || []), user.empresaId].filter(Boolean)),
  ) as string[];

export interface AccessScopeMode {
  isGlobalSuAdmin: boolean;
  hasTenantWideAccess: boolean;
  tenantId?: string;
  municipalityIds: string[];
  departmentIds: string[];
}

export interface ResolvedAccessScope {
  level: AccessScopeLevel;
  role: Role;
  tenantId?: string;
  empresaId?: string;
  empresaIds: string[];
  zonaIds: string[];
  municipalityIds: string[];
  departmentIds: string[];
  isGlobalSuAdmin: boolean;
  hasTenantWideAccess: boolean;
}

export function resolveAccessScopeMode(user: JwtPayload): AccessScopeMode {
  const isGlobalSuAdmin = !!user.isGlobalSuAdmin;
  const hasEmpresaScope = resolveUserEmpresaIds(user).length > 0;
  const hasZonaScope = (user.zonaIds || []).length > 0;
  const hasMunicipalityScope = (user.municipalityIds || []).length > 0;
  const hasDepartmentScope = (user.departmentIds || []).length > 0;
  const hasTenantWideAccess =
    isGlobalSuAdmin ||
    user.role === Role.SU_ADMIN ||
    user.role === Role.ADMIN ||
    (user.role === Role.COORDINADOR &&
      !hasEmpresaScope &&
      !hasZonaScope &&
      !hasMunicipalityScope &&
      !hasDepartmentScope);

  return {
    isGlobalSuAdmin,
    hasTenantWideAccess,
    ...(user.tenantId ? { tenantId: user.tenantId } : {}),
    municipalityIds: user.municipalityIds || [],
    departmentIds: user.departmentIds || [],
  };
}

export function assertTenantAccess(
  user: JwtPayload,
  requestedTenantId: string,
  message = 'No tienes permisos para acceder a este conglomerado',
): void {
  const scope = resolveAccessScopeMode(user);

  if (scope.isGlobalSuAdmin) {
    return;
  }

  if (!scope.tenantId || scope.tenantId !== requestedTenantId) {
    throw new UnauthorizedException(message);
  }
}

export function hasTenantWideAccess(user: JwtPayload): boolean {
  return resolveAccessScopeMode(user).hasTenantWideAccess;
}

export function resolveAccessScope(
  user: JwtPayload,
  requestedEmpresaId?: string,
): ResolvedAccessScope {
  const scope = resolveAccessScopeMode(user);

  if (scope.isGlobalSuAdmin) {
    return {
      level: 'global',
      role: user.role,
      ...(requestedEmpresaId ? { empresaId: requestedEmpresaId } : {}),
      empresaIds: requestedEmpresaId ? [requestedEmpresaId] : [],
      zonaIds: user.zonaIds || [],
      municipalityIds: user.municipalityIds || [],
      departmentIds: user.departmentIds || [],
      isGlobalSuAdmin: true,
      hasTenantWideAccess: true,
    };
  }

  if (scope.hasTenantWideAccess) {
    return {
      level: 'tenant',
      role: user.role,
      tenantId: scope.tenantId,
      ...(requestedEmpresaId ? { empresaId: requestedEmpresaId } : {}),
      empresaIds: requestedEmpresaId ? [requestedEmpresaId] : [],
      zonaIds: user.zonaIds || [],
      municipalityIds: user.municipalityIds || [],
      departmentIds: user.departmentIds || [],
      isGlobalSuAdmin: false,
      hasTenantWideAccess: true,
    };
  }

  const empresaId = resolveScopedEmpresaId(user, requestedEmpresaId);
  const empresaIds = resolveUserEmpresaIds(user);

  return {
    level: 'empresa',
    role: user.role,
    tenantId: user.tenantId,
    ...(empresaId ? { empresaId } : {}),
    empresaIds,
    zonaIds: user.zonaIds || [],
    municipalityIds: user.municipalityIds || [],
    departmentIds: user.departmentIds || [],
    isGlobalSuAdmin: false,
    hasTenantWideAccess: false,
  };
}

export function resolveScopedEmpresaId(
  user: JwtPayload,
  requestedEmpresaId: string,
): string;
export function resolveScopedEmpresaId(
  user: JwtPayload,
  requestedEmpresaId?: string,
): string | undefined;
export function resolveScopedEmpresaId(
  user: JwtPayload,
  requestedEmpresaId?: string,
): string | undefined {
  const scope = resolveAccessScopeMode(user);

  if (scope.isGlobalSuAdmin) {
    return requestedEmpresaId;
  }

  if (scope.hasTenantWideAccess) {
    return requestedEmpresaId;
  }

  const allowedIds = resolveUserEmpresaIds(user);

  if (requestedEmpresaId) {
    if (!allowedIds.includes(requestedEmpresaId)) {
      throw new UnauthorizedException(
        'No tienes acceso a la empresa solicitada',
      );
    }

    return requestedEmpresaId;
  }

  if (user.empresaId && allowedIds.includes(user.empresaId)) {
    return user.empresaId;
  }

  return allowedIds[0];
}

/**
 * Genera el filtro de Prisma (where clause) basado en la jerarquía estricta de permisos:
 * 1. SU_ADMIN (Global): Ve todos los tenants y todas las empresas.
 * 2. ADMIN (Tenant): Ve su tenant y TODAS las empresas dentro de él.
 * 3. COORDINADOR: Ve su tenant y TODAS las empresas dentro de él.
 * 4. ASESOR / OPERADOR: Ve su tenant y solo la empresa que tenga asignada.
 */
export function getPrismaAccessFilter(
  user: JwtPayload,
  requestedEmpresaId?: string,
): PrismaAccessFilter {
  const scope = resolveAccessScopeMode(user);

  // 1. SU_ADMIN (Global)
  if (scope.isGlobalSuAdmin) {
    return {
      ...(requestedEmpresaId ? { empresaId: requestedEmpresaId } : {}),
      zonaIds: user.zonaIds,
      municipalityIds: user.municipalityIds,
      departmentIds: user.departmentIds,
    };
  }

  // 2. ADMIN / SU_ADMIN / COORDINADOR (del Tenant)
  if (scope.hasTenantWideAccess) {
    if (!scope.tenantId) {
      return {
        tenantId: BLOCKED_EMPRESA_ID, // Bloqueo total si no hay tenantId en una vista de tenant
      };
    }

    return {
      tenantId: scope.tenantId,
      ...(requestedEmpresaId ? { empresaId: requestedEmpresaId } : {}),
      zonaIds: user.zonaIds,
      municipalityIds: user.municipalityIds,
      departmentIds: user.departmentIds,
      // No filtramos empresaId por defecto -> Ve todas las del tenant
    };
  }

  // 4. ASESOR / OPERADOR (Basado en asignación específica)
  const allowedIds = resolveUserEmpresaIds(user);

  if (requestedEmpresaId) {
    // Validación de seguridad: debe estar en su lista de asignadas
    if (!allowedIds.includes(requestedEmpresaId)) {
      return {
        tenantId: user.tenantId,
        empresaId: BLOCKED_EMPRESA_ID, // Bloqueo total
      };
    }

    return {
      tenantId: user.tenantId,
      empresaId: requestedEmpresaId,
      zonaIds: user.zonaIds,
      municipalityIds: user.municipalityIds,
      departmentIds: user.departmentIds,
    };
  }

  // Para listas generales, filtrar por todas sus empresas asignadas
  return {
    tenantId: user.tenantId,
    empresaId: {
      in: allowedIds.length > 0 ? allowedIds : [BLOCKED_EMPRESA_ID],
    },
    zonaIds: user.zonaIds,
    municipalityIds: user.municipalityIds,
    departmentIds: user.departmentIds,
  };
}
