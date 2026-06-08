import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
  Query,
  UnauthorizedException,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ContabilidadService } from './contabilidad.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Request } from 'express';
import { GenerateMonitoringPayrollDto } from './generate-monitoring-payroll.dto';
import { RegistrarConsignacionDto } from './registrar-consignacion.dto';
import { SendLiquidationReminderDto } from './send-liquidation-reminder.dto';
import { FinanceListQueryDto } from './finance-list-query.dto';
import { CreateAnticipoDto } from './create-anticipo.dto';
import { resolveScopedEmpresaId } from '../common/utils/access-control.util';
import {
  CreateCuentaCobroTurnoDto,
  CreateCuentaCobroUploadUrlDto,
  CuentaCobroQueryDto,
  UpdateCuentaCobroTurnoDto,
} from './cuenta-cobro.dto';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('finanzas')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class FinanzasController {
  constructor(private readonly contabilidadService: ContabilidadService) {}

  private getPaginationOptions(query: FinanceListQueryDto = {}) {
    return query.page !== undefined || query.pageSize !== undefined
      ? { page: query.page, pageSize: query.pageSize }
      : undefined;
  }

  @Get('recaudo-tecnicos')
  findAll(@Req() req: RequestWithUser, @Query() query: FinanceListQueryDto) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    const pagination = this.getPaginationOptions(query);
    return pagination
      ? this.contabilidadService.getRecaudoTecnicosPaginated(
          tenantId,
          empresaId,
          pagination,
        )
      : this.contabilidadService.getRecaudoTecnicos(tenantId, empresaId);
  }

  @Get('balance')
  getBalance(@Req() req: RequestWithUser, @Query() query: FinanceListQueryDto) {
    const tenantId = req.user.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant ID missing');
    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    return this.contabilidadService.getAccountingBalance(
      tenantId,
      empresaId,
      this.getPaginationOptions(query),
    );
  }

  @Get('egresos')
  getEgresos(@Req() req: RequestWithUser, @Query() query: FinanceListQueryDto) {
    const tenantId = req.user.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant ID missing');
    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    const pagination = this.getPaginationOptions(query);
    return pagination
      ? this.contabilidadService.getEgresosPaginated(
          tenantId,
          empresaId,
          pagination,
        )
      : this.contabilidadService.getEgresos(tenantId, empresaId);
  }

  @Get('nominas')
  getNominas(@Req() req: RequestWithUser, @Query() query: FinanceListQueryDto) {
    const tenantId = req.user.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant ID missing');
    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    const pagination = this.getPaginationOptions(query);
    return pagination
      ? this.contabilidadService.getNominasPaginated(
          tenantId,
          empresaId,
          pagination,
        )
      : this.contabilidadService.getNominas(tenantId, empresaId);
  }

  @Get('anticipos')
  getAnticipos(
    @Req() req: RequestWithUser,
    @Query() query: FinanceListQueryDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) throw new UnauthorizedException('Tenant ID missing');
    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    const pagination = this.getPaginationOptions(query);
    return pagination
      ? this.contabilidadService.getAnticiposPaginated(
          tenantId,
          empresaId,
          pagination,
        )
      : this.contabilidadService.getAnticipos(tenantId, empresaId);
  }

  @Post('nominas/generar-desde-monitoreo')
  generateMonitoringPayroll(
    @Req() req: RequestWithUser,
    @Body() dto: GenerateMonitoringPayrollDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID missing');
    }

    if (
      !dto.includeAllEligible &&
      (!dto.membershipIds || dto.membershipIds.length === 0)
    ) {
      throw new BadRequestException(
        'Debe enviar membershipIds o activar includeAllEligible',
      );
    }

    return this.contabilidadService.generatePayrollFromMonitoring(
      tenantId,
      dto,
    );
  }

  @Post('registrar-egreso')
  createEgreso(
    @Req() req: RequestWithUser,
    @Body()
    data: {
      titulo: string;
      monto: number;
      razon: string;
      categoria: string;
      membershipId?: string;
      empresaId: string;
    },
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    return this.contabilidadService.createEgreso(tenantId, {
      ...data,
      empresaId: resolveScopedEmpresaId(req.user, data.empresaId),
    });
  }

  @Post('registrar-anticipo')
  createAnticipo(@Req() req: RequestWithUser, @Body() data: CreateAnticipoDto) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const membershipId = req.user.membershipId;
    if (!membershipId) {
      throw new UnauthorizedException('Membership ID not found in token');
    }

    return this.contabilidadService.createAnticipo(tenantId, {
      ...data,
      membershipId,
      empresaId: resolveScopedEmpresaId(req.user, data.empresaId),
    });
  }

  @Post('registrar-consignacion')
  async register(
    @Req() req: RequestWithUser,
    @Body() data: RegistrarConsignacionDto,
  ) {
    const tenantId = req.user.tenantId;
    const membershipId = req.user.membershipId;

    if (!tenantId || !membershipId) {
      throw new UnauthorizedException('Auth data missing');
    }

    return this.contabilidadService.registrarConsignacion(
      tenantId,
      membershipId,
      {
        tecnicoId: data.tecnicoId,
        empresaId: resolveScopedEmpresaId(req.user, data.empresaId),
        valorConsignado: data.valorConsignado,
        valorEntregado: data.valorEntregado,
        valorAdelanto: data.valorAdelanto,
        referenciaBanco: data.referenciaBanco,
        comprobantePath: data.comprobantePath,
        confirmarEfectivoFisico: data.confirmarEfectivoFisico,
        ordenIds: data.ordenIds,
        fechaConsignacion: data.fechaConsignacion,
        observacion: data.observacion,
      },
    );
  }

  @Post('recaudo-tecnicos/:membershipId/recordatorio-liquidacion')
  async sendLiquidationReminder(
    @Req() req: RequestWithUser,
    @Param('membershipId') membershipId: string,
    @Body() data: SendLiquidationReminderDto,
  ) {
    const tenantId = req.user.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    return this.contabilidadService.sendManualCashCollectionReminder(
      tenantId,
      membershipId,
      resolveScopedEmpresaId(req.user, data.empresaId),
    );
  }

  @Get('cuenta-cobro')
  getCuentaCobroDashboard(
    @Req() req: RequestWithUser,
    @Query() query: CuentaCobroQueryDto,
  ) {
    const tenantId = req.user.tenantId;
    const membershipId = req.user.membershipId;

    if (!tenantId || !membershipId) {
      throw new UnauthorizedException('Auth data missing');
    }

    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    if (!empresaId) {
      throw new BadRequestException('Debe seleccionar una empresa.');
    }

    return this.contabilidadService.getCuentaCobroDashboard(
      tenantId,
      membershipId,
      empresaId,
    );
  }

  @Post('cuenta-cobro/turnos')
  createCuentaCobroTurno(
    @Req() req: RequestWithUser,
    @Body() data: CreateCuentaCobroTurnoDto,
  ) {
    const tenantId = req.user.tenantId;
    const membershipId = req.user.membershipId;

    if (!tenantId || !membershipId) {
      throw new UnauthorizedException('Auth data missing');
    }

    return this.contabilidadService.createCuentaCobroTurno(
      tenantId,
      membershipId,
      {
        ...data,
        empresaId: resolveScopedEmpresaId(req.user, data.empresaId),
      },
    );
  }

  @Put('cuenta-cobro/turnos/:turnoId')
  updateCuentaCobroTurno(
    @Req() req: RequestWithUser,
    @Param('turnoId') turnoId: string,
    @Body() data: UpdateCuentaCobroTurnoDto,
  ) {
    const tenantId = req.user.tenantId;
    const membershipId = req.user.membershipId;

    if (!tenantId || !membershipId) {
      throw new UnauthorizedException('Auth data missing');
    }

    return this.contabilidadService.updateCuentaCobroTurno(
      tenantId,
      membershipId,
      turnoId,
      {
        ...data,
        empresaId: resolveScopedEmpresaId(req.user, data.empresaId),
      },
    );
  }

  @Delete('cuenta-cobro/turnos/:turnoId')
  deleteCuentaCobroTurno(
    @Req() req: RequestWithUser,
    @Param('turnoId') turnoId: string,
  ) {
    const tenantId = req.user.tenantId;
    const membershipId = req.user.membershipId;

    if (!tenantId || !membershipId) {
      throw new UnauthorizedException('Auth data missing');
    }

    return this.contabilidadService.deleteCuentaCobroTurno(
      tenantId,
      membershipId,
      turnoId,
    );
  }

  @Post('cuenta-cobro/cerrar-periodo')
  closeCuentaCobroPeriod(
    @Req() req: RequestWithUser,
    @Body() data: CuentaCobroQueryDto,
  ) {
    const tenantId = req.user.tenantId;
    const membershipId = req.user.membershipId;

    if (!tenantId || !membershipId) {
      throw new UnauthorizedException('Auth data missing');
    }

    const empresaId = resolveScopedEmpresaId(req.user, data.empresaId);
    if (!empresaId) {
      throw new BadRequestException('Debe seleccionar una empresa.');
    }

    return this.contabilidadService.closeCuentaCobroPeriod(
      tenantId,
      membershipId,
      empresaId,
    );
  }

  @Post('cuenta-cobro/evidencias/upload-url')
  createCuentaCobroEvidenceUploadUrl(
    @Req() req: RequestWithUser,
    @Body() data: CreateCuentaCobroUploadUrlDto,
  ) {
    const tenantId = req.user.tenantId;
    const membershipId = req.user.membershipId;

    if (!tenantId || !membershipId) {
      throw new UnauthorizedException('Auth data missing');
    }

    return this.contabilidadService.createCuentaCobroEvidenceUploadUrl(
      tenantId,
      membershipId,
      {
        ...data,
        empresaId: resolveScopedEmpresaId(req.user, data.empresaId),
      },
    );
  }
}
