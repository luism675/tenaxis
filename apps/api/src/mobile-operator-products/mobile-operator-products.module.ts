import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileOperatorProductsController } from './mobile-operator-products.controller';
import { MobileOperatorProductsService } from './mobile-operator-products.service';
import { OperatorProductScopeGuard } from './guards/operator-product-scope.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MobileOperatorProductsController],
  providers: [
    MobileOperatorProductsService,
    JwtAuthGuard,
    OperatorProductScopeGuard,
  ],
  exports: [MobileOperatorProductsService],
})
export class MobileOperatorProductsModule {}
