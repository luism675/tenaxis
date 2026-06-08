import { JwtPayload } from '../auth/jwt-payload.interface';
import { EquipoTrabajoTareaEstado, Role } from '../generated/client/client';
import { PrismaService } from '../prisma/prisma.service';
import { EquipoTrabajoTareasService } from './equipo-trabajo-tareas.service';

type EquipoTrabajoTareasPrismaMock = {
  empresa: {
    findFirst: jest.Mock;
  };
  equipoTrabajoTarea: {
    findMany: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
  };
};

const firstMockArg = <T>(mock: jest.Mock, callIndex = 0): T => {
  const calls = mock.mock.calls as unknown[][];
  return calls[callIndex]?.[0] as T;
};

describe('EquipoTrabajoTareasService.findAll', () => {
  function createService(): {
    prisma: EquipoTrabajoTareasPrismaMock;
    service: EquipoTrabajoTareasService;
  } {
    const prisma: EquipoTrabajoTareasPrismaMock = {
      empresa: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'empresa-1', tenantId: 'tenant-1' }),
      },
      equipoTrabajoTarea: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([
          {
            estado: EquipoTrabajoTareaEstado.PENDIENTE,
            _count: { _all: 102 },
          },
        ]),
      },
    };

    return {
      prisma,
      service: new EquipoTrabajoTareasService(
        prisma as unknown as PrismaService,
      ),
    };
  }

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'admin@tenaxis.test',
    role: Role.ADMIN,
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    empresaId: 'empresa-1',
    empresaIds: ['empresa-1'],
  };

  it('limits tasks by page while keeping summary totals independent from the selected status', async () => {
    const { prisma, service } = createService();
    prisma.equipoTrabajoTarea.count
      .mockResolvedValueOnce(37)
      .mockResolvedValueOnce(102)
      .mockResolvedValueOnce(3);

    const result = await service.findAll(user, {
      estado: EquipoTrabajoTareaEstado.PENDIENTE,
      page: 2,
      limit: 20,
    });

    const findManyArg = firstMockArg<{
      take: number;
      skip: number;
      where: Record<string, unknown>;
    }>(prisma.equipoTrabajoTarea.findMany);
    expect(findManyArg).toMatchObject({
      take: 20,
      skip: 20,
    });
    expect(findManyArg.where).toMatchObject({
      tenantId: 'tenant-1',
      empresaId: 'empresa-1',
      deletedAt: null,
      estado: EquipoTrabajoTareaEstado.PENDIENTE,
    });
    expect(result.summary.total).toBe(102);
    expect(result.pagination).toEqual({
      page: 2,
      limit: 20,
      total: 37,
      totalPages: 2,
      hasNextPage: false,
    });
  });
});
