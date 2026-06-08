import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoOrden, Prisma } from '../generated/client/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import {
  endOfBogotaDayUtc,
  parseFlexibleDateTimeToUtc,
  startOfBogotaDayUtc,
} from '../common/utils/timezone.util';
import { OrdenesServicioService } from '../ordenes-servicio/ordenes-servicio.service';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateMobileOperatorServiceSignedUploadUrlDto,
  MobileOperatorServiceUploadKind,
} from './dto/create-mobile-operator-service-signed-upload-url.dto';
import {
  FinishMobileOperatorServiceDto,
  MobileOperatorServiceInvoiceType,
} from './dto/finish-mobile-operator-service.dto';
import {
  MobileOperatorServiceDetailResponseDto,
  MobileOperatorServiceGeolocationDto,
} from './dto/get-mobile-operator-service-detail-response.dto';
import {
  MobileOperatorServiceListItemDto,
  MobileOperatorServiceListResponseDto,
  MobileOperatorServiceNavigationDto,
  MobileOperatorServiceSummaryDto,
} from './dto/get-mobile-operator-service-list-response.dto';
import {
  GetMobileOperatorServicesQueryDto,
  MobileOperatorServiceTab,
} from './dto/get-mobile-operator-services-query.dto';
import { RegisterMobileOperatorServiceArrivalDto } from './dto/register-mobile-operator-service-arrival.dto';
import {
  MobileOperatorServiceReportTargetStatus,
  MobileOperatorServiceReportType,
  ReportMobileOperatorServiceDto,
} from './dto/report-mobile-operator-service.dto';
import { OperatorServiceScope } from './types/operator-service-scope.type';

const CLOSED_SERVICE_STATUSES: EstadoOrden[] = [
  EstadoOrden.LIQUIDADO,
  EstadoOrden.TECNICO_FINALIZO,
  EstadoOrden.CANCELADO,
  EstadoOrden.REPROGRAMADO,
  EstadoOrden.SIN_CONCRETAR,
];

const DEFAULT_REPORT_TARGET_STATUS_BY_TYPE: Partial<
  Record<
    MobileOperatorServiceReportType,
    MobileOperatorServiceReportTargetStatus
  >
> = {
  [MobileOperatorServiceReportType.CLIENTE_AUSENTE]:
    MobileOperatorServiceReportTargetStatus.REPROGRAMADO,
  [MobileOperatorServiceReportType.ACCESO_CERRADO]:
    MobileOperatorServiceReportTargetStatus.REPROGRAMADO,
  [MobileOperatorServiceReportType.DIRECCION_INCORRECTA]:
    MobileOperatorServiceReportTargetStatus.REPROGRAMADO,
  [MobileOperatorServiceReportType.INCONVENIENTE_OPERATIVO]:
    MobileOperatorServiceReportTargetStatus.REPROGRAMADO,
  [MobileOperatorServiceReportType.CLIENTE_RECHAZA_SERVICIO]:
    MobileOperatorServiceReportTargetStatus.CANCELADO,
  [MobileOperatorServiceReportType.ZONA_INSEGURA]:
    MobileOperatorServiceReportTargetStatus.CANCELADO,
  [MobileOperatorServiceReportType.SERVICIO_DUPLICADO]:
    MobileOperatorServiceReportTargetStatus.CANCELADO,
};

const REPORT_TYPE_LABELS: Record<MobileOperatorServiceReportType, string> = {
  [MobileOperatorServiceReportType.CLIENTE_AUSENTE]: 'Cliente ausente',
  [MobileOperatorServiceReportType.ACCESO_CERRADO]: 'Acceso cerrado',
  [MobileOperatorServiceReportType.DIRECCION_INCORRECTA]:
    'Dirección incorrecta',
  [MobileOperatorServiceReportType.INCONVENIENTE_OPERATIVO]:
    'Inconveniente operativo',
  [MobileOperatorServiceReportType.CLIENTE_RECHAZA_SERVICIO]:
    'Cliente rechaza el servicio',
  [MobileOperatorServiceReportType.ZONA_INSEGURA]: 'Zona insegura',
  [MobileOperatorServiceReportType.SERVICIO_DUPLICADO]: 'Servicio duplicado',
  [MobileOperatorServiceReportType.OTRO]: 'Otro',
};

type ServiceListRecord = Prisma.OrdenServicioGetPayload<{
  select: {
    id: true;
    numeroOrden: true;
    fechaVisita: true;
    horaInicio: true;
    horaFin: true;
    horaInicioReal: true;
    horaFinReal: true;
    estadoServicio: true;
    estadoPago: true;
    tipoVisita: true;
    urgencia: true;
    direccionTexto: true;
    linkMaps: true;
    servicioId: true;
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
    direccion: {
      select: {
        latitud: true;
        longitud: true;
        linkMaps: true;
      };
    };
    geolocalizaciones: {
      orderBy: {
        llegada: 'desc';
      };
      take: 1;
      select: {
        id: true;
        salida: true;
      };
    };
  };
}>;

