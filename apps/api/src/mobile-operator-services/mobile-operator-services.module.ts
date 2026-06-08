import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdenesServicioModule } from '../ordenes-servicio/ordenes-servicio.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileOperatorServicesController } from './mobile-operator-services.controller';
import { MobileOperatorServicesService } from './mobile-operator-services.service';
import { OperatorServiceScopeGuard } from './guards/operator-service-scope.guard';

@Module({
  imports: [PrismaModule, AuthModule, OrdenesServicioModule],
  controllers: [MobileOperatorServicesController],
  providers: [
    MobileOperatorServicesService,
    JwtAuthGuard,
    OperatorServiceScopeGuard,
  ],
  exports: [MobileOperatorServicesService],
})
export class MobileOperatorServicesModule {}
