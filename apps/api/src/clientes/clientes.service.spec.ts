import { ConfigService } from '@nestjs/config';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Role, TipoCliente } from '../generated/client/client';
import { PrismaService } from '../prisma/prisma.service';
import { ClientesService } from './clientes.service';

type ClientesPrismaMock = {
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
  sugerenciaSeguimiento: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  empresaMembership: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  tenantMembership: {
    findFirst: jest.Mock;
  };
  ordenServicio: {
    findFirst: jest.Mock;
  };
  cliente: {
    findFirst: jest.Mock;
    create: jest.Mock;
  };
  empresa: {
    findFirst: jest.Mock;
  };
  equipoTrabajoTarea: {
    create: jest.Mock;
  };
};

const firstMockArg = <T>(mock: jest.Mock, callIndex = 0): T => {
  const calls = mock.mock.calls as unknown[][];
  return calls[callIndex]?.[0] as T;
};

describe('ClientesService.applyRankingClassifications', () => {
  const riskClient = {
    clienteId: 'cliente-1',
    cliente: 'Cliente en seguimiento',
    telefono: '3001234567',
    empresaId: 'empresa-1',
    empresaNombre: 'Empresa Demo',
    scoreComercial: 20,
    totalServicios: 4,
    porcentajeCancelacion: 40,
    porcentajeNoToma: 0,
  };

  const rankingSummary = {
    totalEvaluados: 1,
    actualizados: 1,
    oro: 0,
    plata: 0,
    bronce: 0,
    riesgo: 1,
  };

  function createService(): {
    service: ClientesService;
    prisma: ClientesPrismaMock;
  } {
    const prisma: ClientesPrismaMock = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn().mockResolvedValue([]),
      sugerenciaSeguimiento: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'sugerencia-1' }),
      },
      empresaMembership: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      tenantMembership: {
        findFirst: jest.fn(),
      },
      ordenServicio: {
        findFirst: jest.fn(),
      },
      cliente: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      empresa: {
        findFirst: jest.fn().mockResolvedValue({ id: 'empresa-1' }),
      },
      equipoTrabajoTarea: {
        create: jest.fn().mockResolvedValue({ id: 'tarea-1' }),
      },
    };

    const configService = {
      get: jest.fn(),
    } as unknown as ConfigService;

    const service = new ClientesService(
      prisma as unknown as PrismaService,
      configService,
    );
    return { service, prisma };
  }

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'admin@tenaxis.test',
    role: Role.ADMIN,
    tenantId: 'tenant-1',
    membershipId: 'membership-admin',
    empresaIds: ['empresa-1'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a retention task assigned to the latest service creator', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw
      .mockResolvedValueOnce([riskClient])
      .mockResolvedValueOnce([rankingSummary]);
    prisma.sugerenciaSeguimiento.findFirst.mockResolvedValue(null);
    prisma.ordenServicio.findFirst.mockResolvedValue({
      creadoPorId: 'membership-origin',
    });
    prisma.empresaMembership.findFirst.mockResolvedValue({
      id: 'empresa-member-1',
    });
    prisma.tenantMembership.findFirst.mockResolvedValue({
      id: 'membership-admin',
    });

    const response = await service.applyRankingClassifications(
      user,
      'empresa-1',
      {},
    );

    expect(response.tareasRetencionCreadas).toBe(1);
    expect(response.tareasRetencionOmitidas).toBe(0);
    expect(response.sinResponsable).toBe(0);
    const suggestionCreateArg = firstMockArg<{
      data: Record<string, unknown>;
    }>(prisma.sugerenciaSeguimiento.create);
    expect(suggestionCreateArg.data).toMatchObject({
      tenantId: 'tenant-1',
      empresaId: 'empresa-1',
      clienteId: 'cliente-1',
      tipo: 'LLAMADA_RETENCION',
    });

    const taskCreateArg = firstMockArg<{
      data: Record<string, unknown>;
    }>(prisma.equipoTrabajoTarea.create);
    expect(taskCreateArg.data).toMatchObject({
      tenantId: 'tenant-1',
      empresaId: 'empresa-1',
      responsableMembershipId: 'membership-origin',
      asignadaPorMembershipId: 'membership-admin',
    });
  });

  it('does not duplicate retention work when a pending suggestion already exists', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw
      .mockResolvedValueOnce([riskClient])
      .mockResolvedValueOnce([rankingSummary]);
    prisma.sugerenciaSeguimiento.findFirst.mockResolvedValue({
      id: 'sugerencia-existente',
    });

    const response = await service.applyRankingClassifications(
      user,
      'empresa-1',
      {},
    );

    expect(response.tareasRetencionCreadas).toBe(0);
    expect(response.tareasRetencionOmitidas).toBe(1);
    expect(prisma.equipoTrabajoTarea.create).not.toHaveBeenCalled();
  });

  it('creates an unassigned retention task when origin responsible cannot be resolved', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw
      .mockResolvedValueOnce([riskClient])
      .mockResolvedValueOnce([rankingSummary]);
    prisma.sugerenciaSeguimiento.findFirst.mockResolvedValue(null);
    prisma.ordenServicio.findFirst.mockResolvedValue(null);
    prisma.cliente.findFirst.mockResolvedValue(null);
    prisma.tenantMembership.findFirst.mockResolvedValue({
      id: 'membership-admin',
    });

    const response = await service.applyRankingClassifications(
      user,
      'empresa-1',
      {},
    );

    expect(response.tareasRetencionCreadas).toBe(1);
    expect(response.tareasRetencionOmitidas).toBe(0);
    expect(response.sinResponsable).toBe(1);
    expect(prisma.sugerenciaSeguimiento.create).toHaveBeenCalledTimes(1);
    const taskCreateArg = firstMockArg<{
      data: Record<string, unknown>;
    }>(prisma.equipoTrabajoTarea.create);
    expect(taskCreateArg.data).toMatchObject({
      responsableMembershipId: null,
      observaciones:
        'Sin responsable establecido. Cualquier integrante habilitado puede tomar esta tarea.',
    });
  });

  it('keeps only the suggestion when assigning user cannot be resolved', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw
      .mockResolvedValueOnce([riskClient])
      .mockResolvedValueOnce([rankingSummary]);
    prisma.sugerenciaSeguimiento.findFirst.mockResolvedValue(null);
    prisma.ordenServicio.findFirst.mockResolvedValue(null);
    prisma.cliente.findFirst.mockResolvedValue(null);
    prisma.tenantMembership.findFirst.mockResolvedValue(null);

    const response = await service.applyRankingClassifications(
      user,
      'empresa-1',
      {},
    );

    expect(response.tareasRetencionCreadas).toBe(0);
    expect(response.tareasRetencionOmitidas).toBe(1);
    expect(response.sinResponsable).toBe(1);
    expect(prisma.sugerenciaSeguimiento.create).toHaveBeenCalledTimes(1);
    expect(prisma.equipoTrabajoTarea.create).not.toHaveBeenCalled();
  });

  it('does not expose placeholder client names in retention suggestions', async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw
      .mockResolvedValueOnce([
        {
          ...riskClient,
          cliente: 'NO CONCRETADO NO CONCRETADO',
        },
      ])
      .mockResolvedValueOnce([rankingSummary]);
    prisma.sugerenciaSeguimiento.findFirst.mockResolvedValue(null);
    prisma.ordenServicio.findFirst.mockResolvedValue(null);
    prisma.cliente.findFirst.mockResolvedValue(null);
    prisma.tenantMembership.findFirst.mockResolvedValue({
      id: 'membership-admin',
    });

    await service.applyRankingClassifications(user, 'empresa-1', {});

    const taskCreateArg = firstMockArg<{
      data: { descripcion?: string };
    }>(prisma.equipoTrabajoTarea.create);
    expect(taskCreateArg.data.descripcion).not.toContain('NO CONCRETADO');
  });

  it('checks duplicate clients inside the selected company only', async () => {
    const { service, prisma } = createService();
    prisma.cliente.findFirst.mockResolvedValue(null);
    prisma.cliente.create.mockResolvedValue({
      id: 'cliente-1',
      tenantId: 'tenant-1',
      empresaId: 'empresa-2',
      telefono: '3001234567',
    });

    await service.create(
      user,
      {
        tipoCliente: TipoCliente.PERSONA,
        nombre: 'Ana',
        telefono: '300 123 4567',
      },
      'empresa-2',
    );

    const duplicateCheckArg = firstMockArg<{
      where: Record<string, unknown>;
    }>(prisma.cliente.findFirst);
    expect(duplicateCheckArg.where).toMatchObject({
      tenantId: 'tenant-1',
      empresaId: 'empresa-2',
      deletedAt: null,
      OR: [{ telefono: '3001234567' }],
    });
  });

  it('does not use placeholder document values as duplicate keys', async () => {
    const { service, prisma } = createService();
    prisma.cliente.findFirst.mockResolvedValue(null);
    prisma.cliente.create.mockResolvedValue({
      id: 'cliente-1',
      tenantId: 'tenant-1',
      empresaId: 'empresa-1',
      telefono: '3001234567',
    });

    await service.create(
      user,
      {
        tipoCliente: TipoCliente.PERSONA,
        nombre: 'Ana',
        telefono: '3001234567',
        numeroDocumento: 'No Concretado',
        nit: 'No Concretado',
      },
      'empresa-1',
    );

    const duplicateCheckArg = firstMockArg<{
      where: { OR?: Array<Record<string, unknown>> };
    }>(prisma.cliente.findFirst);
    expect(duplicateCheckArg.where.OR).toEqual([{ telefono: '3001234567' }]);
  });

  it('rejects duplicate clients in the same company', async () => {
    const { service, prisma } = createService();
    prisma.cliente.findFirst.mockResolvedValue({
      id: 'cliente-existente',
      tenantId: 'tenant-1',
      empresaId: 'empresa-1',
      telefono: '3001234567',
    });

    await expect(
      service.create(
        user,
        {
          tipoCliente: TipoCliente.PERSONA,
          nombre: 'Ana',
          telefono: '3001234567',
        },
        'empresa-1',
      ),
    ).rejects.toThrow('Ya existe un cliente con esos datos en esta empresa.');
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('rejects client creation when the selected company is not in the tenant', async () => {
    const { service, prisma } = createService();
    prisma.empresa.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        user,
        {
          tipoCliente: TipoCliente.PERSONA,
          nombre: 'Ana',
          telefono: '3001234567',
        },
        'empresa-externa',
      ),
    ).rejects.toThrow('No tienes acceso a la empresa seleccionada.');
    expect(prisma.cliente.findFirst).not.toHaveBeenCalled();
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });
});
