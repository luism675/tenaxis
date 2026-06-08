import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { Request } from 'express';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { Role } from '../../generated/client/client';
import { applyDevRoleOverride } from '../utils/dev-role-override.util';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Injectable()
export class EnterpriseInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const headerEnterpriseId = request.headers['x-enterprise-id'] as
      | string
      | undefined;
    const testRole = request.headers['x-test-role'];

    // Modo desarrollo: Permitir sobreescribir el rol para pruebas
    if (user) {
      applyDevRoleOverride(user, testRole);
    }

    if (!user) {
      return next.handle();
    }

    // Si es Global Super Admin, puede ver cualquier empresa
    if (user.isGlobalSuAdmin) {
      if (headerEnterpriseId) {
        user.empresaId = headerEnterpriseId;
      }
      return next.handle();
    }

    // Si es Tenant Admin o Tenant SU_ADMIN, puede ver cualquier empresa de su tenant
    const isTenantAdmin =
      user.role === Role.SU_ADMIN ||
      user.role === Role.ADMIN ||
      user.role === Role.COORDINADOR;

    if (isTenantAdmin) {
      if (headerEnterpriseId) {
        user.empresaId = headerEnterpriseId;
      }
      return next.handle();
    }

    // Para otros roles (COORDINADOR, ASESOR, OPERADOR), validar contra sus empresaIds
    const allowedIds = user.empresaIds || [];

    if (headerEnterpriseId) {
      if (allowedIds.includes(headerEnterpriseId)) {
        user.empresaId = headerEnterpriseId;
      } else {
        // Si el token es antiguo y no tiene empresaIds, o si cambió en DB,
        // hacemos un fallback a la DB para mayor seguridad y UX
        const membership = await this.prisma.empresaMembership.findFirst({
          where: {
            membershipId: user.membershipId,
            empresaId: headerEnterpriseId,
            activo: true,
            deletedAt: null,
          },
        });

        if (membership) {
          user.empresaId = headerEnterpriseId;
          // Actualizar el array local para el resto de la petición
          if (!user.empresaIds) user.empresaIds = [];
          if (!user.empresaIds.includes(headerEnterpriseId)) {
            user.empresaIds.push(headerEnterpriseId);
          }
        } else {
          console.warn(
            `User ${user.sub} attempted unauthorized access to enterprise ${headerEnterpriseId}`,
          );
          // Opcionalmente podrías limpiar el empresaId si era inválido
          user.empresaId = undefined;
        }
      }
    } else if (allowedIds.length === 1) {
      // Si solo tiene una empresa y no mandó header, se la asignamos por defecto
      user.empresaId = allowedIds[0];
    }

    return next.handle();
  }
}
