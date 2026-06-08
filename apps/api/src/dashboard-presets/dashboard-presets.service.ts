import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../generated/client/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateDashboardPresetDto,
  DashboardPresetModule,
  UpdateDashboardPresetDto,
} from './dto/dashboard-preset.dto';

type DashboardPresetRow = {
  id: string;
  tenantId: string;
  createdByMembershipId: string;
  module: DashboardPresetModule;
  name: string;
  colorToken: string;
  isShared: boolean;
  filters: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class DashboardPresetsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getTenantAndMembership(user: JwtPayload) {
    if (!user.tenantId) {
      throw new UnauthorizedException('Tenant ID not found in token');
    }

    let membershipId = user.membershipId;

    if (!membershipId && user.sub) {
      const membership = await this.prisma.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: user.sub,
            tenantId: user.tenantId,
          },
        },
        select: { id: true },
      });
      membershipId = membership?.id;
    }

    if (!membershipId) {
      throw new UnauthorizedException('Membership ID not found in token');
    }

    return { tenantId: user.tenantId, membershipId };
  }

  private mapRow(row: DashboardPresetRow) {
    return {
      id: row.id,
      module: row.module,
      name: row.name,
      colorToken: row.colorToken,
      isShared: row.isShared,
      filters: row.filters as Record<string, unknown>,
      createdByMembershipId: row.createdByMembershipId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(user: JwtPayload, module: DashboardPresetModule) {
    const { tenantId, membershipId } = await this.getTenantAndMembership(user);

    const rows = await this.prisma.$queryRaw<DashboardPresetRow[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        created_by_membership_id AS "createdByMembershipId",
        module,
        name,
        color_token AS "colorToken",
        is_shared AS "isShared",
        filters,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM dashboard_presets
      WHERE tenant_id = ${tenantId}::uuid
        AND module = ${module}::"DashboardPresetModule"
        AND (is_shared = true OR created_by_membership_id = ${membershipId}::uuid)
      ORDER BY is_shared DESC, updated_at DESC
    `);

    return rows.map((row) => this.mapRow(row));
  }

  async create(user: JwtPayload, dto: CreateDashboardPresetDto) {
    const { tenantId, membershipId } = await this.getTenantAndMembership(user);
    const id = randomUUID();
    const [row] = await this.prisma.$queryRaw<DashboardPresetRow[]>(Prisma.sql`
      INSERT INTO dashboard_presets
        (id, tenant_id, created_by_membership_id, module, name, color_token, is_shared, filters, created_at, updated_at)
      VALUES
        (${id}::uuid, ${tenantId}::uuid, ${membershipId}::uuid, ${dto.module}::"DashboardPresetModule", ${dto.name}, ${dto.colorToken}, ${dto.isShared}, ${JSON.stringify(dto.filters)}::jsonb, NOW(), NOW())
      RETURNING
        id,
        tenant_id AS "tenantId",
        created_by_membership_id AS "createdByMembershipId",
        module,
        name,
        color_token AS "colorToken",
        is_shared AS "isShared",
        filters,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);
    return this.mapRow(row);
  }

  private async getByIdOrThrow(user: JwtPayload, id: string) {
    const { tenantId } = await this.getTenantAndMembership(user);
    const [row] = await this.prisma.$queryRaw<DashboardPresetRow[]>(Prisma.sql`
      SELECT
        id,
        tenant_id AS "tenantId",
        created_by_membership_id AS "createdByMembershipId",
        module,
        name,
        color_token AS "colorToken",
        is_shared AS "isShared",
        filters,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM dashboard_presets
      WHERE id = ${id}::uuid AND tenant_id = ${tenantId}::uuid
      LIMIT 1
    `);
    if (!row) {
      throw new NotFoundException('Preset no encontrado');
    }
    return row;
  }

  private assertCanManage(
    user: JwtPayload,
    row: DashboardPresetRow,
    membershipId: string,
  ) {
    const isOwner = row.createdByMembershipId === membershipId;
    const isAdmin = user.role === 'ADMIN' || user.role === 'SU_ADMIN';

    if (!isOwner && !(isAdmin && row.isShared)) {
      throw new ForbiddenException(
        'No tienes permisos para gestionar este preset',
      );
    }
  }

  async update(user: JwtPayload, id: string, dto: UpdateDashboardPresetDto) {
    const { membershipId } = await this.getTenantAndMembership(user);
    const row = await this.getByIdOrThrow(user, id);
    this.assertCanManage(user, row, membershipId);

    const nextName = dto.name ?? row.name;
    const nextColorToken = dto.colorToken ?? row.colorToken;
    const nextIsShared = dto.isShared ?? row.isShared;
    const nextFilters = dto.filters ?? (row.filters as Record<string, unknown>);

    const [updated] = await this.prisma.$queryRaw<
      DashboardPresetRow[]
    >(Prisma.sql`
      UPDATE dashboard_presets
      SET
        name = ${nextName},
        color_token = ${nextColorToken},
        is_shared = ${nextIsShared},
        filters = ${JSON.stringify(nextFilters)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}::uuid
      RETURNING
        id,
        tenant_id AS "tenantId",
        created_by_membership_id AS "createdByMembershipId",
        module,
        name,
        color_token AS "colorToken",
        is_shared AS "isShared",
        filters,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `);

    return this.mapRow(updated);
  }

  async remove(user: JwtPayload, id: string) {
    const { membershipId } = await this.getTenantAndMembership(user);
    const row = await this.getByIdOrThrow(user, id);
    this.assertCanManage(user, row, membershipId);

    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM dashboard_presets
      WHERE id = ${id}::uuid
    `);

    return { success: true };
  }
}
