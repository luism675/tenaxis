import { Module } from '@nestjs/common';
import { ConfigClientesService } from './config-clientes.service';
import { ConfigClientesController } from './config-clientes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ConfigClientesController],
  providers: [ConfigClientesService],
  exports: [ConfigClientesService],
})
export class ConfigClientesModule {}
