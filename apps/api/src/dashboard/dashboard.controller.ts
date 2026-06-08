import {
  Controller,
  Get,
  UseGuards,
  Request,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { resolveScopedEmpresaId } from '../common/utils/access-control.util';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(
    @Request() req: RequestWithUser,
    @Query('empresaId') empresaId?: string,
  ) {
    if (!req.user.tenantId && !req.user.isGlobalSuAdmin) {
      throw new UnauthorizedException('No perteneces a ningún conglomerado');
    }

    const targetEmpresaId = resolveScopedEmpresaId(req.user, empresaId);
    const targetTenantId = req.user.isGlobalSuAdmin
      ? undefined
      : req.user.tenantId;

    return this.dashboardService.getStats(targetTenantId, targetEmpresaId);
  }
}
