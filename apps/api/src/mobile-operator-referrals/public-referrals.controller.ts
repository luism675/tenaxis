import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePublicReferralDto } from './dto/create-public-referral.dto';
import { MobileOperatorReferralsService } from './mobile-operator-referrals.service';

@Controller('public/referrals')
export class PublicReferralsController {
  constructor(
    private readonly mobileOperatorReferralsService: MobileOperatorReferralsService,
  ) {}

  @Get(':code')
  resolveCode(@Param('code') code: string) {
    return this.mobileOperatorReferralsService.resolvePublicCode(code);
  }

  @Post()
  createReferral(@Body() dto: CreatePublicReferralDto) {
    return this.mobileOperatorReferralsService.createPublicReferral(dto);
  }
}
