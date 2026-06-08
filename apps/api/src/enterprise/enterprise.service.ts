import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '../generated/client/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from './dto/update-enterprise.dto';
import { Role } from '../generated/client/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { getPrismaAccessFilter } from '../common/utils/access-control.util';
import { resolveScopedEmpresaId } from '../common/utils/access-control.util';

@Injectable()
export class EnterpriseService {
  constructor(private readonly prisma: PrismaService) {}

  private buildEnterpriseWhere(
    user: JwtPayload,
    requestedEmpresaId?: string,
  ): Prisma.EmpresaWhereInput {
    const accessFilter = getPrismaAccessFilter(user, requestedEmpresaId);
    const where: Prisma.EmpresaWhereInput = {
      deletedAt: null,
    };

    if (accessFilter.tenantId) {
      where.tenantId = accessFilter.tenantId;
    }

    if (requestedEmpresaId) {
      where.id = resolveScopedEmpresaId(user, requestedEmpresaId);
    } else if (accessFilter.empresaId) {
      where.id =
        typeof accessFilter.empresaId === 'string'
          ? accessFilter.empresaId
          : { in: accessFilter.empresaId.in };
    }

    if (accessFilter.zonaIds?.length) {
      where.zonas = {
        some: {
          id: { in: accessFilter.zonaIds },
        },
      };
    }

    return where;
  }

  private buildEnterpriseMembershipWhere(
    user: JwtPayload,
    empresaId?: string,
  ): Prisma.EmpresaMembershipWhereInput {
    const accessFilter = getPrismaAccessFilter(user, empresaId);
    const where: Prisma.EmpresaMembershipWhereInput = {
      activo: true,
      deletedAt: null,
      membership: {
        role: Role.OPERADOR,
        activo: true,
      },
    };

    if (empresaId) {
      where.empresaId = resolveScopedEmpresaId(user, empresaId);
    } else if (accessFilter.empresaId) {
      where.empresaId =
        typeof accessFilter.empresaId === 'string'
          ? accessFilter.empresaId
          : { in: accessFilter.empresaId.in };
    }

    if (accessFilter.tenantId) {
      where.tenantId = accessFilter.tenantId;
    }

    if (accessFilter.zonaIds?.length) {
      where.zonaId = { in: accessFilter.zonaIds };
    }

    return where;
  }

  async create(createEnterpriseDto: CreateEnterpriseDto, user: JwtPayload) {
    const { sub: userId, tenantId, role, isGlobalSuAdmin } = user;

    if (!tenantId && !isGlobalSuAdmin) {
      throw new BadRequestException('Tenant ID is required.');
    }

    const effectiveTenantId = tenantId || createEnterpriseDto.tenantId;
    if (!effectiveTenantId) {
      throw new BadRequestException('Target Tenant ID is required.');
    }

    // Check permissions
    if (!isGlobalSuAdmin) {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: { userId_tenantId: { userId, tenantId: effectiveTenantId } },
      });

      if (!membership || membership.status !== 'ACTIVE') {
        throw new ForbiddenException(
          'User is not an active member of this tenant.',
        );
      }

