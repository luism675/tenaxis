import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MonitoringScope } from './types';
import { Prisma } from '../generated/client/client';
import {
  MonitoringAuditsQueryDto,
  MonitoringAuditStatusFilter,
} from './dto/monitoring.dto';
import {
  MonitoringPayrollPreviewItem,
  MonitoringPayrollPreviewResponse,
} from './payroll.types';
import {
  addBogotaDaysUtc,
  startOfBogotaDayUtc,
  parseBogotaDateToUtcStart,
} from '../common/utils/timezone.util';

type SessionWithUser = Prisma.SesionActividadGetPayload<{
  include: {
    membership: {
      include: {
        user: {
          select: {
            nombre: true;
            apellido: true;
            email: true;
          };
        };
      };
    };
    logs: true;
  };
}>;

interface GroupedSession extends SessionWithUser {
  originalInicio: Date;
  originalFin: Date | null;
}

type PayrollSession = Prisma.SesionActividadGetPayload<{
  include: {
    membership: {
      include: {
        user: {
          select: {
            nombre: true;
            apellido: true;
          };
        };
        cuentasPago: true;
      };
    };
  };
}>;

type AuditWithMembership = Prisma.AuditoriaGetPayload<{
  include: {
    membership: {
      include: {
        user: {
          select: {
            nombre: true;
            apellido: true;
            email: true;
          };
        };
      };
    };
  };
}>;

type AuditLookupBucketName =
  | 'clientes'
  | 'servicios'
  | 'memberships'
  | 'direcciones'
  | 'metodosPago'
  | 'entidadesFinancieras';

type AuditLookupBuckets = Record<AuditLookupBucketName, Set<string>>;
type AuditLookupMaps = Record<AuditLookupBucketName, Map<string, string>>;

