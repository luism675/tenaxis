import { InviteMemberDto } from './dto/invite-member.dto';
import {
  BadRequestException,
  Injectable,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JoinTenantDto } from './dto/join-tenant.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { getPrismaAccessFilter } from '../common/utils/access-control.util';
import {
  EstadoOrden,
  MembershipPermission,
  Prisma,
  Role,
  TipoVisita,
} from '../generated/client/client';
import * as bcrypt from 'bcrypt';
import {
  TeamPerformanceQueryDto,
  TeamScope,
} from './dto/team-performance-query.dto';
import { TeamMemberDetailQueryDto } from './dto/team-member-detail-query.dto';
import {
  endOfBogotaDayUtc,
  nowUtc,
  parseBogotaDateToUtcEnd,
  parseBogotaDateToUtcStart,
  startOfBogotaDayUtc,
  startOfBogotaMonthUtc,
} from '../common/utils/timezone.util';
import {
  buildMembershipPermissionState,
  findUnsupportedGranularPermissions,
  hasMembershipPermission,
  resolveStoredGranularPermissions,
} from '../auth/membership-permissions.util';

const NEW_VISIT_TYPES = new Set<TipoVisita>([
  'DIAGNOSTICO_INICIAL' as TipoVisita,
  'NUEVO' as TipoVisita,
]);

const REWORK_VISIT_TYPES = new Set<TipoVisita>([
  'GARANTIA' as TipoVisita,
  'SERVICIO_REFUERZO' as TipoVisita,
]);

const OPERATIVE_ROLES = new Set<Role>([
  Role.COORDINADOR,
  Role.ASESOR,
  Role.OPERADOR,
]);

const NIL_UUID = '00000000-0000-0000-0000-000000000000';

const MANAGEABLE_MEMBER_ROLES_BY_ACTOR: Record<Role, Role[]> = {
  [Role.SU_ADMIN]: [Role.ADMIN, Role.COORDINADOR, Role.ASESOR, Role.OPERADOR],
  [Role.ADMIN]: [Role.ADMIN, Role.COORDINADOR, Role.ASESOR, Role.OPERADOR],
  [Role.COORDINADOR]: [Role.ASESOR, Role.OPERADOR],
  [Role.ASESOR]: [],
  [Role.OPERADOR]: [],
};

interface DateRange {
  from: Date;
  to: Date;
}

type MembershipGeoScopeRelation = {
  role: Role;
  granularPermissions?: MembershipPermission[] | null;
  departmentScopes?: Array<{ departmentId: string }>;
  municipalityScopes?: Array<{ municipalityId: string }>;
};

