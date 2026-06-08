import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { Request } from 'express';
import { Prisma } from '../../generated/client/client';

interface AuditRequest extends Request {
  user?: JwtPayload;
  body: Record<string, unknown>;
  params: Record<string, string>;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const { method, url, user } = request;

    const methodsToAudit = ['POST', 'PATCH', 'PUT', 'DELETE'];
    if (!methodsToAudit.includes(method) || !user) {
      return next.handle();
    }

    if (url.includes('/monitoring') || url.includes('/auth/login')) {
      return next.handle();
    }

    // Mapeo de nombres legibles
    const actionMap: Record<string, string> = {
      POST: 'CREACIÓN',
      PATCH: 'ACTUALIZACIÓN',
      PUT: 'ACTUALIZACIÓN',
      DELETE: 'ELIMINACIÓN',
    };

    const actionLabel = actionMap[method] || method;

    return next.handle().pipe(
      tap((response: unknown) => {
        void this.createAuditRecord(request, response, 'SUCCESS', actionLabel);
      }),
      catchError((error: unknown) => {
        void this.createAuditRecord(request, error, 'FAILED', actionLabel);
        return throwError(() => error);
      }),
    );
  }

  private async createAuditRecord(
    request: AuditRequest,
    result: unknown,
    status: string,
    actionLabel: string,
  ): Promise<void> {
    try {
      const { method, url, body, user, params } = request;
      if (!user?.tenantId) return;

      const urlParts = url.split('/').filter((p: string) => p && p !== 'api');
      const entidad = urlParts[0]?.toUpperCase() || 'SYSTEM';

      const bodyId =
        body && typeof body === 'object' && 'id' in body
          ? String(body.id)
          : undefined;
      const paramId = params && 'id' in params ? String(params.id) : undefined;
      const membershipId =
        params && 'membershipId' in params
          ? String(params.membershipId)
          : undefined;

      const entidadId = bodyId || paramId || membershipId || 'N/A';

      // Intentar obtener el valor anterior si es UPDATE o DELETE
      let valorAnterior: unknown = null;
      if (
        (method === 'PATCH' || method === 'PUT' || method === 'DELETE') &&
        entidadId !== 'N/A'
      ) {
        try {
          const modelName = this.getPrismaModelName(entidad);
          if (modelName) {
            // Safe access to prisma models
            const prismaRecord = this.prisma as unknown as Record<
              string,
              {
                findUnique: (args: {
                  where: { id: string };
                }) => Promise<unknown>;
              }
            >;
            const model = prismaRecord[modelName];
            if (model) {
              valorAnterior = await model.findUnique({
                where: { id: entidadId },
              });
            }
          }
        } catch {
          // Silencioso si no se puede obtener el anterior
        }
      }

      const sanitizedBody = this.sanitizeData(body);
      const sanitizedPrevious = this.sanitizeData(valorAnterior);
      const sanitizedResult =
        status === 'FAILED'
          ? { error: String(result) }
          : this.sanitizeData(result);

      await this.prisma.auditoria.create({
        data: {
          tenantId: user.tenantId,
          membershipId: user.membershipId || undefined,
          empresaId: user.empresaId || undefined,
          accion: `${actionLabel}_${status}`,
          entidad: entidad,
          entidadId: String(entidadId),
          detalles: {
            anterior: sanitizedPrevious ?? Prisma.DbNull,
            nuevo:
              method === 'DELETE'
                ? Prisma.DbNull
                : (sanitizedBody ?? Prisma.DbNull),
            resultado: sanitizedResult ?? Prisma.DbNull,
          } as Prisma.InputJsonObject,
          metadata: {
            path: url,
            method: method,
            status: status,
            ip: String(
              request.ip || request.headers['x-forwarded-for'] || 'unknown',
            ),
            userAgent: String(request.headers['user-agent'] || 'unknown'),
          } as Prisma.InputJsonObject,
        },
      });
    } catch (e) {
      console.error('Error creating audit record:', e);
    }
  }

  private getPrismaModelName(entidad: string): string | null {
    const map: Record<string, string> = {
      CLIENTES: 'cliente',
      SERVICIOS: 'servicio',
      EMPRESAS: 'empresa',
      'ORDENES-SERVICIO': 'ordenServicio',
      USUARIOS: 'user',
      TENANTS: 'tenant',
    };
    return map[entidad] || null;
  }

  private sanitizeData(
    data: unknown,
  ): Record<string, Prisma.InputJsonValue> | null {
    if (!data || typeof data !== 'object') return null;

    const sanitized = { ...(data as Record<string, Prisma.InputJsonValue>) };
    const sensitiveFields = [
      'password',
      'token',
      'access_token',
      'secret',
      'createdAt',
      'updatedAt',
      'deletedAt',
      'tenantId',
    ];

    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        delete sanitized[field];
      }
    });

    return sanitized;
  }
}
