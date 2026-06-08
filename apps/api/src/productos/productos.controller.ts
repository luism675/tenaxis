import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ProductosService } from './productos.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Request as ExpressRequest } from 'express';
import { CreateProductoDto } from './dto/create-producto.dto';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateSolicitudStatusDto } from './dto/update-solicitud-status.dto';

interface RequestWithUser extends ExpressRequest {
  user: JwtPayload;
}

@Controller('productos')
@UseGuards(JwtAuthGuard)
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get('stock')
  async getStock(@Request() req: RequestWithUser) {
    return this.productosService.findStock(req.user);
  }

  @Get('solicitudes')
  async getSolicitudes(@Request() req: RequestWithUser) {
    return this.productosService.findSolicitudes(req.user);
  }

  @Get('proveedores')
  async getProveedores(@Request() req: RequestWithUser) {
    return this.productosService.findProveedores(req.user);
  }

  @Post('create')
  async createProducto(
    @Request() req: RequestWithUser,
    @Body() dto: CreateProductoDto,
  ) {
    return this.productosService.createProducto(req.user, dto);
  }

  @Post('solicitudes')
  async createSolicitud(
    @Request() req: RequestWithUser,
    @Body() dto: CreateSolicitudDto,
  ) {
    return this.productosService.createSolicitud(req.user, dto);
  }

  @Patch('solicitudes/:id/status')
  async updateSolicitudStatus(
    @Param('id') id: string,
    @Request() req: RequestWithUser,
    @Body() dto: UpdateSolicitudStatusDto,
  ) {
    return this.productosService.updateSolicitudStatus(id, req.user, dto);
  }
}
