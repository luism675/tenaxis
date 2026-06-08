import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { GetOperatorServiceScope } from './decorators/get-operator-service-scope.decorator';
import { CreateMobileOperatorServiceSignedUploadUrlDto } from './dto/create-mobile-operator-service-signed-upload-url.dto';
import { FinishMobileOperatorServiceDto } from './dto/finish-mobile-operator-service.dto';
import { GetMobileOperatorServicesQueryDto } from './dto/get-mobile-operator-services-query.dto';
import { RegisterMobileOperatorServiceArrivalDto } from './dto/register-mobile-operator-service-arrival.dto';
import { ReportMobileOperatorServiceDto } from './dto/report-mobile-operator-service.dto';
import { OperatorServiceScopeGuard } from './guards/operator-service-scope.guard';
import { MobileOperatorServicesService } from './mobile-operator-services.service';
import { OperatorServiceScope } from './types/operator-service-scope.type';

interface RequestWithUser extends Request {
  user?: JwtPayload;
}

@Controller('mobile/operator')
@UseGuards(JwtAuthGuard, OperatorServiceScopeGuard)
export class MobileOperatorServicesController {
  constructor(
    private readonly mobileOperatorServicesService: MobileOperatorServicesService,
  ) {}

  @Get('services')
  listServices(
    @GetOperatorServiceScope() scope: OperatorServiceScope,
    @Query() query: GetMobileOperatorServicesQueryDto,
  ) {
    return this.mobileOperatorServicesService.listServices(scope, query);
  }

  @Get('services/:id')
  getServiceDetail(
    @GetOperatorServiceScope() scope: OperatorServiceScope,
    @Param('id') id: string,
  ) {
    return this.mobileOperatorServicesService.getServiceDetail(scope, id);
  }

  @Post('services/:id/uploads/signed-url')
  createSignedUploadUrl(
    @GetOperatorServiceScope() scope: OperatorServiceScope,
    @Param('id') id: string,
    @Body() dto: CreateMobileOperatorServiceSignedUploadUrlDto,
  ) {
    return this.mobileOperatorServicesService.createSignedUploadUrl(
      scope,
      id,
      dto,
    );
  }

  @Post('services/:id/arrival')
  registerArrival(
    @Req() req: RequestWithUser,
    @GetOperatorServiceScope() scope: OperatorServiceScope,
    @Param('id') id: string,
    @Body() dto: RegisterMobileOperatorServiceArrivalDto,
  ) {
    return this.mobileOperatorServicesService.registerArrival(
      req.user!,
      scope,
      id,
      dto,
    );
  }

  @Post('services/:id/finish')
  finishService(
    @Req() req: RequestWithUser,
    @GetOperatorServiceScope() scope: OperatorServiceScope,
    @Param('id') id: string,
    @Body() dto: FinishMobileOperatorServiceDto,
  ) {
    return this.mobileOperatorServicesService.finishService(
      req.user!,
      scope,
      id,
      dto,
    );
  }

  @Post('services/:id/report')
  reportService(
    @Req() req: RequestWithUser,
    @GetOperatorServiceScope() scope: OperatorServiceScope,
    @Param('id') id: string,
    @Body() dto: ReportMobileOperatorServiceDto,
  ) {
    return this.mobileOperatorServicesService.reportService(
      req.user!,
      scope,
      id,
      dto,
    );
  }
}
