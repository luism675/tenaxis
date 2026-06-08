import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  EquipoTrabajoTareaEstado,
  Prisma,
  Role,
} from '../generated/client/client';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { resolveScopedEmpresaId } from '../common/utils/access-control.util';
import {
  addBogotaDaysUtc,
  endOfBogotaDayUtc,
  startOfBogotaDayUtc,
} from '../common/utils/timezone.util';
import { ChangeEquipoTrabajoTareaStatusDto } from './dto/change-equipo-trabajo-tarea-status.dto';
import { CreateEquipoTrabajoTareaDto } from './dto/create-equipo-trabajo-tarea.dto';
import {
  EquipoTrabajoTareaVencimiento,
  QueryEquipoTrabajoTareasDto,
} from './dto/query-equipo-trabajo-tareas.dto';
import { UpdateEquipoTrabajoTareaDto } from './dto/update-equipo-trabajo-tarea.dto';

const TASK_INCLUDE = {
  responsableMembership: {
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          telefono: true,
        },
      },
    },
  },
  asignadaPorMembership: {
    select: {
      id: true,
      role: true,
      user: {
        select: {
          id: true,
          nombre: true,
          apellido: true,
          email: true,
          telefono: true,
        },
      },
    },
  },
} satisfies Prisma.EquipoTrabajoTareaInclude;

type TaskWithPeople = Prisma.EquipoTrabajoTareaGetPayload<{
  include: typeof TASK_INCLUDE;
}>;

type EmpresaScope = {
  tenantId: string;
  empresaId: string;
};

const ACTIVE_TASK_STATUSES = [
  EquipoTrabajoTareaEstado.PENDIENTE,
  EquipoTrabajoTareaEstado.EN_PROGRESO,
  EquipoTrabajoTareaEstado.BLOQUEADA,
];
const DEFAULT_TASK_PAGE = 1;
const DEFAULT_TASK_LIMIT = 10;
const MAX_TASK_LIMIT = 100;

@Injectable()
export class EquipoTrabajoTareasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: JwtPayload, query: QueryEquipoTrabajoTareasDto) {
    const scope = await this.resolveEmpresaScope(user, query.empresaId);
    const page = Math.max(DEFAULT_TASK_PAGE, query.page ?? DEFAULT_TASK_PAGE);
    const limit = Math.min(
      MAX_TASK_LIMIT,
      Math.max(1, query.limit ?? DEFAULT_TASK_LIMIT),
    );
    const skip = (page - 1) * limit;
    const summaryWhere = await this.buildTaskWhere(scope, user, query, false);
    const where = await this.buildTaskWhere(scope, user, query, true);

    const now = new Date();
    const [items, total, summaryTotal, grouped, vencidas] = await Promise.all([
      this.prisma.equipoTrabajoTarea.findMany({
        where,
        include: TASK_INCLUDE,
        orderBy: [{ fechaLimite: 'asc' }, { createdAt: 'desc' }],
        take: limit,
        skip,
      }),
      this.prisma.equipoTrabajoTarea.count({
        where,
      }),
      this.prisma.equipoTrabajoTarea.count({
        where: summaryWhere,
      }),
      this.prisma.equipoTrabajoTarea.groupBy({
        by: ['estado'],
        where: summaryWhere,
        _count: { _all: true },
      }),
      this.prisma.equipoTrabajoTarea.count({
        where: {
          ...summaryWhere,
          estado: { in: ACTIVE_TASK_STATUSES },
          fechaLimite: { lt: now },
        },
      }),
    ]);

