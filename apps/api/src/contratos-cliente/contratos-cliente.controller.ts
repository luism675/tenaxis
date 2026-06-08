import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { ContratosClienteService } from './contratos-cliente.service';
import { CreateContratoClienteDto } from './dto/create-contrato-cliente.dto';
import { UpdateContratoClienteDto } from './dto/update-contrato-cliente.dto';

interface RequestWithUser extends ExpressRequest {
  user: JwtPayload;
}

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ContratosClienteController {
  constructor(
    private readonly contratosClienteService: ContratosClienteService,
  ) {}

  @Get(':clienteId/contratos')
  async listByCliente(
    @Request() req: RequestWithUser,
    @Param('clienteId') clienteId: string,
  ) {
    return this.contratosClienteService.listByCliente(
      req.user.tenantId || '',
      clienteId,
    );
  }

  @Get(':clienteId/contrato-activo')
  async getActiveByCliente(
    @Request() req: RequestWithUser,
    @Param('clienteId') clienteId: string,
    @Query('empresaId') empresaId?: string,
  ) {
    return this.contratosClienteService.getActiveByCliente(
      req.user.tenantId || '',
      clienteId,
      empresaId || req.user.empresaId,
    );
  }

  @Post(':clienteId/contratos')
  async create(
    @Request() req: RequestWithUser,
    @Param('clienteId') clienteId: string,
    @Body() dto: CreateContratoClienteDto,
  ) {
    return this.contratosClienteService.create(
      req.user.tenantId || '',
      clienteId,
      dto,
    );
  }

  @Patch('contratos/:id')
  async update(
    @Request() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContratoClienteDto,
  ) {
    return this.contratosClienteService.update(
      req.user.tenantId || '',
      id,
      dto,
    );
  }
}
