import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { MobileOperatorReferralsController } from './mobile-operator-referrals.controller';
import { PublicReferralsController } from './public-referrals.controller';
import { MobileOperatorReferralsService } from './mobile-operator-referrals.service';
import { OperatorReferralScopeGuard } from './guards/operator-referral-scope.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MobileOperatorReferralsController, PublicReferralsController],
  providers: [
    MobileOperatorReferralsService,
    JwtAuthGuard,
    OperatorReferralScopeGuard,
  ],
  exports: [MobileOperatorReferralsService],
})
export class MobileOperatorReferralsModule {}