    return {
      items: items.map((task) => this.toResponse(task)),
      summary: {
        total: summaryTotal,
        vencidas,
        byStatus: this.buildStatusSummary(grouped),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
      },
    };
  }

  async findAssignees(user: JwtPayload, empresaId?: string) {
    const scope = await this.resolveEmpresaScope(user, empresaId);
    const memberships = await this.prisma.empresaMembership.findMany({
      where: {
        tenantId: scope.tenantId,
        empresaId: scope.empresaId,
        activo: true,
        deletedAt: null,
        ...(this.isOperator(user) && user.membershipId
          ? { membershipId: user.membershipId }
          : {}),
        membership: {
          tenantId: scope.tenantId,
          status: 'ACTIVE',
          activo: true,
        },
      },
      include: {
        membership: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
                telefono: true,
              },
            },
          },
        },
      },
      orderBy: [
        { membership: { user: { nombre: 'asc' } } },
        { membership: { user: { apellido: 'asc' } } },
      ],
    });

    return memberships.map((row) => ({
      id: row.membership.id,
      name: this.formatUserName(row.membership.user),
      email: row.membership.user.email,
      phone: row.membership.user.telefono,
      role: row.membership.role,
    }));
  }

  async create(user: JwtPayload, dto: CreateEquipoTrabajoTareaDto) {
    this.assertCanManageTasks(user);
    const scope = await this.resolveEmpresaScope(user, dto.empresaId);
    const assignedByMembershipId = await this.resolveAssignedByMembershipId(
      user,
      scope.tenantId,
    );
    if (dto.responsableMembershipId) {
      await this.assertMembershipBelongsToEmpresa(
        dto.responsableMembershipId,
        scope,
      );
    }

    const task = await this.prisma.equipoTrabajoTarea.create({
      data: {
        tenantId: scope.tenantId,
        empresaId: scope.empresaId,
        titulo: this.cleanRequiredText(dto.titulo, 'El título es obligatorio.'),
        descripcion: this.cleanOptionalText(dto.descripcion),
        observaciones: this.cleanOptionalText(dto.observaciones),
        fechaLimite: dto.fechaLimite ? new Date(dto.fechaLimite) : null,
        responsableMembershipId: dto.responsableMembershipId || null,
        asignadaPorMembershipId: assignedByMembershipId,
      },
      include: TASK_INCLUDE,
    });

    return this.toResponse(task);
  }

  async update(id: string, user: JwtPayload, dto: UpdateEquipoTrabajoTareaDto) {
    this.assertCanManageTasks(user);
    const existing = await this.findAccessibleTaskOrThrow(id, user);

    const data: Prisma.EquipoTrabajoTareaUpdateInput = {};

    if (dto.titulo !== undefined) {
      data.titulo = this.cleanRequiredText(
        dto.titulo,
        'El título es obligatorio.',
      );
    }

    if (dto.descripcion !== undefined) {
      data.descripcion = this.cleanOptionalText(dto.descripcion);
    }

    if (dto.observaciones !== undefined) {
      data.observaciones = this.cleanOptionalText(dto.observaciones);
    }

    if (dto.fechaLimite !== undefined) {
      data.fechaLimite = dto.fechaLimite ? new Date(dto.fechaLimite) : null;
    }

    if (dto.responsableMembershipId !== undefined) {
      if (!dto.responsableMembershipId) {
        data.responsableMembership = { disconnect: true };
      } else {
        await this.assertMembershipBelongsToEmpresa(
          dto.responsableMembershipId,
          {
            tenantId: existing.tenantId,
            empresaId: existing.empresaId,
          },
        );
        data.responsableMembership = {
          connect: { id: dto.responsableMembershipId },
        };
      }
    }

    const task = await this.prisma.equipoTrabajoTarea.update({
      where: { id: existing.id },
      data,
      include: TASK_INCLUDE,
    });

    return this.toResponse(task);
  }

  async changeStatus(
    id: string,
    user: JwtPayload,
    dto: ChangeEquipoTrabajoTareaStatusDto,
  ) {
    const existing = await this.findAccessibleTaskOrThrow(id, user);

    if (
      !this.canManageTasks(user) &&
      existing.responsableMembershipId !== null &&
      existing.responsableMembershipId !== user.membershipId
    ) {
      throw new ForbiddenException(
        'No tienes permisos para cambiar esta tarea.',
      );
    }

    const shouldClaimUnassignedTask =
      !existing.responsableMembershipId && !!user.membershipId;

    if (shouldClaimUnassignedTask) {
      await this.assertMembershipBelongsToEmpresa(user.membershipId!, {
        tenantId: existing.tenantId,
        empresaId: existing.empresaId,
      });
    }

    const task = await this.prisma.equipoTrabajoTarea.update({
      where: { id: existing.id },
      data: {
        estado: dto.estado,
        ...(shouldClaimUnassignedTask
          ? { responsableMembershipId: user.membershipId }
          : {}),
        completedAt:
          dto.estado === EquipoTrabajoTareaEstado.COMPLETADA
            ? new Date()
            : null,
      },
      include: TASK_INCLUDE,
    });

    return this.toResponse(task);
  }

  async remove(id: string, user: JwtPayload) {
    this.assertCanManageTasks(user);
    const existing = await this.findAccessibleTaskOrThrow(id, user);

    const task = await this.prisma.equipoTrabajoTarea.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
      },
      include: TASK_INCLUDE,
    });

    return this.toResponse(task);
  }

  private async findAccessibleTaskOrThrow(id: string, user: JwtPayload) {
    const baseWhere: Prisma.EquipoTrabajoTareaWhereInput = {
      id,
      deletedAt: null,
    };

    if (!user.isGlobalSuAdmin) {
      if (!user.tenantId) {
        throw new UnauthorizedException('No perteneces a ningún conglomerado.');
      }

      baseWhere.tenantId = user.tenantId;

      if (this.isOperator(user)) {
        if (!user.membershipId) {
          throw new UnauthorizedException('No se pudo resolver tu membresía.');
        }
        baseWhere.AND = [
          ...(Array.isArray(baseWhere.AND) ? baseWhere.AND : []),
          {
            OR: [
              { responsableMembershipId: user.membershipId },
              { responsableMembershipId: null },
            ],
          },
        ];
      } else {
        const scopedEmpresaId = resolveScopedEmpresaId(user, user.empresaId);
        if (scopedEmpresaId) {
          baseWhere.empresaId = scopedEmpresaId;
        } else if (!this.hasTenantWideTaskAccess(user)) {
          baseWhere.empresaId = { in: user.empresaIds ?? [] };
        }
      }
    }

    const task = await this.prisma.equipoTrabajoTarea.findFirst({
      where: baseWhere,
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada o sin acceso.');
    }

    return task;
  }

  private async resolveEmpresaScope(
    user: JwtPayload,
    requestedEmpresaId?: string,
  ): Promise<EmpresaScope> {
    const empresaId = resolveScopedEmpresaId(
      user,
      requestedEmpresaId || user.empresaId,
    );

    if (!empresaId) {
      throw new BadRequestException(
        'Seleccioná una empresa antes de gestionar tareas.',
      );
    }

    const empresa = await this.prisma.empresa.findFirst({
      where: {
        id: empresaId,
        deletedAt: null,
        ...(user.isGlobalSuAdmin ? {} : { tenantId: user.tenantId }),
      },
      select: {
        id: true,
        tenantId: true,
      },
    });

    if (!empresa) {
      throw new ForbiddenException('Empresa no encontrada o sin acceso.');
    }

    return {
      tenantId: empresa.tenantId,
      empresaId: empresa.id,
    };
  }

  private async assertMembershipBelongsToEmpresa(
    membershipId: string,
    scope: EmpresaScope,
  ) {
    const membership = await this.prisma.empresaMembership.findFirst({
      where: {
        tenantId: scope.tenantId,
        empresaId: scope.empresaId,
        membershipId,
        activo: true,
        deletedAt: null,
        membership: {
          tenantId: scope.tenantId,
          status: 'ACTIVE',
          activo: true,
        },
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      throw new BadRequestException(
        'El responsable no pertenece a la empresa seleccionada.',
      );
    }
  }

  private async resolveAssignedByMembershipId(
    user: JwtPayload,
    tenantId: string,
  ) {
    if (!user.membershipId) {
      throw new BadRequestException(
        'No se pudo identificar quién asigna la tarea.',
      );
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: user.membershipId,
        tenantId,
        status: 'ACTIVE',
        activo: true,
      },
      select: {
        id: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'Tu membresía no está activa en el conglomerado seleccionado.',
      );
    }

    return membership.id;
  }

  private async buildTaskWhere(
    scope: EmpresaScope,
    user: JwtPayload,
    query: QueryEquipoTrabajoTareasDto,
    includeStatus: boolean,
  ): Promise<Prisma.EquipoTrabajoTareaWhereInput> {
    const where: Prisma.EquipoTrabajoTareaWhereInput = {
      tenantId: scope.tenantId,
      empresaId: scope.empresaId,
      deletedAt: null,
    };

    if (query.search?.trim()) {
      const search = query.search.trim();
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { descripcion: { contains: search, mode: 'insensitive' } },
        { observaciones: { contains: search, mode: 'insensitive' } },
      ];
    }

    this.applyVencimientoFilter(where, query.vencimiento);

    if (this.isOperator(user)) {
      if (!user.membershipId) {
        throw new UnauthorizedException('No se pudo resolver tu membresía.');
      }
      this.appendAnd(where, {
        OR: [
          { responsableMembershipId: user.membershipId },
          { responsableMembershipId: null },
        ],
      });
    } else if (query.responsableMembershipId) {
      await this.assertMembershipBelongsToEmpresa(
        query.responsableMembershipId,
        scope,
      );
      where.responsableMembershipId = query.responsableMembershipId;
    }

    if (includeStatus && query.estado) {
      if (where.estado) {
        this.appendAnd(where, { estado: query.estado });
      } else {
        where.estado = query.estado;
      }
    }

    return where;
  }

  private appendAnd(
    where: Prisma.EquipoTrabajoTareaWhereInput,
    condition: Prisma.EquipoTrabajoTareaWhereInput,
  ) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), condition];
  }

  private applyVencimientoFilter(
    where: Prisma.EquipoTrabajoTareaWhereInput,
    vencimiento?: EquipoTrabajoTareaVencimiento,
  ) {
    if (!vencimiento) {
      return;
    }

    const now = new Date();
    const todayStart = startOfBogotaDayUtc(now);
    const todayEnd = endOfBogotaDayUtc(now);

    if (vencimiento === 'vencidas') {
      where.estado = { in: ACTIVE_TASK_STATUSES };
      where.fechaLimite = { lt: now };
      return;
    }

    if (vencimiento === 'hoy') {
      where.fechaLimite = { gte: todayStart, lte: todayEnd };
      return;
    }

    where.fechaLimite = {
      gte: todayStart,
      lt: addBogotaDaysUtc(todayStart, 7),
    };
  }

  private buildStatusSummary(
    grouped: Array<{
      estado: EquipoTrabajoTareaEstado;
      _count: { _all: number };
    }>,
  ) {
    const summary: Record<EquipoTrabajoTareaEstado, number> = {
      [EquipoTrabajoTareaEstado.PENDIENTE]: 0,
      [EquipoTrabajoTareaEstado.EN_PROGRESO]: 0,
      [EquipoTrabajoTareaEstado.BLOQUEADA]: 0,
      [EquipoTrabajoTareaEstado.COMPLETADA]: 0,
      [EquipoTrabajoTareaEstado.CANCELADA]: 0,
    };

    grouped.forEach((row) => {
      summary[row.estado] = row._count._all;
    });

    return summary;
  }

  private toResponse(task: TaskWithPeople) {
    return {
      id: task.id,
      tenantId: task.tenantId,
      empresaId: task.empresaId,
      titulo: task.titulo,
      descripcion: task.descripcion,
      observaciones: task.observaciones,
      estado: task.estado,
      fechaLimite: task.fechaLimite?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      responsable: task.responsableMembership
        ? {
            id: task.responsableMembership.id,
            name: this.formatUserName(task.responsableMembership.user),
            email: task.responsableMembership.user.email,
            phone: task.responsableMembership.user.telefono,
            role: task.responsableMembership.role,
          }
        : null,
      asignadaPor: {
        id: task.asignadaPorMembership.id,
        name: this.formatUserName(task.asignadaPorMembership.user),
        email: task.asignadaPorMembership.user.email,
        phone: task.asignadaPorMembership.user.telefono,
        role: task.asignadaPorMembership.role,
      },
    };
  }

  private cleanRequiredText(value: string, message: string) {
    const clean = value.trim();
    if (!clean) {
      throw new BadRequestException(message);
    }
    return clean;
  }

  private cleanOptionalText(value?: string | null) {
    const clean = value?.trim();
    return clean ? clean : null;
  }

  private canManageTasks(user: JwtPayload) {
    return (
      !!user.isGlobalSuAdmin ||
      user.role === Role.SU_ADMIN ||
      user.role === Role.ADMIN ||
      user.role === Role.COORDINADOR ||
      user.role === Role.ASESOR
    );
  }

  private assertCanManageTasks(user: JwtPayload) {
    if (!this.canManageTasks(user)) {
      throw new ForbiddenException('No tienes permisos para gestionar tareas.');
    }
  }

  private hasTenantWideTaskAccess(user: JwtPayload) {
    return (
      !!user.isGlobalSuAdmin ||
      user.role === Role.SU_ADMIN ||
      user.role === Role.ADMIN ||
      user.role === Role.COORDINADOR
    );
  }

  private isOperator(user: JwtPayload) {
    return !user.isGlobalSuAdmin && user.role === Role.OPERADOR;
  }

  private formatUserName(user: { nombre: string; apellido: string }) {
    return `${user.nombre} ${user.apellido}`.trim();
  }
}
