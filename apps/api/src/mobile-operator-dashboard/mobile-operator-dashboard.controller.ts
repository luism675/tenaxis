import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetOperatorDashboardScope } from './decorators/get-operator-dashboard-scope.decorator';
import { MobileOperatorDashboardService } from './mobile-operator-dashboard.service';
import { OperatorDashboardScopeGuard } from './guards/operator-dashboard-scope.guard';
import { OperatorDashboardScope } from './types/operator-dashboard-scope.type';

@Controller('mobile/operator')
@UseGuards(JwtAuthGuard, OperatorDashboardScopeGuard)
export class MobileOperatorDashboardController {
  constructor(
    private readonly mobileOperatorDashboardService: MobileOperatorDashboardService,
  ) {}

  @Get('dashboard')
  getDashboard(@GetOperatorDashboardScope() scope: OperatorDashboardScope) {
    return this.mobileOperatorDashboardService.getDashboard(scope);
  }
}
