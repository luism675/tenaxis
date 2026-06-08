import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ContabilidadModule } from '../contabilidad/contabilidad.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileOperatorDashboardController } from './mobile-operator-dashboard.controller';
import { MobileOperatorDashboardService } from './mobile-operator-dashboard.service';
import { OperatorDashboardScopeGuard } from './guards/operator-dashboard-scope.guard';

@Module({
  imports: [PrismaModule, AuthModule, ContabilidadModule],
  controllers: [MobileOperatorDashboardController],
  providers: [
    MobileOperatorDashboardService,
    JwtAuthGuard,
    OperatorDashboardScopeGuard,
  ],
  exports: [MobileOperatorDashboardService],
})
export class MobileOperatorDashboardModule {}
