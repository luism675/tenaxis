import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MonitoringScopeGuard } from './guards/monitoring-scope.guard';
import { GetScope } from './decorators/get-scope.decorator';
import { MonitoringScope } from './types';
import {
  RecordEventDto,
  HeartbeatDto,
  MonitoringPaginationDto,
  MonitoringAuditsQueryDto,
} from './dto/monitoring.dto';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Request as ExpressRequest } from 'express';

interface RequestWithUser extends ExpressRequest {
  user: JwtPayload;
}

@Controller('monitoring')
@UseGuards(JwtAuthGuard, MonitoringScopeGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('sessions')
  async findAllSessions(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.findAllSessions(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Get('stats')
  async getStats(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.getGlobalStats(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Get('alerts')
  async getAlerts(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.getAlerts(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Get('metrics')
  async getMetrics(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.getOperationMetrics(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Get('executive-audit')
  async getExecutiveAudit(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.getExecutiveAuditMetrics(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Get('audits')
  async findAllAudits(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringAuditsQueryDto,
  ) {
    return this.monitoringService.findAllAudits(scope, query);
  }

  @Get('recent-logs')
  async findRecentLogs(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.findRecentLogs(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Get('payroll-preview')
  async getPayrollPreview(
    @GetScope() scope: MonitoringScope,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.getPayrollPreview(
      scope,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Get('logs/:membershipId')
  async getMemberLogs(
    @GetScope() scope: MonitoringScope,
    @Param('membershipId') membershipId: string,
    @Query() query: MonitoringPaginationDto,
  ) {
    return this.monitoringService.getMemberLogs(
      scope,
      membershipId,
      query.date,
      query.startDate,
      query.endDate,
    );
  }

  @Post('event')
  async recordEvent(
    @Request() req: RequestWithUser,
    @Body() dto: RecordEventDto,
  ) {
    if (!req.user.sesionId) {
      throw new UnauthorizedException(
        'No hay una sesión activa vinculada a tu token',
      );
    }
    return this.monitoringService.recordEvent(
      req.user.sesionId,
      dto.tipo,
      dto.descripcion,
      dto.ruta,
    );
  }

  @Post('heartbeat')
  async heartbeat(@Request() req: RequestWithUser, @Body() dto: HeartbeatDto) {
    if (!req.user.sesionId) {
      throw new UnauthorizedException('No hay una sesión activa');
    }

    if (dto.inactiveMinutes && dto.inactiveMinutes > 0) {
      await this.monitoringService.updateInactivityTime(
        req.user.sesionId,
        dto.inactiveMinutes,
      );
    } else {
      await this.monitoringService.refreshSession(req.user.sesionId);
    }

    return { success: true };
  }
}
