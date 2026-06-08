import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ContratosClienteService } from '../contratos-cliente/contratos-cliente.service';
import {
  EstadoPagoOrden,
  EstadoOrden,
  MetodoPagoBase,
  Role,
  TipoVisita,
} from '../generated/client/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushNotificationsService } from '../push-notifications/push-notifications.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { DateSortOrder } from './dto/query-ordenes-servicio.dto';
import { OrdenesServicioService } from './ordenes-servicio.service';

describe('OrdenesServicioService - endurecimiento financiero', () => {
  let service: OrdenesServicioService;
  let prismaMock: PrismaMock;
  let contratosMock: ContratosClienteMock;
  let supabaseMock: SupabaseMock;
  let pushNotificationsMock: {
    sendServiceAssignedNotification: jest.Mock;
  };
  let configServiceMock: {
    get: jest.Mock;
  };

  type ServiceUser = Parameters<OrdenesServicioService['findAll']>[0];
  type ServiceUpdateDto = Parameters<OrdenesServicioService['update']>[2];
  type TestUpdateDto = ServiceUpdateDto & {
    estadoPago?: EstadoPagoOrden;
    valorCotizado?: number;
    valorRepuestos?: number;
    valorPagado?: number;
  };

  type ComprobantePagoRecord = {
    path: string;
    monto: number;
    banco?: string | null;
    referenciaPago?: string | null;
    fechaPago?: string | Date | null;
  };

  type DesglosePagoRecord = {
    metodo: MetodoPagoBase;
    monto: number;
    banco?: string | null;
    referencia?: string | null;
    observacion?: string | null;
  };

  type OrdenServicioRecord = {
    id: string;
    numeroOrden?: string | null;
    valorCotizado: number;
    valorRepuestos?: number | null;
    valorPagado?: number | null;
    estadoServicio: EstadoOrden;
    estadoPago: EstadoPagoOrden;
    tenantId: string;
    empresaId: string;
    clienteId: string;
    creadoPorId?: string | null;
    tecnicoId: string | null;
    direccionId?: string | null;
    direccionTexto?: string | null;
    linkMaps?: string | null;
    municipio?: string | null;
    barrio?: string | null;
    bloque?: string | null;
    piso?: string | null;
    unidad?: string | null;
    liquidadoAt: Date | null;
    fechaVisita?: Date | string | null;
    createdAt?: Date;
    liquidadoPor?: { disconnect: true } | null;
    ordenPadreId: string | null;
    tipoVisita: string | null;
    tipoFacturacion: string | null;
    servicioEspecifico?: string | null;
    serviciosSeleccionados?: string[] | null;
    urgencia?: string | null;
    declaracionEfectivo: { id: string; consignado?: boolean } | null;
    consignacionOrden: { id: string } | null;
    comprobantePago: string | ComprobantePagoRecord[];
    desglosePago?: DesglosePagoRecord[];
    observacion?: string | null;
    diagnosticoTecnico?: string | null;
    horaInicio?: Date | string | null;
    horaFin?: Date | string | null;
    horaInicioReal?: Date | string | null;
    horaFinReal?: Date | string | null;
    referenciaPago?: string | null;
    fechaPago?: Date | string | null;
    facturaPath?: string | null;
    facturaElectronica?: string | null;
    evidenciaPath?: string | null;
    evidencias?: Array<{ path?: string | null }>;
    geolocalizaciones?: Array<{
      fotoLlegada?: string | null;
      fotoSalida?: string | null;
    }>;
    cliente?: {
      tipoCliente?: string | null;
      razonSocial?: string | null;
      nombre?: string | null;
      apellido?: string | null;
    } | null;
    tecnico?: {
      user?: {
        nombre?: string | null;
        apellido?: string | null;
        telefono?: string | null;
      } | null;
    } | null;
    servicio?: {
      nombre?: string | null;
    } | null;
  };

  type OrdenServicioSeguimientoRecord = {
    id: string;
    tenantId: string;
    empresaId: string;
    ordenServicioId: string;
    createdByMembershipId: string;
    completedByMembershipId: string | null;
    followUpType: string;
    status: string;
    dueAt: Date;
    contactedAt: Date | null;
    channel: string | null;
    outcome: string | null;
    notes: string | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  type OrdenServicioUpdateData = {
    valorPagado?: number;
    valorRepuestos?: number;
    estadoPago?: EstadoPagoOrden;
    estadoServicio?: EstadoOrden;
    liquidadoAt?: Date | null;
    liquidadoPor?: { disconnect: true } | null;
    tecnico?: { connect: { id: string } } | { disconnect: true };
    observacion?: string;
    direccion?: { connect: { id: string } };
    direccionTexto?: string;
    comprobantePago?: ComprobantePagoRecord[];
    desglosePago?: DesglosePagoRecord[];
    referenciaPago?: string;
    fechaPago?: string | Date;
    creadoPorId?: string | null;
  };

  type FindArgs = {
    where?: Record<string, unknown>;
    include?: Record<string, unknown>;
    select?: Record<string, unknown>;
    orderBy?: Record<string, unknown> | Record<string, unknown>[];
    take?: number;
  };

  type OrdenServicioUpdateArgs = {
    where?: Record<string, unknown>;
    data: OrdenServicioUpdateData;
  };

  type DeclaracionEfectivoCreateArgs = {
    data: {
      tenantId: string;
      empresaId: string;
      ordenId: string;
      tecnicoId: string;
      valorDeclarado: number;
      consignado: boolean;
    };
  };

  type MockFn<TArgs extends unknown[], TReturn> = jest.MockedFunction<
    (...args: TArgs) => TReturn
  >;

  const mockFn = <TArgs extends unknown[], TReturn>() =>
    jest.fn() as MockFn<TArgs, TReturn>;

  type PrismaMock = {
    ordenServicio: {
      findFirst: MockFn<[FindArgs], Promise<OrdenServicioRecord | null>>;
      findMany: MockFn<[FindArgs], Promise<OrdenServicioRecord[]>>;
      update: MockFn<[OrdenServicioUpdateArgs], Promise<OrdenServicioRecord>>;
      count: MockFn<[FindArgs?], Promise<number>>;
      create: MockFn<[Record<string, unknown>], Promise<OrdenServicioRecord>>;
    };
    ordenServicioSeguimiento: {
      findFirst: MockFn<
        [FindArgs],
        Promise<OrdenServicioSeguimientoRecord | null>
      >;
      update: MockFn<
        [Record<string, unknown>],
        Promise<OrdenServicioSeguimientoRecord>
      >;
      updateMany: MockFn<[Record<string, unknown>], Promise<{ count: number }>>;
      create: MockFn<
        [Record<string, unknown>],
        Promise<OrdenServicioSeguimientoRecord>
      >;
    };
    empresa: {
      findFirst: MockFn<[FindArgs], Promise<unknown>>;
      findUnique: MockFn<[FindArgs], Promise<unknown>>;
    };
    direccion: {
      findFirst: MockFn<[FindArgs], Promise<unknown>>;
    };
    cliente: {
      findUnique: MockFn<[FindArgs], Promise<unknown>>;
    };
    servicio: {
      findFirst: MockFn<[FindArgs], Promise<unknown>>;
    };
    contratoCliente: {
      findFirst: MockFn<[FindArgs], Promise<unknown>>;
    };
    entidadFinanciera: {
      findFirst: MockFn<[FindArgs], Promise<unknown>>;
    };
    tenantMembership: {
      findUnique: MockFn<[FindArgs], Promise<unknown>>;
    };
    empresaMembership: {
      findMany: MockFn<[FindArgs], Promise<unknown[]>>;
    };
    geolocalizacion: {
      findMany: MockFn<[FindArgs], Promise<unknown[]>>;
    };
    declaracionEfectivo: {
      findUnique: MockFn<
        [FindArgs],
        Promise<OrdenServicioRecord['declaracionEfectivo']>
      >;
      create: MockFn<[DeclaracionEfectivoCreateArgs], Promise<unknown>>;
      update: MockFn<[Record<string, unknown>], Promise<unknown>>;
    };
    consignacionOrden: {
      findFirst: MockFn<[FindArgs], Promise<unknown>>;
    };
  };

  type SupabaseMock = {
    getSignedUrls: MockFn<[unknown?], Promise<unknown[]>>;
    getSignedUrl: MockFn<[string], Promise<string | null>>;
  };

  type ContratosClienteMock = {
    getActiveByCliente: MockFn<[string, string?], Promise<unknown>>;
  };

  const baseOrden: OrdenServicioRecord = {
    id: 'orden-1',
    valorCotizado: 100000,
    estadoServicio: EstadoOrden.NUEVO,
    estadoPago: EstadoPagoOrden.PENDIENTE,
    tenantId: 'tenant-1',
    empresaId: 'emp-1',
    clienteId: 'cli-1',
    creadoPorId: null,
    tecnicoId: 'tech-1',
    direccionId: 'dir-1',
    direccionTexto: 'Calle 1 # 2-3',
    liquidadoAt: null,
    createdAt: new Date('2026-03-01T05:00:00.000Z'),
    ordenPadreId: null,
    tipoVisita: null,
    tipoFacturacion: null,
    declaracionEfectivo: null,
    consignacionOrden: null,
    comprobantePago: [],
  };

  const buildOrden = (
    overrides: Partial<OrdenServicioRecord> = {},
  ): OrdenServicioRecord => ({
    ...baseOrden,
    ...overrides,
  });

  const baseFollowUp: OrdenServicioSeguimientoRecord = {
    id: 'follow-up-1',
    tenantId: 'tenant-1',
    empresaId: 'emp-1',
    ordenServicioId: 'orden-seguimiento-1',
    createdByMembershipId: 'membership-original',
    completedByMembershipId: null,
    followUpType: 'INICIAL',
    status: 'PENDIENTE',
    dueAt: new Date('2026-04-29T05:00:00.000Z'),
    contactedAt: null,
    channel: null,
    outcome: null,
    notes: null,
    completedAt: null,
    createdAt: new Date('2026-04-01T05:00:00.000Z'),
    updatedAt: new Date('2026-04-01T05:00:00.000Z'),
  };

  const buildFollowUp = (
    overrides: Partial<OrdenServicioSeguimientoRecord> = {},
  ): OrdenServicioSeguimientoRecord => ({
    ...baseFollowUp,
    ...overrides,
  });

  const arrangeUpdate = async ({
    orderOverrides = {},
    updateDto = {},
    updatedOverrides = {},
    performingUser,
  }: {
    orderOverrides?: Partial<OrdenServicioRecord>;
    updateDto?: TestUpdateDto;
    updatedOverrides?: Partial<OrdenServicioRecord>;
    performingUser?: ServiceUser;
  }) => {
    const currentOrder = buildOrden(orderOverrides);
    const nextOrder = buildOrden({
      ...orderOverrides,
      ...updatedOverrides,
      ...updateDto,
    });

    prismaMock.ordenServicio.findFirst.mockResolvedValue(currentOrder);
    prismaMock.ordenServicio.update.mockResolvedValue(nextOrder);

    await service.update('tenant-1', 'orden-1', updateDto, performingUser);

    return { currentOrder, nextOrder };
  };

  const adminUser: ServiceUser = {
    sub: 'user-1',
    email: 'admin@tenant.test',
    tenantId: 'tenant-1',
    role: Role.ADMIN,
  };

  beforeEach(() => {
    prismaMock = {
      ordenServicio: {
        findFirst: mockFn(),
        findMany: mockFn(),
        update: mockFn(),
        count: mockFn(),
        create: mockFn(),
      },
      ordenServicioSeguimiento: {
        findFirst: mockFn(),
        update: mockFn(),
        updateMany: mockFn(),
        create: mockFn(),
      },
      empresa: { findFirst: mockFn(), findUnique: mockFn() },
      direccion: { findFirst: mockFn() },
      cliente: { findUnique: mockFn() },
      servicio: { findFirst: mockFn() },
      contratoCliente: { findFirst: mockFn() },
      entidadFinanciera: { findFirst: mockFn() },
      tenantMembership: { findUnique: mockFn() },
      empresaMembership: { findMany: mockFn() },
      geolocalizacion: { findMany: mockFn() },
      declaracionEfectivo: {
        findUnique: mockFn(),
        create: mockFn(),
        update: mockFn(),
      },
      consignacionOrden: {
        findFirst: mockFn(),
      },
    };

    supabaseMock = {
      getSignedUrls: mockFn(),
      getSignedUrl: mockFn(),
    };

    contratosMock = {
      getActiveByCliente: mockFn(),
    };
    pushNotificationsMock = {
      sendServiceAssignedNotification: jest.fn().mockResolvedValue(true),
    };
    configServiceMock = {
      get: jest.fn().mockReturnValue(undefined),
    };

    prismaMock.declaracionEfectivo.findUnique.mockResolvedValue(null);
    prismaMock.ordenServicioSeguimiento.updateMany.mockResolvedValue({
      count: 0,
    });
    prismaMock.direccion.findFirst.mockResolvedValue({
      id: 'dir-2',
      direccion: 'Carrera 10 # 20-30',
    });
    supabaseMock.getSignedUrls.mockResolvedValue([]);
    supabaseMock.getSignedUrl.mockResolvedValue('signed-url');
    contratosMock.getActiveByCliente.mockResolvedValue(null);

    service = new OrdenesServicioService(
      prismaMock as unknown as PrismaService,
      supabaseMock as unknown as SupabaseService,
      contratosMock as unknown as ContratosClienteService,
      pushNotificationsMock as unknown as PushNotificationsService,
      configServiceMock as unknown as ConfigService,
    );
  });

  describe('creación de orden', () => {
    it('respeta sinTecnico y no autasigna operador', async () => {
      const autoAssignSpy = jest.spyOn(
        service as unknown as {
          autoAssignTechnician: (...args: unknown[]) => Promise<string | null>;
        },
        'autoAssignTechnician',
      );

      prismaMock.empresa.findFirst.mockResolvedValue({
        id: 'emp-1',
        tenantId: 'tenant-1',
      });
      prismaMock.servicio.findFirst.mockResolvedValue({
        id: 'svc-1',
        empresaId: 'emp-1',
        requiereSeguimiento: false,
        primerSeguimientoDias: null,
        requiereSeguimientoTresMeses: false,
      });
      prismaMock.ordenServicio.create.mockResolvedValue(
        buildOrden({
          id: 'orden-sin-tecnico',
          tecnicoId: null,
          horaInicio: new Date('2026-05-15T14:00:00.000Z'),
          horaFin: new Date('2026-05-15T15:00:00.000Z'),
          cliente: {
            tipoCliente: 'PERSONA',
            nombre: 'Ana',
            apellido: 'Pérez',
          },
          servicio: {
            nombre: 'Control de plagas',
          },
        }),
      );

      await service.create('tenant-1', {
        clienteId: 'cli-1',
        empresaId: 'emp-1',
        servicioId: 'svc-1',
        direccionId: 'dir-1',
        sinTecnico: true,
        fechaVisita: '2026-05-15T05:00:00.000Z',
        horaInicio: '2026-05-15T14:00:00.000Z',
        duracionMinutos: 60,
      });

      const createCall = prismaMock.ordenServicio.create.mock.calls[0][0] as {
        data: { tecnicoId: string | null };
      };

      expect(autoAssignSpy).not.toHaveBeenCalled();
      expect(createCall.data.tecnicoId).toBeNull();
    });
  });

  describe('cálculo de estado de pago', () => {
    it('no marca PAGADO cuando solo hay transferencia planeada y no existe evidencia', async () => {
      await arrangeUpdate({
        updateDto: {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          estadoServicio: EstadoOrden.NUEVO,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBeUndefined();
      expect(updateCall.data.estadoPago).toBeUndefined();
    });

    it('no marca PARCIAL cuando la transferencia es solo un plan cargado en edición', async () => {
      await arrangeUpdate({
        orderOverrides: { valorCotizado: 120000 },
        updateDto: {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 50000 },
          ],
          estadoServicio: EstadoOrden.NUEVO,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBeUndefined();
      expect(updateCall.data.estadoPago).toBeUndefined();
    });

    it('mantiene el breakdown como plan cuando solo hay efectivo y el servicio no llegó al recaudo', async () => {
      await arrangeUpdate({
        updateDto: {
          desglosePago: [{ metodo: MetodoPagoBase.EFECTIVO, monto: 100000 }],
          estadoServicio: EstadoOrden.NUEVO,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBeUndefined();
      expect(updateCall.data.estadoPago).toBeUndefined();
      expect(prismaMock.declaracionEfectivo.create).not.toHaveBeenCalled();
    });

    it('marca EFECTIVO_DECLARADO cuando solo hay efectivo y el servicio ya finalizó', async () => {
      await arrangeUpdate({
        updateDto: {
          desglosePago: [{ metodo: MetodoPagoBase.EFECTIVO, monto: 100000 }],
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          confirmarMovimientoFinanciero: true,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          tecnicoId: 'tech-1',
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(100000);
      expect(updateCall.data.estadoPago).toBe(
        EstadoPagoOrden.EFECTIVO_DECLARADO,
      );
      const declaracionCreateCall =
        prismaMock.declaracionEfectivo.create.mock.calls[0][0];

      expect(declaracionCreateCall.data).toEqual(
        expect.objectContaining({
          tenantId: 'tenant-1',
          empresaId: 'emp-1',
          ordenId: 'orden-1',
          tecnicoId: 'tech-1',
          valorDeclarado: 100000,
          consignado: false,
        }),
      );
    });

    it('mantiene el efectivo como plan aunque el servicio quede finalizado si no hubo confirmación financiera explícita', async () => {
      await arrangeUpdate({
        orderOverrides: {
          tipoVisita: TipoVisita.DIAGNOSTICO_INICIAL,
        },
        updateDto: {
          desglosePago: [{ metodo: MetodoPagoBase.EFECTIVO, monto: 100000 }],
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          tipoVisita: TipoVisita.DIAGNOSTICO_INICIAL,
        },
        updatedOverrides: {
          tipoVisita: TipoVisita.DIAGNOSTICO_INICIAL,
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          tecnicoId: 'tech-1',
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(0);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PENDIENTE);
      expect(prismaMock.declaracionEfectivo.create).not.toHaveBeenCalled();
    });

    it('no convierte un pago mixto planeado en pago real mientras no haya registro explícito', async () => {
      await arrangeUpdate({
        updateDto: {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 50000 },
            { metodo: MetodoPagoBase.EFECTIVO, monto: 50000 },
          ],
          estadoServicio: EstadoOrden.NUEVO,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBeUndefined();
      expect(updateCall.data.estadoPago).toBeUndefined();
    });

    it('rechaza cierre mixto sin evidencia de la transferencia', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue(baseOrden);

      await expect(
        service.update('tenant-1', 'orden-1', {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 40000 },
            { metodo: MetodoPagoBase.EFECTIVO, monto: 60000 },
          ],
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('permite registrar el efectivo de un pago mixto aunque la transferencia siga sin soporte', async () => {
      await arrangeUpdate({
        orderOverrides: {
          valorCotizado: 100000,
          valorPagado: 0,
          estadoPago: EstadoPagoOrden.PENDIENTE,
          estadoServicio: EstadoOrden.PROCESO,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 40000 },
            { metodo: MetodoPagoBase.EFECTIVO, monto: 60000 },
          ],
          comprobantePago: [],
        },
        updateDto: {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 40000 },
            { metodo: MetodoPagoBase.EFECTIVO, monto: 60000 },
          ],
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          confirmarMovimientoFinanciero: true,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PARCIAL,
          valorPagado: 60000,
          tecnicoId: 'tech-1',
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(60000);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PARCIAL);
      expect(updateCall.data.comprobantePago).toBeUndefined();
      const declaracionCreateCall =
        prismaMock.declaracionEfectivo.create.mock.calls[0][0];

      expect(declaracionCreateCall.data).toEqual(
        expect.objectContaining({
          ordenId: 'orden-1',
          tecnicoId: 'tech-1',
          valorDeclarado: 60000,
          consignado: false,
        }),
      );
    });

    it('marca EFECTIVO_DECLARADO cuando el mixto ya cubre todo, el servicio finalizó y la transferencia trae evidencia', async () => {
      await arrangeUpdate({
        updateDto: {
          desglosePago: [
            {
              metodo: MetodoPagoBase.TRANSFERENCIA,
              monto: 40000,
              referencia: 'TRX-001',
            },
            { metodo: MetodoPagoBase.EFECTIVO, monto: 60000 },
          ],
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          comprobantePago: 'ordenes/comp.png',
          fechaPago: '2026-03-25',
          referenciaPago: 'TRX-001',
          confirmarMovimientoFinanciero: true,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          tecnicoId: 'tech-1',
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(100000);
      expect(updateCall.data.estadoPago).toBe(
        EstadoPagoOrden.EFECTIVO_DECLARADO,
      );
      expect(prismaMock.declaracionEfectivo.create).toHaveBeenCalledTimes(1);
    });

    it('permite confirmar transferencia completa con evidencia explícita', async () => {
      await arrangeUpdate({
        updateDto: {
          desglosePago: [
            {
              metodo: MetodoPagoBase.TRANSFERENCIA,
              monto: 100000,
              referencia: 'TRX-999',
            },
          ],
          estadoServicio: EstadoOrden.LIQUIDADO,
          comprobantePago: 'ordenes/comp.png',
          fechaPago: '2026-03-25',
          referenciaPago: 'TRX-999',
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.LIQUIDADO,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(100000);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PAGADO);
      expect(updateCall.data.estadoServicio).toBe(EstadoOrden.LIQUIDADO);
      expect(updateCall.data.liquidadoAt).toBeInstanceOf(Date);
    });

    it('no marca LIQUIDADO una transferencia parcial aunque tenga evidencia', async () => {
      await arrangeUpdate({
        orderOverrides: { valorCotizado: 100000 },
        updateDto: {
          desglosePago: [
            {
              metodo: MetodoPagoBase.TRANSFERENCIA,
              monto: 10000,
              referencia: 'TRX-010',
            },
          ],
          estadoServicio: EstadoOrden.LIQUIDADO,
          comprobantePago: 'ordenes/comp-parcial.png',
          fechaPago: '2026-03-25',
          referenciaPago: 'TRX-010',
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PARCIAL,
          liquidadoAt: null,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(10000);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PARCIAL);
      expect(updateCall.data.estadoServicio).toBe(EstadoOrden.TECNICO_FINALIZO);
      expect(updateCall.data.liquidadoAt).toBeNull();
      expect(updateCall.data.liquidadoPor).toEqual({ disconnect: true });
    });

    it('acumula anticipo y saldo por transferencia sin pisar el primer comprobante legacy', async () => {
      await arrangeUpdate({
        orderOverrides: {
          valorCotizado: 100000,
          valorPagado: 10000,
          estadoPago: EstadoPagoOrden.PARCIAL,
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          comprobantePago: 'ordenes/comp-1.png',
          referenciaPago: 'TRX-001',
          fechaPago: new Date('2026-03-25T05:00:00.000Z'),
        },
        updateDto: {
          estadoServicio: EstadoOrden.LIQUIDADO,
          transferencias: [
            {
              monto: 90000,
              comprobantePath: 'ordenes/comp-2.png',
              referenciaPago: 'TRX-002',
              fechaPago: '2026-03-26',
            },
          ],
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.LIQUIDADO,
          estadoPago: EstadoPagoOrden.PAGADO,
          valorPagado: 100000,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];
      const comprobantes = updateCall.data.comprobantePago as Array<
        Record<string, unknown>
      >;

      expect(comprobantes).toHaveLength(2);
      expect(comprobantes[0]).toEqual(
        expect.objectContaining({
          path: 'ordenes/comp-1.png',
          monto: 10000,
          referenciaPago: 'TRX-001',
        }),
      );
      expect(comprobantes[1]).toEqual(
        expect.objectContaining({
          path: 'ordenes/comp-2.png',
          monto: 90000,
          referenciaPago: 'TRX-002',
        }),
      );
      expect(updateCall.data.valorPagado).toBe(100000);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PAGADO);
      expect(updateCall.data.estadoServicio).toBe(EstadoOrden.LIQUIDADO);
    });

    it('mantiene la orden abierta cuando varias transferencias todavía no cubren el total', async () => {
      await arrangeUpdate({
        orderOverrides: {
          valorCotizado: 100000,
          valorPagado: 10000,
          estadoPago: EstadoPagoOrden.PARCIAL,
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          comprobantePago: [
            {
              path: 'ordenes/comp-1.png',
              monto: 10000,
              referenciaPago: 'TRX-001',
              fechaPago: '2026-03-25T05:00:00.000Z',
            },
          ],
          referenciaPago: 'TRX-001',
          fechaPago: new Date('2026-03-25T05:00:00.000Z'),
        },
        updateDto: {
          estadoServicio: EstadoOrden.LIQUIDADO,
          transferencias: [
            {
              monto: 20000,
              comprobantePath: 'ordenes/comp-2.png',
              referenciaPago: 'TRX-002',
              fechaPago: '2026-03-26',
            },
          ],
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PARCIAL,
          valorPagado: 30000,
          liquidadoAt: null,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(30000);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PARCIAL);
      expect(updateCall.data.estadoServicio).toBe(EstadoOrden.TECNICO_FINALIZO);
      expect(updateCall.data.liquidadoAt).toBeNull();
      expect(updateCall.data.liquidadoPor).toEqual({ disconnect: true });
    });

    it('no duplica el pago cuando el mismo comprobante existe como path y URL firmada', async () => {
      const comprobantePath =
        'tenant-1/ordenes-servicio/orden-1/mobile/paymentReceipt/receipt.jpg';
      const signedUrl = `https://supabase.servilutioncrm.cloud/storage/v1/object/sign/tenaxis-docs/${comprobantePath}?token=expired`;

      await arrangeUpdate({
        orderOverrides: {
          valorCotizado: 350000,
          valorPagado: 700000,
          estadoPago: EstadoPagoOrden.PAGADO,
          estadoServicio: EstadoOrden.PROCESO,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 350000 },
          ],
          comprobantePago: [
            {
              path: comprobantePath,
              monto: 350000,
              referenciaPago: '0561',
              fechaPago: '2026-05-02T16:35:58.834Z',
            },
            {
              path: signedUrl,
              monto: 350000,
              referenciaPago: '0561',
              fechaPago: '2026-05-02T05:00:00.000Z',
            },
          ],
          referenciaPago: '0561',
          fechaPago: new Date('2026-05-02T05:00:00.000Z'),
        },
        updateDto: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PAGADO,
          valorPagado: 350000,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(350000);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PAGADO);
    });

    it('mantiene mixtos funcionales cuando la transferencia ya estaba registrada y el efectivo se declara al finalizar', async () => {
      await arrangeUpdate({
        orderOverrides: {
          valorCotizado: 100000,
          valorPagado: 40000,
          estadoPago: EstadoPagoOrden.PARCIAL,
          estadoServicio: EstadoOrden.PROCESO,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 40000 },
            { metodo: MetodoPagoBase.EFECTIVO, monto: 60000 },
          ],
          comprobantePago: [
            {
              path: 'ordenes/comp-1.png',
              monto: 40000,
              referenciaPago: 'TRX-001',
              fechaPago: '2026-03-25T05:00:00.000Z',
            },
          ],
          referenciaPago: 'TRX-001',
          fechaPago: new Date('2026-03-25T05:00:00.000Z'),
        },
        updateDto: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          confirmarMovimientoFinanciero: true,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.EFECTIVO_DECLARADO,
          valorPagado: 100000,
          tecnicoId: 'tech-1',
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(100000);
      expect(updateCall.data.estadoPago).toBe(
        EstadoPagoOrden.EFECTIVO_DECLARADO,
      );
      expect(prismaMock.declaracionEfectivo.create).toHaveBeenCalledTimes(1);
    });

    it('mantiene cortesía como cierre válido cuando se confirma explícitamente', async () => {
      await arrangeUpdate({
        updateDto: {
          valorCotizado: 100000,
          desglosePago: [{ metodo: MetodoPagoBase.CORTESIA, monto: 100000 }],
          estadoServicio: EstadoOrden.LIQUIDADO,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.LIQUIDADO,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(0);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.CORTESIA);
    });

    it('mantiene crédito como parcial cuando se confirma explícitamente', async () => {
      await arrangeUpdate({
        updateDto: {
          valorCotizado: 100000,
          desglosePago: [{ metodo: MetodoPagoBase.CREDITO, monto: 100000 }],
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorPagado).toBe(0);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PARCIAL);
    });
  });

  describe('validaciones de mutación', () => {
    it('rechaza edición manual de estadoPago', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue(baseOrden);

      await expect(
        service.update('tenant-1', 'orden-1', {
          estadoPago: EstadoPagoOrden.CONCILIADO,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza edición manual de valorPagado', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue(baseOrden);

      await expect(
        service.update('tenant-1', 'orden-1', {
          valorPagado: 45000,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('permite mutación financiera cuando solo existe declaración y la orden sigue abierta', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue({
        ...baseOrden,
        estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        estadoPago: EstadoPagoOrden.PARCIAL,
        declaracionEfectivo: { id: 'decl-1', consignado: false },
      });
      prismaMock.ordenServicio.update.mockResolvedValue(
        buildOrden({
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PARCIAL,
          declaracionEfectivo: { id: 'decl-1', consignado: false },
          valorCotizado: 150000,
        }),
      );

      await service.update('tenant-1', 'orden-1', {
        valorCotizado: 150000,
      });

      expect(prismaMock.ordenServicio.update).toHaveBeenCalled();
    });

    it('rechaza mutación financiera cuando la orden ya tiene consignación registrada', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue({
        ...baseOrden,
        consignacionOrden: { id: 'cons-1' },
      });

      await expect(
        service.update('tenant-1', 'orden-1', {
          valorCotizado: 150000,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rechaza mutación financiera cuando la orden ya quedó liquidada', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue({
        ...baseOrden,
        liquidadoAt: new Date(),
      });

      await expect(
        service.update('tenant-1', 'orden-1', {
          valorCotizado: 150000,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('permite completar metadata de transferencia en una orden PAGADO que aún no fue liquidada', async () => {
      await arrangeUpdate({
        orderOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PAGADO,
          valorPagado: 195000,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 195000 },
          ],
          comprobantePago: 'ordenes/comp-incomplete.png',
          referenciaPago: null,
          fechaPago: null,
          liquidadoAt: null,
        },
        updateDto: {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 195000 },
          ],
          estadoServicio: EstadoOrden.LIQUIDADO,
          comprobantePago: 'ordenes/comp-incomplete.png',
          referenciaPago: 'M10704553',
          fechaPago: '2026-04-09',
          transferencias: [
            {
              monto: 195000,
              comprobantePath: 'ordenes/comp-incomplete.png',
              referenciaPago: 'M10704553',
              fechaPago: '2026-04-09',
            },
          ],
          confirmarMovimientoFinanciero: true,
          observacionFinal: 'se instalo filtro en 195000',
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.LIQUIDADO,
          estadoPago: EstadoPagoOrden.PAGADO,
          liquidadoAt: new Date('2026-04-09T12:00:00.000Z'),
          referenciaPago: 'M10704553',
          fechaPago: new Date('2026-04-09T05:00:00.000Z'),
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.estadoServicio).toBe(EstadoOrden.LIQUIDADO);
      expect(updateCall.data.referenciaPago).toBe('M10704553');
      expect(updateCall.data.fechaPago).toBeInstanceOf(Date);
    });

    it('permite validar montos en una orden PAGADO mientras se conserve el método', async () => {
      await arrangeUpdate({
        orderOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PAGADO,
          valorCotizado: 100000,
          valorPagado: 100000,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          comprobantePago: [
            {
              path: 'ordenes/comp-pagado.png',
              monto: 100000,
              referenciaPago: 'REF-100',
              fechaPago: '2026-04-09',
            },
          ],
          referenciaPago: 'REF-100',
          fechaPago: '2026-04-09',
          liquidadoAt: null,
        },
        updateDto: {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 120000 },
          ],
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.desglosePago).toEqual([
        { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 120000 },
      ]);
    });

    it('actualiza metadata de una transferencia existente sin duplicar el comprobante', async () => {
      await arrangeUpdate({
        orderOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PAGADO,
          valorCotizado: 100000,
          valorPagado: 100000,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          comprobantePago: [
            {
              path: 'ordenes/comp-pagado.png',
              monto: 100000,
              referenciaPago: 'REF-OLD',
              fechaPago: '2026-04-09',
              banco: 'Banco viejo',
            },
          ],
          referenciaPago: 'REF-OLD',
          fechaPago: '2026-04-09',
          liquidadoAt: null,
        },
        updateDto: {
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          transferencias: [
            {
              monto: 100000,
              comprobantePath: 'ordenes/comp-pagado.png',
              referenciaPago: 'REF-NEW',
              fechaPago: '2026-04-10',
              banco: 'Banco nuevo',
              observacion: 'Dato validado por oficina',
            },
          ],
          confirmarMovimientoFinanciero: true,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];
      const comprobantes = updateCall.data.comprobantePago ?? [];

      expect(comprobantes).toHaveLength(1);
      expect(comprobantes[0]).toMatchObject({
        path: 'ordenes/comp-pagado.png',
        referenciaPago: 'REF-NEW',
        banco: 'Banco nuevo',
        observacion: 'Dato validado por oficina',
      });
    });

    it('permite cambiar el método en una orden PAGADO mientras siga abierta para validación previa a conciliación', async () => {
      await arrangeUpdate({
        orderOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PAGADO,
          valorCotizado: 100000,
          valorPagado: 100000,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          comprobantePago: [
            {
              path: 'ordenes/comp-pagado.png',
              monto: 100000,
              referenciaPago: 'REF-100',
              fechaPago: '2026-04-09',
            },
          ],
          referenciaPago: 'REF-100',
          fechaPago: '2026-04-09',
          liquidadoAt: null,
        },
        updateDto: {
          desglosePago: [{ metodo: MetodoPagoBase.EFECTIVO, monto: 100000 }],
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.desglosePago).toEqual([
        { metodo: MetodoPagoBase.EFECTIVO, monto: 100000 },
      ]);
    });

    it('rechaza cambiar finanzas cuando la orden ya está conciliada', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue(
        buildOrden({
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.CONCILIADO,
          valorCotizado: 100000,
          valorPagado: 100000,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          comprobantePago: [
            {
              path: 'ordenes/comp-pagado.png',
              monto: 100000,
              referenciaPago: 'REF-100',
              fechaPago: '2026-04-09',
            },
          ],
          referenciaPago: 'REF-100',
          fechaPago: '2026-04-09',
          liquidadoAt: null,
        }),
      );

      await expect(
        service.update('tenant-1', 'orden-1', {
          desglosePago: [{ metodo: MetodoPagoBase.EFECTIVO, monto: 100000 }],
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cambios operativos sin tocar finanzas', () => {
    it('permite cambiar el estado operativo cuando no hay bloqueo financiero', async () => {
      await arrangeUpdate({
        updateDto: {
          estadoServicio: EstadoOrden.PROCESO,
          observacion: 'Reasignación operativa',
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.estadoServicio).toBe(EstadoOrden.PROCESO);
      expect(updateCall.data.observacion).toBe('Reasignación operativa');
    });

    it('desconecta el técnico cuando la edición pide dejar la orden por asignar', async () => {
      await arrangeUpdate({
        updateDto: {
          tecnicoId: null,
        },
        updatedOverrides: {
          tecnicoId: null,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.tecnico).toEqual({ disconnect: true });
    });

    it('dispara el webhook de operador cuando cambia la programación con técnico asignado', async () => {
      const notifyOperatorWebhookSpy = jest
        .spyOn(service, 'notifyOperatorWebhook')
        .mockResolvedValue({ success: true });

      await arrangeUpdate({
        updateDto: {
          horaInicio: '2026-04-21T15:00:00.000Z',
        },
        updatedOverrides: {
          numeroOrden: 'OS-1234',
          horaInicio: '2026-04-21T15:00:00.000Z',
          urgencia: 'ALTA',
          direccionTexto: 'Calle 123 # 45-67',
          linkMaps: 'https://maps.example/orden-1',
          municipio: 'Bogotá',
          barrio: 'Chapinero',
          bloque: 'Torre 1',
          piso: '5',
          unidad: '502',
          serviciosSeleccionados: ['FUMIGACION'],
          diagnosticoTecnico: 'Reprogramación confirmada',
          cliente: {
            tipoCliente: 'EMPRESA',
            razonSocial: 'Acme SAS',
          },
          tecnico: {
            user: {
              nombre: 'Juan',
              apellido: 'Pérez',
              telefono: '3001234567',
            },
          },
          servicio: {
            nombre: 'Fumigación general',
          },
          desglosePago: [{ metodo: MetodoPagoBase.EFECTIVO, monto: 100000 }],
        },
      });

      expect(notifyOperatorWebhookSpy).toHaveBeenCalledWith(
        'tenant-1',
        expect.objectContaining({
          idServicio: 'orden-1',
          telefonoOperador: '3001234567',
          cliente: 'Acme SAS',
          tecnico: 'Juan Pérez',
        }),
      );

      notifyOperatorWebhookSpy.mockRestore();
    });

    it('persiste direccionId y direccionTexto al editar la orden', async () => {
      await arrangeUpdate({
        updateDto: {
          direccionId: 'dir-2',
        },
        updatedOverrides: {
          direccionId: 'dir-2',
          direccionTexto: 'Carrera 10 # 20-30',
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.direccion).toEqual({ connect: { id: 'dir-2' } });
      expect(updateCall.data.direccionTexto).toBe('Carrera 10 # 20-30');
    });

    it('persiste valorRepuestos al editar la orden', async () => {
      await arrangeUpdate({
        updateDto: {
          valorRepuestos: 45000,
        },
        updatedOverrides: {
          valorRepuestos: 45000,
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.valorRepuestos).toBe(45000);
    });

    it('permite liquidar operativamente una orden ya pagada sin reabrir finanzas', async () => {
      await arrangeUpdate({
        orderOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PAGADO,
          valorPagado: 100000,
          desglosePago: [
            { metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 },
          ],
          comprobantePago: [
            {
              path: 'ordenes/comp-1.png',
              monto: 100000,
              referenciaPago: 'TRX-PAID-1',
              fechaPago: '2026-03-25',
            },
          ],
        },
        updateDto: {
          estadoServicio: EstadoOrden.LIQUIDADO,
          observacion: 'Cierre operativo final',
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.LIQUIDADO,
          estadoPago: EstadoPagoOrden.PAGADO,
          liquidadoAt: new Date('2026-03-26T10:00:00.000Z'),
        },
      });

      const updateCall = prismaMock.ordenServicio.update.mock.calls[0][0];

      expect(updateCall.data.estadoServicio).toBe(EstadoOrden.LIQUIDADO);
      expect(updateCall.data.estadoPago).toBe(EstadoPagoOrden.PAGADO);
      expect(updateCall.data.liquidadoAt).toBeInstanceOf(Date);
    });
  });

  describe('ordenamiento de lectura', () => {
    it('ordena findAll por fechaVisita y deja órdenes sin fecha al final', async () => {
      prismaMock.ordenServicio.findMany.mockResolvedValue([]);

      await service.findAll(adminUser, 'emp-1', {
        dateSortOrder: DateSortOrder.ASC,
      });

      const findManyCall = prismaMock.ordenServicio.findMany.mock.calls[0][0];

      expect(findManyCall.orderBy).toEqual([
        { fechaVisita: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ]);
    });
  });

  describe('lectura con freeze financiero para UI', () => {
    it('no expone financialLock en findAll cuando la orden solo tiene declaración y sigue parcialmente abierta', async () => {
      prismaMock.ordenServicio.findMany.mockResolvedValue([
        {
          ...baseOrden,
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
          estadoPago: EstadoPagoOrden.PARCIAL,
          declaracionEfectivo: { id: 'decl-1' },
          consignacionOrden: null,
          horaInicioReal: null,
          horaFinReal: null,
        },
      ]);

      const resultado = await service.findAll(adminUser, 'emp-1');

      const findManyCall = prismaMock.ordenServicio.findMany.mock.calls[0][0];

      expect(findManyCall.include).toBeDefined();
      expect(findManyCall.include?.declaracionEfectivo).toBeDefined();
      expect(findManyCall.include?.consignacionOrden).toBeDefined();
      expect(resultado.data[0]?.financialLock).toBe(false);
    });

    it('expone financialLock en findOne cuando la orden ya quedó congelada por consignación', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue({
        ...baseOrden,
        liquidadoAt: null,
        declaracionEfectivo: null,
        consignacionOrden: { id: 'cons-1' },
        horaInicioReal: null,
        horaFinReal: null,
      });

      const resultado = await service.findOne(adminUser, 'orden-1');

      const findFirstCall = prismaMock.ordenServicio.findFirst.mock.calls[0][0];

      expect(findFirstCall.include).toBeDefined();
      expect(findFirstCall.include?.declaracionEfectivo).toBeDefined();
      expect(findFirstCall.include?.consignacionOrden).toBeDefined();
      expect(resultado.financialLock).toBe(true);
    });

    it('no expone financialLock en findOne cuando la orden está PAGADO pero aún no fue conciliada ni liquidada', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue({
        ...baseOrden,
        estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        estadoPago: EstadoPagoOrden.PAGADO,
        valorPagado: 100000,
        liquidadoAt: null,
        declaracionEfectivo: null,
        consignacionOrden: null,
        desglosePago: [{ metodo: MetodoPagoBase.TRANSFERENCIA, monto: 100000 }],
        comprobantePago: [
          {
            path: 'ordenes/comp-pagado.png',
            monto: 100000,
            referenciaPago: 'REF-100',
            fechaPago: '2026-04-09',
          },
        ],
        horaInicioReal: null,
        horaFinReal: null,
      });

      const resultado = await service.findOne(adminUser, 'orden-1');

      expect(resultado.financialLock).toBe(false);
    });

    it('mantiene financialLock en findOne cuando la orden ya está conciliada', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue({
        ...baseOrden,
        estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        estadoPago: EstadoPagoOrden.CONCILIADO,
        valorPagado: 100000,
        liquidadoAt: null,
        declaracionEfectivo: null,
        consignacionOrden: null,
        horaInicioReal: null,
        horaFinReal: null,
      });

      const resultado = await service.findOne(adminUser, 'orden-1');

      expect(resultado.financialLock).toBe(true);
    });
  });

  describe('URLs firmadas de descarga', () => {
    const storedPath =
      'tenant-1/ordenes-servicio/orden-1/comprobantePago/comprobante.jpg';

    it('regenera una URL fresca desde una URL firmada vencida de la orden', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue(
        buildOrden({
          comprobantePago: [
            {
              path: storedPath,
              monto: 100000,
              referenciaPago: 'TRX-001',
              fechaPago: '2026-03-25T05:00:00.000Z',
            },
          ],
          evidencias: [],
          geolocalizaciones: [],
        }),
      );
      supabaseMock.getSignedUrl.mockResolvedValue('fresh-signed-url');

      const result = await service.createSignedDownloadUrl(
        adminUser,
        'orden-1',
        {
          path: `https://supabase.servilutioncrm.cloud/storage/v1/object/sign/tenaxis-docs/${storedPath}?token=expired`,
        },
      );

      expect(supabaseMock.getSignedUrl).toHaveBeenCalledWith(storedPath);
      expect(result).toEqual({
        path: storedPath,
        signedUrl: 'fresh-signed-url',
      });
    });

    it('rechaza un path que no pertenece a la orden del tenant', async () => {
      prismaMock.ordenServicio.findFirst.mockResolvedValue(
        buildOrden({
          comprobantePago: [
            {
              path: storedPath,
              monto: 100000,
              referenciaPago: 'TRX-001',
              fechaPago: '2026-03-25T05:00:00.000Z',
            },
          ],
          evidencias: [],
          geolocalizaciones: [],
        }),
      );

      await expect(
        service.createSignedDownloadUrl(adminUser, 'orden-1', {
          path: 'tenant-1/ordenes-servicio/otra-orden/comprobantePago/comprobante.jpg',
        }),
      ).rejects.toThrow('No tienes acceso al archivo solicitado');
      expect(supabaseMock.getSignedUrl).not.toHaveBeenCalled();
    });
  });

  describe('ubicaciones de operadores', () => {
    it('devuelve operadores activos con su última geolocalización scoped por tenant y empresa', async () => {
      prismaMock.empresaMembership.findMany.mockResolvedValue([
        {
          empresaId: 'emp-1',
          membershipId: 'op-1',
          role: Role.OPERADOR,
          membership: {
            role: Role.OPERADOR,
            user: {
              nombre: 'Ada',
              apellido: 'Lovelace',
            },
          },
        },
      ]);
      prismaMock.geolocalizacion.findMany.mockResolvedValue([
        {
          empresaId: 'emp-1',
          membershipId: 'op-1',
          latitud: 4.711,
          longitud: -74.0721,
          llegada: new Date('2026-04-24T14:00:00.000Z'),
          salida: null,
          ordenId: 'orden-1',
          linkMaps: 'https://maps.example/geo',
          orden: {
            numeroOrden: 'OS-001',
            direccionTexto: 'Calle 1 # 2-3',
            linkMaps: null,
            cliente: {
              tipoCliente: 'PERSONA',
              razonSocial: null,
              nombre: 'Grace',
              apellido: 'Hopper',
            },
          },
        },
      ]);

      const resultado = await service.getOperatorLastLocations(
        'tenant-1',
        adminUser,
        'emp-1',
      );

      const empresaMembershipCall =
        prismaMock.empresaMembership.findMany.mock.calls[0][0];
      expect(empresaMembershipCall.where).toMatchObject({
        tenantId: 'tenant-1',
        empresaId: 'emp-1',
        role: Role.OPERADOR,
        activo: true,
        deletedAt: null,
      });

      const geolocalizacionCall =
        prismaMock.geolocalizacion.findMany.mock.calls[0][0];
      expect(geolocalizacionCall.where).toMatchObject({
        tenantId: 'tenant-1',
        empresaId: 'emp-1',
        membershipId: { in: ['op-1'] },
        orden: {
          is: {
            tenantId: 'tenant-1',
            empresaId: 'emp-1',
            deletedAt: null,
          },
        },
      });
      expect(resultado).toEqual([
        {
          operatorId: 'op-1',
          operatorName: 'Ada Lovelace',
          operatorRole: Role.OPERADOR,
          empresaId: 'emp-1',
          lastLocation: {
            latitud: 4.711,
            longitud: -74.0721,
            llegada: '2026-04-24T14:00:00.000Z',
            salida: null,
            ordenId: 'orden-1',
            numeroOrden: 'OS-001',
            clienteNombre: 'Grace Hopper',
            direccionTexto: 'Calle 1 # 2-3',
            linkMaps: 'https://maps.example/geo',
          },
        },
      ]);
    });

    it('deduplica memberships repetidas para no devolver el mismo operador dos veces en la misma empresa', async () => {
      prismaMock.empresaMembership.findMany.mockResolvedValue([
        {
          empresaId: 'emp-1',
          membershipId: 'op-1',
          role: Role.OPERADOR,
          membership: {
            role: Role.OPERADOR,
            user: {
              nombre: 'Ada',
              apellido: 'Lovelace',
            },
          },
        },
        {
          empresaId: 'emp-1',
          membershipId: 'op-1',
          role: Role.OPERADOR,
          membership: {
            role: Role.OPERADOR,
            user: {
              nombre: 'Ada',
              apellido: 'Lovelace',
            },
          },
        },
      ]);
      prismaMock.geolocalizacion.findMany.mockResolvedValue([]);

      const resultado = await service.getOperatorLastLocations(
        'tenant-1',
        adminUser,
        'emp-1',
      );

      const geolocalizacionCall =
        prismaMock.geolocalizacion.findMany.mock.calls[0][0];
      expect(geolocalizacionCall.where).toMatchObject({
        membershipId: { in: ['op-1'] },
      });
      expect(resultado).toEqual([
        {
          operatorId: 'op-1',
          operatorName: 'Ada Lovelace',
          operatorRole: Role.OPERADOR,
          empresaId: 'emp-1',
          lastLocation: null,
        },
      ]);
    });
  });

  describe('gestión de seguimientos', () => {
    const callRegistrarUser: ServiceUser = {
      sub: 'user-call-registrar',
      email: 'coordinador@tenant.test',
      tenantId: 'tenant-1',
      role: Role.COORDINADOR,
      membershipId: 'membership-call-registrar',
    };

    const acceptedFollowUpDto = {
      contactedAt: '2026-04-28T15:00:00.000Z',
      channel: 'TELEFONO',
      outcome: 'Cliente acepta el servicio',
      resolution: 'ACEPTADO' as const,
      notes: 'El cliente aceptó la programación del servicio.',
    };

    it('cierra seguimientos pendientes de una orden cuando el servicio termina', async () => {
      prismaMock.ordenServicioSeguimiento.updateMany.mockResolvedValue({
        count: 2,
      });

      await arrangeUpdate({
        orderOverrides: {
          estadoServicio: EstadoOrden.PROCESO,
        },
        updateDto: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        },
        updatedOverrides: {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        },
        performingUser: callRegistrarUser,
      });

      const updateManyCall = prismaMock.ordenServicioSeguimiento.updateMany.mock
        .calls[0][0] as {
        where: {
          tenantId: string;
          ordenServicioId: string;
          status: string;
          completedAt: null;
        };
        data: {
          status: string;
          completedAt: Date;
          completedByMembershipId?: string | null;
          outcome: string;
        };
      };

      expect(updateManyCall.where).toEqual({
        tenantId: 'tenant-1',
        ordenServicioId: 'orden-1',
        status: 'PENDIENTE',
        completedAt: null,
      });
      expect(updateManyCall.data.status).toBe('ACEPTADO');
      expect(updateManyCall.data.completedAt).toBeInstanceOf(Date);
      expect(updateManyCall.data.completedByMembershipId).toBe(
        callRegistrarUser.membershipId,
      );
      expect(updateManyCall.data.outcome).toBe('SERVICIO_FINALIZADO');
    });

    it('asigna el CreadoPorId del servicio al usuario que registra una llamada aceptada', async () => {
      const pendingFollowUp = buildFollowUp();
      prismaMock.ordenServicioSeguimiento.findFirst.mockResolvedValue(
        pendingFollowUp,
      );
      prismaMock.ordenServicio.findFirst.mockResolvedValue(
        buildOrden({
          id: pendingFollowUp.ordenServicioId,
          creadoPorId: 'membership-original',
        }),
      );
      prismaMock.ordenServicioSeguimiento.update.mockResolvedValue(
        buildFollowUp({
          status: 'ACEPTADO',
          completedByMembershipId: callRegistrarUser.membershipId,
        }),
      );
      prismaMock.ordenServicio.update.mockResolvedValue(
        buildOrden({
          id: pendingFollowUp.ordenServicioId,
          creadoPorId: callRegistrarUser.membershipId,
        }),
      );

      await service.completeFollowUp(
        'tenant-1',
        pendingFollowUp.id,
        acceptedFollowUpDto,
        callRegistrarUser,
      );

      const seguimientoUpdateCall = prismaMock.ordenServicioSeguimiento.update
        .mock.calls[0][0] as {
        where?: { id?: string };
        data?: {
          status?: string;
          completedByMembershipId?: string | null;
        };
      };

      expect(seguimientoUpdateCall).toMatchObject({
        where: { id: pendingFollowUp.id },
        data: {
          status: 'ACEPTADO',
          completedByMembershipId: callRegistrarUser.membershipId,
        },
      });
      expect(prismaMock.ordenServicio.update).toHaveBeenCalledWith({
        where: { id: pendingFollowUp.ordenServicioId },
        data: { creadoPorId: callRegistrarUser.membershipId },
      });
    });

    it('no reasigna el CreadoPorId del servicio cuando la decisión del cliente es rechazada', async () => {
      const pendingFollowUp = buildFollowUp();
      prismaMock.ordenServicioSeguimiento.findFirst.mockResolvedValue(
        pendingFollowUp,
      );
      prismaMock.ordenServicio.findFirst.mockResolvedValue(
        buildOrden({
          id: pendingFollowUp.ordenServicioId,
          creadoPorId: 'membership-original',
        }),
      );
      prismaMock.ordenServicioSeguimiento.update.mockResolvedValue(
        buildFollowUp({
          status: 'RECHAZADO',
          completedByMembershipId: callRegistrarUser.membershipId,
        }),
      );

      await service.completeFollowUp(
        'tenant-1',
        pendingFollowUp.id,
        {
          ...acceptedFollowUpDto,
          resolution: 'RECHAZADO',
          outcome: 'Cliente rechaza el servicio',
        },
        callRegistrarUser,
      );

      expect(prismaMock.ordenServicio.update).not.toHaveBeenCalled();
    });

    it('registra una llamada sobre una orden de seguimiento legacy aunque falte la fila pendiente', async () => {
      const legacyFollowUpDate = new Date('2026-04-29T05:00:00.000Z');
      const legacyFollowUpOrder = buildOrden({
        id: 'orden-seguimiento-legacy',
        tenantId: 'tenant-1',
        empresaId: 'emp-1',
        ordenPadreId: 'orden-madre-1',
        creadoPorId: callRegistrarUser.membershipId,
        fechaVisita: legacyFollowUpDate,
      });
      const createdTracking = buildFollowUp({
        id: 'follow-up-backfilled-on-complete',
        ordenServicioId: legacyFollowUpOrder.id,
        createdByMembershipId: callRegistrarUser.membershipId,
      });

      prismaMock.ordenServicioSeguimiento.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prismaMock.ordenServicio.findFirst
        .mockResolvedValueOnce(legacyFollowUpOrder)
        .mockResolvedValueOnce(legacyFollowUpOrder);
      prismaMock.ordenServicioSeguimiento.create.mockResolvedValue(
        createdTracking,
      );
      prismaMock.ordenServicioSeguimiento.update.mockResolvedValue(
        buildFollowUp({
          ...createdTracking,
          status: 'ACEPTADO',
          completedByMembershipId: callRegistrarUser.membershipId,
        }),
      );

      await service.completeFollowUp(
        'tenant-1',
        legacyFollowUpOrder.id,
        acceptedFollowUpDto,
        callRegistrarUser,
      );

      expect(prismaMock.ordenServicioSeguimiento.create).toHaveBeenCalledWith({
        data: {
          tenantId: 'tenant-1',
          empresaId: legacyFollowUpOrder.empresaId,
          ordenServicioId: legacyFollowUpOrder.id,
          createdByMembershipId: callRegistrarUser.membershipId,
          followUpType: 'ADICIONAL',
          dueAt: legacyFollowUpDate,
          status: 'PENDIENTE',
        },
      });
      const updateCall =
        prismaMock.ordenServicioSeguimiento.update.mock.calls[0]?.[0];
      expect(updateCall?.where).toEqual({ id: createdTracking.id });
      expect(updateCall?.data).toMatchObject({
        status: 'ACEPTADO',
        completedByMembershipId: callRegistrarUser.membershipId,
      });
    });
  });

  describe('precio de refuerzos automáticos', () => {
    type AutomaticFollowUpOrderInput = {
      id: string;
      empresaId: string;
      clienteId: string;
      servicioId: string;
      creadoPorId: string | null;
      direccionId: string | null;
      direccionTexto: string;
      observacion?: string | null;
      tipoFacturacion: null;
      nivelInfestacion: null;
      urgencia: null;
      valorCotizado?: number | null;
    };

    type AutomaticFollowUpServiceInput = {
      empresaId: string;
      requiereSeguimiento: boolean;
      primerSeguimientoDias: number | null;
      requiereSeguimientoTresMeses: boolean;
    };

    const invokeCreateAutomaticFollowUps = (valorCotizado: number) =>
      (
        service as unknown as {
          createAutomaticFollowUps: (
            tenantId: string,
            orden: AutomaticFollowUpOrderInput,
            servicio: AutomaticFollowUpServiceInput,
            fechaBase: Date | null,
            contratoActivo: null,
            options?: {
              allowWithoutContract?: boolean;
            },
          ) => Promise<number>;
        }
      ).createAutomaticFollowUps(
        'tenant-1',
        {
          id: 'orden-1',
          empresaId: 'emp-1',
          clienteId: 'cli-1',
          servicioId: 'serv-1',
          creadoPorId: null,
          direccionId: 'dir-1',
          direccionTexto: 'Calle 1 # 2-3',
          observacion: 'Observación original',
          tipoFacturacion: null,
          nivelInfestacion: null,
          urgencia: null,
          valorCotizado,
        },
        {
          empresaId: 'emp-1',
          requiereSeguimiento: true,
          primerSeguimientoDias: 7,
          requiereSeguimientoTresMeses: false,
        },
        new Date('2026-03-10T05:00:00.000Z'),
        null,
        { allowWithoutContract: true },
      );

    it('usa el 50% del valor original cuando supera 100000', async () => {
      prismaMock.ordenServicio.count.mockResolvedValue(0);
      prismaMock.ordenServicio.create.mockResolvedValue(
        buildOrden({
          id: 'refuerzo-1',
          ordenPadreId: 'orden-1',
          valorCotizado: 62500,
          tipoVisita: TipoVisita.SERVICIO_REFUERZO,
        }),
      );

      await invokeCreateAutomaticFollowUps(125000);

      const createCall = prismaMock.ordenServicio.create.mock.calls[0][0] as {
        data: { valorCotizado?: number };
      };

      expect(createCall.data.valorCotizado).toBe(62500);
    });

    it('usa 50000 cuando el valor original no supera 100000', async () => {
      prismaMock.ordenServicio.count.mockResolvedValue(0);
      prismaMock.ordenServicio.create.mockResolvedValue(
        buildOrden({
          id: 'refuerzo-2',
          ordenPadreId: 'orden-1',
          valorCotizado: 50000,
          tipoVisita: TipoVisita.SERVICIO_REFUERZO,
        }),
      );

      await invokeCreateAutomaticFollowUps(75000);

      const createCall = prismaMock.ordenServicio.create.mock.calls[0][0] as {
        data: { valorCotizado?: number };
      };

      expect(createCall.data.valorCotizado).toBe(50000);
    });
  });
});
