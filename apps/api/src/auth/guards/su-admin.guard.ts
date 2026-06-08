import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwtPayload } from '../jwt-payload.interface';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Injectable()
export class SuAdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('No authorization header found');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('No token found');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const allowedUuids = (
        this.configService.get<string>('ALLOWED_TENANT_ADMINS') || ''
      )
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const isSuAdmin = allowedUuids.includes(payload.sub);

      if (!isSuAdmin) {
        throw new UnauthorizedException('User is not a Super Admin');
      }

      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException(
        'Invalid token or insufficient permissions',
      );
    }
  }
}
