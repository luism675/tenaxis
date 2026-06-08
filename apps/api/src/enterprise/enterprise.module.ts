import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EnterpriseController } from './enterprise.controller';
import { EnterpriseService } from './enterprise.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EnterpriseController],
  providers: [EnterpriseService],
})
export class EnterpriseModule {}
