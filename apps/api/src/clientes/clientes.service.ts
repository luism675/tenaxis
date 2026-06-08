import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis, { RedisOptions } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { QueryClientesDashboardDto } from './dto/query-clientes-dashboard.dto';
import { QueryClientesRankingKpisDto } from './dto/query-clientes-ranking-kpis.dto';
import { QueryClientesRankingDto } from './dto/query-clientes-ranking.dto';
import { QueryClientesSearchDto } from './dto/query-clientes-search.dto';
import {
  Cliente,
  ClasificacionCliente,
  EstadoSugerencia,
  EstadoContratoCliente,
  PrioridadSugerencia,
  SegmentoCliente,
  NivelRiesgo,
  Prisma,
  Role,
  TipoCliente,
} from '../generated/client/client';
import {
  endOfBogotaDayUtc,
  parseBogotaDateToUtcEnd,
  parseBogotaDateToUtcStart,
  startOfBogotaDayUtc,
} from '../common/utils/timezone.util';
import { deleteRedisKeysByPattern } from '../common/utils/redis-pattern-delete.util';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  getPrismaAccessFilter,
  PrismaAccessFilter,
} from '../common/utils/access-control.util';

type ClienteWithRelations = Cliente & {
  direcciones?: any[];
  vehiculos?: any[];
  configuracionesOperativas?: any[];
  ordenesServicio?: Array<{
    id: string;
    estadoPago?: string | null;
    valorCotizado?: Prisma.Decimal | number | null;
    valorPagado?: Prisma.Decimal | number | null;
    valorRepuestos?: Prisma.Decimal | number | null;
  }>;
  empresa?: any;
  tenant?: any;
  tipoInteres?: any;
  dashboardSegments?: DashboardSegmentKey[];
};

type DashboardSegmentKey =
  | 'riesgoFuga'
  | 'upsellPotencial'
  | 'dormidos'
  | 'operacionEstable';

type DashboardSegmentedSummary = Record<
  DashboardSegmentKey,
  { count: number; data: ClienteWithRelations[] }
>;

interface DashboardPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface DashboardOverview {
  total: number;
  empresas: number;
  oro: number;
  riesgoCritico: number;
  avgScore: number;
}

interface DashboardKpisResponse {
  overview: DashboardOverview;
  segmentacion: {
    riesgoFuga: { count: number };
    upsellPotencial: { count: number };
    dormidos: { count: number };
    operacionEstable: { count: number };
  };
  meta: {
    cached: boolean;
    generatedAt: string;
    cacheTtlSeconds: number;
  };
}

interface NormalizedDashboardQuery {
  page: number;
  limit: number;
  search: string;
  tipoCliente: 'all' | TipoCliente;
  segment: 'all' | DashboardSegmentKey;
  sort: string;
  dir: 'asc' | 'desc';
  empresas: string[];
  dept: string;
  muni: string;
  barrio: string;
  class: string;
  seg: string;
  risk: string;
  from: string;
  to: string;
  onlySinVisita: boolean;
  onlyWithPendingPayments: boolean;
  onlySinServicios: boolean;
}

type ClientesRankingSort = NonNullable<QueryClientesRankingDto['sort']>;

interface NormalizedRankingQuery {
  page: number;
  limit: number;
  search: string;
  sort: ClientesRankingSort;
  dir: 'asc' | 'desc';
  from: string;
  to: string;
}

interface ClienteRankingRow {
  rank: number;
  clienteId: string;
  cliente: string;
  tipoCliente: TipoCliente;
  telefono: string;
  empresa?: { id: string; nombre: string } | null;
  clasificacionActual: ClasificacionCliente | null;
  clasificacionSugerida: ClasificacionCliente;
  scoreComercial: number;
  totalPagado: number;
  totalCotizado: number;
  ticketPromedio: number;
  totalServicios: number;
  liquidados: number;
  cancelados: number;
  noTomados: number;
  reprogramados: number;
  porcentajeCancelacion: number;
  porcentajeNoToma: number;
  ultimaVisita: Date | null;
}

interface ClientesRankingResponse {
  items: ClienteRankingRow[];
  pagination: DashboardPaginationMeta;
}

interface ClientesRankingKpisResponse {
  overview: {
    totalClientes: number;
    totalPagado: number;
    totalServicios: number;
    promedioTicket: number;
    porcentajeCancelacion: number;
    porcentajeNoToma: number;
    clientesEnRiesgo: number;
  };
  clasificacion: Record<ClasificacionCliente, number>;
  meta: {
    cached: boolean;
    generatedAt: string;
    cacheTtlSeconds: number;
  };
}

interface ClientesRankingApplyResponse {
  totalEvaluados: number;
  actualizados: number;
  tareasRetencionCreadas: number;
  tareasRetencionOmitidas: number;
  sinResponsable: number;
  clasificacion: Record<ClasificacionCliente, number>;
}

interface RankingDateBounds {
  fromDate?: Date;
  toDate: Date;
}

interface ClienteRankingSqlRow {
  rank: number | bigint;
  clienteId: string;
  cliente: string;
  tipoCliente: TipoCliente;
  telefono: string;
  empresaId: string | null;
  empresaNombre: string | null;
  clasificacionActual: ClasificacionCliente | null;
  clasificacionSugerida: ClasificacionCliente;
  scoreComercial: number;
  totalPagado: number | Prisma.Decimal;
  totalCotizado: number | Prisma.Decimal;
  ticketPromedio: number | Prisma.Decimal;
  totalServicios: number | bigint;
  liquidados: number | bigint;
  cancelados: number | bigint;
  noTomados: number | bigint;
  reprogramados: number | bigint;
  porcentajeCancelacion: number | Prisma.Decimal;
  porcentajeNoToma: number | Prisma.Decimal;
  ultimaVisita: Date | null;
}

interface ClienteRankingKpisSqlRow {
  totalClientes: number | bigint;
  totalPagado: number | Prisma.Decimal;
  totalServicios: number | bigint;
  totalLiquidados: number | bigint;
  totalCancelados: number | bigint;
  totalNoTomados: number | bigint;
  clientesEnRiesgo: number | bigint;
  oro: number | bigint;
  plata: number | bigint;
  bronce: number | bigint;
  riesgo: number | bigint;
}

interface ClientesRankingApplySqlRow {
  totalEvaluados: number | bigint;
  actualizados: number | bigint;
  oro: number | bigint;
  plata: number | bigint;
  bronce: number | bigint;
  riesgo: number | bigint;
}

interface ClienteRetencionRiskSqlRow {
  clienteId: string;
  cliente: string;
  telefono: string | null;
  empresaId: string | null;
  empresaNombre: string | null;
  scoreComercial: number;
  totalServicios: number | bigint;
  porcentajeCancelacion: number | Prisma.Decimal;
  porcentajeNoToma: number | Prisma.Decimal;
}

interface RetentionTaskSummary {
  tareasRetencionCreadas: number;
  tareasRetencionOmitidas: number;
  sinResponsable: number;
}

interface ClienteIdRow {
  id: string;
}

