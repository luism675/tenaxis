import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JoinTenantDto } from './dto/join-tenant.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { TeamPerformanceQueryDto } from './dto/team-performance-query.dto';
import { TeamMemberDetailQueryDto } from './dto/team-member-detail-query.dto';
import { SuAdminGuard } from '../auth/guards/su-admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { Request as ExpressRequest } from 'express';
import { assertTenantAccess } from '../common/utils/access-control.util';

interface RequestWithUser extends ExpressRequest {
  user: JwtPayload;
}

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @UseGuards(SuAdminGuard)
  async create(@Body() createTenantDto: CreateTenantDto) {
    return await this.tenantsService.create(createTenantDto);
  }

  @Get()
  @UseGuards(SuAdminGuard)
  async findAll() {
    return await this.tenantsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Request() req: RequestWithUser, @Param('id') id: string) {
    assertTenantAccess(
      req.user,
      id,
      'No tienes permiso para ver este conglomerado',
    );
    return await this.tenantsService.findOne(id);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard)
  async join(
    @Request() req: RequestWithUser,
    @Body() joinTenantDto: JoinTenantDto,
  ) {
    return await this.tenantsService.joinBySlug(req.user.sub, joinTenantDto);
  }

  @Get(':tenantId/pending-memberships')
  @UseGuards(JwtAuthGuard)
  async getPendingMemberships(
    @Request() req: RequestWithUser,
    @Param('tenantId') tenantId: string,
  ) {
    assertTenantAccess(req.user, tenantId, 'No perteneces a ese conglomerado');
    return await this.tenantsService.getPendingMemberships(tenantId);
  }

  @Get(':tenantId/memberships')
  @UseGuards(JwtAuthGuard)
  async findAllMemberships(
    @Request() req: RequestWithUser,
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    assertTenantAccess(req.user, tenantId, 'No perteneces a ese conglomerado');
    return await this.tenantsService.findAllMemberships(
      tenantId,
      startDate,
      endDate,
    );
  }

  @Get(':tenantId/team/performance')
  @UseGuards(JwtAuthGuard)
  async getTeamPerformance(
    @Request() req: RequestWithUser,
    @Param('tenantId') tenantId: string,
    @Query() query: TeamPerformanceQueryDto,
  ) {
    assertTenantAccess(req.user, tenantId);

    return await this.tenantsService.getTeamPerformance(
      tenantId,
      req.user,
      query,
    );
  }

  @Get(':tenantId/team/members/:membershipId/detail')
  @UseGuards(JwtAuthGuard)
  async getTeamMemberDetail(
    @Request() req: RequestWithUser,
    @Param('tenantId') tenantId: string,
    @Param('membershipId') membershipId: string,
    @Query() query: TeamMemberDetailQueryDto,
  ) {
    assertTenantAccess(req.user, tenantId);

    return await this.tenantsService.getTeamMemberDetail(
      tenantId,
      membershipId,
      req.user,
      query,
    );
  }

  @Post(':tenantId/memberships')
  @UseGuards(JwtAuthGuard)
  async inviteMember(
    @Request() req: RequestWithUser,
    @Param('tenantId') tenantId: string,
    @Body() dto: InviteMemberDto,
  ) {
    assertTenantAccess(
      req.user,
      tenantId,
      'No tienes permisos para invitar miembros a este conglomerado',
    );

    return await this.tenantsService.inviteMember(tenantId, dto, req.user);
  }

  @Post('memberships/:membershipId/approve')
  @UseGuards(JwtAuthGuard)
  async approveMembership(
    @Request() req: RequestWithUser,
    @Param('membershipId') membershipId: string,
  ) {
    return await this.tenantsService.approveMembership(membershipId, req.user);
  }

  @Post('memberships/:membershipId/reject')
  @UseGuards(JwtAuthGuard)
  async rejectMembership(
    @Request() req: RequestWithUser,
    @Param('membershipId') membershipId: string,
  ) {
    return await this.tenantsService.rejectMembership(membershipId, req.user);
  }

  @Patch('memberships/:membershipId')
  @UseGuards(JwtAuthGuard)
  async updateMembership(
    @Request() req: RequestWithUser,
    @Param('membershipId') membershipId: string,
    @Body() data: UpdateMembershipDto,
  ) {
    return await this.tenantsService.updateMembership(
      membershipId,
      req.user,
      data,
    );
  }
}