type ServiceDetailRecord = Prisma.OrdenServicioGetPayload<{
  select: {
    id: true;
    numeroOrden: true;
    fechaVisita: true;
    horaInicio: true;
    horaFin: true;
    horaInicioReal: true;
    horaFinReal: true;
    estadoServicio: true;
    estadoPago: true;
    tipoVisita: true;
    urgencia: true;
    direccionTexto: true;
    piso: true;
    bloque: true;
    unidad: true;
    barrio: true;
    municipio: true;
    departamento: true;
    linkMaps: true;
    observacion: true;
    observacionFinal: true;
    diagnosticoTecnico: true;
    intervencionRealizada: true;
    hallazgosEstructurales: true;
    recomendacionesObligatorias: true;
    huboSellamiento: true;
    huboRecomendacionEstructural: true;
    nivelInfestacion: true;
    servicioId: true;
    serviciosSeleccionados: true;
    valorCotizado: true;
    valorPagado: true;
    metodosPagoBase: true;
    desglosePago: true;
    comprobantePago: true;
    facturaPath: true;
    facturaElectronica: true;
    referenciaPago: true;
    fechaPago: true;
    servicio: {
      select: {
        id: true;
        nombre: true;
      };
    };
    metodoPago: {
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
    direccion: {
      select: {
        latitud: true;
        longitud: true;
        linkMaps: true;
        precisionGPS: true;
      };
    };
    geolocalizaciones: {
      orderBy: {
        llegada: 'desc';
      };
      take: 1;
      select: {
        id: true;
        llegada: true;
        salida: true;
        latitud: true;
        longitud: true;
        fotoLlegada: true;
        fotoSalida: true;
        linkMaps: true;
      };
    };
    evidencias: {
      select: {
        id: true;
      };
    };
  };
}>;

@Injectable()
export class MobileOperatorServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
    private readonly ordenesServicioService: OrdenesServicioService,
  ) {}

  async listServices(
    scope: OperatorServiceScope,
    query: GetMobileOperatorServicesQueryDto,
  ): Promise<MobileOperatorServiceListResponseDto> {
    const now = new Date();
    const startOfToday = startOfBogotaDayUtc(now);
    const endOfToday = endOfBogotaDayUtc(now);
    const tab = query.tab ?? MobileOperatorServiceTab.TODAY;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [summary, rows] = await Promise.all([
      this.getServiceSummary(scope, startOfToday, endOfToday),
      this.prisma.ordenServicio.findMany({
        where: this.buildTabWhere(scope, tab, startOfToday, endOfToday),
        skip,
        take: limit,
        orderBy:
          tab === MobileOperatorServiceTab.COMPLETED
            ? [
                { fechaVisita: 'desc' },
                { horaInicio: 'desc' },
                { createdAt: 'desc' },
              ]
            : [
                { fechaVisita: 'asc' },
                { horaInicio: 'asc' },
                { createdAt: 'asc' },
              ],
        select: {
          id: true,
          numeroOrden: true,
          fechaVisita: true,
          horaInicio: true,
          horaFin: true,
          horaInicioReal: true,
          horaFinReal: true,
          estadoServicio: true,
          estadoPago: true,
          tipoVisita: true,
          urgencia: true,
          direccionTexto: true,
          linkMaps: true,
          servicioId: true,
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
          direccion: {
            select: {
              latitud: true,
              longitud: true,
              linkMaps: true,
            },
          },
          geolocalizaciones: {
            orderBy: {
              llegada: 'desc',
            },
            take: 1,
            select: {
              id: true,
              salida: true,
            },
          },
        },
      }),
    ]);

    return {
      tab,
      summary,
      pagination: {
        page,
        limit,
        total: this.resolveTabTotal(summary, tab),
        hasMore: skip + rows.length < this.resolveTabTotal(summary, tab),
      },
      items: rows.map((row) => this.mapListItem(row)),
    };
  }

  async getServiceDetail(
    scope: OperatorServiceScope,
    id: string,
  ): Promise<MobileOperatorServiceDetailResponseDto> {
    const row = await this.prisma.ordenServicio.findFirst({
      where: this.buildOrderWhere(scope, {
        id,
      }),
      select: {
        id: true,
        numeroOrden: true,
        fechaVisita: true,
        horaInicio: true,
        horaFin: true,
        horaInicioReal: true,
        horaFinReal: true,
        estadoServicio: true,
        estadoPago: true,
        tipoVisita: true,
        urgencia: true,
        direccionTexto: true,
        piso: true,
        bloque: true,
        unidad: true,
        barrio: true,
        municipio: true,
        departamento: true,
        linkMaps: true,
        observacion: true,
        observacionFinal: true,
        diagnosticoTecnico: true,
        intervencionRealizada: true,
        hallazgosEstructurales: true,
        recomendacionesObligatorias: true,
        huboSellamiento: true,
        huboRecomendacionEstructural: true,
        nivelInfestacion: true,
        servicioId: true,
        serviciosSeleccionados: true,
        valorCotizado: true,
        valorPagado: true,
        metodosPagoBase: true,
        desglosePago: true,
        comprobantePago: true,
        facturaPath: true,
        facturaElectronica: true,
        referenciaPago: true,
        fechaPago: true,
        servicio: {
          select: {
            id: true,
            nombre: true,
          },
        },
        metodoPago: {
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
        direccion: {
          select: {
            latitud: true,
            longitud: true,
            linkMaps: true,
            precisionGPS: true,
          },
        },
        geolocalizaciones: {
          orderBy: {
            llegada: 'desc',
          },
          take: 1,
          select: {
            id: true,
            llegada: true,
            salida: true,
            latitud: true,
            longitud: true,
            fotoLlegada: true,
            fotoSalida: true,
            linkMaps: true,
          },
        },
        evidencias: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException(
        'No encontramos ese servicio dentro de tu alcance operativo',
      );
    }

    return this.mapDetail(row);
  }

  async createSignedUploadUrl(
    scope: OperatorServiceScope,
    id: string,
    dto: CreateMobileOperatorServiceSignedUploadUrlDto,
  ) {
    await this.assertServiceExists(scope, id);

    const path = this.buildStoragePath(
      scope.tenantId,
      id,
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

    return {
      kind: dto.kind,
      ...signed,
    };
  }

  async registerArrival(
    _user: JwtPayload,
    scope: OperatorServiceScope,
    id: string,
    dto: RegisterMobileOperatorServiceArrivalDto,
  ): Promise<MobileOperatorServiceDetailResponseDto> {
    this.ensureCoordinatePair(dto.latitud, dto.longitud);
    const fotoLlegadaPath = dto.fotoLlegadaPath.trim();
    if (!fotoLlegadaPath) {
      throw new BadRequestException('La foto de llegada es obligatoria');
    }

    const occurredAt = this.parseOccurrence(dto.occurredAt, 'occurredAt');
    const order = await this.getEditableServiceOrThrow(scope, id);

    const openGeo = await this.prisma.geolocalizacion.findFirst({
      where: {
        tenantId: scope.tenantId,
        ordenId: id,
        membershipId: scope.membershipId,
        salida: null,
      },
      orderBy: {
        llegada: 'desc',
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (openGeo) {
        await tx.geolocalizacion.update({
          where: {
            id: openGeo.id,
          },
          data: {
            llegada: occurredAt,
            fotoLlegada: fotoLlegadaPath,
            latitud: dto.latitud ?? undefined,
            longitud: dto.longitud ?? undefined,
            linkMaps: dto.linkMaps?.trim() || undefined,
          },
        });
      } else {
        await tx.geolocalizacion.create({
          data: {
            tenantId: scope.tenantId,
            empresaId: order.empresaId,
            membershipId: scope.membershipId,
            ordenId: id,
            llegada: occurredAt,
            fotoLlegada: fotoLlegadaPath,
            latitud: dto.latitud ?? null,
            longitud: dto.longitud ?? null,
            linkMaps: dto.linkMaps?.trim() || null,
          },
        });
      }

      await tx.ordenServicio.update({
        where: { id },
        data: {
          horaInicioReal: order.horaInicioReal ?? occurredAt,
          estadoServicio:
            order.estadoServicio === EstadoOrden.PROGRAMADO ||
            order.estadoServicio === EstadoOrden.NUEVO ||
            order.estadoServicio === EstadoOrden.REPROGRAMADO
              ? EstadoOrden.PROCESO
              : undefined,
          linkMaps:
            !order.linkMaps && dto.linkMaps?.trim()
              ? dto.linkMaps.trim()
              : undefined,
        },
      });

      await this.backfillDirectionCoordinates(
        tx,
        order,
        dto.latitud,
        dto.longitud,
      );
      await this.backfillDirectionLink(tx, order, dto.linkMaps);
    });

    return this.getServiceDetail(scope, id);
  }

  async finishService(
    user: JwtPayload,
    scope: OperatorServiceScope,
    id: string,
    dto: FinishMobileOperatorServiceDto,
  ): Promise<MobileOperatorServiceDetailResponseDto> {
    this.ensureCoordinatePair(dto.latitud, dto.longitud);
    const fotoSalidaPath = dto.fotoSalidaPath.trim();
    const facturaPath = dto.facturaPath?.trim() || undefined;
    const facturaElectronica = dto.facturaElectronica?.trim() || undefined;
    const resolvedInvoiceType =
      dto.invoiceType ??
      (facturaPath
        ? MobileOperatorServiceInvoiceType.PHYSICAL
        : facturaElectronica
          ? MobileOperatorServiceInvoiceType.ELECTRONIC
          : undefined);
    const persistedFacturaPath =
      resolvedInvoiceType === MobileOperatorServiceInvoiceType.ELECTRONIC
        ? undefined
        : facturaPath;
    const persistedFacturaElectronica =
      resolvedInvoiceType === MobileOperatorServiceInvoiceType.PHYSICAL
        ? undefined
        : facturaElectronica;

    if (!fotoSalidaPath) {
      throw new BadRequestException('La foto de salida es obligatoria');
    }

    if (dto.facturaSolicitada) {
      if (resolvedInvoiceType === MobileOperatorServiceInvoiceType.PHYSICAL) {
        if (!facturaPath) {
          throw new BadRequestException(
            'Si el cliente pidió factura física, debés adjuntar facturaPath',
          );
        }
      } else if (
        resolvedInvoiceType === MobileOperatorServiceInvoiceType.ELECTRONIC
      ) {
        // Compatibilidad: en factura electrónica no exigimos archivo ni marker adicional.
      } else {
        throw new BadRequestException(
          'Si el cliente pidió factura, debés indicar invoiceType o usar el flujo legacy con facturaPath/facturaElectronica',
        );
      }
    }

    if (dto.montoPagado !== undefined && dto.transferencias?.length) {
      throw new BadRequestException(
        'Usá montoPagado o transferencias, pero no ambos al mismo tiempo',
      );
    }

    const topLevelComprobantePath = dto.comprobantePago?.trim();
    const topLevelReferenciaPago = dto.referenciaPago?.trim();
    const topLevelFechaPago = dto.fechaPago?.trim();
    const transferencias =
      dto.montoPagado !== undefined
        ? [
            {
              monto: dto.montoPagado,
              comprobantePath: topLevelComprobantePath ?? '',
              referenciaPago: topLevelReferenciaPago ?? '',
              fechaPago: topLevelFechaPago ?? '',
            },
          ]
        : dto.transferencias;

    if (
      dto.montoPagado !== undefined &&
      (!topLevelComprobantePath ||
        !topLevelReferenciaPago ||
        !topLevelFechaPago)
    ) {
      throw new BadRequestException(
        'Si enviás montoPagado debés adjuntar comprobantePago, referenciaPago y fechaPago',
      );
    }

    const occurredAt = this.parseOccurrence(dto.occurredAt, 'occurredAt');
    const order = await this.getEditableServiceOrThrow(scope, id);
    const serviceEvidencePaths = this.validateStoragePaths(
      dto.serviceEvidencePaths,
      this.buildStoragePrefix(
        scope.tenantId,
        id,
        MobileOperatorServiceUploadKind.SERVICE_EVIDENCE,
      ),
      'serviceEvidencePaths',
    );
    const openGeo = await this.prisma.geolocalizacion.findFirst({
      where: {
        tenantId: scope.tenantId,
        ordenId: id,
        membershipId: scope.membershipId,
        salida: null,
      },
      orderBy: {
        llegada: 'desc',
      },
    });

    if (!order.horaInicioReal && !openGeo) {
      throw new BadRequestException(
        'Primero debés registrar la llegada antes de finalizar el servicio',
      );
    }

    await this.ordenesServicioService.update(
      scope.tenantId,
      id,
      {
        metodoPagoId: dto.metodoPagoId,
        facturaPath: persistedFacturaPath,
        facturaElectronica: persistedFacturaElectronica,
        comprobantePago: dto.comprobantePago,
        referenciaPago: dto.referenciaPago,
        fechaPago: dto.fechaPago,
        observacionFinal: dto.observacionFinal,
        diagnosticoTecnico: dto.diagnosticoTecnico,
        intervencionRealizada: dto.intervencionRealizada,
        hallazgosEstructurales: dto.hallazgosEstructurales,
        recomendacionesObligatorias: dto.recomendacionesObligatorias,
        huboSellamiento: dto.huboSellamiento,
        huboRecomendacionEstructural: dto.huboRecomendacionEstructural,
        nivelInfestacion: dto.nivelInfestacion,
        desglosePago: dto.desglosePago,
        transferencias,
        horaFinReal: occurredAt.toISOString(),
        estadoServicio: EstadoOrden.TECNICO_FINALIZO,
      },
      user,
    );

    await this.prisma.$transaction(async (tx) => {
      if (openGeo) {
        await tx.geolocalizacion.update({
          where: {
            id: openGeo.id,
          },
          data: {
            salida: occurredAt,
            fotoSalida: fotoSalidaPath,
            latitud: dto.latitud ?? openGeo.latitud ?? undefined,
            longitud: dto.longitud ?? openGeo.longitud ?? undefined,
            linkMaps: dto.linkMaps?.trim() || openGeo.linkMaps || undefined,
          },
        });
      } else {
        await tx.geolocalizacion.create({
          data: {
            tenantId: scope.tenantId,
            empresaId: order.empresaId,
            membershipId: scope.membershipId,
            ordenId: id,
            llegada: order.horaInicioReal ?? occurredAt,
            salida: occurredAt,
            fotoSalida: fotoSalidaPath,
            latitud: dto.latitud ?? null,
            longitud: dto.longitud ?? null,
            linkMaps: dto.linkMaps?.trim() || null,
          },
        });
      }

      if (serviceEvidencePaths.length) {
        await this.createServiceEvidenceRecords(
          tx,
          scope.tenantId,
          id,
          serviceEvidencePaths,
        );
      }

      await tx.ordenServicio.update({
        where: { id },
        data: {
          linkMaps:
            !order.linkMaps && dto.linkMaps?.trim()
              ? dto.linkMaps.trim()
              : undefined,
          evidenciaPath:
            !order.evidenciaPath?.trim() && serviceEvidencePaths[0]
              ? serviceEvidencePaths[0]
              : undefined,
        },
      });

      await this.backfillDirectionCoordinates(
        tx,
        order,
        dto.latitud,
        dto.longitud,
      );
      await this.backfillDirectionLink(tx, order, dto.linkMaps);
    });

    return this.getServiceDetail(scope, id);
  }

  async reportService(
    user: JwtPayload,
    scope: OperatorServiceScope,
    id: string,
    dto: ReportMobileOperatorServiceDto,
  ): Promise<MobileOperatorServiceDetailResponseDto> {
    this.ensureCoordinatePair(dto.latitud, dto.longitud);

    const occurredAt = this.parseOccurrence(dto.occurredAt, 'occurredAt');
    const order = await this.getEditableServiceOrThrow(scope, id);
    const reportEvidencePaths = this.validateStoragePaths(
      dto.evidenciaPaths,
      this.buildStoragePrefix(
        scope.tenantId,
        id,
        MobileOperatorServiceUploadKind.REPORT_EVIDENCE,
      ),
      'evidenciaPaths',
    );
    const sanitizedReason = dto.motivo?.trim() || null;
    if (dto.tipo === MobileOperatorServiceReportType.OTRO && !sanitizedReason) {
      throw new BadRequestException(
        'Debés describir el motivo cuando el tipo de reporte es OTRO',
      );
    }
    const estadoDestino = this.resolveReportTargetStatus(
      dto.tipo,
      dto.estadoDestino,
    );
    const estadoServicio =
      estadoDestino === MobileOperatorServiceReportTargetStatus.REPROGRAMADO
        ? EstadoOrden.REPROGRAMADO
        : EstadoOrden.CANCELADO;
    const reportSummary = sanitizedReason || REPORT_TYPE_LABELS[dto.tipo];

    await this.ordenesServicioService.update(
      scope.tenantId,
      id,
      {
        estadoServicio,
        observacionFinal: reportSummary,
      },
      user,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.ordenServicioReporte.create({
        data: {
          tenantId: scope.tenantId,
          empresaId: order.empresaId,
          ordenServicioId: id,
          membershipId: scope.membershipId,
          tipo: dto.tipo,
          estadoDestino,
          descripcion: reportSummary,
          evidenciaPaths: reportEvidencePaths.length
            ? (reportEvidencePaths as unknown as Prisma.InputJsonValue)
            : undefined,
          occurredAt,
        },
      });

      if (reportEvidencePaths.length) {
        await this.createServiceEvidenceRecords(
          tx,
          scope.tenantId,
          id,
          reportEvidencePaths,
        );

        await tx.ordenServicio.update({
          where: { id },
          data: {
            evidenciaPath: reportEvidencePaths[0],
          },
        });
      }

      if (dto.latitud !== undefined && dto.longitud !== undefined) {
        await tx.geolocalizacion.create({
          data: {
            tenantId: scope.tenantId,
            empresaId: order.empresaId,
            membershipId: scope.membershipId,
            ordenId: id,
            llegada: occurredAt,
            salida: occurredAt,
            fotoLlegada: reportEvidencePaths[0] ?? null,
            latitud: dto.latitud,
            longitud: dto.longitud,
            linkMaps: dto.linkMaps?.trim() || null,
          },
        });
      }

      await tx.ordenServicio.update({
        where: { id },
        data: {
          linkMaps:
            !order.linkMaps && dto.linkMaps?.trim()
              ? dto.linkMaps.trim()
              : undefined,
        },
      });

      await this.backfillDirectionCoordinates(
        tx,
        order,
        dto.latitud,
        dto.longitud,
      );
      await this.backfillDirectionLink(tx, order, dto.linkMaps);
    });

    return this.getServiceDetail(scope, id);
  }

  private async getServiceSummary(
    scope: OperatorServiceScope,
    startOfToday: Date,
    endOfToday: Date,
  ): Promise<MobileOperatorServiceSummaryDto> {
    const [today, completed, overdue] = await Promise.all([
      this.prisma.ordenServicio.count({
        where: this.buildOpenOrderWhere(scope, {
          fechaVisita: {
            gte: startOfToday,
            lte: endOfToday,
          },
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOrderWhere(scope, {
          estadoServicio: {
            in: [EstadoOrden.TECNICO_FINALIZO, EstadoOrden.LIQUIDADO],
          },
        }),
      }),
      this.prisma.ordenServicio.count({
        where: this.buildOpenOrderWhere(scope, {
          fechaVisita: {
            lt: startOfToday,
          },
        }),
      }),
    ]);

    return {
      today,
      completed,
      overdue,
    };
  }

  private buildOrderWhere(
    scope: OperatorServiceScope,
    extraWhere: Prisma.OrdenServicioWhereInput = {},
  ): Prisma.OrdenServicioWhereInput {
    return {
      tenantId: scope.tenantId,
      tecnicoId: scope.membershipId,
      empresaId: {
        in: scope.empresaIds,
      },
      deletedAt: null,
      ...(scope.zonaIds?.length ? { zonaId: { in: scope.zonaIds } } : {}),
      ...extraWhere,
    };
  }

  private buildOpenOrderWhere(
    scope: OperatorServiceScope,
    extraWhere: Prisma.OrdenServicioWhereInput = {},
  ): Prisma.OrdenServicioWhereInput {
    return this.buildOrderWhere(scope, {
      estadoServicio: {
        notIn: CLOSED_SERVICE_STATUSES,
      },
      ...extraWhere,
    });
  }

  private buildTabWhere(
    scope: OperatorServiceScope,
    tab: MobileOperatorServiceTab,
    startOfToday: Date,
    endOfToday: Date,
  ): Prisma.OrdenServicioWhereInput {
    switch (tab) {
      case MobileOperatorServiceTab.COMPLETED:
        return this.buildOrderWhere(scope, {
          estadoServicio: {
            in: [EstadoOrden.TECNICO_FINALIZO, EstadoOrden.LIQUIDADO],
          },
        });
      case MobileOperatorServiceTab.OVERDUE:
        return this.buildOpenOrderWhere(scope, {
          fechaVisita: {
            lt: startOfToday,
          },
        });
      case MobileOperatorServiceTab.TODAY:
      default:
        return this.buildOpenOrderWhere(scope, {
          fechaVisita: {
            gte: startOfToday,
            lte: endOfToday,
          },
        });
    }
  }

  private resolveTabTotal(
    summary: MobileOperatorServiceSummaryDto,
    tab: MobileOperatorServiceTab,
  ): number {
    switch (tab) {
      case MobileOperatorServiceTab.COMPLETED:
        return summary.completed;
      case MobileOperatorServiceTab.OVERDUE:
        return summary.overdue;
      case MobileOperatorServiceTab.TODAY:
      default:
        return summary.today;
    }
  }

  private async assertServiceExists(
    scope: OperatorServiceScope,
    id: string,
  ): Promise<void> {
    const order = await this.prisma.ordenServicio.findFirst({
      where: this.buildOrderWhere(scope, {
        id,
      }),
      select: {
        id: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        'No encontramos ese servicio dentro de tu alcance operativo',
      );
    }
  }

  private async getEditableServiceOrThrow(
    scope: OperatorServiceScope,
    id: string,
  ) {
    const order = await this.prisma.ordenServicio.findFirst({
      where: this.buildOrderWhere(scope, {
        id,
      }),
      select: {
        id: true,
        empresaId: true,
        direccionId: true,
        evidenciaPath: true,
        estadoServicio: true,
        horaInicioReal: true,
        linkMaps: true,
        direccion: {
          select: {
            latitud: true,
            longitud: true,
            linkMaps: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        'No encontramos ese servicio dentro de tu alcance operativo',
      );
    }

    if (CLOSED_SERVICE_STATUSES.includes(order.estadoServicio)) {
      throw new BadRequestException(
        'Este servicio ya está cerrado y no admite más acciones operativas',
      );
    }

    return order;
  }

  private buildStoragePath(
    tenantId: string,
    ordenId: string,
    kind: MobileOperatorServiceUploadKind,
    fileName: string,
  ) {
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const random = Math.random().toString(36).slice(2, 8);
    const finalName = `${Date.now()}-${random}-${safeName}`;

    return `${this.buildStoragePrefix(tenantId, ordenId, kind)}${finalName}`;
  }

  private buildStoragePrefix(
    tenantId: string,
    ordenId: string,
    kind: MobileOperatorServiceUploadKind,
  ) {
    return `${tenantId}/ordenes-servicio/${ordenId}/mobile/${kind}/`;
  }

  private validateStoragePaths(
    paths: string[] | undefined,
    expectedPrefix: string,
    fieldName: string,
  ): string[] {
    if (!paths?.length) {
      return [];
    }

    return paths.map((path, index) => {
      const trimmedPath = path.trim();

      if (!trimmedPath) {
        throw new BadRequestException(
          `${fieldName}[${index}] no puede estar vacío`,
        );
      }

      if (!trimmedPath.startsWith(expectedPrefix)) {
        throw new BadRequestException(
          `Cada item de ${fieldName} debe pertenecer al prefijo ${expectedPrefix}`,
        );
      }

      return trimmedPath;
    });
  }

  private async createServiceEvidenceRecords(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ordenServicioId: string,
    paths: string[],
  ): Promise<void> {
    if (!paths.length) {
      return;
    }

    await tx.evidenciaServicio.createMany({
      data: paths.map((path) => ({
        tenantId,
        ordenServicioId,
        path,
      })),
    });
  }

  private ensureCoordinatePair(latitud?: number, longitud?: number): void {
    const hasLat = typeof latitud === 'number';
    const hasLng = typeof longitud === 'number';

    if (hasLat !== hasLng) {
      throw new BadRequestException('Latitud y longitud deben enviarse juntas');
    }
  }

  private parseOccurrence(value: string | undefined, fieldName: string): Date {
    if (!value) {
      return new Date();
    }

    const parsed = parseFlexibleDateTimeToUtc(value);
    if (!parsed) {
      throw new BadRequestException(`${fieldName} inválido`);
    }

    return parsed;
  }

  private async backfillDirectionCoordinates(
    tx: Prisma.TransactionClient,
    order: {
      direccionId: string | null;
      direccion: {
        latitud: number | null;
        longitud: number | null;
      } | null;
    },
    latitud?: number,
    longitud?: number,
  ) {
    if (
      !order.direccionId ||
      latitud === undefined ||
      longitud === undefined ||
      !order.direccion ||
      (order.direccion.latitud !== null && order.direccion.longitud !== null)
    ) {
      return;
    }

    await tx.direccion.update({
      where: {
        id: order.direccionId,
      },
      data: {
        latitud: order.direccion.latitud ?? latitud,
        longitud: order.direccion.longitud ?? longitud,
      },
    });
  }

  private async backfillDirectionLink(
    tx: Prisma.TransactionClient,
    order: {
      direccionId: string | null;
      direccion: {
        linkMaps: string | null;
      } | null;
    },
    linkMaps?: string,
  ) {
    const cleanedLink = linkMaps?.trim();
    if (
      !order.direccionId ||
      !cleanedLink ||
      !order.direccion ||
      order.direccion.linkMaps
    ) {
      return;
    }

    await tx.direccion.update({
      where: {
        id: order.direccionId,
      },
      data: {
        linkMaps: cleanedLink,
      },
    });
  }

  private mapListItem(
    row: ServiceListRecord,
  ): MobileOperatorServiceListItemDto {
    const latestGeo = row.geolocalizaciones[0] ?? null;

    return {
      id: row.id,
      numeroOrden: row.numeroOrden ?? null,
      fechaVisita: row.fechaVisita?.toISOString() ?? null,
      horaInicio: row.horaInicio?.toISOString() ?? null,
      horaFin: row.horaFin?.toISOString() ?? null,
      horaInicioReal: row.horaInicioReal?.toISOString() ?? null,
      horaFinReal: row.horaFinReal?.toISOString() ?? null,
      estadoServicio: row.estadoServicio,
      estadoPago: row.estadoPago,
      tipoVisita: row.tipoVisita ?? null,
      urgencia: row.urgencia ?? null,
      clienteNombre: this.resolveClientName(row.cliente),
      direccion: row.direccionTexto,
      servicioId: row.servicioId,
      servicio: row.servicio
        ? {
            id: row.servicio.id,
            nombre: row.servicio.nombre,
          }
        : null,
      serviciosSeleccionados: row.serviciosSeleccionados ?? null,
      llegadaRegistrada: !!row.horaInicioReal || latestGeo !== null,
      salidaRegistrada: !!row.horaFinReal || !!latestGeo?.salida,
      navigation: this.buildNavigation({
        direccionTexto: row.direccionTexto,
        orderLinkMaps: row.linkMaps,
        directionLinkMaps: row.direccion?.linkMaps ?? null,
        latitud: row.direccion?.latitud ?? null,
        longitud: row.direccion?.longitud ?? null,
      }),
    };
  }

  private mapDetail(
    row: ServiceDetailRecord,
  ): MobileOperatorServiceDetailResponseDto {
    const latestGeo = row.geolocalizaciones[0] ?? null;
    const navigation = this.buildNavigation({
      direccionTexto: row.direccionTexto,
      orderLinkMaps: row.linkMaps,
      directionLinkMaps: row.direccion?.linkMaps ?? null,
      latitud: row.direccion?.latitud ?? null,
      longitud: row.direccion?.longitud ?? null,
    });
    const isClosed = CLOSED_SERVICE_STATUSES.includes(row.estadoServicio);
    const hasArrival = !!row.horaInicioReal || latestGeo !== null;

    return {
      id: row.id,
      numeroOrden: row.numeroOrden ?? null,
      fechaVisita: row.fechaVisita?.toISOString() ?? null,
      horaInicio: row.horaInicio?.toISOString() ?? null,
      horaFin: row.horaFin?.toISOString() ?? null,
      horaInicioReal: row.horaInicioReal?.toISOString() ?? null,
      horaFinReal: row.horaFinReal?.toISOString() ?? null,
      estadoServicio: row.estadoServicio,
      estadoPago: row.estadoPago,
      tipoVisita: row.tipoVisita ?? null,
      urgencia: row.urgencia ?? null,
      cliente: {
        nombre: this.resolveClientName(row.cliente),
      },
      servicio: row.servicio
        ? {
            id: row.servicio.id,
            nombre: row.servicio.nombre,
          }
        : null,
      serviciosSeleccionados: row.serviciosSeleccionados ?? null,
      direccion: {
        direccionTexto: row.direccionTexto,
        piso: row.piso ?? null,
        bloque: row.bloque ?? null,
        unidad: row.unidad ?? null,
        barrio: row.barrio ?? null,
        municipio: row.municipio ?? null,
        departamento: row.departamento ?? null,
        linkMaps: row.linkMaps || row.direccion?.linkMaps || null,
        latitud: row.direccion?.latitud ?? null,
        longitud: row.direccion?.longitud ?? null,
        precisionGPS: row.direccion?.precisionGPS?.toString() ?? null,
      },
      observacion: row.observacion ?? null,
      observacionFinal: row.observacionFinal ?? null,
      diagnosticoTecnico: row.diagnosticoTecnico ?? null,
      intervencionRealizada: row.intervencionRealizada ?? null,
      hallazgosEstructurales: row.hallazgosEstructurales ?? null,
      recomendacionesObligatorias: row.recomendacionesObligatorias ?? null,
      huboSellamiento: !!row.huboSellamiento,
      huboRecomendacionEstructural: !!row.huboRecomendacionEstructural,
      nivelInfestacion: row.nivelInfestacion ?? null,
      payment: {
        metodoPago: row.metodoPago
          ? {
              id: row.metodoPago.id,
              nombre: row.metodoPago.nombre,
            }
          : null,
        valorCotizado: row.valorCotizado ? Number(row.valorCotizado) : null,
        valorPagado: row.valorPagado ? Number(row.valorPagado) : null,
        estadoPago: row.estadoPago,
        metodosPagoBase: row.metodosPagoBase,
        desglosePago: row.desglosePago ?? null,
        comprobantePago: row.comprobantePago ?? null,
        facturaPath: row.facturaPath ?? null,
        facturaElectronica: row.facturaElectronica ?? null,
        referenciaPago: row.referenciaPago ?? null,
        fechaPago: row.fechaPago?.toISOString() ?? null,
      },
      latestGeolocation: latestGeo
        ? this.mapLatestGeolocation(latestGeo)
        : null,
      evidenciasCount: row.evidencias.length,
      navigation,
      actions: {
        canOpenNavigation: !!navigation.launchUrl,
        canMarkArrival: !isClosed && !hasArrival,
        canFinish: !isClosed && hasArrival,
        canReport: !isClosed,
        canUploadEvidence:
          row.estadoServicio === EstadoOrden.TECNICO_FINALIZO ||
          row.estadoServicio === EstadoOrden.LIQUIDADO,
      },
    };
  }

  private mapLatestGeolocation(
    row: NonNullable<ServiceDetailRecord['geolocalizaciones'][number]>,
  ): MobileOperatorServiceGeolocationDto {
    return {
      id: row.id,
      llegada: row.llegada.toISOString(),
      salida: row.salida?.toISOString() ?? null,
      latitud: row.latitud ?? null,
      longitud: row.longitud ?? null,
      fotoLlegada: row.fotoLlegada ?? null,
      fotoSalida: row.fotoSalida ?? null,
      linkMaps: row.linkMaps ?? null,
    };
  }

  private buildNavigation(input: {
    direccionTexto: string;
    orderLinkMaps: string | null;
    directionLinkMaps: string | null;
    latitud: number | null;
    longitud: number | null;
  }): MobileOperatorServiceNavigationDto {
    if (input.latitud !== null && input.longitud !== null) {
      return {
        destinationSource: 'coordinates',
        launchUrl: `https://www.google.com/maps/search/?api=1&query=${input.latitud},${input.longitud}`,
        latitud: input.latitud,
        longitud: input.longitud,
        linkMaps: input.directionLinkMaps || input.orderLinkMaps || null,
      };
    }

    const linkMaps = input.orderLinkMaps || input.directionLinkMaps || null;
    if (linkMaps) {
      return {
        destinationSource: 'linkMaps',
        launchUrl: linkMaps,
        latitud: null,
        longitud: null,
        linkMaps,
      };
    }

    if (input.direccionTexto.trim()) {
      return {
        destinationSource: 'address',
        launchUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          input.direccionTexto,
        )}`,
        latitud: null,
        longitud: null,
        linkMaps: null,
      };
    }

    return {
      destinationSource: 'unknown',
      launchUrl: null,
      latitud: null,
      longitud: null,
      linkMaps: null,
    };
  }

  private resolveReportTargetStatus(
    tipo: MobileOperatorServiceReportType,
    estadoDestino?: MobileOperatorServiceReportTargetStatus,
  ): MobileOperatorServiceReportTargetStatus {
    const expected = DEFAULT_REPORT_TARGET_STATUS_BY_TYPE[tipo];

    if (tipo === MobileOperatorServiceReportType.OTRO) {
      if (!estadoDestino) {
        throw new BadRequestException(
          'estadoDestino es obligatorio cuando el tipo de reporte es OTRO',
        );
      }

      return estadoDestino;
    }

    if (!expected) {
      throw new BadRequestException('tipo de reporte inválido');
    }

    if (estadoDestino && estadoDestino !== expected) {
      throw new BadRequestException(
        `El tipo de reporte ${tipo} solo permite estadoDestino ${expected}`,
      );
    }

    return expected;
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
