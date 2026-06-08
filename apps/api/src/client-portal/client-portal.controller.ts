import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientPortalService } from './client-portal.service';
import { CreateClientPortalLinkDto } from './dto/create-client-portal-link.dto';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('client-portal')
export class ClientPortalController {
  constructor(private readonly service: ClientPortalService) {}

  @Post('clients/:clienteId/link')
  @UseGuards(JwtAuthGuard)
  createLink(
    @Req() req: RequestWithUser,
    @Param('clienteId') clienteId: string,
    @Body() dto: CreateClientPortalLinkDto = {},
  ) {
    return this.service.createLink(req.user, clienteId, dto);
  }

  @Get('public/:token')
  getPublicDashboard(@Param('token') token: string) {
    return this.service.getPublicDashboard(token);
  }
}
