import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { Role } from '../../generated/client/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OperatorServiceScope } from '../types/operator-service-scope.type';

interface RequestWithOperatorServiceScope extends Request {
  user?: JwtPayload;
  operatorServiceScope?: OperatorServiceScope;
}

@Injectable()
export class OperatorServiceScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<RequestWithOperatorServiceScope>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    if (user.role !== Role.OPERADOR) {
      throw new UnauthorizedException(
        'Este endpoint solo está disponible para operadores',
      );
    }

    if (!user.tenantId) {
      throw new UnauthorizedException(
        'No se encontró información del conglomerado (tenant)',
      );
    }

    if (!user.membershipId) {
      throw new UnauthorizedException('Membresía no válida para este rol');
    }

    const memberships = await this.prisma.empresaMembership.findMany({
      where: {
        tenantId: user.tenantId,
        membershipId: user.membershipId,
        activo: true,
        deletedAt: null,
        empresa: {
          tenantId: user.tenantId,
        },
      },
      select: {
        empresaId: true,
        zonaId: true,
      },
    });

    if (memberships.length === 0) {
      throw new UnauthorizedException('No tienes empresas vinculadas activas');
    }

    const empresaIds = Array.from(new Set(memberships.map((m) => m.empresaId)));
    const zonaIds = Array.from(
      new Set(
        memberships
          .map((membership) => membership.zonaId)
          .filter((zonaId): zonaId is string => !!zonaId),
      ),
    );

    request.operatorServiceScope = {
      tenantId: user.tenantId,
      membershipId: user.membershipId,
      role: Role.OPERADOR,
      empresaIds,
      ...(zonaIds.length > 0 ? { zonaIds } : {}),
    };

    return true;
  }
}
