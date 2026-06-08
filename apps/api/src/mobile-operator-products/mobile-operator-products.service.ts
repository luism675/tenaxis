import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoSolicitudProductos } from '../generated/client/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMobileOperatorProductRequestDto } from './dto/create-mobile-operator-product-request.dto';
import {
  MobileOperatorProductItemDto,
  MobileOperatorProductListResponseDto,
} from './dto/get-mobile-operator-product-list-response.dto';
import {
  MobileOperatorProductRequestItemDto,
  MobileOperatorProductRequestListResponseDto,
} from './dto/get-mobile-operator-product-request-list-response.dto';
import { MobileOperatorProductRequestStatsResponseDto } from './dto/get-mobile-operator-product-request-stats-response.dto';
import { OperatorProductScope } from './types/operator-product-scope.type';

@Injectable()
export class MobileOperatorProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(
    scope: OperatorProductScope,
  ): Promise<MobileOperatorProductListResponseDto> {
    const rows = await this.prisma.producto.findMany({
      where: {
        tenantId: scope.tenantId,
        empresaId: {
          in: scope.empresaIds,
        },
        activo: true,
      },
      orderBy: {
        nombre: 'asc',
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        categoria: true,
        unidadMedida: true,
        precio: true,
        moneda: true,
        stockActual: true,
        stockMinimo: true,
        activo: true,
        proveedor: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
    });

    return rows.map(
      (row): MobileOperatorProductItemDto => ({
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion ?? null,
        categoria: row.categoria ?? null,
        unidadMedida: row.unidadMedida ?? null,
        precio: row.precio?.toString() ?? null,
        moneda: row.moneda ?? null,
        stockActual: row.stockActual ?? null,
        stockMinimo: row.stockMinimo ?? null,
        activo: row.activo,
        proveedor: row.proveedor
          ? {
              id: row.proveedor.id,
              nombre: row.proveedor.nombre,
            }
          : null,
      }),
    );
  }

  async createProductRequest(
    scope: OperatorProductScope,
    dto: CreateMobileOperatorProductRequestDto,
  ) {
    const producto = await this.prisma.producto.findFirst({
      where: {
        id: dto.productoId,
        tenantId: scope.tenantId,
        empresaId: {
          in: scope.empresaIds,
        },
        activo: true,
      },
      select: {
        id: true,
        empresaId: true,
        unidadMedida: true,
      },
    });

    if (!producto) {
      throw new NotFoundException('Producto no encontrado o no disponible');
    }

    const cantidad = dto.cantidad.trim();
    if (!cantidad) {
      throw new BadRequestException('La cantidad es obligatoria');
    }

    return this.prisma.productoSolicitado.create({
      data: {
        tenantId: scope.tenantId,
        empresaId: producto.empresaId,
        membershipId: scope.membershipId,
        productoId: producto.id,
        cantidad,
        unidadMedida: dto.unidadMedida?.trim() || producto.unidadMedida || null,
        estado: EstadoSolicitudProductos.PENDIENTE,
      },
      select: {
        id: true,
        productoId: true,
        cantidad: true,
        unidadMedida: true,
        estado: true,
        createdAt: true,
        producto: {
          select: {
            id: true,
            nombre: true,
            categoria: true,
            unidadMedida: true,
          },
        },
      },
    });
  }

  async listProductRequests(
    scope: OperatorProductScope,
  ): Promise<MobileOperatorProductRequestListResponseDto> {
    const rows = await this.prisma.productoSolicitado.findMany({
      where: {
        tenantId: scope.tenantId,
        membershipId: scope.membershipId,
        empresaId: {
          in: scope.empresaIds,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        productoId: true,
        cantidad: true,
        unidadMedida: true,
        estado: true,
        createdAt: true,
        producto: {
          select: {
            id: true,
            nombre: true,
            categoria: true,
            unidadMedida: true,
          },
        },
      },
    });

    return rows.map(
      (row): MobileOperatorProductRequestItemDto => ({
        id: row.id,
        productoId: row.productoId,
        cantidad: row.cantidad,
        unidadMedida: row.unidadMedida ?? null,
        estado: row.estado,
        createdAt: row.createdAt,
        producto: {
          id: row.producto.id,
          nombre: row.producto.nombre,
          categoria: row.producto.categoria ?? null,
          unidadMedida: row.producto.unidadMedida ?? null,
        },
      }),
    );
  }

  async getProductRequestStats(
    scope: OperatorProductScope,
  ): Promise<MobileOperatorProductRequestStatsResponseDto> {
    const rows = await this.prisma.productoSolicitado.groupBy({
      by: ['estado'],
      where: {
        tenantId: scope.tenantId,
        membershipId: scope.membershipId,
        empresaId: {
          in: scope.empresaIds,
        },
      },
      _count: {
        _all: true,
      },
    });

    return rows.reduce<MobileOperatorProductRequestStatsResponseDto>(
      (acc, row) => {
        switch (row.estado) {
          case EstadoSolicitudProductos.PENDIENTE:
            acc.pendientes = row._count._all;
            break;
          case EstadoSolicitudProductos.ACEPTADA:
            acc.aceptadas = row._count._all;
            break;
          case EstadoSolicitudProductos.RECHAZADA:
            acc.rechazadas = row._count._all;
            break;
        }

        return acc;
      },
      {
        pendientes: 0,
        aceptadas: 0,
        rechazadas: 0,
      },
    );
  }
}
