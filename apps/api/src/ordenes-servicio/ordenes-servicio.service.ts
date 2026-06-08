import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  MessageEvent,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import IORedis, { RedisOptions } from 'ioredis';
import { Observable, Subject, from, interval, merge, of } from 'rxjs';
import { catchError, filter, map, startWith, switchMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ContratosClienteService } from '../contratos-cliente/contratos-cliente.service';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { CreateOrdenServicioDto } from './dto/create-orden-servicio.dto';
import { CompleteFollowUpDto } from './dto/complete-follow-up.dto';
import { CreateFollowUpOverrideDto } from './dto/create-follow-up-override.dto';
import { ExportOrdenesServicioDto } from './dto/export-ordenes-servicio.dto';
import { RemoveOrdenServicioDto } from './dto/remove-orden-servicio.dto';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  DateSortOrder,
  QueryOrdenesServicioDto,
  ServiciosPreset,
  applyPresetRange,
  normalizeSearchToken,
  toDayBoundsFromIso,
  toLocalDayRange,
} from './dto/query-ordenes-servicio.dto';
import {
  addBogotaDaysUtc,
  getBogotaTimezone,
  parseFlexibleDateTimeToUtc,
  startOfBogotaDayUtc,
  startOfBogotaWeekUtc,
} from '../common/utils/timezone.util';
import { deleteRedisKeysByPattern } from '../common/utils/redis-pattern-delete.util';
import {
  ConfirmUploadedFilesDto,
  CreateSignedDownloadUrlDto,
  CreateSignedUploadUrlDto,
  OrdenUploadKind,
} from './dto/upload-orden-servicio.dto';
import {
  NotifyLiquidationDto,
  NotifyOperatorDto,
} from './dto/notify-webhook.dto';
import { OperatorLastLocationDto } from './dto/operator-last-location.dto';
import sharp from 'sharp';
import {
  PrismaAccessFilter,
  getPrismaAccessFilter,
  hasTenantWideAccess,
} from '../common/utils/access-control.util';
import {
  OrdenServicio,
  Geolocalizacion,
  EvidenciaServicio,
  ClasificacionCliente,
  EstadoPermiso,
  EstadoOrden,
  EstadoPagoOrden,
  MetodoPagoBase,
  NivelInfestacion,
  Prisma,
  Role,
  TipoFacturacion,
  TipoVisita,
  TipoPermiso,
  UrgenciaOrden,
} from '../generated/client/client';

type LocalDiaSemana =
  | 'LUNES'
  | 'MARTES'
  | 'MIERCOLES'
  | 'JUEVES'
  | 'VIERNES'
  | 'SABADO'
  | 'DOMINGO';

interface LocalEmpresaMembership {
  id: string;
  membershipId: string;
  empresaId: string;
  zonaId: string | null;
  activo: boolean;
}

interface LocalTenantMembership {
  id: string;
  role: string;
  activo: boolean;
  municipioId: string | null;
  placa: string | null;
  moto: boolean | null;
}

interface LocalPicoPlaca {
  numeroUno: number;
  numeroDos: number;
}

export interface PicoPlacaAssignmentWarning {
  type: 'PICO_PLACA';
  message: string;
  membershipId: string;
  empresaId: string;
  dia: LocalDiaSemana;
  placa: string;
  digito: number;
  numerosRestringidos: number[];
  vehiculo: 'MOTO' | 'CARRO';
}

interface DesglosePagoItem {
  metodo: MetodoPagoBase;
  monto: number;
  banco?: string;
  referencia?: string;
  observacion?: string;
}

interface TransferenciaRealRegistrada {
  metodo: MetodoPagoBase;
  monto: number;
  path: string;
  referenciaPago: string;
  fechaPago: string;
  banco?: string;
  observacion?: string;
}

type CandidateWithMembership = LocalEmpresaMembership & {
  membership: LocalTenantMembership;
};

type OrdenWithGeolocalizaciones = OrdenServicio & {
  geolocalizaciones?: Geolocalizacion[];
  evidencias?: EvidenciaServicio[];
};

type SignableField =
  | 'facturaPath'
  | 'facturaElectronica'
  | 'comprobantePago'
  | 'evidenciaPath';

type OrdenFinancialLockState = {
  declaracionEfectivo?: { id: string } | null;
  consignacionOrden?: { id: string } | null;
  estadoPago?: EstadoPagoOrden | null;
  estadoServicio?: EstadoOrden | null;
  liquidadoAt?: Date | null;
  comprobantePago?: Prisma.JsonValue | null;
  referenciaPago?: string | null;
  fechaPago?: Date | string | null;
};

type OrdenReadPayload = OrdenWithGeolocalizaciones &
  Partial<OrdenFinancialLockState>;

type UpdateOrdenServicioDto = Omit<
  Partial<CreateOrdenServicioDto>,
  'tecnicoId'
> & {
  tecnicoId?: string | null;
};

const FOLLOW_UP_ONLY_PRESETS = new Set<ServiciosPreset>([
  ServiciosPreset.SEGUIMIENTOS,
  ServiciosPreset.ACCIONES_PENDIENTES,
  ServiciosPreset.SEGUIMIENTOS_CON_LLAMADAS,
  ServiciosPreset.SEGUIMIENTOS_SIN_LLAMADAS,
  ServiciosPreset.RECHAZADOS,
]);

const shouldIncludeFollowUpListData = (
  filters?: QueryOrdenesServicioDto,
): boolean =>
  filters?.includeFollowUps === true ||
  (filters?.preset ? FOLLOW_UP_ONLY_PRESETS.has(filters.preset) : false);