type NormalizedMembershipGeoScope = {
  departmentIds: string[];
  municipalityIds: string[];
  primaryMunicipioId: string | null;
};

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  async joinBySlug(userId: string, dto: JoinTenantDto) {
    const { slug } = dto;

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('El conglomerado no existe');
    }

    const existingMembership = await this.prisma.tenantMembership.findUnique({
      where: {
        userId_tenantId: {
          userId,
          tenantId: tenant.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException(
        'Ya tienes una solicitud o membresía en este conglomerado',
      );
    }

    return this.prisma.tenantMembership.create({
      data: {
        userId,
        tenantId: tenant.id,
        role: Role.OPERADOR,
        activo: true,
        aprobado: false, // Esperando aprobación
      },
    });
  }

  async create(dto: CreateTenantDto) {
    const {
      nombre,
      slug,
      correo,
      nit,
      numero,
      pagina,
      ownerEmail,
      ownerPassword,
      ownerNombre,
      ownerApellido,
      planId,
      durationDays,
    } = dto;

    // 1. Verificar si el slug ya existe
    const existingTenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });
    if (existingTenant) {
      throw new ConflictException('El slug del tenant ya está en uso');
    }

    // 2. Verificar el plan
    const selectedPlan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!selectedPlan) {
      throw new ConflictException('El plan seleccionado no existe');
    }

    // 3. Verificar si el owner existe o necesita ser creado
    let owner = await this.prisma.user.findUnique({
      where: { email: ownerEmail },
    });

    return this.prisma.$transaction(async (tx) => {
      if (!owner) {
        if (!ownerPassword) {
          throw new ConflictException(
            'El usuario no existe y no se proporcionó contraseña para crearlo.',
          );
        }
        const hashedPassword = await bcrypt.hash(ownerPassword, 10);
        owner = await tx.user.create({
          data: {
            email: ownerEmail,
            password: hashedPassword,
            nombre: ownerNombre || 'Owner',
            apellido: ownerApellido || 'Tenant',
          },
        });
      }

      // 4. Crear el Tenant
      const tenant = await tx.tenant.create({
        data: {
          nombre,
          slug,
          correo,
          nit,
          numero,
          pagina,
        },
      });

      // 5. Crear Empresa por defecto
      const empresa = await tx.empresa.create({
        data: {
          nombre: 'Sede Principal',
          tenantId: tenant.id,
        },
      });

      // 6. Crear Membresía para el dueño (SU_ADMIN del Conglomerado)
      const membership = await tx.tenantMembership.create({
        data: {
          userId: owner.id,
          tenantId: tenant.id,
          role: Role.SU_ADMIN,
          activo: true,
          aprobado: true,
        },
      });

      // 7. Vincular con la empresa
      await tx.empresaMembership.create({
        data: {
          tenantId: tenant.id,
          membershipId: membership.id,
          empresaId: empresa.id,
        },
      });

      // 8. Crear suscripción inicial
      const finalDuration = durationDays || selectedPlan.durationDays;

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: selectedPlan.id,
          startDate: new Date(),
          endDate: new Date(Date.now() + finalDuration * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
        },
      });

      // 9. Seed de Configuración Dinámica (Tipos de Interés por defecto)
      await tx.tipoInteres.createMany({
        data: [
          {
            tenantId: tenant.id,
            nombre: 'Fumigación PUNTUAL',
            descripcion: 'Servicio único de control de plagas',
            frecuenciaSugerida: 0,
            riesgoSugerido: 'BAJO',
          },
          {
            tenantId: tenant.id,
            nombre: 'Contrato MENSUAL',
            descripcion: 'Control preventivo recurrente',
            frecuenciaSugerida: 30,
            riesgoSugerido: 'MEDIO',
          },
          {
            tenantId: tenant.id,
            nombre: 'Diagnóstico Técnico',
            descripcion: 'Inspección inicial y levantamiento',
            frecuenciaSugerida: 0,
            riesgoSugerido: 'BAJO',
          },
          {
            tenantId: tenant.id,
            nombre: 'Auditoría INVIMA/Salud',
            descripcion: 'Preparación para entes de control',
            frecuenciaSugerida: 15,
            riesgoSugerido: 'ALTO',
          },
          {
            tenantId: tenant.id,
            nombre: 'Control Roedores',
            descripcion: 'Especializado en ratas y ratones',
            frecuenciaSugerida: 15,
            riesgoSugerido: 'ALTO',
          },
        ],
      });

      return tenant;
    });
  }

  async getPendingMemberships(tenantId: string) {
    return this.prisma.tenantMembership.findMany({
      where: {
        tenantId,
        aprobado: false,
      },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            email: true,
          },
        },
      },
    });
  }

  async approveMembership(membershipId: string, user: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findUnique({
        where: { id: membershipId },
        select: {
          id: true,
          tenantId: true,
        },
      });

      if (!membership) {
        throw new NotFoundException('Membresía no encontrada');
      }

      await this.assertCanEditTeamMembership(tx, user, membership.tenantId);

      return tx.tenantMembership.update({
        where: { id: membershipId },
        data: { aprobado: true },
      });
    });
  }

  async rejectMembership(membershipId: string, user: JwtPayload) {
    return this.prisma.$transaction(async (tx) => {
      const membership = await tx.tenantMembership.findUnique({
        where: { id: membershipId },
        select: {
          id: true,
          tenantId: true,
        },
      });

      if (!membership) {
        throw new NotFoundException('Membresía no encontrada');
      }

      await this.assertCanEditTeamMembership(tx, user, membership.tenantId);

      return tx.tenantMembership.delete({
        where: { id: membershipId },
      });
    });
  }

  async updateMembership(
    membershipId: string,
    user: JwtPayload,
    data: UpdateMembershipDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Obtener la membresía actual para saber el tenantId
      const current = await tx.tenantMembership.findUnique({
        where: { id: membershipId },
      });

      if (!current) {
        throw new NotFoundException('Membresía no encontrada');
      }

      if (!user.isGlobalSuAdmin) {
        if (!user.tenantId) {
          throw new UnauthorizedException(
            'No perteneces a ningún conglomerado',
          );
        }
        if (current.tenantId !== user.tenantId) {
          throw new UnauthorizedException(
            'No tienes permisos para modificar esta membresía',
          );
        }
      }

      await this.assertCanEditTeamMembership(tx, user, current.tenantId);

      const nextRole = data.role ?? current.role;
      const shouldSyncGranularPermissions =
        data.granularPermissions !== undefined || nextRole !== current.role;

      if (data.granularPermissions !== undefined) {
        const unsupportedPermissions = findUnsupportedGranularPermissions(
          nextRole,
          data.granularPermissions,
        );

        if (unsupportedPermissions.length > 0) {
          throw new BadRequestException(
            `Los permisos granulares ${unsupportedPermissions.join(', ')} solo pueden asignarse explícitamente a COORDINADOR. ADMIN y SU_ADMIN ya lo reciben por rol.`,
          );
        }
      }

      const normalizedGranularPermissions = shouldSyncGranularPermissions
        ? resolveStoredGranularPermissions(
            nextRole,
            data.granularPermissions ?? current.granularPermissions,
          )
        : undefined;

      const requestedGeoScope = this.extractRequestedGeoScope(data);
      const normalizedGeoScope = requestedGeoScope
        ? await this.normalizeMembershipGeoScope(tx, requestedGeoScope)
        : null;

      // 2. Actualizar datos base de la membresía
      await tx.tenantMembership.update({
        where: { id: membershipId },
        data: {
          placa: data.placa !== undefined ? data.placa || null : undefined,
          moto: data.moto !== undefined ? data.moto : undefined,
          direccion:
            data.direccion !== undefined ? data.direccion || null : undefined,
          municipioId:
            requestedGeoScope && requestedGeoScope.hasMunicipalityInput
              ? normalizedGeoScope?.primaryMunicipioId
              : data.municipioId !== undefined
                ? data.municipioId || null
                : undefined,
          role: data.role,
          granularPermissions: shouldSyncGranularPermissions
            ? normalizedGranularPermissions
            : undefined,
          activo: data.activo,
        },
      });

      // 3. Actualizar datos del usuario si se proporcionan
      if (
        data.nombre ||
        data.apellido ||
        data.email ||
        data.telefono !== undefined ||
        data.tipoDocumento !== undefined ||
        data.numeroDocumento !== undefined
      ) {
        if (data.email) {
          const normalizedEmail = data.email.trim().toLowerCase();
          const existingUserWithEmail = await tx.user.findFirst({
            where: {
              email: normalizedEmail,
              id: { not: current.userId },
            },
            select: { id: true },
          });

          if (existingUserWithEmail) {
            throw new ConflictException(
              'El correo electrónico ya está en uso por otro usuario',
            );
          }
        }

        // Separar nombre y apellido si solo se envía nombre (en el frontend a veces se envía completo)
        let nombre = data.nombre;
        let apellido = data.apellido;

        if (nombre && !apellido && nombre.includes(' ')) {
          const parts = nombre.trim().split(' ');
          nombre = parts[0];
          apellido = parts.slice(1).join(' ');
        }

        await tx.user.update({
          where: { id: current.userId },
          data: {
            nombre: nombre || undefined,
            apellido: apellido || undefined,
            email: data.email ? data.email.trim().toLowerCase() : undefined,
            telefono: data.telefono !== undefined ? data.telefono : undefined,
            tipoDocumento:
              data.tipoDocumento !== undefined
                ? data.tipoDocumento || null
                : undefined,
            numeroDocumento:
              data.numeroDocumento !== undefined
                ? data.numeroDocumento || null
                : undefined,
          },
        });
      }

      // 4. Sincronizar empresas si se proporcionan
      if (data.empresaIds) {
        // Eliminar vinculaciones previas
        await tx.empresaMembership.deleteMany({
          where: { membershipId },
        });

        // Crear nuevas vinculaciones
        if (data.empresaIds.length > 0) {
          await tx.empresaMembership.createMany({
            data: data.empresaIds.map((empresaId) => ({
              tenantId: current.tenantId,
              membershipId,
              empresaId,
              role: data.role || current.role, // Usar el nuevo rol o el actual
            })),
          });
        }
      }

      if (
        requestedGeoScope &&
        (requestedGeoScope.hasDepartmentInput ||
          requestedGeoScope.hasMunicipalityInput)
      ) {
        await tx.tenantMembershipDepartmentScope.deleteMany({
          where: {
            tenantId: current.tenantId,
            membershipId,
          },
        });

        if (normalizedGeoScope?.departmentIds.length) {
          await tx.tenantMembershipDepartmentScope.createMany({
            data: normalizedGeoScope.departmentIds.map((departmentId) => ({
              tenantId: current.tenantId,
              membershipId,
              departmentId,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (requestedGeoScope && requestedGeoScope.hasMunicipalityInput) {
        await tx.tenantMembershipMunicipalityScope.deleteMany({
          where: {
            tenantId: current.tenantId,
            membershipId,
          },
        });

        if (normalizedGeoScope?.municipalityIds.length) {
          await tx.tenantMembershipMunicipalityScope.createMany({
            data: normalizedGeoScope.municipalityIds.map((municipalityId) => ({
              tenantId: current.tenantId,
              membershipId,
              municipalityId,
            })),
            skipDuplicates: true,
          });
        }
      }

      const shouldSyncPaymentAccount =
        data.banco !== undefined ||
        data.tipoCuenta !== undefined ||
        data.numeroCuenta !== undefined ||
        data.valorHora !== undefined;

      if (shouldSyncPaymentAccount) {
        let empresaId = data.cuentaPagoEmpresaId;

        if (!empresaId) {
          const primaryEmpresaMembership = await tx.empresaMembership.findFirst(
            {
              where: {
                membershipId,
                tenantId: current.tenantId,
                activo: true,
                deletedAt: null,
              },
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                empresaId: true,
              },
            },
          );

          empresaId = primaryEmpresaMembership?.empresaId;
        }

        if (!empresaId) {
          throw new BadRequestException(
            'No se pudo resolver la empresa para guardar la cuenta de pago',
          );
        }

        const existingCuentaPago = await tx.cuentasPago.findFirst({
          where: {
            tenantId: current.tenantId,
            membershipId,
            empresaId,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        const cuentaPagoData = {
          banco: data.banco || 'Sin definir',
          tipoCuenta: data.tipoCuenta || 'Sin definir',
          numeroCuenta: data.numeroCuenta || 'Sin definir',
          valorHora:
            data.valorHora !== undefined && data.valorHora !== null
              ? data.valorHora
              : null,
        };

        if (existingCuentaPago) {
          await tx.cuentasPago.update({
            where: {
              id: existingCuentaPago.id,
            },
            data: cuentaPagoData,
          });
        } else {
          await tx.cuentasPago.create({
            data: {
              tenantId: current.tenantId,
              empresaId,
              membershipId,
              ...cuentaPagoData,
            },
          });
        }
      }

      const refreshed = await tx.tenantMembership.findUnique({
        where: { id: membershipId },
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
          municipio: {
            select: {
              id: true,
              name: true,
              departmentId: true,
            },
          },
          departmentScopes: {
            select: {
              departmentId: true,
            },
          },
          municipalityScopes: {
            select: {
              municipalityId: true,
            },
          },
        },
      });

      if (!refreshed) {
        throw new NotFoundException('Membresía no encontrada');
      }

      return this.decorateMembershipGeoScopes(refreshed);
    });
  }

  async findAll() {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { memberships: true, empresas: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                nombre: true,
                apellido: true,
                email: true,
              },
            },
          },
        },
        empresas: true,
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('El conglomerado no existe');
    }

    return tenant;
  }

  async findAllMemberships(
    tenantId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const parsedStart = startDate
      ? parseBogotaDateToUtcStart(startDate)
      : undefined;
    const parsedEnd = endDate
      ? parseBogotaDateToUtcEnd(endDate)
      : endOfBogotaDayUtc(new Date());
    if ((startDate && !parsedStart) || (endDate && !parsedEnd)) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    const start = parsedStart;
    const end = parsedEnd as Date;

    const whereServicios: Prisma.OrdenServicioWhereInput = {
      fechaVisita: {
        lte: end,
        ...(start ? { gte: start } : {}),
      },
    };

    return this.prisma.tenantMembership
      .findMany({
        where: {
          tenantId,
          activo: true,
        },
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
          municipio: true,
          departmentScopes: {
            select: {
              departmentId: true,
            },
          },
          municipalityScopes: {
            select: {
              municipalityId: true,
            },
          },
          empresaMemberships: {
            select: {
              empresaId: true,
              empresa: {
                select: {
                  nombre: true,
                },
              },
            },
          },
          serviciosCreados: {
            where: whereServicios,
            select: {
              id: true,
              numeroOrden: true,
              fechaVisita: true,
              valorPagado: true,
              estadoServicio: true,
              tipoVisita: true,
              cliente: {
                select: {
                  nombre: true,
                  apellido: true,
                  razonSocial: true,
                },
              },
            },
          },
          serviciosAsignados: {
            where: whereServicios,
            select: {
              id: true,
              numeroOrden: true,
              fechaVisita: true,
              valorPagado: true,
              estadoServicio: true,
              tipoVisita: true,
              cliente: {
                select: {
                  nombre: true,
                  apellido: true,
                  razonSocial: true,
                },
              },
            },
          },
          _count: {
            select: {
              serviciosAsignados: true,
            },
          },
        },
        orderBy: {
          user: {
            nombre: 'asc',
          },
        },
      })
      .then((memberships) =>
        memberships.map((membership) =>
          this.decorateMembershipGeoScopes(membership),
        ),
      );
  }

  async getTeamPerformance(
    tenantId: string,
    user: JwtPayload,
    query: TeamPerformanceQueryDto,
  ) {
    const range = this.parseRange(query.from, query.to);
    const previousRange = this.getPreviousRange(range);
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const scope = query.scope || TeamScope.OPERATIVO;

    const access = this.resolveAccessScope(tenantId, user);
    const empresaIds = this.resolveFilterIds(
      query.empresaId,
      access.allowedEmpresaIds,
      'empresa',
    );
    const zonaIds = this.resolveFilterIds(
      query.zonaId,
      access.allowedZonaIds,
      'zona',
    );

    // Si tenantId es 'global' y el usuario es global SU_ADMIN, targetTenantId será nulo (acceso a todo)
    // De lo contrario, usamos el tenantId solicitado obligatoriamente
    const targetTenantId =
      tenantId === 'global' && user.isGlobalSuAdmin ? null : tenantId;

    const tenantWhere = targetTenantId ? { tenantId: targetTenantId } : {};

    const membershipWhere: Prisma.TenantMembershipWhereInput = {
      ...tenantWhere,
      aprobado: true,
      activo: query.activo !== undefined ? query.activo : true,
      ...(query.roles?.length
        ? { role: { in: query.roles } }
        : scope === TeamScope.OPERATIVO
          ? { role: { in: [...OPERATIVE_ROLES] } }
          : {}),
      ...(query.role && !query.roles?.length ? { role: query.role } : {}),
      ...(query.municipioId ? { municipioId: query.municipioId } : {}),
      ...(query.search
        ? {
            OR: [
              {
                user: {
                  nombre: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  apellido: { contains: query.search, mode: 'insensitive' },
                },
              },
              {
                user: {
                  email: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
      ...(access.onlyOwnMembershipId ? { id: access.onlyOwnMembershipId } : {}),
      ...(empresaIds || zonaIds
        ? {
            empresaMemberships: {
              some: {
                ...(empresaIds ? { empresaId: { in: empresaIds } } : {}),
                ...(zonaIds ? { zonaId: { in: zonaIds } } : {}),
              },
            },
          }
        : {}),
    };

    // Fetch all matching memberships to group them by person
    const allMemberships = await this.prisma.tenantMembership.findMany({
      where: membershipWhere,
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
        municipio: {
          select: {
            id: true,
            name: true,
          },
        },
        empresaMemberships: {
          where: {
            ...(empresaIds ? { empresaId: { in: empresaIds } } : {}),
            ...(zonaIds ? { zonaId: { in: zonaIds } } : {}),
          },
          select: {
            empresaId: true,
            zonaId: true,
            empresa: {
              select: {
                nombre: true,
              },
            },
            zona: {
              select: {
                id: true,
                nombre: true,
              },
            },
          },
        },
        _count: {
          select: {
            clientesCreados: {
              where: {
                createdAt: { gte: range.from, lte: range.to },
              },
            },
          },
        },
      },
      orderBy: [{ user: { nombre: 'asc' } }, { user: { apellido: 'asc' } }],
    });

    const membershipIds = allMemberships.map((m) => m.id);
    const ordersWhere: Prisma.OrdenServicioWhereInput = {
      ...tenantWhere,
      creadoPorId: {
        in: membershipIds.length > 0 ? membershipIds : [NIL_UUID],
      },
      fechaVisita: {
        gte: range.from,
        lte: range.to,
      },
      ...(empresaIds ? { empresaId: { in: empresaIds } } : {}),
      ...(zonaIds ? { zonaId: { in: zonaIds } } : {}),
    };

    const previousOrdersWhere: Prisma.OrdenServicioWhereInput = {
      ...ordersWhere,
      fechaVisita: {
        gte: previousRange.from,
        lte: previousRange.to,
      },
    };

    const [orders, previousOrders] = await Promise.all([
      this.prisma.ordenServicio.findMany({
        where: ordersWhere,
        select: {
          id: true,
          creadoPorId: true,
          tecnicoId: true,
          estadoServicio: true,
          valorPagado: true,
          valorCotizado: true,
          tipoVisita: true,
          fechaVisita: true,
          liquidadoAt: true,
          estadoPago: true,
          empresaId: true,
          zonaId: true,
        },
      }),
      this.prisma.ordenServicio.findMany({
        where: previousOrdersWhere,
        select: {
          estadoServicio: true,
          valorPagado: true,
        },
      }),
    ]);

    const statsByMembership = new Map<
      string,
      {
        totalServicios: number;
        serviciosLiquidados: number;
        totalRecaudo: number;
        recaudoNuevos: number;
        recaudoRefuerzo: number;
        pendientes: number;
        cancellations: number;
        reschedulings: number;
        agedPending: number;
        reworkCount: number;
        overdueDebt: number;
        liquidationTimeMs: number;
      }
    >();

    for (const membership of allMemberships) {
      statsByMembership.set(membership.id, {
        totalServicios: 0,
        serviciosLiquidados: 0,
        totalRecaudo: 0,
        recaudoNuevos: 0,
        recaudoRefuerzo: 0,
        pendientes: 0,
        cancellations: 0,
        reschedulings: 0,
        agedPending: 0,
        reworkCount: 0,
        overdueDebt: 0,
        liquidationTimeMs: 0,
      });
    }

    const now = nowUtc();

    for (const order of orders) {
      if (!order.creadoPorId) {
        continue;
      }

      const current = statsByMembership.get(order.creadoPorId);
      if (!current) {
        continue;
      }

      current.totalServicios += 1;
      const isLiquidated = order.estadoServicio === EstadoOrden.LIQUIDADO;
      const paid = this.toNumber(order.valorPagado);
      const quoted = this.toNumber(order.valorCotizado);

      // Recaudo: Sumamos solo si el servicio está LIQUIDADO
      if (paid > 0 && isLiquidated) {
        current.totalRecaudo += paid;
        if (order.tipoVisita && NEW_VISIT_TYPES.has(order.tipoVisita)) {
          current.recaudoNuevos += paid;
        } else {
          current.recaudoRefuerzo += paid;
        }
      }

      if (order.estadoServicio === EstadoOrden.CANCELADO)
        current.cancellations += 1;
      if (order.estadoServicio === EstadoOrden.REPROGRAMADO)
        current.reschedulings += 1;
      if (order.tipoVisita && REWORK_VISIT_TYPES.has(order.tipoVisita))
        current.reworkCount += 1;

      if (isLiquidated) {
        current.serviciosLiquidados += 1;

        if (order.liquidadoAt && order.fechaVisita) {
          current.liquidationTimeMs += Math.max(
            0,
            order.liquidadoAt.getTime() - order.fechaVisita.getTime(),
          );
        }

        if (order.estadoPago === 'PENDIENTE' && quoted > paid) {
          current.overdueDebt += quoted - paid;
        }
      } else if (order.estadoServicio !== EstadoOrden.CANCELADO) {
        current.pendientes += 1;
        if (order.fechaVisita && order.fechaVisita < now) {
          current.agedPending += 1;
        }
      }
    }

    // Group memberships by person (User ID)
    const personGroups = new Map<string, typeof allMemberships>();
    for (const m of allMemberships) {
      const key = m.user.id;
      if (!personGroups.has(key)) {
        personGroups.set(key, []);
      }
      personGroups.get(key)!.push(m);
    }

    const consolidatedMembers = Array.from(personGroups.values()).map(
      (memberships) => {
        // Aggregate stats
        const aggregatedStats = memberships.reduce(
          (acc, m) => {
            const stats = statsByMembership.get(m.id)!;
            acc.totalServicios += stats.totalServicios;
            acc.serviciosLiquidados += stats.serviciosLiquidados;
            acc.totalRecaudo += stats.totalRecaudo;
            acc.recaudoNuevos += stats.recaudoNuevos;
            acc.recaudoRefuerzo += stats.recaudoRefuerzo;
            acc.pendientes += stats.pendientes;
            acc.cancellations += stats.cancellations;
            acc.reschedulings += stats.reschedulings;
            acc.agedPending += stats.agedPending;
            acc.reworkCount += stats.reworkCount;
            acc.overdueDebt += stats.overdueDebt;
            acc.liquidationTimeMs += stats.liquidationTimeMs;
            acc.clientesCreados += m._count.clientesCreados;
            return acc;
          },
          {
            totalServicios: 0,
            serviciosLiquidados: 0,
            totalRecaudo: 0,
            recaudoNuevos: 0,
            recaudoRefuerzo: 0,
            pendientes: 0,
            cancellations: 0,
            reschedulings: 0,
            agedPending: 0,
            reworkCount: 0,
            overdueDebt: 0,
            liquidationTimeMs: 0,
            clientesCreados: 0,
          },
        );

        // Find primary membership (most totalServicios)
        const primary = memberships.reduce((prev, curr) => {
          const prevStats = statsByMembership.get(prev.id)!;
          const currStats = statsByMembership.get(curr.id)!;
          return currStats.totalServicios > prevStats.totalServicios
            ? curr
            : prev;
        });

        const efectividad =
          aggregatedStats.totalServicios > 0
            ? Math.round(
                (aggregatedStats.serviciosLiquidados /
                  aggregatedStats.totalServicios) *
                  100,
              )
            : 0;

        const avgTicket =
          aggregatedStats.serviciosLiquidados > 0
            ? Math.round(
                aggregatedStats.totalRecaudo /
                  aggregatedStats.serviciosLiquidados,
              )
            : 0;

        const conversionRate =
          aggregatedStats.clientesCreados > 0
            ? Math.round(
                (aggregatedStats.totalServicios /
                  aggregatedStats.clientesCreados) *
                  100,
              )
            : 0;

        const avgLiquidationDays =
          aggregatedStats.serviciosLiquidados > 0
            ? Math.round(
                (aggregatedStats.liquidationTimeMs /
                  aggregatedStats.serviciosLiquidados /
                  (1000 * 60 * 60 * 24)) *
                  10,
              ) / 10
            : 0;

        // Unique empresas and zonas across all memberships of the person
        const empresaIds = [
          ...new Set(
            memberships.flatMap((m) =>
              m.empresaMemberships.map((em) => em.empresaId),
            ),
          ),
        ];
        const empresaNombres = [
          ...new Set(
            memberships.flatMap((m) =>
              m.empresaMemberships.map((em) => em.empresa.nombre),
            ),
          ),
        ];
        const zonaIds = [
          ...new Set(
            memberships
              .flatMap((m) => m.empresaMemberships.map((em) => em.zona?.id))
              .filter((id): id is string => !!id),
          ),
        ];
        const zonaNombres = [
          ...new Set(
            memberships
              .flatMap((m) => m.empresaMemberships.map((em) => em.zona?.nombre))
              .filter((name): name is string => !!name),
          ),
        ];

        return {
          id: primary.id,
          name: `${primary.user.nombre} ${primary.user.apellido}`.trim(),
          email: primary.user.email,
          phone: primary.user.telefono || 'Sin teléfono',
          role: primary.role,
          joinDate: primary.createdAt,
          placa: primary.placa,
          moto: primary.moto,
          direccion: primary.direccion,
          municipioId: primary.municipioId,
          municipioNombre: primary.municipio?.name || null,
          empresaIds,
          empresaNombres,
          zonaIds,
          zonaNombres,
          totalServicios: aggregatedStats.totalServicios,
          serviciosLiquidados: aggregatedStats.serviciosLiquidados,
          pendientes: aggregatedStats.pendientes,
          totalRecaudo: aggregatedStats.totalRecaudo,
          recaudoNuevos: aggregatedStats.recaudoNuevos,
          recaudoRefuerzo: aggregatedStats.recaudoRefuerzo,
          efectividad,
          clientesCreados: aggregatedStats.clientesCreados,
          conversionRate,
          avgTicket,
          avgLiquidationDays,
          overdueDebt: aggregatedStats.overdueDebt,
          cancellations: aggregatedStats.cancellations,
          reschedulings: aggregatedStats.reschedulings,
          agedPending: aggregatedStats.agedPending,
          reworkRate:
            aggregatedStats.totalServicios > 0
              ? Math.round(
                  (aggregatedStats.reworkCount /
                    aggregatedStats.totalServicios) *
                    100,
                )
              : 0,
        };
      },
    );

    consolidatedMembers.sort((a, b) => b.totalRecaudo - a.totalRecaudo);

    const kpis = this.buildKpis(consolidatedMembers);
    const previousKpis = this.buildKpisFromOrders(previousOrders);

    const alerts = {
      noActivity: consolidatedMembers
        .filter((member) => member.totalServicios === 0)
        .slice(0, 8)
        .map((member) => ({
          membershipId: member.id,
          name: member.name,
          role: member.role,
        })),
      lowEffectiveness: consolidatedMembers
        .filter(
          (member) => member.totalServicios >= 3 && member.efectividad < 60,
        )
        .slice(0, 8)
        .map((member) => ({
          membershipId: member.id,
          name: member.name,
          efectividad: member.efectividad,
        })),
      pendingLiquidation: consolidatedMembers
        .filter((member) => member.pendientes >= 5)
        .slice(0, 8)
        .map((member) => ({
          membershipId: member.id,
          name: member.name,
          pendientes: member.pendientes,
        })),
    };

    const paginatedMembers = consolidatedMembers.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    return {
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      kpis: {
        ...kpis,
        comparison: {
          totalRecaudoChangePct: this.computePctChange(
            kpis.totalRecaudo,
            previousKpis.totalRecaudo,
          ),
          serviciosLiquidadosChangePct: this.computePctChange(
            kpis.serviciosLiquidados,
            previousKpis.serviciosLiquidados,
          ),
          efectividadChangePct: this.computePctChange(
            kpis.efectividadEquipo,
            previousKpis.efectividadEquipo,
          ),
        },
      },
      alerts,
      pagination: {
        page,
        pageSize,
        total: consolidatedMembers.length,
        totalPages: Math.max(
          1,
          Math.ceil(consolidatedMembers.length / pageSize),
        ),
      },
      members: paginatedMembers,
    };
  }

  async getTeamMemberDetail(
    tenantId: string,
    membershipId: string,
    user: JwtPayload,
    query: TeamMemberDetailQueryDto,
  ) {
    const range = this.parseRange(query.from, query.to);
    const page = query.page || 1;
    const pageSize = query.pageSize || 15;

    const access = this.resolveAccessScope(tenantId, user);
    const empresaIds = this.resolveFilterIds(
      query.empresaId,
      access.allowedEmpresaIds,
      'empresa',
    );
    const zonaIds = this.resolveFilterIds(
      query.zonaId,
      access.allowedZonaIds,
      'zona',
    );
    const tenantWhere = access.targetTenantId
      ? { tenantId: access.targetTenantId }
      : {};

    if (
      access.onlyOwnMembershipId &&
      access.onlyOwnMembershipId !== membershipId
    ) {
      throw new UnauthorizedException(
        'No tienes permisos para consultar el detalle de este usuario',
      );
    }

    const membership = await this.prisma.tenantMembership.findFirst({
      where: {
        id: membershipId,
        ...tenantWhere,
        aprobado: true,
        activo: true,
        ...(empresaIds || zonaIds
          ? {
              empresaMemberships: {
                some: {
                  ...(empresaIds ? { empresaId: { in: empresaIds } } : {}),
                  ...(zonaIds ? { zonaId: { in: zonaIds } } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        user: {
          select: {
            nombre: true,
            apellido: true,
            email: true,
            telefono: true,
          },
        },
      },
    });

    if (!membership) {
      throw new NotFoundException('Usuario no encontrado en el conglomerado');
    }

    const ordersWhere: Prisma.OrdenServicioWhereInput = {
      ...tenantWhere,
      creadoPorId: membershipId,
      fechaVisita: {
        gte: range.from,
        lte: range.to,
      },
      ...(empresaIds ? { empresaId: { in: empresaIds } } : {}),
      ...(zonaIds ? { zonaId: { in: zonaIds } } : {}),
    };

    const metricsWhere: Prisma.OrdenServicioWhereInput = {
      ...ordersWhere,
    };

    const [orders, total, metricOrders, clientesCreados] = await Promise.all([
      this.prisma.ordenServicio.findMany({
        where: ordersWhere,
        select: {
          id: true,
          numeroOrden: true,
          fechaVisita: true,
          estadoServicio: true,
          valorPagado: true,
          valorCotizado: true,
          tipoVisita: true,
          liquidadoAt: true,
          estadoPago: true,
          cliente: {
            select: {
              nombre: true,
              apellido: true,
              razonSocial: true,
            },
          },
        },
        orderBy: {
          fechaVisita: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ordenServicio.count({
        where: ordersWhere,
      }),
      this.prisma.ordenServicio.findMany({
        where: metricsWhere,
        select: {
          estadoServicio: true,
          valorPagado: true,
          valorCotizado: true,
          tipoVisita: true,
          fechaVisita: true,
          liquidadoAt: true,
          estadoPago: true,
        },
      }),
      this.prisma.cliente.count({
        where: {
          ...tenantWhere,
          creadoPorId: membershipId,
          createdAt: {
            gte: range.from,
            lte: range.to,
          },
          ...(empresaIds ? { empresaId: { in: empresaIds } } : {}),
        },
      }),
    ]);

    let totalServicios = 0;
    let serviciosLiquidados = 0;
    let totalRecaudo = 0;
    let recaudoNuevos = 0;
    let recaudoRefuerzo = 0;
    let cancellations = 0;
    let reschedulings = 0;
    let agedPending = 0;
    let reworkCount = 0;
    let overdueDebt = 0;
    let liquidationTimeMs = 0;

    const now = nowUtc();

    for (const order of metricOrders) {
      totalServicios += 1;
      const paid = this.toNumber(order.valorPagado);
      const quoted = this.toNumber(order.valorCotizado);

      if (order.estadoServicio === EstadoOrden.CANCELADO) cancellations += 1;
      if (order.estadoServicio === EstadoOrden.REPROGRAMADO) reschedulings += 1;
      if (order.tipoVisita && REWORK_VISIT_TYPES.has(order.tipoVisita))
        reworkCount += 1;

      if (order.estadoServicio === EstadoOrden.LIQUIDADO) {
        serviciosLiquidados += 1;
        totalRecaudo += paid;
        if (order.tipoVisita && NEW_VISIT_TYPES.has(order.tipoVisita)) {
          recaudoNuevos += paid;
        } else {
          recaudoRefuerzo += paid;
        }

        if (order.liquidadoAt && order.fechaVisita) {
          liquidationTimeMs += Math.max(
            0,
            order.liquidadoAt.getTime() - order.fechaVisita.getTime(),
          );
        }

        if (order.estadoPago === 'PENDIENTE' && quoted > paid) {
          overdueDebt += quoted - paid;
        }
      } else if (order.estadoServicio !== EstadoOrden.CANCELADO) {
        if (order.fechaVisita && order.fechaVisita < now) {
          agedPending += 1;
        }
      }
    }

    const conversionRate =
      clientesCreados > 0
        ? Math.round((totalServicios / clientesCreados) * 100)
        : 0;
    const avgTicket =
      serviciosLiquidados > 0
        ? Math.round(totalRecaudo / serviciosLiquidados)
        : 0;
    const avgLiquidationDays =
      serviciosLiquidados > 0
        ? Math.round(
            (liquidationTimeMs / serviciosLiquidados / (1000 * 60 * 60 * 24)) *
              10,
          ) / 10
        : 0;

    return {
      member: {
        id: membership.id,
        name: `${membership.user.nombre} ${membership.user.apellido}`.trim(),
        email: membership.user.email,
        phone: membership.user.telefono || null,
        role: membership.role,
      },
      metrics: {
        clientesCreados,
        totalServicios,
        serviciosLiquidados,
        pendientes: Math.max(0, totalServicios - serviciosLiquidados),
        totalRecaudo,
        recaudoNuevos,
        recaudoRefuerzo,
        efectividad:
          totalServicios > 0
            ? Math.round((serviciosLiquidados / totalServicios) * 100)
            : 0,
        conversionRate,
        avgTicket,
        avgLiquidationDays,
        overdueDebt,
        cancellations,
        reschedulings,
        agedPending,
        reworkRate:
          totalServicios > 0
            ? Math.round((reworkCount / totalServicios) * 100)
            : 0,
      },
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.numeroOrden || 'N/A',
        date: order.fechaVisita,
        status: order.estadoServicio,
        paidValue: this.toNumber(order.valorPagado),
        type: order.tipoVisita,
        client:
          order.cliente.razonSocial ||
          `${order.cliente.nombre || ''} ${order.cliente.apellido || ''}`.trim(),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  private parseRange(from?: string, to?: string): DateRange {
    const now = new Date();
    const end = to ? parseBogotaDateToUtcEnd(to) : endOfBogotaDayUtc(now);
    if (!end) {
      throw new BadRequestException('Rango de fechas inválido');
    }

    const start = from
      ? parseBogotaDateToUtcStart(from)
      : startOfBogotaMonthUtc(end);
    if (!start) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    const normalizedStart = from ? start : startOfBogotaDayUtc(start);

    if (
      Number.isNaN(normalizedStart.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      throw new BadRequestException('Rango de fechas inválido');
    }
    if (normalizedStart > end) {
      throw new BadRequestException(
        'La fecha inicial no puede ser mayor a la fecha final',
      );
    }

    return { from: normalizedStart, to: end };
  }

  private getPreviousRange(range: DateRange): DateRange {
    const length = range.to.getTime() - range.from.getTime();
    const prevTo = new Date(range.from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - length);
    return { from: prevFrom, to: prevTo };
  }

  private resolveAccessScope(tenantId: string, user: JwtPayload) {
    const accessFilter = getPrismaAccessFilter(user);
    const isGlobalScope = tenantId === 'global' && user.isGlobalSuAdmin;

    // Si el usuario no tiene acceso a este tenant específico (y no es Global SU_ADMIN)
    if (!isGlobalScope && !user.isGlobalSuAdmin && user.tenantId !== tenantId) {
      throw new UnauthorizedException('No tienes acceso a este conglomerado');
    }

    let allowedEmpresaIds: string[] | null = null;
    if (typeof accessFilter.empresaId === 'string') {
      allowedEmpresaIds = [accessFilter.empresaId];
    } else if (accessFilter.empresaId && 'in' in accessFilter.empresaId) {
      allowedEmpresaIds = accessFilter.empresaId.in;
    }

    return {
      targetTenantId: isGlobalScope ? null : tenantId,
      onlyOwnMembershipId:
        user.role === Role.OPERADOR ? user.membershipId : null,
      allowedEmpresaIds,
      allowedZonaIds: null as string[] | null, // Se puede expandir luego si se requiere filtrar por zona en el JWT
    };
  }

  private resolveFilterIds(
    requestedId: string | undefined,
    allowedIds: string[] | null,
    resource: 'empresa' | 'zona',
  ) {
    if (allowedIds === null) {
      return requestedId ? [requestedId] : undefined;
    }

    if (requestedId) {
      if (!allowedIds.includes(requestedId)) {
        throw new UnauthorizedException(
          `No tienes permisos sobre la ${resource} solicitada`,
        );
      }
      return [requestedId];
    }

    return allowedIds.length > 0 ? allowedIds : [NIL_UUID];
  }

  async inviteMember(tenantId: string, dto: InviteMemberDto, user: JwtPayload) {
    const { role, nombre, apellido, telefono } = dto;
    const email = dto.email.trim().toLowerCase();
    const normalizedPassword = dto.password?.trim();
    const requestedEmpresaIds = Array.from(
      new Set(
        (dto.empresaIds ?? []).filter(
          (empresaId): empresaId is string => !!empresaId,
        ),
      ),
    );

    await this.assertCanManageTeamMembership(
      this.prisma,
      user,
      tenantId,
      MembershipPermission.TEAM_CREATE,
      'Necesitas TEAM_CREATE para crear miembros del equipo',
    );
    this.assertCanAssignRole(user, role);

    return this.prisma.$transaction(async (tx) => {
      const empresaIds = await this.resolveInviteEmpresaIds(
        tx,
        user,
        tenantId,
        role,
        requestedEmpresaIds,
      );

      // 1. Buscar o crear el usuario
      let targetUser = await tx.user.findUnique({ where: { email } });

      if (!targetUser) {
        const initialPassword = normalizedPassword || 'Tenaxis2026*';
        const defaultPassword = await bcrypt.hash(initialPassword, 10);
        targetUser = await tx.user.create({
          data: {
            email,
            password: defaultPassword,
            nombre,
            apellido: apellido || '',
            telefono: telefono || null,
          },
        });
      }

      // 2. Verificar si ya tiene membresía en este tenant
      const existingMembership = await tx.tenantMembership.findUnique({
        where: {
          userId_tenantId: {
            userId: targetUser.id,
            tenantId,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException(
          'El usuario ya pertenece a este conglomerado',
        );
      }

      // 3. Crear la membresía del tenant
      const membership = await tx.tenantMembership.create({
        data: {
          userId: targetUser.id,
          tenantId,
          role,
          activo: true,
          aprobado: true, // Auto-aprobado por el ADMIN
        },
        include: {
          user: {
            select: {
              nombre: true,
              apellido: true,
              email: true,
            },
          },
        },
      });

      // 4. Crear la vinculación con empresa cuando aplique
      if (empresaIds.length > 0) {
        await tx.empresaMembership.createMany({
          data: empresaIds.map((empresaId) => ({
            tenantId,
            membershipId: membership.id,
            empresaId,
            role,
            activo: true,
          })),
          skipDuplicates: true,
        });
      }

      return membership;
    });
  }

  private async resolveInviteEmpresaIds(
    tx: Prisma.TransactionClient,
    user: JwtPayload,
    tenantId: string,
    role: Role,
    requestedEmpresaIds: string[],
  ): Promise<string[]> {
    const normalizedEmpresaIds = Array.from(new Set(requestedEmpresaIds));

    if (role === Role.OPERADOR && normalizedEmpresaIds.length === 0) {
      throw new BadRequestException(
        'Debes seleccionar una empresa para crear un operador',
      );
    }

    if (normalizedEmpresaIds.length === 0) {
      return [];
    }

    const accessFilter = getPrismaAccessFilter(user);
    const scopedEmpresaIds =
      typeof accessFilter.empresaId === 'string'
        ? [accessFilter.empresaId]
        : accessFilter.empresaId && 'in' in accessFilter.empresaId
          ? accessFilter.empresaId.in
          : null;

    if (scopedEmpresaIds) {
      const scopedSet = new Set(scopedEmpresaIds);
      const forbiddenEmpresaIds = normalizedEmpresaIds.filter(
        (empresaId) => !scopedSet.has(empresaId),
      );

      if (forbiddenEmpresaIds.length > 0) {
        throw new UnauthorizedException(
          'No tienes acceso a una o más empresas seleccionadas',
        );
      }
    }

    const empresas = await tx.empresa.findMany({
      where: {
        tenantId,
        deletedAt: null,
        id: {
          in: normalizedEmpresaIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (empresas.length !== normalizedEmpresaIds.length) {
      throw new BadRequestException(
        'Una o más empresas seleccionadas no existen o no pertenecen al conglomerado',
      );
    }

    return empresas.map((empresa) => empresa.id);
  }

  private buildKpis(
    members: Array<{
      totalRecaudo: number;
      totalServicios: number;
      serviciosLiquidados: number;
      pendientes: number;
    }>,
  ) {
    const totalRecaudo = members.reduce(
      (acc, member) => acc + member.totalRecaudo,
      0,
    );
    const totalServicios = members.reduce(
      (acc, member) => acc + member.totalServicios,
      0,
    );
    const serviciosLiquidados = members.reduce(
      (acc, member) => acc + member.serviciosLiquidados,
      0,
    );
    const serviciosPendientes = members.reduce(
      (acc, member) => acc + member.pendientes,
      0,
    );

    const efectividadEquipo =
      totalServicios > 0
        ? Math.round((serviciosLiquidados / totalServicios) * 100)
        : 0;

    const ticketPromedio =
      serviciosLiquidados > 0 ? totalRecaudo / serviciosLiquidados : 0;

    return {
      totalRecaudo,
      totalServicios,
      serviciosLiquidados,
      serviciosPendientes,
      efectividadEquipo,
      ticketPromedio,
    };
  }

  private buildKpisFromOrders(
    orders: Array<{
      estadoServicio: EstadoOrden;
      valorPagado: Prisma.Decimal | null;
    }>,
  ) {
    let totalRecaudo = 0;
    let serviciosLiquidados = 0;
    let totalServicios = 0;

    for (const order of orders) {
      totalServicios += 1;
      const paid = this.toNumber(order.valorPagado);
      const isLiquidated = order.estadoServicio === EstadoOrden.LIQUIDADO;

      if (paid > 0 && isLiquidated) {
        totalRecaudo += paid;
      }
      if (isLiquidated) {
        serviciosLiquidados += 1;
      }
    }

    return {
      totalRecaudo,
      serviciosLiquidados,
      efectividadEquipo:
        totalServicios > 0
          ? Math.round((serviciosLiquidados / totalServicios) * 100)
          : 0,
    };
  }

  private computePctChange(current: number, previous: number) {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(2));
  }

  private toNumber(value: Prisma.Decimal | number | string | null | undefined) {
    if (value === null || value === undefined) {
      return 0;
    }
    return Number(value) || 0;
  }

  private extractRequestedGeoScope(data: UpdateMembershipDto) {
    const municipalityIds =
      data.municipalityIds !== undefined
        ? data.municipalityIds
        : data.municipioId !== undefined
          ? data.municipioId
            ? [data.municipioId]
            : []
          : undefined;

    const hasDepartmentInput = data.departmentIds !== undefined;
    const hasMunicipalityInput =
      data.municipalityIds !== undefined || data.municipioId !== undefined;

    if (!hasDepartmentInput && !hasMunicipalityInput) {
      return null;
    }

    return {
      departmentIds: data.departmentIds ?? [],
      municipalityIds: municipalityIds ?? [],
      hasDepartmentInput,
      hasMunicipalityInput,
    };
  }

  private async normalizeMembershipGeoScope(
    tx: Prisma.TransactionClient,
    requested: {
      departmentIds: string[];
      municipalityIds: string[];
      hasDepartmentInput: boolean;
      hasMunicipalityInput: boolean;
    },
  ): Promise<NormalizedMembershipGeoScope> {
    const departmentIds = Array.from(new Set(requested.departmentIds));
    const municipalityIds = Array.from(new Set(requested.municipalityIds));

    const municipalityRows = municipalityIds.length
      ? await tx.municipality.findMany({
          where: {
            id: {
              in: municipalityIds,
            },
          },
          select: {
            id: true,
            departmentId: true,
          },
        })
      : [];

    if (municipalityRows.length !== municipalityIds.length) {
      const foundIds = new Set(municipalityRows.map((item) => item.id));
      const missingMunicipalities = municipalityIds.filter(
        (id) => !foundIds.has(id),
      );

      throw new BadRequestException(
        `Hay municipios inválidos en el scope: ${missingMunicipalities.join(', ')}`,
      );
    }

    if (requested.hasDepartmentInput && departmentIds.length > 0) {
      const departmentRows = await tx.department.findMany({
        where: {
          id: {
            in: departmentIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (departmentRows.length !== departmentIds.length) {
        const foundIds = new Set(departmentRows.map((item) => item.id));
        const missingDepartments = departmentIds.filter(
          (id) => !foundIds.has(id),
        );

        throw new BadRequestException(
          `Hay departamentos inválidos en el scope: ${missingDepartments.join(', ')}`,
        );
      }
    }

    const municipalityDepartmentIds = Array.from(
      new Set(municipalityRows.map((item) => item.departmentId)),
    );

    let finalDepartmentIds = departmentIds;

    if (!requested.hasDepartmentInput && municipalityDepartmentIds.length > 0) {
      finalDepartmentIds = municipalityDepartmentIds;
    }

    if (requested.hasDepartmentInput && municipalityIds.length > 0) {
      const allowedDepartmentIds = new Set(departmentIds);
      const invalidMunicipalities = municipalityRows.filter(
        (municipality) => !allowedDepartmentIds.has(municipality.departmentId),
      );

      if (invalidMunicipalities.length > 0) {
        const invalidMunicipalityIds = invalidMunicipalities.map(
          (municipality) => municipality.id,
        );
        throw new BadRequestException(
          `Los municipios seleccionados no pertenecen a los departamentos indicados: ${invalidMunicipalityIds.join(', ')}`,
        );
      }
    }

    return {
      departmentIds: finalDepartmentIds,
      municipalityIds,
      primaryMunicipioId: municipalityIds[0] ?? null,
    };
  }

  private decorateMembershipGeoScopes<T extends MembershipGeoScopeRelation>(
    membership: T,
  ) {
    const permissionState = buildMembershipPermissionState(
      membership.role,
      membership.granularPermissions,
    );

    return {
      ...membership,
      granularPermissions: permissionState.granularPermissions,
      effectivePermissions: permissionState.permissions,
      departmentIds: Array.from(
        new Set(
          (membership.departmentScopes || [])
            .map((scope) => scope.departmentId)
            .filter((departmentId): departmentId is string => !!departmentId),
        ),
      ),
      municipalityIds: Array.from(
        new Set(
          (membership.municipalityScopes || [])
            .map((scope) => scope.municipalityId)
            .filter(
              (municipalityId): municipalityId is string => !!municipalityId,
            ),
        ),
      ),
    };
  }

  private async assertCanEditTeamMembership(
    tx: Prisma.TransactionClient,
    user: JwtPayload,
    tenantId: string,
  ): Promise<void> {
    await this.assertCanManageTeamMembership(
      tx,
      user,
      tenantId,
      MembershipPermission.TEAM_EDIT,
      'Necesitas TEAM_EDIT para modificar miembros del equipo',
    );
  }

  private async assertCanManageTeamMembership(
    tx: Prisma.TransactionClient | PrismaService,
    user: JwtPayload,
    tenantId: string,
    permission: MembershipPermission,
    errorMessage: string,
  ): Promise<void> {
    if (user.isGlobalSuAdmin) {
      return;
    }

    if (!user.tenantId || user.tenantId !== tenantId) {
      throw new UnauthorizedException(
        'No tienes permisos para modificar esta membresía',
      );
    }

    if (!user.membershipId) {
      throw new UnauthorizedException(
        'No se pudo resolver tu membresía activa en este conglomerado',
      );
    }

    const actorMembership = await tx.tenantMembership.findFirst({
      where: {
        id: user.membershipId,
        tenantId,
        userId: user.sub,
        activo: true,
        aprobado: true,
      },
      select: {
        role: true,
        granularPermissions: true,
      },
    });

    if (!actorMembership) {
      throw new UnauthorizedException(
        'No se pudo resolver tu membresía activa en este conglomerado',
      );
    }

    const actorRole =
      process.env.NODE_ENV === 'production'
        ? actorMembership.role
        : user.role || actorMembership.role;

    if (
      !hasMembershipPermission(
        actorRole,
        actorMembership.granularPermissions,
        permission,
      )
    ) {
      throw new UnauthorizedException(errorMessage);
    }
  }

  private assertCanAssignRole(user: JwtPayload, targetRole: Role): void {
    const actorRole = user.role;

    if (!actorRole) {
      throw new UnauthorizedException(
        'No se pudo resolver tu rol activo para asignar el nuevo usuario',
      );
    }

    if (user.isGlobalSuAdmin && targetRole === Role.SU_ADMIN) {
      return;
    }

    const allowedRoles = MANAGEABLE_MEMBER_ROLES_BY_ACTOR[actorRole] || [];

    if (!allowedRoles.includes(targetRole)) {
      throw new UnauthorizedException(
        `El rol ${actorRole} no puede asignar el rol ${targetRole}`,
      );
    }
  }
}
