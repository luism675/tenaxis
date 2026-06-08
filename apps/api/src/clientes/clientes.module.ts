import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { SugerenciasService } from './sugerencias.service';
import { SugerenciasController } from './sugerencias.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClientesController, SugerenciasController],
  providers: [ClientesService, SugerenciasService],
  exports: [ClientesService, SugerenciasService],
})
export class ClientesModule {}
