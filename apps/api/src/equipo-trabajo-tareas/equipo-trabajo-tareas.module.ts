import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EquipoTrabajoTareasController } from './equipo-trabajo-tareas.controller';
import { EquipoTrabajoTareasService } from './equipo-trabajo-tareas.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EquipoTrabajoTareasController],
  providers: [EquipoTrabajoTareasService],
})
export class EquipoTrabajoTareasModule {}
