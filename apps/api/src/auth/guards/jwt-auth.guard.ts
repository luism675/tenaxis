import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';
import { applyDevRoleOverride } from '../../common/utils/dev-role-override.util';
import { buildMembershipPermissionState } from '../membership-permissions.util';
import { PrismaService } from '../../prisma/prisma.service';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    // 1. Intentar obtener de la cabecera Authorization
    let token = request.headers.authorization?.split(' ')[1];

    // 2. Si no hay cabecera, intentar obtener de las cookies
    if (!token && request.headers.cookie) {
      const cookies = request.headers.cookie.split('; ');
      const authCookie = cookies.find((c) => c.startsWith('access_token='));
      if (authCookie) {
        token = authCookie.split('=')[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException(
        'No se encontró un token de autenticación',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      await this.assertAuthSessionIsActive(payload);
      applyDevRoleOverride(payload, request.headers['x-test-role']);
      const permissionState = buildMembershipPermissionState(
        payload.role,
        payload.granularPermissions,
      );
      payload.granularPermissions = permissionState.granularPermissions;
      payload.permissions = permissionState.permissions;

      request.user = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private async assertAuthSessionIsActive(payload: JwtPayload): Promise<void> {
    if (!payload.authSessionId) {
      return;
    }

    const activeSession = await this.prisma.authSession.findFirst({
      where: {
        id: payload.authSessionId,
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!activeSession) {
      throw new UnauthorizedException('Sesión inválida o revocada');
    }
  }
}
