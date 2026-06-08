import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ContratosClienteController } from './contratos-cliente.controller';
import { ContratosClienteService } from './contratos-cliente.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ContratosClienteController],
  providers: [ContratosClienteService],
  exports: [ContratosClienteService],
})
export class ContratosClienteModule {}
