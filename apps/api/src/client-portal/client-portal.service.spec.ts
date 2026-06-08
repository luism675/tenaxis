import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '../generated/client/client';
import { ClientPortalService } from './client-portal.service';

const sqlText = (query: unknown): string => {
  const candidate = query as { sql?: string; strings?: string[] };
  return candidate.sql ?? candidate.strings?.join(' ') ?? String(query);
};

const firstMockArg = (mock: jest.Mock, callIndex: number): unknown => {
  const calls = mock.mock.calls as unknown[][];
  return calls[callIndex]?.[0];
};

describe('ClientPortalService', () => {
  const now = new Date('2026-05-19T12:00:00.000Z');
  let prisma: {
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
  };
  let service: ClientPortalService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    prisma = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    service = new ClientPortalService(
      prisma as never,
      {
        get: jest.fn().mockReturnValue('https://app.tenaxis.test'),
      } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a 30-day portal link after validating tenant and empresa access', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        id: 'cliente-1',
        tenantId: 'tenant-1',
        empresaId: 'empresa-1',
        nombre: 'Ana',
        apellido: 'Pérez',
        razonSocial: null,
        telefono: '300',
        telefono2: null,
        correo: 'ana@test.com',
        empresaNombre: 'Tenaxis',
      },
    ]);

    const result = await service.createLink(
      {
        sub: 'user-1',
        email: 'u@test.com',
        role: Role.OPERADOR,
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        empresaIds: ['empresa-1'],
      },
      'cliente-1',
      { baseUrl: 'https://portal.test' },
    );

    expect(result.url).toMatch(/^https:\/\/portal\.test\/portal-cliente\//);
    expect(result.expiresAt).toEqual(new Date('2026-06-18T12:00:00.000Z'));

    const clientLookupSql = sqlText(firstMockArg(prisma.$queryRaw, 0));
    expect(clientLookupSql).toContain('c."tenantId"');
    expect(clientLookupSql).toContain('c."empresaId"');
    expect(clientLookupSql).toContain('c."deletedAt" IS NULL');
    expect(clientLookupSql).toContain('e."deletedAt" IS NULL');

    const insertSql = sqlText(firstMockArg(prisma.$executeRaw, 0));
    expect(insertSql).toContain('INSERT INTO client_portal_tokens');
    expect(insertSql).toContain('"tokenHash"');
  });

  it('rejects protected link creation without tenant context', async () => {
    await expect(
      service.createLink(
        {
          sub: 'user-1',
          email: 'u@test.com',
          role: Role.ADMIN,
        },
        'cliente-1',
        {},
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns public dashboard data and touches lastUsedAt for a valid token', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'token-row-1',
          tenantId: 'tenant-1',
          clienteId: 'cliente-1',
          empresaId: 'empresa-1',
          expiresAt: new Date('2026-06-18T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cliente-1',
          nombre: 'Ana',
          apellido: 'Pérez',
          razonSocial: null,
          tipoCliente: 'PERSONA',
          telefono: '300',
          telefono2: null,
          correo: 'ana@test.com',
          numeroDocumento: '123',
          tipoDocumento: 'CC',
          nit: null,
          empresaNombre: 'Tenaxis',
        },
      ])
      .mockResolvedValueOnce([
        { id: 'orden-proxima', estadoServicio: 'PROGRAMADO' },
      ])
      .mockResolvedValueOnce([
        { id: 'orden-ultima', estadoServicio: 'LIQUIDADO' },
      ])
      .mockResolvedValueOnce([
        { id: 'orden-historial', estadoServicio: 'LIQUIDADO' },
      ]);

    const result = await service.getPublicDashboard('raw-public-token');

    expect(result.cliente).toMatchObject({
      id: 'cliente-1',
      nombre: 'Ana Pérez',
      empresa: 'Tenaxis',
      telefono: '300',
      correo: 'ana@test.com',
    });
    expect(result.proximoServicio).toMatchObject({ id: 'orden-proxima' });
    expect(result.ultimoServicio).toMatchObject({ id: 'orden-ultima' });
    expect(result.historial).toHaveLength(1);
    expect(result.generadoAt).toEqual(now);
    expect(prisma.$executeRaw).toHaveBeenCalled();
  });

  it('ignores placeholder business names when rendering public client names', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: 'token-row-1',
          tenantId: 'tenant-1',
          clienteId: 'cliente-1',
          empresaId: 'empresa-1',
          expiresAt: new Date('2026-06-18T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'cliente-1',
          tipoCliente: 'PERSONA',
          nombre: 'María',
          apellido: 'Gómez',
          razonSocial: 'No Concretado',
          telefono: '300',
          telefono2: null,
          correo: 'maria@test.com',
          numeroDocumento: '456',
          tipoDocumento: 'CC',
          nit: null,
          empresaNombre: 'Tenaxis',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getPublicDashboard('raw-public-token');

    expect(result.cliente).toMatchObject({
      nombre: 'María Gómez',
      razonSocial: null,
      numeroDocumento: '456',
      tipoDocumento: 'CC',
    });
  });

  it('does not reveal data for missing, expired or revoked public tokens', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([]);

    await expect(
      service.getPublicDashboard('bad-token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
