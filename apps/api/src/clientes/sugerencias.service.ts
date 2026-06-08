import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import IORedis, { RedisOptions } from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { ClientesService } from '../clientes/clientes.service';
import {
  EstadoSugerencia,
  PrioridadSugerencia,
  Prisma,
  Role,
} from '../generated/client/client';
import { startOfBogotaDayUtc } from '../common/utils/timezone.util';
import { deleteRedisKeysByPattern } from '../common/utils/redis-pattern-delete.util';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { QuerySugerenciasDto } from './dto/query-sugerencias.dto';

export interface SugerenciasQuickStats {
  pendientesPorPrioridad: Record<string, number>;
  tasaAceptacion: number;
  tiempoPromedioEjecucionMin: number;
  totalHoy: number;
}

@Injectable()
export class SugerenciasService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SugerenciasService.name);
  private redis: IORedis | null = null;
  private readonly statsCacheTtlSeconds = 60 * 60 * 24;
  private readonly reactivationInactivityDays = 120;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clientesService: ClientesService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    try {
      this.redis = new IORedis(this.getRedisOptions());
      this.redis.on('error', (error) => {
        this.logger.warn(
          `Redis error in sugerencias stats cache: ${error.message}`,
        );
      });
    } catch (error) {
      this.logger.warn(
        `No se pudo inicializar Redis para stats de sugerencias: ${
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

  async findAll(
    tenantId: string,
    empresaId?: string,
    query?: QuerySugerenciasDto,
  ) {
    const page = Math.max(1, Number(query?.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20) || 20));
    const where = {
      tenantId,
      ...(empresaId && { empresaId }),
    };

    const total = await this.prisma.sugerenciaSeguimiento.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const normalizedPage = Math.min(page, totalPages);

    const data = await this.prisma.sugerenciaSeguimiento.findMany({
      where,
      include: {
        cliente: true,
      },
      orderBy: [{ prioridad: 'desc' }, { creadoAt: 'desc' }],
      skip: (normalizedPage - 1) * limit,
      take: limit,
    });

    return {
      sugerencias: data,
      pagination: {
        page: normalizedPage,
        limit,
        total,
        totalPages,
        hasNextPage: normalizedPage < totalPages,
        hasPrevPage: normalizedPage > 1,
      },
    };
  }

  async getQuickStats(
    tenantId: string,
    empresaId?: string,
  ): Promise<SugerenciasQuickStats> {
    const cacheKey = this.buildStatsCacheKey(tenantId, empresaId);
    const cached = await this.getStatsFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    const today = startOfBogotaDayUtc(new Date());

    const sugerencias = await this.prisma.sugerenciaSeguimiento.findMany({
      where: {
        tenantId,
        ...(empresaId && { empresaId }),
      },
    });

    const pendientes = sugerencias.filter(
      (s) => s.estado === EstadoSugerencia.PENDIENTE,
    );
    const aceptadas = sugerencias.filter(
      (s) =>
        s.estado === EstadoSugerencia.ACEPTADA ||
        s.estado === EstadoSugerencia.EJECUTADA,
    );

    // Tasa de aceptación
    const totalProcessed = sugerencias.filter(
      (s) => s.estado !== EstadoSugerencia.PENDIENTE,
    ).length;
    const acceptanceRate =
      totalProcessed > 0 ? (aceptadas.length / totalProcessed) * 100 : 0;

    // Tiempo promedio hasta ejecución (en minutos)
    const ejecutadas = sugerencias.filter(
      (s) => s.estado === EstadoSugerencia.EJECUTADA && s.fechaEjecutada,
    );
    const avgTimeToExecution =
      ejecutadas.length > 0
        ? ejecutadas.reduce((acc, s) => {
            if (!s.fechaEjecutada) return acc;
            const diff = s.fechaEjecutada.getTime() - s.creadoAt.getTime();
            return acc + diff / (1000 * 60);
          }, 0) / ejecutadas.length
        : 0;

    const payload: SugerenciasQuickStats = {
      pendientesPorPrioridad: {
        CRITICA: pendientes.filter(
          (s) => s.prioridad === PrioridadSugerencia.CRITICA,
        ).length,
        ALTA: pendientes.filter((s) => s.prioridad === PrioridadSugerencia.ALTA)
          .length,
        MEDIA: pendientes.filter(
          (s) => s.prioridad === PrioridadSugerencia.MEDIA,
        ).length,
        BAJA: pendientes.filter((s) => s.prioridad === PrioridadSugerencia.BAJA)
          .length,
      },
      tasaAceptacion: Number(acceptanceRate.toFixed(2)),
      tiempoPromedioEjecucionMin: Number(avgTimeToExecution.toFixed(2)),
      totalHoy: sugerencias.filter((s) => s.creadoAt >= today).length,
    };

    await this.setStatsCache(cacheKey, payload);

    return payload;
  }

  async updateEstado(id: string, tenantId: string, estado: EstadoSugerencia) {
    const data: Prisma.SugerenciaSeguimientoUpdateInput = { estado };
    if (estado === EstadoSugerencia.EJECUTADA) {
      data.fechaEjecutada = new Date();
    }

    const updated = await this.prisma.sugerenciaSeguimiento.update({
      where: { id, tenantId },
      data,
    });

    await this.invalidateStatsCache(tenantId);

    return updated;
  }

  // Job v1: Generación determinística diaria
  @Cron('0 0 19 * * *', { timeZone: 'America/Bogota' })
  async generateDailySugerencias() {
    this.logger.log('Iniciando generación diaria de sugerencias...');

    // Obtenemos todos los tenants activos
    const tenants = await this.prisma.tenant.findMany({
      where: { isActive: true },
    });

    for (const tenant of tenants) {
      try {
        const systemUser: JwtPayload = {
          sub: 'SYSTEM',
          email: 'system@tenaxis.com',
          role: Role.SU_ADMIN,
          tenantId: tenant.id,
          isGlobalSuAdmin: true,
        };
        const segmented = await this.clientesService.getSegmented(systemUser);

        // 1. Riesgo de Fuga -> Prioridad CRITICA
        for (const client of segmented.riesgoFuga.data) {
          await this.createSugerenciaIfNotExists({
            tenantId: tenant.id,
            empresaId: client.empresaId ?? undefined,
            clienteId: client.id,
            tipo: 'PROGRAMAR_VISITA',
            prioridad: PrioridadSugerencia.CRITICA,
            titulo: 'Programar Visita Urgente',
            descripcion: `El cliente ${client.nombre || client.razonSocial || ''} tiene riesgo alto o visita vencida.`,
          });
        }

        // 2. Dormidos -> Prioridad ALTA
        for (const client of segmented.dormidos.data) {
          await this.createSugerenciaIfNotExists({
            tenantId: tenant.id,
            empresaId: client.empresaId ?? undefined,
            clienteId: client.id,
            tipo: 'REACTIVAR',
            prioridad: PrioridadSugerencia.ALTA,
            titulo: 'Reactivar Cliente',
            descripcion: `Sin actividad en los últimos ${this.reactivationInactivityDays} días. Se recomienda contacto comercial.`,
          });
        }

        // 3. Upsell Potencial -> Prioridad MEDIA
        for (const client of segmented.upsellPotencial.data) {
          if (client.aceptaMarketing) {
            await this.createSugerenciaIfNotExists({
              tenantId: tenant.id,
              empresaId: client.empresaId ?? undefined,
              clienteId: client.id,
              tipo: 'UPSELL',
              prioridad: PrioridadSugerencia.MEDIA,
              titulo: 'Oferta Upsell',
              descripcion: `Ticket promedio superior a la media. Potencial para nuevos servicios.`,
            });
          }
        }

        // 4. Config Incompleta -> Prioridad BAJA
        const incompleteClients = await this.prisma.cliente.findMany({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            OR: [
              { direcciones: { none: {} } },
              { configuracionesOperativas: { none: {} } },
            ],
          },
        });

        for (const client of incompleteClients) {
          await this.createSugerenciaIfNotExists({
            tenantId: tenant.id,
            empresaId: client.empresaId ?? undefined,
            clienteId: client.id,
            tipo: 'COMPLETAR_CONFIG',
            prioridad: PrioridadSugerencia.BAJA,
            titulo: 'Completar Configuración',
            descripcion: `Faltan datos operativos críticos (sedes o protocolos).`,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(
          `Error procesando sugerencias para tenant ${tenant.id}: ${msg}`,
        );
      } finally {
        await this.invalidateStatsCache(tenant.id);
      }
    }

    this.logger.log('Generación diaria finalizada.');
  }

  private async createSugerenciaIfNotExists(data: {
    tenantId: string;
    empresaId?: string;
    clienteId: string;
    tipo: string;
    prioridad: PrioridadSugerencia;
    titulo: string;
    descripcion: string;
  }) {
    // Evitar duplicados pendientes del mismo tipo para el mismo cliente
    const existing = await this.prisma.sugerenciaSeguimiento.findFirst({
      where: {
        clienteId: data.clienteId,
        tipo: data.tipo,
        estado: EstadoSugerencia.PENDIENTE,
      },
    });

    if (!existing) {
      await this.prisma.sugerenciaSeguimiento.create({
        data: {
          ...data,
          metadata: {},
        },
      });
    }
  }

  private buildStatsCacheKey(tenantId: string, empresaId?: string) {
    return `sugerencias|stats|tenant:${tenantId}|empresa:${empresaId || 'all'}`;
  }

  private async getStatsFromCache(
    cacheKey: string,
  ): Promise<SugerenciasQuickStats | null> {
    if (!this.redis) {
      return null;
    }

    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? (JSON.parse(cached) as SugerenciasQuickStats) : null;
    } catch (error) {
      this.logger.warn(
        `No se pudo leer cache de stats de sugerencias (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async setStatsCache(cacheKey: string, payload: unknown) {
    if (!this.redis) {
      return;
    }

    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(payload),
        'EX',
        this.statsCacheTtlSeconds,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo escribir cache de stats de sugerencias (${cacheKey}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async invalidateStatsCache(tenantId?: string) {
    if (!this.redis || !tenantId) {
      return;
    }

    const pattern = `sugerencias|stats|tenant:${tenantId}|*`;

    try {
      await deleteRedisKeysByPattern(this.redis, [pattern]);
    } catch (error) {
      this.logger.warn(
        `No se pudo invalidar cache de stats de sugerencias (${pattern}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
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
}
