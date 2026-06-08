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
  UseGuards,
} from '@nestjs/common';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangeEquipoTrabajoTareaStatusDto } from './dto/change-equipo-trabajo-tarea-status.dto';
import { CreateEquipoTrabajoTareaDto } from './dto/create-equipo-trabajo-tarea.dto';
import { QueryEquipoTrabajoTareasDto } from './dto/query-equipo-trabajo-tareas.dto';
import { UpdateEquipoTrabajoTareaDto } from './dto/update-equipo-trabajo-tarea.dto';
import { EquipoTrabajoTareasService } from './equipo-trabajo-tareas.service';

@UseGuards(JwtAuthGuard)
@Controller('equipo-trabajo/tareas')
export class EquipoTrabajoTareasController {
  constructor(
    private readonly equipoTrabajoTareasService: EquipoTrabajoTareasService,
  ) {}

  @Get()
  findAll(
    @Request() req: { user: JwtPayload },
    @Query() query: QueryEquipoTrabajoTareasDto,
  ) {
    return this.equipoTrabajoTareasService.findAll(req.user, query);
  }

  @Get('responsables')
  findAssignees(
    @Request() req: { user: JwtPayload },
    @Query('empresaId') empresaId?: string,
  ) {
    return this.equipoTrabajoTareasService.findAssignees(req.user, empresaId);
  }

  @Post()
  create(
    @Request() req: { user: JwtPayload },
    @Body() dto: CreateEquipoTrabajoTareaDto,
  ) {
    return this.equipoTrabajoTareasService.create(req.user, dto);
  }

  @Patch(':id')
  update(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: UpdateEquipoTrabajoTareaDto,
  ) {
    return this.equipoTrabajoTareasService.update(id, req.user, dto);
  }

  @Patch(':id/estado')
  changeStatus(
    @Request() req: { user: JwtPayload },
    @Param('id') id: string,
    @Body() dto: ChangeEquipoTrabajoTareaStatusDto,
  ) {
    return this.equipoTrabajoTareasService.changeStatus(id, req.user, dto);
  }

  @Delete(':id')
  remove(@Request() req: { user: JwtPayload }, @Param('id') id: string) {
    return this.equipoTrabajoTareasService.remove(id, req.user);
  }
}
