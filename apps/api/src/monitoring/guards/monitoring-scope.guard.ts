import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MonitoringScope } from '../types';
import { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { resolveAccessScopeMode } from '../../common/utils/access-control.util';

interface RequestWithMonitoring extends Request {
  user: JwtPayload;
  monitoringScope?: MonitoringScope;
}

@Injectable()
export class MonitoringScopeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithMonitoring>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Usuario no autenticado');
    }

    const { membershipId } = user;
    const accessScope = resolveAccessScopeMode(user);
    const scope: MonitoringScope = {
      role: user.role,
      membershipId,
      ...(!accessScope.isGlobalSuAdmin && accessScope.tenantId
        ? { tenantId: accessScope.tenantId }
        : {}),
      ...(accessScope.isGlobalSuAdmin ? { isGlobalSuAdmin: true } : {}),
    };

    if (accessScope.isGlobalSuAdmin) {
      request.monitoringScope = scope;
      return true;
    }

    if (!accessScope.tenantId) {
      throw new UnauthorizedException(
        'No se encontró información del conglomerado (tenant)',
      );
    }

    if (accessScope.hasTenantWideAccess) {
      request.monitoringScope = scope;
      return true;
    }

    if (!membershipId) {
      throw new UnauthorizedException('Membresía no válida para este rol');
    }

    const memberships = await this.prisma.empresaMembership.findMany({
      where: {
        membershipId,
        activo: true,
        deletedAt: null,
        empresa: {
          tenantId: accessScope.tenantId,
        },
      },
      select: {
        empresaId: true,
        zonaId: true,
      },
    });

    if (memberships.length === 0) {
      // Si es OPERADOR sin empresa vinculada, solo puede ver sus propios datos?
      // Por ahora restringimos si no hay vinculación explícita
      throw new UnauthorizedException('No tienes empresas vinculadas activas');
    }

    scope.empresaIds = memberships.map((m) => m.empresaId);

    // Si tiene zonaId en sus vinculaciones, aplicamos filtro por zona
    const zonaIds = memberships
      .map((m) => m.zonaId)
      .filter((id) => !!id) as string[];
    if (zonaIds.length > 0) {
      scope.zonaIds = zonaIds;
    }

    request.monitoringScope = scope;
    return true;
  }
}
