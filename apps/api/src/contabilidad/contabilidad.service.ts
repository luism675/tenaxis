import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  EstadoConsignacion,
  EstadoOrden,
  EstadoPagoOrden,
  MetodoPagoBase,
  Prisma,
  Role,
} from '../generated/client/client';
import { GenerateMonitoringPayrollDto } from './generate-monitoring-payroll.dto';
import {
  addBogotaDaysUtc,
  parseBogotaDateToUtcEnd,
  parseBogotaDateToUtcStart,
  startOfBogotaMonthUtc,
  endOfBogotaMonthUtc,
  startOfPreviousBogotaMonthUtc,
  endOfPreviousBogotaMonthUtc,
} from '../common/utils/timezone.util';

const ACCOUNTING_KPI_CUTOFF_UTC = new Date('2026-01-01T05:00:00.000Z');
const DEFAULT_FINANCE_PAGE_SIZE = 10;
const MAX_FINANCE_PAGE_SIZE = 100;

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

interface DesglosePagoItem {
  metodo: string;
  monto: number;
}

export interface RecaudoTecnicoPendiente {
  id: string;
  nombre: string;
  apellido: string;
  saldoPendiente: number;
  ordenesPendientesCount: number;
  ultimaTransferencia: Date | null;
  diasSinTransferir: number;
  ordenesIds: string[];
  declaraciones: Array<{
    ordenId: string;
    valorDeclarado: number;
    fechaDeclaracion: Date | null;
    tipo: 'DECLARADO' | 'IMPLICITO';
  }>;
}

@Injectable()
export class ContabilidadService {
  private readonly logger = new Logger(ContabilidadService.name);

