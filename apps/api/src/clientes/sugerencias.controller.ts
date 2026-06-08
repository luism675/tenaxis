import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Request,
  UseGuards,
  Post,
} from '@nestjs/common';
import { SugerenciasService } from './sugerencias.service';
import { EstadoSugerencia } from '../generated/client/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Request as ExpressRequest } from 'express';
import { QuerySugerenciasDto } from './dto/query-sugerencias.dto';
import { Query } from '@nestjs/common';

interface RequestWithUser extends ExpressRequest {
  user: JwtPayload;
}

@Controller('sugerencias-clientes')
@UseGuards(JwtAuthGuard)
export class SugerenciasController {
  constructor(private readonly sugerenciasService: SugerenciasService) {}

  @Get()
  async findAll(
    @Request() req: RequestWithUser,
    @Query() query: QuerySugerenciasDto,
  ) {
    const tenantId = req.user.tenantId || '';
    const empresaId = req.user.empresaId;
    return this.sugerenciasService.findAll(tenantId, empresaId, query);
  }

  @Get('stats')
  async getQuickStats(@Request() req: RequestWithUser) {
    const tenantId = req.user.tenantId || '';
    const empresaId = req.user.empresaId;
    return this.sugerenciasService.getQuickStats(tenantId, empresaId);
  }

  @Patch(':id/estado')
  async updateEstado(
    @Request() req: RequestWithUser,
    @Param('id') id: string,
    @Body('estado') estado: EstadoSugerencia,
  ) {
    const tenantId = req.user.tenantId || '';
    return this.sugerenciasService.updateEstado(id, tenantId, estado);
  }

  @Post('trigger-job')
  async triggerJob() {
    // Solo para pruebas manuales o admins
    return this.sugerenciasService.generateDailySugerencias();
  }
}
