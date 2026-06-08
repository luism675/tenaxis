import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DashboardPresetsController } from './dashboard-presets.controller';
import { DashboardPresetsService } from './dashboard-presets.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [DashboardPresetsController],
  providers: [DashboardPresetsService],
})
export class DashboardPresetsModule {}
