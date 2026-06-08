import { Injectable } from '@nestjs/common';
import { EstadoOrden, Prisma, UrgenciaOrden } from '../generated/client/client';
import { ContabilidadService } from '../contabilidad/contabilidad.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  endOfBogotaDayUtc,
  startOfBogotaDayUtc,
} from '../common/utils/timezone.util';
import {
  OperatorDashboardActivityDto,
  OperatorDashboardCashCollectionDto,
  OperatorDashboardNextServiceDto,
  OperatorDashboardResponseDto,
} from './dto/get-mobile-operator-dashboard-response.dto';
import { OperatorDashboardScope } from './types/operator-dashboard-scope.type';

const CLOSED_ORDER_STATUSES: EstadoOrden[] = [
  EstadoOrden.LIQUIDADO,
  EstadoOrden.TECNICO_FINALIZO,
  EstadoOrden.CANCELADO,
  EstadoOrden.REPROGRAMADO,
  EstadoOrden.SIN_CONCRETAR,
];

type NextServiceRecord = Prisma.OrdenServicioGetPayload<{
  select: {
    id: true;
    fechaVisita: true;
    horaInicio: true;
    servicioId: true;
    estadoServicio: true;
    tipoVisita: true;
    urgencia: true;
    direccionTexto: true;
    serviciosSeleccionados: true;
    servicio: {
      select: {
        id: true;
        nombre: true;
      };
    };
    cliente: {
      select: {
        nombre: true;
        apellido: true;
        razonSocial: true;
      };
    };
  };
}>;

