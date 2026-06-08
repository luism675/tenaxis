import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetOperatorServiceScope } from '../mobile-operator-services/decorators/get-operator-service-scope.decorator';
import { OperatorServiceScopeGuard } from '../mobile-operator-services/guards/operator-service-scope.guard';
import { OperatorServiceScope } from '../mobile-operator-services/types/operator-service-scope.type';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { PushNotificationsService } from './push-notifications.service';

@Controller('mobile/operator')
@UseGuards(JwtAuthGuard, OperatorServiceScopeGuard)
export class PushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Post('push-token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async registerPushToken(
    @GetOperatorServiceScope() scope: OperatorServiceScope,
    @Body() dto: RegisterPushTokenDto,
  ): Promise<void> {
    await this.pushNotificationsService.registerPushToken({
      tenantId: scope.tenantId,
      membershipId: scope.membershipId,
      pushToken: dto.pushToken,
    });
  }
}