const AUDIT_LOOKUP_FIELD_MAP: Record<string, AuditLookupBucketName> = {
  clienteId: 'clientes',
  servicioId: 'servicios',
  creadoPorId: 'memberships',
  tecnicoId: 'memberships',
  liquidadoPorId: 'memberships',
  deletedById: 'memberships',
  membershipId: 'memberships',
  createdByMembershipId: 'memberships',
  adminId: 'memberships',
  direccionId: 'direcciones',
  metodoPagoId: 'metodosPago',
  entidadFinancieraId: 'entidadesFinancieras',
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MonitoringService {
  constructor(private prisma: PrismaService) {}

  private buildTenantWhere(scope: MonitoringScope) {
    return scope.tenantId ? { tenantId: scope.tenantId } : {};
  }

  private createEmptyAuditLookupBuckets(): AuditLookupBuckets {
    return {
      clientes: new Set<string>(),
      servicios: new Set<string>(),
      memberships: new Set<string>(),
      direcciones: new Set<string>(),
      metodosPago: new Set<string>(),
      entidadesFinancieras: new Set<string>(),
    };
  }

  private createEmptyAuditLookupMaps(): AuditLookupMaps {
    return {
      clientes: new Map<string, string>(),
      servicios: new Map<string, string>(),
      memberships: new Map<string, string>(),
      direcciones: new Map<string, string>(),
      metodosPago: new Map<string, string>(),
      entidadesFinancieras: new Map<string, string>(),
    };
  }

  private isAuditPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private isUuidLike(value: string): boolean {
    return UUID_REGEX.test(value);
  }

  private collectAuditLookupIds(
    value: unknown,
    buckets: AuditLookupBuckets,
  ): void {
    if (Array.isArray(value)) {
      value.forEach((item) => this.collectAuditLookupIds(item, buckets));
      return;
    }

    if (!this.isAuditPlainObject(value)) {
      return;
    }

    Object.entries(value).forEach(([key, currentValue]) => {
      if (typeof currentValue === 'string' && this.isUuidLike(currentValue)) {
        const bucket = AUDIT_LOOKUP_FIELD_MAP[key];
        if (bucket) {
          buckets[bucket].add(currentValue);
        }
      }

      this.collectAuditLookupIds(currentValue, buckets);
    });
  }

  private buildClienteDisplayLabel(cliente: {
    nombre: string | null;
    apellido: string | null;
    razonSocial: string | null;
  }): string {
    const fullName = [cliente.nombre, cliente.apellido]
      .filter(Boolean)
      .join(' ')
      .trim();

    return cliente.razonSocial?.trim() || fullName || 'Cliente sin nombre';
  }

  private buildDireccionDisplayLabel(direccion: {
    direccion: string;
    nombreSede: string | null;
    barrio: string | null;
    municipio: string | null;
  }): string {
    const extras = [direccion.nombreSede, direccion.barrio, direccion.municipio]
      .filter(Boolean)
      .join(' • ');

    return extras ? `${direccion.direccion} (${extras})` : direccion.direccion;
  }

  private resolveAuditLookupValue(
    key: string,
    currentValue: string,
    lookupMaps: AuditLookupMaps,
  ): string {
    const bucket = AUDIT_LOOKUP_FIELD_MAP[key];
    if (!bucket) {
      return currentValue;
    }

    return lookupMaps[bucket].get(currentValue) || currentValue;
  }

  private enrichAuditValueForDisplay(
    value: unknown,
    lookupMaps: AuditLookupMaps,
  ): unknown {
    if (Array.isArray(value)) {
      return value.map((item) =>
        this.enrichAuditValueForDisplay(item, lookupMaps),
      );
    }

    if (!this.isAuditPlainObject(value)) {
      return value;
    }

    const enrichedEntries = Object.entries(value).map(([key, currentValue]) => {
      if (typeof currentValue === 'string' && this.isUuidLike(currentValue)) {
        return [
          key,
          this.resolveAuditLookupValue(key, currentValue, lookupMaps),
        ];
      }

      return [key, this.enrichAuditValueForDisplay(currentValue, lookupMaps)];
    });

    return Object.fromEntries(enrichedEntries);
  }

  private async buildAuditLookupMaps(
    scope: MonitoringScope,
    buckets: AuditLookupBuckets,
  ): Promise<AuditLookupMaps> {
    const tenantWhere = this.buildTenantWhere(scope);
    const lookupMaps = this.createEmptyAuditLookupMaps();

    if (buckets.clientes.size > 0) {
      const clientes = await this.prisma.cliente.findMany({
        where: {
          ...tenantWhere,
          id: { in: Array.from(buckets.clientes) },
        },
        select: {
          id: true,
          nombre: true,
          apellido: true,
          razonSocial: true,
        },
      });

      clientes.forEach((cliente) => {
        lookupMaps.clientes.set(
          cliente.id,
          this.buildClienteDisplayLabel(cliente),
        );
      });
    }

    if (buckets.servicios.size > 0) {
      const servicios = await this.prisma.servicio.findMany({
        where: {
          ...tenantWhere,
          id: { in: Array.from(buckets.servicios) },
        },
        select: {
          id: true,
          nombre: true,
        },
      });

      servicios.forEach((servicio) => {
        lookupMaps.servicios.set(servicio.id, servicio.nombre);
      });
    }

    if (buckets.memberships.size > 0) {
      const memberships = await this.prisma.tenantMembership.findMany({
        where: {
          ...tenantWhere,
          id: { in: Array.from(buckets.memberships) },
        },
        select: {
          id: true,
          username: true,
          user: {
            select: {
              nombre: true,
              apellido: true,
            },
          },
        },
      });

      memberships.forEach((membership) => {
        lookupMaps.memberships.set(
          membership.id,
          this.buildUserOptionLabel({
            username: membership.username ?? null,
            nombre: membership.user?.nombre ?? null,
            apellido: membership.user?.apellido ?? null,
          }),
        );
      });
    }

    if (buckets.direcciones.size > 0) {
      const direcciones = await this.prisma.direccion.findMany({
        where: {
          ...tenantWhere,
          id: { in: Array.from(buckets.direcciones) },
        },
        select: {
          id: true,
          direccion: true,
          nombreSede: true,
          barrio: true,
          municipio: true,
        },
      });

      direcciones.forEach((direccion) => {
        lookupMaps.direcciones.set(
          direccion.id,
          this.buildDireccionDisplayLabel(direccion),
        );
      });
    }

    if (buckets.metodosPago.size > 0) {
      const metodosPago = await this.prisma.metodoPago.findMany({
        where: {
          ...tenantWhere,
          id: { in: Array.from(buckets.metodosPago) },
        },
        select: {
          id: true,
          nombre: true,
        },
      });

      metodosPago.forEach((metodoPago) => {
        lookupMaps.metodosPago.set(metodoPago.id, metodoPago.nombre);
      });
    }

    if (buckets.entidadesFinancieras.size > 0) {
      const entidadesFinancieras = await this.prisma.entidadFinanciera.findMany(
        {
          where: {
            ...tenantWhere,
            id: { in: Array.from(buckets.entidadesFinancieras) },
          },
          select: {
            id: true,
            nombre: true,
          },
        },
      );

      entidadesFinancieras.forEach((entidadFinanciera) => {
        lookupMaps.entidadesFinancieras.set(
          entidadFinanciera.id,
          entidadFinanciera.nombre,
        );
      });
    }

    return lookupMaps;
  }

  private async enrichAuditsForDisplay(
    scope: MonitoringScope,
    audits: AuditWithMembership[],
  ): Promise<AuditWithMembership[]> {
    if (audits.length === 0) {
      return audits;
    }

    const lookupBuckets = this.createEmptyAuditLookupBuckets();

    audits.forEach((audit) => {
      this.collectAuditLookupIds(audit.detalles, lookupBuckets);
    });

    const lookupMaps = await this.buildAuditLookupMaps(scope, lookupBuckets);

    return audits.map((audit) => ({
      ...audit,
      detalles: this.enrichAuditValueForDisplay(
        audit.detalles,
        lookupMaps,
      ) as Prisma.JsonValue,
    }));
  }

  private getDateRange(dateStr?: string, startDate?: string, endDate?: string) {
    if (startDate && endDate) {
      const start = parseBogotaDateToUtcStart(startDate);
      const parsedEnd = parseBogotaDateToUtcStart(endDate);
      if (start && parsedEnd) {
        return { start, end: addBogotaDaysUtc(parsedEnd, 1) };
      }
    }

    if (dateStr) {
      const start = parseBogotaDateToUtcStart(dateStr);
      if (start) {
        const end = addBogotaDaysUtc(start, 1);
        return { start, end };
      }
    }
    const start = startOfBogotaDayUtc(new Date());
    const end = addBogotaDaysUtc(start, 1);
    return { start, end };
  }

  private buildSessionWhere(
    scope: MonitoringScope,
    start: Date,
    end: Date,
  ): Prisma.SesionActividadWhereInput {
    const where: Prisma.SesionActividadWhereInput = {
      ...this.buildTenantWhere(scope),
      fechaInicio: { gte: start, lt: end },
    };

    if (scope.empresaIds?.length) {
      where.empresaId = { in: scope.empresaIds };
    }

    if (scope.zonaIds?.length) {
      where.membership = {
        empresaMemberships: {
          some: { zonaId: { in: scope.zonaIds } },
        },
      };
    }

    return where;
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

  private buildPayrollPreview(
    sessions: PayrollSession[],
    date: string,
  ): MonitoringPayrollPreviewResponse {
    const groups = new Map<string, MonitoringPayrollPreviewItem>();

    sessions.forEach((session) => {
      const key = `${session.tenantId}:${session.membershipId}:${session.empresaId}`;
      const cuentaPago =
        session.membership.cuentasPago.find(
          (cuenta) =>
            cuenta.tenantId === session.tenantId &&
            cuenta.empresaId === session.empresaId,
        ) ||
        session.membership.cuentasPago.find(
          (cuenta) =>
            cuenta.tenantId === session.tenantId && cuenta.valorHora !== null,
        );
      const valorHora =
        cuentaPago?.valorHora !== null && cuentaPago?.valorHora !== undefined
          ? Number(cuentaPago.valorHora)
          : null;

      const current = groups.get(key) || {
        membershipId: session.membershipId,
        empresaId: session.empresaId,
        role: session.membership.role,
        nombre: session.membership.user.nombre,
        apellido: session.membership.user.apellido,
        valorHora,
        sesionesCerradas: 0,
        sesionesAbiertas: 0,
        minutosBrutos: 0,
        minutosInactivos: 0,
        minutosPagables: 0,
        horasPagables: 0,
        pagoEstimado: 0,
        estado: 'SIN_SESIONES_CERRADAS' as const,
      };

      if (current.valorHora === null && valorHora !== null) {
        current.valorHora = valorHora;
      }

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

      groups.set(key, current);
    });

    const items = Array.from(groups.values())
      .map((item) => {
        const horasPagables = Number((item.minutosPagables / 60).toFixed(2));
        const pagoEstimado =
          item.valorHora !== null
            ? Number((horasPagables * item.valorHora).toFixed(2))
            : 0;
        const estado: MonitoringPayrollPreviewItem['estado'] =
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
      })
      .sort((a, b) =>
        `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`),
      );

    const elegibles = items.filter((item) => item.estado === 'OK');

    return {
      date,
      items,
      summary: {
        totalPersonas: items.length,
        elegibles: elegibles.length,
        conIncidencias: items.length - elegibles.length,
        horasPagables: Number(
          elegibles
            .reduce((acc, item) => acc + item.horasPagables, 0)
            .toFixed(2),
        ),
        totalEstimado: Number(
          elegibles
            .reduce((acc, item) => acc + item.pagoEstimado, 0)
            .toFixed(2),
        ),
      },
    };
  }

  async startSession(
    tenantId: string,
    membershipId: string,
    ip?: string,
    dispositivo?: string,
  ) {
    // 1. Intentar buscar empresa vinculada a la membresía (filtrando por tenant)
    const empresaMembership = await this.prisma.empresaMembership.findFirst({
      where: {
        membershipId,
        empresa: { tenantId },
      },
      select: { empresaId: true },
    });

    let empresaId = empresaMembership?.empresaId;

    // 2. Si no hay vínculo (común en SU_ADMIN), buscar la primera empresa del Tenant
    if (!empresaId) {
      const fallbackEmpresa = await this.prisma.empresa.findFirst({
        where: { tenantId },
        select: { id: true },
      });
      empresaId = fallbackEmpresa?.id;
    }

    if (!empresaId) {
      return null;
    }

    return this.prisma.sesionActividad.create({
      data: {
        tenantId,
        membershipId,
        empresaId,
        ip: ip || 'unknown',
        dispositivo: dispositivo || 'unknown',
        fechaInicio: new Date(),
      },
    });
  }

  async endSession(sesionId: string) {
    const result = await this.prisma.sesionActividad.updateMany({
      where: { id: sesionId },
      data: {
        fechaFin: new Date(),
      },
    });

    return result.count > 0;
  }

  async recordEvent(
    sesionId: string,
    tipo: string,
    descripcion?: string,
    ruta?: string,
  ) {
    const session = await this.prisma.sesionActividad.findUnique({
      where: { id: sesionId },
    });

    if (!session) return null;

    return this.prisma.logEvento.create({
      data: {
        tenantId: session.tenantId,
        empresaId: session.empresaId,
        sesionId,
        tipo,
        descripcion,
        ruta,
      },
    });
  }

  async updateInactivityTime(sesionId: string, minutes: number) {
    const result = await this.prisma.sesionActividad.updateMany({
      where: { id: sesionId },
      data: {
        tiempoInactivo: {
          increment: minutes,
        },
        updatedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  async refreshSession(sesionId: string) {
    const result = await this.prisma.sesionActividad.updateMany({
      where: { id: sesionId },
      data: {
        updatedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  async getPayrollPreview(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<MonitoringPayrollPreviewResponse> {
    const { start, end } = this.getDateRange(date, startDate, endDate);
    const sessions = await this.prisma.sesionActividad.findMany({
      where: this.buildSessionWhere(scope, start, end),
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
              ...(scope.tenantId
                ? {
                    where: {
                      tenantId: scope.tenantId,
                    },
                  }
                : {}),
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        },
      },
      orderBy: [{ membershipId: 'asc' }, { fechaInicio: 'asc' }],
    });

    return this.buildPayrollPreview(
      sessions as PayrollSession[],
      date || startDate || start.toISOString().slice(0, 10),
    );
  }

  async getAlerts(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getDateRange(date, startDate, endDate);

    const commonWhere: Prisma.SesionActividadWhereInput = {
      ...this.buildTenantWhere(scope),
      fechaInicio: { gte: start, lt: end },
    };

    if (scope.empresaIds?.length) {
      commonWhere.empresaId = { in: scope.empresaIds };
    }

    const [inactiveUsers, unexpectedClosures] = await Promise.all([
      // 1. Usuarios con inactividad > 30 min
      this.prisma.sesionActividad.count({
        where: {
          ...commonWhere,
          fechaFin: null,
          tiempoInactivo: { gte: 30 },
        },
      }),
      // 2. Sesiones cerradas inesperadamente (timeouts registrados hoy)
      this.prisma.logEvento.count({
        where: {
          ...this.buildTenantWhere(scope),
          tipo: 'SESSION_TIMEOUT',
          createdAt: { gte: start, lt: end },
          ...(scope.empresaIds?.length
            ? { empresaId: { in: scope.empresaIds } }
            : {}),
        },
      }),
    ]);

    const alerts: {
      id: string;
      type: string;
      title: string;
      severity: string;
    }[] = [];

    if (inactiveUsers > 0) {
      alerts.push({
        id: 'inactivity',
        type: 'warning',
        title: `${inactiveUsers} usuario(s) con inactividad > 30 min`,
        severity: inactiveUsers > 5 ? 'alta' : 'media',
      });
    }

    if (unexpectedClosures > 0) {
      alerts.push({
        id: 'closures',
        type: 'danger',
        title: `${unexpectedClosures} sesiones cerradas por inactividad ${date || (startDate && endDate) ? 'en el rango' : 'hoy'}`,
        severity: 'baja',
      });
    }

    // Nota: Intentos fallidos de login y IP inusual requerirían rastreo adicional
    // que no está implementado en la lógica actual de auth.service.

    return alerts;
  }

  async getOperationMetrics(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getDateRange(date, startDate, endDate);

    const where = this.buildSessionWhere(scope, start, end);

    const sessions = await this.prisma.sesionActividad.findMany({
      where,
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const now = new Date();
    const userMetrics = new Map<
      string,
      { activeMs: number; inactiveMin: number; name: string }
    >();
    let totalTimeToFirstEventMs = 0;
    let sessionsWithEvents = 0;

    sessions.forEach((session) => {
      const end = session.fechaFin || now;
      const durationMs = end.getTime() - session.fechaInicio.getTime();
      const activeMs = Math.max(
        0,
        durationMs - session.tiempoInactivo * 60 * 1000,
      );

      const userId = session.membershipId;
      const current = userMetrics.get(userId) || {
        activeMs: 0,
        inactiveMin: 0,
        name: `${session.membership.user.nombre} ${session.membership.user.apellido}`,
      };

      current.activeMs += activeMs;
      current.inactiveMin += session.tiempoInactivo;
      userMetrics.set(userId, current);

      // MTTFE: Primer evento que no sea LOGIN
      const firstRealEvent = session.logs.find((l) => l.tipo !== 'LOGIN');
      if (firstRealEvent) {
        totalTimeToFirstEventMs +=
          firstRealEvent.createdAt.getTime() - session.fechaInicio.getTime();
        sessionsWithEvents++;
      }
    });

    const userMetricsList = Array.from(userMetrics.values());
    const avgActiveTimeMin =
      userMetricsList.length > 0
        ? userMetricsList.reduce((acc, curr) => acc + curr.activeMs, 0) /
          userMetricsList.length /
          (1000 * 60)
        : 0;

    const topInactivity = userMetricsList
      .sort((a, b) => b.inactiveMin - a.inactiveMin)
      .slice(0, 5)
      .map((u) => ({ name: u.name, minutes: u.inactiveMin }));

    const mttfeSec =
      sessionsWithEvents > 0
        ? totalTimeToFirstEventMs / sessionsWithEvents / 1000
        : 0;

    return {
      avgActiveTimeMin: Math.round(avgActiveTimeMin),
      totalInactivityMin: userMetricsList.reduce(
        (acc, curr) => acc + curr.inactiveMin,
        0,
      ),
      topInactivity,
      mttfeSec: Math.round(mttfeSec),
      userCount: userMetricsList.length,
    };
  }

  async getExecutiveAuditMetrics(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getDateRange(date, startDate, endDate);
    const sevenDaysAgo = startDate ? start : addBogotaDaysUtc(start, -7);

    const commonWhere: Prisma.AuditoriaWhereInput = {
      ...this.buildTenantWhere(scope),
      createdAt: { gte: sevenDaysAgo, lt: end },
    };

    if (scope.empresaIds?.length) {
      commonWhere.empresaId = { in: scope.empresaIds };
    }

    const audits = await this.prisma.auditoria.findMany({
      where: commonWhere,
      include: {
        membership: {
          include: {
            user: { select: { nombre: true, apellido: true } },
          },
        },
      },
    });

    const metrics = {
      today: { created: 0, updated: 0, deleted: 0, total: 0 },
      week: { created: 0, updated: 0, deleted: 0, total: 0 },
      topEntities: new Map<string, number>(),
      topUsers: new Map<string, { count: number; name: string }>(),
      successRate: 100, // Default to 100 if we don't track failures explicitly in logs
    };

    audits.forEach((audit) => {
      const isToday = audit.createdAt >= start;
      const accion = audit.accion.toUpperCase();

      // Count by action
      if (
        accion.includes('CREATE') ||
        accion.includes('CREAR') ||
        accion.includes('CREA')
      ) {
        metrics.week.created++;
        if (isToday) metrics.today.created++;
      } else if (
        accion.includes('UPDATE') ||
        accion.includes('ACTUALIZAR') ||
        accion.includes('EDIT') ||
        accion.includes('ACTUA')
      ) {
        metrics.week.updated++;
        if (isToday) metrics.today.updated++;
      } else if (
        accion.includes('DELETE') ||
        accion.includes('ELIMINAR') ||
        accion.includes('BORRAR') ||
        accion.includes('ELIMIN')
      ) {
        metrics.week.deleted++;
        if (isToday) metrics.today.deleted++;
      }
      metrics.week.total++;
      if (isToday) metrics.today.total++;

      // Count by entity
      const entity = audit.entidad;
      metrics.topEntities.set(
        entity,
        (metrics.topEntities.get(entity) || 0) + 1,
      );

      // Count by user
      if (audit.membership) {
        const userId = audit.membershipId!;
        const userData = metrics.topUsers.get(userId) || {
          count: 0,
          name: `${audit.membership.user.nombre} ${audit.membership.user.apellido}`,
        };
        userData.count++;
        metrics.topUsers.set(userId, userData);
      }
    });

    return {
      today: metrics.today,
      week: metrics.week,
      topEntities: Array.from(metrics.topEntities.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      topUsers: Array.from(metrics.topUsers.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      successRate: metrics.successRate,
    };
  }

  async findAllSessions(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getDateRange(date, startDate, endDate);

    const where = this.buildSessionWhere(scope, start, end);

    const sessions = (await this.prisma.sesionActividad.findMany({
      where,
      include: {
        membership: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
                email: true,
              },
            },
          },
        },
        logs: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        fechaInicio: 'desc',
      },
    })) as SessionWithUser[];

    const userGroups = new Map<string, GroupedSession>();
    const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
    const now = Date.now();

    sessions.forEach((s) => {
      const userId = s.membershipId;
      const currentGroup = userGroups.get(userId);

      if (!currentGroup) {
        userGroups.set(userId, {
          ...s,
          originalInicio: s.fechaInicio,
          originalFin: s.fechaFin,
        });
      } else {
        if (s.fechaInicio < currentGroup.originalInicio) {
          currentGroup.originalInicio = s.fechaInicio;
        }

        // Lógica para determinar el fin de la conexión consolidada:
        // 1. Si el grupo ya está marcado como activo (originalFin === null), lo dejamos así.
        // 2. Si el grupo está marcado como cerrado, pero esta sesión antigua está abierta:
        //    Solo lo volvemos a marcar como activo si la sesión antigua NO es "stale" (inactiva por mucho tiempo).
        if (currentGroup.originalFin !== null) {
          if (s.fechaFin === null) {
            const isStale = now - s.updatedAt.getTime() > STALE_THRESHOLD_MS;
            if (!isStale) {
              currentGroup.originalFin = null;
            }
          } else if (s.fechaFin > currentGroup.originalFin) {
            currentGroup.originalFin = s.fechaFin;
          }
        }
      }
    });

    return Array.from(userGroups.values()).map((group) => ({
      ...group,
      fechaInicio: group.originalInicio,
      fechaFin: group.originalFin,
    }));
  }

  async getMemberLogs(
    scope: MonitoringScope,
    membershipId: string,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getDateRange(date, startDate, endDate);

    const where: Prisma.LogEventoWhereInput = {
      ...this.buildTenantWhere(scope),
      sesion: {
        membershipId,
        fechaInicio: { gte: start, lt: end },
      },
    };

    if (scope.empresaIds?.length) {
      where.empresaId = { in: scope.empresaIds };
    }

    if (scope.zonaIds?.length) {
      where.sesion = {
        ...(where.sesion as Prisma.SesionActividadWhereInput),
        membership: {
          empresaMemberships: {
            some: { zonaId: { in: scope.zonaIds } },
          },
        },
      };
    }

    return this.prisma.logEvento.findMany({
      where,
      include: {
        sesion: {
          select: {
            ip: true,
            dispositivo: true,
            fechaInicio: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getGlobalStats(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getDateRange(date, startDate, endDate);

    const commonWhere = this.buildSessionWhere(scope, start, end);

    const eventsWhere: Prisma.LogEventoWhereInput = {
      ...this.buildTenantWhere(scope),
      createdAt: { gte: start, lt: end },
    };

    if (scope.empresaIds?.length) {
      eventsWhere.empresaId = { in: scope.empresaIds };
    }

    if (scope.zonaIds?.length) {
      eventsWhere.sesion = {
        membership: {
          empresaMemberships: {
            some: { zonaId: { in: scope.zonaIds } },
          },
        },
      };
    }

    const activeThreshold = new Date(Date.now() - 5 * 60 * 1000);

    const [totalEvents, activeSessionsGroup, totalInactivity] =
      await Promise.all([
        this.prisma.logEvento.count({
          where: eventsWhere,
        }),
        this.prisma.sesionActividad.groupBy({
          by: ['membershipId'],
          where: {
            ...commonWhere,
            fechaFin: null,
            updatedAt: { gte: activeThreshold },
          },
        }),
        this.prisma.sesionActividad.aggregate({
          where: commonWhere,
          _sum: { tiempoInactivo: true },
        }),
      ]);

    return {
      totalEvents,
      activeSessions: activeSessionsGroup.length,
      totalInactivity: totalInactivity._sum.tiempoInactivo || 0,
      timestamp: new Date(),
    };
  }

  private buildAuditsBaseWhere(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ): Prisma.AuditoriaWhereInput {
    const { start, end } = this.getDateRange(date, startDate, endDate);

    const where: Prisma.AuditoriaWhereInput = {
      ...this.buildTenantWhere(scope),
      createdAt:
        date || (startDate && endDate) ? { gte: start, lt: end } : undefined,
    };

    if (scope.empresaIds?.length) {
      where.empresaId = { in: scope.empresaIds };
    }

    if (scope.zonaIds?.length) {
      where.membership = {
        empresaMemberships: {
          some: { zonaId: { in: scope.zonaIds } },
        },
      };
    }

    return where;
  }

  private buildAuditsWhere(
    scope: MonitoringScope,
    query: MonitoringAuditsQueryDto,
  ): Prisma.AuditoriaWhereInput {
    const where = this.buildAuditsBaseWhere(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
    const andFilters: Prisma.AuditoriaWhereInput[] = [];

    if (query.entities?.length) {
      andFilters.push({
        entidad: {
          in: query.entities,
        },
      });
    }

    if (query.entityId?.trim()) {
      andFilters.push({
        entidadId: {
          contains: query.entityId.trim(),
          mode: 'insensitive',
        },
      });
    }

    if (query.actions?.length) {
      andFilters.push({
        OR: query.actions.map((action) => ({
          accion: {
            startsWith: `${action}_`,
          },
        })),
      });
    }

    if (query.statuses?.length) {
      andFilters.push({
        OR: query.statuses.map((status) => ({
          accion: {
            endsWith: `_${status}`,
          },
        })),
      });
    }

    if (query.users?.length) {
      const includeSystem = query.users.includes('__system__');
      const membershipIds = query.users.filter(
        (value) => value !== '__system__',
      );

      if (includeSystem && membershipIds.length > 0) {
        andFilters.push({
          OR: [
            { membershipId: null },
            {
              membershipId: {
                in: membershipIds,
              },
            },
          ],
        });
      } else if (includeSystem) {
        andFilters.push({
          membershipId: null,
        });
      } else if (membershipIds.length > 0) {
        andFilters.push({
          membershipId: {
            in: membershipIds,
          },
        });
      }
    }

    if (andFilters.length === 0) {
      return where;
    }

    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];

    return {
      ...where,
      AND: [...existingAnd, ...andFilters],
    };
  }

  private getAuditActionLabel(action: string): string {
    return action.split('_')[0]?.trim() || action;
  }

  private getAuditStatusLabel(
    status: MonitoringAuditStatusFilter,
  ): 'EXITOSA' | 'FALLIDA' {
    return status === MonitoringAuditStatusFilter.FAILED
      ? 'FALLIDA'
      : 'EXITOSA';
  }

  private buildUserOptionLabel(user: {
    username: string | null;
    nombre: string | null;
    apellido: string | null;
  }): string {
    const fullName = [user.nombre, user.apellido]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fullName && user.username) {
      return `${fullName} (@${user.username})`;
    }

    if (fullName) {
      return fullName;
    }

    if (user.username) {
      return `@${user.username}`;
    }

    return 'Sistema';
  }

  private async getAuditFilterOptions(
    where: Prisma.AuditoriaWhereInput,
  ): Promise<{
    actions: { value: string; label: string }[];
    entities: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
    users: { value: string; label: string }[];
  }> {
    const [actionRows, entityRows, userRows] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        distinct: ['accion'],
        select: {
          accion: true,
        },
        orderBy: {
          accion: 'asc',
        },
      }),
      this.prisma.auditoria.findMany({
        where,
        distinct: ['entidad'],
        select: {
          entidad: true,
        },
        orderBy: {
          entidad: 'asc',
        },
      }),
      this.prisma.auditoria.findMany({
        where,
        distinct: ['membershipId'],
        select: {
          membershipId: true,
          membership: {
            select: {
              username: true,
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const actions = Array.from(
      new Set(actionRows.map((row) => this.getAuditActionLabel(row.accion))),
    )
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es-CO'))
      .map((action) => ({
        value: action,
        label: action,
      }));

    const entities = entityRows
      .map((row) => row.entidad)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'es-CO'))
      .map((entity) => ({
        value: entity,
        label: entity,
      }));

    const statusSet = new Set<MonitoringAuditStatusFilter>();
    actionRows.forEach((row) => {
      if (row.accion.endsWith(`_${MonitoringAuditStatusFilter.SUCCESS}`)) {
        statusSet.add(MonitoringAuditStatusFilter.SUCCESS);
      }

      if (row.accion.endsWith(`_${MonitoringAuditStatusFilter.FAILED}`)) {
        statusSet.add(MonitoringAuditStatusFilter.FAILED);
      }
    });

    const statuses = Array.from(statusSet).map((status) => ({
      value: status,
      label: this.getAuditStatusLabel(status),
    }));

    const users = userRows
      .map((row) => {
        if (!row.membershipId || !row.membership) {
          return {
            value: '__system__',
            label: 'Sistema',
          };
        }

        return {
          value: row.membershipId,
          label: this.buildUserOptionLabel({
            username: row.membership.username ?? null,
            nombre: row.membership.user?.nombre ?? null,
            apellido: row.membership.user?.apellido ?? null,
          }),
        };
      })
      .filter(
        (option, index, array) =>
          array.findIndex((entry) => entry.value === option.value) === index,
      )
      .sort((a, b) => a.label.localeCompare(b.label, 'es-CO'));

    return {
      actions,
      entities,
      statuses,
      users,
    };
  }

  async findAllAudits(scope: MonitoringScope, query: MonitoringAuditsQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const baseWhere = this.buildAuditsBaseWhere(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
    const where = this.buildAuditsWhere(scope, query);

    const [data, total, filterOptions] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        include: {
          membership: {
            include: {
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.auditoria.count({
        where,
      }),
      this.getAuditFilterOptions(baseWhere),
    ]);

    const enrichedData = await this.enrichAuditsForDisplay(scope, data);

    return {
      results: enrichedData,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        filterOptions,
      },
    };
  }

  async findRecentLogs(
    scope: MonitoringScope,
    date?: string,
    startDate?: string,
    endDate?: string,
  ) {
    const { start, end } = this.getDateRange(date, startDate, endDate);
    const where: Prisma.LogEventoWhereInput = {
      ...this.buildTenantWhere(scope),
      createdAt:
        date || (startDate && endDate) ? { gte: start, lt: end } : undefined,
    };

    if (scope.empresaIds?.length) {
      where.empresaId = { in: scope.empresaIds };
    }

    if (scope.zonaIds?.length) {
      where.sesion = {
        ...(where.sesion as Prisma.SesionActividadWhereInput),
        membership: {
          empresaMemberships: {
            some: { zonaId: { in: scope.zonaIds } },
          },
        },
      };
    }

    return this.prisma.logEvento.findMany({
      where,
      include: {
        sesion: {
          include: {
            membership: {
              include: {
                user: {
                  select: { nombre: true, apellido: true, email: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
