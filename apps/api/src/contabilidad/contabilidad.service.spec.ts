import { BadRequestException, ConflictException } from '@nestjs/common';
import { EstadoOrden, EstadoPagoOrden } from '../generated/client/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushNotificationsService } from '../push-notifications/push-notifications.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { ContabilidadService } from './contabilidad.service';

type MockComprobantePago = {
  tipo: string;
  path: string;
  fecha?: Date;
};

type MockOrder = {
  id: string;
  tenantId?: string;
  empresaId?: string;
  tecnicoId?: string;
  valorCotizado?: number;
  valorPagado?: number;
  comprobantePago?: string | MockComprobantePago[];
  desglosePago: Array<{
    metodo: string;
    monto?: number;
    banco?: string;
    referencia?: string;
  }>;
  declaracionEfectivo?: null | {
    valorDeclarado: number;
    consignado: boolean;
    tecnicoId: string;
  };
  consignacionOrden?: { id: string } | null;
  fechaVisita?: Date;
};

type TenantMembershipFindManyArgs = {
  where: {
    tenantId: string;
    activo: boolean;
    id: { in: string[] };
    role?: string;
  };
};

type OrdenServicioUpdateArgs = {
  where: { id: string };
  data: {
    estadoPago?: EstadoPagoOrden;
    estadoServicio?: EstadoOrden | undefined;
    comprobantePago?: MockComprobantePago[];
    [key: string]: unknown;
  };
};

type ConsignacionEfectivoCreateArgs = {
  data: {
    valorConsignado?: number;
    [key: string]: unknown;
  };
};

type OrdenServicioFindManyArgs = {
  where: {
    id?: { in: string[] };
    [key: string]: unknown;
  };
  select?: Record<string, unknown>;
};

type MembershipFindManyResult = Array<{
  id: string;
  user: { nombre: string; apellido: string };
  consignacionesTecnico: unknown[];
}>;

type AsyncMock<Fn extends (...args: unknown[]) => Promise<unknown>> =
  jest.MockedFunction<Fn>;

const makeResolvedMock = <Args extends unknown[], Result>(
  result: Result,
): AsyncMock<(...args: Args) => Promise<Result>> =>
  jest.fn((...args: Args) => {
    void args;
    return Promise.resolve(result);
  }) as AsyncMock<(...args: Args) => Promise<Result>>;

type TxMock = {
  consignacionEfectivo: {
    create: AsyncMock<
      (args: ConsignacionEfectivoCreateArgs) => Promise<{ id: string }>
    >;
  };
  consignacionOrden: {
    create: AsyncMock<
      (args: Record<string, unknown>) => Promise<{ id: string }>
    >;
  };
  anticipos: {
    create: AsyncMock<
      (args: Record<string, unknown>) => Promise<{ id: string }>
    >;
  };
  declaracionEfectivo: {
    findUnique: AsyncMock<(args: Record<string, unknown>) => Promise<unknown>>;
    findMany: AsyncMock<(args: Record<string, unknown>) => Promise<unknown[]>>;
    update: AsyncMock<(args: Record<string, unknown>) => Promise<unknown>>;
    create: AsyncMock<(args: Record<string, unknown>) => Promise<unknown>>;
  };
  tenantMembership: {
    findMany: AsyncMock<
      (args: TenantMembershipFindManyArgs) => Promise<MembershipFindManyResult>
    >;
  };
  ordenServicio: {
    findMany: AsyncMock<
      (args: OrdenServicioFindManyArgs) => Promise<MockOrder[]>
    >;
    findUnique: AsyncMock<(args: Record<string, unknown>) => Promise<unknown>>;
    update: AsyncMock<(args: OrdenServicioUpdateArgs) => Promise<unknown>>;
  };
};

type PrismaServiceMock = TxMock & {
  $transaction: AsyncMock<
    (cb: (tx: TxMock) => Promise<unknown>) => Promise<unknown>
  >;
};