const ordenEditBootstrapClientSelect = {
  id: true,
  tipoCliente: true,
  nombre: true,
  apellido: true,
  razonSocial: true,
  telefono: true,
  telefono2: true,
  numeroDocumento: true,
  nit: true,
  correo: true,
  empresaId: true,
  createdAt: true,
  direcciones: {
    select: {
      id: true,
      direccion: true,
      barrio: true,
      nombreSede: true,
      municipioId: true,
      departmentId: true,
      linkMaps: true,
      piso: true,
      bloque: true,
      unidad: true,
      tipoUbicacion: true,
      clasificacionPunto: true,
      horarioInicio: true,
      horarioFin: true,
      restricciones: true,
      nombreContacto: true,
      telefonoContacto: true,
      cargoContacto: true,
      municipioRel: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
} as const satisfies Prisma.ClienteSelect;

const ordenEditBootstrapSelect = {
  id: true,
  tenantId: true,
  clienteId: true,
  empresaId: true,
  tecnicoId: true,
  direccionId: true,
  serviciosSeleccionados: true,
  fechaVisita: true,
  horaInicio: true,
  horaFin: true,
  horaInicioReal: true,
  horaFinReal: true,
  tipoVisita: true,
  nivelInfestacion: true,
  frecuenciaSugerida: true,
  urgencia: true,
  observacion: true,
  observacionFinal: true,
  diagnosticoTecnico: true,
  intervencionRealizada: true,
  hallazgosEstructurales: true,
  recomendacionesObligatorias: true,
  huboSellamiento: true,
  huboRecomendacionEstructural: true,
  valorCotizado: true,
  valorRepuestos: true,
  desglosePago: true,
  tipoFacturacion: true,
  estadoServicio: true,
  estadoPago: true,
  liquidadoAt: true,
  declaracionEfectivo: {
    select: { id: true },
  },
  consignacionOrden: {
    select: { id: true },
  },
  servicio: {
    select: {
      nombre: true,
    },
  },
  cliente: {
    select: ordenEditBootstrapClientSelect,
  },
  tecnico: {
    select: {
      id: true,
      user: {
        select: {
          nombre: true,
          apellido: true,
          telefono: true,
        },
      },
    },
  },
} as const satisfies Prisma.OrdenServicioSelect;

type OrdenEditBootstrapRow = Prisma.OrdenServicioGetPayload<{
  select: typeof ordenEditBootstrapSelect;
}>;

type OrdenOperatorNotificationPayload = {
  id: string;
  numeroOrden?: string | null;
  tecnicoId?: string | null;
  fechaVisita?: Date | string | null;
  horaInicio?: Date | string | null;
  estadoServicio?: string | null;
  urgencia?: string | null;
  direccionTexto?: string | null;
  linkMaps?: string | null;
  municipio?: string | null;
  barrio?: string | null;
  bloque?: string | null;
  piso?: string | null;
  unidad?: string | null;
  valorCotizado?: Prisma.Decimal | number | null;
  desglosePago?: Prisma.JsonValue | null;
  serviciosSeleccionados?: Prisma.JsonValue | null;
  observacion?: string | null;
  diagnosticoTecnico?: string | null;
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
  servicio?: { nombre?: string | null } | null;
};

type DireccionSnapshot = {
  id: string;
  direccionTexto: string;
  piso: string | null;
  bloque: string | null;
  unidad: string | null;
  barrio: string | null;
  municipio: string | null;
  departamento: string | null;
  linkMaps: string | null;
  zonaId: string | null;
};

const direccionSnapshotSelect: Prisma.DireccionSelect = {
  id: true,
  direccion: true,
  piso: true,
  bloque: true,
  unidad: true,
  barrio: true,
  municipio: true,
  linkMaps: true,
  zonaId: true,
  departmentRel: {
    select: {
      name: true,
    },
  },
};

interface DireccionSnapshotRecord {
  id: string;
  direccion: string;
  piso: string | null;
  bloque: string | null;
  unidad: string | null;
  barrio: string | null;
  municipio: string | null;
  linkMaps: string | null;
  zonaId: string | null;
  departmentRel: {
    name: string;
  } | null;
}

export interface ServiciosKpiPayload {
  total: number;
  programadosHoy: number;
  enCurso: number;
  vencidosSla: number;
  cumplimientoSlaPct: number;
  porcentajeLiquidacion: number;
  recaudoHoy: number;
  ticketPromedio: number;
  sinEvidencia: number;
}

export interface ServicioExportPayload {
  numeroOrden: string;
  empresa: string;
  cliente: string;
  documentoCliente: string | null;
  telefonoCliente: string | null;
  telefono2Cliente: string | null;
  correoCliente: string | null;
  servicio: string;
  serviciosSeleccionados: string | null;
  tipoServicio: string | null;
  zona: string | null;
  fechaVisita: string | null;
  horaInicio: string | null;
  tecnico: string;
  tipoVisita: string | null;
  estadoServicio: string | null;
  estadoPago: string | null;
  urgencia: string | null;
  valorCotizado: number;
  valorPagado: number;
  metodoPago: string;
  municipio: string | null;
  departamento: string | null;
  direccion: string | null;
  linkMaps: string | null;
  barrio: string | null;
  piso: string | null;
  bloque: string | null;
  unidad: string | null;
  tipoUbicacion: string | null;
  creador: string;
  creadaEn: string;
  observacion: string | null;
  observacionFinal: string | null;
  condicionesHigiene: string | null;
  condicionesLocal: string | null;
  diagnosticoTecnico: string | null;
  hallazgosEstructurales: string | null;
  intervencionRealizada: string | null;
  recomendacionesObligatorias: string | null;
  parentId: string | null;
  parentNumeroOrden: string | null;
  parentEmpresa: string | null;
  parentCliente: string | null;
  parentServicio: string | null;
  seguimientoEstado: string | null;
  seguimientoTipo: string | null;
  seguimientoVenceEn: string | null;
  seguimientoGestionadoEn: string | null;
  seguimientoCanal: string | null;
  seguimientoResultado: string | null;
  seguimientoNotas: string | null;
  followUps: ServicioExportFollowUpPayload[];
}

export interface ServicioExportFollowUpPayload {
  numeroOrden: string;
  cliente: string;
  servicio: string;
  fechaVisita: string | null;
  horaInicio: string | null;
  tecnico: string;
  tipoVisita: string | null;
  estadoServicio: string | null;
  direccion: string | null;
  barrio: string | null;
  municipio: string | null;
  departamento: string | null;
  piso: string | null;
  bloque: string | null;
  unidad: string | null;
  tipoUbicacion: string | null;
  seguimientoEstado: string | null;
  seguimientoTipo: string | null;
  seguimientoVenceEn: string | null;
  seguimientoGestionadoEn: string | null;
  seguimientoCanal: string | null;
  seguimientoResultado: string | null;
  seguimientoNotas: string | null;
}

export interface FollowUpNotificationItemPayload {
  id: string;
  ordenServicioId: string;
  empresaId: string;
  numeroOrden: string | null;
  dueAt: string;
  followUpType: string;
  cliente: string;
  servicio: string;
  responsibleName: string | null;
  responsibleMembershipId: string | null;
  isMine: boolean;
  isOverdue: boolean;
}

export interface FollowUpNotificationsSummaryPayload {
  scope: 'mine' | 'team';
  totalPending: number;
  overdueCount: number;
  todayCount: number;
  generatedAt: string;
  categories: Array<{
    value: string;
    label: string;
    count: number;
  }>;
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  };
  items: FollowUpNotificationItemPayload[];
}

interface FollowUpNotificationsQueryOptions {
  category?: string;
  page?: number;
  pageSize?: number;
}

interface FollowUpNotificationRefreshEvent {
  tenantId: string;
  empresaId?: string;
}

const AUTOMATIC_REINFORCEMENT_MIN_SERVICE_DATE_UTC = new Date(
  Date.UTC(2026, 1, 1, 5, 0, 0, 0),
);
const AUTOMATIC_REINFORCEMENT_HALF_PRICE_THRESHOLD = 100000;
const AUTOMATIC_REINFORCEMENT_MIN_PRICE = 50000;
const DEFAULT_FOLLOW_UP_NOTIFICATIONS_PAGE_SIZE = 8;
const MAX_FOLLOW_UP_NOTIFICATIONS_PAGE_SIZE = 50;

@Injectable()
export class OrdenesServicioService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdenesServicioService.name);
  private readonly followUpNotificationsRefresh$ =
    new Subject<FollowUpNotificationRefreshEvent>();
  private redis: IORedis | null = null;
  private readonly serviciosKpisCacheTtlSeconds = 60 * 5;

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    private contratosClienteService: ContratosClienteService,
    private readonly pushNotificationsService: PushNotificationsService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    try {
      this.redis = new IORedis(this.getRedisOptions());
      this.redis.on('error', (error) => {
        this.logger.warn(
          `Redis error in servicios KPIs cache: ${error.message}`,
        );
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo inicializar Redis para cache de KPIs de servicios: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
      this.redis = null;
    }
  }

  private getRedisOptions(): RedisOptions {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      const parsed = new URL(redisUrl);
      const dbFromPath = parsed.pathname?.replace('/', '').trim();

      return {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        db: dbFromPath ? Number(dbFromPath) : 0,
        tls: parsed.protocol === 'rediss:' ? {} : undefined,
        connectTimeout: 1_000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: (times) => (times > 1 ? null : 200),
      };
    }

    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = Number(this.configService.get<string>('REDIS_PORT') || 6379);
    const username =
      this.configService.get<string>('REDIS_USERNAME') ||
      this.configService.get<string>('REDIS_USER') ||
      undefined;
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = Number(
      this.configService.get<string>('REDIS_DB') ||
        this.configService.get<string>('REDIS_BD') ||
        0,
    );

    return {
      host,
      port,
      username,
      password,
      db,
      connectTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (times) => (times > 1 ? null : 200),
    };
  }

  private buildServiciosKpisCacheKey(
    accessFilter: PrismaAccessFilter,
    filters?: QueryOrdenesServicioDto,
  ): string {
    const empresaScope =
      typeof accessFilter.empresaId === 'string'
        ? accessFilter.empresaId
        : accessFilter.empresaId && 'in' in accessFilter.empresaId
          ? [...accessFilter.empresaId.in].sort().join(',')
          : 'all';
    const zonaScope = [...(accessFilter.zonaIds || [])].sort().join(',');
    const municipalityScope = [...(accessFilter.municipalityIds || [])]
      .sort()
      .join(',');
    const departmentScope = [...(accessFilter.departmentIds || [])]
      .sort()
      .join(',');
    const normalizedFilterEntries = Object.entries(filters || {})
      .filter(
        ([key, value]) =>
          !['refresh', 'page', 'limit', 'dateSortOrder'].includes(key) &&
          value !== undefined &&
          value !== null &&
          value !== '' &&
          value !== 'all',
      )
      .map(([key, value]): [string, unknown] => [
        key,
        Array.isArray(value) ? (value as unknown[]).map(String).sort() : value,
      ])
      .sort(([a], [b]) => a.localeCompare(b));
    const filterScope = this.encodeCacheSegment(normalizedFilterEntries);

    return [
      'servicios',
      'dashboard-kpis',
      `tenant:${accessFilter.tenantId || 'all'}`,
      `empresa:${empresaScope}`,
      `zonas:${zonaScope || 'none'}`,
      `municipios:${municipalityScope || 'none'}`,
      `departamentos:${departmentScope || 'none'}`,
      `day:${startOfBogotaDayUtc(new Date()).toISOString()}`,
      `filters:${filterScope}`,
    ].join('|');
  }

  private encodeCacheSegment(value: unknown): string {
    return Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }

  private async getServiciosKpisFromCache(
    cacheKey: string,
  ): Promise<ServiciosKpiPayload | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(cacheKey);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as ServiciosKpiPayload;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer cache de KPIs de servicios (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async setServiciosKpisCache(
    cacheKey: string,
    payload: ServiciosKpiPayload,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.serviciosKpisCacheTtlSeconds,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo escribir cache de KPIs de servicios (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async invalidateServiciosKpisCache(tenantId?: string): Promise<void> {
    if (!this.redis) {
      return;
    }

    const patterns = [
      ...(tenantId ? [`servicios|dashboard-kpis|tenant:${tenantId}|*`] : []),
      'servicios|dashboard-kpis|tenant:all|*',
    ];

    try {
      await deleteRedisKeysByPattern(this.redis, patterns);
    } catch (error) {
      this.logger.warn(
        `No se pudo invalidar cache de KPIs de servicios: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private invalidateServiciosKpisCacheSoon(tenantId?: string): void {
    void this.invalidateServiciosKpisCache(tenantId);
  }

  private emitFollowUpNotificationsRefresh(
    tenantId: string,
    empresaId?: string | null,
  ) {
    this.followUpNotificationsRefresh$.next({
      tenantId,
      empresaId: empresaId || undefined,
    });
  }

  private canViewTeamFollowUps(user: JwtPayload) {
    return (
      user.role === Role.ADMIN ||
      user.role === Role.SU_ADMIN ||
      user.role === Role.COORDINADOR
    );
  }

  private resolveFollowUpNotificationsPagination(
    total: number,
    options?: FollowUpNotificationsQueryOptions,
  ) {
    const requestedPage = Math.max(1, Math.trunc(Number(options?.page) || 1));
    const pageSize = Math.min(
      MAX_FOLLOW_UP_NOTIFICATIONS_PAGE_SIZE,
      Math.max(
        1,
        Math.trunc(
          Number(options?.pageSize) ||
            DEFAULT_FOLLOW_UP_NOTIFICATIONS_PAGE_SIZE,
        ),
      ),
    );
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, totalPages);

    return {
      page,
      pageSize,
      totalPages,
      skip: (page - 1) * pageSize,
      take: pageSize,
    };
  }

  private buildFollowUpNotificationsWhere(
    tenantId: string,
    user: JwtPayload,
    empresaId?: string,
  ): Prisma.OrdenServicioSeguimientoWhereInput {
    const accessFilter = getPrismaAccessFilter(user, empresaId);
    const geoWhere = this.buildOrdenGeoWhere(accessFilter);
    const shouldRestrictToMine = !this.canViewTeamFollowUps(user);
    const ordenServicioWhere: Prisma.OrdenServicioWhereInput = {
      ...(geoWhere ?? {}),
      deletedAt: null,
    };

    if (shouldRestrictToMine && !user.membershipId) {
      return {
        tenantId,
        id: '__no-membership__',
      };
    }

    return {
      tenantId: accessFilter.tenantId ?? tenantId,
      ...(accessFilter.empresaId ? { empresaId: accessFilter.empresaId } : {}),
      ...(shouldRestrictToMine && user.membershipId
        ? { createdByMembershipId: user.membershipId }
        : {}),
      status: 'PENDIENTE',
      completedAt: null,
      ordenServicio: {
        is: ordenServicioWhere,
      },
    };
  }

  private buildFollowUpClienteLabel(cliente: {
    tipoCliente?: string | null;
    razonSocial?: string | null;
    nombre?: string | null;
    apellido?: string | null;
  }) {
    if (cliente.tipoCliente === 'EMPRESA') {
      return cliente.razonSocial?.trim() || 'Cliente empresa';
    }

    const fullName = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
    return fullName || 'Cliente sin nombre';
  }

  private buildFollowUpResponsibleLabel(
    membership?: {
      user?: {
        nombre?: string | null;
        apellido?: string | null;
      } | null;
    } | null,
  ) {
    const fullName =
      `${membership?.user?.nombre || ''} ${membership?.user?.apellido || ''}`.trim();
    return fullName || null;
  }

  private async closePendingFollowUpsForFinishedOrder(
    tenantId: string,
    ordenServicioId: string,
    completedByMembershipId?: string | null,
  ) {
    const result = await this.prisma.ordenServicioSeguimiento.updateMany({
      where: {
        tenantId,
        ordenServicioId,
        status: 'PENDIENTE',
        completedAt: null,
      },
      data: {
        status: 'ACEPTADO',
        completedAt: new Date(),
        ...(completedByMembershipId ? { completedByMembershipId } : {}),
        outcome: 'SERVICIO_FINALIZADO',
        notes: 'Servicio finalizado; la acción pendiente quedó cerrada.',
      },
    });

    return result.count;
  }

  async getOperatorLastLocations(
    tenantId: string,
    user: JwtPayload,
    empresaId?: string,
  ): Promise<OperatorLastLocationDto[]> {
    const accessFilter = getPrismaAccessFilter(user, empresaId);
    const geoWhere = this.buildOrdenGeoWhere(accessFilter);
    const scopedTenantId = accessFilter.tenantId ?? tenantId;

    const empresaMembershipWhere: Prisma.EmpresaMembershipWhereInput = {
      tenantId: scopedTenantId,
      activo: true,
      deletedAt: null,
      role: Role.OPERADOR,
      membership: {
        tenantId: scopedTenantId,
        activo: true,
        role: Role.OPERADOR,
        user: {
          isActive: true,
        },
      },
      ...(accessFilter.empresaId ? { empresaId: accessFilter.empresaId } : {}),
      ...((accessFilter.zonaIds || []).length > 0
        ? { zonaId: { in: accessFilter.zonaIds } }
        : {}),
    };

    const operators = await this.prisma.empresaMembership.findMany({
      where: empresaMembershipWhere,
      select: {
        empresaId: true,
        membershipId: true,
        role: true,
        membership: {
          select: {
            role: true,
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }],
    });
    const uniqueOperatorsByEmpresa = new Map<
      string,
      (typeof operators)[number]
    >();

    for (const operator of operators) {
      const key = `${operator.membershipId}:${operator.empresaId}`;

      if (!uniqueOperatorsByEmpresa.has(key)) {
        uniqueOperatorsByEmpresa.set(key, operator);
      }
    }

    const uniqueOperators = Array.from(uniqueOperatorsByEmpresa.values());

    if (uniqueOperators.length === 0) {
      return [];
    }

    const membershipIds = Array.from(
      new Set(uniqueOperators.map((operator) => operator.membershipId)),
    );

    const geolocalizaciones = await this.prisma.geolocalizacion.findMany({
      where: {
        tenantId: scopedTenantId,
        membershipId: { in: membershipIds },
        latitud: { not: null },
        longitud: { not: null },
        ...(accessFilter.empresaId
          ? { empresaId: accessFilter.empresaId }
          : {}),
        orden: {
          is: {
            ...(accessFilter.tenantId
              ? { tenantId: accessFilter.tenantId }
              : { tenantId }),
            ...(accessFilter.empresaId
              ? { empresaId: accessFilter.empresaId }
              : {}),
            ...(geoWhere ?? {}),
            deletedAt: null,
          },
        },
      },
      select: {
        empresaId: true,
        membershipId: true,
        latitud: true,
        longitud: true,
        llegada: true,
        salida: true,
        ordenId: true,
        linkMaps: true,
        orden: {
          select: {
            numeroOrden: true,
            direccionTexto: true,
            linkMaps: true,
            cliente: {
              select: {
                tipoCliente: true,
                razonSocial: true,
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
      orderBy: [{ llegada: 'desc' }, { createdAt: 'desc' }],
      distinct: ['membershipId', 'empresaId'],
    });

    const lastLocationByOperatorEmpresa = new Map<
      string,
      (typeof geolocalizaciones)[number]
    >();

    for (const geolocalizacion of geolocalizaciones) {
      const key = `${geolocalizacion.membershipId}:${geolocalizacion.empresaId}`;
      if (!lastLocationByOperatorEmpresa.has(key)) {
        lastLocationByOperatorEmpresa.set(key, geolocalizacion);
      }
    }

    return uniqueOperators.map((operator) => {
      const fullName =
        `${operator.membership.user.nombre || ''} ${
          operator.membership.user.apellido || ''
        }`.trim() || 'Operador sin nombre';
      const lastLocation = lastLocationByOperatorEmpresa.get(
        `${operator.membershipId}:${operator.empresaId}`,
      );

      return {
        operatorId: operator.membershipId,
        operatorName: fullName,
        operatorRole: operator.role ?? operator.membership.role ?? null,
        empresaId: operator.empresaId,
        lastLocation:
          lastLocation &&
          lastLocation.latitud !== null &&
          lastLocation.longitud !== null
            ? {
                latitud: lastLocation.latitud,
                longitud: lastLocation.longitud,
                llegada: lastLocation.llegada.toISOString(),
                salida: lastLocation.salida?.toISOString() ?? null,
                ordenId: lastLocation.ordenId,
                numeroOrden: lastLocation.orden.numeroOrden ?? null,
                clienteNombre: this.buildFollowUpClienteLabel(
                  lastLocation.orden.cliente,
                ),
                direccionTexto: lastLocation.orden.direccionTexto ?? null,
                linkMaps:
                  lastLocation.linkMaps ?? lastLocation.orden.linkMaps ?? null,
              }
            : null,
      };
    });
  }

  async getFollowUpNotificationsSummary(
    tenantId: string,
    user: JwtPayload,
    empresaId?: string,
    options?: FollowUpNotificationsQueryOptions,
  ): Promise<FollowUpNotificationsSummaryPayload> {
    const now = new Date();
    const todayStart = startOfBogotaDayUtc(now);
    const weekStart = startOfBogotaWeekUtc(now);
    const tomorrowStart = addBogotaDaysUtc(todayStart, 1);
    const selectedCategory = options?.category?.trim();
    const categoryFilter =
      selectedCategory && selectedCategory !== 'all'
        ? { followUpType: selectedCategory }
        : {};
    const baseWhere: Prisma.OrdenServicioSeguimientoWhereInput = {
      ...this.buildFollowUpNotificationsWhere(tenantId, user, empresaId),
      dueAt: {
        gte: weekStart,
      },
    };
    const where: Prisma.OrdenServicioSeguimientoWhereInput = {
      ...baseWhere,
      ...categoryFilter,
    };

    const [totalPending, overdueCount, todayCount, categoryGroups] =
      await Promise.all([
        this.prisma.ordenServicioSeguimiento.count({
          where,
        }),
        this.prisma.ordenServicioSeguimiento.count({
          where: {
            ...where,
            dueAt: {
              gte: weekStart,
              lt: todayStart,
            },
          },
        }),
        this.prisma.ordenServicioSeguimiento.count({
          where: {
            ...where,
            dueAt: {
              gte: todayStart,
              lt: tomorrowStart,
            },
          },
        }),
        this.prisma.ordenServicioSeguimiento.groupBy({
          by: ['followUpType'],
          where: baseWhere,
          _count: {
            _all: true,
          },
        }),
      ]);
    const pagination = this.resolveFollowUpNotificationsPagination(
      totalPending,
      options,
    );
    const items = await this.prisma.ordenServicioSeguimiento.findMany({
      where,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        ordenServicioId: true,
        empresaId: true,
        dueAt: true,
        followUpType: true,
        createdByMembershipId: true,
        ordenServicio: {
          select: {
            id: true,
            numeroOrden: true,
            cliente: {
              select: {
                tipoCliente: true,
                razonSocial: true,
                nombre: true,
                apellido: true,
              },
            },
            servicio: {
              select: {
                nombre: true,
              },
            },
          },
        },
        createdByMembership: {
          select: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
      },
    });
    const categories = categoryGroups
      .map((group) => ({
        value: group.followUpType,
        label: group.followUpType,
        count: group._count._all,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));

    return {
      scope: this.canViewTeamFollowUps(user) ? 'team' : 'mine',
      totalPending,
      overdueCount,
      todayCount,
      generatedAt: now.toISOString(),
      categories,
      meta: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total: totalPending,
        totalPages: pagination.totalPages,
        hasPreviousPage: pagination.page > 1,
        hasNextPage: pagination.page < pagination.totalPages,
      },
      items: items.map((item) => ({
        id: item.id,
        ordenServicioId: item.ordenServicioId,
        empresaId: item.empresaId,
        numeroOrden: item.ordenServicio.numeroOrden || null,
        dueAt: item.dueAt.toISOString(),
        followUpType: item.followUpType,
        cliente: this.buildFollowUpClienteLabel(item.ordenServicio.cliente),
        servicio: item.ordenServicio.servicio?.nombre || 'Servicio General',
        responsibleName: this.buildFollowUpResponsibleLabel(
          item.createdByMembership,
        ),
        responsibleMembershipId: item.createdByMembershipId,
        isMine: item.createdByMembershipId === user.membershipId,
        isOverdue: item.dueAt.getTime() < todayStart.getTime(),
      })),
    };
  }

  streamFollowUpNotifications(
    tenantId: string,
    user: JwtPayload,
    empresaId?: string,
  ): Observable<MessageEvent> {
    const normalizedEmpresaId = empresaId || undefined;
    const refresh$ = this.followUpNotificationsRefresh$.pipe(
      filter(
        (event) =>
          event.tenantId === tenantId &&
          (!normalizedEmpresaId ||
            !event.empresaId ||
            event.empresaId === normalizedEmpresaId),
      ),
      startWith({
        tenantId,
        empresaId: normalizedEmpresaId,
      }),
      switchMap(() =>
        from(
          this.getFollowUpNotificationsSummary(
            tenantId,
            user,
            normalizedEmpresaId,
          ),
        ).pipe(
          map(
            (summary) =>
              ({
                type: 'summary',
                data: summary,
              }) satisfies MessageEvent,
          ),
          catchError((error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : 'No fue posible actualizar las notificaciones';

            this.logger.error(
              `FOLLOW_UP_NOTIFICATIONS_STREAM: ${message}`,
              error instanceof Error ? error.stack : undefined,
            );

            return of({
              type: 'error',
              data: {
                message,
                generatedAt: new Date().toISOString(),
              },
            } satisfies MessageEvent);
          }),
        ),
      ),
    );

    const heartbeat$ = interval(25000).pipe(
      map(
        () =>
          ({
            type: 'ping',
            data: {
              timestamp: new Date().toISOString(),
            },
          }) satisfies MessageEvent,
      ),
    );

    return merge(refresh$, heartbeat$);
  }

  private getReinforcementFallbackMembershipId(tenantId: string) {
    const tenantMapRaw = this.configService
      .get<string>('REINFORCEMENT_FALLBACK_MEMBERSHIP_IDS')
      ?.trim();

    if (tenantMapRaw) {
      try {
        const parsed = JSON.parse(tenantMapRaw) as Record<string, unknown>;
        const tenantSpecificMembershipId = parsed[tenantId];

        if (
          typeof tenantSpecificMembershipId === 'string' &&
          tenantSpecificMembershipId.trim()
        ) {
          return tenantSpecificMembershipId.trim();
        }
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `AUTO_FOLLOW_UPS: No se pudo parsear REINFORCEMENT_FALLBACK_MEMBERSHIP_IDS. ${message}`,
        );
      }
    }

    return (
      this.configService
        .get<string>('REINFORCEMENT_FALLBACK_MEMBERSHIP_ID')
        ?.trim() || null
    );
  }

  private async resolveAutomaticFollowUpCreatorMembership(
    tenantId: string,
    empresaId: string,
    ordenId: string,
    currentMembershipId: string | null,
  ): Promise<{
    membershipId: string | null;
    source: 'original' | 'fallback' | 'missing';
  }> {
    if (currentMembershipId) {
      return {
        membershipId: currentMembershipId,
        source: 'original',
      };
    }

    const fallbackMembershipId =
      this.getReinforcementFallbackMembershipId(tenantId);

    if (!fallbackMembershipId) {
      this.logger.warn(
        `AUTO_FOLLOW_UPS: La orden ${ordenId} no tiene creadoPorId y no hay fallback configurado. Definí REINFORCEMENT_FALLBACK_MEMBERSHIP_ID o REINFORCEMENT_FALLBACK_MEMBERSHIP_IDS para no perder seguimientos.`,
      );
      return {
        membershipId: null,
        source: 'missing',
      };
    }

    const fallbackMembership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: fallbackMembershipId,
        tenantId,
        activo: true,
      },
      select: {
        id: true,
        empresaMemberships: {
          where: {
            empresaId,
            activo: true,
            deletedAt: null,
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    if (!fallbackMembership) {
      this.logger.error(
        `AUTO_FOLLOW_UPS: El fallback membership ${fallbackMembershipId} no existe o no pertenece al tenant ${tenantId}. La orden ${ordenId} seguirá sin responsable explícito.`,
      );
      return {
        membershipId: null,
        source: 'missing',
      };
    }

    if (fallbackMembership.empresaMemberships.length === 0) {
      this.logger.warn(
        `AUTO_FOLLOW_UPS: El fallback membership ${fallbackMembership.id} no tiene empresaMembership activa para la empresa ${empresaId}. Se usará igual para no perder el seguimiento, pero revisá su visibilidad operativa.`,
      );
    }

    await this.prisma.ordenServicio.updateMany({
      where: {
        id: ordenId,
        tenantId,
        creadoPorId: null,
      },
      data: {
        creadoPorId: fallbackMembership.id,
      },
    });

    this.logger.warn(
      `AUTO_FOLLOW_UPS: La orden ${ordenId} no tenía creadoPorId. Se asignó el fallback membership ${fallbackMembership.id}.`,
    );

    return {
      membershipId: fallbackMembership.id,
      source: 'fallback',
    };
  }

  private async notifyServiceAssignment(params: {
    tenantId: string;
    membershipId: string | null | undefined;
    serviceId: string;
    source: 'create' | 'update';
  }) {
    if (!params.membershipId) {
      this.logger.log(
        `PUSH_ASSIGNMENT: Se omite envío en ${params.source}; la orden ${params.serviceId} quedó sin técnico asignado.`,
      );
      return;
    }

    try {
      const sent =
        await this.pushNotificationsService.sendServiceAssignedNotification({
          tenantId: params.tenantId,
          membershipId: params.membershipId,
          serviceId: params.serviceId,
        });

      if (sent) {
        this.logger.log(
          `PUSH_ASSIGNMENT: Push enviado para la orden ${params.serviceId} al membership ${params.membershipId} (${params.source}).`,
        );
        return;
      }

      this.logger.warn(
        `PUSH_ASSIGNMENT: No se confirmó envío para la orden ${params.serviceId} al membership ${params.membershipId} (${params.source}). Revisá los logs de PushNotificationsService.`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `PUSH_ASSIGNMENT: Falló el envío push para la orden ${params.serviceId} al membership ${params.membershipId}: ${message}`,
        stack,
      );
    }
  }

  private shouldTriggerOperatorWebhookOnUpdate(params: {
    previousTecnicoId: string | null;
    updatedOrden: OrdenOperatorNotificationPayload;
    updateDto: UpdateOrdenServicioDto;
  }) {
    const { previousTecnicoId, updatedOrden, updateDto } = params;

    if (!updatedOrden.tecnicoId) {
      return false;
    }

    return (
      updatedOrden.tecnicoId !== previousTecnicoId ||
      updateDto.fechaVisita !== undefined ||
      updateDto.horaInicio !== undefined ||
      updateDto.estadoServicio !== undefined ||
      updateDto.urgencia !== undefined ||
      updateDto.direccionId !== undefined ||
      updateDto.direccionTexto !== undefined ||
      updateDto.servicioId !== undefined ||
      updateDto.servicioEspecifico !== undefined ||
      updateDto.serviciosSeleccionados !== undefined
    );
  }

  private formatOperatorNotificationSchedule(
    orden: OrdenOperatorNotificationPayload,
  ) {
    const reference = orden.horaInicio ?? orden.fechaVisita;

    if (!reference) {
      return 'Programación pendiente';
    }

    const scheduleDate =
      reference instanceof Date ? reference : new Date(reference);

    if (Number.isNaN(scheduleDate.getTime())) {
      return 'Programación pendiente';
    }

    const timezone = getBogotaTimezone();
    const formattedDate = new Intl.DateTimeFormat('es-CO', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(scheduleDate);

    const formattedTime = new Intl.DateTimeFormat('es-CO', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(scheduleDate);

    return `${formattedDate} a las ${formattedTime}`;
  }

  private formatCopCurrency(value: number) {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private buildOperatorNotificationDto(
    orden: OrdenOperatorNotificationPayload,
  ): NotifyOperatorDto | null {
    const telefonoOperador = this.toOptionalString(
      orden.tecnico?.user?.telefono,
    );

    if (!orden.tecnicoId || !telefonoOperador) {
      return null;
    }

    const tecnico =
      [orden.tecnico?.user?.nombre, orden.tecnico?.user?.apellido]
        .filter((value): value is string =>
          Boolean(this.toOptionalString(value)),
        )
        .join(' ')
        .trim() || 'TÉCNICO';

    const cliente =
      orden.cliente?.tipoCliente === 'EMPRESA'
        ? this.toOptionalString(orden.cliente.razonSocial) ||
          [orden.cliente?.nombre, orden.cliente?.apellido]
            .filter((value): value is string =>
              Boolean(this.toOptionalString(value)),
            )
            .join(' ')
            .trim() ||
          'Cliente desconocido'
        : [orden.cliente?.nombre, orden.cliente?.apellido]
            .filter((value): value is string =>
              Boolean(this.toOptionalString(value)),
            )
            .join(' ')
            .trim() ||
          this.toOptionalString(orden.cliente?.razonSocial) ||
          'Cliente desconocido';

    const servicio =
      (Array.isArray(orden.serviciosSeleccionados)
        ? orden.serviciosSeleccionados
            .map((item) => this.toOptionalString(item))
            .filter((item): item is string => Boolean(item))
            .join(', ')
        : '') ||
      this.toOptionalString(orden.servicio?.nombre) ||
      'SERVICIO';

    const breakdown = this.normalizeBreakdown(orden.desglosePago);
    const metodosPago =
      breakdown && breakdown.length > 0
        ? breakdown
            .map(
              (line) =>
                `${line.metodo} (${this.formatCopCurrency(line.monto)})`,
            )
            .join(', ')
        : 'Pendiente';

    const numeroOrden =
      this.toOptionalString(orden.numeroOrden) ||
      orden.id.slice(0, 8).toUpperCase();

    const detalles =
      [
        this.toOptionalString(orden.bloque)
          ? `B: ${this.toOptionalString(orden.bloque)}`
          : null,
        this.toOptionalString(orden.piso)
          ? `P: ${this.toOptionalString(orden.piso)}`
          : null,
        this.toOptionalString(orden.unidad)
          ? `U: ${this.toOptionalString(orden.unidad)}`
          : null,
      ]
        .filter((item): item is string => Boolean(item))
        .join(' - ') || 'N/A';

    return {
      telefonoOperador,
      numeroOrden: `#${numeroOrden}`,
      cliente,
      servicio: servicio.toUpperCase(),
      programacion: this.formatOperatorNotificationSchedule(orden),
      tecnico,
      estado: orden.estadoServicio || 'NUEVO',
      urgencia: orden.urgencia || 'BAJA',
      direccion: this.toOptionalString(orden.direccionTexto) || 'N/A',
      linkMaps: this.toOptionalString(orden.linkMaps) || 'N/A',
      municipio: this.toOptionalString(orden.municipio) || 'N/A',
      barrio: this.toOptionalString(orden.barrio) || 'N/A',
      detalles,
      valorCotizado: this.formatCopCurrency(Number(orden.valorCotizado || 0)),
      metodosPago,
      observaciones:
        this.toOptionalString(orden.diagnosticoTecnico) ||
        this.toOptionalString(orden.observacion) ||
        'Sin observaciones',
      idServicio: orden.id,
    };
  }

  private async notifyOperatorWebhookForOrderUpdate(params: {
    tenantId: string;
    previousTecnicoId: string | null;
    updatedOrden: OrdenOperatorNotificationPayload;
    updateDto: UpdateOrdenServicioDto;
  }) {
    const { tenantId, previousTecnicoId, updatedOrden, updateDto } = params;

    if (
      !this.shouldTriggerOperatorWebhookOnUpdate({
        previousTecnicoId,
        updatedOrden,
        updateDto,
      })
    ) {
      return;
    }

    const dto = this.buildOperatorNotificationDto(updatedOrden);

    if (!dto) {
      this.logger.warn(
        `OPERATOR_WEBHOOK: Se omitió el webhook en update para la orden ${updatedOrden.id} porque falta técnico asignado o teléfono del técnico.`,
      );
      return;
    }

    try {
      const result = await this.notifyOperatorWebhook(tenantId, dto);

      if (!result.success) {
        this.logger.warn(
          `OPERATOR_WEBHOOK: El webhook de edición para la orden ${updatedOrden.id} no confirmó éxito. error=${result.error ?? 'unknown'}`,
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `OPERATOR_WEBHOOK: Falló el webhook automático de edición para la orden ${updatedOrden.id}: ${message}`,
        stack,
      );
    }
  }

  private mapDireccionSnapshot(
    direccion: DireccionSnapshotRecord,
  ): DireccionSnapshot {
    return {
      id: direccion.id,
      direccionTexto: direccion.direccion,
      piso: direccion.piso ?? null,
      bloque: direccion.bloque ?? null,
      unidad: direccion.unidad ?? null,
      barrio: direccion.barrio ?? null,
      municipio: direccion.municipio ?? null,
      departamento: direccion.departmentRel?.name ?? null,
      linkMaps: direccion.linkMaps ?? null,
      zonaId: direccion.zonaId ?? null,
    };
  }

  private async resolveDireccionSnapshot(params: {
    tenantId: string;
    direccionId?: string | null;
    clienteId: string;
  }): Promise<DireccionSnapshot | null> {
    const { tenantId, direccionId, clienteId } = params;

    const direccion: DireccionSnapshotRecord | null = direccionId
      ? await this.prisma.direccion.findFirst({
          where: {
            id: direccionId,
            tenantId,
          },
          select: direccionSnapshotSelect,
        })
      : await this.prisma.direccion.findFirst({
          where: {
            tenantId,
            clienteId,
            activa: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
          select: direccionSnapshotSelect,
        });

    return direccion ? this.mapDireccionSnapshot(direccion) : null;
  }

  async create(
    tenantId: string,
    createDto: CreateOrdenServicioDto,
    performingUser?: JwtPayload,
  ) {
    this.logger.log(`CREATE: Starting order creation for tenant: ${tenantId}`);
    // 1. Validar que la empresa exista
    const empresa = await this.prisma.empresa.findFirst({
      where: { id: createDto.empresaId, tenantId, deletedAt: null },
    });
    if (!empresa) {
      throw new BadRequestException('La empresa especificada no existe');
    }

    if (performingUser?.membershipId) {
      createDto.creadoPorId = performingUser.membershipId;
    }

    this.assertCanAssignServices();

    // 2. Obtener snapshot de dirección
    const direccionSnapshot = await this.resolveDireccionSnapshot({
      tenantId,
      direccionId: createDto.direccionId,
      clienteId: createDto.clienteId,
    });
    const direccionId = direccionSnapshot?.id ?? createDto.direccionId;
    const direccionTexto =
      direccionSnapshot?.direccionTexto ||
      createDto.direccionTexto ||
      'Sin dirección';

    if (direccionSnapshot?.id) {
      this.logger.log(
        `CREATE: Using resolved address snapshot: ${direccionSnapshot.id}`,
      );
    }

    const fechaVisitaDate = createDto.fechaVisita
      ? parseFlexibleDateTimeToUtc(createDto.fechaVisita, {
          dateOnlyAsBogotaStart: true,
        })
      : null;
    if (createDto.fechaVisita && !fechaVisitaDate) {
      throw new BadRequestException('fechaVisita inválida');
    }

    // Calcular horaFin basado en horaInicio y duracionMinutos
    const horaInicioDate = createDto.horaInicio
      ? parseFlexibleDateTimeToUtc(createDto.horaInicio)
      : null;
    if (createDto.horaInicio && !horaInicioDate) {
      throw new BadRequestException('horaInicio inválida');
    }
    const horaInicioRealDate = createDto.horaInicioReal
      ? parseFlexibleDateTimeToUtc(createDto.horaInicioReal)
      : null;
    if (createDto.horaInicioReal && !horaInicioRealDate) {
      throw new BadRequestException('horaInicioReal inválida');
    }
    const horaFinRealDate = createDto.horaFinReal
      ? parseFlexibleDateTimeToUtc(createDto.horaFinReal)
      : null;
    if (createDto.horaFinReal && !horaFinRealDate) {
      throw new BadRequestException('horaFinReal inválida');
    }
    let horaFinDate: Date | null = null;
    if (horaInicioDate && createDto.duracionMinutos) {
      horaFinDate = new Date(
        horaInicioDate.getTime() + createDto.duracionMinutos * 60000,
      );
    }

    // 3.5 Obtener o crear el(los) servicio(s) específico(s)
    const nombresServicios =
      createDto.serviciosSeleccionados &&
      createDto.serviciosSeleccionados.length > 0
        ? createDto.serviciosSeleccionados
        : createDto.servicioEspecifico
          ? [createDto.servicioEspecifico]
          : [];

    if (nombresServicios.length === 0 && !createDto.servicioId) {
      throw new BadRequestException('Debe especificar al menos un servicio');
    }

    let servicioPrincipal: {
      id: string;
      empresaId: string;
      requiereSeguimiento: boolean;
      primerSeguimientoDias: number | null;
      requiereSeguimientoTresMeses: boolean;
    } | null = null;

    if (createDto.servicioId) {
      servicioPrincipal = await this.prisma.servicio.findFirst({
        where: {
          id: createDto.servicioId,
          tenantId,
          empresaId: createDto.empresaId,
        },
      });
    }

    const serviciosProcesados: string[] = [];
    for (const nombreServicio of nombresServicios) {
      let svc = await this.prisma.servicio.findFirst({
        where: {
          tenantId,
          empresaId: createDto.empresaId,
          nombre: nombreServicio,
        },
      });

      if (!svc) {
        svc = await this.prisma.servicio.create({
          data: {
            tenantId,
            empresaId: createDto.empresaId,
            nombre: nombreServicio,
            activo: true,
          },
        });
      }
      serviciosProcesados.push(svc.nombre); // Guardar los nombres para el JSONB

      if (!servicioPrincipal) {
        servicioPrincipal = svc;
      }
    }

    if (!servicioPrincipal) {
      throw new BadRequestException(
        'No se pudo determinar un servicio principal',
      );
    }

    // 4. Crear la orden
    const dtoWithAddress = { ...createDto, direccionId };
    const tecnicoId = createDto.sinTecnico
      ? null
      : createDto.tecnicoId ||
        (await this.autoAssignTechnician(
          tenantId,
          dtoWithAddress,
          horaInicioDate,
          horaFinDate,
        ));
    const picoPlacaWarning =
      !createDto.sinTecnico && createDto.tecnicoId
        ? await this.resolveManualPicoPlacaWarning({
            tenantId,
            empresaId: createDto.empresaId,
            membershipId: createDto.tecnicoId,
            serviceDate: horaInicioDate ?? fechaVisitaDate,
          })
        : null;

    this.logger.log(
      `CREATE: Final tecnicoId for the order: ${tecnicoId ?? 'NULL'}`,
    );

    const contratoActivo =
      await this.contratosClienteService.getActiveByCliente(
        tenantId,
        createDto.clienteId,
        createDto.empresaId,
      );
    const tipoVisitaResuelta = createDto.tipoVisita;
    const esGarantia = this.isGarantiaVisitType(tipoVisitaResuelta);

    if (esGarantia) {
      await this.assertGuaranteeEligibility(tenantId, createDto.clienteId);
    }

    const tipoFacturacionResuelta = esGarantia
      ? TipoFacturacion.UNICO
      : contratoActivo?.tipoFacturacion ||
        createDto.tipoFacturacion ||
        TipoFacturacion.UNICO;
    const valorCotizadoResuelto = esGarantia ? 0 : createDto.valorCotizado;
    const desglosePagoResuelto = esGarantia ? [] : createDto.desglosePago;
    const metodoPagoNombre = await this.resolveMetodoPagoNombreById(
      tenantId,
      createDto.empresaId,
      createDto.metodoPagoId,
    );
    const metodosPagoBaseResueltos = this.deriveMetodosPagoBase(
      desglosePagoResuelto,
      metodoPagoNombre,
    );

    // Al crear una orden nueva, el estado siempre es PENDIENTE y el valor pagado es 0
    // ya que el servicio no se ha prestado ni cobrado aún.
    const estadoPago = EstadoPagoOrden.PENDIENTE;
    const valorPagado = 0;

    const nuevaOrden = await this.prisma.ordenServicio.create({
      data: {
        tenantId,
        empresaId: createDto.empresaId,
        clienteId: createDto.clienteId,
        servicioId: servicioPrincipal.id,
        serviciosSeleccionados:
          serviciosProcesados as unknown as Prisma.InputJsonValue,
        creadoPorId: createDto.creadoPorId,
        tecnicoId,
        direccionId,
        direccionTexto,
        piso: direccionSnapshot?.piso,
        bloque: direccionSnapshot?.bloque,
        unidad: direccionSnapshot?.unidad,
        barrio: direccionSnapshot?.barrio,
        municipio: direccionSnapshot?.municipio,
        departamento: direccionSnapshot?.departamento,
        linkMaps: direccionSnapshot?.linkMaps,
        zonaId: direccionSnapshot?.zonaId,
        estadoServicio: createDto.estadoServicio ?? 'NUEVO',
        observacion: createDto.observacion,
        observacionFinal: createDto.observacionFinal,
        diagnosticoTecnico: createDto.diagnosticoTecnico,
        intervencionRealizada: createDto.intervencionRealizada,
        hallazgosEstructurales: createDto.hallazgosEstructurales,
        recomendacionesObligatorias: createDto.recomendacionesObligatorias,
        huboSellamiento: createDto.huboSellamiento,
        huboRecomendacionEstructural: createDto.huboRecomendacionEstructural,
        nivelInfestacion: createDto.nivelInfestacion,
        urgencia: createDto.urgencia,
        tipoVisita: tipoVisitaResuelta,
        frecuenciaSugerida: createDto.frecuenciaSugerida,
        tipoFacturacion: tipoFacturacionResuelta,
        contratoClienteId: contratoActivo?.id,
        valorCotizado: valorCotizadoResuelto,
        valorRepuestos: createDto.valorRepuestos,
        valorPagado,
        metodoPagoId: createDto.metodoPagoId,
        desglosePago: desglosePagoResuelto
          ? (desglosePagoResuelto as unknown as Prisma.InputJsonValue)
          : undefined,
        metodosPagoBase: metodosPagoBaseResueltos,
        estadoPago,
        fechaVisita: fechaVisitaDate,
        horaInicio: horaInicioDate,
        horaFin: horaFinDate,
        horaInicioReal: horaInicioRealDate,
        horaFinReal: horaFinRealDate,
      },
      include: {
        cliente: true,
        servicio: true,
        tecnico: {
          include: { user: true },
        },
      },
    });

    // Recalcular estado del cliente (score, clasificación, ultima/proxima visita)
    await this.recalculateClientStatus(nuevaOrden.clienteId);

    await this.createAutomaticFollowUps(
      tenantId,
      nuevaOrden,
      servicioPrincipal,
      fechaVisitaDate,
      contratoActivo,
      { allowWithoutContract: false },
    );

    void this.notifyServiceAssignment({
      tenantId,
      membershipId: nuevaOrden.tecnicoId,
      serviceId: nuevaOrden.id,
      source: 'create',
    });

    const signedOrden = await this.processSignedUrls(
      nuevaOrden as OrdenWithGeolocalizaciones,
    );

    this.invalidateServiciosKpisCacheSoon(tenantId);

    return picoPlacaWarning
      ? { ...signedOrden, picoPlacaWarning }
      : signedOrden;
  }

  private getDiaSemanaFromDate(date: Date): LocalDiaSemana {
    const dias: LocalDiaSemana[] = [
      'DOMINGO',
      'LUNES',
      'MARTES',
      'MIERCOLES',
      'JUEVES',
      'VIERNES',
      'SABADO',
    ];

    return dias[date.getDay()];
  }

  private getPicoPlacaDigit(
    placa?: string | null,
    esMoto?: boolean | null,
  ): number | null {
    const normalized = placa?.replace(/\s+/g, '').toUpperCase();
    if (!normalized) {
      return null;
    }

    const match = esMoto
      ? normalized.match(/\d/)
      : normalized.match(/\d(?=[^\d]*$)/);

    return match ? Number(match[0]) : null;
  }

  private evaluatePicoPlacaRestriction(
    membership: Pick<LocalTenantMembership, 'placa' | 'moto'>,
    regla: LocalPicoPlaca,
  ): { restricted: boolean; digit: number | null } {
    const digit = this.getPicoPlacaDigit(membership.placa, membership.moto);

    if (digit === null) {
      return { restricted: false, digit: null };
    }

    return {
      restricted: digit === regla.numeroUno || digit === regla.numeroDos,
      digit,
    };
  }

  private async getActivePicoPlacaRule(
    tenantId: string,
    empresaId: string,
    date: Date,
  ): Promise<(LocalPicoPlaca & { dia: LocalDiaSemana }) | null> {
    const diaSemana = this.getDiaSemanaFromDate(date);
    const delegate = this.prisma.picoPlaca as {
      findFirst: (args: Prisma.PicoPlacaFindFirstArgs) => Promise<unknown>;
    };

    const regla = (await delegate.findFirst({
      where: {
        tenantId,
        empresaId,
        dia: diaSemana,
        activo: true,
      },
    })) as (LocalPicoPlaca & { dia: LocalDiaSemana }) | null;

    return regla;
  }

  private async resolveManualPicoPlacaWarning(params: {
    tenantId: string;
    empresaId: string;
    membershipId: string;
    serviceDate: Date | null;
  }): Promise<PicoPlacaAssignmentWarning | null> {
    const { tenantId, empresaId, membershipId, serviceDate } = params;

    if (!membershipId || !serviceDate) {
      return null;
    }

    const regla = await this.getActivePicoPlacaRule(
      tenantId,
      empresaId,
      serviceDate,
    );

    if (!regla) {
      return null;
    }

    const [empresaMembership] = (await this.prisma.empresaMembership.findMany({
      where: {
        tenantId,
        empresaId,
        membershipId,
        activo: true,
        deletedAt: null,
        role: Role.OPERADOR,
        membership: {
          tenantId,
          role: Role.OPERADOR,
          activo: true,
        },
      },
      include: { membership: true },
      take: 1,
    })) as CandidateWithMembership[];

    if (!empresaMembership?.membership?.placa) {
      return null;
    }

    const evaluation = this.evaluatePicoPlacaRestriction(
      empresaMembership.membership,
      regla,
    );

    if (!evaluation.restricted || evaluation.digit === null) {
      return null;
    }

    const vehiculo = empresaMembership.membership.moto ? 'MOTO' : 'CARRO';
    const dia = regla.dia ?? this.getDiaSemanaFromDate(serviceDate);
    const numerosRestringidos = [regla.numeroUno, regla.numeroDos];

    return {
      type: 'PICO_PLACA',
      message: `Atención: el operador seleccionado tiene Pico y Placa el ${dia}. Placa ${empresaMembership.membership.placa} (${vehiculo}), dígito ${evaluation.digit}. Se permite continuar porque la asignación fue manual.`,
      membershipId,
      empresaId,
      dia,
      placa: empresaMembership.membership.placa,
      digito: evaluation.digit,
      numerosRestringidos,
      vehiculo,
    };
  }

  private async autoAssignTechnician(
    tenantId: string,
    dto: CreateOrdenServicioDto,
    inicio: Date | null,
    fin: Date | null,
  ): Promise<string | null> {
    this.logger.log(
      `AUTO-ASSIGN: Starting process for client ${dto.clienteId} in empresa ${dto.empresaId}`,
    );
    this.logger.log(
      `AUTO-ASSIGN: Time range: ${inicio?.toISOString()} to ${fin?.toISOString()}`,
    );

    if (!inicio || !fin) {
      this.logger.warn('AUTO-ASSIGN: Missing dates, skipping.');
      return null;
    }

    let targetDireccionId = dto.direccionId;

    // 1. Si no hay direcciónId, intentar obtener la primera dirección activa del cliente
    if (!targetDireccionId) {
      this.logger.log(
        'AUTO-ASSIGN: No direccionId in DTO, looking for client default...',
      );
      const cliente = await this.prisma.cliente.findFirst({
        where: { id: dto.clienteId, tenantId },
        include: { direcciones: { where: { activa: true }, take: 1 } },
      });
      if (cliente?.direcciones?.[0]) {
        targetDireccionId = cliente.direcciones[0].id;
        this.logger.log(
          `AUTO-ASSIGN: Using client default address: ${targetDireccionId}`,
        );
      }
    }

    if (!targetDireccionId) {
      this.logger.error(
        'AUTO-ASSIGN: FAILED - No address available for auto-assignment',
      );
      return null;
    }

    // 2. Obtener datos geográficos de la dirección
    const direccion = await this.prisma.direccion.findFirst({
      where: { id: targetDireccionId, tenantId },
      select: {
        zonaId: true,
        municipioId: true,
        municipio: true,
        barrio: true,
      },
    });

    if (!direccion) {
      this.logger.error(
        `AUTO-ASSIGN: FAILED - Address record not found in DB: ${targetDireccionId}`,
      );
      return null;
    }

    this.logger.log(
      `AUTO-ASSIGN: Address details found: ${JSON.stringify(direccion)}`,
    );

    // Diagnóstico: ¿Existen operadores en esta empresa?
    const totalOps = await this.prisma.empresaMembership.count({
      where: {
        tenantId,
        empresaId: dto.empresaId,
        activo: true,
        role: Role.OPERADOR,
        membership: { tenantId, role: Role.OPERADOR, activo: true },
      },
    });
    this.logger.log(
      `AUTO-ASSIGN: Total active OPERADORS in this empresa: ${totalOps}`,
    );

    // 3. Obtener candidatos: Técnicos (OPERADOR) de la misma empresa y municipio/zona
    let candidatos: CandidateWithMembership[] = [];

    // Intento 1: Por Zona
    if (direccion.zonaId) {
      this.logger.log(
        `AUTO-ASSIGN: Searching candidates by Zona: ${direccion.zonaId}`,
      );
      candidatos = (await this.prisma.empresaMembership.findMany({
        where: {
          tenantId,
          empresaId: dto.empresaId,
          zonaId: direccion.zonaId,
          activo: true,
          role: Role.OPERADOR,
          membership: {
            tenantId,
            role: Role.OPERADOR,
            activo: true,
          },
        },
        include: { membership: true },
      })) as CandidateWithMembership[];
      this.logger.log(
        `AUTO-ASSIGN: Found ${candidatos.length} candidates by Zona`,
      );
    }

    // Intento 2: Por Municipio
    if (candidatos.length === 0 && direccion.municipioId) {
      this.logger.log(
        `AUTO-ASSIGN: Searching candidates by Municipio: ${direccion.municipioId}`,
      );
      candidatos = (await this.prisma.empresaMembership.findMany({
        where: {
          tenantId,
          empresaId: dto.empresaId,
          activo: true,
          role: Role.OPERADOR,
          membership: {
            tenantId,
            role: Role.OPERADOR,
            activo: true,
            municipioId: direccion.municipioId,
          },
        },
        include: { membership: true },
      })) as CandidateWithMembership[];
      this.logger.log(
        `AUTO-ASSIGN: Found ${candidatos.length} candidates by Municipio`,
      );
    }

    if (candidatos.length === 0) {
      this.logger.warn(
        'AUTO-ASSIGN: FAILED - No candidates found in this area.',
      );
      return null;
    }

    const diaSemana = this.getDiaSemanaFromDate(inicio);
    this.logger.log(`AUTO-ASSIGN: Day of week: ${diaSemana}`);

    const reglasPicoPlaca = await this.getActivePicoPlacaRule(
      tenantId,
      dto.empresaId,
      inicio,
    );

    if (reglasPicoPlaca) {
      this.logger.log(
        `AUTO-ASSIGN: Pico y Placa rules found: ${JSON.stringify(reglasPicoPlaca)}`,
      );
    }

    const viables: string[] = [];

    for (const c of candidatos) {
      const placa = c.membership?.placa;
      const esMoto = c.membership?.moto;
      this.logger.log(
        `AUTO-ASSIGN: Testing candidate ${c.membershipId} (Placa: ${placa ?? 'N/A'}, Moto: ${esMoto ?? 'N/A'})`,
      );

      // 4. Validar Pico y Placa
      if (reglasPicoPlaca && placa) {
        const picoPlacaEvaluation = this.evaluatePicoPlacaRestriction(
          c.membership,
          reglasPicoPlaca,
        );

        if (picoPlacaEvaluation.restricted) {
          this.logger.log(
            `AUTO-ASSIGN: SKIPPED - Technician ${c.membershipId} has Pico y Placa (${placa})`,
          );
          continue;
        }
      }

      // 5. Validar Disponibilidad
      this.logger.log(
        `AUTO-ASSIGN: Checking overlaps for ${c.membershipId}...`,
      );
      const traslapes = await this.prisma.ordenServicio.count({
        where: {
          tenantId,
          deletedAt: null,
          tecnicoId: c.membershipId,
          OR: [
            { horaInicio: { lte: inicio }, horaFin: { gt: inicio } },
            { horaInicio: { lt: fin }, horaFin: { gte: fin } },
            { horaInicio: { gte: inicio }, horaFin: { lte: fin } },
          ],
        },
      });

      if (traslapes === 0) {
        this.logger.log(`AUTO-ASSIGN: Candidate ${c.membershipId} is VIABLE`);
        viables.push(c.membershipId);
      } else {
        this.logger.log(
          `AUTO-ASSIGN: SKIPPED - Candidate ${c.membershipId} has ${traslapes} overlaps.`,
        );
      }
    }

    if (viables.length === 0) {
      this.logger.warn(
        'AUTO-ASSIGN: FAILED - All candidates are busy or restricted.',
      );
      return null;
    }

    // 6. Balanceo
    this.logger.log(
      `AUTO-ASSIGN: Balancing load between ${viables.length} viable technicians...`,
    );

    // Preparar rango de fecha para conteo
    const startOfDay = startOfBogotaDayUtc(inicio);
    const endOfDay = addBogotaDaysUtc(startOfDay, 1);

    const conteos = await Promise.all(
      viables.map(async (id) => {
        const count = await this.prisma.ordenServicio.count({
          where: {
            tenantId,
            deletedAt: null,
            tecnicoId: id,
            horaInicio: {
              gte: startOfDay,
              lt: endOfDay,
            },
          },
        });
        return { id, count };
      }),
    );

    conteos.sort((a, b) => a.count - b.count);
    const selected = conteos[0]?.id || null;
    this.logger.log(
      `AUTO-ASSIGN: SUCCESS! Selected technician: ${selected} with ${conteos[0]?.count} orders today.`,
    );
    return selected;
  }

  private isUUID(id?: string): boolean {
    if (!id) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    );
  }

  private buildSearchClauses(
    searchToken: string,
  ): Prisma.OrdenServicioWhereInput[] {
    const baseClauses: Prisma.OrdenServicioWhereInput[] = [
      { numeroOrden: { contains: searchToken, mode: 'insensitive' } },
      { direccionTexto: { contains: searchToken, mode: 'insensitive' } },
      { barrio: { contains: searchToken, mode: 'insensitive' } },
      {
        ordenPadre: {
          is: {
            numeroOrden: { contains: searchToken, mode: 'insensitive' },
          },
        },
      },
      { cliente: { nombre: { contains: searchToken, mode: 'insensitive' } } },
      {
        cliente: {
          apellido: { contains: searchToken, mode: 'insensitive' },
        },
      },
      {
        cliente: {
          razonSocial: { contains: searchToken, mode: 'insensitive' },
        },
      },
      {
        cliente: {
          telefono: { contains: searchToken, mode: 'insensitive' },
        },
      },
      {
        cliente: {
          telefono2: { contains: searchToken, mode: 'insensitive' },
        },
      },
      {
        cliente: {
          numeroDocumento: { contains: searchToken, mode: 'insensitive' },
        },
      },
      {
        cliente: {
          registroDocumento: {
            contains: searchToken,
            mode: 'insensitive',
          },
        },
      },
      {
        cliente: {
          nit: { contains: searchToken, mode: 'insensitive' },
        },
      },
      {
        servicio: { nombre: { contains: searchToken, mode: 'insensitive' } },
      },
    ];

    if (this.isUUID(searchToken)) {
      baseClauses.unshift({ id: searchToken });
    }

    const fullNameTokens = searchToken.split(/\s+/).filter(Boolean);

    if (fullNameTokens.length > 1) {
      baseClauses.push({
        AND: fullNameTokens.map((token) => ({
          OR: [
            { cliente: { nombre: { contains: token, mode: 'insensitive' } } },
            {
              cliente: {
                apellido: { contains: token, mode: 'insensitive' },
              },
            },
            {
              cliente: {
                razonSocial: { contains: token, mode: 'insensitive' },
              },
            },
          ],
        })),
      });
    }

    return baseClauses;
  }

  private buildWhereClauseFromAccessFilter(
    accessFilter: PrismaAccessFilter,
    filters?: QueryOrdenesServicioDto,
  ): Prisma.OrdenServicioWhereInput {
    const geoWhere = this.buildOrdenGeoWhere(accessFilter);
    const completedFollowUpFilter: Prisma.OrdenServicioSeguimientoWhereInput = {
      OR: [
        {
          status: {
            in: ['ACEPTADO', 'RECHAZADO'],
          },
        },
        {
          completedAt: {
            not: null,
          },
        },
      ],
    };
    const isFollowUpOnlyPreset = filters?.preset
      ? FOLLOW_UP_ONLY_PRESETS.has(filters.preset)
      : false;

    const whereClause: Prisma.OrdenServicioWhereInput = {
      ...(accessFilter.tenantId ? { tenantId: accessFilter.tenantId } : {}),
      ...(accessFilter.empresaId ? { empresaId: accessFilter.empresaId } : {}),
      ...(geoWhere ?? {}),
      deletedAt: null,
    };

    if (isFollowUpOnlyPreset) {
      whereClause.ordenPadreId = { not: null };
    } else {
      whereClause.OR = [
        {
          ordenPadreId: null,
        },
        {
          ordenPadreId: { not: null },
          tecnicoId: { not: null },
          fechaVisita: { not: null },
          estadoServicio: {
            in: [
              EstadoOrden.PROGRAMADO as EstadoOrden,
              EstadoOrden.PROCESO as EstadoOrden,
              EstadoOrden.TECNICO_FINALIZO as EstadoOrden,
              EstadoOrden.LIQUIDADO as EstadoOrden,
            ],
          },
        },
        {
          ordenPadreId: { not: null },
          seguimientos: {
            some: {
              status: { in: ['ACEPTADO', 'RECHAZADO'] },
            },
            none: {
              status: 'PENDIENTE',
            },
          },
        },
      ];
    }

    if (!filters) return whereClause;

    if (this.isUUID(filters.clienteId)) {
      whereClause.clienteId = filters.clienteId;
    }

    if (filters.sinTecnico) {
      whereClause.tecnicoId = null;
    } else if (this.isUUID(filters.tecnicoId)) {
      whereClause.tecnicoId = filters.tecnicoId;
    }

    if (this.isUUID(filters.creadorId)) {
      whereClause.creadoPorId = filters.creadorId;
    }

    if (this.isUUID(filters.metodoPagoId)) {
      whereClause.metodoPagoId = filters.metodoPagoId;
    }

    const metodoPagoBases = [
      ...(filters.metodoPagoBase ? [filters.metodoPagoBase] : []),
      ...(filters.metodosPagoBase || []).filter(Boolean),
    ];

    if (metodoPagoBases.length > 0) {
      const metodoPagoLegacyClauses = metodoPagoBases.flatMap(
        (metodoPagoBase): Prisma.OrdenServicioWhereInput[] => [
          {
            desglosePago: {
              string_contains: metodoPagoBase,
            },
          },
          {
            metodoPago: {
              is: {
                nombre: {
                  contains: metodoPagoBase,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            },
          },
        ],
      );

      const metodoPagoClauses: Prisma.OrdenServicioWhereInput[] = [
        {
          metodosPagoBase: {
            hasSome: metodoPagoBases,
          },
        },
        ...metodoPagoLegacyClauses,
      ];

      const andClauses = Array.isArray(whereClause.AND)
        ? [...whereClause.AND, { OR: metodoPagoClauses }]
        : [{ OR: metodoPagoClauses }];

      whereClause.AND = andClauses;
    }

    if (filters.estadoPago) {
      whereClause.estadoPago = filters.estadoPago;
    }

    if (filters.estado) {
      whereClause.estadoServicio = filters.estado;
    }

    if (filters.urgencia) {
      whereClause.urgencia = filters.urgencia;
    }

    if (filters.municipio) {
      whereClause.municipio = {
        equals: filters.municipio.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.departamento) {
      whereClause.departamento = {
        equals: filters.departamento.trim(),
        mode: 'insensitive',
      };
    }

    if (filters.tipoVisita) {
      whereClause.tipoVisita = filters.tipoVisita;
    }

    const dateStart = toDayBoundsFromIso(filters.fechaInicio)?.start;
    const dateEnd = toDayBoundsFromIso(filters.fechaFin)?.end;
    const presetRange = applyPresetRange(filters.preset);

    const gte =
      dateStart ||
      (presetRange && 'start' in presetRange ? presetRange.start : undefined);
    const lte = dateEnd || (presetRange ? presetRange.end : undefined);

    if (gte || lte) {
      whereClause.fechaVisita = {
        ...(gte ? { gte } : {}),
        ...(lte ? { lte } : {}),
      };
    }

    if (filters.preset === ServiciosPreset.SIN_TECNICO) {
      whereClause.tecnicoId = null;
    }

    if (filters.preset === ServiciosPreset.PENDIENTES_LIQUIDAR) {
      whereClause.estadoServicio = EstadoOrden.TECNICO_FINALIZO as EstadoOrden;
    }

    if (filters.preset === ServiciosPreset.RECHAZADOS) {
      whereClause.seguimientos = {
        some: {
          status: 'RECHAZADO',
        },
      };
    }

    if (filters.preset === ServiciosPreset.ACCIONES_PENDIENTES) {
      whereClause.seguimientos = {
        some: {
          status: 'PENDIENTE',
        },
      };
    }

    if (filters.preset === ServiciosPreset.SEGUIMIENTOS_CON_LLAMADAS) {
      whereClause.seguimientos = {
        some: completedFollowUpFilter,
      };
    }

    if (filters.preset === ServiciosPreset.SEGUIMIENTOS_SIN_LLAMADAS) {
      whereClause.seguimientos = {
        none: completedFollowUpFilter,
      };
    }

    if (filters.preset === ServiciosPreset.VENCIDOS) {
      const todayStart = toLocalDayRange(new Date()).start;
      const fechaVisitaFilter =
        whereClause.fechaVisita &&
        typeof whereClause.fechaVisita === 'object' &&
        !Array.isArray(whereClause.fechaVisita)
          ? whereClause.fechaVisita
          : {};
      whereClause.fechaVisita = {
        ...fechaVisitaFilter,
        lt: todayStart,
      };
      whereClause.NOT = {
        estadoServicio: {
          in: [
            EstadoOrden.LIQUIDADO,
            EstadoOrden.CANCELADO,
            EstadoOrden.SIN_CONCRETAR,
          ],
        },
      };
    }

    return whereClause;
  }

  private resolveExportAccessFilter(
    user: JwtPayload,
    dto: ExportOrdenesServicioDto,
  ): PrismaAccessFilter {
    const baseFilter = getPrismaAccessFilter(user);
    const requestedIds = Array.from(
      new Set((dto.empresaIds || []).filter((id) => this.isUUID(id))),
    );

    if (dto.includeAllEmpresas || requestedIds.length === 0) {
      return baseFilter;
    }

    if (user.isGlobalSuAdmin || hasTenantWideAccess(user)) {
      return {
        ...baseFilter,
        empresaId: { in: requestedIds },
      };
    }

    const allowedIds = user.empresaIds || [];
    const scopedIds = requestedIds.filter((id) => allowedIds.includes(id));

    if (scopedIds.length !== requestedIds.length || scopedIds.length === 0) {
      throw new ForbiddenException(
        'No tienes acceso a una o más empresas solicitadas para la exportación',
      );
    }

    return {
      ...baseFilter,
      empresaId: { in: scopedIds },
    };
  }

  private getExportPaymentMethodLabel(orden: {
    desglosePago?: Prisma.JsonValue | null;
    metodoPago?: { nombre?: string | null } | null;
  }): string {
    const rawBreakdown = Array.isArray(orden.desglosePago)
      ? (orden.desglosePago as Array<{ metodo?: string }>)
      : [];
    const breakdownMethods = Array.from(
      new Set(
        rawBreakdown
          .map((item) => item?.metodo?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (breakdownMethods.length > 0) {
      return breakdownMethods.join(' + ');
    }

    return orden.metodoPago?.nombre?.trim() || 'NO DEFINIDO';
  }

  private getExportClientDocumentLabel(cliente: {
    tipoDocumento?: string | null;
    numeroDocumento?: string | null;
    registroDocumento?: string | null;
    nit?: string | null;
  }): string | null {
    const documentNumber =
      cliente.numeroDocumento?.trim() ||
      cliente.registroDocumento?.trim() ||
      cliente.nit?.trim();

    if (!documentNumber) {
      return null;
    }

    const documentType = cliente.tipoDocumento?.trim();
    return documentType ? `${documentType} ${documentNumber}` : documentNumber;
  }

  private getExportSelectedServicesLabel(
    value?: Prisma.JsonValue | null,
  ): string | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const selectedServices = value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }

        if (this.isRecord(item) && typeof item.nombre === 'string') {
          return item.nombre.trim();
        }

        return '';
      })
      .filter((item) => item.length > 0);

    return selectedServices.length > 0 ? selectedServices.join(', ') : null;
  }

  private buildWhereClause(
    user: JwtPayload,
    reqEmpresaId: string | undefined,
    filters?: QueryOrdenesServicioDto,
  ): Promise<Prisma.OrdenServicioWhereInput> {
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const whereClause = this.buildWhereClauseFromAccessFilter(
      accessFilter,
      filters,
    );

    return this.applySearchFilter(whereClause, accessFilter, filters?.search);
  }

  private async resolveOrderSearchIds(
    accessFilter: PrismaAccessFilter,
    searchToken?: string,
  ): Promise<string[]> {
    const normalizedToken = normalizeSearchToken(searchToken);
    if (!normalizedToken || !accessFilter.tenantId) {
      return [];
    }

    const pattern = `%${normalizedToken}%`;
    const empresaFilter = accessFilter.empresaId
      ? Prisma.sql`AND os."empresaId" = ${accessFilter.empresaId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        SELECT DISTINCT os.id::text AS id
        FROM "ordenes_servicio" AS os
        LEFT JOIN "ordenes_servicio" AS parent
          ON parent.id = os."ordenPadreId"
        WHERE os."tenantId" = ${accessFilter.tenantId}::uuid
          ${empresaFilter}
          AND os."deletedAt" IS NULL
          AND (
            os.id::text ILIKE ${pattern}
            OR COALESCE(os."numeroOrden", '') ILIKE ${pattern}
            OR COALESCE(parent.id::text, '') ILIKE ${pattern}
            OR COALESCE(parent."numeroOrden", '') ILIKE ${pattern}
          )
        LIMIT 100
      `,
    );

    return rows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  private async applySearchFilter(
    whereClause: Prisma.OrdenServicioWhereInput,
    accessFilter: PrismaAccessFilter,
    search?: string,
  ): Promise<Prisma.OrdenServicioWhereInput> {
    const searchToken = normalizeSearchToken(search);
    if (!searchToken) {
      return whereClause;
    }

    const searchClauses = this.buildSearchClauses(searchToken);
    const matchedOrderIds = await this.resolveOrderSearchIds(
      accessFilter,
      searchToken,
    );

    if (matchedOrderIds.length > 0) {
      searchClauses.push(
        { id: { in: matchedOrderIds } },
        { ordenPadreId: { in: matchedOrderIds } },
      );
    }

    if (Array.isArray(whereClause.OR) && whereClause.OR.length > 0) {
      const baseOrClauses = [...whereClause.OR];
      const andClauses = Array.isArray(whereClause.AND)
        ? [...whereClause.AND]
        : [];

      andClauses.push({ OR: baseOrClauses }, { OR: searchClauses });

      return {
        ...whereClause,
        AND: andClauses,
        OR: undefined,
      };
    }

    return {
      ...whereClause,
      OR: searchClauses,
    };
  }

  private combineOrdenWhereClauses(
    ...clauses: Array<Prisma.OrdenServicioWhereInput | undefined>
  ): Prisma.OrdenServicioWhereInput {
    const validClauses = clauses.filter(
      (clause): clause is Prisma.OrdenServicioWhereInput => Boolean(clause),
    );

    if (validClauses.length === 0) {
      return {};
    }

    if (validClauses.length === 1) {
      return validClauses[0];
    }

    return {
      AND: validClauses,
    };
  }

  async findAll(
    user: JwtPayload,
    empresaId?: string,
    filters?: QueryOrdenesServicioDto,
  ) {
    const whereClause = await this.buildWhereClause(user, empresaId, filters);

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;
    const dateSortOrder = filters?.dateSortOrder ?? DateSortOrder.DESC;
    const includeFollowUps = shouldIncludeFollowUpListData(filters);

    const totalPromise = this.prisma.ordenServicio.count({
      where: whereClause,
    });
    const ordenesPromise = this.prisma.ordenServicio.findMany({
      where: whereClause,
      skip,
      take: limit,
      include: {
        cliente: true,
        tecnico: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        servicio: true,
        creadoPor: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        metodoPago: true,
        entidadFinanciera: true,
        liquidadoPor: {
          include: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        empresa: true,
        zona: true,
        direccion: true,
        declaracionEfectivo: {
          select: { id: true },
        },
        consignacionOrden: {
          select: { id: true },
        },
        seguimientos: includeFollowUps
          ? {
              orderBy: { createdAt: 'desc' },
            }
          : false,
        ordenPadre: {
          select: {
            id: true,
            numeroOrden: true,
          },
        },
        ordenesHijas: includeFollowUps
          ? {
              where: {
                deletedAt: null,
              },
              include: {
                cliente: true,
                tecnico: {
                  include: {
                    user: {
                      select: {
                        nombre: true,
                        apellido: true,
                      },
                    },
                  },
                },
                servicio: true,
                creadoPor: {
                  include: {
                    user: {
                      select: {
                        nombre: true,
                        apellido: true,
                      },
                    },
                  },
                },
                metodoPago: true,
                entidadFinanciera: true,
                liquidadoPor: {
                  include: {
                    user: {
                      select: {
                        nombre: true,
                        apellido: true,
                      },
                    },
                  },
                },
                empresa: true,
                zona: true,
                direccion: true,
                seguimientos: {
                  orderBy: { createdAt: 'desc' },
                },
                ordenPadre: {
                  select: {
                    id: true,
                    numeroOrden: true,
                  },
                },
              },
              orderBy: { fechaVisita: 'asc' },
            }
          : false,
      },
      orderBy: [
        { fechaVisita: { sort: dateSortOrder, nulls: 'last' } },
        { createdAt: dateSortOrder },
      ],
    });
    const kpisPromise = filters?.includeKpis
      ? this.buildKpisFromWhere(whereClause, totalPromise)
      : Promise.resolve(undefined);

    const [total, ordenes, kpis] = await Promise.all([
      totalPromise,
      ordenesPromise,
      kpisPromise,
    ]);

    const data = includeFollowUps
      ? await Promise.all(
          ordenes.map((o) =>
            this.processSignedUrls(o as OrdenWithGeolocalizaciones),
          ),
        )
      : ordenes.map((o) => this.addDerivedServiceFields(o as OrdenReadPayload));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      ...(kpis ? { kpis } : {}),
    };
  }

  private async buildKpisFromWhere(
    whereClause: Prisma.OrdenServicioWhereInput,
    totalSource?: number | Promise<number>,
  ): Promise<ServiciosKpiPayload> {
    const todayRange = toLocalDayRange(new Date());
    const totalPromise =
      typeof totalSource === 'number'
        ? Promise.resolve(totalSource)
        : totalSource ||
          this.prisma.ordenServicio.count({
            where: whereClause,
          });

    const [
      total,
      programadosHoy,
      enCurso,
      vencidosSla,
      liquidadoStats,
      tecnicoFinalizado,
      recaudoHoyStats,
      sinEvidencia,
    ] = await Promise.all([
      totalPromise,
      this.prisma.ordenServicio.count({
        where: this.combineOrdenWhereClauses(whereClause, {
          estadoServicio: EstadoOrden.PROGRAMADO as EstadoOrden,
          fechaVisita: {
            gte: todayRange.start,
            lte: todayRange.end,
          },
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.combineOrdenWhereClauses(whereClause, {
          estadoServicio: EstadoOrden.PROCESO as EstadoOrden,
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.combineOrdenWhereClauses(whereClause, {
          fechaVisita: {
            lt: todayRange.start,
          },
          NOT: {
            estadoServicio: {
              in: [
                EstadoOrden.LIQUIDADO,
                EstadoOrden.CANCELADO,
                EstadoOrden.SIN_CONCRETAR,
              ],
            },
          },
        }),
      }),
      this.prisma.ordenServicio.aggregate({
        where: this.combineOrdenWhereClauses(whereClause, {
          estadoServicio: EstadoOrden.LIQUIDADO as EstadoOrden,
        }),
        _count: {
          _all: true,
        },
        _avg: {
          valorCotizado: true,
        },
      }),
      this.prisma.ordenServicio.count({
        where: this.combineOrdenWhereClauses(whereClause, {
          estadoServicio: EstadoOrden.TECNICO_FINALIZO as EstadoOrden,
        }),
      }),
      this.prisma.ordenServicio.aggregate({
        where: this.combineOrdenWhereClauses(whereClause, {
          fechaPago: {
            gte: todayRange.start,
            lte: todayRange.end,
          },
        }),
        _sum: {
          valorPagado: true,
        },
      }),
      this.prisma.ordenServicio.count({
        where: this.combineOrdenWhereClauses(whereClause, {
          evidenciaPath: null,
          evidencias: {
            none: {},
          },
          geolocalizaciones: {
            none: {},
          },
        }),
      }),
    ]);

    const liquidado = liquidadoStats._count._all;
    const recaudoHoy = Number(recaudoHoyStats._sum.valorPagado || 0);

    const cumplimientoSlaPct =
      total > 0
        ? Number((((total - vencidosSla) / total) * 100).toFixed(2))
        : 0;

    const liquidationBase = liquidado + tecnicoFinalizado;
    const porcentajeLiquidacion =
      liquidationBase > 0
        ? Number(((liquidado / liquidationBase) * 100).toFixed(2))
        : 0;

    const ticketPromedio =
      liquidado > 0
        ? Number(Number(liquidadoStats._avg.valorCotizado || 0).toFixed(2))
        : 0;

    const payload: ServiciosKpiPayload = {
      total,
      programadosHoy,
      enCurso,
      vencidosSla,
      cumplimientoSlaPct,
      porcentajeLiquidacion,
      recaudoHoy,
      ticketPromedio,
      sinEvidencia,
    };

    return payload;
  }

  async getKpis(
    user: JwtPayload,
    empresaId?: string,
    filters?: QueryOrdenesServicioDto,
  ): Promise<ServiciosKpiPayload> {
    const accessFilter = getPrismaAccessFilter(user, empresaId);
    const cacheKey = this.buildServiciosKpisCacheKey(accessFilter, filters);
    const shouldRefresh = filters?.refresh === true;

    if (!shouldRefresh) {
      const cached = await this.getServiciosKpisFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const whereClause = await this.buildWhereClause(user, empresaId, filters);
    const payload = await this.buildKpisFromWhere(whereClause);

    await this.setServiciosKpisCache(cacheKey, payload);

    return payload;
  }

  async export(
    user: JwtPayload,
    dto: ExportOrdenesServicioDto,
  ): Promise<ServicioExportPayload[]> {
    const getClienteLabel = (cliente: {
      tipoCliente: string;
      nombre: string | null;
      apellido: string | null;
      razonSocial: string | null;
    }) =>
      cliente.tipoCliente === 'EMPRESA'
        ? cliente.razonSocial || 'Empresa'
        : [cliente.nombre, cliente.apellido].filter(Boolean).join(' ').trim() ||
          'Cliente';

    const getUserLabel = (
      person:
        | {
            user?: {
              nombre: string | null;
              apellido: string | null;
            } | null;
          }
        | null
        | undefined,
      fallback: string,
    ) =>
      [person?.user?.nombre, person?.user?.apellido]
        .filter(Boolean)
        .join(' ')
        .trim() || fallback;

    const accessFilter = this.resolveExportAccessFilter(user, dto);
    const whereClauseBase = this.buildWhereClauseFromAccessFilter(
      accessFilter,
      {
        search: dto.search,
        estado: dto.estado,
        estadoPago: dto.estadoPago,
        metodoPagoId: dto.metodoPagoId,
        metodoPagoBase: dto.metodoPagoBase,
        metodosPagoBase: dto.metodosPagoBase,
        tecnicoId: dto.tecnicoId,
        sinTecnico: dto.sinTecnico,
        urgencia: dto.urgencia,
        creadorId: dto.creadorId,
        municipio: dto.municipio,
        departamento: dto.departamento,
        tipoVisita: dto.tipoVisita,
        fechaInicio: dto.fechaInicio,
        fechaFin: dto.fechaFin,
        ...(dto.preset ? { preset: dto.preset } : {}),
      } as QueryOrdenesServicioDto,
    );
    const whereClause = await this.applySearchFilter(
      whereClauseBase,
      accessFilter,
      dto.search,
    );

    const ordenes = await this.prisma.ordenServicio.findMany({
      where: whereClause,
      orderBy: [{ fechaVisita: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        numeroOrden: true,
        ordenPadreId: true,
        empresa: { select: { nombre: true } },
        cliente: {
          select: {
            tipoCliente: true,
            nombre: true,
            apellido: true,
            razonSocial: true,
            tipoDocumento: true,
            numeroDocumento: true,
            registroDocumento: true,
            nit: true,
            telefono: true,
            telefono2: true,
            correo: true,
          },
        },
        servicio: { select: { nombre: true } },
        serviciosSeleccionados: true,
        fechaVisita: true,
        horaInicio: true,
        tecnico: {
          select: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        tipoVisita: true,
        estadoServicio: true,
        estadoPago: true,
        urgencia: true,
        valorCotizado: true,
        valorPagado: true,
        desglosePago: true,
        metodoPago: { select: { nombre: true } },
        municipio: true,
        departamento: true,
        direccionTexto: true,
        linkMaps: true,
        barrio: true,
        piso: true,
        bloque: true,
        unidad: true,
        zona: { select: { nombre: true } },
        direccion: {
          select: {
            direccion: true,
            barrio: true,
            municipio: true,
            linkMaps: true,
            piso: true,
            bloque: true,
            unidad: true,
            tipoUbicacion: true,
          },
        },
        observacion: true,
        observacionFinal: true,
        condicionesHigiene: true,
        condicionesLocal: true,
        diagnosticoTecnico: true,
        hallazgosEstructurales: true,
        intervencionRealizada: true,
        recomendacionesObligatorias: true,
        creadoPor: {
          select: {
            user: {
              select: {
                nombre: true,
                apellido: true,
              },
            },
          },
        },
        ordenesHijas: {
          where: {
            deletedAt: null,
          },
          orderBy: [{ fechaVisita: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            numeroOrden: true,
            cliente: {
              select: {
                tipoCliente: true,
                nombre: true,
                apellido: true,
                razonSocial: true,
              },
            },
            servicio: { select: { nombre: true } },
            fechaVisita: true,
            horaInicio: true,
            tecnico: {
              select: {
                user: {
                  select: {
                    nombre: true,
                    apellido: true,
                  },
                },
              },
            },
            tipoVisita: true,
            estadoServicio: true,
            direccionTexto: true,
            barrio: true,
            municipio: true,
            departamento: true,
            piso: true,
            bloque: true,
            unidad: true,
            direccion: {
              select: {
                barrio: true,
                piso: true,
                bloque: true,
                unidad: true,
                tipoUbicacion: true,
              },
            },
            seguimientos: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                status: true,
                followUpType: true,
                dueAt: true,
                contactedAt: true,
                completedAt: true,
                channel: true,
                outcome: true,
                notes: true,
              },
            },
          },
        },
        ordenPadre: {
          select: {
            id: true,
            numeroOrden: true,
            empresa: { select: { nombre: true } },
            cliente: {
              select: {
                tipoCliente: true,
                nombre: true,
                apellido: true,
                razonSocial: true,
              },
            },
            servicio: { select: { nombre: true } },
          },
        },
        seguimientos: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            status: true,
            followUpType: true,
            dueAt: true,
            contactedAt: true,
            completedAt: true,
            channel: true,
            outcome: true,
            notes: true,
          },
        },
        createdAt: true,
      },
    });

    return ordenes.map((orden) => {
      const cliente = getClienteLabel(orden.cliente);
      const documentoCliente = this.getExportClientDocumentLabel(orden.cliente);
      const tecnico = getUserLabel(orden.tecnico, 'Sin asignar');
      const creador = getUserLabel(orden.creadoPor, 'Sin creador');
      const latestTracking = orden.seguimientos[0];
      const parentId = orden.ordenPadreId || null;
      const parentNumeroOrden = orden.ordenPadre
        ? orden.ordenPadre.numeroOrden ||
          orden.ordenPadre.id.slice(0, 8).toUpperCase()
        : parentId
          ? parentId.slice(0, 8).toUpperCase()
          : null;

      return {
        numeroOrden: orden.numeroOrden || orden.id.slice(0, 8).toUpperCase(),
        empresa: orden.empresa?.nombre || 'Sin empresa',
        cliente,
        documentoCliente,
        telefonoCliente: orden.cliente.telefono || null,
        telefono2Cliente: orden.cliente.telefono2 || null,
        correoCliente: orden.cliente.correo || null,
        servicio: orden.servicio?.nombre || 'Servicio General',
        serviciosSeleccionados: this.getExportSelectedServicesLabel(
          orden.serviciosSeleccionados,
        ),
        tipoServicio: orden.tipoVisita || null,
        zona: orden.zona?.nombre || null,
        fechaVisita: orden.fechaVisita?.toISOString() || null,
        horaInicio: orden.horaInicio?.toISOString() || null,
        tecnico,
        tipoVisita: orden.tipoVisita || null,
        estadoServicio: orden.estadoServicio || null,
        estadoPago: orden.estadoPago || null,
        urgencia: orden.urgencia || null,
        valorCotizado: Number(orden.valorCotizado || 0),
        valorPagado: Number(orden.valorPagado || 0),
        metodoPago: this.getExportPaymentMethodLabel(orden),
        municipio: orden.municipio || null,
        departamento: orden.departamento || null,
        direccion: orden.direccionTexto || orden.direccion?.direccion || null,
        linkMaps: orden.linkMaps || orden.direccion?.linkMaps || null,
        barrio: orden.barrio || orden.direccion?.barrio || null,
        piso: orden.piso || orden.direccion?.piso || null,
        bloque: orden.bloque || orden.direccion?.bloque || null,
        unidad: orden.unidad || orden.direccion?.unidad || null,
        tipoUbicacion: orden.direccion?.tipoUbicacion || null,
        creador,
        creadaEn: orden.createdAt.toISOString(),
        observacion: orden.observacion || null,
        observacionFinal: orden.observacionFinal || null,
        condicionesHigiene: orden.condicionesHigiene || null,
        condicionesLocal: orden.condicionesLocal || null,
        diagnosticoTecnico: orden.diagnosticoTecnico || null,
        hallazgosEstructurales: orden.hallazgosEstructurales || null,
        intervencionRealizada: orden.intervencionRealizada || null,
        recomendacionesObligatorias: orden.recomendacionesObligatorias || null,
        parentId,
        parentNumeroOrden,
        parentEmpresa: orden.ordenPadre?.empresa?.nombre || null,
        parentCliente: orden.ordenPadre
          ? getClienteLabel(orden.ordenPadre.cliente)
          : null,
        parentServicio: orden.ordenPadre?.servicio?.nombre || null,
        seguimientoEstado: latestTracking?.status || null,
        seguimientoTipo: latestTracking?.followUpType || null,
        seguimientoVenceEn: latestTracking?.dueAt?.toISOString() || null,
        seguimientoGestionadoEn:
          latestTracking?.completedAt?.toISOString() ||
          latestTracking?.contactedAt?.toISOString() ||
          null,
        seguimientoCanal: latestTracking?.channel || null,
        seguimientoResultado: latestTracking?.outcome || null,
        seguimientoNotas: latestTracking?.notes || null,
        followUps: orden.ordenesHijas.map((followUp) => {
          const latestTracking = followUp.seguimientos[0];

          return {
            numeroOrden:
              followUp.numeroOrden || followUp.id.slice(0, 8).toUpperCase(),
            cliente: getClienteLabel(followUp.cliente),
            servicio: followUp.servicio?.nombre || 'Servicio General',
            fechaVisita: followUp.fechaVisita?.toISOString() || null,
            horaInicio: followUp.horaInicio?.toISOString() || null,
            tecnico: getUserLabel(followUp.tecnico, 'Sin asignar'),
            tipoVisita: followUp.tipoVisita || null,
            estadoServicio: followUp.estadoServicio || null,
            direccion: followUp.direccionTexto || null,
            barrio: followUp.barrio || followUp.direccion?.barrio || null,
            municipio: followUp.municipio || null,
            departamento: followUp.departamento || null,
            piso: followUp.piso || followUp.direccion?.piso || null,
            bloque: followUp.bloque || followUp.direccion?.bloque || null,
            unidad: followUp.unidad || followUp.direccion?.unidad || null,
            tipoUbicacion: followUp.direccion?.tipoUbicacion || null,
            seguimientoEstado: latestTracking?.status || null,
            seguimientoTipo: latestTracking?.followUpType || null,
            seguimientoVenceEn: latestTracking?.dueAt?.toISOString() || null,
            seguimientoGestionadoEn:
              latestTracking?.completedAt?.toISOString() ||
              latestTracking?.contactedAt?.toISOString() ||
              null,
            seguimientoCanal: latestTracking?.channel || null,
            seguimientoResultado: latestTracking?.outcome || null,
            seguimientoNotas: latestTracking?.notes || null,
          };
        }),
      };
    });
  }

  private buildEditBootstrapOperatorWhere(
    user: JwtPayload,
    empresaId: string,
  ): Prisma.EmpresaMembershipWhereInput {
    const accessFilter = getPrismaAccessFilter(user, empresaId);

    return {
      activo: true,
      deletedAt: null,
      empresaId,
      ...(accessFilter.tenantId ? { tenantId: accessFilter.tenantId } : {}),
      ...(accessFilter.zonaIds?.length
        ? {
            zonaId: { in: accessFilter.zonaIds },
          }
        : {}),
      membership: {
        role: Role.OPERADOR,
        activo: true,
      },
    };
  }

  async findEditBootstrap(user: JwtPayload, id: string) {
    const accessFilter = getPrismaAccessFilter(user);
    const geoWhere = this.buildOrdenGeoWhere(accessFilter);

    const orden: OrdenEditBootstrapRow | null =
      await this.prisma.ordenServicio.findFirst({
        where: {
          id,
          ...(accessFilter.tenantId ? { tenantId: accessFilter.tenantId } : {}),
          ...(accessFilter.empresaId
            ? { empresaId: accessFilter.empresaId }
            : {}),
          ...(geoWhere ?? {}),
          deletedAt: null,
        },
        select: ordenEditBootstrapSelect,
      });

    if (!orden) {
      throw new BadRequestException(
        'La orden especificada no existe o no tienes acceso',
      );
    }

    const [operadoresRaw, servicios] = await Promise.all([
      this.prisma.empresaMembership.findMany({
        where: this.buildEditBootstrapOperatorWhere(user, orden.empresaId),
        select: {
          membership: {
            select: {
              id: true,
              user: {
                select: {
                  nombre: true,
                  apellido: true,
                  telefono: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.servicio.findMany({
        where: {
          tenantId: orden.tenantId,
          empresaId: orden.empresaId,
          deleteAt: null,
        },
        orderBy: { nombre: 'asc' },
        select: {
          id: true,
          nombre: true,
        },
      }),
    ]);

    const operadores = operadoresRaw.map((operator) => ({
      id: operator.membership.id,
      nombre:
        `${operator.membership.user.nombre ?? ''} ${operator.membership.user.apellido ?? ''}`.trim(),
      telefono: operator.membership.user.telefono ?? undefined,
    }));

    const currentTecnico = orden.tecnico;

    if (
      currentTecnico &&
      !operadores.some((operator) => operator.id === currentTecnico.id)
    ) {
      operadores.unshift({
        id: currentTecnico.id,
        nombre:
          `${currentTecnico.user?.nombre ?? ''} ${currentTecnico.user?.apellido ?? ''}`.trim() ||
          'Operador actual',
        telefono: currentTecnico.user?.telefono ?? undefined,
      });
    }

    const ordenWithDerived = this.addDerivedServiceFields(orden);
    const { cliente } = ordenWithDerived;
    const ordenData: Partial<typeof ordenWithDerived> = {
      ...ordenWithDerived,
    };
    delete ordenData.cliente;
    delete ordenData.tecnico;
    delete ordenData.tenantId;

    return {
      orden: ordenData,
      cliente,
      operadores,
      servicios,
    };
  }

  async findOne(user: JwtPayload, id: string) {
    const accessFilter = getPrismaAccessFilter(user);
    const geoWhere = this.buildOrdenGeoWhere(accessFilter);

    const orden = await this.prisma.ordenServicio.findFirst({
      where: {
        id,
        ...(accessFilter.tenantId ? { tenantId: accessFilter.tenantId } : {}),
        ...(accessFilter.empresaId
          ? { empresaId: accessFilter.empresaId }
          : {}),
        ...(geoWhere ?? {}),
        deletedAt: null,
      },
      include: {
        cliente: {
          include: {
            direcciones: true,
          },
        },
        tecnico: {
          include: { user: true },
        },
        servicio: true,
        entidadFinanciera: true,
        liquidadoPor: {
          include: { user: true },
        },
        declaracionEfectivo: {
          select: { id: true },
        },
        consignacionOrden: {
          select: { id: true },
        },
        evidencias: true,
        geolocalizaciones: {
          include: {
            membership: {
              include: {
                user: {
                  select: {
                    nombre: true,
                    apellido: true,
                  },
                },
              },
            },
          },
          orderBy: { llegada: 'desc' },
        },
      },
    });

    if (!orden) {
      throw new BadRequestException(
        'La orden especificada no existe o no tienes acceso',
      );
    }

    return this.processSignedUrls(orden as OrdenReadPayload);
  }

  async addEvidence(
    tenantId: string,
    id: string,
    files: Array<{ buffer: Buffer; mimetype: string; originalname: string }>,
  ) {
    const orden = await this.prisma.ordenServicio.findFirst({
      where: { id, tenantId, deletedAt: null },
    });

    if (!orden) {
      throw new BadRequestException('La orden especificada no existe');
    }

    const uploadedEvidences: EvidenciaServicio[] = [];

    for (const file of files) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const filePath = `EvidenciaOrdenServicio/${id}/${fileName}`;

      let finalBuffer = file.buffer;
      let finalMimeType = file.mimetype;

      // Compress only images
      if (file.mimetype.startsWith('image/')) {
        try {
          finalBuffer = await sharp(file.buffer)
            .resize(1280, 1280, {
              fit: 'inside',
              withoutEnlargement: true,
            })
            .jpeg({ quality: 80 })
            .toBuffer();
          finalMimeType = 'image/jpeg';
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Error compressing image ${file.originalname}: ${errorMessage}`,
          );
          // Fallback to original buffer if compression fails
          finalBuffer = file.buffer;
        }
      }

      const uploadedPath = await this.supabase.uploadFile(
        filePath,
        finalBuffer,
        finalMimeType,
      );

      if (uploadedPath) {
        const evidence = await this.prisma.evidenciaServicio.create({
          data: {
            tenantId,
            ordenServicioId: id,
            path: uploadedPath,
          },
        });

        // Generar URL firmada/pública para la respuesta inmediata
        const signedUrl = await this.supabase.getSignedUrl(evidence.path);
        if (signedUrl) {
          evidence.path = signedUrl;
        }

        uploadedEvidences.push(evidence);
      }
    }

    this.invalidateServiciosKpisCacheSoon(tenantId);

    return uploadedEvidences;
  }

  private buildStoragePath(
    tenantId: string,
    ordenId: string,
    kind: OrdenUploadKind,
    fileName: string,
  ) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const random = Math.random().toString(36).slice(2, 8);
    const finalName = `${Date.now()}-${random}-${safeName}`;
    return `${tenantId}/ordenes-servicio/${ordenId}/${kind}/${finalName}`;
  }

  async createSignedUploadUrl(
    tenantId: string,
    ordenId: string,
    dto: CreateSignedUploadUrlDto,
  ) {
    const orden = await this.prisma.ordenServicio.findFirst({
      where: { id: ordenId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!orden) {
      throw new BadRequestException('La orden especificada no existe');
    }

    const path = this.buildStoragePath(
      tenantId,
      ordenId,
      dto.kind,
      dto.fileName,
    );
    const signed = await this.supabase.createSignedUploadUrl(
      path,
      'tenaxis-docs',
      true,
    );

    if (!signed) {
      throw new BadRequestException(
        'No fue posible generar URL firmada para la carga',
      );
    }

    return signed;
  }

  async createSignedDownloadUrl(
    user: JwtPayload,
    ordenId: string,
    dto: CreateSignedDownloadUrlDto,
  ) {
    const accessFilter = getPrismaAccessFilter(user);
    const tenantId = accessFilter.tenantId;
    const requestedPath = this.normalizeTenaxisStoragePath(dto.path);

    if (!tenantId || !requestedPath) {
      throw new BadRequestException('El archivo solicitado no es válido');
    }

    const geoWhere = this.buildOrdenGeoWhere(accessFilter);
    const orden = await this.prisma.ordenServicio.findFirst({
      where: {
        id: ordenId,
        tenantId,
        ...(accessFilter.empresaId
          ? { empresaId: accessFilter.empresaId }
          : {}),
        ...(geoWhere ?? {}),
        deletedAt: null,
      },
      select: {
        facturaPath: true,
        facturaElectronica: true,
        comprobantePago: true,
        evidenciaPath: true,
        evidencias: {
          select: { path: true },
        },
        geolocalizaciones: {
          select: {
            fotoLlegada: true,
            fotoSalida: true,
          },
        },
      },
    });

    if (!orden) {
      throw new BadRequestException(
        'La orden especificada no existe o no tienes acceso',
      );
    }

    const allowedPaths = this.collectOrdenStoragePaths(orden);
    if (!allowedPaths.has(requestedPath)) {
      throw new ForbiddenException('No tienes acceso al archivo solicitado');
    }

    const signedUrl = await this.supabase.getSignedUrl(requestedPath);
    if (!signedUrl) {
      throw new BadRequestException(
        'No fue posible generar el enlace para el archivo',
      );
    }

    return { signedUrl, path: requestedPath };
  }

  async confirmUploadedFiles(
    tenantId: string,
    ordenId: string,
    dto: ConfirmUploadedFilesDto,
  ) {
    const orden = await this.prisma.ordenServicio.findFirst({
      where: { id: ordenId, tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!orden) {
      throw new BadRequestException('La orden especificada no existe');
    }

    if (dto.kind === OrdenUploadKind.EVIDENCIAS) {
      const evidencias = await this.prisma.$transaction(
        dto.paths.map((path) =>
          this.prisma.evidenciaServicio.create({
            data: {
              tenantId,
              ordenServicioId: ordenId,
              path,
            },
          }),
        ),
      );
      const signedEvidencias = await Promise.all(
        evidencias.map(async (item) => {
          const signedUrl = await this.supabase.getSignedUrl(item.path);
          return {
            ...item,
            path: signedUrl || item.path,
          };
        }),
      );
      this.invalidateServiciosKpisCacheSoon(tenantId);
      return signedEvidencias;
    }

    if (dto.kind === OrdenUploadKind.CONSIGNACION_TECNICO) {
      return { paths: dto.paths };
    }

    const field =
      dto.kind === OrdenUploadKind.FACTURA_ELECTRONICA
        ? 'facturaElectronica'
        : 'comprobantePago';

    const updated = await this.prisma.ordenServicio.update({
      where: { id: ordenId },
      data: {
        [field]: dto.paths[0],
      },
    });

    const signedOrden = await this.processSignedUrls(
      updated as OrdenWithGeolocalizaciones,
    );
    this.invalidateServiciosKpisCacheSoon(tenantId);
    return signedOrden;
  }

  async notifyLiquidationWebhook(tenantId: string, dto: NotifyLiquidationDto) {
    // Validate that the order exists and belongs to the tenant
    const where: Prisma.OrdenServicioWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (this.isUUID(dto.idServicio)) {
      where.id = dto.idServicio;
    } else {
      where.numeroOrden = dto.idServicio;
    }

    const orden = await this.prisma.ordenServicio.findFirst({
      where,
      include: { cliente: true },
    });

    if (!orden) {
      throw new ForbiddenException(
        'Servicio no encontrado o no pertenece al tenant',
      );
    }

    // Validate that the phone number matches the stored client data
    if (orden.cliente.telefono !== dto.telefono) {
      this.logger.warn(
        `Security alert: Phone number mismatch in liquidation notification for service ${dto.idServicio}. Expected ${orden.cliente.telefono}, got ${dto.telefono}`,
      );
      throw new ForbiddenException(
        'El teléfono no coincide con el cliente del servicio',
      );
    }

    const webhookUrl = process.env.N8N_LIQUIDADO_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.error('Webhook URL N8N_LIQUIDADO_WEBHOOK_URL not found');
      return { success: false, error: 'Webhook configuration missing' };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...dto,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Liquidation webhook failed: ${response.status} ${errorText}`,
        );
        return { success: false, error: `Failed: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error triggering liquidation webhook: ${message}`);
      return { success: false, error: 'Error triggering webhook' };
    }
  }

  async notifyOperatorWebhook(tenantId: string, dto: NotifyOperatorDto) {
    // Validate that the order exists and belongs to the tenant
    const where: Prisma.OrdenServicioWhereInput = {
      tenantId,
      deletedAt: null,
    };

    if (this.isUUID(dto.idServicio)) {
      where.id = dto.idServicio;
    } else {
      where.numeroOrden = dto.idServicio;
    }

    const orden = await this.prisma.ordenServicio.findFirst({
      where,
      include: { tecnico: { include: { user: true } } },
    });

    if (!orden) {
      throw new ForbiddenException(
        'Servicio no encontrado o no pertenece al tenant',
      );
    }

    // Validate that the phone number matches the stored technical data (if assigned)
    if (
      orden.tecnico?.user?.telefono &&
      orden.tecnico.user.telefono !== dto.telefonoOperador
    ) {
      this.logger.warn(
        `Security alert: Phone number mismatch in operator notification for service ${dto.idServicio}. Expected ${orden.tecnico.user.telefono}, got ${dto.telefonoOperador}`,
      );
      throw new ForbiddenException(
        'El teléfono no coincide con el técnico asignado al servicio',
      );
    }

    const webhookUrl = process.env.N8N_NOTIFICAR_SERVICIO;
    if (!webhookUrl) {
      this.logger.error('Webhook URL N8N_NOTIFICAR_SERVICIO not found');
      return { success: false, error: 'Webhook configuration missing' };
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...dto,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Operator webhook failed: ${response.status} ${errorText}`,
        );
        return { success: false, error: `Failed: ${response.status}` };
      }

      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error triggering operator webhook: ${message}`);
      return { success: false, error: 'Error triggering webhook' };
    }
  }

  private async processSignedUrls(
    orden: OrdenReadPayload,
  ): Promise<OrdenReadPayload & { financialLock: boolean }> {
    const fieldsToSign: SignableField[] = [
      'facturaPath',
      'facturaElectronica',
      'comprobantePago',
      'evidenciaPath',
    ];

    const pathsToSign: string[] = [];

    for (const field of fieldsToSign) {
      const value = orden[field];
      if (value && typeof value === 'string' && !value.startsWith('http')) {
        pathsToSign.push(value);
        continue;
      }

      if (field === 'comprobantePago' && Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && !item.startsWith('http')) {
            pathsToSign.push(item);
            continue;
          }

          if (
            this.isRecord(item) &&
            typeof item.path === 'string' &&
            !item.path.startsWith('http')
          ) {
            pathsToSign.push(item.path);
          }
        }
      }
    }

    if (orden.evidencias) {
      for (const evidence of orden.evidencias) {
        if (evidence.path && !evidence.path.startsWith('http')) {
          pathsToSign.push(evidence.path);
        }
      }
    }

    if (orden.geolocalizaciones) {
      for (const geo of orden.geolocalizaciones) {
        if (geo.fotoLlegada && !geo.fotoLlegada.startsWith('http')) {
          pathsToSign.push(geo.fotoLlegada);
        }
        if (geo.fotoSalida && !geo.fotoSalida.startsWith('http')) {
          pathsToSign.push(geo.fotoSalida);
        }
      }
    }

    if (pathsToSign.length === 0) return this.addDerivedServiceFields(orden);

    const uniquePaths = [...new Set(pathsToSign)];
    const signedUrls = await this.supabase.getSignedUrls(uniquePaths);

    const urlMap = new Map<string, string>();
    uniquePaths.forEach((path, idx) => {
      if (signedUrls[idx]) {
        urlMap.set(path, signedUrls[idx]);
      }
    });

    // Map main fields
    for (const field of fieldsToSign) {
      const value = orden[field];
      if (value && typeof value === 'string' && urlMap.has(value)) {
        orden[field] = urlMap.get(value)!;
        continue;
      }

      if (field === 'comprobantePago' && Array.isArray(value)) {
        orden[field] = value.map((item) => {
          if (typeof item === 'string' && urlMap.has(item)) {
            return urlMap.get(item)!;
          }

          if (
            this.isRecord(item) &&
            typeof item.path === 'string' &&
            urlMap.has(item.path)
          ) {
            return {
              ...item,
              path: urlMap.get(item.path)!,
            };
          }

          return item;
        }) as (typeof orden)[typeof field];
      }
    }

    // Map evidences
    if (orden.evidencias) {
      for (const evidence of orden.evidencias) {
        if (evidence.path && urlMap.has(evidence.path)) {
          evidence.path = urlMap.get(evidence.path)!;
        }
      }
    }

    // Map geolocalizaciones
    if (orden.geolocalizaciones) {
      for (const geo of orden.geolocalizaciones) {
        if (geo.fotoLlegada && urlMap.has(geo.fotoLlegada)) {
          geo.fotoLlegada = urlMap.get(geo.fotoLlegada)!;
        }
        if (geo.fotoSalida && urlMap.has(geo.fotoSalida)) {
          geo.fotoSalida = urlMap.get(geo.fotoSalida)!;
        }
      }
    }

    return this.addDerivedServiceFields(orden);
  }

  private addDerivedServiceFields<
    T extends {
      horaInicio?: Date | null;
      horaFin?: Date | null;
      horaInicioReal?: Date | null;
      horaFinReal?: Date | null;
    } & Partial<OrdenFinancialLockState>,
  >(
    orden: T,
  ): T & {
    duracionMinutos?: number;
    duracionRealMinutos?: number;
    financialLock: boolean;
  } {
    const financialLock = this.isFinanciallyLocked(orden);
    const duracionMinutos =
      orden.horaInicio && orden.horaFin
        ? Math.max(
            0,
            Math.round(
              (orden.horaFin.getTime() - orden.horaInicio.getTime()) / 60000,
            ),
          )
        : undefined;

    if (!orden.horaInicioReal || !orden.horaFinReal) {
      return {
        ...orden,
        ...(typeof duracionMinutos === 'number' ? { duracionMinutos } : {}),
        financialLock,
      };
    }

    const diffMs = orden.horaFinReal.getTime() - orden.horaInicioReal.getTime();
    const duracionRealMinutos = Math.max(0, Math.round(diffMs / 60000));

    return {
      ...orden,
      ...(typeof duracionMinutos === 'number' ? { duracionMinutos } : {}),
      duracionRealMinutos,
      financialLock,
    };
  }

  private async resolveMembershipId(
    tenantId: string,
    performingUser?: JwtPayload,
  ) {
    if (performingUser?.membershipId) {
      return performingUser.membershipId;
    }

    if (!performingUser?.sub) {
      return undefined;
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId: performingUser.sub,
          tenantId,
        },
      },
    });

    return membership?.id;
  }

  private buildScopedOrdenWhere(
    tenantId: string,
    id: string,
    performingUser?: JwtPayload,
  ): Prisma.OrdenServicioWhereInput {
    if (!performingUser) {
      return { id, tenantId, deletedAt: null };
    }

    const accessFilter = getPrismaAccessFilter(performingUser);
    const geoWhere = this.buildOrdenGeoWhere(accessFilter);

    return {
      id,
      tenantId: accessFilter.tenantId ?? tenantId,
      ...(accessFilter.empresaId ? { empresaId: accessFilter.empresaId } : {}),
      ...(geoWhere ?? {}),
      deletedAt: null,
    };
  }

  private hasGeoScope(accessFilter: PrismaAccessFilter): boolean {
    return (
      (accessFilter.zonaIds || []).length > 0 ||
      (accessFilter.municipalityIds || []).length > 0 ||
      (accessFilter.departmentIds || []).length > 0
    );
  }

  private buildOrdenGeoWhere(
    accessFilter: PrismaAccessFilter,
  ): Prisma.OrdenServicioWhereInput | undefined {
    if (!this.hasGeoScope(accessFilter)) {
      return undefined;
    }

    const direccionWhere: Prisma.DireccionWhereInput = {};

    if ((accessFilter.zonaIds || []).length > 0) {
      direccionWhere.zonaId = {
        in: accessFilter.zonaIds,
      };
    }

    if ((accessFilter.municipalityIds || []).length > 0) {
      direccionWhere.municipioId = {
        in: accessFilter.municipalityIds,
      };
    }

    if ((accessFilter.departmentIds || []).length > 0) {
      direccionWhere.departmentId = {
        in: accessFilter.departmentIds,
      };
    }

    return {
      direccion: {
        is: direccionWhere,
      },
    };
  }

  private isFinanciallyLocked(orden: OrdenFinancialLockState): boolean {
    if (orden.consignacionOrden || orden.liquidadoAt) {
      return true;
    }

    return (
      orden.estadoServicio === EstadoOrden.LIQUIDADO ||
      orden.estadoPago === EstadoPagoOrden.CONCILIADO
    );
  }

  private isPaymentStateClosed(estadoPago?: EstadoPagoOrden | null): boolean {
    return (
      estadoPago === EstadoPagoOrden.EFECTIVO_DECLARADO ||
      estadoPago === EstadoPagoOrden.PAGADO ||
      estadoPago === EstadoPagoOrden.CONCILIADO ||
      estadoPago === EstadoPagoOrden.CORTESIA
    );
  }

  private hasDateLikeValue(value: unknown): boolean {
    if (value instanceof Date) {
      return !Number.isNaN(value.getTime());
    }

    return typeof value === 'string' && value.trim().length > 0;
  }

  private hasStoredTransferProofPath(
    comprobantePago?: Prisma.JsonValue | null,
  ): boolean {
    if (typeof comprobantePago === 'string') {
      return Boolean(this.toOptionalString(comprobantePago));
    }

    if (!Array.isArray(comprobantePago)) {
      return false;
    }

    return comprobantePago.some((item) => {
      if (typeof item === 'string') {
        return Boolean(this.toOptionalString(item));
      }

      if (!this.isRecord(item)) {
        return false;
      }

      return Boolean(
        this.toOptionalString(item.path ?? item.comprobantePath ?? item.url),
      );
    });
  }

  private hasStoredTransferSettlementDataForLock(
    orden: Pick<
      OrdenFinancialLockState,
      'comprobantePago' | 'referenciaPago' | 'fechaPago'
    >,
  ): boolean {
    if (Array.isArray(orden.comprobantePago)) {
      const hasStructuredMetadata = orden.comprobantePago.some((item) => {
        if (!this.isRecord(item)) {
          return false;
        }

        return Boolean(
          this.toOptionalString(
            item.path ?? item.comprobantePath ?? item.url,
          ) &&
          this.toOptionalString(item.referenciaPago ?? item.referencia) &&
          this.hasDateLikeValue(item.fechaPago ?? item.fecha),
        );
      });

      if (hasStructuredMetadata) {
        return true;
      }
    }

    return (
      this.hasStoredTransferProofPath(orden.comprobantePago) &&
      Boolean(this.toOptionalString(orden.referenciaPago)) &&
      this.hasDateLikeValue(orden.fechaPago)
    );
  }

  private canCompleteTransferSettlementWhileFinanciallyLocked(
    orden: OrdenFinancialLockState,
    updateDto: UpdateOrdenServicioDto,
  ): boolean {
    const onlyTransferSettlementRepair =
      Array.isArray(updateDto.transferencias) &&
      updateDto.transferencias.length > 0 &&
      updateDto.valorCotizado === undefined &&
      updateDto.metodoPagoId === undefined &&
      updateDto.entidadFinancieraNombre === undefined &&
      updateDto.estadoPago === undefined &&
      updateDto.facturaPath === undefined &&
      updateDto.facturaElectronica === undefined &&
      updateDto.valorPagado === undefined;

    if (!onlyTransferSettlementRepair) {
      return false;
    }

    const allowedEstadoServicioChange =
      updateDto.estadoServicio === undefined ||
      updateDto.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden) ||
      updateDto.estadoServicio ===
        (EstadoOrden.TECNICO_FINALIZO as EstadoOrden);

    if (!allowedEstadoServicioChange) {
      return false;
    }

    const normalizedBreakdown = this.normalizeBreakdown(
      updateDto.desglosePago as
        | Prisma.JsonValue
        | Prisma.InputJsonValue
        | undefined,
    );

    if (
      normalizedBreakdown &&
      normalizedBreakdown.some(
        (line) => line.metodo !== MetodoPagoBase.TRANSFERENCIA,
      )
    ) {
      return false;
    }

    return (
      !orden.liquidadoAt &&
      orden.estadoServicio !== (EstadoOrden.LIQUIDADO as EstadoOrden) &&
      !orden.declaracionEfectivo &&
      !orden.consignacionOrden &&
      orden.estadoPago === EstadoPagoOrden.PAGADO &&
      this.hasStoredTransferProofPath(orden.comprobantePago) &&
      !this.hasStoredTransferSettlementDataForLock(orden)
    );
  }

  private canLiquidateOperationallyWhileFinanciallyLocked(
    orden: OrdenFinancialLockState,
    updateDto: UpdateOrdenServicioDto,
  ): boolean {
    const onlyOperationalLiquidationChange =
      updateDto.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden) &&
      updateDto.valorCotizado === undefined &&
      updateDto.desglosePago === undefined &&
      updateDto.transferencias === undefined &&
      updateDto.metodoPagoId === undefined &&
      updateDto.entidadFinancieraNombre === undefined &&
      updateDto.estadoPago === undefined &&
      updateDto.facturaPath === undefined &&
      updateDto.facturaElectronica === undefined &&
      updateDto.comprobantePago === undefined &&
      updateDto.valorPagado === undefined &&
      updateDto.referenciaPago === undefined &&
      updateDto.fechaPago === undefined;

    return (
      onlyOperationalLiquidationChange &&
      !orden.liquidadoAt &&
      orden.estadoServicio !== (EstadoOrden.LIQUIDADO as EstadoOrden) &&
      !orden.declaracionEfectivo &&
      !orden.consignacionOrden &&
      this.isPaymentStateClosed(orden.estadoPago)
    );
  }

  private hasFinancialMutation(
    orden: {
      estadoServicio?: EstadoOrden | null;
      estadoPago?: EstadoPagoOrden | null;
    },
    updateDto: UpdateOrdenServicioDto,
  ): boolean {
    if (
      updateDto.valorCotizado !== undefined ||
      updateDto.desglosePago !== undefined ||
      updateDto.transferencias !== undefined ||
      updateDto.metodoPagoId !== undefined ||
      updateDto.entidadFinancieraNombre !== undefined ||
      updateDto.estadoPago !== undefined ||
      updateDto.facturaPath !== undefined ||
      updateDto.facturaElectronica !== undefined ||
      updateDto.comprobantePago !== undefined ||
      updateDto.valorPagado !== undefined ||
      updateDto.referenciaPago !== undefined ||
      updateDto.fechaPago !== undefined
    ) {
      return true;
    }

    return (
      updateDto.estadoServicio !== undefined &&
      updateDto.estadoServicio !== orden.estadoServicio
    );
  }

  private normalizeBreakdown(
    value: Prisma.JsonValue | Prisma.InputJsonValue | undefined,
  ): DesglosePagoItem[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const normalized: DesglosePagoItem[] = [];

    for (const item of value) {
      if (!this.isRecord(item)) {
        continue;
      }

      const metodo = this.toOptionalString(item.metodo);
      if (!metodo) {
        continue;
      }

      const monto = Number(item.monto || 0);
      if (!Number.isFinite(monto)) {
        continue;
      }

      normalized.push({
        metodo: metodo as MetodoPagoBase,
        monto,
        banco: this.toOptionalString(item.banco),
        referencia: this.toOptionalString(item.referencia),
        observacion: this.toOptionalString(item.observacion),
      });
    }

    return normalized;
  }

  private normalizeMetodoPagoBaseFromName(
    value?: string | null,
  ): MetodoPagoBase | undefined {
    const normalized = value
      ?.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

    if (!normalized) return undefined;
    if (Object.values(MetodoPagoBase).includes(normalized as MetodoPagoBase)) {
      return normalized as MetodoPagoBase;
    }
    if (normalized.includes('EFECT')) return MetodoPagoBase.EFECTIVO;
    if (normalized.includes('TRANSFER')) return MetodoPagoBase.TRANSFERENCIA;
    if (normalized.includes('CREDI') || normalized.includes('TARJETA')) {
      return MetodoPagoBase.CREDITO;
    }
    if (normalized.includes('BONO')) return MetodoPagoBase.BONO;
    if (normalized.includes('CORT')) return MetodoPagoBase.CORTESIA;
    if (normalized.includes('PEND')) return MetodoPagoBase.PENDIENTE;
    if (normalized.includes('QR')) return MetodoPagoBase.TRANSFERENCIA;

    return undefined;
  }

  private deriveMetodosPagoBase(
    breakdown?: DesglosePagoItem[] | null,
    metodoPagoNombre?: string | null,
  ): MetodoPagoBase[] {
    const resolved = new Set<MetodoPagoBase>();

    for (const item of breakdown ?? []) {
      const normalized = this.normalizeMetodoPagoBaseFromName(item.metodo);
      if (normalized) {
        resolved.add(normalized);
      }
    }

    const normalizedFromCatalog =
      this.normalizeMetodoPagoBaseFromName(metodoPagoNombre);
    if (normalizedFromCatalog) {
      resolved.add(normalizedFromCatalog);
    }

    return Array.from(resolved);
  }

  private async resolveMetodoPagoNombreById(
    tenantId: string,
    empresaId: string,
    metodoPagoId?: string | null,
  ): Promise<string | undefined> {
    if (!this.isUUID(metodoPagoId || undefined)) {
      return undefined;
    }

    const metodoPago = await this.prisma.metodoPago.findFirst({
      where: {
        id: metodoPagoId!,
        tenantId,
        empresaId,
      },
      select: {
        nombre: true,
      },
    });

    return metodoPago?.nombre;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private toOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined;
  }

  private normalizeTenaxisStoragePath(value: unknown): string | undefined {
    const raw = this.toOptionalString(value);
    if (!raw) {
      return undefined;
    }

    if (/^https?:\/\//i.test(raw)) {
      try {
        const url = new URL(raw);
        return this.extractTenaxisStoragePathFromStorageUrl(url.pathname);
      } catch {
        return undefined;
      }
    }

    const cleanPath = raw.split('?')[0].split('#')[0].replace(/^\/+/, '');
    const storageUrlPath =
      this.extractTenaxisStoragePathFromStorageUrl(cleanPath);

    if (storageUrlPath) {
      return storageUrlPath;
    }

    const bucketPrefix = 'tenaxis-docs/';
    const objectPath = cleanPath.startsWith(bucketPrefix)
      ? cleanPath.slice(bucketPrefix.length)
      : cleanPath;

    return this.decodeStoragePath(objectPath);
  }

  private extractTenaxisStoragePathFromStorageUrl(
    pathname: string,
  ): string | undefined {
    const cleanPath = pathname.replace(/^\/+/, '');
    const match = cleanPath.match(
      /^storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
    );

    if (!match || match[1] !== 'tenaxis-docs') {
      return undefined;
    }

    return this.decodeStoragePath(match[2]);
  }

  private decodeStoragePath(path: string): string | undefined {
    const cleanPath = path.replace(/^\/+/, '').trim();
    if (!cleanPath) {
      return undefined;
    }

    try {
      return decodeURIComponent(cleanPath);
    } catch {
      return cleanPath;
    }
  }

  private collectOrdenStoragePaths(orden: {
    facturaPath?: string | null;
    facturaElectronica?: string | null;
    comprobantePago?: Prisma.JsonValue | null;
    evidenciaPath?: string | null;
    evidencias?: Array<{ path?: string | null }>;
    geolocalizaciones?: Array<{
      fotoLlegada?: string | null;
      fotoSalida?: string | null;
    }>;
  }): Set<string> {
    const paths = new Set<string>();

    this.addStoragePathCandidate(paths, orden.facturaPath);
    this.addStoragePathCandidate(paths, orden.facturaElectronica);
    this.addStoragePathCandidate(paths, orden.comprobantePago);
    this.addStoragePathCandidate(paths, orden.evidenciaPath);

    for (const evidencia of orden.evidencias ?? []) {
      this.addStoragePathCandidate(paths, evidencia.path);
    }

    for (const geolocalizacion of orden.geolocalizaciones ?? []) {
      this.addStoragePathCandidate(paths, geolocalizacion.fotoLlegada);
      this.addStoragePathCandidate(paths, geolocalizacion.fotoSalida);
    }

    return paths;
  }

  private addStoragePathCandidate(paths: Set<string>, value: unknown) {
    if (typeof value === 'string') {
      const path = this.normalizeTenaxisStoragePath(value);
      if (path) {
        paths.add(path);
      }
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this.addStoragePathCandidate(paths, item);
      }
      return;
    }

    if (!this.isRecord(value)) {
      return;
    }

    this.addStoragePathCandidate(paths, value.path);
    this.addStoragePathCandidate(paths, value.comprobantePath);
    this.addStoragePathCandidate(paths, value.url);
  }

  private normalizePaymentDate(value: unknown): string | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
      return undefined;
    }

    const parsed = parseFlexibleDateTimeToUtc(value, {
      dateOnlyAsBogotaStart: true,
    });

    if (parsed) {
      return parsed.toISOString();
    }

    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime())
      ? undefined
      : fallback.toISOString();
  }

  private sumTransferPlan(breakdown: DesglosePagoItem[]): number {
    return breakdown
      .filter((line) => line.metodo === MetodoPagoBase.TRANSFERENCIA)
      .reduce((sum, line) => sum + Number(line.monto || 0), 0);
  }

  private sumCashPlan(
    breakdown: DesglosePagoItem[],
    estadoServicio?: EstadoOrden | null,
  ): number {
    if (
      estadoServicio !== EstadoOrden.LIQUIDADO &&
      estadoServicio !== EstadoOrden.TECNICO_FINALIZO
    ) {
      return 0;
    }

    return breakdown
      .filter((line) => line.metodo === MetodoPagoBase.EFECTIVO)
      .reduce((sum, line) => sum + Number(line.monto || 0), 0);
  }

  private sumNonMonetaryCoverage(breakdown: DesglosePagoItem[]): number {
    return breakdown
      .filter(
        (line) =>
          line.metodo === MetodoPagoBase.BONO ||
          line.metodo === MetodoPagoBase.CORTESIA ||
          line.metodo === MetodoPagoBase.CREDITO,
      )
      .reduce((sum, line) => sum + Number(line.monto || 0), 0);
  }

  private inferLegacyTransferAmount(
    orden: {
      valorPagado?: number | Prisma.Decimal | null;
      estadoServicio?: EstadoOrden | null;
    },
    breakdown: DesglosePagoItem[],
  ): number {
    const valorPagado = Number(orden.valorPagado || 0);
    const cashCounted = this.sumCashPlan(breakdown, orden.estadoServicio);
    return Math.max(0, valorPagado - cashCounted);
  }

  private normalizeStoredTransferEvents(
    comprobantePago: Prisma.JsonValue,
    fallback: {
      monto: number;
      referenciaPago?: string | null;
      fechaPago?: string | Date | null;
      banco?: string | null;
      observacion?: string | null;
    },
  ): TransferenciaRealRegistrada[] {
    const fallbackReferencia = this.toOptionalString(fallback.referenciaPago);
    const fallbackFechaPago = this.normalizePaymentDate(fallback.fechaPago);
    const fallbackBanco = this.toOptionalString(fallback.banco);
    const fallbackObservacion = this.toOptionalString(fallback.observacion);

    const buildEvent = (
      path: unknown,
      payload: {
        monto?: unknown;
        referenciaPago?: unknown;
        fechaPago?: unknown;
        banco?: unknown;
        observacion?: unknown;
      },
      totalItems: number,
    ): TransferenciaRealRegistrada | null => {
      const normalizedPath =
        this.normalizeTenaxisStoragePath(path) ?? this.toOptionalString(path);
      if (!normalizedPath) {
        return null;
      }

      const montoRaw = Number(payload.monto ?? 0);
      const monto =
        Number.isFinite(montoRaw) && montoRaw > 0
          ? montoRaw
          : totalItems === 1
            ? fallback.monto
            : 0;
      const referenciaPago =
        this.toOptionalString(payload.referenciaPago) ??
        (totalItems === 1 ? fallbackReferencia : undefined);
      const fechaPago =
        this.normalizePaymentDate(payload.fechaPago) ??
        (totalItems === 1 ? fallbackFechaPago : undefined);

      if (monto <= 0 || !referenciaPago || !fechaPago) {
        return null;
      }

      return {
        metodo: MetodoPagoBase.TRANSFERENCIA,
        monto,
        path: normalizedPath,
        referenciaPago,
        fechaPago,
        banco:
          this.toOptionalString(payload.banco) ??
          (totalItems === 1 ? fallbackBanco : undefined),
        observacion:
          this.toOptionalString(payload.observacion) ??
          (totalItems === 1 ? fallbackObservacion : undefined),
      };
    };

    if (Array.isArray(comprobantePago)) {
      return comprobantePago
        .map((item) => {
          if (typeof item === 'string') {
            return buildEvent(item, {}, comprobantePago.length);
          }

          if (!this.isRecord(item)) {
            return null;
          }

          return buildEvent(
            item.path ?? item.comprobantePath ?? item.url,
            {
              monto: item.monto,
              referenciaPago: item.referenciaPago ?? item.referencia,
              fechaPago: item.fechaPago,
              banco: item.banco,
              observacion: item.observacion,
            },
            comprobantePago.length,
          );
        })
        .filter((item): item is TransferenciaRealRegistrada => item !== null);
    }

    if (typeof comprobantePago === 'string') {
      const legacy = buildEvent(
        comprobantePago,
        {
          monto: fallback.monto,
          referenciaPago: fallbackReferencia,
          fechaPago: fallbackFechaPago,
          banco: fallbackBanco,
          observacion: fallbackObservacion,
        },
        1,
      );

      return legacy ? [legacy] : [];
    }

    return [];
  }

  private buildIncomingTransferEvents(
    updateDto: UpdateOrdenServicioDto,
    fallback: {
      montoSugerido: number;
      banco?: string;
      observacion?: string;
    },
  ): TransferenciaRealRegistrada[] {
    if (
      Array.isArray(updateDto.transferencias) &&
      updateDto.transferencias.length > 0
    ) {
      return updateDto.transferencias.map((transferencia, index) => {
        const path =
          this.normalizeTenaxisStoragePath(transferencia.comprobantePath) ??
          this.toOptionalString(transferencia.comprobantePath);
        const referenciaPago = this.toOptionalString(
          transferencia.referenciaPago,
        );
        const fechaPago = this.normalizePaymentDate(transferencia.fechaPago);
        const monto = Number(transferencia.monto || 0);

        if (
          !path ||
          !referenciaPago ||
          !fechaPago ||
          !Number.isFinite(monto) ||
          monto <= 0
        ) {
          throw new BadRequestException(
            `La transferencia #${index + 1} debe incluir monto, comprobantePath, referenciaPago y fechaPago válidos`,
          );
        }

        return {
          metodo: MetodoPagoBase.TRANSFERENCIA,
          monto,
          path,
          referenciaPago,
          fechaPago,
          banco:
            this.toOptionalString(transferencia.banco) ??
            this.toOptionalString(fallback.banco),
          observacion:
            this.toOptionalString(transferencia.observacion) ??
            this.toOptionalString(fallback.observacion),
        } satisfies TransferenciaRealRegistrada;
      });
    }

    const touchedLegacyFields =
      updateDto.comprobantePago !== undefined ||
      updateDto.referenciaPago !== undefined ||
      updateDto.fechaPago !== undefined;

    if (!touchedLegacyFields) {
      return [];
    }

    const path =
      this.normalizeTenaxisStoragePath(updateDto.comprobantePago) ??
      this.toOptionalString(updateDto.comprobantePago);
    const referenciaPago = this.toOptionalString(updateDto.referenciaPago);
    const fechaPago = this.normalizePaymentDate(updateDto.fechaPago);

    if (!path || !referenciaPago || !fechaPago || fallback.montoSugerido <= 0) {
      throw new BadRequestException(
        'Para registrar pagos por transferencia debés adjuntar comprobante, referencia y fecha de pago',
      );
    }

    return [
      {
        metodo: MetodoPagoBase.TRANSFERENCIA,
        monto: fallback.montoSugerido,
        path,
        referenciaPago,
        fechaPago,
        banco: this.toOptionalString(fallback.banco),
        observacion: this.toOptionalString(fallback.observacion),
      },
    ];
  }

  private mergeTransferEvents(
    existingTransferEvents: TransferenciaRealRegistrada[],
    incomingTransferEvents: TransferenciaRealRegistrada[],
  ): TransferenciaRealRegistrada[] {
    const merged = this.dedupeTransferEvents(existingTransferEvents);

    if (incomingTransferEvents.length === 0) {
      return merged;
    }

    for (const incomingEvent of incomingTransferEvents) {
      const existingIndex = merged.findIndex(
        (existingEvent) => existingEvent.path === incomingEvent.path,
      );

      if (existingIndex >= 0) {
        merged[existingIndex] = incomingEvent;
        continue;
      }

      merged.push(incomingEvent);
    }

    return merged;
  }

  private dedupeTransferEvents(
    transferEvents: TransferenciaRealRegistrada[],
  ): TransferenciaRealRegistrada[] {
    const deduped = new Map<string, TransferenciaRealRegistrada>();

    for (const event of transferEvents) {
      const existing = deduped.get(event.path);

      if (!existing) {
        deduped.set(event.path, event);
        continue;
      }

      deduped.set(event.path, {
        ...event,
        ...existing,
        monto: existing.monto > 0 ? existing.monto : event.monto,
        referenciaPago: existing.referenciaPago || event.referenciaPago,
        fechaPago: existing.fechaPago || event.fechaPago,
        banco: existing.banco ?? event.banco,
        observacion: existing.observacion ?? event.observacion,
      });
    }

    return Array.from(deduped.values());
  }

  private shouldConfirmCashCollection(
    updateDto: UpdateOrdenServicioDto,
  ): boolean {
    return updateDto.confirmarMovimientoFinanciero === true;
  }

  private calculateLegacyTransferAmountSuggestion(params: {
    breakdown: DesglosePagoItem[];
    valorCotizado: number;
    estadoServicio?: EstadoOrden | null;
    existingConfirmedTransferAmount: number;
  }): number {
    const {
      breakdown,
      valorCotizado,
      estadoServicio,
      existingConfirmedTransferAmount,
    } = params;
    const coveredByCash = this.sumCashPlan(breakdown, estadoServicio);
    const coveredByNonMonetary = this.sumNonMonetaryCoverage(breakdown);
    const remaining = Math.max(
      0,
      valorCotizado -
        coveredByCash -
        coveredByNonMonetary -
        existingConfirmedTransferAmount,
    );
    const transferPlan = this.sumTransferPlan(breakdown);

    if (transferPlan <= 0) {
      return remaining;
    }

    return Math.min(transferPlan, remaining || transferPlan);
  }

  async update(
    tenantId: string,
    id: string,
    updateDto: UpdateOrdenServicioDto,
    performingUser?: JwtPayload,
  ) {
    const scopedWhere = this.buildScopedOrdenWhere(
      tenantId,
      id,
      performingUser,
    );
    const orden = await this.prisma.ordenServicio.findFirst({
      where: scopedWhere,
      include: {
        declaracionEfectivo: {
          select: { id: true, consignado: true },
        },
        consignacionOrden: {
          select: { id: true },
        },
      },
    });

    if (!orden) {
      throw new BadRequestException(
        'La orden especificada no existe o no está dentro de tu alcance operativo',
      );
    }

    const previousTecnicoId = orden.tecnicoId ?? null;

    if (updateDto.estadoPago !== undefined) {
      throw new BadRequestException(
        'El estado de pago se calcula automáticamente; no se puede editar manualmente',
      );
    }

    if (updateDto.valorPagado !== undefined) {
      throw new BadRequestException(
        'El valor pagado se calcula automáticamente; no se puede editar manualmente',
      );
    }

    if (
      this.isFinanciallyLocked(orden) &&
      this.hasFinancialMutation(orden, updateDto) &&
      !this.canLiquidateOperationallyWhileFinanciallyLocked(orden, updateDto) &&
      !this.canCompleteTransferSettlementWhileFinanciallyLocked(
        orden,
        updateDto,
      )
    ) {
      throw new ConflictException(
        'La orden ya tiene movimiento contable y sus datos financieros quedaron congelados; necesitas un flujo de ajuste aprobado',
      );
    }

    // Intentar resolver el membershipId si no viene en el token (retrocompatibilidad)
    const membershipId = await this.resolveMembershipId(
      tenantId,
      performingUser,
    );

    const fechaPagoDate = updateDto.fechaPago
      ? parseFlexibleDateTimeToUtc(updateDto.fechaPago, {
          dateOnlyAsBogotaStart: true,
        })
      : undefined;
    if (updateDto.fechaPago && !fechaPagoDate) {
      throw new BadRequestException('fechaPago inválida');
    }

    const contratoActivo =
      await this.contratosClienteService.getActiveByCliente(
        tenantId,
        orden.clienteId,
        orden.empresaId,
      );
    const tipoVisitaResuelta =
      updateDto.tipoVisita ?? orden.tipoVisita ?? undefined;
    const esGarantia = this.isGarantiaVisitType(tipoVisitaResuelta);

    if (esGarantia) {
      await this.assertGuaranteeEligibility(
        tenantId,
        orden.clienteId,
        orden.id,
      );
    }

    const tipoFacturacionResuelta = esGarantia
      ? TipoFacturacion.UNICO
      : contratoActivo?.tipoFacturacion ||
        updateDto.tipoFacturacion ||
        orden.tipoFacturacion ||
        TipoFacturacion.UNICO;
    let direccionIdResuelta = orden.direccionId ?? undefined;
    let direccionTextoResuelto = orden.direccionTexto ?? undefined;
    let direccionSnapshotResuelto: DireccionSnapshot | null = null;

    if (updateDto.direccionId) {
      direccionSnapshotResuelto = await this.resolveDireccionSnapshot({
        tenantId,
        direccionId: updateDto.direccionId,
        clienteId: orden.clienteId,
      });

      if (!direccionSnapshotResuelto) {
        throw new BadRequestException('direccionId inválida');
      }

      direccionIdResuelta = direccionSnapshotResuelto.id;
      direccionTextoResuelto = direccionSnapshotResuelto.direccionTexto;
    }

    const breakdownActualizado = this.normalizeBreakdown(
      updateDto.desglosePago,
    );
    const breakdownVigente =
      breakdownActualizado ?? this.normalizeBreakdown(orden.desglosePago) ?? [];
    const metodoPagoNombre = await this.resolveMetodoPagoNombreById(
      tenantId,
      orden.empresaId,
      updateDto.metodoPagoId ?? orden.metodoPagoId,
    );
    const metodosPagoBaseVigentes = this.deriveMetodosPagoBase(
      breakdownVigente,
      metodoPagoNombre,
    );
    const valorCotizadoResuelto = Number(
      updateDto.valorCotizado ?? orden.valorCotizado ?? 0,
    );
    const existingTransferEvents = this.dedupeTransferEvents(
      this.normalizeStoredTransferEvents(orden.comprobantePago, {
        monto: this.inferLegacyTransferAmount(orden, breakdownVigente),
        referenciaPago: orden.referenciaPago,
        fechaPago: orden.fechaPago,
      }),
    );
    const existingConfirmedTransferAmount = existingTransferEvents.reduce(
      (sum, event) => sum + event.monto,
      0,
    );
    const legacyTransferAmountSuggestion =
      this.calculateLegacyTransferAmountSuggestion({
        breakdown: breakdownVigente,
        valorCotizado: valorCotizadoResuelto,
        estadoServicio: updateDto.estadoServicio ?? orden.estadoServicio,
        existingConfirmedTransferAmount,
      });
    const incomingTransferEvents = this.buildIncomingTransferEvents(updateDto, {
      montoSugerido: legacyTransferAmountSuggestion,
      banco: updateDto.entidadFinancieraNombre,
      observacion: updateDto.observacionFinal,
    });
    const mergedTransferEvents = this.mergeTransferEvents(
      existingTransferEvents,
      incomingTransferEvents,
    );
    const serviceReachedSettlementPoint =
      updateDto.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden) ||
      updateDto.estadoServicio ===
        (EstadoOrden.TECNICO_FINALIZO as EstadoOrden);
    const explicitPaymentRegistration =
      incomingTransferEvents.length > 0 ||
      updateDto.comprobantePago !== undefined ||
      updateDto.referenciaPago !== undefined ||
      updateDto.transferencias !== undefined ||
      updateDto.confirmarMovimientoFinanciero === true ||
      serviceReachedSettlementPoint;
    const transferAmount = this.sumTransferPlan(breakdownVigente);
    const confirmedTransferAmount = mergedTransferEvents.reduce(
      (sum, event) => sum + event.monto,
      0,
    );
    const hasConfirmedTransferEvidence = mergedTransferEvents.length > 0;
    const cashAmountAtSettlementPoint = this.sumCashPlan(
      breakdownVigente,
      updateDto.estadoServicio || orden.estadoServicio,
    );
    const canDeferTransferProofWhileRegisteringCash =
      cashAmountAtSettlementPoint > 0 &&
      this.shouldConfirmCashCollection(updateDto) &&
      updateDto.estadoServicio ===
        (EstadoOrden.TECNICO_FINALIZO as EstadoOrden);
    const latestTransferEvent =
      mergedTransferEvents.length > 0
        ? mergedTransferEvents[mergedTransferEvents.length - 1]
        : null;

    const requestedLiquidation =
      updateDto.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden);
    const tecnicoIdResuelto =
      typeof updateDto.tecnicoId === 'string'
        ? updateDto.tecnicoId.trim() || null
        : updateDto.tecnicoId;

    const data: Prisma.OrdenServicioUpdateInput = {
      tecnico:
        tecnicoIdResuelto === null
          ? { disconnect: true }
          : tecnicoIdResuelto
            ? { connect: { id: tecnicoIdResuelto } }
            : undefined,
      observacion: updateDto.observacion ?? undefined,
      diagnosticoTecnico: updateDto.diagnosticoTecnico ?? undefined,
      intervencionRealizada: updateDto.intervencionRealizada ?? undefined,
      hallazgosEstructurales: updateDto.hallazgosEstructurales ?? undefined,
      recomendacionesObligatorias:
        updateDto.recomendacionesObligatorias ?? undefined,
      huboSellamiento: updateDto.huboSellamiento ?? undefined,
      huboRecomendacionEstructural:
        updateDto.huboRecomendacionEstructural ?? undefined,
      nivelInfestacion: updateDto.nivelInfestacion ?? undefined,
      urgencia: updateDto.urgencia ?? undefined,
      tipoVisita: tipoVisitaResuelta ?? undefined,
      frecuenciaSugerida: updateDto.frecuenciaSugerida ?? undefined,
      tipoFacturacion: tipoFacturacionResuelta,
      direccion: updateDto.direccionId
        ? { connect: { id: direccionIdResuelta } }
        : undefined,
      direccionTexto: direccionTextoResuelto,
      piso: direccionSnapshotResuelto
        ? direccionSnapshotResuelto.piso
        : undefined,
      bloque: direccionSnapshotResuelto
        ? direccionSnapshotResuelto.bloque
        : undefined,
      unidad: direccionSnapshotResuelto
        ? direccionSnapshotResuelto.unidad
        : undefined,
      barrio: direccionSnapshotResuelto
        ? direccionSnapshotResuelto.barrio
        : undefined,
      municipio: direccionSnapshotResuelto
        ? direccionSnapshotResuelto.municipio
        : undefined,
      departamento: direccionSnapshotResuelto
        ? direccionSnapshotResuelto.departamento
        : undefined,
      linkMaps: direccionSnapshotResuelto
        ? direccionSnapshotResuelto.linkMaps
        : undefined,
      zona: updateDto.direccionId
        ? direccionSnapshotResuelto?.zonaId
          ? { connect: { id: direccionSnapshotResuelto.zonaId } }
          : { disconnect: true }
        : undefined,
      contratoCliente: contratoActivo
        ? { connect: { id: contratoActivo.id } }
        : { disconnect: true },
      valorCotizado: esGarantia ? 0 : (updateDto.valorCotizado ?? undefined),
      valorRepuestos: updateDto.valorRepuestos ?? undefined,
      metodoPago: updateDto.metodoPagoId
        ? { connect: { id: updateDto.metodoPagoId } }
        : undefined,
      estadoServicio: updateDto.estadoServicio ?? undefined,
      facturaPath: updateDto.facturaPath ?? undefined,
      facturaElectronica: updateDto.facturaElectronica ?? undefined,
      comprobantePago:
        incomingTransferEvents.length > 0
          ? (mergedTransferEvents as unknown as Prisma.InputJsonValue)
          : undefined,
      evidenciaPath: updateDto.evidenciaPath ?? undefined,
      observacionFinal: updateDto.observacionFinal ?? undefined,
      referenciaPago:
        latestTransferEvent?.referenciaPago ??
        updateDto.referenciaPago ??
        undefined,
      liquidadoPor:
        requestedLiquidation && (membershipId || updateDto.liquidadoPorId)
          ? { connect: { id: membershipId || updateDto.liquidadoPorId } }
          : undefined,
      liquidadoAt: requestedLiquidation ? new Date() : undefined,
      fechaPago: latestTransferEvent
        ? new Date(latestTransferEvent.fechaPago)
        : fechaPagoDate,
      desglosePago: esGarantia
        ? ([] as unknown as Prisma.InputJsonValue)
        : updateDto.desglosePago
          ? (updateDto.desglosePago as unknown as Prisma.InputJsonValue)
          : undefined,
      metodosPagoBase: esGarantia ? [] : metodosPagoBaseVigentes,
    };

    // Lógica automática basada en el desglose de pago
    if (esGarantia && updateDto.estadoServicio === EstadoOrden.LIQUIDADO) {
      data.estadoPago = EstadoPagoOrden.PAGADO;
      data.valorPagado = 0;
    } else if (breakdownActualizado || breakdownVigente.length > 0) {
      if (
        explicitPaymentRegistration &&
        transferAmount > 0 &&
        !hasConfirmedTransferEvidence &&
        !canDeferTransferProofWhileRegisteringCash
      ) {
        throw new BadRequestException(
          'Para registrar pagos por transferencia debés adjuntar comprobante, referencia y fecha de pago',
        );
      }

      if (!explicitPaymentRegistration) {
        data.estadoPago = undefined;
        data.valorPagado = undefined;
      } else {
        const totals = this.calculateBreakdownTotals(
          breakdownVigente,
          valorCotizadoResuelto,
          updateDto.estadoServicio || orden.estadoServicio,
          this.shouldConfirmCashCollection(updateDto),
          confirmedTransferAmount,
        );
        data.valorPagado = totals.valorPagado;
        data.estadoPago = totals.estadoPago;
      }
    }

    if (
      requestedLiquidation &&
      (data.estadoPago === EstadoPagoOrden.PARCIAL ||
        data.estadoPago === EstadoPagoOrden.PENDIENTE)
    ) {
      data.estadoServicio = EstadoOrden.TECNICO_FINALIZO;
      data.liquidadoAt = null;
      data.liquidadoPor = { disconnect: true };
    }

    if (updateDto.entidadFinancieraNombre) {
      let entidad = await this.prisma.entidadFinanciera.findFirst({
        where: {
          empresaId: orden.empresaId,
          nombre: {
            equals: updateDto.entidadFinancieraNombre,
            mode: 'insensitive',
          },
        },
      });

      if (!entidad) {
        entidad = await this.prisma.entidadFinanciera.create({
          data: {
            tenantId,
            empresaId: orden.empresaId,
            nombre: updateDto.entidadFinancieraNombre,
          },
        });
      }
      data.entidadFinanciera = { connect: { id: entidad.id } };
    }

    if (updateDto.fechaVisita) {
      const fechaVisita = parseFlexibleDateTimeToUtc(updateDto.fechaVisita, {
        dateOnlyAsBogotaStart: true,
      });
      if (!fechaVisita) {
        throw new BadRequestException('fechaVisita inválida');
      }
      data.fechaVisita = fechaVisita;
    }

    if (updateDto.horaInicio) {
      const horaInicio = parseFlexibleDateTimeToUtc(updateDto.horaInicio);
      if (!horaInicio) {
        throw new BadRequestException('horaInicio inválida');
      }
      data.horaInicio = horaInicio;
      if (updateDto.duracionMinutos) {
        data.horaFin = new Date(
          horaInicio.getTime() + updateDto.duracionMinutos * 60000,
        );
      }
    }

    const serviceDateForPicoPlaca =
      data.horaInicio instanceof Date
        ? data.horaInicio
        : data.fechaVisita instanceof Date
          ? data.fechaVisita
          : (orden.horaInicio ?? orden.fechaVisita ?? null);
    const picoPlacaWarning =
      typeof updateDto.tecnicoId !== 'undefined' && tecnicoIdResuelto
        ? await this.resolveManualPicoPlacaWarning({
            tenantId,
            empresaId: orden.empresaId,
            membershipId: tecnicoIdResuelto,
            serviceDate: serviceDateForPicoPlaca,
          })
        : null;

    if (updateDto.horaInicioReal) {
      const horaInicioReal = parseFlexibleDateTimeToUtc(
        updateDto.horaInicioReal,
      );
      if (!horaInicioReal) {
        throw new BadRequestException('horaInicioReal inválida');
      }
      data.horaInicioReal = horaInicioReal;
    }

    if (updateDto.horaFinReal) {
      const horaFinReal = parseFlexibleDateTimeToUtc(updateDto.horaFinReal);
      if (!horaFinReal) {
        throw new BadRequestException('horaFinReal inválida');
      }
      data.horaFinReal = horaFinReal;
    }

    const requestedServiceNamesFromArray = Array.isArray(
      updateDto.serviciosSeleccionados,
    )
      ? Array.from(
          new Set(
            updateDto.serviciosSeleccionados
              .map((value) => value?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        )
      : null;
    const requestedServiceNames =
      requestedServiceNamesFromArray &&
      requestedServiceNamesFromArray.length > 0
        ? requestedServiceNamesFromArray
        : typeof updateDto.servicioEspecifico === 'string' &&
            updateDto.servicioEspecifico.trim().length > 0
          ? [updateDto.servicioEspecifico.trim()]
          : [];
    const shouldSyncSelectedServices =
      requestedServiceNamesFromArray !== null ||
      typeof updateDto.servicioEspecifico === 'string' ||
      typeof updateDto.servicioId === 'string';

    if (shouldSyncSelectedServices) {
      let servicioPrincipal: Awaited<
        ReturnType<typeof this.prisma.servicio.findFirst>
      > = null;
      const serviciosProcesados: string[] = [];

      if (requestedServiceNames.length > 0) {
        for (const nombreServicio of requestedServiceNames) {
          let servicio = await this.prisma.servicio.findFirst({
            where: {
              tenantId,
              empresaId: orden.empresaId,
              nombre: nombreServicio,
            },
          });

          if (!servicio) {
            servicio = await this.prisma.servicio.create({
              data: {
                tenantId,
                empresaId: orden.empresaId,
                nombre: nombreServicio,
                activo: true,
              },
            });
          }

          serviciosProcesados.push(servicio.nombre);

          if (!servicioPrincipal) {
            servicioPrincipal = servicio;
          }
        }
      } else if (updateDto.servicioId) {
        servicioPrincipal = await this.prisma.servicio.findFirst({
          where: {
            id: updateDto.servicioId,
            tenantId,
            empresaId: orden.empresaId,
          },
        });

        if (!servicioPrincipal) {
          throw new BadRequestException('servicioId inválido');
        }

        serviciosProcesados.push(servicioPrincipal.nombre);
      }

      if (!servicioPrincipal) {
        throw new BadRequestException('Debe especificar al menos un servicio');
      }

      data.servicio = { connect: { id: servicioPrincipal.id } };
      data.serviciosSeleccionados =
        serviciosProcesados as unknown as Prisma.InputJsonValue;
    }

    const updatedOrden = await this.prisma.ordenServicio.update({
      where: { id },
      data,
      include: {
        cliente: true,
        servicio: true,
        tecnico: {
          include: { user: true },
        },
      },
    });

    const acabaDeTerminar =
      (updateDto.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden) ||
        updateDto.estadoServicio ===
          (EstadoOrden.TECNICO_FINALIZO as EstadoOrden)) &&
      orden.estadoServicio !== (EstadoOrden.LIQUIDADO as EstadoOrden) &&
      orden.estadoServicio !== (EstadoOrden.TECNICO_FINALIZO as EstadoOrden);

    if (acabaDeTerminar) {
      const closedFollowUps = await this.closePendingFollowUpsForFinishedOrder(
        tenantId,
        updatedOrden.id,
        membershipId,
      );

      if (closedFollowUps > 0) {
        this.emitFollowUpNotificationsRefresh(tenantId, updatedOrden.empresaId);
      }
    }

    if (
      acabaDeTerminar &&
      !contratoActivo &&
      !orden.ordenPadreId &&
      updatedOrden.servicio
    ) {
      await this.createAutomaticFollowUps(
        tenantId,
        updatedOrden,
        updatedOrden.servicio,
        updatedOrden.fechaVisita,
        null,
        { allowWithoutContract: true },
      );
    }

    // Nueva lógica: Si la orden terminó o se liquidó y tiene efectivo, crear Declaración de Efectivo
    if (
      (updatedOrden.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden) ||
        updatedOrden.estadoServicio ===
          (EstadoOrden.TECNICO_FINALIZO as EstadoOrden)) &&
      updatedOrden.desglosePago &&
      Array.isArray(updatedOrden.desglosePago)
    ) {
      const breakdown =
        updatedOrden.desglosePago as unknown as DesglosePagoItem[];
      const cashAmount = breakdown
        .filter((l) => l.metodo === MetodoPagoBase.EFECTIVO)
        .reduce((sum, l) => sum + Number(l.monto || 0), 0);

      if (
        cashAmount > 0 &&
        updatedOrden.tecnicoId &&
        this.shouldConfirmCashCollection(updateDto)
      ) {
        // Verificar si ya existe una declaración para esta orden
        const existingDecl = await this.prisma.declaracionEfectivo.findUnique({
          where: { ordenId: updatedOrden.id },
        });

        if (!existingDecl) {
          // Extraer un path válido del JSON de comprobantePago
          let pathSoporte = 'POR_CONSIGNAR';
          const cp = updatedOrden.comprobantePago;
          if (cp) {
            if (Array.isArray(cp) && cp.length > 0) {
              const firstSupport = cp[0];
              if (typeof firstSupport === 'string') {
                pathSoporte = firstSupport;
              } else if (this.isRecord(firstSupport)) {
                pathSoporte =
                  this.toOptionalString(firstSupport.path) || 'POR_CONSIGNAR';
              }
            } else if (typeof cp === 'string') {
              pathSoporte = cp;
            }
          }

          await this.prisma.declaracionEfectivo.create({
            data: {
              tenantId: updatedOrden.tenantId,
              empresaId: updatedOrden.empresaId,
              ordenId: updatedOrden.id,
              tecnicoId: updatedOrden.tecnicoId,
              valorDeclarado: cashAmount,
              evidenciaPath: pathSoporte,
              observacion: `Recaudo automático por liquidación de orden #${updatedOrden.id}`,
              consignado: false,
            },
          });
        }
      }
    }

    // Recalcular status si el estado actual es LIQUIDADO o si el estado anterior lo era
    // (para manejar reversiones de estado y que el score sea siempre preciso)
    if (
      updatedOrden.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden) ||
      orden.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden)
    ) {
      await this.recalculateClientStatus(updatedOrden.clienteId);
    }

    if (
      updatedOrden.tecnicoId &&
      updatedOrden.tecnicoId !== previousTecnicoId
    ) {
      void this.notifyServiceAssignment({
        tenantId,
        membershipId: updatedOrden.tecnicoId,
        serviceId: updatedOrden.id,
        source: 'update',
      });
    }

    await this.notifyOperatorWebhookForOrderUpdate({
      tenantId,
      previousTecnicoId,
      updatedOrden,
      updateDto,
    });

    const signedOrden = await this.processSignedUrls(
      updatedOrden as OrdenWithGeolocalizaciones,
    );

    this.invalidateServiciosKpisCacheSoon(tenantId);

    return picoPlacaWarning
      ? { ...signedOrden, picoPlacaWarning }
      : signedOrden;
  }

  private calculateBreakdownTotals(
    breakdown: DesglosePagoItem[],
    valorCotizado: number,
    estadoServicio: EstadoOrden,
    confirmCashCollection: boolean,
    confirmedTransferAmount?: number,
  ): { valorPagado: number; estadoPago: EstadoPagoOrden } {
    // 1. Montos por tipo (Lo que entra realmente a caja/banco)
    const efectivoPlaneado = breakdown
      .filter((l) => l.metodo === MetodoPagoBase.EFECTIVO)
      .reduce((sum, l) => sum + Number(l.monto || 0), 0);

    const valorTransferencia = Math.max(0, confirmedTransferAmount ?? 0);
    const isServiceFinished =
      estadoServicio === EstadoOrden.LIQUIDADO ||
      estadoServicio === EstadoOrden.TECNICO_FINALIZO;
    const valorEfectivo =
      confirmCashCollection && isServiceFinished ? efectivoPlaneado : 0;
    const valorPagado = valorEfectivo + valorTransferencia;

    // 2. Valor cubierto por métodos no monetarios (Bonos, Cortesías)
    const valorDescuentos = breakdown
      .filter(
        (l) =>
          l.metodo === MetodoPagoBase.BONO ||
          l.metodo === MetodoPagoBase.CORTESIA,
      )
      .reduce((sum, l) => sum + Number(l.monto || 0), 0);

    // 3. Valor a crédito (Deuda pendiente)
    const valorCredito = breakdown
      .filter((l) => l.metodo === MetodoPagoBase.CREDITO)
      .reduce((sum, l) => sum + Number(l.monto || 0), 0);

    // 4. Total cubierto (Suma de todo para ver si la orden está cerrada)
    const totalCubierto = valorPagado + valorDescuentos + valorCredito;

    // Determinar estado de pago
    const hasCredito = valorCredito > 0;
    const hasCortesia = breakdown.some(
      (l) => l.metodo === MetodoPagoBase.CORTESIA,
    );

    let estadoPago: EstadoPagoOrden = EstadoPagoOrden.PENDIENTE;

    // Si todo está cubierto y no hay crédito
    if (totalCubierto >= valorCotizado && !hasCredito) {
      if (hasCortesia && valorPagado === 0) {
        estadoPago = EstadoPagoOrden.CORTESIA;
      } else if (efectivoPlaneado > 0) {
        // El efectivo solo pasa a recaudo real si el flujo lo confirmó explícitamente
        if (valorEfectivo > 0) {
          estadoPago = EstadoPagoOrden.EFECTIVO_DECLARADO;
        } else {
          // Mientras no se confirme recaudo, el efectivo del desglose es solo plan/cotización.
          estadoPago =
            valorTransferencia > 0
              ? EstadoPagoOrden.PARCIAL
              : EstadoPagoOrden.PENDIENTE;
        }
      } else {
        // La transferencia solo cuenta como pago real cuando existe evidencia explícita.
        estadoPago =
          valorTransferencia > 0
            ? EstadoPagoOrden.PAGADO
            : EstadoPagoOrden.PENDIENTE;
      }
    }
    // Si hay algún movimiento pero no llega al total o hay crédito
    else if (totalCubierto > 0) {
      estadoPago = EstadoPagoOrden.PARCIAL;
    }

    return { valorPagado, estadoPago };
  }

  private async recalculateClientStatus(clienteId: string): Promise<void> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      include: {
        ordenesServicio: {
          where: {
            deletedAt: null,
            estadoServicio: {
              not: EstadoOrden.CANCELADO as EstadoOrden,
            },
          },
          orderBy: { fechaVisita: 'desc' },
        },
      },
    });

    if (!cliente) return;

    let score = 0;
    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);

    const liquidatedOrders = cliente.ordenesServicio.filter(
      (o) => o.estadoServicio === (EstadoOrden.LIQUIDADO as EstadoOrden),
    );

    // 1. Basic score: +10 per liquidated order
    score += liquidatedOrders.length * 10;

    // 2. Ticket bonus: +5 if value > 1,000,000
    score +=
      liquidatedOrders.filter((o) => Number(o.valorCotizado || 0) > 1000000)
        .length * 5;

    // 3. Fidelity bonus: +20 if at least 5 in last 6 months
    const recentOrders = liquidatedOrders.filter(
      (o) => o.fechaVisita && new Date(o.fechaVisita) >= sixMonthsAgo,
    );
    if (recentOrders.length >= 5) {
      score += 20;
    }

    // 4. Determine Classification
    let clasificacion: ClasificacionCliente =
      ClasificacionCliente.BRONCE as ClasificacionCliente;

    // RIESGO logic:
    // a. Technical Risk: last order infestation is CRITICO or ALTO
    const lastOrder = liquidatedOrders[0];
    const isTechnicalRisk =
      lastOrder &&
      (lastOrder.nivelInfestacion ===
        (NivelInfestacion.CRITICO as NivelInfestacion) ||
        lastOrder.nivelInfestacion ===
          (NivelInfestacion.ALTO as NivelInfestacion));

    // b. Commercial Risk: 45 days since last visit if frequency is 30
    const lastVisitDate = lastOrder?.fechaVisita
      ? new Date(lastOrder.fechaVisita)
      : null;
    const daysSinceLastVisit = lastVisitDate
      ? (now.getTime() - lastVisitDate.getTime()) / (1000 * 3600 * 24)
      : null;

    // Get frequency from client or default to 30
    const frequency = cliente.frecuenciaServicio || 30;
    const isCommercialRisk =
      daysSinceLastVisit !== null &&
      daysSinceLastVisit > (frequency === 30 ? 45 : frequency * 1.5);

    if (isTechnicalRisk || isCommercialRisk) {
      clasificacion = ClasificacionCliente.RIESGO as ClasificacionCliente;
    } else {
      if (score > 500) {
        clasificacion = ClasificacionCliente.ORO as ClasificacionCliente;
      } else if (score > 100) {
        clasificacion = ClasificacionCliente.PLATA as ClasificacionCliente;
      } else {
        clasificacion = ClasificacionCliente.BRONCE as ClasificacionCliente;
      }
    }

    // Proxima Visita: La fecha más cercana en el futuro de una orden NO cancelada
    const futureOrders = cliente.ordenesServicio
      .filter((o) => o.fechaVisita && new Date(o.fechaVisita) >= now)
      .sort(
        (a, b) =>
          new Date(a.fechaVisita!).getTime() -
          new Date(b.fechaVisita!).getTime(),
      );

    const proximaVisita = futureOrders[0]?.fechaVisita || null;

    await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        score,
        clasificacion,
        ultimaVisita: lastVisitDate,
        proximaVisita: proximaVisita,
      },
    });
  }

  async getMyFollowUpStatus(
    tenantId: string,
    user: JwtPayload,
    empresaId?: string,
  ) {
    if (!user.membershipId || this.isPrivilegedRole(user.role)) {
      return {
        blocked: false,
        overdueCount: 0,
        overdueItems: [],
        activeOverride: null,
      };
    }

    const now = new Date();
    const overdueThreshold = startOfBogotaDayUtc(now);
    const activeOverride = await this.getActiveFollowUpOverride(
      tenantId,
      user.membershipId,
      empresaId,
      now,
    );
    const overdueCount = await this.prisma.ordenServicioSeguimiento.count({
      where: {
        tenantId,
        empresaId: empresaId || undefined,
        createdByMembershipId: user.membershipId,
        status: 'PENDIENTE',
        completedAt: null,
        dueAt: { lt: overdueThreshold },
      },
    });

    const overdueItems = await this.prisma.ordenServicioSeguimiento.findMany({
      where: {
        tenantId,
        empresaId: empresaId || undefined,
        createdByMembershipId: user.membershipId,
        status: 'PENDIENTE',
        completedAt: null,
        dueAt: { lt: overdueThreshold },
      },
      include: {
        ordenServicio: {
          include: {
            cliente: true,
            servicio: true,
          },
        },
      },
      orderBy: { dueAt: 'asc' },
      take: 10,
    });

    return {
      blocked: !activeOverride && overdueCount > 0,
      overdueCount,
      overdueItems: overdueItems.map((item) => ({
        id: item.id,
        dueAt: item.dueAt,
        followUpType: item.followUpType,
        ordenServicioId: item.ordenServicioId,
        cliente:
          item.ordenServicio.cliente.tipoCliente === 'EMPRESA'
            ? item.ordenServicio.cliente.razonSocial
            : `${item.ordenServicio.cliente.nombre || ''} ${item.ordenServicio.cliente.apellido || ''}`.trim(),
        servicio: item.ordenServicio.servicio.nombre,
      })),
      activeOverride: activeOverride
        ? {
            id: activeOverride.id,
            startsAt: activeOverride.fechaAprobacion,
            endsAt: activeOverride.fechaExpiracion,
            reason: activeOverride.motivo,
          }
        : null,
    };
  }

  async completeFollowUp(
    tenantId: string,
    followUpId: string,
    dto: CompleteFollowUpDto,
    user: JwtPayload,
  ) {
    if (!user.membershipId) {
      throw new ForbiddenException('No se pudo resolver la membresía actual');
    }

    const followUp = await this.prisma.ordenServicioSeguimiento.findFirst({
      where: { id: followUpId, tenantId },
    });

    let resolvedFollowUp =
      followUp ||
      (await this.prisma.ordenServicioSeguimiento.findFirst({
        where: {
          tenantId,
          ordenServicioId: followUpId,
          status: 'PENDIENTE',
        },
        orderBy: { dueAt: 'asc' },
      }));

    if (!resolvedFollowUp) {
      const legacyFollowUpOrder = await this.prisma.ordenServicio.findFirst({
        where: {
          id: followUpId,
          tenantId,
          deletedAt: null,
          ordenPadreId: { not: null },
        },
        select: {
          id: true,
          empresaId: true,
          creadoPorId: true,
          fechaVisita: true,
          createdAt: true,
        },
      });

      if (legacyFollowUpOrder) {
        resolvedFollowUp = await this.prisma.ordenServicioSeguimiento.create({
          data: {
            tenantId,
            empresaId: legacyFollowUpOrder.empresaId,
            ordenServicioId: legacyFollowUpOrder.id,
            createdByMembershipId:
              legacyFollowUpOrder.creadoPorId ?? user.membershipId,
            followUpType: 'ADICIONAL',
            dueAt:
              legacyFollowUpOrder.fechaVisita ??
              legacyFollowUpOrder.createdAt ??
              new Date(),
            status: 'PENDIENTE',
          },
        });
      }
    }

    if (!resolvedFollowUp) {
      throw new BadRequestException('Seguimiento no encontrado');
    }

    const followUpOrder = await this.prisma.ordenServicio.findFirst({
      where: {
        id: resolvedFollowUp.ordenServicioId,
        tenantId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!followUpOrder) {
      throw new BadRequestException(
        'No puedes gestionar seguimientos de una orden eliminada',
      );
    }

    const canManage =
      resolvedFollowUp.createdByMembershipId === user.membershipId ||
      this.isPrivilegedRole(user.role) ||
      user.role === Role.COORDINADOR;

    if (!canManage) {
      throw new ForbiddenException(
        'No tienes permisos para completar este seguimiento',
      );
    }

    const contactedAt = parseFlexibleDateTimeToUtc(dto.contactedAt);
    if (!contactedAt) {
      throw new BadRequestException('contactedAt inválido');
    }

    const shouldAssignServiceToCallRegistrar =
      dto.resolution === 'ACEPTADO' && resolvedFollowUp.status !== 'ACEPTADO';

    const updated = await this.prisma.ordenServicioSeguimiento.update({
      where: { id: resolvedFollowUp.id },
      data: {
        status: dto.resolution,
        contactedAt,
        channel: dto.channel,
        outcome: dto.outcome,
        notes: dto.notes,
        completedAt: resolvedFollowUp.completedAt ?? new Date(),
        completedByMembershipId:
          resolvedFollowUp.completedByMembershipId ?? user.membershipId,
      },
    });

    if (shouldAssignServiceToCallRegistrar) {
      await this.prisma.ordenServicio.update({
        where: { id: followUpOrder.id },
        data: { creadoPorId: user.membershipId },
      });
    }

    if (dto.nextActionAt) {
      const nextActionAt = parseFlexibleDateTimeToUtc(dto.nextActionAt, {
        dateOnlyAsBogotaStart: true,
      });

      if (nextActionAt) {
        await this.prisma.ordenServicioSeguimiento.create({
          data: {
            tenantId,
            empresaId: resolvedFollowUp.empresaId,
            ordenServicioId: resolvedFollowUp.ordenServicioId,
            createdByMembershipId: resolvedFollowUp.createdByMembershipId,
            followUpType: 'ADICIONAL',
            dueAt: nextActionAt,
            status: 'PENDIENTE',
          },
        });
      }
    }

    this.emitFollowUpNotificationsRefresh(tenantId, resolvedFollowUp.empresaId);
    this.invalidateServiciosKpisCacheSoon(tenantId);

    return updated;
  }

  async listFollowUpOverrides(
    tenantId: string,
    user: JwtPayload,
    empresaId?: string,
    membershipId?: string,
  ) {
    if (!user.membershipId) {
      throw new ForbiddenException('No se pudo resolver la membresía actual');
    }

    const targetMembershipId = this.isPrivilegedRole(user.role)
      ? membershipId
      : user.membershipId;

    return this.prisma.permiso.findMany({
      where: {
        tenantId,
        empresaId: empresaId || undefined,
        membershipId: targetMembershipId || undefined,
        tipo: TipoPermiso.DESBLOQUEO_ASIGNACION_SERVICIOS,
      },
      orderBy: { fechaSolicitud: 'desc' },
      take: 50,
    });
  }

  async createFollowUpOverride(
    tenantId: string,
    user: JwtPayload,
    empresaId: string | undefined,
    dto: CreateFollowUpOverrideDto,
  ) {
    if (!user.membershipId) {
      throw new ForbiddenException('No se pudo resolver la membresía actual');
    }

    if (!this.isPrivilegedRole(user.role)) {
      throw new ForbiddenException(
        'Solo ADMIN y SU_ADMIN pueden otorgar desbloqueos temporales',
      );
    }

    if (!empresaId) {
      throw new BadRequestException('empresaId es obligatorio');
    }

    const startsAt = parseFlexibleDateTimeToUtc(dto.startsAt);
    const endsAt = parseFlexibleDateTimeToUtc(dto.endsAt);
    if (!startsAt || !endsAt || endsAt <= startsAt) {
      throw new BadRequestException(
        'La ventana del desbloqueo temporal es inválida',
      );
    }

    return this.prisma.permiso.create({
      data: {
        tenantId,
        empresaId,
        membershipId: dto.membershipId,
        adminId: user.membershipId,
        tipo: TipoPermiso.DESBLOQUEO_ASIGNACION_SERVICIOS,
        motivo: dto.reason,
        estado: EstadoPermiso.APROBADO,
        fechaAprobacion: startsAt,
        fechaExpiracion: endsAt,
      },
    });
  }

  private assertCanAssignServices() {
    // Se ha removido el bloqueo por seguimientos pendientes por solicitud
    return;
  }

  private calculateAutomaticReinforcementQuotedValue(
    valorCotizado?: number | Prisma.Decimal | null,
  ) {
    const originalQuotedValue = Number(valorCotizado ?? 0);

    if (
      Number.isFinite(originalQuotedValue) &&
      originalQuotedValue > AUTOMATIC_REINFORCEMENT_HALF_PRICE_THRESHOLD
    ) {
      return Math.round((originalQuotedValue / 2) * 100) / 100;
    }

    return AUTOMATIC_REINFORCEMENT_MIN_PRICE;
  }

  private async createAutomaticFollowUps(
    tenantId: string,
    orden: {
      id: string;
      empresaId: string;
      clienteId: string;
      servicioId: string;
      creadoPorId: string | null;
      direccionId: string | null;
      direccionTexto: string;
      observacion?: string | null;
      tipoFacturacion: TipoFacturacion | null;
      nivelInfestacion: NivelInfestacion | null;
      urgencia: UrgenciaOrden | null;
      valorCotizado?: number | Prisma.Decimal | null;
    },
    servicio: {
      empresaId: string;
      requiereSeguimiento: boolean;
      primerSeguimientoDias: number | null;
      requiereSeguimientoTresMeses: boolean;
    },
    fechaBase: Date | null,
    contratoActivo: {
      id: string;
      tipoFacturacion: TipoFacturacion;
      frecuenciaServicio: number | null;
      serviciosComprometidos: number | null;
    } | null,
    options?: {
      allowWithoutContract?: boolean;
    },
  ) {
    const creatorResolution =
      await this.resolveAutomaticFollowUpCreatorMembership(
        tenantId,
        orden.empresaId,
        orden.id,
        orden.creadoPorId ?? null,
      );
    const creatorMembershipId = creatorResolution.membershipId;

    const baseDate = startOfBogotaDayUtc(fechaBase || new Date());
    const originalObservacion = this.toOptionalString(orden.observacion);
    const buildFollowUpObservacion = (baseMessage: string) =>
      originalObservacion
        ? `${baseMessage}\n\nObservaciones del servicio original: ${originalObservacion}`
        : baseMessage;

    if (contratoActivo) {
      const frecuenciaContrato = contratoActivo.frecuenciaServicio;
      const totalServicios = Math.max(
        contratoActivo.serviciosComprometidos || 1,
        1,
      );

      if (!frecuenciaContrato || totalServicios <= 1) {
        this.logger.log(
          `AUTO_FOLLOW_UPS: Orden ${orden.id} con contrato activo pero sin servicios adicionales por programar.`,
        );
        return 0;
      }

      let createdOrders = 0;
      for (let index = 1; index < totalServicios; index += 1) {
        const dueAt = addBogotaDaysUtc(baseDate, frecuenciaContrato * index);

        await this.prisma.ordenServicio.create({
          data: {
            tenantId,
            empresaId: orden.empresaId,
            clienteId: orden.clienteId,
            servicioId: orden.servicioId,
            creadoPorId: creatorMembershipId,
            direccionId: orden.direccionId,
            direccionTexto: orden.direccionTexto,
            estadoServicio: EstadoOrden.NUEVO,
            observacion: `Servicio programado automáticamente según contrato activo. Visita ${index + 1} de ${totalServicios}.`,
            nivelInfestacion: orden.nivelInfestacion || undefined,
            urgencia: orden.urgencia || undefined,
            tipoVisita: TipoVisita.NUEVO,
            tipoFacturacion: contratoActivo.tipoFacturacion,
            contratoClienteId: contratoActivo.id,
            fechaVisita: dueAt,
            ordenPadreId: orden.id,
          },
        });
        createdOrders += 1;
      }
      this.logger.log(
        `AUTO_FOLLOW_UPS: Orden ${orden.id} generó ${createdOrders} servicios automáticos por contrato. creatorSource=${creatorResolution.source}.`,
      );
      return createdOrders;
    }

    if (!options?.allowWithoutContract || !servicio.requiereSeguimiento) {
      this.logger.log(
        `AUTO_FOLLOW_UPS: Orden ${orden.id} omitida. allowWithoutContract=${Boolean(options?.allowWithoutContract)} requiereSeguimiento=${Boolean(servicio.requiereSeguimiento)}.`,
      );
      return 0;
    }

    const serviceDate = fechaBase ?? null;
    if (!serviceDate) {
      this.logger.warn(
        `AUTO_FOLLOW_UPS: La orden ${orden.id} se omite porque no tiene fecha de servicio para validar el cutoff ${AUTOMATIC_REINFORCEMENT_MIN_SERVICE_DATE_UTC.toISOString()}.`,
      );
      return 0;
    }

    if (
      serviceDate.getTime() <
      AUTOMATIC_REINFORCEMENT_MIN_SERVICE_DATE_UTC.getTime()
    ) {
      this.logger.warn(
        `AUTO_FOLLOW_UPS: La orden ${orden.id} se omite por cutoff de fecha. fechaServicio=${serviceDate.toISOString()} cutoff=${AUTOMATIC_REINFORCEMENT_MIN_SERVICE_DATE_UTC.toISOString()}.`,
      );
      return 0;
    }

    const existingFollowUpOrders = await this.prisma.ordenServicio.count({
      where: {
        tenantId,
        ordenPadreId: orden.id,
        deletedAt: null,
      },
    });

    if (existingFollowUpOrders > 0) {
      this.logger.warn(
        `AUTO_FOLLOW_UPS: La orden ${orden.id} ya tiene ${existingFollowUpOrders} refuerzo(s) activos. Se omite recreación.`,
      );
      return 0;
    }

    const followUpQuotedValue = this.calculateAutomaticReinforcementQuotedValue(
      orden.valorCotizado,
    );

    const followUpBlueprints: Array<{
      followUpType: string;
      dueAt: Date;
      observacion: string;
    }> = [];

    if (servicio.primerSeguimientoDias) {
      followUpBlueprints.push({
        followUpType: 'INICIAL',
        dueAt: addBogotaDaysUtc(baseDate, servicio.primerSeguimientoDias),
        observacion: buildFollowUpObservacion(
          `Seguimiento automático inicial programado a ${servicio.primerSeguimientoDias} días.`,
        ),
      });
    }

    if (servicio.requiereSeguimientoTresMeses) {
      const threeMonthsLater = new Date(baseDate);
      threeMonthsLater.setUTCMonth(threeMonthsLater.getUTCMonth() + 3);

      followUpBlueprints.push({
        followUpType: 'TRES_MESES',
        dueAt: threeMonthsLater,
        observacion: buildFollowUpObservacion(
          'Seguimiento automático programado a 3 meses.',
        ),
      });
    }

    if (followUpBlueprints.length === 0) {
      this.logger.warn(
        `AUTO_FOLLOW_UPS: La orden ${orden.id} requiere seguimiento, pero el servicio no tiene reglas configuradas para generar refuerzos.`,
      );
      return 0;
    }

    let createdOrders = 0;
    let createdPendingTasks = 0;
    for (const blueprint of followUpBlueprints) {
      const ordenSeguimiento = await this.prisma.ordenServicio.create({
        data: {
          tenantId,
          empresaId: orden.empresaId,
          clienteId: orden.clienteId,
          servicioId: orden.servicioId,
          creadoPorId: creatorMembershipId,
          direccionId: orden.direccionId,
          direccionTexto: orden.direccionTexto,
          estadoServicio: EstadoOrden.NUEVO,
          observacion: blueprint.observacion,
          nivelInfestacion: orden.nivelInfestacion || undefined,
          urgencia: orden.urgencia || undefined,
          tipoVisita: TipoVisita.SERVICIO_REFUERZO,
          tipoFacturacion: TipoFacturacion.UNICO,
          valorCotizado: followUpQuotedValue,
          fechaVisita: blueprint.dueAt,
          ordenPadreId: orden.id,
        },
      });
      createdOrders += 1;

      if (creatorMembershipId) {
        await this.prisma.ordenServicioSeguimiento.create({
          data: {
            tenantId,
            empresaId: servicio.empresaId,
            ordenServicioId: ordenSeguimiento.id,
            createdByMembershipId: creatorMembershipId,
            followUpType: blueprint.followUpType,
            dueAt: blueprint.dueAt,
            status: 'PENDIENTE',
          },
        });
        createdPendingTasks += 1;
      }
    }

    if (createdPendingTasks > 0) {
      this.emitFollowUpNotificationsRefresh(tenantId, servicio.empresaId);
    }

    if (createdOrders > 0) {
      this.invalidateServiciosKpisCacheSoon(tenantId);
    }

    this.logger.log(
      `AUTO_FOLLOW_UPS: Orden ${orden.id} generó ${createdOrders} refuerzo(s). creator=${creatorMembershipId ?? 'null'} source=${creatorResolution.source}.`,
    );
    return createdOrders;
  }

  // Job para procesar refuerzos pendientes (estilo Cron)
  @Cron('0 0 19 * * *', { timeZone: 'America/Bogota' })
  async processReinforcementsJob() {
    const fallbackConfigured = Boolean(
      this.configService
        .get<string>('REINFORCEMENT_FALLBACK_MEMBERSHIP_IDS')
        ?.trim() ||
      this.configService
        .get<string>('REINFORCEMENT_FALLBACK_MEMBERSHIP_ID')
        ?.trim(),
    );

    this.logger.log(
      `REINFORCEMENT_JOB: Iniciando procesamiento de refuerzos para estados ${EstadoOrden.LIQUIDADO} y ${EstadoOrden.TECNICO_FINALIZO}. fallbackConfigured=${fallbackConfigured}.`,
    );

    const candidateOrders = await this.prisma.ordenServicio.findMany({
      where: {
        deletedAt: null,
        estadoServicio: {
          in: [
            EstadoOrden.LIQUIDADO as EstadoOrden,
            EstadoOrden.TECNICO_FINALIZO as EstadoOrden,
          ],
        },
      },
      include: {
        servicio: true,
        ordenesHijas: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
          },
          take: 1,
        },
      },
    });

    this.logger.log(
      `REINFORCEMENT_JOB: Encontradas ${candidateOrders.length} órdenes con estado elegible antes de filtros secundarios.`,
    );

    let elegibles = 0;
    let procesadas = 0;
    let omitidasPorSerRefuerzo = 0;
    let omitidasSinSeguimientoConfigurado = 0;
    let omitidasSinReglasProgramacion = 0;
    let omitidasConRefuerzosActivos = 0;
    let omitidasSinFechaServicio = 0;
    let omitidasPorFechaCorte = 0;

    for (const orden of candidateOrders) {
      try {
        if (orden.ordenPadreId) {
          omitidasPorSerRefuerzo += 1;
          continue;
        }

        if (!orden.servicio?.requiereSeguimiento) {
          omitidasSinSeguimientoConfigurado += 1;
          continue;
        }

        const hasSchedulingRules = Boolean(
          orden.servicio.primerSeguimientoDias ||
          orden.servicio.requiereSeguimientoTresMeses,
        );

        if (!hasSchedulingRules) {
          omitidasSinReglasProgramacion += 1;
          continue;
        }

        if (orden.ordenesHijas.length > 0) {
          omitidasConRefuerzosActivos += 1;
          continue;
        }

        const serviceDate = orden.fechaVisita ?? null;
        if (!serviceDate) {
          omitidasSinFechaServicio += 1;
          continue;
        }

        if (
          serviceDate.getTime() <
          AUTOMATIC_REINFORCEMENT_MIN_SERVICE_DATE_UTC.getTime()
        ) {
          omitidasPorFechaCorte += 1;
          continue;
        }

        elegibles += 1;

        this.logger.log(
          `REINFORCEMENT_JOB: Procesando orden ${orden.id} tenant=${orden.tenantId} empresa=${orden.empresaId} estado=${orden.estadoServicio} creadoPorId=${orden.creadoPorId ?? 'null'} fechaVisita=${orden.fechaVisita?.toISOString() ?? 'null'} servicioId=${orden.servicioId} primerSeguimientoDias=${orden.servicio.primerSeguimientoDias ?? 'null'} tresMeses=${orden.servicio.requiereSeguimientoTresMeses}.`,
        );

        const createdForOrder = await this.createAutomaticFollowUps(
          orden.tenantId,
          orden,
          orden.servicio,
          orden.fechaVisita,
          null,
          { allowWithoutContract: true },
        );

        procesadas += createdForOrder;

        this.logger.log(
          `REINFORCEMENT_JOB: Orden ${orden.id} procesada. Refuerzos creados=${createdForOrder}.`,
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(
          `REINFORCEMENT_JOB: Error procesando orden ${orden.id} tenant=${orden.tenantId}: ${msg}`,
        );
      }
    }

    this.logger.log(
      `REINFORCEMENT_JOB: Finalizado. evaluadas=${candidateOrders.length} elegibles=${elegibles} creadas=${procesadas} omitidasPorSerRefuerzo=${omitidasPorSerRefuerzo} omitidasSinSeguimientoConfigurado=${omitidasSinSeguimientoConfigurado} omitidasSinReglasProgramacion=${omitidasSinReglasProgramacion} omitidasConRefuerzosActivos=${omitidasConRefuerzosActivos} omitidasSinFechaServicio=${omitidasSinFechaServicio} omitidasPorFechaCorte=${omitidasPorFechaCorte}.`,
    );
    return {
      procesadas,
      evaluadas: candidateOrders.length,
      elegibles,
      omitidasPorSerRefuerzo,
      omitidasSinSeguimientoConfigurado,
      omitidasSinReglasProgramacion,
      omitidasConRefuerzosActivos,
      omitidasSinFechaServicio,
      omitidasPorFechaCorte,
    };
  }

  private isGarantiaVisitType(tipoVisita?: TipoVisita | null) {
    return tipoVisita === ('GARANTIA' as TipoVisita);
  }

  private async assertGuaranteeEligibility(
    tenantId: string,
    clienteId: string,
    excludeOrderId?: string,
  ) {
    const whereBase = {
      tenantId,
      clienteId,
      deletedAt: null,
      ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
    };

    const [hasBaseService, hasChildService] = await Promise.all([
      this.prisma.ordenServicio.count({
        where: {
          ...whereBase,
          ordenPadreId: null,
        },
      }),
      this.prisma.ordenServicio.count({
        where: {
          ...whereBase,
          ordenPadreId: { not: null },
        },
      }),
    ]);

    if (!hasBaseService || !hasChildService) {
      throw new BadRequestException(
        'La garantía solo aplica para clientes con al menos un servicio previo y un refuerzo realizado.',
      );
    }
  }

  private async getActiveFollowUpOverride(
    tenantId: string,
    membershipId: string,
    empresaId: string | undefined,
    now: Date,
  ) {
    return this.prisma.permiso.findFirst({
      where: {
        tenantId,
        empresaId: empresaId || undefined,
        membershipId,
        tipo: TipoPermiso.DESBLOQUEO_ASIGNACION_SERVICIOS,
        estado: EstadoPermiso.APROBADO,
        fechaAprobacion: { lte: now },
        OR: [{ fechaExpiracion: null }, { fechaExpiracion: { gte: now } }],
      },
      orderBy: { fechaExpiracion: 'desc' },
    });
  }

  private isPrivilegedRole(role?: Role) {
    return role === Role.ADMIN || role === Role.SU_ADMIN;
  }

  async remove(
    tenantId: string,
    id: string,
    dto: RemoveOrdenServicioDto,
    performingUser?: JwtPayload,
  ) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException(
        'Debes indicar una observación para eliminar la orden',
      );
    }

    const scopedWhere = this.buildScopedOrdenWhere(
      tenantId,
      id,
      performingUser,
    );
    const orden = await this.prisma.ordenServicio.findFirst({
      where: scopedWhere,
      include: {
        declaracionEfectivo: {
          select: { id: true },
        },
        consignacionOrden: {
          select: { id: true },
        },
        nominaDetalles: {
          select: { id: true },
          take: 1,
        },
        ordenesHijas: {
          where: { deletedAt: null },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!orden) {
      throw new BadRequestException(
        'La orden especificada no existe, ya fue eliminada o no está dentro de tu alcance operativo',
      );
    }

    if (orden.declaracionEfectivo) {
      throw new BadRequestException(
        'No puedes eliminar una orden con declaración de efectivo',
      );
    }

    if (orden.consignacionOrden) {
      throw new BadRequestException(
        'No puedes eliminar una orden con consignación registrada',
      );
    }

    if (orden.nominaDetalles.length > 0) {
      throw new BadRequestException(
        'No puedes eliminar una orden que ya impactó nómina',
      );
    }

    if (orden.ordenesHijas.length > 0) {
      throw new BadRequestException(
        'No puedes eliminar una orden que tiene servicios hijos activos',
      );
    }

    const deletedById = await this.resolveMembershipId(
      tenantId,
      performingUser,
    );

    const deletedOrden = await this.prisma.ordenServicio.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedReason: reason,
        deletedById: deletedById ?? null,
      },
    });

    this.invalidateServiciosKpisCacheSoon(tenantId);

    return deletedOrden;
  }
}