  constructor(
    private prisma: PrismaService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private resolvePagination(options?: PaginationOptions, total?: number) {
    const requestedPage = Math.max(1, Math.trunc(Number(options?.page) || 1));
    const pageSize = Math.min(
      MAX_FINANCE_PAGE_SIZE,
      Math.max(
        1,
        Math.trunc(Number(options?.pageSize) || DEFAULT_FINANCE_PAGE_SIZE),
      ),
    );
    const totalPages =
      total === undefined
        ? undefined
        : Math.max(1, Math.ceil(total / pageSize));
    const page = totalPages
      ? Math.min(requestedPage, totalPages)
      : requestedPage;

    return {
      page,
      pageSize,
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }

  private toPaginatedResult<T>(
    items: T[],
    total: number,
    options?: PaginationOptions,
  ): PaginatedResult<T> {
    const { page, pageSize } = this.resolvePagination(options, total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: items,
      meta: {
        page,
        pageSize,
        total,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
    };
  }

  private paginateArray<T>(
    items: T[],
    options?: PaginationOptions,
  ): PaginatedResult<T> {
    const { page, pageSize, skip, take } = this.resolvePagination(
      options,
      items.length,
    );
    return this.toPaginatedResult(
      items.slice(skip, skip + take),
      items.length,
      { page, pageSize },
    );
  }

  private resolveManualDate(date?: string): Date | undefined {
    if (!date) return undefined;

    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? `${date}T12:00:00.000-05:00`
      : date;
    const parsed = new Date(normalizedDate);

    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private async notifyPaymentReminder(params: {
    tenantId: string;
    membershipId: string;
  }) {
    try {
      const sent =
        await this.pushNotificationsService.sendPaymentReminderNotification({
          tenantId: params.tenantId,
          membershipId: params.membershipId,
        });

      if (sent) {
        this.logger.log(
          `PUSH_CARTERA: Recordatorio push enviado al membership ${params.membershipId} del tenant ${params.tenantId}.`,
        );
        return true;
      }

      this.logger.warn(
        `PUSH_CARTERA: No se confirmó envío para membership ${params.membershipId} del tenant ${params.tenantId}. Revisá los logs de PushNotificationsService.`,
      );
      return false;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `PUSH_CARTERA: Falló el envío push para membership ${params.membershipId} del tenant ${params.tenantId}: ${message}`,
        stack,
      );
      return false;
    }
  }

  async sendManualCashCollectionReminder(
    tenantId: string,
    membershipId: string,
    empresaId?: string,
  ) {
    const recaudos = await this.buildRecaudoTecnicos(
      tenantId,
      empresaId ? [empresaId] : undefined,
    );
    const target = recaudos.find((item) => item.id === membershipId);

    if (!target || Number(target.saldoPendiente || 0) <= 0) {
      this.logger.warn(
        `PUSH_CARTERA_MANUAL: Membership ${membershipId} sin cartera pendiente en tenant ${tenantId}${empresaId ? ` y empresa ${empresaId}` : ''}.`,
      );
      throw new BadRequestException(
        'El operador no tiene cartera pendiente para recordar.',
      );
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: membershipId,
        tenantId,
        activo: true,
        role: Role.OPERADOR,
        pushToken: { not: null },
        empresaMemberships: empresaId
          ? {
              some: {
                empresaId,
                activo: true,
              },
            }
          : undefined,
      },
      select: {
        id: true,
        pushToken: true,
      },
    });

    if (!membership?.pushToken?.trim()) {
      this.logger.warn(
        `PUSH_CARTERA_MANUAL: Membership ${membershipId} sin Expo Push Token registrado en tenant ${tenantId}.`,
      );
      throw new ConflictException(
        'El operador no tiene un Expo Push Token registrado.',
      );
    }

    const sent = await this.notifyPaymentReminder({
      tenantId,
      membershipId,
    });

    if (!sent) {
      throw new ConflictException(
        'No se pudo confirmar el envío del recordatorio. Revisá los logs de push.',
      );
    }

    this.logger.log(
      `PUSH_CARTERA_MANUAL: Recordatorio enviado manualmente a membership ${membershipId} del tenant ${tenantId}. saldo=${Number(target.saldoPendiente || 0)}, ordenes=${Number(target.ordenesPendientesCount || 0)}.`,
    );

    return {
      success: true,
      membershipId,
      saldoPendiente: Number(target.saldoPendiente || 0),
      ordenesPendientesCount: Number(target.ordenesPendientesCount || 0),
      message: `Recordatorio enviado a ${target.nombre} ${target.apellido}.`,
    };
  }

  private normalizeDesglosePago(raw: unknown): DesglosePagoItem[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    return raw.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const record = item as Record<string, unknown>;
      const metodo = record.metodo;
      const monto = Number(record.monto ?? 0);

      if (typeof metodo !== 'string' || Number.isNaN(monto)) {
        return [];
      }

      return [
        {
          metodo: metodo as MetodoPagoBase,
          monto,
        },
      ];
    });
  }

  private isCashPaymentMethod(metodo: string): boolean {
    return (
      metodo === MetodoPagoBase.EFECTIVO ||
      metodo === ('EFECTIVO_AVANCE' as MetodoPagoBase)
    );
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private normalizeOptionalMoney(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const amount = Number(value);
    return Number.isFinite(amount) ? this.roundMoney(amount) : Number.NaN;
  }

  private syncDeclaredCashInBreakdown(
    breakdown: DesglosePagoItem[],
    declaredCashAmount: number,
  ): DesglosePagoItem[] {
    if (!Number.isFinite(declaredCashAmount) || declaredCashAmount <= 0) {
      return breakdown;
    }

    const firstCashIndex = breakdown.findIndex((line) =>
      this.isCashPaymentMethod(line.metodo),
    );

    if (firstCashIndex === -1) {
      return [
        ...breakdown,
        { metodo: MetodoPagoBase.EFECTIVO, monto: declaredCashAmount },
      ];
    }

    const currentCashAmount = breakdown
      .filter((line) => this.isCashPaymentMethod(line.metodo))
      .reduce((sum, line) => sum + Number(line.monto || 0), 0);

    if (Math.abs(currentCashAmount - declaredCashAmount) < 0.01) {
      return breakdown;
    }

    const cashAmountOutsideFirstLine = breakdown
      .filter(
        (line, index) =>
          index !== firstCashIndex && this.isCashPaymentMethod(line.metodo),
      )
      .reduce((sum, line) => sum + Number(line.monto || 0), 0);
    const firstCashLineAmount = Math.max(
      declaredCashAmount - cashAmountOutsideFirstLine,
      0,
    );

    return breakdown.map((line, index) =>
      index === firstCashIndex ? { ...line, monto: firstCashLineAmount } : line,
    );
  }

  private normalizeDateRange(fechaInicio: string, fechaFin: string) {
    const start =
      parseBogotaDateToUtcStart(fechaInicio.slice(0, 10)) ||
      new Date(fechaInicio);
    const endInclusive =
      parseBogotaDateToUtcEnd(fechaFin.slice(0, 10)) || new Date(fechaFin);
    const parsedEndStart =
      parseBogotaDateToUtcStart(fechaFin.slice(0, 10)) || new Date(fechaFin);
    const endExclusive =
      fechaFin.length <= 10
        ? addBogotaDaysUtc(parsedEndStart, 1)
        : new Date(endInclusive.getTime() + 1);

    return { start, endInclusive, endExclusive };
  }

  private getSessionDurationMinutes(session: {
    fechaInicio: Date;
    fechaFin: Date | null;
    duracionMin: number | null;
    updatedAt?: Date;
  }) {
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

  private mapNominaDecimalFields<
    T extends {
      totalValorPagado: unknown;
      totalRepuestos: unknown;
      totalIva: unknown;
      baseComisionable: unknown;
      porcentajeAplicado: unknown;
      salarioFijo: unknown;
      totalComisiones: unknown;
      totalPagar: unknown;
    },
  >(nomina: T) {
    return {
      ...nomina,
      totalValorPagado: Number(nomina.totalValorPagado || 0),
      totalRepuestos: Number(nomina.totalRepuestos || 0),
      totalIva: Number(nomina.totalIva || 0),
      baseComisionable: Number(nomina.baseComisionable || 0),
      porcentajeAplicado:
        nomina.porcentajeAplicado === null ||
        nomina.porcentajeAplicado === undefined
          ? null
          : Number(nomina.porcentajeAplicado),
      salarioFijo:
        nomina.salarioFijo === null || nomina.salarioFijo === undefined
          ? null
          : Number(nomina.salarioFijo),
      totalComisiones: Number(nomina.totalComisiones || 0),
      totalPagar: Number(nomina.totalPagar || 0),
    };
  }

  private async buildMonitoringPayrollItems(
    tenantId: string,
    empresaId: string,
    start: Date,
    endExclusive: Date,
    membershipIds?: string[],
  ) {
    const sessions = await this.prisma.sesionActividad.findMany({
      where: {
        tenantId,
        empresaId,
        fechaInicio: { gte: start, lt: endExclusive },
        ...(membershipIds?.length
          ? { membershipId: { in: membershipIds } }
          : {}),
      },
      include: {
        membership: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
            cuentasPago: {
              where: {
                tenantId,
                empresaId,
              },
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
      orderBy: [{ membershipId: 'asc' }, { fechaInicio: 'asc' }],
    });

    const groups = new Map<
      string,
      {
        membershipId: string;
        empresaId: string;
        role: string;
        nombre: string;
        apellido: string;
        valorHora: number | null;
        sesionesCerradas: number;
        sesionesAbiertas: number;
        minutosBrutos: number;
        minutosInactivos: number;
        minutosPagables: number;
      }
    >();

    sessions.forEach((session) => {
      const current = groups.get(session.membershipId) || {
        membershipId: session.membershipId,
        empresaId: session.empresaId,
        role: session.membership.role,
        nombre: session.membership.user.nombre,
        apellido: session.membership.user.apellido,
        valorHora:
          session.membership.cuentasPago[0]?.valorHora !== null &&
          session.membership.cuentasPago[0]?.valorHora !== undefined
            ? Number(session.membership.cuentasPago[0].valorHora)
            : null,
        sesionesCerradas: 0,
        sesionesAbiertas: 0,
        minutosBrutos: 0,
        minutosInactivos: 0,
        minutosPagables: 0,
      };

      const duracionMin = this.getSessionDurationMinutes(session);
      const minutosPagables = Math.max(0, duracionMin - session.tiempoInactivo);

      if (session.fechaFin) {
        current.sesionesCerradas += 1;
      } else {
        current.sesionesAbiertas += 1;
      }

      current.minutosBrutos += duracionMin;
      current.minutosInactivos += session.tiempoInactivo;
      current.minutosPagables += minutosPagables;

      groups.set(session.membershipId, current);
    });

    return Array.from(groups.values()).map((item) => {
      const horasPagables = Number((item.minutosPagables / 60).toFixed(2));
      const pagoEstimado =
        item.valorHora !== null
          ? Number((horasPagables * item.valorHora).toFixed(2))
          : 0;
      const estado =
        item.sesionesCerradas === 0
          ? 'SIN_SESIONES_CERRADAS'
          : item.valorHora === null
            ? 'SIN_VALOR_HORA'
            : 'OK';

      return {
        ...item,
        horasPagables,
        pagoEstimado,
        estado,
      };
    });
  }

  private async buildRecaudoTecnicos(
    tenantId: string,
    empresaIds?: string[],
  ): Promise<RecaudoTecnicoPendiente[]> {
    const empresaFilter =
      empresaIds && empresaIds.length > 0 ? { in: empresaIds } : undefined;

    // 1. Buscar órdenes en efectivo que ya pasaron su fecha y NO han sido declaradas (deuda implícita)
    // Esto asegura que si un técnico no cierra la orden, administración igual vea la deuda.
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Hasta el final de hoy

    const ordenesNoDeclaradas = await this.prisma.ordenServicio.findMany({
      where: {
        tenantId,
        empresaId: empresaFilter,
        tecnicoId: { not: null },
        fechaVisita: { gte: ACCOUNTING_KPI_CUTOFF_UTC, lte: today },
        estadoPago: { in: ['PENDIENTE', 'PARCIAL'] },
        // No deben tener declaración asociada todavía
        declaracionEfectivo: null,
      },
      select: {
        id: true,
        tecnicoId: true,
        fechaVisita: true,
        desglosePago: true,
      },
    });

    // Procesar montos de órdenes no declaradas
    const deudasImplicitasPorTecnico = new Map<
      string,
      Array<{ ordenId: string; valor: number; fecha: Date | null }>
    >();

    ordenesNoDeclaradas.forEach((orden) => {
      const breakdown = this.normalizeDesglosePago(orden.desglosePago);
      const cashAmount = breakdown
        .filter((line) => this.isCashPaymentMethod(line.metodo))
        .reduce((sum, l) => sum + Number(l.monto || 0), 0);

      if (cashAmount > 0 && orden.tecnicoId) {
        const current = deudasImplicitasPorTecnico.get(orden.tecnicoId) || [];
        current.push({
          ordenId: orden.id,
          valor: cashAmount,
          fecha: orden.fechaVisita,
        });
        deudasImplicitasPorTecnico.set(orden.tecnicoId, current);
      }
    });

    const declaracionesPendientes =
      await this.prisma.declaracionEfectivo.findMany({
        where: {
          tenantId,
          empresaId: empresaFilter,
          consignado: false,
          orden: {
            OR: [
              { fechaVisita: { gte: ACCOUNTING_KPI_CUTOFF_UTC } },
              { createdAt: { gte: ACCOUNTING_KPI_CUTOFF_UTC } },
            ],
          },
        },
        select: {
          tecnicoId: true,
          valorDeclarado: true,
          fechaDeclaracion: true,
          ordenId: true,
        },
      });

    const declaracionesPendientesPorTecnico = new Map<
      string,
      Array<{
        ordenId: string;
        valorDeclarado: number;
        fechaDeclaracion: Date | null;
      }>
    >();

    declaracionesPendientes.forEach((declaracion) => {
      if (!declaracion.tecnicoId) {
        return;
      }

      const current =
        declaracionesPendientesPorTecnico.get(declaracion.tecnicoId) || [];
      current.push({
        ordenId: declaracion.ordenId,
        valorDeclarado: Number(declaracion.valorDeclarado || 0),
        fechaDeclaracion: declaracion.fechaDeclaracion,
      });
      declaracionesPendientesPorTecnico.set(declaracion.tecnicoId, current);
    });

    const tecnicoIdsPendientes = Array.from(
      new Set([
        ...deudasImplicitasPorTecnico.keys(),
        ...declaracionesPendientes
          .map((declaracion) => declaracion.tecnicoId)
          .filter((id): id is string => Boolean(id)),
      ]),
    );

    if (tecnicoIdsPendientes.length === 0) {
      return [];
    }

    // 2. Buscar los memberships activos que realmente tengan saldo pendiente o declaraciones.
    const tecnicos = await this.prisma.tenantMembership.findMany({
      where: {
        tenantId,
        activo: true,
        id: { in: tecnicoIdsPendientes },
        // Si hay empresaId, filtrar por los que pertenecen a esa empresa
        empresaMemberships: empresaFilter
          ? { some: { empresaId: empresaFilter, activo: true } }
          : undefined,
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
          },
        },
        // Obtener la última consignación realizada para saber la fecha
        consignacionesTecnico: {
          where: {
            empresaId: empresaFilter,
          },
          orderBy: {
            fechaConsignacion: 'desc',
          },
          take: 1,
          select: {
            fechaConsignacion: true,
          },
        },
      },
    });

    return tecnicos.map((t) => {
      // Unificar declaraciones explícitas con deudas implícitas
      const implicitas = deudasImplicitasPorTecnico.get(t.id) || [];
      const declaradas = declaracionesPendientesPorTecnico.get(t.id) || [];

      const todasLasDeclaraciones: RecaudoTecnicoPendiente['declaraciones'] = [
        ...declaradas.map((d) => ({
          ordenId: d.ordenId,
          valorDeclarado: Number(d.valorDeclarado),
          fechaDeclaracion: d.fechaDeclaracion,
          tipo: 'DECLARADO' as const,
        })),
        ...implicitas.map((i) => ({
          ordenId: i.ordenId,
          valorDeclarado: i.valor,
          fechaDeclaracion: i.fecha,
          tipo: 'IMPLICITO' as const, // Indica que es un recaudo detectado por fecha, no por declaración
        })),
      ];

      const saldoPendiente = todasLasDeclaraciones.reduce(
        (sum, d) => sum + d.valorDeclarado,
        0,
      );

      // Calcular días de atraso basados en la declaración más vieja pendiente
      let diasSinTransferir = 0;
      const declaracionesConFecha = todasLasDeclaraciones.filter(
        (d) => d.fechaDeclaracion,
      );

      if (declaracionesConFecha.length > 0) {
        const fechas = declaracionesConFecha.map((d) =>
          new Date(d.fechaDeclaracion!).getTime(),
        );
        const fechaMasVieja = Math.min(...fechas);
        diasSinTransferir = Math.floor(
          (new Date().getTime() - fechaMasVieja) / (1000 * 3600 * 24),
        );
      }

      return {
        id: t.id,
        nombre: t.user.nombre,
        apellido: t.user.apellido,
        saldoPendiente,
        ordenesPendientesCount: todasLasDeclaraciones.length,
        ordenesIds: todasLasDeclaraciones.map((d) => d.ordenId),
        declaraciones: todasLasDeclaraciones,
        ultimaTransferencia:
          t.consignacionesTecnico[0]?.fechaConsignacion || null,
        diasSinTransferir,
      };
    });
  }

  @Cron('0 0 9 * * *', { timeZone: 'America/Bogota' })
  async sendDailyCashCollectionReminders() {
    this.logger.log(
      'PUSH_CARTERA_CRON: Iniciando recordatorios diarios de cartera.',
    );

    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    let tenantsProcessed = 0;
    let eligibleOperators = 0;
    let notificationsSent = 0;
    let skippedWithoutToken = 0;

    for (const tenant of tenants) {
      try {
        const recaudos = await this.buildRecaudoTecnicos(tenant.id);
        const overdueMembershipIds = recaudos
          .filter(
            (item) =>
              Number(item.saldoPendiente || 0) > 0 &&
              item.diasSinTransferir >= 1,
          )
          .map((item) => item.id);

        if (overdueMembershipIds.length === 0) {
          this.logger.log(
            `PUSH_CARTERA_CRON: Tenant ${tenant.id} sin operadores elegibles para recordatorio.`,
          );
          tenantsProcessed += 1;
          continue;
        }

        const membershipsWithPushToken =
          await this.prisma.tenantMembership.findMany({
            where: {
              tenantId: tenant.id,
              id: { in: overdueMembershipIds },
              activo: true,
              role: Role.OPERADOR,
              pushToken: { not: null },
            },
            select: {
              id: true,
              pushToken: true,
            },
          });

        const eligibleMemberships = membershipsWithPushToken.filter(
          (membership) => membership.pushToken?.trim().length,
        );

        eligibleOperators += eligibleMemberships.length;
        skippedWithoutToken +=
          overdueMembershipIds.length - eligibleMemberships.length;

        for (const membership of eligibleMemberships) {
          const sent = await this.notifyPaymentReminder({
            tenantId: tenant.id,
            membershipId: membership.id,
          });

          if (sent) {
            notificationsSent += 1;
          }
        }

        this.logger.log(
          `PUSH_CARTERA_CRON: Tenant ${tenant.id} procesado. Elegibles=${eligibleMemberships.length}, sinToken=${overdueMembershipIds.length - eligibleMemberships.length}.`,
        );
        tenantsProcessed += 1;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;

        this.logger.error(
          `PUSH_CARTERA_CRON: Error procesando tenant ${tenant.id}: ${message}`,
          stack,
        );
      }
    }

    this.logger.log(
      `PUSH_CARTERA_CRON: Finalizado. tenantsProcesados=${tenantsProcessed}, operadoresElegibles=${eligibleOperators}, enviados=${notificationsSent}, sinToken=${skippedWithoutToken}.`,
    );
  }

  async getRecaudoTecnicos(tenantId: string, empresaId?: string) {
    return this.buildRecaudoTecnicos(
      tenantId,
      empresaId ? [empresaId] : undefined,
    );
  }

  async getRecaudoTecnicosPaginated(
    tenantId: string,
    empresaId: string | undefined,
    pagination: PaginationOptions,
  ) {
    const recaudos = await this.buildRecaudoTecnicos(
      tenantId,
      empresaId ? [empresaId] : undefined,
    );

    return this.paginateArray(recaudos, pagination);
  }

  async getOperatorCashCollectionSummary(
    tenantId: string,
    tecnicoId: string,
    empresaIds: string[],
  ) {
    const recaudos = await this.buildRecaudoTecnicos(tenantId, empresaIds);
    const recaudo = recaudos.find((item) => item.id === tecnicoId);

    return {
      saldoPendiente: Number(recaudo?.saldoPendiente || 0),
      ordenesPendientesCount: Number(recaudo?.ordenesPendientesCount || 0),
      ultimaTransferencia: recaudo?.ultimaTransferencia || null,
      diasSinTransferir: Number(recaudo?.diasSinTransferir || 0),
    };
  }

  async registrarConsignacion(
    tenantId: string,
    creadoPorId: string,
    data: {
      tecnicoId: string;
      empresaId: string;
      valorConsignado?: number;
      valorEntregado?: number;
      valorAdelanto?: number;
      referenciaBanco: string;
      comprobantePath: string;
      confirmarEfectivoFisico: boolean;
      ordenIds: string[];
      fechaConsignacion: string;
      observacion?: string;
    },
  ) {
    if (data.confirmarEfectivoFisico !== true) {
      throw new BadRequestException(
        'Confirmá que esta consignación corresponde a efectivo físico recibido por el técnico. Si fue transferencia del cliente, reclasificá el método de pago antes de conciliar.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const ordenIds = [...new Set(data.ordenIds.filter(Boolean))];
      if (ordenIds.length === 0) {
        throw new BadRequestException(
          'Debes seleccionar al menos una orden para conciliar',
        );
      }

      const ordenes = await tx.ordenServicio.findMany({
        where: {
          tenantId,
          empresaId: data.empresaId,
          tecnicoId: data.tecnicoId,
          deletedAt: null,
          id: { in: ordenIds },
        },
        select: {
          id: true,
          tenantId: true,
          empresaId: true,
          tecnicoId: true,
          valorCotizado: true,
          valorPagado: true,
          comprobantePago: true,
          desglosePago: true,
          declaracionEfectivo: {
            select: {
              valorDeclarado: true,
              consignado: true,
              tecnicoId: true,
            },
          },
          consignacionOrden: {
            select: { id: true },
          },
        },
      });

      if (ordenes.length !== ordenIds.length) {
        throw new ConflictException(
          'Hay órdenes que no pertenecen al técnico, empresa o alcance actual',
        );
      }

      const ordenesPreparadas = ordenes.map((orden) => {
        const breakdown = this.normalizeDesglosePago(orden.desglosePago);
        const cashAmountFromBreakdown = breakdown
          .filter((line) => this.isCashPaymentMethod(line.metodo))
          .reduce((sum, line) => sum + Number(line.monto || 0), 0);
        const declaredCashAmount = Number(
          orden.declaracionEfectivo?.valorDeclarado ?? 0,
        );
        const cashAmount =
          cashAmountFromBreakdown > 0
            ? cashAmountFromBreakdown
            : Number.isFinite(declaredCashAmount)
              ? declaredCashAmount
              : 0;
        const transferAmount = breakdown
          .filter((line) => line.metodo === MetodoPagoBase.TRANSFERENCIA)
          .reduce((sum, line) => sum + Number(line.monto || 0), 0);

        if (cashAmount <= 0) {
          throw new ConflictException(
            `La orden ${orden.id} no tiene efectivo conciliable`,
          );
        }

        if (orden.consignacionOrden) {
          throw new ConflictException(
            `La orden ${orden.id} ya tiene una consignación registrada`,
          );
        }

        const declaracion = orden.declaracionEfectivo;
        if (declaracion?.consignado) {
          throw new ConflictException(
            `La orden ${orden.id} ya fue conciliada previamente`,
          );
        }

        if (
          declaracion?.tecnicoId &&
          declaracion.tecnicoId !== data.tecnicoId
        ) {
          throw new ConflictException(
            `La orden ${orden.id} no pertenece al técnico seleccionado`,
          );
        }

        const valorEsperado = Number(
          declaracion?.valorDeclarado ?? cashAmount ?? 0,
        );

        if (valorEsperado <= 0) {
          throw new ConflictException(
            `La orden ${orden.id} no tiene un valor conciliable válido`,
          );
        }

        return {
          orden,
          declaracion,
          cashAmount,
          transferAmount,
          valorEsperado,
          syncedBreakdown: this.syncDeclaredCashInBreakdown(
            breakdown,
            valorEsperado,
          ),
        };
      });

      const totalEsperado = ordenesPreparadas.reduce(
        (sum, item) => sum + item.valorEsperado,
        0,
      );
      const totalEsperadoRedondeado = this.roundMoney(totalEsperado);

      if (totalEsperadoRedondeado <= 0) {
        throw new ConflictException(
          'No se encontró saldo conciliable para las órdenes seleccionadas',
        );
      }

      const valorAdelanto =
        this.normalizeOptionalMoney(data.valorAdelanto) ?? 0;
      const valorEntregado =
        this.normalizeOptionalMoney(data.valorEntregado) ??
        this.roundMoney(totalEsperadoRedondeado - valorAdelanto);

      if (
        !Number.isFinite(valorAdelanto) ||
        !Number.isFinite(valorEntregado) ||
        valorAdelanto < 0 ||
        valorEntregado < 0
      ) {
        throw new BadRequestException(
          'El valor entregado y el adelanto deben ser montos válidos',
        );
      }

      if (valorAdelanto > totalEsperadoRedondeado) {
        throw new BadRequestException(
          'El adelanto no puede superar el total seleccionado',
        );
      }

      const totalExplicado = this.roundMoney(valorEntregado + valorAdelanto);
      if (Math.abs(totalExplicado - totalEsperadoRedondeado) >= 0.01) {
        throw new BadRequestException(
          'El valor entregado más el adelanto debe coincidir con el total seleccionado',
        );
      }

      // 1. Crear la consignación global
      const consignacion = await tx.consignacionEfectivo.create({
        data: {
          tenantId,
          empresaId: data.empresaId,
          tecnicoId: data.tecnicoId,
          creadoPorId: creadoPorId,
          valorConsignado: valorEntregado,
          referenciaBanco: data.referenciaBanco,
          comprobantePath: data.comprobantePath,
          fechaConsignacion: new Date(data.fechaConsignacion),
          estado: EstadoConsignacion.PENDIENTE,
          observacion: data.observacion,
        },
      });

      if (valorAdelanto > 0) {
        await tx.anticipos.create({
          data: {
            tenantId,
            empresaId: data.empresaId,
            membershipId: data.tecnicoId,
            consignacionId: consignacion.id,
            monto: valorAdelanto,
            razon: `Adelanto registrado en recaudo ${data.referenciaBanco}`,
          },
        });
      }

      // 2. Vincular con cada orden y actualizar declaración
      for (const item of ordenesPreparadas) {
        const {
          orden,
          declaracion,
          cashAmount,
          transferAmount,
          syncedBreakdown,
        } = item;

        await tx.consignacionOrden.create({
          data: {
            tenantId,
            empresaId: data.empresaId,
            consignacionId: consignacion.id,
            ordenId: orden.id,
          },
        });

        // Marcar declaración como consignada (o crearla si no existía por ser deuda implícita)
        if (declaracion) {
          await tx.declaracionEfectivo.update({
            where: { ordenId: orden.id },
            data: { consignado: true },
          });
        } else {
          if (!orden.tecnicoId) {
            throw new ConflictException(
              `La orden ${orden.id} no tiene técnico asignado para crear la declaración`,
            );
          }

          await tx.declaracionEfectivo.create({
            data: {
              tenantId: orden.tenantId,
              empresaId: orden.empresaId,
              ordenId: orden.id,
              tecnicoId: orden.tecnicoId,
              valorDeclarado: cashAmount,
              evidenciaPath: 'CONCILIADO_SIN_DECLARACION_PREVIA',
              observacion:
                'Conciliación directa desde administración (no declarada por técnico)',
              consignado: true,
            },
          });
        }

        // Obtener datos actuales de la orden para validación de montos
        let soportes: Prisma.InputJsonValue[] = [];
        if (orden.comprobantePago) {
          const legacySupportType =
            transferAmount > 0
              ? 'TRANSFERENCIA_CLIENTE_LEGACY'
              : 'CONSIGNACION_TECNICO_LEGACY';
          if (Array.isArray(orden.comprobantePago)) {
            soportes = orden.comprobantePago.map((soporte) => {
              if (typeof soporte === 'string') {
                return {
                  tipo: legacySupportType,
                  path: soporte,
                  fecha: new Date().toISOString(),
                };
              }

              if (
                transferAmount <= 0 &&
                soporte &&
                typeof soporte === 'object' &&
                !Array.isArray(soporte) &&
                !('tipo' in soporte)
              ) {
                const soporteRecord = soporte as Record<
                  string,
                  Prisma.JsonValue
                >;
                return {
                  ...soporteRecord,
                  tipo: 'CONSIGNACION_TECNICO_LEGACY',
                };
              }

              return soporte as Prisma.InputJsonValue;
            });
          } else if (typeof orden.comprobantePago === 'string') {
            soportes = [
              {
                tipo: legacySupportType,
                path: orden.comprobantePago,
                fecha: new Date().toISOString(),
              },
            ];
          }
        }

        // Agregar el nuevo comprobante de consignación técnica
        if (data.comprobantePath) {
          soportes.push({
            tipo: 'CONSIGNACION_TECNICO',
            path: data.comprobantePath,
            fecha: new Date().toISOString(),
            referencia: data.referenciaBanco,
          });
        }

        // --- VALIDACIÓN DE CIERRE FINANCIERO ---
        const totalCotizado = Number(orden.valorCotizado || 0);
        const totalPagadoActualmente = Number(orden.valorPagado || 0);
        const totalPagadoTrasConsignacion =
          transferAmount > 0
            ? totalPagadoActualmente
            : Math.max(totalPagadoActualmente, item.valorEsperado);

        // Decidir el nuevo estado de pago
        // Si la orden es solo de efectivo, conciliación puede reparar registros legacy
        // donde valorPagado quedó desfasado respecto al efectivo declarado.
        // Si la orden es mixta, seguimos confiando en valorPagado para no dar por
        // conciliadas transferencias que todavía no están validadas.
        const nuevoEstadoPago =
          totalPagadoTrasConsignacion >= totalCotizado
            ? EstadoPagoOrden.CONCILIADO
            : EstadoPagoOrden.PARCIAL;

        // Actualizar estado de la orden
        await tx.ordenServicio.update({
          where: { id: orden.id },
          data: {
            estadoPago: nuevoEstadoPago,
            valorPagado:
              totalPagadoTrasConsignacion !== totalPagadoActualmente
                ? totalPagadoTrasConsignacion
                : undefined,
            estadoServicio:
              nuevoEstadoPago === EstadoPagoOrden.CONCILIADO
                ? EstadoOrden.LIQUIDADO
                : undefined,
            liquidadoAt:
              nuevoEstadoPago === EstadoPagoOrden.CONCILIADO
                ? new Date()
                : undefined,
            liquidadoPorId:
              nuevoEstadoPago === EstadoPagoOrden.CONCILIADO
                ? creadoPorId
                : undefined,
            comprobantePago: soportes,
            desglosePago: syncedBreakdown as unknown as Prisma.InputJsonValue,
          },
        });
      }

      return consignacion;
    });
  }

  async getAccountingBalance(
    tenantId: string,
    empresaId?: string,
    categoryPagination?: PaginationOptions,
  ) {
    const now = new Date();

    const startOfMonth = startOfBogotaMonthUtc(now);
    const endOfMonth = endOfBogotaMonthUtc(now);

    const startOfPrevMonth = startOfPreviousBogotaMonthUtc(now);
    const endOfPrevMonth = endOfPreviousBogotaMonthUtc(now);

    const commonWhere = {
      tenantId,
      ...(empresaId && { empresaId }),
    };

    const [
      ingresosActual,
      ingresosPrev,
      egresosActual,
      egresosPrev,
      egresosPorCategoria,
      totalNominas,
    ] = await Promise.all([
      // 1. Ingresos Mes Actual (Matched with DashboardService)
      this.prisma.ordenServicio.aggregate({
        where: {
          ...commonWhere,
          estadoServicio: 'LIQUIDADO',
          fechaVisita: { gte: startOfMonth, lte: endOfMonth },
          OR: [
            { estadoPago: { in: ['PAGADO', 'CONCILIADO'] } },
            { valorPagado: { gt: 0 } },
          ],
        },
        _sum: { valorPagado: true },
      }),
      // 2. Ingresos Mes Anterior (Matched with DashboardService)
      this.prisma.ordenServicio.aggregate({
        where: {
          ...commonWhere,
          estadoServicio: 'LIQUIDADO',
          fechaVisita: { gte: startOfPrevMonth, lte: endOfPrevMonth },
          OR: [
            { estadoPago: { in: ['PAGADO', 'CONCILIADO'] } },
            { valorPagado: { gt: 0 } },
          ],
        },
        _sum: { valorPagado: true },
      }),
      this.prisma.egresos.aggregate({
        where: {
          ...commonWhere,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { monto: true },
      }),
      this.prisma.egresos.aggregate({
        where: {
          ...commonWhere,
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
        _sum: { monto: true },
      }),
      this.prisma.egresos.groupBy({
        by: ['categoria'],
        where: {
          ...commonWhere,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { monto: true },
      }),
      this.prisma.nomina.aggregate({
        where: {
          ...commonWhere,
          fechaGeneracion: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { totalPagar: true },
      }),
    ]);

    const totalIngresos = Number(ingresosActual._sum.valorPagado || 0);
    const totalIngresosPrev = Number(ingresosPrev._sum.valorPagado || 0);
    const totalEgresosEfectivos = Number(egresosActual._sum.monto || 0);
    const totalNominasMonto = Number(totalNominas._sum.totalPagar || 0);

    const totalEgresos = totalEgresosEfectivos + totalNominasMonto;
    const totalEgresosPrev = Number(egresosPrev._sum.monto || 0); // Note: Simple comparison for now

    const ingresosChange =
      totalIngresosPrev > 0
        ? ((totalIngresos - totalIngresosPrev) / totalIngresosPrev) * 100
        : 0;

    const egresosChange =
      totalEgresosPrev > 0
        ? ((totalEgresos - totalEgresosPrev) / totalEgresosPrev) * 100
        : 0;

    // Build category breakdown
    const categories: { label: string; value: number; color: string }[] = [];

    if (totalNominasMonto > 0) {
      categories.push({
        label: 'Nómina',
        value:
          totalEgresos > 0
            ? Math.round((totalNominasMonto / totalEgresos) * 100)
            : 0,
        color: 'bg-primary',
      });
    }

    const colors = [
      'bg-amber-500',
      'bg-emerald-500',
      'bg-blue-500',
      'bg-purple-500',
    ];
    egresosPorCategoria.forEach((group, index) => {
      const monto = Number(group._sum?.monto || 0);
      if (monto > 0) {
        categories.push({
          label: group.categoria || 'General',
          value:
            totalEgresos > 0 ? Math.round((monto / totalEgresos) * 100) : 0,
          color: colors[index % colors.length],
        });
      }
    });

    // Ensure it sums to something if empty
    if (categories.length === 0) {
      categories.push({ label: 'Sin Gastos', value: 0, color: 'bg-muted' });
    }

    const paginatedCategories = categoryPagination
      ? this.paginateArray(categories, categoryPagination)
      : null;

    return {
      ingresos: {
        total: totalIngresos,
        change: Math.round(ingresosChange * 10) / 10,
      },
      egresos: {
        total: totalEgresos,
        change: Math.round(egresosChange * 10) / 10,
      },
      utilidad: {
        total: totalIngresos - totalEgresos,
        change: Math.round((ingresosChange - egresosChange) * 10) / 10,
      },
      categorias: paginatedCategories?.data ?? categories,
      ...(paginatedCategories && { categoriasMeta: paginatedCategories.meta }),
    };
  }

  async getEgresos(tenantId: string, empresaId?: string) {
    return this.prisma.egresos.findMany({
      where: {
        tenantId,
        ...(empresaId && { empresaId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });
  }

  async getEgresosPaginated(
    tenantId: string,
    empresaId: string | undefined,
    pagination: PaginationOptions,
  ) {
    const where = {
      tenantId,
      ...(empresaId && { empresaId }),
    };
    const total = await this.prisma.egresos.count({ where });
    const { page, pageSize, skip, take } = this.resolvePagination(
      pagination,
      total,
    );

    const items = await this.prisma.egresos.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });

    return this.toPaginatedResult(items, total, { page, pageSize });
  }

  async getNominas(tenantId: string, empresaId?: string) {
    const nominas = await this.prisma.nomina.findMany({
      where: {
        tenantId,
        ...(empresaId && { empresaId }),
      },
      orderBy: { fechaGeneracion: 'desc' },
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });

    return nominas.map((nomina) => this.mapNominaDecimalFields(nomina));
  }

  async getNominasPaginated(
    tenantId: string,
    empresaId: string | undefined,
    pagination: PaginationOptions,
  ) {
    const where = {
      tenantId,
      ...(empresaId && { empresaId }),
    };
    const total = await this.prisma.nomina.count({ where });
    const { page, pageSize, skip, take } = this.resolvePagination(
      pagination,
      total,
    );

    const nominas = await this.prisma.nomina.findMany({
      where,
      orderBy: { fechaGeneracion: 'desc' },
      skip,
      take,
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });

    return this.toPaginatedResult(
      nominas.map((nomina) => this.mapNominaDecimalFields(nomina)),
      total,
      { page, pageSize },
    );
  }

  async getAnticipos(tenantId: string, empresaId?: string) {
    return this.prisma.anticipos.findMany({
      where: {
        tenantId,
        ...(empresaId && { empresaId }),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });
  }

  async getAnticiposPaginated(
    tenantId: string,
    empresaId: string | undefined,
    pagination: PaginationOptions,
  ) {
    const where = {
      tenantId,
      ...(empresaId && { empresaId }),
    };
    const total = await this.prisma.anticipos.count({ where });
    const { page, pageSize, skip, take } = this.resolvePagination(
      pagination,
      total,
    );

    const items = await this.prisma.anticipos.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });

    return this.toPaginatedResult(items, total, { page, pageSize });
  }

  async createEgreso(
    tenantId: string,
    data: {
      titulo: string;
      monto: number;
      razon: string;
      categoria: string;
      membershipId?: string;
      empresaId: string;
    },
  ) {
    return this.prisma.egresos.create({
      data: {
        tenantId,
        empresaId: data.empresaId,
        titulo: data.titulo,
        monto: data.monto,
        razon: data.razon,
        categoria: data.categoria || 'GENERAL',
        membershipId: data.membershipId || null,
      },
    });
  }

  async createAnticipo(
    tenantId: string,
    data: {
      membershipId: string;
      monto: number;
      razon?: string;
      empresaId: string;
      fechaAnticipo?: string;
    },
  ) {
    const createdAt = this.resolveManualDate(data.fechaAnticipo);

    return this.prisma.anticipos.create({
      data: {
        tenantId,
        empresaId: data.empresaId,
        membershipId: data.membershipId,
        monto: data.monto,
        razon: data.razon,
        ...(createdAt && { createdAt }),
      },
    });
  }

  private parseBogotaDateTime(fecha: string, hora: string) {
    return new Date(`${fecha}T${hora}:00.000-05:00`);
  }

  private parseRequiredBogotaDateStart(fecha: string) {
    const parsed = parseBogotaDateToUtcStart(fecha);
    if (!parsed) {
      throw new BadRequestException('Fecha inválida para el turno.');
    }
    return parsed;
  }

  private formatBogotaYmd(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private formatBogotaHm(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private calculateShiftHours(
    horaEntrada: Date,
    horaSalida: Date,
    descansoMinutos: number,
  ) {
    const salida =
      horaSalida.getTime() < horaEntrada.getTime()
        ? new Date(horaSalida.getTime() + 24 * 60 * 60 * 1000)
        : horaSalida;
    const totalMinutes =
      (salida.getTime() - horaEntrada.getTime()) / 60000 - descansoMinutos;

    return Math.max(0, Number((totalMinutes / 60).toFixed(2)));
  }

  private async getMembershipHourlyRate(params: {
    tenantId: string;
    empresaId: string;
    membershipId: string;
  }) {
    const cuentaPago = await this.prisma.cuentasPago.findFirst({
      where: {
        tenantId: params.tenantId,
        empresaId: params.empresaId,
        membershipId: params.membershipId,
        valorHora: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });

    return cuentaPago?.valorHora ? Number(cuentaPago.valorHora) : 0;
  }

  private async getCuentaCobroEvidenceUrl(path?: string | null) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return (
      (await this.supabaseService.getSignedUrl(path, 'tenaxis-docs')) || ''
    );
  }

  private async mapTurno(turno: {
    id: string;
    fecha: Date;
    horaEntrada: Date;
    horaSalida: Date;
    tiempoDescanso: number;
    observaciones: string | null;
    fotoEntrada: string | null;
    fotoSalida: string | null;
    valorTotal: Prisma.Decimal | number | null;
    createdAt: Date;
  }) {
    const totalHoras = this.calculateShiftHours(
      turno.horaEntrada,
      turno.horaSalida,
      turno.tiempoDescanso,
    );

    const [fotoLlegadaUrl, fotoSalidaUrl] = await Promise.all([
      this.getCuentaCobroEvidenceUrl(turno.fotoEntrada),
      this.getCuentaCobroEvidenceUrl(turno.fotoSalida),
    ]);

    return {
      id: turno.id,
      fecha: this.formatBogotaYmd(turno.fecha),
      horaEntrada: this.formatBogotaHm(turno.horaEntrada),
      horaSalida: this.formatBogotaHm(turno.horaSalida),
      descansoMinutos: turno.tiempoDescanso,
      observacion: turno.observaciones || '',
      fotoLlegada: turno.fotoEntrada || '',
      fotoSalida: turno.fotoSalida || '',
      fotoLlegadaUrl,
      fotoSalidaUrl,
      totalHoras,
      valorGenerado: Number(turno.valorTotal || 0),
      createdAt: turno.createdAt.toISOString(),
    };
  }

  private mapUserSnapshot(membership?: {
    id: string;
    user?: {
      nombre?: string | null;
      apellido?: string | null;
      tipoDocumento?: string | null;
      numeroDocumento?: string | null;
      email?: string | null;
    };
    cuentasPago?: Array<{
      banco: string;
      tipoCuenta: string;
      numeroCuenta: string;
      valorHora: Prisma.Decimal | number | null;
    }>;
  }) {
    const cuentaPago = membership?.cuentasPago?.[0];

    return {
      id: membership?.id,
      membershipId: membership?.id,
      nombre: membership?.user?.nombre || '',
      apellido: membership?.user?.apellido || '',
      tipoDocumento: membership?.user?.tipoDocumento || '',
      numeroDocumento: membership?.user?.numeroDocumento || '',
      email: membership?.user?.email || '',
      banco: cuentaPago?.banco || '',
      tipoCuenta: cuentaPago?.tipoCuenta || '',
      numeroCuenta: cuentaPago?.numeroCuenta || '',
      valorHora:
        cuentaPago?.valorHora !== null && cuentaPago?.valorHora !== undefined
          ? Number(cuentaPago.valorHora)
          : undefined,
    };
  }

  async getCuentaCobroDashboard(
    tenantId: string,
    membershipId: string,
    empresaId: string,
  ) {
    const [turnos, periodos, valorHora, membership] = await Promise.all([
      this.prisma.turno.findMany({
        where: {
          tenantId,
          empresaId,
          membershipId,
          cuentaCobroId: null,
        },
        orderBy: [{ fecha: 'desc' }, { horaEntrada: 'desc' }],
      }),
      this.prisma.cuentaCobro.findMany({
        where: {
          tenantId,
          empresaId,
          membershipId,
        },
        include: {
          turnos: { orderBy: [{ fecha: 'asc' }, { horaEntrada: 'asc' }] },
          membership: {
            include: {
              user: true,
              cuentasPago: {
                where: { empresaId },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.getMembershipHourlyRate({ tenantId, empresaId, membershipId }),
      this.prisma.tenantMembership.findFirst({
        where: { id: membershipId, tenantId },
        include: {
          user: true,
          cuentasPago: {
            where: { empresaId },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const mappedTurnos = await Promise.all(
      turnos.map((turno) => this.mapTurno(turno)),
    );
    const mappedPeriodos = await Promise.all(
      periodos.map(async (periodo) => {
        const shifts = await Promise.all(
          periodo.turnos.map((turno) => this.mapTurno(turno)),
        );
        return {
          id: periodo.id,
          fechaInicio: this.formatBogotaYmd(periodo.fechaInicio),
          fechaFin: this.formatBogotaYmd(periodo.fechaFin),
          fechaCierre: periodo.createdAt.toISOString(),
          numDias: shifts.length,
          valorTotal: Number(periodo.valorTotal || 0),
          horasTotales: shifts.reduce(
            (total, shift) => total + shift.totalHoras,
            0,
          ),
          shifts,
          userSnapshot: this.mapUserSnapshot(periodo.membership),
        };
      }),
    );

    return {
      empresaId,
      valorHora,
      userSnapshot: this.mapUserSnapshot(membership || undefined),
      turnos: mappedTurnos,
      periodos: mappedPeriodos,
    };
  }

  async createCuentaCobroTurno(
    tenantId: string,
    membershipId: string,
    data: {
      empresaId: string;
      fecha: string;
      horaEntrada: string;
      horaSalida: string;
      descansoMinutos: number;
      observacion?: string;
      fotoLlegada?: string;
      fotoSalida?: string;
    },
  ) {
    const horaEntrada = this.parseBogotaDateTime(data.fecha, data.horaEntrada);
    const horaSalida = this.parseBogotaDateTime(data.fecha, data.horaSalida);
    const totalHoras = this.calculateShiftHours(
      horaEntrada,
      horaSalida,
      data.descansoMinutos,
    );
    const valorHora = await this.getMembershipHourlyRate({
      tenantId,
      empresaId: data.empresaId,
      membershipId,
    });

    const turno = await this.prisma.turno.create({
      data: {
        tenantId,
        empresaId: data.empresaId,
        membershipId,
        fecha: this.parseRequiredBogotaDateStart(data.fecha),
        horaEntrada,
        horaSalida,
        tiempoDescanso: data.descansoMinutos,
        observaciones: data.observacion || null,
        fotoEntrada: data.fotoLlegada || null,
        fotoSalida: data.fotoSalida || null,
        valorTotal: new Prisma.Decimal((totalHoras * valorHora).toFixed(2)),
      },
    });

    return this.mapTurno(turno);
  }

  async updateCuentaCobroTurno(
    tenantId: string,
    membershipId: string,
    turnoId: string,
    data: {
      empresaId: string;
      fecha: string;
      horaEntrada: string;
      horaSalida: string;
      descansoMinutos: number;
      observacion?: string;
      fotoLlegada?: string;
      fotoSalida?: string;
    },
  ) {
    const existing = await this.prisma.turno.findFirst({
      where: {
        id: turnoId,
        tenantId,
        membershipId,
        empresaId: data.empresaId,
        cuentaCobroId: null,
      },
    });

    if (!existing) {
      throw new BadRequestException('Turno no encontrado en el corte actual.');
    }

    const horaEntrada = this.parseBogotaDateTime(data.fecha, data.horaEntrada);
    const horaSalida = this.parseBogotaDateTime(data.fecha, data.horaSalida);
    const totalHoras = this.calculateShiftHours(
      horaEntrada,
      horaSalida,
      data.descansoMinutos,
    );
    const valorHora = await this.getMembershipHourlyRate({
      tenantId,
      empresaId: data.empresaId,
      membershipId,
    });

    const turno = await this.prisma.turno.update({
      where: { id: turnoId },
      data: {
        fecha: this.parseRequiredBogotaDateStart(data.fecha),
        horaEntrada,
        horaSalida,
        tiempoDescanso: data.descansoMinutos,
        observaciones: data.observacion || null,
        fotoEntrada: data.fotoLlegada || null,
        fotoSalida: data.fotoSalida || null,
        valorTotal: new Prisma.Decimal((totalHoras * valorHora).toFixed(2)),
      },
    });

    return this.mapTurno(turno);
  }

  async deleteCuentaCobroTurno(
    tenantId: string,
    membershipId: string,
    turnoId: string,
  ) {
    const existing = await this.prisma.turno.findFirst({
      where: {
        id: turnoId,
        tenantId,
        membershipId,
        cuentaCobroId: null,
      },
    });

    if (!existing) {
      throw new BadRequestException('Turno no encontrado en el corte actual.');
    }

    await this.prisma.turno.delete({ where: { id: turnoId } });
    return { success: true };
  }

  async closeCuentaCobroPeriod(
    tenantId: string,
    membershipId: string,
    empresaId: string,
  ) {
    const turnos = await this.prisma.turno.findMany({
      where: {
        tenantId,
        empresaId,
        membershipId,
        cuentaCobroId: null,
      },
      orderBy: [{ fecha: 'asc' }, { horaEntrada: 'asc' }],
    });

    if (turnos.length === 0) {
      throw new BadRequestException('No hay turnos para cerrar el corte.');
    }

    const valorTotal = turnos.reduce(
      (total, turno) => total + Number(turno.valorTotal || 0),
      0,
    );

    const periodo = await this.prisma.$transaction(async (tx) => {
      const cuentaCobro = await tx.cuentaCobro.create({
        data: {
          tenantId,
          empresaId,
          membershipId,
          fechaInicio: turnos[0].fecha,
          fechaFin: turnos[turnos.length - 1].fecha,
          valorTotal: new Prisma.Decimal(valorTotal.toFixed(2)),
        },
      });

      await tx.turno.updateMany({
        where: {
          id: { in: turnos.map((turno) => turno.id) },
          tenantId,
          empresaId,
          membershipId,
          cuentaCobroId: null,
        },
        data: { cuentaCobroId: cuentaCobro.id },
      });

      return tx.cuentaCobro.findUniqueOrThrow({
        where: { id: cuentaCobro.id },
        include: {
          turnos: { orderBy: [{ fecha: 'asc' }, { horaEntrada: 'asc' }] },
          membership: {
            include: {
              user: true,
              cuentasPago: {
                where: { empresaId },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });
    });

    const shifts = await Promise.all(
      periodo.turnos.map((turno) => this.mapTurno(turno)),
    );
    return {
      id: periodo.id,
      fechaInicio: this.formatBogotaYmd(periodo.fechaInicio),
      fechaFin: this.formatBogotaYmd(periodo.fechaFin),
      fechaCierre: periodo.createdAt.toISOString(),
      numDias: shifts.length,
      valorTotal: Number(periodo.valorTotal || 0),
      horasTotales: shifts.reduce(
        (total, shift) => total + shift.totalHoras,
        0,
      ),
      shifts,
      userSnapshot: this.mapUserSnapshot(periodo.membership),
    };
  }

  async createCuentaCobroEvidenceUploadUrl(
    tenantId: string,
    membershipId: string,
    data: {
      empresaId: string;
      fileName: string;
      tipo: 'llegada' | 'salida';
    },
  ) {
    const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    const path = `${tenantId}/cuenta-cobro/${data.empresaId}/${membershipId}/${Date.now()}-${data.tipo}-${safeName}`;
    const signedUpload = await this.supabaseService.createSignedUploadUrl(
      path,
      'tenaxis-docs',
      true,
    );

    if (!signedUpload) {
      throw new BadRequestException(
        'No se pudo preparar la carga de evidencia.',
      );
    }

    return {
      ...signedUpload,
      publicUrl: this.supabaseService.getPublicUrl(path) || undefined,
    };
  }

  async generatePayrollFromMonitoring(
    tenantId: string,
    dto: GenerateMonitoringPayrollDto,
  ) {
    const { start, endInclusive, endExclusive } = this.normalizeDateRange(
      dto.fechaInicio,
      dto.fechaFin,
    );
    const requestedMembershipIds =
      dto.includeAllEligible || !dto.membershipIds?.length
        ? undefined
        : dto.membershipIds;

    const previewItems = await this.buildMonitoringPayrollItems(
      tenantId,
      dto.empresaId,
      start,
      endExclusive,
      requestedMembershipIds,
    );

    const eligibleItems = previewItems.filter((item) => item.estado === 'OK');

    if (eligibleItems.length === 0) {
      throw new BadRequestException(
        'No hay colaboradores elegibles para generar nómina desde monitoreo',
      );
    }

    const targetItems = requestedMembershipIds?.length
      ? eligibleItems.filter((item) =>
          requestedMembershipIds.includes(item.membershipId),
        )
      : eligibleItems;

    if (targetItems.length === 0) {
      throw new BadRequestException(
        'Los membershipIds enviados no tienen sesiones cerradas con valorHora configurado',
      );
    }

    const existingPayrolls = await this.prisma.nomina.findMany({
      where: {
        tenantId,
        empresaId: dto.empresaId,
        membershipId: {
          in: targetItems.map((item) => item.membershipId),
        },
        fechaInicio: start,
        fechaFin: endInclusive,
      },
      select: {
        id: true,
        membershipId: true,
      },
    });

    if (existingPayrolls.length > 0) {
      throw new ConflictException({
        message:
          'Ya existen nóminas para algunos colaboradores en el rango seleccionado',
        duplicates: existingPayrolls,
      });
    }

    const observaciones = dto.observaciones?.trim()
      ? dto.observaciones.trim()
      : `Generada desde monitoreo para el rango ${dto.fechaInicio} - ${dto.fechaFin}`;

    const createdPayrolls = await this.prisma.$transaction(async (tx) => {
      const created: Array<ReturnType<typeof this.mapNominaDecimalFields>> = [];

      for (const item of targetItems) {
        const payroll = await tx.nomina.create({
          data: {
            tenantId,
            empresaId: dto.empresaId,
            membershipId: item.membershipId,
            fechaInicio: start,
            fechaFin: endInclusive,
            totalServicios: item.sesionesCerradas,
            totalValorPagado: item.pagoEstimado,
            totalRepuestos: 0,
            totalIva: 0,
            baseComisionable: item.pagoEstimado,
            porcentajeAplicado: null,
            salarioFijo: null,
            totalComisiones: 0,
            totalPagar: item.pagoEstimado,
            estado: 'BORRADOR',
            observaciones,
          },
          include: {
            membership: {
              include: {
                user: {
                  select: { nombre: true, apellido: true },
                },
              },
            },
          },
        });

        created.push(this.mapNominaDecimalFields(payroll));
      }

      return created;
    });

    return {
      success: true,
      generated: createdPayrolls,
      summary: {
        total: createdPayrolls.length,
        totalPagar: Number(
          createdPayrolls
            .reduce((acc, payroll) => acc + payroll.totalPagar, 0)
            .toFixed(2),
        ),
      },
    };
  }
}
