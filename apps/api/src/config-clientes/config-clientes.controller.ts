import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ConfigClientesService } from './config-clientes.service';
import { CreateTipoInteresDto, UpdateTipoInteresDto } from './dto/interes.dto';
import { CreateServicioDto, UpdateServicioDto } from './dto/servicio.dto';
import { UpsertClienteConfigDto } from './dto/cliente-config.dto';
import {
  QueryPicoPlacaRestriccionesDto,
  UpsertPicoPlacaDto,
} from './dto/pico-placa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Request as ExpressRequest } from 'express';

interface RequestWithUser extends ExpressRequest {
  user: JwtPayload;
}

@Controller('config-clientes')
@UseGuards(JwtAuthGuard)
export class ConfigClientesController {
  constructor(private readonly configService: ConfigClientesService) {}

  // --- ConfiguraciÃ³n Operativa de Clientes ---
  @Get('operativa/:clienteId')
  async findAllClienteConfigs(
    @Request() req: RequestWithUser,
    @Param('clienteId') clienteId: string,
  ) {
    return this.configService.findAllClienteConfigs(
      req.user.tenantId || '',
      clienteId,
    );
  }

  @Get('operativa/:clienteId/especifica')
  async findClienteConfig(
    @Request() req: RequestWithUser,
    @Param('clienteId') clienteId: string,
    @Query('empresaId') empresaId: string,
    @Query('direccionId') direccionId?: string,
  ) {
    const effectiveEmpresaId = empresaId || req.user.empresaId || '';

    return this.configService.findClienteConfig(
      req.user.tenantId || '',
      clienteId,
      effectiveEmpresaId,
      direccionId,
    );
  }

  @Post('operativa')
  async upsertClienteConfig(
    @Request() req: RequestWithUser,
    @Body() dto: UpsertClienteConfigDto,
  ) {
    return this.configService.upsertClienteConfig(req.user.tenantId || '', dto);
  }

  // --- Segmentos ---
  @Get('segmentos')
  findAllSegmentos(@Request() req: RequestWithUser) {
    return this.configService.findAllSegmentos(req.user.tenantId || '');
  }

  // --- Riesgos ---
  @Get('riesgos')
  findAllRiesgos(@Request() req: RequestWithUser) {
    return this.configService.findAllRiesgos(req.user.tenantId || '');
  }

  // --- Tipos de Interés ---
  @Get('intereses')
  async findAllTiposInteres(@Request() req: RequestWithUser) {
    return this.configService.findAllTiposInteres(req.user.tenantId || '');
  }

  @Post('intereses')
  async createTipoInteres(
    @Request() req: RequestWithUser,
    @Body() dto: CreateTipoInteresDto,
  ) {
    return this.configService.createTipoInteres(req.user.tenantId || '', dto);
  }

  @Patch('intereses/:id')
  async updateTipoInteres(
    @Param('id') id: string,
    @Body() dto: UpdateTipoInteresDto,
  ) {
    return this.configService.updateTipoInteres(id, dto);
  }

  // --- Servicios ---
  @Get('servicios')
  async findAllServicios(
    @Request() req: RequestWithUser,
    @Query('empresaId') empresaId?: string,
  ) {
    const effectiveEmpresaId = empresaId || req.user.empresaId || '';

    return this.configService.findAllServicios(
      req.user.tenantId || '',
      effectiveEmpresaId,
    );
  }

  @Post('servicios')
  async createServicio(
    @Request() req: RequestWithUser,
    @Body() dto: CreateServicioDto,
  ) {
    return this.configService.createServicio(req.user.tenantId || '', dto);
  }

  @Patch('servicios/:id')
  async updateServicio(
    @Param('id') id: string,
    @Body() dto: UpdateServicioDto,
  ) {
    return this.configService.updateServicio(id, dto);
  }

  @Delete('servicios/:id')
  async deleteServicio(@Param('id') id: string) {
    return this.configService.deleteServicio(id);
  }

  // --- Tipos de Servicio ---
  @Get('tipos-servicio')
  async findAllTiposServicio(
    @Request() req: RequestWithUser,
    @Query('empresaId') empresaId: string,
  ) {
    const effectiveEmpresaId = empresaId || req.user.empresaId || '';

    return this.configService.findAllTiposServicio(
      req.user.tenantId || '',
      effectiveEmpresaId,
    );
  }

  // --- Métodos de Pago ---
  @Get('metodos-pago')
  async findAllMetodosPago(
    @Request() req: RequestWithUser,
    @Query('empresaId') empresaId: string,
  ) {
    const effectiveEmpresaId = empresaId || req.user.empresaId || '';

    return this.configService.findAllMetodosPago(
      req.user.tenantId || '',
      effectiveEmpresaId,
    );
  }

  // --- Estados de Servicio ---
  @Get('estados-servicio')
  async findAllEstadosServicio(
    @Request() req: RequestWithUser,
    @Query('empresaId') empresaId: string,
  ) {
    const effectiveEmpresaId = empresaId || req.user.empresaId || '';

    return this.configService.findAllEstadosServicio(
      req.user.tenantId || '',
      effectiveEmpresaId,
    );
  }

  // --- Pico y Placa ---
  @Get('pico-placa')
  async findPicoPlaca(
    @Request() req: RequestWithUser,
    @Query('empresaId') empresaId: string,
  ) {
    const effectiveEmpresaId = empresaId || req.user.empresaId || '';

    return this.configService.findPicoPlaca(
      req.user.tenantId || '',
      effectiveEmpresaId,
    );
  }

  @Get('pico-placa/restricciones')
  async findPicoPlacaRestrictions(
    @Request() req: RequestWithUser,
    @Query() query: QueryPicoPlacaRestriccionesDto,
  ) {
    return this.configService.findPicoPlacaRestrictions(
      req.user.tenantId || '',
      { ...query, empresaId: query.empresaId || req.user.empresaId || '' },
    );
  }

  @Put('pico-placa/:empresaId')
  async upsertPicoPlaca(
    @Request() req: RequestWithUser,
    @Param('empresaId') empresaId: string,
    @Body() dto: UpsertPicoPlacaDto,
  ) {
    return this.configService.upsertPicoPlaca(
      req.user.tenantId || '',
      empresaId,
      dto,
    );
  }
}
