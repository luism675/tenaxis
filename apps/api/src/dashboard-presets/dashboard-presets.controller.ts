import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { DashboardPresetsService } from './dashboard-presets.service';
import {
  CreateDashboardPresetDto,
  ListDashboardPresetsDto,
  UpdateDashboardPresetDto,
} from './dto/dashboard-preset.dto';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('dashboard-presets')
@UseGuards(JwtAuthGuard)
export class DashboardPresetsController {
  constructor(private readonly service: DashboardPresetsService) {}

  @Get()
  list(@Req() req: RequestWithUser, @Query() query: ListDashboardPresetsDto) {
    if (!req.user?.tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return this.service.list(req.user, query.module);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateDashboardPresetDto) {
    if (!req.user?.tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return this.service.create(req.user, dto);
  }

  @Patch(':id')
  update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateDashboardPresetDto,
  ) {
    if (!req.user?.tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return this.service.update(req.user, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: RequestWithUser, @Param('id') id: string) {
    if (!req.user?.tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return this.service.remove(req.user, id);
  }
}
