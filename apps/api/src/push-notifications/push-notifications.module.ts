import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OperatorServiceScopeGuard } from '../mobile-operator-services/guards/operator-service-scope.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PushNotificationsController],
  providers: [
    PushNotificationsService,
    JwtAuthGuard,
    OperatorServiceScopeGuard,
  ],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