describe('ContabilidadService - registrarConsignacion endurecido', () => {
  function buildService() {
    const txMock: TxMock = {
      consignacionEfectivo: {
        create: makeResolvedMock<
          [ConsignacionEfectivoCreateArgs],
          { id: string }
        >({
          id: 'cons-1',
        }),
      },
      consignacionOrden: {
        create: makeResolvedMock<[Record<string, unknown>], { id: string }>({
          id: 'co-1',
        }),
      },
      anticipos: {
        create: makeResolvedMock<[Record<string, unknown>], { id: string }>({
          id: 'anticipo-1',
        }),
      },
      declaracionEfectivo: {
        findUnique: makeResolvedMock<[Record<string, unknown>], null>(null),
        findMany: makeResolvedMock<[Record<string, unknown>], unknown[]>([]),
        update: makeResolvedMock<
          [Record<string, unknown>],
          Record<string, never>
        >({}),
        create: makeResolvedMock<
          [Record<string, unknown>],
          Record<string, never>
        >({}),
      },
      tenantMembership: {
        findMany: makeResolvedMock<
          [TenantMembershipFindManyArgs],
          MembershipFindManyResult
        >([]),
      },
      ordenServicio: {
        findMany: makeResolvedMock<[OrdenServicioFindManyArgs], MockOrder[]>(
          [],
        ),
        findUnique: makeResolvedMock<[Record<string, unknown>], null>(null),
        update: makeResolvedMock<
          [OrdenServicioUpdateArgs],
          Record<string, never>
        >({}),
      },
    };

    const prismaMock: PrismaServiceMock = {
      $transaction: jest.fn((cb: (tx: TxMock) => Promise<unknown>) =>
        cb(txMock),
      ) as AsyncMock<
        (cb: (tx: TxMock) => Promise<unknown>) => Promise<unknown>
      >,
      ...txMock,
    };
    const pushNotificationsServiceMock = {
      sendPaymentReminderNotification: jest.fn().mockResolvedValue(true),
    };
    const supabaseServiceMock = {
      getSignedUrl: jest.fn().mockResolvedValue(''),
      createSignedUploadUrl: jest.fn().mockResolvedValue({
        signedUrl: '',
        token: '',
        path: '',
      }),
      getPublicUrl: jest.fn().mockReturnValue(''),
    };

    return {
      service: new ContabilidadService(
        prismaMock as unknown as PrismaService,
        pushNotificationsServiceMock as unknown as PushNotificationsService,
        supabaseServiceMock as unknown as SupabaseService,
      ),
      prismaMock,
      pushNotificationsServiceMock,
      supabaseServiceMock,
    };
  }

  const tenantId = 'tenant-1';
  const creatorId = 'membership-1';
  const baseData = {
    tecnicoId: 'tech-1',
    empresaId: 'emp-1',
    valorConsignado: 50000,
    referenciaBanco: 'REF123',
    comprobantePath: 'path/to/comprobante.jpg',
    confirmarEfectivoFisico: true,
    ordenIds: ['orden-1'],
    fechaConsignacion: '2026-03-24',
  };

  const makeOrder = (overrides: Partial<MockOrder> = {}): MockOrder => ({
    id: 'orden-1',
    tenantId,
    empresaId: 'emp-1',
    tecnicoId: 'tech-1',
    valorCotizado: 100000,
    valorPagado: 50000,
    comprobantePago: [],
    desglosePago: [{ metodo: 'EFECTIVO', monto: 50000 }],
    declaracionEfectivo: {
      valorDeclarado: 50000,
      consignado: false,
      tecnicoId: 'tech-1',
    },
    consignacionOrden: null,
    ...overrides,
  });

  it('rechaza si no se selecciona ninguna orden', async () => {
    const { service } = buildService();

    await expect(
      service.registrarConsignacion(tenantId, creatorId, {
        ...baseData,
        ordenIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rechaza registrar consignación sin confirmar efectivo físico', async () => {
    const { service, prismaMock } = buildService();

    await expect(
      service.registrarConsignacion(tenantId, creatorId, {
        ...baseData,
        confirmarEfectivoFisico: false,
      }),
    ).rejects.toThrow(
      'Confirmá que esta consignación corresponde a efectivo físico',
    );
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('ignora el valorConsignado legado cuando no coincide y recalcula en backend', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-1',
        valorPagado: 70000,
        valorCotizado: 100000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 70000 }],
        declaracionEfectivo: {
          valorDeclarado: 70000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      valorConsignado: 65000,
    });

    const consignacionCreateCall =
      prismaMock.consignacionEfectivo.create.mock.calls[0][0];

    expect(consignacionCreateCall.data.valorConsignado).toBe(70000);
  });

  it('recalcula la consignación aunque el request no envíe valorConsignado', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-sin-valor-legado',
        valorCotizado: 80000,
        valorPagado: 80000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 80000 }],
        declaracionEfectivo: {
          valorDeclarado: 80000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    const requestWithoutValue = (({ valorConsignado, ...rest }) => {
      void valorConsignado;
      return rest;
    })(baseData);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...requestWithoutValue,
      ordenIds: ['orden-sin-valor-legado'],
    });

    const consignacionCreateCall =
      prismaMock.consignacionEfectivo.create.mock.calls[0][0];

    expect(consignacionCreateCall.data.valorConsignado).toBe(80000);
  });

  it('registra adelanto vinculado cuando el entregado más adelanto cubre lo seleccionado', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-adelanto',
        valorCotizado: 300000,
        valorPagado: 300000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 300000 }],
        declaracionEfectivo: {
          valorDeclarado: 300000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      ordenIds: ['orden-adelanto'],
      valorEntregado: 200000,
      valorAdelanto: 100000,
      referenciaBanco: 'REF-ADV-001',
    });

    const consignacionCreateCall =
      prismaMock.consignacionEfectivo.create.mock.calls[0][0];
    const anticipoCreateCall = prismaMock.anticipos.create.mock.calls[0][0];

    expect(consignacionCreateCall.data.valorConsignado).toBe(200000);
    expect(anticipoCreateCall).toEqual({
      data: {
        tenantId,
        empresaId: 'emp-1',
        membershipId: 'tech-1',
        consignacionId: 'cons-1',
        monto: 100000,
        razon: 'Adelanto registrado en recaudo REF-ADV-001',
      },
    });
  });

  it('rechaza adelanto si entregado más adelanto no coincide con lo seleccionado', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-adelanto-invalido',
        valorCotizado: 300000,
        valorPagado: 300000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 300000 }],
        declaracionEfectivo: {
          valorDeclarado: 300000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await expect(
      service.registrarConsignacion(tenantId, creatorId, {
        ...baseData,
        ordenIds: ['orden-adelanto-invalido'],
        valorEntregado: 200000,
        valorAdelanto: 50000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prismaMock.consignacionEfectivo.create).not.toHaveBeenCalled();
    expect(prismaMock.anticipos.create).not.toHaveBeenCalled();
  });

  it('liquida órdenes solo-efectivo cuando el valorPagado legacy quedó en cero', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-legacy-efectivo',
        valorCotizado: 80000,
        valorPagado: 0,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 80000 }],
        declaracionEfectivo: {
          valorDeclarado: 80000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      ordenIds: ['orden-legacy-efectivo'],
      valorConsignado: 80000,
    });

    const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

    expect(updateCall.where).toEqual({ id: 'orden-legacy-efectivo' });
    expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.CONCILIADO);
    expect(updateCall.data.valorPagado).toBe(80000);
    expect(updateCall.data.estadoServicio).toBe(EstadoOrden.LIQUIDADO);
  });

  it('procesa múltiples órdenes con montos distintos y liquida solo las que ya cubren el total', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-total',
        valorCotizado: 60000,
        valorPagado: 60000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 60000 }],
        declaracionEfectivo: {
          valorDeclarado: 60000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
      makeOrder({
        id: 'orden-parcial',
        valorCotizado: 90000,
        valorPagado: 30000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 30000 }],
        declaracionEfectivo: {
          valorDeclarado: 30000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      valorConsignado: 90000,
      ordenIds: ['orden-total', 'orden-parcial'],
    });

    const consignacionCreateCall =
      prismaMock.consignacionEfectivo.create.mock.calls[0][0];

    expect(consignacionCreateCall.data.valorConsignado).toBe(90000);

    expect(prismaMock.ordenServicio.update).toHaveBeenCalledTimes(2);

    const firstUpdateCall = prismaMock.ordenServicio.update.mock.calls[0][0];
    const secondUpdateCall = prismaMock.ordenServicio.update.mock.calls[1][0];

    expect(firstUpdateCall.where).toEqual({ id: 'orden-total' });
    expect(firstUpdateCall.data.estadoPago).toBe(EstadoPagoOrden.CONCILIADO);
    expect(firstUpdateCall.data.estadoServicio).toBe(EstadoOrden.LIQUIDADO);

    expect(secondUpdateCall.where).toEqual({ id: 'orden-parcial' });
    expect(secondUpdateCall.data.estadoPago).toBe(EstadoPagoOrden.PARCIAL);
    expect(secondUpdateCall.data.estadoServicio).toBeUndefined();
  });

  it('deduplica órdenes repetidas en el input y no duplica la conciliación', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-dup',
        valorCotizado: 50000,
        valorPagado: 50000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 50000 }],
        declaracionEfectivo: {
          valorDeclarado: 50000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      valorConsignado: 50000,
      ordenIds: ['orden-dup', 'orden-dup'],
    });

    const findManyCall = prismaMock.ordenServicio.findMany.mock.calls[0][0];

    expect(findManyCall.where.id).toEqual({ in: ['orden-dup'] });

    expect(prismaMock.consignacionOrden.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.ordenServicio.update).toHaveBeenCalledTimes(1);
  });

  it('rechaza órdenes sin efectivo conciliable', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-sin-efectivo',
        valorCotizado: 100000,
        valorPagado: 100000,
        desglosePago: [{ metodo: 'TRANSFERENCIA', monto: 100000 }],
        declaracionEfectivo: null,
      }),
    ]);

    await expect(
      service.registrarConsignacion(tenantId, creatorId, {
        ...baseData,
        ordenIds: ['orden-sin-efectivo'],
        valorConsignado: 100000,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza órdenes ya consignadas o ya conciliadas', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-consignada',
        consignacionOrden: { id: 'co-existing' },
      }),
    ]);

    await expect(
      service.registrarConsignacion(tenantId, creatorId, {
        ...baseData,
        ordenIds: ['orden-consignada'],
        valorConsignado: 50000,
      }),
    ).rejects.toThrow('ya tiene una consignación registrada');

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-conciliada',
        declaracionEfectivo: {
          valorDeclarado: 50000,
          consignado: true,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await expect(
      service.registrarConsignacion(tenantId, creatorId, {
        ...baseData,
        ordenIds: ['orden-conciliada'],
        valorConsignado: 50000,
      }),
    ).rejects.toThrow('ya fue conciliada previamente');
  });

  it('rechaza órdenes con técnico inconsistente', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-tech-mismatch',
        declaracionEfectivo: {
          valorDeclarado: 50000,
          consignado: false,
          tecnicoId: 'tech-otro',
        },
      }),
    ]);

    await expect(
      service.registrarConsignacion(tenantId, creatorId, {
        ...baseData,
        ordenIds: ['orden-tech-mismatch'],
        valorConsignado: 50000,
      }),
    ).rejects.toThrow('no pertenece al técnico seleccionado');
  });

  it('recalcula el total desde backend usando la declaración y no el cashAmount del breakdown', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-declaracion-mayor',
        valorPagado: 70000,
        desglosePago: [{ metodo: 'EFECTIVO', monto: 50000 }],
        declaracionEfectivo: {
          valorDeclarado: 70000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      ordenIds: ['orden-declaracion-mayor'],
      valorConsignado: 70000,
    });

    const consignacionCreateCall =
      prismaMock.consignacionEfectivo.create.mock.calls[0][0];

    expect(consignacionCreateCall.data.valorConsignado).toBe(70000);
  });

  it('sincroniza el monto de efectivo declarado cuando el desglose quedó incompleto', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-efectivo-sin-monto',
        valorCotizado: 140000,
        valorPagado: 0,
        desglosePago: [{ metodo: 'EFECTIVO' }],
        declaracionEfectivo: {
          valorDeclarado: 140000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      ordenIds: ['orden-efectivo-sin-monto'],
      valorConsignado: 140000,
    });

    const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

    expect(updateCall.where).toEqual({ id: 'orden-efectivo-sin-monto' });
    expect(updateCall.data.desglosePago).toEqual([
      { metodo: 'EFECTIVO', monto: 140000 },
    ]);
    expect(updateCall.data.valorPagado).toBe(140000);
    expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.CONCILIADO);
  });

  it('migra soportes de string a array y anexa el nuevo comprobante', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-soportes',
        valorCotizado: 50000,
        valorPagado: 50000,
        comprobantePago: 'old-path.jpg',
        desglosePago: [{ metodo: 'EFECTIVO', monto: 50000 }],
        declaracionEfectivo: {
          valorDeclarado: 50000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      ordenIds: ['orden-soportes'],
      valorConsignado: 50000,
      comprobantePath: 'new-path.jpg',
    });

    const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];
    const soportes = updateCall.data.comprobantePago;

    expect(soportes).toBeDefined();
    if (!soportes) {
      throw new Error('Expected comprobantePago array');
    }

    expect(Array.isArray(soportes)).toBe(true);
    expect(soportes).toHaveLength(2);
    expect(soportes[0].path).toBe('old-path.jpg');
    expect(soportes[1].path).toBe('new-path.jpg');
  });

  it('cierra correctamente una orden mixta cuando la transferencia ya estaba validada y se concilia el efectivo restante', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-mixta-cierre',
        valorCotizado: 100000,
        valorPagado: 100000,
        comprobantePago: [
          {
            tipo: 'TRANSFERENCIA',
            path: 'ordenes/transferencia-validada.jpg',
            fecha: new Date('2026-03-25T15:00:00.000Z'),
          },
        ],
        desglosePago: [
          { metodo: 'TRANSFERENCIA', monto: 40000, referencia: 'TRX-400' },
          { metodo: 'EFECTIVO', monto: 60000 },
        ],
        declaracionEfectivo: {
          valorDeclarado: 60000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      ordenIds: ['orden-mixta-cierre'],
      valorConsignado: 60000,
      comprobantePath: 'consignaciones/mixto-cierre.jpg',
    });

    const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

    expect(updateCall.where).toEqual({ id: 'orden-mixta-cierre' });
    expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.CONCILIADO);
    expect(updateCall.data.estadoServicio).toBe(EstadoOrden.LIQUIDADO);
  });

  it('mantiene la orden mixta en PARCIAL cuando se concilia efectivo pero la transferencia sigue pendiente', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      makeOrder({
        id: 'orden-mixta-parcial',
        valorCotizado: 100000,
        valorPagado: 60000,
        comprobantePago: [],
        desglosePago: [
          { metodo: 'TRANSFERENCIA', monto: 40000, referencia: 'TRX-400' },
          { metodo: 'EFECTIVO', monto: 60000 },
        ],
        declaracionEfectivo: {
          valorDeclarado: 60000,
          consignado: false,
          tecnicoId: 'tech-1',
        },
      }),
    ]);

    await service.registrarConsignacion(tenantId, creatorId, {
      ...baseData,
      ordenIds: ['orden-mixta-parcial'],
      valorConsignado: 60000,
      comprobantePath: 'consignaciones/mixto-parcial.jpg',
    });

    const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

    expect(updateCall.where).toEqual({ id: 'orden-mixta-parcial' });
    expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PARCIAL);
    expect(updateCall.data.estadoServicio).toBeUndefined();
  });

  it('expone saldo pendiente en recaudo para órdenes mixtas con efectivo pendiente', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.findMany.mockResolvedValue([
      {
        id: 'orden-mixta',
        tecnicoId: 'tech-mixto',
        fechaVisita: new Date('2026-03-25T15:00:00.000Z'),
        desglosePago: [
          { metodo: 'TRANSFERENCIA', monto: 70000 },
          { metodo: 'EFECTIVO', monto: 30000 },
        ],
      },
    ]);

    prismaMock.tenantMembership.findMany.mockResolvedValue([
      {
        id: 'tech-mixto',
        user: { nombre: 'Yorman', apellido: 'Gabriel' },
        consignacionesTecnico: [],
      },
    ]);

    const recaudo = await service.getRecaudoTecnicos(tenantId, 'emp-1');

    const membershipQuery =
      prismaMock.tenantMembership.findMany.mock.calls[0][0];
    expect(membershipQuery.where).toMatchObject({
      tenantId,
      activo: true,
      id: { in: ['tech-mixto'] },
    });
    expect(membershipQuery.where).not.toHaveProperty('role');
    expect(recaudo).toHaveLength(1);
    expect(recaudo[0]).toMatchObject({
      id: 'tech-mixto',
      saldoPendiente: 30000,
      ordenesPendientesCount: 1,
      ordenesIds: ['orden-mixta'],
      declaraciones: [
        {
          ordenId: 'orden-mixta',
          valorDeclarado: 30000,
          tipo: 'IMPLICITO',
        },
      ],
    });
  });
});
