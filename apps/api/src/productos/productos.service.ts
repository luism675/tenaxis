import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { CreateProductoDto } from './dto/create-producto.dto';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudStatusDto } from './dto/update-solicitud-status.dto';
import { EstadoSolicitudProductos } from '../generated/client/client';

@Injectable()
export class ProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async findStock(user: JwtPayload) {
    if (!user.tenantId || !user.empresaId) {
      return [];
    }

    return this.prisma.producto.findMany({
      where: {
        tenantId: user.tenantId,
        empresaId: user.empresaId,
      },
      include: {
        proveedor: true,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  async findSolicitudes(user: JwtPayload) {
    if (!user.tenantId || !user.empresaId) {
      return [];
    }

    return this.prisma.productoSolicitado.findMany({
      where: {
        tenantId: user.tenantId,
        empresaId: user.empresaId,
      },
      include: {
        producto: true,
        membership: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findProveedores(user: JwtPayload) {
    if (!user.tenantId || !user.empresaId) {
      return [];
    }

    return this.prisma.proveedores.findMany({
      where: {
        tenantId: user.tenantId,
        empresaId: user.empresaId,
      },
      orderBy: {
        nombre: 'asc',
      },
    });
  }

  async createProducto(user: JwtPayload, dto: CreateProductoDto) {
    if (!user.tenantId || !user.empresaId) {
      throw new ForbiddenException('Tenant and Empresa context required');
    }
    return this.prisma.producto.create({
      data: {
        ...dto,
        tenantId: user.tenantId,
        empresaId: user.empresaId,
      },
    });
  }

  async createSolicitud(user: JwtPayload, dto: CreateSolicitudDto) {
    if (!user.tenantId || !user.empresaId) {
      throw new ForbiddenException('Tenant and Empresa context required');
    }

    const membershipId = dto.membershipId || user.membershipId;
    if (!membershipId) {
      throw new ForbiddenException('Membership context required');
    }

    return this.prisma.productoSolicitado.create({
      data: {
        productoId: dto.productoId,
        cantidad: dto.cantidad,
        unidadMedida: dto.unidadMedida,
        membershipId,
        tenantId: user.tenantId,
        empresaId: user.empresaId,
      },
      include: {
        producto: true,
        membership: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async updateSolicitudStatus(
    id: string,
    user: JwtPayload,
    dto: UpdateSolicitudStatusDto,
  ) {
    if (!user.tenantId || !user.empresaId) {
      throw new ForbiddenException('Tenant and Empresa context required');
    }

    const solicitud = await this.prisma.productoSolicitado.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        empresaId: user.empresaId,
      },
      include: {
        producto: true,
      },
    });

    if (!solicitud) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    // Si se aprueba, intentamos descontar del stock
    if (
      dto.estado === EstadoSolicitudProductos.ACEPTADA &&
      solicitud.estado !== EstadoSolicitudProductos.ACEPTADA
    ) {
      const cantidadNumerica = parseFloat(
        solicitud.cantidad.replace(/[^0-9.]/g, ''),
      );
      if (!isNaN(cantidadNumerica)) {
        await this.prisma.producto.update({
          where: { id: solicitud.productoId },
          data: {
            stockActual: {
              decrement: Math.round(cantidadNumerica),
            },
          },
        });
      }
    }

    return this.prisma.productoSolicitado.update({
      where: { id },
      data: {
        estado: dto.estado,
      },
      include: {
        producto: true,
        membership: {
          include: {
            user: true,
          },
        },
      },
    });
  }
}