      if (role !== Role.SU_ADMIN && role !== Role.ADMIN) {
        throw new ForbiddenException('Only admins can create new enterprises.');
      }
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: effectiveTenantId },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new ForbiddenException('Tenant not found.');
    }

    if (tenant.subscription?.status !== 'ACTIVE') {
      throw new UnprocessableEntityException(
        'Tenant does not have an active subscription.',
      );
    }

    if (!tenant.subscription.plan) {
      throw new UnprocessableEntityException(
        'Tenant does not have a plan associated with the subscription.',
      );
    }

    const maxEmpresas = tenant.subscription.plan.maxEmpresas;
    const currentEmpresas = await this.prisma.empresa.count({
      where: {
        tenantId: effectiveTenantId,
        deletedAt: null,
      },
    });

    if (currentEmpresas >= maxEmpresas) {
      throw new UnprocessableEntityException(
        'Maximum number of enterprises for the current plan has been reached.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          nombre: createEnterpriseDto.nombre,
          activo: createEnterpriseDto.activo ?? true,
          tenant: {
            connect: { id: effectiveTenantId },
          },
        },
      });

      // Si no es Global SU_ADMIN, vincular automáticamente al creador
      if (user.membershipId) {
        await tx.empresaMembership.create({
          data: {
            tenant: { connect: { id: effectiveTenantId } },
            empresa: { connect: { id: empresa.id } },
            membership: { connect: { id: user.membershipId } },
            role: Role.ADMIN,
            activo: true,
          },
        });
      }

      // Seed base data...
      const defaultStatuses = [
        'PROGRAMADO',
        'EN PROCESO',
        'FINALIZADO',
        'CANCELADO',
      ];
      await tx.estadoServicio.createMany({
        data: defaultStatuses.map((nombre) => ({
          nombre,
          tenantId: effectiveTenantId,
          empresaId: empresa.id,
          activo: true,
        })),
      });

      const defaultPayments = ['EFECTIVO', 'TRANSFERENCIA', 'QR', 'TARJETA'];
      await tx.metodoPago.createMany({
        data: defaultPayments.map((nombre) => ({
          nombre,
          tenantId: effectiveTenantId,
          empresaId: empresa.id,
          activo: true,
        })),
      });

      return empresa;
    });
  }

  async findAll(user: JwtPayload) {
    let maxEmpresas = 0;
    if (user.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        include: { subscription: { include: { plan: true } } },
      });
      maxEmpresas = tenant?.subscription?.plan?.maxEmpresas || 0;
    }

    const enterprises = await this.prisma.empresa.findMany({
      where: this.buildEnterpriseWhere(user),
      include: {
        tenant: user.isGlobalSuAdmin,
      },
    });

    return {
      items: enterprises,
      maxEmpresas,
      count: enterprises.length,
    };
  }

  async findOperators(user: JwtPayload, empresaId?: string) {
    const operators = await this.prisma.empresaMembership.findMany({
      where: this.buildEnterpriseMembershipWhere(user, empresaId),
      include: {
        membership: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
              },
            },
          },
        },
      },
    });

    return operators.map((om) => ({
      id: om.membership.id,
      nombre: `${om.membership.user.nombre} ${om.membership.user.apellido}`,
      email: om.membership.user.email,
      telefono: om.membership.user.telefono,
    }));
  }

  async update(
    enterpriseId: string,
    updateEnterpriseDto: UpdateEnterpriseDto,
    user: JwtPayload,
  ) {
    // Solo ADMIN o SU_ADMIN del tenant o Global SU_ADMIN pueden editar
    if (
      !user.isGlobalSuAdmin &&
      user.role !== Role.SU_ADMIN &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException('No tienes permisos para editar empresas.');
    }

    const enterprise = await this.prisma.empresa.findFirst({
      where: this.buildEnterpriseWhere(user, enterpriseId),
    });

    if (!enterprise) {
      throw new NotFoundException('Empresa no encontrada o sin acceso.');
    }

    return this.prisma.empresa.update({
      where: { id: enterpriseId },
      data: { ...updateEnterpriseDto },
    });
  }

  async remove(enterpriseId: string, user: JwtPayload) {
    if (
      !user.isGlobalSuAdmin &&
      user.role !== Role.SU_ADMIN &&
      user.role !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        'No tienes permisos para eliminar empresas.',
      );
    }

    const enterprise = await this.prisma.empresa.findFirst({
      where: this.buildEnterpriseWhere(user, enterpriseId),
    });

    if (!enterprise) {
      throw new NotFoundException('Empresa no encontrada o sin acceso.');
    }

    return this.prisma.empresa.update({
      where: { id: enterpriseId },
      data: {
        deletedAt: new Date(),
        activo: false,
      },
    });
  }
}