@Injectable()
export class MobileOperatorDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contabilidadService: ContabilidadService,
  ) {}

  async getDashboard(
    scope: OperatorDashboardScope,
  ): Promise<OperatorDashboardResponseDto> {
    const now = new Date();
    const startOfToday = startOfBogotaDayUtc(now);
    const endOfToday = endOfBogotaDayUtc(now);

    const [
      serviciosHoy,
      programadosHoy,
      finalizadosHoy,
      pendientesLiquidarHoy,
      canceladosHoy,
      pendientes,
      vencidos,
      urgentesPendientes,
      criticasPendientes,
      serviciosSinEvidencia,
      evidenciasSubidasHoy,
      activeSession,
      cashCollection,
      nextService,
    ] = await Promise.all([
      this.prisma.ordenServicio.count({
        where: this.buildOrderWhere(scope, {
          fechaVisita: { gte: startOfToday, lte: endOfToday },
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOpenOrderWhere(scope, {
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: EstadoOrden.PROGRAMADO,
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOrderWhere(scope, {
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: EstadoOrden.LIQUIDADO,
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOrderWhere(scope, {
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOrderWhere(scope, {
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: EstadoOrden.CANCELADO,
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOpenOrderWhere(scope),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOpenOrderWhere(scope, {
          fechaVisita: { lt: startOfToday },
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOpenOrderWhere(scope, {
          urgencia: UrgenciaOrden.ALTA,
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOpenOrderWhere(scope, {
          urgencia: UrgenciaOrden.CRITICA,
        }),
      }),
      this.prisma.ordenServicio.count({
        where: {
          ...this.buildOrderWhere(scope, {
            estadoServicio: {
              in: [EstadoOrden.TECNICO_FINALIZO, EstadoOrden.LIQUIDADO],
            },
            evidencias: {
              none: {},
            },
          }),
          OR: [{ evidenciaPath: null }, { evidenciaPath: '' }],
        },
      }),
      this.prisma.evidenciaServicio.count({
        where: {
          tenantId: scope.tenantId,
          createdAt: { gte: startOfToday, lte: endOfToday },
          ordenServicio: {
            tecnicoId: scope.membershipId,
            empresaId: { in: scope.empresaIds },
            deletedAt: null,
            ...(scope.zonaIds?.length ? { zonaId: { in: scope.zonaIds } } : {}),
          },
        },
      }),
      this.prisma.sesionActividad.findFirst({
        where: {
          tenantId: scope.tenantId,
          membershipId: scope.membershipId,
          empresaId: { in: scope.empresaIds },
          fechaFin: null,
        },
        orderBy: [{ fechaInicio: 'desc' }],
      }),
      this.contabilidadService.getOperatorCashCollectionSummary(
        scope.tenantId,
        scope.membershipId,
        scope.empresaIds,
      ),
      this.prisma.ordenServicio.findFirst({
        where: this.buildOpenOrderWhere(scope, {
          fechaVisita: { gte: startOfToday },
        }),
        orderBy: [
          { fechaVisita: 'asc' },
          { horaInicio: 'asc' },
          { createdAt: 'asc' },
        ],
        select: {
          id: true,
          fechaVisita: true,
          horaInicio: true,
          servicioId: true,
          estadoServicio: true,
          tipoVisita: true,
          urgencia: true,
          direccionTexto: true,
          serviciosSeleccionados: true,
          servicio: {
            select: {
              id: true,
              nombre: true,
            },
          },
          cliente: {
            select: {
              nombre: true,
              apellido: true,
              razonSocial: true,
            },
          },
        },
      }),
    ]);

    return {
      summary: {
        serviciosHoy,
        programadosHoy,
        finalizadosHoy,
        pendientesLiquidarHoy,
        canceladosHoy,
      },
      queue: {
        pendientes,
        vencidos,
      },
      alerts: {
        urgentesPendientes,
        criticasPendientes,
        serviciosSinEvidencia,
        evidenciasSubidasHoy,
      },
      activity: this.buildActivity(activeSession),
      cashCollection: this.buildCashCollection(cashCollection),
      nextService: this.buildNextService(nextService),
    };
  }

  private buildOrderWhere(
    scope: OperatorDashboardScope,
    extraWhere: Prisma.OrdenServicioWhereInput = {},
  ): Prisma.OrdenServicioWhereInput {
    return {
      tenantId: scope.tenantId,
      tecnicoId: scope.membershipId,
      empresaId: { in: scope.empresaIds },
      deletedAt: null,
      ...(scope.zonaIds?.length ? { zonaId: { in: scope.zonaIds } } : {}),
      ...extraWhere,
    };
  }

  private buildOpenOrderWhere(
    scope: OperatorDashboardScope,
    extraWhere: Prisma.OrdenServicioWhereInput = {},
  ): Prisma.OrdenServicioWhereInput {
    return this.buildOrderWhere(scope, {
      estadoServicio: { notIn: CLOSED_ORDER_STATUSES },
      ...extraWhere,
    });
  }

  private buildActivity(
    session: {
      fechaInicio: Date;
      fechaFin: Date | null;
      duracionMin: number | null;
      tiempoInactivo: number;
      updatedAt: Date;
    } | null,
  ): OperatorDashboardActivityDto {
    if (!session) {
      return {
        sesionActiva: false,
        horaInicioJornada: null,
        duracionMin: 0,
        tiempoInactivo: 0,
      };
    }

    return {
      sesionActiva: session.fechaFin === null,
      horaInicioJornada: session.fechaInicio.toISOString(),
      duracionMin: this.getSessionDurationMinutes(session),
      tiempoInactivo: session.tiempoInactivo,
    };
  }

  private buildCashCollection(summary: {
    saldoPendiente: number;
    ordenesPendientesCount: number;
    ultimaTransferencia: Date | string | null;
    diasSinTransferir: number;
  }): OperatorDashboardCashCollectionDto {
    return {
      saldoPendiente: Number(summary.saldoPendiente || 0),
      ordenesPendientesCount: Number(summary.ordenesPendientesCount || 0),
      ultimaTransferencia: summary.ultimaTransferencia
        ? new Date(summary.ultimaTransferencia).toISOString()
        : null,
      diasSinTransferir: Number(summary.diasSinTransferir || 0),
    };
  }

  private getSessionDurationMinutes(session: {
    fechaInicio: Date;
    fechaFin: Date | null;
    duracionMin: number | null;
    updatedAt: Date;
  }): number {
    if (
      session.fechaFin &&
      typeof session.duracionMin === 'number' &&
      session.duracionMin >= 0
    ) {
      return session.duracionMin;
    }

    const endReference = session.fechaFin || session.updatedAt || new Date();

    return Math.max(
      0,
      Math.round(
        (endReference.getTime() - session.fechaInicio.getTime()) / 60000,
      ),
    );
  }

  private buildNextService(
    service: NextServiceRecord | null,
  ): OperatorDashboardNextServiceDto | null {
    if (!service?.fechaVisita) {
      return null;
    }

    return {
      id: service.id,
      fechaVisita: service.fechaVisita.toISOString(),
      horaInicio: service.horaInicio?.toISOString() ?? null,
      horaVisita: service.horaInicio?.toISOString() ?? null,
      estadoServicio: service.estadoServicio,
      tipoVisita: service.tipoVisita ?? null,
      urgencia: service.urgencia ?? null,
      clienteNombre: this.resolveClientName(service.cliente),
      direccion: service.direccionTexto?.trim() || null,
      servicioId: service.servicioId,
      servicio: service.servicio
        ? {
            id: service.servicio.id,
            nombre: service.servicio.nombre,
          }
        : null,
      serviciosSeleccionados: service.serviciosSeleccionados ?? null,
    };
  }

  private resolveClientName(cliente: {
    nombre: string | null;
    apellido: string | null;
    razonSocial: string | null;
  }): string | null {
    const razonSocial = this.normalizeClientText(cliente.razonSocial);
    if (razonSocial) {
      return razonSocial;
    }

    const fullName = [cliente.nombre, cliente.apellido]
      .map((value) => this.normalizeClientText(value))
      .filter((value): value is string => !!value)
      .join(' ')
      .trim();

    return fullName || null;
  }

  private normalizeClientText(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    return trimmed.toLowerCase() === 'no concretado' ? null : trimmed;
  }
}
