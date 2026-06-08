import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEnterpriseDto } from './dto/create-enterprise.dto';
import { UpdateEnterpriseDto } from './dto/update-enterprise.dto';
import { EnterpriseService } from './enterprise.service';
import { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('enterprise')
export class EnterpriseController {
  constructor(private readonly enterpriseService: EnterpriseService) {}

  @Post('create')
  create(
    @Body() createEnterpriseDto: CreateEnterpriseDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.enterpriseService.create(createEnterpriseDto, req.user);
  }

  @Get()
  findAll(@Request() req: { user: JwtPayload }) {
    return this.enterpriseService.findAll(req.user);
  }

  @Get('operators')
  findAllOperators(@Request() req: { user: JwtPayload }) {
    return this.enterpriseService.findOperators(req.user);
  }

  @Get(':id/operators')
  findOperators(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.enterpriseService.findOperators(req.user, id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateEnterpriseDto: UpdateEnterpriseDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.enterpriseService.update(id, updateEnterpriseDto, req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.enterpriseService.remove(id, req.user);
  }
}
