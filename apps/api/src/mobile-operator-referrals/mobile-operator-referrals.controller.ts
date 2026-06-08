import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetOperatorReferralScope } from './decorators/get-operator-referral-scope.decorator';
import { MobileOperatorReferralsService } from './mobile-operator-referrals.service';
import { OperatorReferralScopeGuard } from './guards/operator-referral-scope.guard';
import { OperatorReferralScope } from './types/operator-referral-scope.type';

@Controller('mobile/operator/referrals')
@UseGuards(JwtAuthGuard, OperatorReferralScopeGuard)
export class MobileOperatorReferralsController {
  constructor(
    private readonly mobileOperatorReferralsService: MobileOperatorReferralsService,
  ) {}

  @Get()
  list(@GetOperatorReferralScope() scope: OperatorReferralScope) {
    return this.mobileOperatorReferralsService.list(scope);
  }

  @Get('stats')
  getStats(@GetOperatorReferralScope() scope: OperatorReferralScope) {
    return this.mobileOperatorReferralsService.getStats(scope);
  }

  @Get('me')
  getMe(@GetOperatorReferralScope() scope: OperatorReferralScope) {
    return this.mobileOperatorReferralsService.getMe(scope);
  }
}
