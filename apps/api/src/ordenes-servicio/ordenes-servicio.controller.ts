import {
  BadRequestException,
  Controller,
  Post,
  Get,
  Sse,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
  Query,
  UnauthorizedException,
  UseInterceptors,
  UploadedFiles,
  UploadedFile,
  MessageEvent,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import {
  OrdenesServicioService,
  FollowUpNotificationsSummaryPayload,
  ServiciosKpiPayload,
} from './ordenes-servicio.service';
import { CreateOrdenServicioDto } from './dto/create-orden-servicio.dto';
import { CompleteFollowUpDto } from './dto/complete-follow-up.dto';
import { CreateFollowUpOverrideDto } from './dto/create-follow-up-override.dto';
import { ExportOrdenesServicioDto } from './dto/export-ordenes-servicio.dto';
import { RemoveOrdenServicioDto } from './dto/remove-orden-servicio.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { QueryOrdenesServicioDto } from './dto/query-ordenes-servicio.dto';
import { QueryFollowUpNotificationsDto } from './dto/query-follow-up-notifications.dto';
import {
  ConfirmUploadedFilesDto,
  CreateSignedDownloadUrlDto,
  CreateSignedUploadUrlDto,
} from './dto/upload-orden-servicio.dto';
import {
  NotifyLiquidationDto,
  NotifyOperatorDto,
} from './dto/notify-webhook.dto';
import { QueryOperatorLocationsDto } from './dto/operator-last-location.dto';
import { SupabaseService } from '../supabase/supabase.service';
import { resolveScopedEmpresaId } from '../common/utils/access-control.util';
import { OrdenesServicioExportJobsService } from './export-jobs.service';

interface RequestWithUser extends Request {
  user: JwtPayload;
}

@Controller('ordenes-servicio')
@UseGuards(JwtAuthGuard)
export class OrdenesServicioController {
  constructor(
    private readonly ordenesServicioService: OrdenesServicioService,
    private readonly supabaseService: SupabaseService,
    private readonly ordenesServicioExportJobsService: OrdenesServicioExportJobsService,
  ) {}

  @Post()
  async create(
    @Req() req: RequestWithUser,
    @Body() createDto: CreateOrdenServicioDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    // Asignar creador si no viene en el DTO
    if (req.user.membershipId) {
      createDto.creadoPorId = req.user.membershipId;
    }

    return await this.ordenesServicioService.create(
      tenantId,
      createDto,
      req.user,
    );
  }

  @Post(':id/evidencias')
  @UseInterceptors(FilesInterceptor('files'))
  async addEvidencias(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @UploadedFiles() files: Array<Express.Multer.File>,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return await this.ordenesServicioService.addEvidence(tenantId, id, files);
  }

  @Get()
  async findAll(
    @Req() req: RequestWithUser,
    @Query() query: QueryOrdenesServicioDto,
  ) {
    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    return await this.ordenesServicioService.findAll(
      req.user,
      empresaId,
      query,
    );
  }

  @Get('kpis')
  async getKpis(
    @Req() req: RequestWithUser,
    @Query() query: QueryOrdenesServicioDto,
  ): Promise<ServiciosKpiPayload> {
    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    return await this.ordenesServicioService.getKpis(
      req.user,
      empresaId,
      query,
    );
  }

  @Get('operator-locations')
  async getOperatorLocations(
    @Req() req: RequestWithUser,
    @Query() query: QueryOperatorLocationsDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const empresaId = resolveScopedEmpresaId(req.user, query.empresaId);
    return await this.ordenesServicioService.getOperatorLastLocations(
      tenantId,
      req.user,
      empresaId,
    );
  }

  @Post('export')
  async export(
    @Req() req: RequestWithUser,
    @Body() dto: ExportOrdenesServicioDto,
  ) {
    return await this.ordenesServicioService.export(req.user, dto);
  }

  @Post('export/jobs')
  async queueExport(
    @Req() req: RequestWithUser,
    @Body() dto: ExportOrdenesServicioDto,
  ) {
    return await this.ordenesServicioExportJobsService.enqueueExport(
      req.user,
      dto,
    );
  }

  @Get('export/jobs/:jobId')
  async getQueuedExportStatus(
    @Req() req: RequestWithUser,
    @Param('jobId') jobId: string,
  ) {
    return await this.ordenesServicioExportJobsService.getExportStatus(
      req.user,
      jobId,
    );
  }

  @Get('follow-ups/my-status')
  async getMyFollowUpStatus(
    @Req() req: RequestWithUser,
    @Query('empresaId') empresaId?: string,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const resolvedEmpresaId = resolveScopedEmpresaId(req.user, empresaId);

    if (!resolvedEmpresaId) {
      throw new BadRequestException('Debes indicar una empresa');
    }

    return await this.ordenesServicioService.getMyFollowUpStatus(
      tenantId,
      req.user,
      resolvedEmpresaId,
    );
  }

  @Get('follow-ups/notifications-summary')
  async getFollowUpNotificationsSummary(
    @Req() req: RequestWithUser,
    @Query() query: QueryFollowUpNotificationsDto,
  ): Promise<FollowUpNotificationsSummaryPayload> {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const resolvedEmpresaId = resolveScopedEmpresaId(req.user, query.empresaId);

    return await this.ordenesServicioService.getFollowUpNotificationsSummary(
      tenantId,
      req.user,
      resolvedEmpresaId,
      {
        category: query.category,
        page: query.page,
        pageSize: query.pageSize,
      },
    );
  }

  @Sse('follow-ups/notifications-stream')
  streamFollowUpNotifications(
    @Req() req: RequestWithUser,
    @Query('empresaId') empresaId?: string,
  ): Observable<MessageEvent> {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const resolvedEmpresaId = resolveScopedEmpresaId(req.user, empresaId);

    return this.ordenesServicioService.streamFollowUpNotifications(
      tenantId,
      req.user,
      resolvedEmpresaId,
    );
  }

  @Get('follow-up-overrides')
  async getFollowUpOverrides(
    @Req() req: RequestWithUser,
    @Query('empresaId') empresaId?: string,
    @Query('membershipId') membershipId?: string,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const resolvedEmpresaId = resolveScopedEmpresaId(req.user, empresaId);

    if (!resolvedEmpresaId) {
      throw new BadRequestException('Debes indicar una empresa');
    }

    return await this.ordenesServicioService.listFollowUpOverrides(
      tenantId,
      req.user,
      resolvedEmpresaId,
      membershipId,
    );
  }

  @Post('follow-up-overrides')
  async createFollowUpOverride(
    @Req() req: RequestWithUser,
    @Body() dto: CreateFollowUpOverrideDto,
    @Query('empresaId') empresaId?: string,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const resolvedEmpresaId = resolveScopedEmpresaId(req.user, empresaId);

    if (!resolvedEmpresaId) {
      throw new BadRequestException('Debes indicar una empresa');
    }

    return await this.ordenesServicioService.createFollowUpOverride(
      tenantId,
      req.user,
      resolvedEmpresaId,
      dto,
    );
  }

  @Post('follow-ups/:id/complete')
  async completeFollowUp(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CompleteFollowUpDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    return await this.ordenesServicioService.completeFollowUp(
      tenantId,
      id,
      dto,
      req.user,
    );
  }

  @Post(':id/uploads/signed-url')
  async createSignedUploadUrl(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CreateSignedUploadUrlDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return await this.ordenesServicioService.createSignedUploadUrl(
      tenantId,
      id,
      dto,
    );
  }

  @Post(':id/uploads/confirm')
  async confirmUpload(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: ConfirmUploadedFilesDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return await this.ordenesServicioService.confirmUploadedFiles(
      tenantId,
      id,
      dto,
    );
  }

  @Post(':id/uploads/signed-download-url')
  async createSignedDownloadUrl(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: CreateSignedDownloadUrlDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    return await this.ordenesServicioService.createSignedDownloadUrl(
      req.user,
      id,
      dto,
    );
  }

  @Post('notifications/liquidation')
  async notifyLiquidation(
    @Req() req: RequestWithUser,
    @Body() dto: NotifyLiquidationDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return await this.ordenesServicioService.notifyLiquidationWebhook(
      tenantId,
      dto,
    );
  }

  @Post('notifications/operator')
  async notifyOperator(
    @Req() req: RequestWithUser,
    @Body() dto: NotifyOperatorDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return await this.ordenesServicioService.notifyOperatorWebhook(
      tenantId,
      dto,
    );
  }

  @Post('trigger-reinforcements-job')
  async triggerReinforcementsJob() {
    return await this.ordenesServicioService.processReinforcementsJob();
  }

  @Get(':id/edit-bootstrap')
  async findEditBootstrap(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    return await this.ordenesServicioService.findEditBootstrap(req.user, id);
  }

  @Get(':id')
  async findOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    return await this.ordenesServicioService.findOne(req.user, id);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    const updateDto = body as unknown as Partial<CreateOrdenServicioDto> & {
      tecnicoId?: string | null;
      uploadField?: string;
    };

    // Parse specific JSON fields if they are sent as strings in FormData
    if (typeof body.desglosePago === 'string') {
      try {
        updateDto.desglosePago = JSON.parse(body.desglosePago) as any[];
      } catch {
        // Handle gracefully
      }
    }

    if (file && typeof body.uploadField === 'string') {
      const fieldToUpdate = body.uploadField;
      const fileExt = file.originalname.split('.').pop() || '';
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
      const folderMap: Record<string, string> = {
        facturaElectronica: 'facturaOrdenServicio',
        comprobantePago: 'comprobanteOrdenServicio',
        evidenciaPath: 'EvidenciaOrdenServicio',
      };

      const folder = folderMap[fieldToUpdate] || 'EvidenciaOrdenServicio';
      const filePath = `${folder}/${fileName}`;

      const fileId = await this.supabaseService.uploadFile(
        filePath,
        file.buffer,
        file.mimetype,
        'tenaxis-docs',
      );

      if (fileId) {
        if (fieldToUpdate === 'facturaElectronica')
          updateDto.facturaElectronica = fileId;
        if (fieldToUpdate === 'comprobantePago')
          updateDto.comprobantePago = fileId;
        if (fieldToUpdate === 'evidenciaPath') updateDto.evidenciaPath = fileId;
      }
    }

    // Clean up temporary field used for routing the file
    if ('uploadField' in updateDto) {
      delete updateDto.uploadField;
    }

    return await this.ordenesServicioService.update(
      tenantId,
      id,
      updateDto,
      req.user,
    );
  }

  @Delete(':id')
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() removeDto: RemoveOrdenServicioDto,
  ) {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }
    return await this.ordenesServicioService.remove(
      tenantId,
      id,
      removeDto,
      req.user,
    );
  }
}
