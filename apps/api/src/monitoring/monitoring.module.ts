import { Module, forwardRef } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MonitoringScopeGuard } from './guards/monitoring-scope.guard';

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringScopeGuard],
  exports: [MonitoringService],
})
export class MonitoringModule {}
