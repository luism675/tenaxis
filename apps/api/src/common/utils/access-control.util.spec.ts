import { Role } from '../../generated/client/client';
import type { JwtPayload } from '../../auth/jwt-payload.interface';
import {
  getPrismaAccessFilter,
  resolveAccessScopeMode,
  resolveScopedEmpresaId,
} from './access-control.util';

describe('access-control util', () => {
  const buildUser = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: 'user-1',
    email: 'user@test.com',
    role: Role.ASESOR,
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    ...overrides,
  });

  it('usa empresaId como alcance cuando el token no trae empresaIds', () => {
    const user = buildUser({ empresaId: 'empresa-1' });

    expect(resolveScopedEmpresaId(user)).toBe('empresa-1');
    expect(getPrismaAccessFilter(user)).toMatchObject({
      tenantId: 'tenant-1',
      empresaId: { in: ['empresa-1'] },
    });
  });

  it('no trata un coordinador con empresaId como acceso tenant-wide', () => {
    const user = buildUser({
      role: Role.COORDINADOR,
      empresaId: 'empresa-1',
    });

    expect(resolveAccessScopeMode(user).hasTenantWideAccess).toBe(false);
    expect(getPrismaAccessFilter(user)).toMatchObject({
      tenantId: 'tenant-1',
      empresaId: { in: ['empresa-1'] },
    });
  });
});
