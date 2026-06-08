import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdenesServicioController } from './ordenes-servicio.controller';
import { OrdenesServicioService } from './ordenes-servicio.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ContratosClienteModule } from '../contratos-cliente/contratos-cliente.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { OrdenesServicioExportJobsService } from './export-jobs.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    ContratosClienteModule,
    PushNotificationsModule,
    SupabaseModule,
  ],
  controllers: [OrdenesServicioController],
  providers: [OrdenesServicioService, OrdenesServicioExportJobsService],
  exports: [OrdenesServicioService],
})
export class OrdenesServicioModule {}
