import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { TenantsModule } from './tenants/tenants.module';
import { PlansModule } from './plans/plans.module';
import { ClientesModule } from './clientes/clientes.module';
import { ConfigClientesModule } from './config-clientes/config-clientes.module';
import { GeoModule } from './geo/geo.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { EnterpriseInterceptor } from './common/interceptors/enterprise.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { OrdenesServicioModule } from './ordenes-servicio/ordenes-servicio.module';
import { SupabaseModule } from './supabase/supabase.module';
import { ContabilidadModule } from './contabilidad/contabilidad.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DashboardPresetsModule } from './dashboard-presets/dashboard-presets.module';
import { ContratosClienteModule } from './contratos-cliente/contratos-cliente.module';
import { ProductosModule } from './productos/productos.module';
import { MobileOperatorDashboardModule } from './mobile-operator-dashboard/mobile-operator-dashboard.module';
import { MobileOperatorProductsModule } from './mobile-operator-products/mobile-operator-products.module';
import { MobileOperatorReferralsModule } from './mobile-operator-referrals/mobile-operator-referrals.module';
import { MobileOperatorServicesModule } from './mobile-operator-services/mobile-operator-services.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { EquipoTrabajoTareasModule } from './equipo-trabajo-tareas/equipo-trabajo-tareas.module';
import { ClientPortalModule } from './client-portal/client-portal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    TenantsModule,
    PlansModule,
    ClientesModule,
    ConfigClientesModule,
    GeoModule,
    EnterpriseModule,
    OrdenesServicioModule,
    SupabaseModule,
    ContabilidadModule,
    MonitoringModule,
    DashboardModule,
    DashboardPresetsModule,
    ContratosClienteModule,
    ProductosModule,
    MobileOperatorDashboardModule,
    MobileOperatorProductsModule,
    MobileOperatorReferralsModule,
    MobileOperatorServicesModule,
    PushNotificationsModule,
    EquipoTrabajoTareasModule,
    ClientPortalModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: EnterpriseInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