const clienteSearchSelect = {
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

export type ClienteSearchResult = Prisma.ClienteGetPayload<{
  select: typeof clienteSearchSelect;
}>;

@Injectable()
export class ClientesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClientesService.name);
  private redis: IORedis | null = null;
  private readonly dashboardKpisCacheTtlSeconds = 60 * 10;
  private readonly retentionCallSuggestionType = 'LLAMADA_RETENCION';
  private readonly retentionCallTaskTitle =
    'Llamar cliente en seguimiento prioritario';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    try {
      this.redis = new IORedis(this.getRedisOptions());
      this.redis.on('error', (error) => {
        this.logger.warn(`Redis error in clientes cache: ${error.message}`);
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo inicializar Redis para cache de KPIs de clientes: ${
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

  private hasGeoScope(accessFilter: PrismaAccessFilter): boolean {
    return (
      (accessFilter.zonaIds || []).length > 0 ||
      (accessFilter.municipalityIds || []).length > 0 ||
      (accessFilter.departmentIds || []).length > 0
    );
  }

  private buildDireccionGeoWhere(
    accessFilter: PrismaAccessFilter,
  ): Prisma.DireccionWhereInput | undefined {
    const conditions: Prisma.DireccionWhereInput[] = [];

    if ((accessFilter.zonaIds || []).length > 0) {
      conditions.push({
        zonaId: {
          in: accessFilter.zonaIds,
        },
      });
    }

    if ((accessFilter.municipalityIds || []).length > 0) {
      conditions.push({
        municipioId: {
          in: accessFilter.municipalityIds,
        },
      });
    }

    if ((accessFilter.departmentIds || []).length > 0) {
      conditions.push({
        departmentId: {
          in: accessFilter.departmentIds,
        },
      });
    }

    if (conditions.length === 0) {
      return undefined;
    }

    if (conditions.length === 1) {
      return conditions[0];
    }

    return { OR: conditions };
  }

  private buildClienteDireccionesInclude(accessFilter: PrismaAccessFilter) {
    const direccionWhere = this.buildDireccionGeoWhere(accessFilter);

    return direccionWhere
      ? {
          where: direccionWhere,
          include: { municipioRel: true },
        }
      : {
          include: { municipioRel: true },
        };
  }

  private buildEmpresaWhere(
    empresaFilter?: PrismaAccessFilter['empresaId'],
  ): PrismaAccessFilter['empresaId'] {
    return empresaFilter;
  }

  private buildClienteWhere(
    accessFilter: PrismaAccessFilter,
    extraWhere: Prisma.ClienteWhereInput = {},
  ): Prisma.ClienteWhereInput {
    const where: Prisma.ClienteWhereInput = {
      ...extraWhere,
      ...(accessFilter.tenantId ? { tenantId: accessFilter.tenantId } : {}),
      ...(accessFilter.empresaId ? { empresaId: accessFilter.empresaId } : {}),
    };

    const geoWhere = this.buildDireccionGeoWhere(accessFilter);
    if (geoWhere) {
      where.direcciones = {
        some: geoWhere,
      };
    }

    return where;
  }

  private normalizeClienteOptionalValue(value?: string | null): string | null {
    const trimmed = value?.trim();

    if (!trimmed) {
      return null;
    }

    const normalized = trimmed
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (
      normalized === 'no concretado' ||
      normalized === 'noconcretado' ||
      normalized === 'no_concretado' ||
      normalized === 'sin dato' ||
      normalized === 'sin datos' ||
      normalized === 'n/a' ||
      normalized === 'na'
    ) {
      return null;
    }

    return trimmed;
  }

  private normalizeClientePhone(value?: string | null): string {
    const normalized = this.normalizeClienteOptionalValue(value);

    if (!normalized) {
      throw new BadRequestException('Ingresá un teléfono principal válido.');
    }

    return normalized.replace(/\s+/g, '');
  }

  private async assertClienteEmpresaWithinTenant(
    user: JwtPayload,
    empresaId: string,
  ): Promise<void> {
    if (!user.tenantId) {
      throw new ForbiddenException(
        'No tienes acceso a la empresa seleccionada.',
      );
    }

    const empresa = await this.prisma.empresa.findFirst({
      where: {
        id: empresaId,
        tenantId: user.tenantId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!empresa) {
      throw new ForbiddenException(
        'No tienes acceso a la empresa seleccionada.',
      );
    }
  }

  private async resolveMunicipalityDepartmentId(
    municipioId: string,
    cache: Map<string, string | null>,
  ): Promise<string | null> {
    if (cache.has(municipioId)) {
      return cache.get(municipioId) ?? null;
    }

    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipioId },
      select: { departmentId: true },
    });

    const departmentId = municipality?.departmentId ?? null;
    cache.set(municipioId, departmentId);
    return departmentId;
  }

  private async assertClienteDireccionesWithinGeoScope(
    accessFilter: PrismaAccessFilter,
    direcciones?: CreateClienteDto['direcciones'],
  ): Promise<void> {
    if (!this.hasGeoScope(accessFilter)) {
      return;
    }

    if (!direcciones || direcciones.length === 0) {
      throw new UnauthorizedException(
        'No tienes permisos para guardar clientes sin una dirección dentro de tu alcance geográfico.',
      );
    }

    const municipalityDepartmentCache = new Map<string, string | null>();
    const zonaIds = accessFilter.zonaIds ?? [];
    const municipalityIds = accessFilter.municipalityIds ?? [];
    const departmentIds = accessFilter.departmentIds ?? [];

    for (const direccion of direcciones) {
      const rawDireccion = direccion as {
        zonaId?: unknown;
        municipioId?: unknown;
        departmentId?: unknown;
      };
      const zonaId =
        typeof rawDireccion.zonaId === 'string'
          ? rawDireccion.zonaId
          : undefined;
      const municipioId =
        typeof rawDireccion.municipioId === 'string'
          ? rawDireccion.municipioId
          : undefined;
      const departmentId =
        typeof rawDireccion.departmentId === 'string'
          ? rawDireccion.departmentId
          : undefined;

      if (zonaIds.length > 0) {
        if (!zonaId || !zonaIds.includes(zonaId)) {
          throw new UnauthorizedException(
            'La dirección del cliente no está dentro de tu alcance geográfico.',
          );
        }
      }

      if (municipalityIds.length > 0) {
        if (!municipioId || !municipalityIds.includes(municipioId)) {
          throw new UnauthorizedException(
            'La dirección del cliente no está dentro de tu alcance geográfico.',
          );
        }
      }

      if (departmentIds.length > 0) {
        const resolvedDepartmentId =
          departmentId ||
          (municipioId
            ? await this.resolveMunicipalityDepartmentId(
                municipioId,
                municipalityDepartmentCache,
              )
            : null);

        if (
          !resolvedDepartmentId ||
          !departmentIds.includes(resolvedDepartmentId)
        ) {
          throw new UnauthorizedException(
            'La dirección del cliente no está dentro de tu alcance geográfico.',
          );
        }
      }
    }
  }

  private normalizeDashboardQuery(
    query?: QueryClientesDashboardDto,
  ): NormalizedDashboardQuery {
    const toFlag = (value?: string) => value === 'true';

    return {
      page: Math.max(1, Number(query?.page ?? 1) || 1),
      limit: Math.min(100, Math.max(1, Number(query?.limit ?? 10) || 10)),
      search: (query?.search || '').trim(),
      tipoCliente:
        query?.tipoCliente === TipoCliente.PERSONA ||
        query?.tipoCliente === TipoCliente.EMPRESA
          ? query.tipoCliente
          : 'all',
      segment: (query?.segment || 'all') as NormalizedDashboardQuery['segment'],
      sort: (query?.sort || '').trim(),
      dir: query?.dir === 'asc' ? 'asc' : 'desc',
      empresas: (query?.empresas || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      dept: query?.dept || 'all',
      muni: query?.muni || 'all',
      barrio: (query?.barrio || '').trim(),
      class: query?.class || 'all',
      seg: query?.seg || 'all',
      risk: query?.risk || 'all',
      from: query?.from || '',
      to: query?.to || '',
      onlySinVisita: toFlag(query?.sinVisita),
      onlyWithPendingPayments: toFlag(query?.pendingPayments),
      onlySinServicios: toFlag(query?.sinServicios),
    };
  }

  private normalizeRankingQuery(
    query?: QueryClientesRankingDto,
  ): NormalizedRankingQuery {
    const sortOptions: ClientesRankingSort[] = [
      'ranking',
      'cliente',
      'totalPagado',
      'ticketPromedio',
      'liquidados',
      'cancelacion',
      'noTomados',
    ];
    const sort = sortOptions.includes(query?.sort || 'ranking')
      ? (query?.sort as ClientesRankingSort) || 'ranking'
      : 'ranking';

    return {
      page: Math.max(1, Number(query?.page ?? 1) || 1),
      limit: Math.min(100, Math.max(1, Number(query?.limit ?? 25) || 25)),
      search: (query?.search || '').trim(),
      sort,
      dir: query?.dir === 'asc' ? 'asc' : 'desc',
      from: query?.from || '',
      to: query?.to || '',
    };
  }

  private buildRankingClienteWhere(
    accessFilter: PrismaAccessFilter,
    query: NormalizedRankingQuery,
  ): Prisma.ClienteWhereInput {
    const andConditions: Prisma.ClienteWhereInput[] = [{ deletedAt: null }];

    if (query.search) {
      andConditions.push({
        OR: [
          { nombre: { contains: query.search, mode: 'insensitive' } },
          { apellido: { contains: query.search, mode: 'insensitive' } },
          { razonSocial: { contains: query.search, mode: 'insensitive' } },
          { telefono: { contains: query.search, mode: 'insensitive' } },
          { nit: { contains: query.search, mode: 'insensitive' } },
          { numeroDocumento: { contains: query.search, mode: 'insensitive' } },
          { correo: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    return this.buildClienteWhere(accessFilter, { AND: andConditions });
  }

  private buildRankingOrderWhere(
    accessFilter: PrismaAccessFilter,
    clienteIds: string[],
    query: NormalizedRankingQuery,
  ): Prisma.OrdenServicioWhereInput {
    const empresaWhere = this.buildEmpresaWhere(accessFilter.empresaId);
    const direccionGeoWhere = this.buildDireccionGeoWhere(accessFilter);
    const fromDate = parseBogotaDateToUtcStart(query.from) || undefined;
    const requestedToDate = parseBogotaDateToUtcEnd(query.to);
    const todayEnd = endOfBogotaDayUtc(new Date());
    const toDate =
      requestedToDate && requestedToDate < todayEnd
        ? requestedToDate
        : todayEnd;

    return {
      deletedAt: null,
      clienteId: { in: clienteIds },
      ...(accessFilter.tenantId ? { tenantId: accessFilter.tenantId } : {}),
      ...(empresaWhere ? { empresaId: empresaWhere } : {}),
      ...(direccionGeoWhere
        ? {
            direccion: {
              is: direccionGeoWhere,
            },
          }
        : {}),
      fechaVisita: {
        not: null,
        ...(fromDate ? { gte: fromDate } : {}),
        lte: toDate,
      },
    };
  }

  private getRankingDateBounds(
    query: Pick<NormalizedRankingQuery, 'from' | 'to'>,
  ): RankingDateBounds {
    const requestedFromDate = parseBogotaDateToUtcStart(query.from);
    const requestedToDate = parseBogotaDateToUtcEnd(query.to);
    const todayEnd = endOfBogotaDayUtc(new Date());

    return {
      ...(requestedFromDate ? { fromDate: requestedFromDate } : {}),
      toDate:
        requestedToDate && requestedToDate < todayEnd
          ? requestedToDate
          : todayEnd,
    };
  }

  private buildRankingClienteSqlWhere(
    accessFilter: PrismaAccessFilter,
    query: Pick<NormalizedRankingQuery, 'search'>,
  ): Prisma.Sql {
    const clauses: Prisma.Sql[] = [Prisma.sql`c."deletedAt" IS NULL`];

    if (accessFilter.tenantId) {
      clauses.push(Prisma.sql`c."tenantId" = ${accessFilter.tenantId}::uuid`);
    }

    if (typeof accessFilter.empresaId === 'string') {
      clauses.push(Prisma.sql`c."empresaId" = ${accessFilter.empresaId}::uuid`);
    } else if (
      accessFilter.empresaId &&
      'in' in accessFilter.empresaId &&
      accessFilter.empresaId.in.length > 0
    ) {
      clauses.push(
        Prisma.sql`c."empresaId" IN (${Prisma.join(
          accessFilter.empresaId.in.map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    if (this.hasGeoScope(accessFilter)) {
      const geoClauses: Prisma.Sql[] = [];

      if ((accessFilter.zonaIds || []).length > 0) {
        geoClauses.push(
          Prisma.sql`d."zonaId" IN (${Prisma.join(
            (accessFilter.zonaIds || []).map((id) => Prisma.sql`${id}::uuid`),
          )})`,
        );
      }

      if ((accessFilter.municipalityIds || []).length > 0) {
        geoClauses.push(
          Prisma.sql`d."municipioId" IN (${Prisma.join(
            (accessFilter.municipalityIds || []).map(
              (id) => Prisma.sql`${id}::uuid`,
            ),
          )})`,
        );
      }

      if ((accessFilter.departmentIds || []).length > 0) {
        geoClauses.push(
          Prisma.sql`d."departmentId" IN (${Prisma.join(
            (accessFilter.departmentIds || []).map(
              (id) => Prisma.sql`${id}::uuid`,
            ),
          )})`,
        );
      }

      if (geoClauses.length > 0) {
        clauses.push(Prisma.sql`
          EXISTS (
            SELECT 1
            FROM "direcciones" d
            WHERE d."clienteId" = c."id"
              AND (${Prisma.join(geoClauses, ' OR ')})
          )
        `);
      }
    }

    if (query.search) {
      const term = `%${query.search}%`;
      clauses.push(Prisma.sql`
        (
          c."nombre" ILIKE ${term}
          OR c."apellido" ILIKE ${term}
          OR c."razonSocial" ILIKE ${term}
          OR c."telefono" ILIKE ${term}
          OR c."nit" ILIKE ${term}
          OR c."numeroDocumento" ILIKE ${term}
          OR c."correo" ILIKE ${term}
        )
      `);
    }

    return Prisma.join(clauses, ' AND ');
  }

  private buildRankingOrderSqlWhere(
    accessFilter: PrismaAccessFilter,
    query: Pick<NormalizedRankingQuery, 'from' | 'to'>,
  ): Prisma.Sql {
    const { fromDate, toDate } = this.getRankingDateBounds(query);
    const clauses: Prisma.Sql[] = [
      Prisma.sql`os."deletedAt" IS NULL`,
      Prisma.sql`os."fechaVisita" IS NOT NULL`,
      Prisma.sql`os."fechaVisita" <= ${toDate}`,
    ];

    if (fromDate) {
      clauses.push(Prisma.sql`os."fechaVisita" >= ${fromDate}`);
    }

    if (accessFilter.tenantId) {
      clauses.push(Prisma.sql`os."tenantId" = ${accessFilter.tenantId}::uuid`);
    }

    if (typeof accessFilter.empresaId === 'string') {
      clauses.push(
        Prisma.sql`os."empresaId" = ${accessFilter.empresaId}::uuid`,
      );
    } else if (
      accessFilter.empresaId &&
      'in' in accessFilter.empresaId &&
      accessFilter.empresaId.in.length > 0
    ) {
      clauses.push(
        Prisma.sql`os."empresaId" IN (${Prisma.join(
          accessFilter.empresaId.in.map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    const geoClauses: Prisma.Sql[] = [];

    if ((accessFilter.zonaIds || []).length > 0) {
      geoClauses.push(
        Prisma.sql`os."zonaId" IN (${Prisma.join(
          (accessFilter.zonaIds || []).map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    if ((accessFilter.municipalityIds || []).length > 0) {
      geoClauses.push(
        Prisma.sql`dir."municipioId" IN (${Prisma.join(
          (accessFilter.municipalityIds || []).map(
            (id) => Prisma.sql`${id}::uuid`,
          ),
        )})`,
      );
    }

    if ((accessFilter.departmentIds || []).length > 0) {
      geoClauses.push(
        Prisma.sql`dir."departmentId" IN (${Prisma.join(
          (accessFilter.departmentIds || []).map(
            (id) => Prisma.sql`${id}::uuid`,
          ),
        )})`,
      );
    }

    if (geoClauses.length > 0) {
      clauses.push(Prisma.sql`(${Prisma.join(geoClauses, ' OR ')})`);
    }

    return Prisma.join(clauses, ' AND ');
  }

  private buildRankingSqlOrderBy(query: NormalizedRankingQuery): Prisma.Sql {
    const desc = query.dir !== 'asc';

    switch (query.sort) {
      case 'cliente':
        return desc
          ? Prisma.sql`"cliente" DESC, "clienteId" ASC`
          : Prisma.sql`"cliente" ASC, "clienteId" ASC`;
      case 'totalPagado':
        return desc
          ? Prisma.sql`"totalPagado" DESC, "scoreComercial" DESC, "cliente" ASC`
          : Prisma.sql`"totalPagado" ASC, "scoreComercial" DESC, "cliente" ASC`;
      case 'ticketPromedio':
        return desc
          ? Prisma.sql`"ticketPromedio" DESC, "totalPagado" DESC, "cliente" ASC`
          : Prisma.sql`"ticketPromedio" ASC, "totalPagado" DESC, "cliente" ASC`;
      case 'liquidados':
        return desc
          ? Prisma.sql`"liquidados" DESC, "totalPagado" DESC, "cliente" ASC`
          : Prisma.sql`"liquidados" ASC, "totalPagado" DESC, "cliente" ASC`;
      case 'cancelacion':
        return desc
          ? Prisma.sql`"porcentajeCancelacion" DESC, "cliente" ASC`
          : Prisma.sql`"porcentajeCancelacion" ASC, "cliente" ASC`;
      case 'noTomados':
        return desc
          ? Prisma.sql`"porcentajeNoToma" DESC, "cliente" ASC`
          : Prisma.sql`"porcentajeNoToma" ASC, "cliente" ASC`;
      case 'ranking':
      default:
        return desc
          ? Prisma.sql`"scoreComercial" DESC, "totalPagado" DESC, "cliente" ASC`
          : Prisma.sql`"scoreComercial" ASC, "totalPagado" DESC, "cliente" ASC`;
    }
  }

  private buildRankingBaseSql(
    accessFilter: PrismaAccessFilter,
    query: Pick<NormalizedRankingQuery, 'search' | 'from' | 'to'>,
  ): Prisma.Sql {
    const clienteWhere = this.buildRankingClienteSqlWhere(accessFilter, query);
    const orderWhere = this.buildRankingOrderSqlWhere(accessFilter, query);

    return Prisma.sql`
      WITH scoped_clients AS (
        SELECT
          c."id" AS "clienteId",
          COALESCE(
            NULLIF(
              CASE
                WHEN c."tipoCliente" = 'EMPRESA' THEN c."razonSocial"
                ELSE CONCAT_WS(' ', c."nombre", c."apellido")
              END,
              ''
            ),
            c."razonSocial",
            c."telefono"
          ) AS "cliente",
          c."tipoCliente" AS "tipoCliente",
          c."telefono" AS "telefono",
          c."clasificacion" AS "clasificacionActual",
          c."ultimaVisita" AS "ultimaVisita",
          e."id" AS "empresaId",
          e."nombre" AS "empresaNombre"
        FROM "clientes" c
        LEFT JOIN "empresas" e ON e."id" = c."empresaId"
        WHERE ${clienteWhere}
      ),
      scoped_orders AS (
        SELECT os.*
        FROM "ordenes_servicio" os
        LEFT JOIN "direcciones" dir ON dir."id" = os."direccionId"
        WHERE ${orderWhere}
      ),
      order_stats AS (
        SELECT
          os."clienteId",
          COUNT(*)::int AS "totalServicios",
          COALESCE(SUM(os."valorPagado"), 0)::double precision AS "totalPagado",
          (
            COALESCE(SUM(os."valorCotizado"), 0) +
            COALESCE(SUM(os."valorRepuestos"), 0)
          )::double precision AS "totalCotizado",
          COUNT(*) FILTER (WHERE os."estadoServicio" = 'LIQUIDADO')::int AS "liquidados",
          COUNT(*) FILTER (WHERE os."estadoServicio" = 'CANCELADO')::int AS "cancelados",
          COUNT(*) FILTER (WHERE os."estadoServicio" = 'SIN_CONCRETAR')::int AS "noTomados",
          COUNT(*) FILTER (WHERE os."estadoServicio" = 'REPROGRAMADO')::int AS "reprogramados"
        FROM scoped_orders os
        GROUP BY os."clienteId"
      ),
      enriched AS (
        SELECT
          sc.*,
          COALESCE(os."totalServicios", 0)::int AS "totalServicios",
          COALESCE(os."totalPagado", 0)::double precision AS "totalPagado",
          COALESCE(os."totalCotizado", 0)::double precision AS "totalCotizado",
          COALESCE(os."liquidados", 0)::int AS "liquidados",
          COALESCE(os."cancelados", 0)::int AS "cancelados",
          COALESCE(os."noTomados", 0)::int AS "noTomados",
          COALESCE(os."reprogramados", 0)::int AS "reprogramados",
          CASE
            WHEN COALESCE(os."liquidados", 0) > 0
              THEN ROUND(COALESCE(os."totalPagado", 0) / os."liquidados")
            ELSE 0
          END::double precision AS "ticketPromedio",
          CASE
            WHEN COALESCE(os."totalServicios", 0) > 0
              THEN ROUND((COALESCE(os."cancelados", 0)::double precision / os."totalServicios") * 100)
            ELSE 0
          END::double precision AS "porcentajeCancelacion",
          CASE
            WHEN COALESCE(os."totalServicios", 0) > 0
              THEN ROUND((COALESCE(os."noTomados", 0)::double precision / os."totalServicios") * 100)
            ELSE 0
          END::double precision AS "porcentajeNoToma",
          CASE
            WHEN COALESCE(os."totalPagado", 0) > 0
              THEN ROW_NUMBER() OVER (ORDER BY COALESCE(os."totalPagado", 0) DESC)
            ELSE NULL
          END AS "paidPosition",
          COUNT(*) FILTER (WHERE COALESCE(os."totalPagado", 0) > 0) OVER () AS "positivePaidCount"
        FROM scoped_clients sc
        LEFT JOIN order_stats os ON os."clienteId" = sc."clienteId"
      ),
      classified AS (
        SELECT
          e.*,
          CASE
            WHEN e."totalServicios" = 0 THEN 'BRONCE'
            WHEN e."porcentajeCancelacion" >= 35 OR e."porcentajeNoToma" >= 30 THEN 'RIESGO'
            WHEN e."positivePaidCount" > 0
              AND ((e."paidPosition" - 1)::double precision / e."positivePaidCount") <= 0.15
              AND e."liquidados" >= 3 THEN 'ORO'
            WHEN e."positivePaidCount" > 0
              AND ((e."paidPosition" - 1)::double precision / e."positivePaidCount") <= 0.45
              AND e."liquidados" >= 2 THEN 'PLATA'
            ELSE 'BRONCE'
          END AS "clasificacionSugerida"
        FROM enriched e
      ),
      scored AS (
        SELECT
          c.*,
          GREATEST(
            0,
            ROUND(
              ((LN(c."totalPagado" + 1) / LN(10)) * 18) +
              (c."liquidados" * 6) +
              CASE
                WHEN c."totalServicios" > 0 THEN (c."liquidados"::double precision / c."totalServicios") * 30
                ELSE 0
              END -
              (c."porcentajeCancelacion" * 0.8) -
              c."porcentajeNoToma"
            )
          )::int AS "scoreComercial"
        FROM classified c
      )
    `;
  }

  private mapRankingSqlRow(row: ClienteRankingSqlRow): ClienteRankingRow {
    return {
      rank: Number(row.rank),
      clienteId: row.clienteId,
      cliente: row.cliente,
      tipoCliente: row.tipoCliente,
      telefono: row.telefono,
      empresa: row.empresaId
        ? { id: row.empresaId, nombre: row.empresaNombre || 'Sin empresa' }
        : null,
      clasificacionActual: row.clasificacionActual,
      clasificacionSugerida: row.clasificacionSugerida,
      scoreComercial: Number(row.scoreComercial || 0),
      totalPagado: Number(row.totalPagado || 0),
      totalCotizado: Number(row.totalCotizado || 0),
      ticketPromedio: Number(row.ticketPromedio || 0),
      totalServicios: Number(row.totalServicios || 0),
      liquidados: Number(row.liquidados || 0),
      cancelados: Number(row.cancelados || 0),
      noTomados: Number(row.noTomados || 0),
      reprogramados: Number(row.reprogramados || 0),
      porcentajeCancelacion: Number(row.porcentajeCancelacion || 0),
      porcentajeNoToma: Number(row.porcentajeNoToma || 0),
      ultimaVisita: row.ultimaVisita,
    };
  }

  private buildDashboardWhere(
    accessFilter: PrismaAccessFilter,
    query: NormalizedDashboardQuery,
    extraWhere: Prisma.ClienteWhereInput = {},
  ): Prisma.ClienteWhereInput {
    const andConditions: Prisma.ClienteWhereInput[] = [{ deletedAt: null }];

    if (query.search) {
      const searchTokens = query.search
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);

      const searchClauses: Prisma.ClienteWhereInput[] = [
        { nombre: { contains: query.search, mode: 'insensitive' } },
        { apellido: { contains: query.search, mode: 'insensitive' } },
        { razonSocial: { contains: query.search, mode: 'insensitive' } },
        { nit: { contains: query.search, mode: 'insensitive' } },
        { numeroDocumento: { contains: query.search, mode: 'insensitive' } },
        { correo: { contains: query.search, mode: 'insensitive' } },
        { telefono: { contains: query.search, mode: 'insensitive' } },
      ];

      if (searchTokens.length > 1) {
        searchClauses.push({
          AND: searchTokens.map((token) => ({
            OR: [
              { nombre: { contains: token, mode: 'insensitive' } },
              { apellido: { contains: token, mode: 'insensitive' } },
              { razonSocial: { contains: token, mode: 'insensitive' } },
              { nit: { contains: token, mode: 'insensitive' } },
              { numeroDocumento: { contains: token, mode: 'insensitive' } },
              { telefono: { contains: token, mode: 'insensitive' } },
            ],
          })),
        });
      }

      andConditions.push({
        OR: searchClauses,
      });
    }

    if (query.empresas.length > 0) {
      andConditions.push({
        empresaId: {
          in: query.empresas,
        },
      });
    }

    if (query.tipoCliente !== 'all') {
      andConditions.push({
        tipoCliente: query.tipoCliente,
      });
    }

    if (query.dept !== 'all') {
      andConditions.push({
        direcciones: {
          some: {
            departmentId: query.dept,
          },
        },
      });
    }

    if (query.muni !== 'all') {
      andConditions.push({
        direcciones: {
          some: {
            municipioId: query.muni,
          },
        },
      });
    }

    if (query.barrio) {
      andConditions.push({
        direcciones: {
          some: {
            barrio: {
              contains: query.barrio,
              mode: 'insensitive',
            },
          },
        },
      });
    }

    if (query.class !== 'all') {
      andConditions.push({
        clasificacion: query.class as ClasificacionCliente,
      });
    }

    if (query.seg !== 'all') {
      andConditions.push({
        segmento: query.seg as SegmentoCliente,
      });
    }

    if (query.risk !== 'all') {
      andConditions.push({
        nivelRiesgo: query.risk as NivelRiesgo,
      });
    }

    if (query.from || query.to) {
      andConditions.push({
        createdAt: {
          ...(query.from
            ? { gte: new Date(`${query.from}T00:00:00.000Z`) }
            : {}),
          ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
        },
      });
    }

    if (query.onlySinVisita) {
      andConditions.push({
        OR: [{ proximaVisita: null }, { proximaVisita: { lt: new Date() } }],
      });
    }

    return this.buildClienteWhere(accessFilter, {
      AND: andConditions,
      ...extraWhere,
    });
  }

  private buildClienteInclude(
    accessFilter: PrismaAccessFilter,
  ): Prisma.ClienteInclude {
    const empresaWhere = this.buildEmpresaWhere(accessFilter.empresaId);
    const clienteDireccionesInclude =
      this.buildClienteDireccionesInclude(accessFilter);
    const direccionGeoWhere = this.buildDireccionGeoWhere(accessFilter);

    return {
      direcciones: clienteDireccionesInclude,
      vehiculos: true,
      tipoInteres: true,
      empresa: true,
      configuracionesOperativas: {
        where: {
          ...(empresaWhere ? { empresaId: empresaWhere } : {}),
        },
      },
      ordenesServicio: {
        where: {
          ...(empresaWhere ? { empresaId: empresaWhere } : {}),
          ...(direccionGeoWhere
            ? {
                direccion: {
                  is: direccionGeoWhere,
                },
              }
            : {}),
          estadoPago: { not: 'PAGADO' },
        },
        select: {
          id: true,
          estadoPago: true,
          valorCotizado: true,
          valorPagado: true,
          valorRepuestos: true,
        },
      },
    };
  }

  private applyCommercialRisk(
    client: ClienteWithRelations,
  ): ClienteWithRelations {
    if (client.clasificacion === ClasificacionCliente.RIESGO) {
      return client;
    }

    const now = startOfBogotaDayUtc(new Date());
    const lastVisit = client.ultimaVisita
      ? new Date(client.ultimaVisita)
      : null;

    if (!lastVisit) {
      return client;
    }

    const diffDays = (now.getTime() - lastVisit.getTime()) / (1000 * 3600 * 24);
    const frequency = client.frecuenciaServicio || 30;
    const isCommercialRisk =
      diffDays > (frequency === 30 ? 45 : frequency * 1.5);

    if (!isCommercialRisk) {
      return client;
    }

    return {
      ...client,
      clasificacion: ClasificacionCliente.RIESGO,
    };
  }

  private buildDashboardOrderBy(
    query: NormalizedDashboardQuery,
  ): Prisma.ClienteOrderByWithRelationInput {
    switch (query.sort) {
      case 'score':
        return { score: query.dir };
      case 'proximaVisita':
        return { proximaVisita: query.dir };
      default:
        return { createdAt: 'desc' };
    }
  }

  private requiresInMemoryDashboardProcessing(
    query: NormalizedDashboardQuery,
  ): boolean {
    return (
      query.segment !== 'all' ||
      query.sort === 'nombre' ||
      query.sort === 'riesgo'
    );
  }

  private buildSegmentIdSets(segmented: DashboardSegmentedSummary) {
    return {
      riesgoFuga: new Set(segmented.riesgoFuga.data.map((client) => client.id)),
      upsellPotencial: new Set(
        segmented.upsellPotencial.data.map((client) => client.id),
      ),
      dormidos: new Set(segmented.dormidos.data.map((client) => client.id)),
      operacionEstable: new Set(
        segmented.operacionEstable.data.map((client) => client.id),
      ),
    };
  }

  private attachDashboardSegments(
    clients: ClienteWithRelations[],
    segmentIdSets: ReturnType<ClientesService['buildSegmentIdSets']>,
  ): ClienteWithRelations[] {
    return clients.map((client) => ({
      ...client,
      dashboardSegments: (
        Object.entries(segmentIdSets) as [DashboardSegmentKey, Set<string>][]
      )
        .filter(([, ids]) => ids.has(client.id))
        .map(([segment]) => segment),
    }));
  }

  private filterClientsBySegment(
    clients: ClienteWithRelations[],
    segment: NormalizedDashboardQuery['segment'],
  ): ClienteWithRelations[] {
    if (segment === 'all') {
      return clients;
    }

    return clients.filter((client) =>
      (client.dashboardSegments || []).includes(segment),
    );
  }

  private filterClientsInMemory(
    clients: ClienteWithRelations[],
    query: NormalizedDashboardQuery,
  ): ClienteWithRelations[] {
    const todayYmd = startOfBogotaDayUtc(new Date()).toISOString().slice(0, 10);

    return clients.filter((client) => {
      const matchesPendingPayments =
        !query.onlyWithPendingPayments ||
        Boolean(
          client.ordenesServicio?.some((order) => {
            const total =
              Number(order.valorCotizado || 0) +
              Number(order.valorRepuestos || 0);
            const pagado = Number(order.valorPagado || 0);
            return (
              pagado < total &&
              order.estadoPago !== 'PAGADO' &&
              order.estadoPago !== 'CORTESIA'
            );
          }),
        );

      const matchesSinServicios =
        !query.onlySinServicios ||
        !client.ordenesServicio ||
        client.ordenesServicio.length === 0;

      const matchesSinVisita =
        !query.onlySinVisita ||
        !client.proximaVisita ||
        client.proximaVisita.toISOString().slice(0, 10) < todayYmd;

      return matchesPendingPayments && matchesSinServicios && matchesSinVisita;
    });
  }

  private sortClientsInMemory(
    clients: ClienteWithRelations[],
    query: NormalizedDashboardQuery,
  ): ClienteWithRelations[] {
    if (!query.sort) {
      return [...clients].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );
    }

    return [...clients].sort((a, b) => {
      let aVal: unknown = (a as unknown as Record<string, unknown>)[query.sort];
      let bVal: unknown = (b as unknown as Record<string, unknown>)[query.sort];

      if (query.sort === 'nombre') {
        aVal =
          a.tipoCliente === 'EMPRESA'
            ? a.razonSocial
            : `${a.nombre || ''} ${a.apellido || ''}`.trim();
        bVal =
          b.tipoCliente === 'EMPRESA'
            ? b.razonSocial
            : `${b.nombre || ''} ${b.apellido || ''}`.trim();
      } else if (query.sort === 'riesgo') {
        aVal = String(a.nivelRiesgo || '');
        bVal = String(b.nivelRiesgo || '');
      } else if (query.sort === 'proximaVisita') {
        aVal = a.proximaVisita ? a.proximaVisita.getTime() : 0;
        bVal = b.proximaVisita ? b.proximaVisita.getTime() : 0;
      }

      const nA = Number(aVal);
      const nB = Number(bVal);
      if (!Number.isNaN(nA) && !Number.isNaN(nB)) {
        return query.dir === 'asc' ? nA - nB : nB - nA;
      }

      const sA =
        typeof aVal === 'string' || typeof aVal === 'number'
          ? String(aVal)
          : '';
      const sB =
        typeof bVal === 'string' || typeof bVal === 'number'
          ? String(bVal)
          : '';
      return query.dir === 'asc' ? sA.localeCompare(sB) : sB.localeCompare(sA);
    });
  }

  private buildDashboardOverview(
    clients: ClienteWithRelations[],
  ): DashboardOverview {
    const total = clients.length;
    const empresas = clients.filter(
      (client) => client.tipoCliente === 'EMPRESA',
    ).length;
    const oro = clients.filter(
      (client) => client.clasificacion === ClasificacionCliente.ORO,
    ).length;
    const riesgoCritico = clients.filter((client) => {
      const risk = String(client.nivelRiesgo || '').toUpperCase();
      return risk === 'CRITICO' || risk === 'CRÍTICO' || risk === 'ALTO';
    }).length;
    const avgScore =
      total > 0
        ? Math.round(
            clients.reduce(
              (acc, client) => acc + Number(client.score || 0),
              0,
            ) / total,
          )
        : 0;

    return { total, empresas, oro, riesgoCritico, avgScore };
  }

  private buildDashboardSegmentacion(
    clients: ClienteWithRelations[],
  ): DashboardKpisResponse['segmentacion'] {
    const segmentacionRaw = this.buildSegmentedFromClients(clients);

    return {
      riesgoFuga: { count: segmentacionRaw.riesgoFuga.count },
      upsellPotencial: { count: segmentacionRaw.upsellPotencial.count },
      dormidos: { count: segmentacionRaw.dormidos.count },
      operacionEstable: { count: segmentacionRaw.operacionEstable.count },
    };
  }

  private buildDashboardKpisCacheKey(accessFilter: PrismaAccessFilter): string {
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

    return [
      'clientes',
      'dashboard-kpis',
      `tenant:${accessFilter.tenantId || 'all'}`,
      `empresa:${empresaScope}`,
      `zonas:${zonaScope || 'none'}`,
      `municipios:${municipalityScope || 'none'}`,
      `departamentos:${departmentScope || 'none'}`,
    ].join('|');
  }

  private buildRankingKpisCacheKey(
    accessFilter: PrismaAccessFilter,
    query: Pick<NormalizedRankingQuery, 'search' | 'from' | 'to'>,
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
    const { fromDate, toDate } = this.getRankingDateBounds(query);

    return [
      'clientes',
      'ranking-kpis',
      `tenant:${accessFilter.tenantId || 'all'}`,
      `empresa:${empresaScope}`,
      `zonas:${zonaScope || 'none'}`,
      `municipios:${municipalityScope || 'none'}`,
      `departamentos:${departmentScope || 'none'}`,
      `search:${query.search || 'none'}`,
      `from:${fromDate?.toISOString() || 'none'}`,
      `to:${toDate.toISOString()}`,
    ].join('|');
  }

  private async getDashboardKpisFromCache(
    cacheKey: string,
  ): Promise<DashboardKpisResponse | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(cacheKey);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as DashboardKpisResponse;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer cache de KPIs de clientes (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async setDashboardKpisCache(
    cacheKey: string,
    payload: DashboardKpisResponse,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.dashboardKpisCacheTtlSeconds,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo escribir cache de KPIs de clientes (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async getRankingKpisFromCache(
    cacheKey: string,
  ): Promise<ClientesRankingKpisResponse | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(cacheKey);
      if (!cached) {
        return null;
      }

      return JSON.parse(cached) as ClientesRankingKpisResponse;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer cache de indicadores de ranking de clientes (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async setRankingKpisCache(
    cacheKey: string,
    payload: ClientesRankingKpisResponse,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.dashboardKpisCacheTtlSeconds,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo escribir cache de indicadores de ranking de clientes (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async invalidateDashboardKpisCache(tenantId?: string): Promise<void> {
    if (!this.redis || !tenantId) {
      return;
    }

    const patterns = [
      `clientes|dashboard-kpis|tenant:${tenantId}|*`,
      `clientes|ranking-kpis|tenant:${tenantId}|*`,
    ];

    try {
      await deleteRedisKeysByPattern(this.redis, patterns);
    } catch (error) {
      this.logger.warn(
        `No se pudo invalidar cache de indicadores de clientes: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private buildPaginationMeta(
    total: number,
    page: number,
    limit: number,
  ): DashboardPaginationMeta {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const normalizedPage = Math.min(page, totalPages);

    return {
      page: normalizedPage,
      limit,
      total,
      totalPages,
      hasNextPage: normalizedPage < totalPages,
      hasPrevPage: normalizedPage > 1,
    };
  }

  private buildOrderScopeSql(accessFilter: PrismaAccessFilter): Prisma.Sql {
    const clauses: Prisma.Sql[] = [Prisma.sql`os."deletedAt" IS NULL`];

    if (accessFilter.tenantId) {
      clauses.push(Prisma.sql`os."tenantId" = ${accessFilter.tenantId}::uuid`);
    }

    if (typeof accessFilter.empresaId === 'string') {
      clauses.push(
        Prisma.sql`os."empresaId" = ${accessFilter.empresaId}::uuid`,
      );
    } else if (
      accessFilter.empresaId &&
      'in' in accessFilter.empresaId &&
      accessFilter.empresaId.in.length > 0
    ) {
      clauses.push(
        Prisma.sql`os."empresaId" IN (${Prisma.join(
          accessFilter.empresaId.in.map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    if ((accessFilter.zonaIds || []).length > 0) {
      clauses.push(
        Prisma.sql`os."zonaId" IN (${Prisma.join(
          (accessFilter.zonaIds || []).map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    if ((accessFilter.municipalityIds || []).length > 0) {
      clauses.push(
        Prisma.sql`dir."municipioId" IN (${Prisma.join(
          (accessFilter.municipalityIds || []).map(
            (id) => Prisma.sql`${id}::uuid`,
          ),
        )})`,
      );
    }

    if ((accessFilter.departmentIds || []).length > 0) {
      clauses.push(
        Prisma.sql`dir."departmentId" IN (${Prisma.join(
          (accessFilter.departmentIds || []).map(
            (id) => Prisma.sql`${id}::uuid`,
          ),
        )})`,
      );
    }

    return Prisma.join(clauses, ' AND ');
  }

  private async getHybridClienteIds(
    accessFilter: PrismaAccessFilter,
    query: NormalizedDashboardQuery,
  ): Promise<string[] | null> {
    const requestedFilters: Array<'sinServicios' | 'pendingPayments'> = [];

    if (query.onlySinServicios) {
      requestedFilters.push('sinServicios');
    }

    if (query.onlyWithPendingPayments) {
      requestedFilters.push('pendingPayments');
    }

    if (requestedFilters.length === 0) {
      return null;
    }

    const clauses: Prisma.Sql[] = [Prisma.sql`c."deletedAt" IS NULL`];

    if (accessFilter.tenantId) {
      clauses.push(Prisma.sql`c."tenantId" = ${accessFilter.tenantId}::uuid`);
    }

    if (typeof accessFilter.empresaId === 'string') {
      clauses.push(Prisma.sql`c."empresaId" = ${accessFilter.empresaId}::uuid`);
    } else if (
      accessFilter.empresaId &&
      'in' in accessFilter.empresaId &&
      accessFilter.empresaId.in.length > 0
    ) {
      clauses.push(
        Prisma.sql`c."empresaId" IN (${Prisma.join(
          accessFilter.empresaId.in.map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    const orderScopeSql = this.buildOrderScopeSql(accessFilter);

    if (query.onlySinServicios) {
      clauses.push(Prisma.sql`
        NOT EXISTS (
          SELECT 1
          FROM "ordenes_servicio" os
          LEFT JOIN "direcciones" dir ON dir."id" = os."direccionId"
          WHERE os."clienteId" = c."id"
            AND ${orderScopeSql}
        )
      `);
    }

    if (query.onlyWithPendingPayments) {
      clauses.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM "ordenes_servicio" os
          LEFT JOIN "direcciones" dir ON dir."id" = os."direccionId"
          WHERE os."clienteId" = c."id"
            AND ${orderScopeSql}
            AND os."estadoPago" NOT IN ('PAGADO', 'CORTESIA')
            AND COALESCE(os."valorPagado", 0) < (
              COALESCE(os."valorCotizado", 0) + COALESCE(os."valorRepuestos", 0)
            )
        )
      `);
    }

    const rows = await this.prisma.$queryRaw<ClienteIdRow[]>(Prisma.sql`
      SELECT c."id"
      FROM "clientes" c
      WHERE ${Prisma.join(clauses, ' AND ')}
    `);

    return rows.map((row) => row.id);
  }

  private buildSegmentedFromClients(clients: ClienteWithRelations[]) {
    // ... rest of private method unchanged ...
    const tickets = clients
      .map((c) => Number(c.ticketPromedio))
      .filter((t) => !isNaN(t) && t > 0)
      .sort((a, b) => a - b);

    let median = 0;
    if (tickets.length > 0) {
      const mid = Math.floor(tickets.length / 2);
      median =
        tickets.length % 2 !== 0
          ? tickets[mid]
          : (tickets[mid - 1] + (tickets[mid] ?? 0)) / 2;
    }

    const now = startOfBogotaDayUtc(new Date());
    const inactivityThresholdDate = new Date();
    inactivityThresholdDate.setDate(now.getDate() - 120);

    const segmented = {
      riesgoFuga: [] as ClienteWithRelations[],
      upsellPotencial: [] as ClienteWithRelations[],
      dormidos: [] as ClienteWithRelations[],
      operacionEstable: [] as ClienteWithRelations[],
    };

    clients.forEach((client) => {
      const riesgoNombre = String(client.nivelRiesgo || '').toUpperCase();
      const isRiesgoFuga =
        riesgoNombre.includes('ALTO') ||
        riesgoNombre.includes('CRITICO') ||
        riesgoNombre.includes('CRÍTICO') ||
        (client.proximaVisita && new Date(client.proximaVisita) < now);

      if (isRiesgoFuga) {
        segmented.riesgoFuga.push(client);
        return;
      }

      const isUpsell =
        (client.clasificacion === ClasificacionCliente.ORO ||
          client.clasificacion === ClasificacionCliente.PLATA) &&
        Number(client.ticketPromedio || 0) > median;

      if (isUpsell) {
        segmented.upsellPotencial.push(client);
        return;
      }

      const lastVisit = client.ultimaVisita
        ? new Date(client.ultimaVisita)
        : new Date(client.createdAt);
      const isDormido = lastVisit < inactivityThresholdDate;

      if (isDormido) {
        segmented.dormidos.push(client);
        return;
      }

      segmented.operacionEstable.push(client);
    });

    return {
      riesgoFuga: {
        count: segmented.riesgoFuga.length,
        data: segmented.riesgoFuga as Cliente[],
      },
      upsellPotencial: {
        count: segmented.upsellPotencial.length,
        data: segmented.upsellPotencial as Cliente[],
      },
      dormidos: {
        count: segmented.dormidos.length,
        data: segmented.dormidos as Cliente[],
      },
      operacionEstable: {
        count: segmented.operacionEstable.length,
        data: segmented.operacionEstable as Cliente[],
      },
    };
  }

  async findAll(user: JwtPayload, reqEmpresaId?: string): Promise<Cliente[]> {
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const clients = await this.prisma.cliente.findMany({
      where: this.buildClienteWhere(accessFilter, { deletedAt: null }),
      orderBy: { createdAt: 'desc' },
      include: this.buildClienteInclude(accessFilter),
    });

    return clients.map((client) =>
      this.applyCommercialRisk(client as ClienteWithRelations),
    ) as Cliente[];
  }

  async search(
    user: JwtPayload,
    query?: QueryClientesSearchDto,
    reqEmpresaId?: string,
  ): Promise<ClienteSearchResult[]> {
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const q = (query?.q || '').trim();
    const limit = Math.min(25, Math.max(1, Number(query?.limit ?? 10) || 10));

    if (!q) {
      return this.prisma.cliente.findMany({
        where: this.buildClienteWhere(accessFilter, { deletedAt: null }),
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: clienteSearchSelect,
      });
    }

    const searchTokens = q
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    const searchClauses: Prisma.ClienteWhereInput[] = [
      { telefono: { contains: q, mode: 'insensitive' } },
      { telefono2: { contains: q, mode: 'insensitive' } },
      { numeroDocumento: { contains: q, mode: 'insensitive' } },
      { nombre: { contains: q, mode: 'insensitive' } },
      { apellido: { contains: q, mode: 'insensitive' } },
      { razonSocial: { contains: q, mode: 'insensitive' } },
      { nit: { contains: q, mode: 'insensitive' } },
    ];

    if (searchTokens.length > 1) {
      searchClauses.push({
        AND: searchTokens.map((token) => ({
          OR: [
            { nombre: { contains: token, mode: 'insensitive' } },
            { apellido: { contains: token, mode: 'insensitive' } },
            { razonSocial: { contains: token, mode: 'insensitive' } },
            { nit: { contains: token, mode: 'insensitive' } },
            { numeroDocumento: { contains: token, mode: 'insensitive' } },
            { telefono: { contains: token, mode: 'insensitive' } },
            { telefono2: { contains: token, mode: 'insensitive' } },
          ],
        })),
      });
    }

    return this.prisma.cliente.findMany({
      where: this.buildClienteWhere(accessFilter, {
        deletedAt: null,
        OR: searchClauses,
      }),
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: clienteSearchSelect,
    });
  }

  async getSegmented(user: JwtPayload, reqEmpresaId?: string) {
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const empresaWhere = this.buildEmpresaWhere(accessFilter.empresaId);
    const clienteDireccionesInclude =
      this.buildClienteDireccionesInclude(accessFilter);
    const direccionGeoWhere = this.buildDireccionGeoWhere(accessFilter);

    const clients = await this.prisma.cliente.findMany({
      where: this.buildClienteWhere(accessFilter, { deletedAt: null }),
      include: {
        direcciones: clienteDireccionesInclude,
        vehiculos: true,
        tipoInteres: true,
        configuracionesOperativas: {
          where: {
            ...(empresaWhere ? { empresaId: empresaWhere } : {}),
          },
        },
        ordenesServicio: {
          where: {
            ...(empresaWhere ? { empresaId: empresaWhere } : {}),
            ...(direccionGeoWhere
              ? {
                  direccion: {
                    is: direccionGeoWhere,
                  },
                }
              : {}),
            estadoPago: { not: 'PAGADO' },
          },
          select: {
            id: true,
            estadoPago: true,
            valorCotizado: true,
            valorPagado: true,
            valorRepuestos: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.buildSegmentedFromClients(clients as ClienteWithRelations[]);
  }

  async getDashboardData(
    user: JwtPayload,
    reqEmpresaId?: string,
    rawQuery?: QueryClientesDashboardDto,
  ) {
    const query = this.normalizeDashboardQuery(rawQuery);
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const include = this.buildClienteInclude(accessFilter);
    const hybridIds = await this.getHybridClienteIds(accessFilter, query);
    const extraWhere: Prisma.ClienteWhereInput =
      hybridIds === null
        ? {}
        : hybridIds.length > 0
          ? { id: { in: hybridIds } }
          : { id: { in: ['00000000-0000-0000-0000-000000000000'] } };

    const where = this.buildDashboardWhere(accessFilter, query, extraWhere);

    if (this.requiresInMemoryDashboardProcessing(query)) {
      const summaryClients = (await this.prisma.cliente.findMany({
        where: this.buildClienteWhere(accessFilter, { deletedAt: null }),
        select: {
          id: true,
          tipoCliente: true,
          clasificacion: true,
          nivelRiesgo: true,
          score: true,
          ticketPromedio: true,
          frecuenciaServicio: true,
          proximaVisita: true,
          ultimaVisita: true,
          createdAt: true,
        },
      })) as ClienteWithRelations[];
      const segmentIdSets = this.buildSegmentIdSets(
        this.buildSegmentedFromClients(summaryClients),
      );

      const rawClients = (await this.prisma.cliente.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      })) as ClienteWithRelations[];

      const clients = this.attachDashboardSegments(
        rawClients.map((client) => this.applyCommercialRisk(client)),
        segmentIdSets,
      );
      const segmentFiltered = this.filterClientsBySegment(
        clients,
        query.segment,
      );
      const finalFiltered = this.sortClientsInMemory(
        this.filterClientsInMemory(segmentFiltered, query),
        query,
      );

      const pagination = this.buildPaginationMeta(
        finalFiltered.length,
        query.page,
        query.limit,
      );
      const start = (pagination.page - 1) * pagination.limit;
      const end = start + pagination.limit;

      return {
        clientes: finalFiltered.slice(start, end),
        segmentacion: null,
        overview: null,
        pagination,
      };
    }

    const total = await this.prisma.cliente.count({ where });
    const pagination = this.buildPaginationMeta(total, query.page, query.limit);
    const rawClients = (await this.prisma.cliente.findMany({
      where,
      include,
      orderBy: this.buildDashboardOrderBy(query),
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    })) as ClienteWithRelations[];

    const clientes = rawClients.map((client) =>
      this.applyCommercialRisk(client),
    );

    return {
      clientes,
      segmentacion: null,
      overview: null,
      pagination,
    };
  }

  async getDashboardKpis(
    user: JwtPayload,
    reqEmpresaId?: string,
    options?: { refresh?: boolean },
  ): Promise<DashboardKpisResponse> {
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const cacheKey = this.buildDashboardKpisCacheKey(accessFilter);
    const shouldRefresh = options?.refresh === true;

    if (!shouldRefresh) {
      const cached = await this.getDashboardKpisFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          meta: {
            ...cached.meta,
            cached: true,
          },
        };
      }
    }

    const summaryClients = (await this.prisma.cliente.findMany({
      where: this.buildClienteWhere(accessFilter, { deletedAt: null }),
      select: {
        id: true,
        tipoCliente: true,
        clasificacion: true,
        nivelRiesgo: true,
        score: true,
        ticketPromedio: true,
        frecuenciaServicio: true,
        proximaVisita: true,
        ultimaVisita: true,
        createdAt: true,
      },
    })) as ClienteWithRelations[];

    const payload: DashboardKpisResponse = {
      overview: this.buildDashboardOverview(summaryClients),
      segmentacion: this.buildDashboardSegmentacion(summaryClients),
      meta: {
        cached: false,
        generatedAt: new Date().toISOString(),
        cacheTtlSeconds: this.dashboardKpisCacheTtlSeconds,
      },
    };

    await this.setDashboardKpisCache(cacheKey, payload);

    return payload;
  }

  private resolveClienteDisplayName(
    client: Pick<
      Cliente,
      'tipoCliente' | 'razonSocial' | 'nombre' | 'apellido' | 'telefono'
    >,
  ): string {
    if (client.tipoCliente === TipoCliente.EMPRESA && client.razonSocial) {
      return client.razonSocial;
    }

    const fullName = [client.nombre, client.apellido]
      .map((value) => value?.trim())
      .filter(Boolean)
      .join(' ');

    return fullName || client.razonSocial || client.telefono;
  }

  private getRankingSortValue(
    row: ClienteRankingRow,
    sort: ClientesRankingSort,
  ): string | number {
    switch (sort) {
      case 'cliente':
        return row.cliente;
      case 'totalPagado':
        return row.totalPagado;
      case 'ticketPromedio':
        return row.ticketPromedio;
      case 'liquidados':
        return row.liquidados;
      case 'cancelacion':
        return row.porcentajeCancelacion;
      case 'noTomados':
        return row.porcentajeNoToma;
      case 'ranking':
      default:
        return row.scoreComercial;
    }
  }

  private buildSuggestedClassification(
    row: Omit<ClienteRankingRow, 'rank' | 'clasificacionSugerida'>,
    paidPercentile: number | null,
  ): ClasificacionCliente {
    if (row.totalServicios === 0) {
      return ClasificacionCliente.BRONCE;
    }

    if (row.porcentajeCancelacion >= 35 || row.porcentajeNoToma >= 30) {
      return ClasificacionCliente.RIESGO;
    }

    if (
      paidPercentile !== null &&
      paidPercentile <= 0.15 &&
      row.liquidados >= 3
    ) {
      return ClasificacionCliente.ORO;
    }

    if (
      paidPercentile !== null &&
      paidPercentile <= 0.45 &&
      row.liquidados >= 2
    ) {
      return ClasificacionCliente.PLATA;
    }

    return ClasificacionCliente.BRONCE;
  }

  private buildCommercialScore(input: {
    totalPagado: number;
    liquidados: number;
    totalServicios: number;
    porcentajeCancelacion: number;
    porcentajeNoToma: number;
  }): number {
    const paymentWeight = Math.log10(input.totalPagado + 1) * 18;
    const continuityWeight = input.liquidados * 6;
    const completionRate =
      input.totalServicios > 0 ? input.liquidados / input.totalServicios : 0;
    const completionWeight = completionRate * 30;
    const cancellationPenalty = input.porcentajeCancelacion * 0.8;
    const noTakePenalty = input.porcentajeNoToma;

    return Math.max(
      0,
      Math.round(
        paymentWeight +
          continuityWeight +
          completionWeight -
          cancellationPenalty -
          noTakePenalty,
      ),
    );
  }

  async getRanking(
    user: JwtPayload,
    reqEmpresaId?: string,
    rawQuery?: QueryClientesRankingDto,
  ): Promise<ClientesRankingResponse> {
    const query = this.normalizeRankingQuery(rawQuery);
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const total = await this.prisma.cliente.count({
      where: this.buildRankingClienteWhere(accessFilter, query),
    });
    const pagination = this.buildPaginationMeta(total, query.page, query.limit);

    if (total === 0) {
      return {
        items: [],
        pagination,
      };
    }

    const baseSql = this.buildRankingBaseSql(accessFilter, query);
    const orderBy = this.buildRankingSqlOrderBy(query);
    const startRank = (pagination.page - 1) * pagination.limit;
    const endRank = pagination.page * pagination.limit;
    const rows = await this.prisma.$queryRaw<ClienteRankingSqlRow[]>(Prisma.sql`
      ${baseSql},
      ranked AS (
        SELECT
          ROW_NUMBER() OVER (ORDER BY ${orderBy})::int AS "rank",
          *
        FROM scored
      )
      SELECT
        "rank",
        "clienteId",
        "cliente",
        "tipoCliente",
        "telefono",
        "empresaId",
        "empresaNombre",
        "clasificacionActual",
        "clasificacionSugerida",
        "scoreComercial",
        "totalPagado",
        "totalCotizado",
        "ticketPromedio",
        "totalServicios",
        "liquidados",
        "cancelados",
        "noTomados",
        "reprogramados",
        "porcentajeCancelacion",
        "porcentajeNoToma",
        "ultimaVisita"
      FROM ranked
      WHERE "rank" > ${startRank}
        AND "rank" <= ${endRank}
      ORDER BY "rank" ASC
    `);

    return {
      items: rows.map((row) => this.mapRankingSqlRow(row)),
      pagination,
    };
  }

  async applyRankingClassifications(
    user: JwtPayload,
    reqEmpresaId?: string,
    rawQuery?: Pick<QueryClientesRankingDto, 'search' | 'from' | 'to'>,
  ): Promise<ClientesRankingApplyResponse> {
    const allowedRoles: Role[] = [Role.SU_ADMIN, Role.ADMIN, Role.COORDINADOR];

    if (!user.isGlobalSuAdmin && !allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        'No tienes permisos para aplicar rangos de clientes.',
      );
    }

    const query = this.normalizeRankingQuery({
      search: rawQuery?.search,
      from: rawQuery?.from,
      to: rawQuery?.to,
      sort: 'ranking',
      dir: 'desc',
      page: 1,
      limit: 100,
    });
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const tenantId = accessFilter.tenantId || user.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('No se pudo resolver el tenant actual.');
    }

    const baseSql = this.buildRankingBaseSql(accessFilter, query);
    const riskClients = await this.prisma.$queryRaw<
      ClienteRetencionRiskSqlRow[]
    >(Prisma.sql`
        ${baseSql}
        SELECT
          "clienteId",
          "cliente",
          "telefono",
          "empresaId",
          "empresaNombre",
          "scoreComercial",
          "totalServicios",
          "porcentajeCancelacion",
          "porcentajeNoToma"
        FROM scored
        WHERE "clasificacionActual"::text IS DISTINCT FROM "clasificacionSugerida"
          AND "clasificacionSugerida" = 'RIESGO'
      `);

    const [summary] = await this.prisma.$queryRaw<ClientesRankingApplySqlRow[]>(
      Prisma.sql`
        ${baseSql},
        changes AS (
          SELECT
            "clienteId",
            "clasificacionSugerida"
          FROM scored
          WHERE "clasificacionActual"::text IS DISTINCT FROM "clasificacionSugerida"
        ),
        updated AS (
          UPDATE "clientes" c
          SET "clasificacion" = changes."clasificacionSugerida"::"ClasificacionCliente"
          FROM changes
          WHERE c."id" = changes."clienteId"
            AND c."tenantId" = ${tenantId}::uuid
          RETURNING c."id"
        )
        SELECT
          (SELECT COUNT(*) FROM scored)::int AS "totalEvaluados",
          (SELECT COUNT(*) FROM updated)::int AS "actualizados",
          (SELECT COUNT(*) FROM scored WHERE "clasificacionSugerida" = 'ORO')::int AS "oro",
          (SELECT COUNT(*) FROM scored WHERE "clasificacionSugerida" = 'PLATA')::int AS "plata",
          (SELECT COUNT(*) FROM scored WHERE "clasificacionSugerida" = 'BRONCE')::int AS "bronce",
          (SELECT COUNT(*) FROM scored WHERE "clasificacionSugerida" = 'RIESGO')::int AS "riesgo"
      `,
    );

    const actualizados = Number(summary?.actualizados || 0);
    const retentionSummary =
      actualizados > 0
        ? await this.createRetentionTasksForRiskClients(
            riskClients,
            user,
            tenantId,
          )
        : {
            tareasRetencionCreadas: 0,
            tareasRetencionOmitidas: 0,
            sinResponsable: 0,
          };

    if (actualizados > 0) {
      await this.invalidateDashboardKpisCache(tenantId);
    }

    return {
      totalEvaluados: Number(summary?.totalEvaluados || 0),
      actualizados,
      ...retentionSummary,
      clasificacion: {
        [ClasificacionCliente.ORO]: Number(summary?.oro || 0),
        [ClasificacionCliente.PLATA]: Number(summary?.plata || 0),
        [ClasificacionCliente.BRONCE]: Number(summary?.bronce || 0),
        [ClasificacionCliente.RIESGO]: Number(summary?.riesgo || 0),
      },
    };
  }

  private async createRetentionTasksForRiskClients(
    riskClients: ClienteRetencionRiskSqlRow[],
    user: JwtPayload,
    tenantId: string,
  ): Promise<RetentionTaskSummary> {
    const summary: RetentionTaskSummary = {
      tareasRetencionCreadas: 0,
      tareasRetencionOmitidas: 0,
      sinResponsable: 0,
    };

    for (const client of riskClients) {
      try {
        const existingSuggestion =
          await this.prisma.sugerenciaSeguimiento.findFirst({
            where: {
              tenantId,
              clienteId: client.clienteId,
              tipo: this.retentionCallSuggestionType,
              estado: {
                in: [EstadoSugerencia.PENDIENTE, EstadoSugerencia.ACEPTADA],
              },
            },
            select: { id: true },
          });

        if (existingSuggestion) {
          summary.tareasRetencionOmitidas += 1;
          continue;
        }

        const responsableMembershipId = client.empresaId
          ? await this.resolveRetentionResponsibleFromOrigin(
              tenantId,
              client.clienteId,
              client.empresaId,
            )
          : null;
        const assignedByMembershipId = await this.resolveActiveTenantMembership(
          tenantId,
          user.membershipId,
        );

        const suggestionData = {
          tenantId,
          empresaId: client.empresaId ?? undefined,
          clienteId: client.clienteId,
          tipo: this.retentionCallSuggestionType,
          prioridad: PrioridadSugerencia.CRITICA,
          titulo: 'Contactar cliente prioritario',
          descripcion: this.buildRetentionDescription(client),
          metadata: {
            fuente: 'clasificacion_clientes',
            accion: 'llamada_cortesia',
            totalServicios: Number(client.totalServicios || 0),
            porcentajeCancelacion: Number(client.porcentajeCancelacion || 0),
            porcentajeNoToma: Number(client.porcentajeNoToma || 0),
          },
        };

        if (!client.empresaId || !assignedByMembershipId) {
          await this.prisma.sugerenciaSeguimiento.create({
            data: suggestionData,
          });
          summary.sinResponsable += 1;
          summary.tareasRetencionOmitidas += 1;
          continue;
        }

        await this.prisma.$transaction([
          this.prisma.sugerenciaSeguimiento.create({
            data: {
              ...suggestionData,
              metadata: {
                ...suggestionData.metadata,
                responsableOrigen: responsableMembershipId
                  ? 'creador_cliente_o_servicio'
                  : 'no_establecido',
              },
            },
          }),
          this.prisma.equipoTrabajoTarea.create({
            data: {
              tenantId,
              empresaId: client.empresaId,
              titulo: this.retentionCallTaskTitle,
              descripcion: this.buildRetentionDescription(client),
              observaciones: responsableMembershipId
                ? 'Responsable tomado del historial operativo del cliente.'
                : 'Sin responsable establecido. Cualquier integrante habilitado puede tomar esta tarea.',
              fechaLimite: this.getRetentionTaskDueDate(),
              responsableMembershipId,
              asignadaPorMembershipId: assignedByMembershipId,
            },
          }),
        ]);

        summary.tareasRetencionCreadas += 1;
        if (!responsableMembershipId) {
          summary.sinResponsable += 1;
        }
      } catch (error) {
        summary.tareasRetencionOmitidas += 1;
        this.logger.warn(
          `No se pudo preparar seguimiento de retención para cliente ${client.clienteId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return summary;
  }

  private async resolveRetentionResponsibleFromOrigin(
    tenantId: string,
    clienteId: string,
    empresaId: string,
  ): Promise<string | null> {
    const lastCreatedOrder = await this.prisma.ordenServicio.findFirst({
      where: {
        tenantId,
        clienteId,
        empresaId,
        deletedAt: null,
        creadoPorId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { creadoPorId: true },
    });

    if (
      lastCreatedOrder?.creadoPorId &&
      (await this.isActiveMembershipInEmpresa(
        lastCreatedOrder.creadoPorId,
        tenantId,
        empresaId,
      ))
    ) {
      return lastCreatedOrder.creadoPorId;
    }

    const client = await this.prisma.cliente.findFirst({
      where: {
        id: clienteId,
        tenantId,
        empresaId,
        deletedAt: null,
        creadoPorId: { not: null },
      },
      select: { creadoPorId: true },
    });

    if (
      client?.creadoPorId &&
      (await this.isActiveMembershipInEmpresa(
        client.creadoPorId,
        tenantId,
        empresaId,
      ))
    ) {
      return client.creadoPorId;
    }

    return null;
  }

  private async isActiveMembershipInEmpresa(
    membershipId: string,
    tenantId: string,
    empresaId: string,
  ): Promise<boolean> {
    const membership = await this.prisma.empresaMembership.findFirst({
      where: {
        tenantId,
        empresaId,
        membershipId,
        activo: true,
        deletedAt: null,
        membership: {
          tenantId,
          status: 'ACTIVE',
          activo: true,
        },
      },
      select: { id: true },
    });

    return Boolean(membership);
  }

  private async resolveActiveTenantMembership(
    tenantId: string,
    membershipId?: string,
  ): Promise<string | null> {
    if (!membershipId) {
      return null;
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: membershipId,
        tenantId,
        status: 'ACTIVE',
        activo: true,
      },
      select: { id: true },
    });

    return membership?.id || null;
  }

  private buildRetentionDescription(
    client: ClienteRetencionRiskSqlRow,
  ): string {
    const clientName = this.formatRetentionClientName(client);
    const contactHint = client.telefono ? ` Teléfono: ${client.telefono}.` : '';
    const companyHint = client.empresaNombre
      ? ` Empresa: ${client.empresaNombre}.`
      : '';

    return `El cliente ${clientName} requiere seguimiento prioritario por señales recientes en su relación con la operación.${companyHint}${contactHint} Realizá una llamada de cortesía y registrá el resultado.`;
  }

  private formatRetentionClientName(
    client: ClienteRetencionRiskSqlRow,
  ): string {
    const normalizedName = (client.cliente || '').trim();

    if (
      normalizedName &&
      !this.isPlaceholderRetentionClientName(normalizedName)
    ) {
      return normalizedName;
    }

    return client.telefono
      ? `registrado con teléfono ${client.telefono}`
      : 'registrado';
  }

  private isPlaceholderRetentionClientName(value: string): boolean {
    const normalized = value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();

    return [
      'NO CONCRETADO',
      'NO CONCRETADO NO CONCRETADO',
      'SIN CONCRETAR',
      'SIN NOMBRE',
      'N/A',
    ].includes(normalized);
  }

  private getRetentionTaskDueDate(): Date {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 1);
    return dueDate;
  }

  async getRankingKpis(
    user: JwtPayload,
    reqEmpresaId?: string,
    rawQuery?: Pick<QueryClientesRankingKpisDto, 'search' | 'from' | 'to'> & {
      refresh?: boolean;
    },
  ): Promise<ClientesRankingKpisResponse> {
    const query: NormalizedRankingQuery = {
      page: 1,
      limit: 1,
      search: (rawQuery?.search || '').trim(),
      sort: 'ranking',
      dir: 'desc',
      from: rawQuery?.from || '',
      to: rawQuery?.to || '',
    };
    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    const cacheKey = this.buildRankingKpisCacheKey(accessFilter, query);

    if (rawQuery?.refresh !== true) {
      const cached = await this.getRankingKpisFromCache(cacheKey);
      if (cached) {
        return {
          ...cached,
          meta: {
            ...cached.meta,
            cached: true,
          },
        };
      }
    }

    const baseSql = this.buildRankingBaseSql(accessFilter, query);
    const [summary] = await this.prisma.$queryRaw<ClienteRankingKpisSqlRow[]>(
      Prisma.sql`
        ${baseSql}
        SELECT
          COUNT(*)::int AS "totalClientes",
          COALESCE(SUM("totalPagado"), 0)::double precision AS "totalPagado",
          COALESCE(SUM("totalServicios"), 0)::int AS "totalServicios",
          COALESCE(SUM("liquidados"), 0)::int AS "totalLiquidados",
          COALESCE(SUM("cancelados"), 0)::int AS "totalCancelados",
          COALESCE(SUM("noTomados"), 0)::int AS "totalNoTomados",
          COUNT(*) FILTER (WHERE "clasificacionSugerida" = 'RIESGO')::int AS "clientesEnRiesgo",
          COUNT(*) FILTER (WHERE "clasificacionSugerida" = 'ORO')::int AS "oro",
          COUNT(*) FILTER (WHERE "clasificacionSugerida" = 'PLATA')::int AS "plata",
          COUNT(*) FILTER (WHERE "clasificacionSugerida" = 'BRONCE')::int AS "bronce",
          COUNT(*) FILTER (WHERE "clasificacionSugerida" = 'RIESGO')::int AS "riesgo"
        FROM scored
      `,
    );

    const totalPagado = Number(summary?.totalPagado || 0);
    const totalServicios = Number(summary?.totalServicios || 0);
    const totalLiquidados = Number(summary?.totalLiquidados || 0);
    const totalCancelados = Number(summary?.totalCancelados || 0);
    const totalNoTomados = Number(summary?.totalNoTomados || 0);

    const payload: ClientesRankingKpisResponse = {
      overview: {
        totalClientes: Number(summary?.totalClientes || 0),
        totalPagado,
        totalServicios,
        promedioTicket:
          totalLiquidados > 0 ? Math.round(totalPagado / totalLiquidados) : 0,
        porcentajeCancelacion:
          totalServicios > 0
            ? Math.round((totalCancelados / totalServicios) * 100)
            : 0,
        porcentajeNoToma:
          totalServicios > 0
            ? Math.round((totalNoTomados / totalServicios) * 100)
            : 0,
        clientesEnRiesgo: Number(summary?.clientesEnRiesgo || 0),
      },
      clasificacion: {
        [ClasificacionCliente.ORO]: Number(summary?.oro || 0),
        [ClasificacionCliente.PLATA]: Number(summary?.plata || 0),
        [ClasificacionCliente.BRONCE]: Number(summary?.bronce || 0),
        [ClasificacionCliente.RIESGO]: Number(summary?.riesgo || 0),
      },
      meta: {
        cached: false,
        generatedAt: new Date().toISOString(),
        cacheTtlSeconds: this.dashboardKpisCacheTtlSeconds,
      },
    };

    await this.setRankingKpisCache(cacheKey, payload);

    return payload;
  }

  async create(
    user: JwtPayload,
    dto: CreateClienteDto,
    reqEmpresaId?: string,
  ): Promise<Cliente> {
    const {
      direcciones,
      vehiculos,
      metrajeTotal,
      tipoInteresId,
      empresaId: _empresaId,
      ...restDto
    } = dto as CreateClienteDto & { empresaId?: string };

    void _empresaId;

    const accessFilter = getPrismaAccessFilter(user, reqEmpresaId);
    await this.assertClienteDireccionesWithinGeoScope(
      accessFilter,
      direcciones,
    );

    // Resolve the actual empresaId for creation.
    // If multiple are allowed, we use the first one or the requested one.
    let empresaId: string | undefined;
    const accessEmpresaId = accessFilter.empresaId;
    if (typeof accessEmpresaId === 'string') {
      empresaId = accessEmpresaId;
    } else if (accessEmpresaId && 'in' in accessEmpresaId) {
      empresaId = accessEmpresaId.in[0];
    }

    if (!empresaId) {
      throw new BadRequestException(
        'Seleccioná una empresa para crear el cliente.',
      );
    }

    await this.assertClienteEmpresaWithinTenant(user, empresaId);

    const normalizedTelefono = this.normalizeClientePhone(restDto.telefono);
    const normalizedTelefono2 = this.normalizeClienteOptionalValue(
      restDto.telefono2,
    );
    const normalizedNumeroDocumento = this.normalizeClienteOptionalValue(
      restDto.numeroDocumento,
    );
    const normalizedNit = this.normalizeClienteOptionalValue(restDto.nit);
    const normalizedTipoDocumento = this.normalizeClienteOptionalValue(
      restDto.tipoDocumento,
    );
    const normalizedCorreo = this.normalizeClienteOptionalValue(restDto.correo);
    const normalizedRestDto = {
      ...restDto,
      telefono: normalizedTelefono,
      telefono2: normalizedTelefono2 ?? undefined,
      numeroDocumento: normalizedNumeroDocumento ?? undefined,
      nit: normalizedNit ?? undefined,
      tipoDocumento: normalizedTipoDocumento ?? undefined,
      correo: normalizedCorreo ?? undefined,
    };

    const toDecimal = (val: unknown, decimals: number = 2) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num.toFixed(decimals);
    };

    const orConditions: Prisma.ClienteWhereInput[] = [];
    if (
      normalizedNumeroDocumento &&
      normalizedNumeroDocumento !== 'No Concretado'
    ) {
      orConditions.push({ numeroDocumento: normalizedNumeroDocumento });
    }
    if (normalizedNit && normalizedNit !== 'No Concretado') {
      orConditions.push({ nit: normalizedNit });
    }
    if (normalizedTelefono && normalizedTelefono !== 'No Concretado') {
      orConditions.push({ telefono: normalizedTelefono });
    }

    if (orConditions.length > 0) {
      const existingClient = await this.prisma.cliente.findFirst({
        where: {
          tenantId: user.tenantId,
          empresaId,
          OR: orConditions,
          deletedAt: null,
        },
      });

      if (existingClient) {
        throw new ConflictException(
          'Ya existe un cliente con esos datos en esta empresa.',
        );
      }
    }

    const data = {
      ...normalizedRestDto,
      tenant: { connect: { id: user.tenantId } },
      empresa: { connect: { id: empresaId } },
      segmento: normalizedRestDto.segmento || SegmentoCliente.OTRO,
      nivelRiesgo: normalizedRestDto.nivelRiesgo || NivelRiesgo.MEDIO,
      metrajeTotal: toDecimal(metrajeTotal, 2)
        ? new Prisma.Decimal(toDecimal(metrajeTotal, 2)!)
        : null,
      creadoPor: user.membershipId
        ? { connect: { id: user.membershipId } }
        : undefined,
      ...(tipoInteresId && {
        tipoInteres: { connect: { id: tipoInteresId } },
      }),

      direcciones: {
        create: direcciones?.map((d) => ({
          ...d,
          tenantId: user.tenantId,
          ...(empresaId && { empresaId }),
          latitud: d.latitud ? Number(d.latitud) : null,
          longitud: d.longitud ? Number(d.longitud) : null,
          precisionGPS: toDecimal(d.precisionGPS, 2),
        })),
      },

      vehiculos: {
        create: vehiculos?.map((v) => ({
          ...v,
          tenantId: user.tenantId,
          ...(empresaId && { empresaId }),
        })),
      },
    } as unknown as Prisma.ClienteCreateInput;

    try {
      const createdCliente = (await this.prisma.cliente.create({
        data,
        include: {
          direcciones: true,
          vehiculos: true,
          tipoInteres: true,
        },
      })) as Cliente;

      await this.invalidateDashboardKpisCache(user.tenantId);

      return createdCliente;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ya existe un cliente con esos datos en esta empresa.',
        );
      }

      console.error(
        'Error creating cliente. Data:',
        JSON.stringify(data, null, 2),
      );
      console.error('Prisma Error:', error);
      throw error;
    }
  }

  async findOne(id: string, user: JwtPayload): Promise<Cliente | null> {
    const accessFilter = getPrismaAccessFilter(user);
    const clienteDireccionesInclude =
      this.buildClienteDireccionesInclude(accessFilter);

    return this.prisma.cliente.findFirst({
      where: this.buildClienteWhere(accessFilter, { id, deletedAt: null }),
      include: {
        direcciones: clienteDireccionesInclude,
        vehiculos: true,
        tipoInteres: true,
        empresa: true,
        contratosCliente: {
          where: {
            ...(accessFilter.tenantId
              ? { tenantId: accessFilter.tenantId }
              : {}),
            ...(accessFilter.empresaId
              ? { empresaId: accessFilter.empresaId }
              : {}),
            estado: EstadoContratoCliente.ACTIVO,
          },
          orderBy: { fechaInicio: 'desc' },
        },
      },
    });
  }

  async update(
    id: string,
    user: JwtPayload,
    dto: Partial<CreateClienteDto>,
  ): Promise<Cliente> {
    const accessFilter = getPrismaAccessFilter(user);

    // Verify access first
    const existing = await this.prisma.cliente.findFirst({
      where: this.buildClienteWhere(accessFilter, { id }),
    });
    if (!existing) {
      throw new UnauthorizedException(
        'No tienes permisos para editar este cliente',
      );
    }

    const { direcciones, vehiculos, metrajeTotal, ...restDto } = dto;
    await this.assertClienteDireccionesWithinGeoScope(
      accessFilter,
      direcciones,
    );

    const toDecimal = (val: unknown, decimals: number = 2) => {
      if (val === null || val === undefined || val === '') return null;
      const num = Number(val);
      return isNaN(num) ? null : num.toFixed(decimals);
    };

    if (direcciones) {
      await this.prisma.direccion.deleteMany({ where: { clienteId: id } });
    }
    if (vehiculos) {
      await this.prisma.vehiculo.deleteMany({ where: { clienteId: id } });
    }

    const data = {
      ...restDto,
      metrajeTotal: toDecimal(metrajeTotal, 2)
        ? new Prisma.Decimal(toDecimal(metrajeTotal, 2)!)
        : undefined,

      direcciones: direcciones
        ? {
            create: direcciones.map((d) => ({
              ...d,
              tenantId: user.tenantId,
              latitud: d.latitud ? Number(d.latitud) : null,
              longitud: d.longitud ? Number(d.longitud) : null,
              precisionGPS: toDecimal(d.precisionGPS, 2),
            })),
          }
        : undefined,

      vehiculos: vehiculos
        ? {
            create: vehiculos.map((v) => ({
              ...v,
              tenantId: user.tenantId,
            })),
          }
        : undefined,
    } as unknown as Prisma.ClienteUpdateInput;

    const updatedCliente = (await this.prisma.cliente.update({
      where: { id },
      data,
      include: {
        direcciones: true,
        vehiculos: true,
        tipoInteres: true,
      },
    })) as Cliente;

    await this.invalidateDashboardKpisCache(user.tenantId);

    return updatedCliente;
  }

  async remove(id: string, user: JwtPayload): Promise<Cliente> {
    const accessFilter = getPrismaAccessFilter(user);

    // Verify access
    const existing = await this.prisma.cliente.findFirst({
      where: this.buildClienteWhere(accessFilter, { id }),
    });
    if (!existing) {
      throw new UnauthorizedException(
        'No tienes permisos para eliminar este cliente',
      );
    }

    const deletedCliente = await this.prisma.cliente.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.invalidateDashboardKpisCache(user.tenantId);

    return deletedCliente;
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
}
