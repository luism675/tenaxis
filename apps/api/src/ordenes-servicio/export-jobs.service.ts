import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import IORedis, { RedisOptions } from 'ioredis';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { SupabaseService } from '../supabase/supabase.service';
import { ExportOrdenesServicioDto } from './dto/export-ordenes-servicio.dto';
import {
  ORDENES_EXPORT_BUCKET,
  ORDENES_EXPORT_JOB,
  ORDENES_EXPORT_QUEUE,
} from './export-jobs.constants';
import {
  OrdenesExportJobData,
  OrdenesExportJobResult,
} from './export-jobs.types';
import { OrdenesServicioService } from './ordenes-servicio.service';

@Injectable()
export class OrdenesServicioExportJobsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(OrdenesServicioExportJobsService.name);
  private connection: IORedis | null = null;
  private queue: Queue<OrdenesExportJobData, OrdenesExportJobResult> | null =
    null;
  private worker: Worker<OrdenesExportJobData, OrdenesExportJobResult> | null =
    null;
  private queueEvents: QueueEvents | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly ordenesServicioService: OrdenesServicioService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async onModuleInit() {
    const connection = new IORedis({
      ...this.getRedisOptions(),
      lazyConnect: true,
    });
    const bootstrapErrorHandler = () => undefined;
    connection.on('error', bootstrapErrorHandler);

    try {
      await this.assertRedisAvailable(connection);
    } catch (error) {
      this.logger.warn(
        `Cola de exportaciones deshabilitada: Redis no está disponible (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      connection.disconnect();
      return;
    } finally {
      connection.off('error', bootstrapErrorHandler);
    }

    this.connection = connection;

    this.queue = new Queue<OrdenesExportJobData, OrdenesExportJobResult>(
      ORDENES_EXPORT_QUEUE,
      {
        connection,
        defaultJobOptions: {
          attempts: 3,
          removeOnComplete: {
            age: 60 * 60 * 24,
            count: 200,
          },
          removeOnFail: {
            age: 60 * 60 * 24 * 7,
            count: 200,
          },
        },
      },
    );

    this.queueEvents = new QueueEvents(ORDENES_EXPORT_QUEUE, { connection });
    this.queueEvents.on('error', (error) => {
      this.logger.error(`Queue events error: ${error.message}`, error.stack);
    });

    this.worker = new Worker<OrdenesExportJobData, OrdenesExportJobResult>(
      ORDENES_EXPORT_QUEUE,
      async (job) => this.processExport(job),
      {
        connection,
        concurrency: 1,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.log(`Export job completed: ${job.id}`);
    });

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Export job failed: ${job?.id ?? 'unknown'} - ${error.message}`,
        error.stack,
      );
    });

    this.worker.on('error', (error) => {
      this.logger.error(`Export worker error: ${error.message}`, error.stack);
    });
  }

  private async assertRedisAvailable(connection: IORedis) {
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        connection.connect().then(() => connection.ping()),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error('tiempo de conexión agotado')),
            1_500,
          );
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queueEvents?.close();
    await this.queue?.close();
    if (this.connection) {
      await this.connection.quit();
    }
  }

  async enqueueExport(user: JwtPayload, dto: ExportOrdenesServicioDto) {
    if (!user.tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    if (!this.queue) {
      throw new ServiceUnavailableException(
        'La cola de exportaciones no está disponible',
      );
    }

    const job = await this.queue.add(ORDENES_EXPORT_JOB, {
      requestedBy: {
        userId: user.sub,
        membershipId: user.membershipId,
        tenantId: user.tenantId,
        email: user.email,
      },
      filters: dto,
    });

    return {
      jobId: job.id,
      queue: ORDENES_EXPORT_QUEUE,
      status: 'queued',
    };
  }

  async getExportStatus(user: JwtPayload, jobId: string) {
    if (!user.tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const job = await this.getAuthorizedJob(user, jobId);
    const state = await job.getState();
    const progress = Number(job.progress || 0);
    const result = job.returnvalue as OrdenesExportJobResult | undefined;

    return {
      jobId: job.id,
      status: state,
      progress,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
      startedAt: job.processedOn
        ? new Date(job.processedOn).toISOString()
        : null,
      finishedAt: job.finishedOn
        ? new Date(job.finishedOn).toISOString()
        : null,
      totalRows: result?.totalRows ?? null,
      fileName: result?.fileName ?? null,
      filePath: result?.filePath ?? null,
      downloadUrl: result?.filePath
        ? await this.supabaseService.getSignedUrl(
            result.filePath,
            ORDENES_EXPORT_BUCKET,
            60 * 60,
          )
        : null,
      error:
        state === 'failed'
          ? ((await job.getState()) && job.failedReason) || 'Export failed'
          : null,
    };
  }

  private async getAuthorizedJob(user: JwtPayload, jobId: string) {
    if (!this.queue) {
      throw new ServiceUnavailableException(
        'La cola de exportaciones no está disponible',
      );
    }

    const job = await this.queue.getJob(jobId);

    if (!job) {
      throw new NotFoundException('No se encontró la exportación');
    }

    const data = job.data;
    if (
      data.requestedBy.tenantId !== user.tenantId ||
      data.requestedBy.userId !== user.sub
    ) {
      throw new UnauthorizedException(
        'No tienes acceso a esta exportación solicitada',
      );
    }

    return job;
  }

  private async processExport(job: Job<OrdenesExportJobData>) {
    const { requestedBy, filters } = job.data;
    await job.updateProgress(5);

    const exportPayload = await this.ordenesServicioService.export(
      {
        sub: requestedBy.userId,
        email: requestedBy.email,
        membershipId: requestedBy.membershipId,
        tenantId: requestedBy.tenantId,
      } as JwtPayload,
      filters,
    );

    await job.updateProgress(70);

    const fileName = this.buildFileName(job.id ?? 'export');
    const filePath = `${requestedBy.tenantId}/ordenes-servicio/exports/${fileName}`;
    const csv = this.buildCsv(exportPayload);
    const uploadPath = await this.supabaseService.uploadFile(
      filePath,
      Buffer.from(csv, 'utf-8'),
      'text/csv; charset=utf-8',
      ORDENES_EXPORT_BUCKET,
    );

    if (!uploadPath) {
      throw new Error('No se pudo subir el archivo exportado a Supabase');
    }

    await job.updateProgress(100);

    return {
      filePath: uploadPath,
      fileName,
      totalRows: exportPayload.length,
      completedAt: new Date().toISOString(),
    };
  }

  private buildFileName(jobId: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `ordenes-servicio-${timestamp}-${jobId}.csv`;
  }

  private buildCsv(
    rows: Awaited<ReturnType<OrdenesServicioService['export']>>,
  ): string {
    const headers = [
      'numeroOrden',
      'empresa',
      'cliente',
      'servicio',
      'fechaVisita',
      'horaInicio',
      'tecnico',
      'tipoVisita',
      'estadoServicio',
      'estadoPago',
      'urgencia',
      'valorCotizado',
      'valorPagado',
      'metodoPago',
      'municipio',
      'departamento',
      'direccion',
      'creador',
      'creadaEn',
    ];

    const lines = rows.map((row) =>
      headers
        .map((header) =>
          this.escapeCsvValue(row[header as keyof (typeof rows)[number]]),
        )
        .join(','),
    );

    return `\uFEFF${headers.join(',')}\n${lines.join('\n')}`;
  }

  private stringifyCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value;
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return String(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.stringifyCsvValue(item)).join(' | ');
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return '';
  }

  private escapeCsvValue(value: unknown) {
    const normalized = this.stringifyCsvValue(value).replace(/"/g, '""');
    return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
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
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: (times) => (times > 1 ? null : 200),
      };
    }

    const host = this.configService.get<string>('REDIS_HOST') || '127.0.0.1';
    const port = Number(this.configService.get<string>('REDIS_PORT') || 6379);
    const username =
      this.configService.get<string>('REDIS_USERNAME') || undefined;
    const password = this.configService.get<string>('REDIS_PASSWORD');
    const db = Number(this.configService.get<string>('REDIS_DB') || 0);

    return {
      host,
      port,
      username,
      password,
      db,
      connectTimeout: 1_000,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => (times > 1 ? null : 200),
    };
  }
}
