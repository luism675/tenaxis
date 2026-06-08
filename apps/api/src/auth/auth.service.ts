import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '../generated/client/client';
import { JwtService } from '@nestjs/jwt';
import { MonitoringService } from '../monitoring/monitoring.service';
import { JwtPayload } from './jwt-payload.interface';
import { resolveEffectiveRoleState } from '../common/utils/dev-role-override.util';
import { buildMembershipPermissionState } from './membership-permissions.util';

const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const REFRESH_TOKEN_RANDOM_BYTES = 64;
const REFRESH_TOKEN_HASH_ROUNDS = 10;
const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30;
const PASSWORD_RESET_TOKEN_RANDOM_BYTES = 48;
const PASSWORD_RESET_TOKEN_HASH_ROUNDS = 10;
const NO_MONITORING_SESSION = 'none';
const PASSWORD_RESET_GENERIC_MESSAGE =
  'Si el correo existe en Tenaxis, recibirás instrucciones para restablecer tu contraseña.';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    @Inject(forwardRef(() => MonitoringService))
    private monitoringService: MonitoringService,
  ) {}

  private getRefreshTokenTtlMs(): number {
    const configuredDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
    const days =
      Number.isFinite(configuredDays) && configuredDays > 0
        ? configuredDays
        : DEFAULT_REFRESH_TOKEN_TTL_DAYS;

    return days * 24 * 60 * 60 * 1000;
  }

  private getRefreshTokenExpiresAt(): Date {
    return new Date(Date.now() + this.getRefreshTokenTtlMs());
  }

  private getPasswordResetExpiresAt(): Date {
    return new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
  }

  private buildPasswordResetUrl(token: string): string {
    const frontendUrl =
      process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL;
    const baseUrl = frontendUrl?.replace(/\/$/, '') || 'http://localhost:3000';
    return `${baseUrl}/reiniciar-contraseña?token=${encodeURIComponent(token)}`;
  }

  private buildRefreshToken(
    authSessionId: string,
    monitoringSessionId?: string,
  ): string {
    const secret = randomBytes(REFRESH_TOKEN_RANDOM_BYTES).toString(
      'base64url',
    );

    return `${authSessionId}.${monitoringSessionId || NO_MONITORING_SESSION}.${secret}`;
  }

  private parseRefreshToken(refreshToken?: string): {
    authSessionId: string;
    monitoringSessionId?: string;
  } | null {
    if (!refreshToken) {
      return null;
    }

    const [authSessionId, monitoringSessionId, secret] =
      refreshToken.split('.');

    if (!authSessionId || !monitoringSessionId || !secret) {
      return null;
    }

    return {
      authSessionId,
      monitoringSessionId:
        monitoringSessionId === NO_MONITORING_SESSION
          ? undefined
          : monitoringSessionId,
    };
  }

  private async buildRefreshSessionData(
    userId: string,
    tenantId?: string,
    empresaId?: string,
    monitoringSessionId?: string,
  ) {
    const authSessionId = randomUUID();
    const refreshToken = this.buildRefreshToken(
      authSessionId,
      monitoringSessionId,
    );
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      REFRESH_TOKEN_HASH_ROUNDS,
    );

    return {
      authSessionId,
      refreshToken,
      data: {
        id: authSessionId,
        userId,
        refreshTokenHash,
        expiresAt: this.getRefreshTokenExpiresAt(),
        ...(tenantId ? { tenantId } : {}),
        ...(empresaId ? { empresaId } : {}),
      },
    };
  }

  private isGlobalSuAdmin(userId: string): boolean {
    const allowedUuids = (process.env.ALLOWED_TENANT_ADMINS || '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);

    return allowedUuids.includes(userId);
  }

  private collectMembershipScopeIds(membership?: {
    empresaMemberships?: Array<{ empresaId: string; zonaId: string | null }>;
    municipalityScopes?: Array<{ municipalityId: string }>;
    departmentScopes?: Array<{ departmentId: string }>;
  }): {
    empresaIds: string[];
    zonaIds: string[];
    municipalityIds: string[];
    departmentIds: string[];
  } {
    const empresaIds =
      membership?.empresaMemberships?.map((m) => m.empresaId) || [];
    const zonaIds = Array.from(
      new Set(
        membership?.empresaMemberships
          ?.map((m) => m.zonaId)
          .filter((zonaId): zonaId is string => !!zonaId) || [],
      ),
    );
    const municipalityIds = Array.from(
      new Set(
        membership?.municipalityScopes?.map((scope) => scope.municipalityId) ||
          [],
      ),
    );
    const departmentIds = Array.from(
      new Set(
        membership?.departmentScopes?.map((scope) => scope.departmentId) || [],
      ),
    );

    return {
      empresaIds,
      zonaIds,
      municipalityIds,
      departmentIds,
    };
  }

  async login(dto: LoginDto, ip?: string, dispositivo?: string) {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            tenant: true,
            empresaMemberships: {
              where: { activo: true, deletedAt: null },
              select: { empresaId: true, zonaId: true },
            },
            municipalityScopes: {
              select: { municipalityId: true },
            },
            departmentScopes: {
              select: { departmentId: true },
            },
          },
        },
      },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isGlobalSuAdmin = this.isGlobalSuAdmin(user.id);

    // Priorizar membresías activas
    const approvedMembership = user.memberships.find(
      (m) => m.aprobado || m.role === Role.SU_ADMIN,
    );
    const pendingMembership = user.memberships.find(
      (m) => !m.aprobado && m.role !== Role.SU_ADMIN,
    );

    let sesionId: string | undefined;

    // Registrar sesión de actividad si hay membresía
    if (approvedMembership) {
      const session = await this.monitoringService.startSession(
        approvedMembership.tenantId,
        approvedMembership.id,
        ip,
        dispositivo,
      );
      sesionId = session?.id;

      if (sesionId) {
        await this.monitoringService.recordEvent(
          sesionId,
          'LOGIN',
          'El usuario inició sesión en el sistema',
          '/login',
        );
      }
    }

    const role =
      approvedMembership?.role ||
      (isGlobalSuAdmin ? Role.SU_ADMIN : Role.OPERADOR);
    const { empresaIds, zonaIds, municipalityIds, departmentIds } =
      this.collectMembershipScopeIds(approvedMembership);
    const permissionState = buildMembershipPermissionState(
      role,
      approvedMembership?.granularPermissions,
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role,
      permissions: permissionState.permissions,
      granularPermissions: permissionState.granularPermissions,
      tenantId: approvedMembership?.tenantId,
      membershipId: approvedMembership?.id,
      empresaId: empresaIds.length === 1 ? empresaIds[0] : undefined,
      empresaIds,
      zonaIds,
      municipalityIds,
      departmentIds,
      sesionId,
      isGlobalSuAdmin,
    };

    const refreshSession = await this.buildRefreshSessionData(
      user.id,
      payload.tenantId,
      payload.empresaId,
      sesionId,
    );
    payload.authSessionId = refreshSession.authSessionId;

    const accessToken = await this.jwtService.signAsync(payload);
    await this.prisma.authSession.create({ data: refreshSession.data });

    return {
      access_token: accessToken,
      refresh_token: refreshSession.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido,
        role,
        permissions: permissionState.permissions,
        granularPermissions: permissionState.granularPermissions,
        tenantId: approvedMembership?.tenantId,
        membershipId: approvedMembership?.id,
        empresaIds,
        zonaIds,
        municipalityIds,
        departmentIds,
        sesionId,
        isGlobalSuAdmin,
        hasPendingRequest: !!pendingMembership && !approvedMembership,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const parsedRefreshToken = this.parseRefreshToken(dto.refresh_token);
    if (!parsedRefreshToken) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const now = new Date();
    const authSession = await this.prisma.authSession.findUnique({
      where: { id: parsedRefreshToken.authSessionId },
      include: {
        user: {
          include: {
            memberships: {
              include: {
                tenant: true,
                empresaMemberships: {
                  where: { activo: true, deletedAt: null },
                  select: { empresaId: true, zonaId: true },
                },
                municipalityScopes: {
                  select: { municipalityId: true },
                },
                departmentScopes: {
                  select: { departmentId: true },
                },
              },
            },
          },
        },
      },
    });

    if (!authSession || authSession.revoked || authSession.expiresAt <= now) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      dto.refresh_token,
      authSession.refreshTokenHash,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const user = authSession.user;
    const isGlobalSuAdmin = this.isGlobalSuAdmin(user.id);
    const approvedMembershipForSession = user.memberships.find(
      (m) =>
        (m.aprobado || m.role === Role.SU_ADMIN) &&
        (!authSession.tenantId || m.tenantId === authSession.tenantId),
    );
    const approvedMembership =
      approvedMembershipForSession ||
      user.memberships.find((m) => m.aprobado || m.role === Role.SU_ADMIN);

    if (
      authSession.tenantId &&
      (!approvedMembership ||
        approvedMembership.tenantId !== authSession.tenantId)
    ) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const role =
      approvedMembership?.role ||
      (isGlobalSuAdmin ? Role.SU_ADMIN : Role.OPERADOR);
    const { empresaIds, zonaIds, municipalityIds, departmentIds } =
      this.collectMembershipScopeIds(approvedMembership);

    if (
      authSession.empresaId &&
      empresaIds.length > 0 &&
      !empresaIds.includes(authSession.empresaId)
    ) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const permissionState = buildMembershipPermissionState(
      role,
      approvedMembership?.granularPermissions,
    );
    const empresaId =
      authSession.empresaId ||
      (empresaIds.length === 1 ? empresaIds[0] : undefined);
    const newRefreshSession = await this.buildRefreshSessionData(
      user.id,
      approvedMembership?.tenantId || authSession.tenantId || undefined,
      empresaId,
      parsedRefreshToken.monitoringSessionId,
    );

    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.authSession.updateMany({
        where: {
          id: authSession.id,
          revoked: false,
          expiresAt: { gt: now },
        },
        data: { revoked: true },
      });

      if (revoked.count !== 1) {
        throw new UnauthorizedException('Refresh token inválido o expirado');
      }

      await tx.authSession.create({ data: newRefreshSession.data });
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role,
      permissions: permissionState.permissions,
      granularPermissions: permissionState.granularPermissions,
      tenantId:
        approvedMembership?.tenantId || authSession.tenantId || undefined,
      membershipId: approvedMembership?.id,
      empresaId,
      empresaIds,
      zonaIds,
      municipalityIds,
      departmentIds,
      sesionId: parsedRefreshToken.monitoringSessionId,
      authSessionId: newRefreshSession.authSessionId,
      isGlobalSuAdmin,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      access_token: accessToken,
      refresh_token: newRefreshSession.refreshToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { aprobado: true },
          include: {
            empresaMemberships: {
              where: { activo: true, deletedAt: null },
              select: { empresaId: true },
            },
          },
        },
      },
    });

    if (!user) {
      return { message: PASSWORD_RESET_GENERIC_MESSAGE };
    }

    const tokenId = randomUUID();
    const secret = randomBytes(PASSWORD_RESET_TOKEN_RANDOM_BYTES).toString(
      'base64url',
    );
    const resetToken = `${tokenId}.${secret}`;
    const primaryMembership = user.memberships[0];
    const primaryEnterpriseId =
      primaryMembership?.empresaMemberships[0]?.empresaId;

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          id: tokenId,
          userId: user.id,
          tokenHash: await bcrypt.hash(
            resetToken,
            PASSWORD_RESET_TOKEN_HASH_ROUNDS,
          ),
          expiresAt: this.getPasswordResetExpiresAt(),
          ...(primaryMembership?.tenantId
            ? { tenantId: primaryMembership.tenantId }
            : {}),
          ...(primaryEnterpriseId ? { empresaId: primaryEnterpriseId } : {}),
        },
      }),
    ]);

    return {
      message: PASSWORD_RESET_GENERIC_MESSAGE,
      ...(process.env.NODE_ENV !== 'production'
        ? { resetUrl: this.buildPasswordResetUrl(resetToken) }
        : {}),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const [tokenId, secret] = dto.token.split('.');

    if (!tokenId || !secret) {
      throw new BadRequestException('El enlace no es válido o expiró');
    }

    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { id: tokenId },
      include: { user: true },
    });
    const now = new Date();

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= now ||
      !(await bcrypt.compare(dto.token, resetToken.tokenHash))
    ) {
      throw new BadRequestException('El enlace no es válido o expiró');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: now },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: resetToken.userId, revoked: false },
        data: { revoked: true },
      }),
    ]);

    return { success: true };
  }

  async logout(
    sesionId?: string,
    authSessionId?: string,
    refreshToken?: string,
    userId?: string,
  ) {
    const parsedRefreshToken = this.parseRefreshToken(refreshToken);
    const authSessionIdToRevoke =
      parsedRefreshToken?.authSessionId || authSessionId;

    if (authSessionIdToRevoke) {
      await this.prisma.authSession.updateMany({
        where: {
          id: authSessionIdToRevoke,
          ...(userId ? { userId } : {}),
          revoked: false,
        },
        data: { revoked: true },
      });
    }

    if (sesionId) {
      try {
        await this.monitoringService.recordEvent(
          sesionId,
          'LOGOUT',
          'El usuario cerró su sesión manualmente',
          '/logout',
        );
        await this.monitoringService.endSession(sesionId);
      } catch (error) {
        console.error('Error closing session during logout:', error);
      }
    }
    return { success: true };
  }

  async getProfile(token: string, enterpriseId?: string, testRole?: string) {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      await this.assertAuthSessionIsActive(payload);
      const devRoleState = resolveEffectiveRoleState(
        {
          role: payload.role,
          isGlobalSuAdmin: this.isGlobalSuAdmin(payload.sub),
        },
        testRole,
      );

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          memberships: {
            where: payload.membershipId
              ? { id: payload.membershipId }
              : { aprobado: true },
            include: {
              cuentasPago: {
                where: payload.tenantId
                  ? {
                      tenantId: payload.tenantId,
                      ...(enterpriseId ? { empresaId: enterpriseId } : {}),
                    }
                  : undefined,
                orderBy: {
                  createdAt: 'desc',
                },
              },
              empresaMemberships: {
                where: {
                  activo: true,
                  deletedAt: null,
                },
                select: {
                  empresaId: true,
                  zonaId: true,
                },
              },
              municipalityScopes: {
                select: {
                  municipalityId: true,
                },
              },
              departmentScopes: {
                select: {
                  departmentId: true,
                },
              },
            },
          },
        },
      });

      const membership = user?.memberships?.[0];
      const { empresaIds, zonaIds, municipalityIds, departmentIds } =
        this.collectMembershipScopeIds(membership);
      const permissionState = buildMembershipPermissionState(
        devRoleState.role,
        membership?.granularPermissions ?? payload.granularPermissions,
      );
      const cuentaPago =
        membership?.cuentasPago?.[0] ||
        (enterpriseId
          ? undefined
          : membership?.cuentasPago?.find((item) => item.valorHora !== null));

      return {
        ...payload,
        role: devRoleState.role,
        permissions: permissionState.permissions,
        granularPermissions: permissionState.granularPermissions,
        id: user?.id || payload.sub,
        email: user?.email || payload.email,
        nombre: user?.nombre,
        apellido: user?.apellido,
        telefono: user?.telefono,
        tipoDocumento: user?.tipoDocumento,
        numeroDocumento: user?.numeroDocumento,
        banco: cuentaPago?.banco || undefined,
        tipoCuenta: cuentaPago?.tipoCuenta || undefined,
        numeroCuenta: cuentaPago?.numeroCuenta || undefined,
        valorHora:
          cuentaPago?.valorHora !== null && cuentaPago?.valorHora !== undefined
            ? Number(cuentaPago.valorHora)
            : undefined,
        empresaId:
          enterpriseId ||
          payload.empresaId ||
          (empresaIds.length === 1 ? empresaIds[0] : undefined),
        empresaIds:
          empresaIds.length > 0 ? empresaIds : payload.empresaIds || [],
        zonaIds: zonaIds.length > 0 ? zonaIds : payload.zonaIds || [],
        municipalityIds:
          municipalityIds.length > 0
            ? municipalityIds
            : payload.municipalityIds || [],
        departmentIds:
          departmentIds.length > 0
            ? departmentIds
            : payload.departmentIds || [],
        isGlobalSuAdmin: devRoleState.isGlobalSuAdmin,
      };
    } catch {
      throw new UnauthorizedException();
    }
  }

  private async assertAuthSessionIsActive(payload: JwtPayload): Promise<void> {
    if (!payload.authSessionId) {
      return;
    }

    const activeSession = await this.prisma.authSession.findFirst({
      where: {
        id: payload.authSessionId,
        userId: payload.sub,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!activeSession) {
      throw new UnauthorizedException('Sesión inválida o revocada');
    }
  }

  async updateTestRole(userId: string, role: string) {
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Not allowed in production');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { aprobado: true },
        },
      },
    });

    if (!user || user.memberships.length === 0) {
      if (this.isGlobalSuAdmin(userId)) {
        return { success: true, role };
      }
      throw new ConflictException('No active membership found');
    }

    const membership = user.memberships[0];

    if (!membership) {
      if (this.isGlobalSuAdmin(userId)) {
        return { success: true, role };
      }
      throw new ConflictException('No active membership found');
    }

    await this.prisma.tenantMembership.update({
      where: { id: membership.id },
      data: { role: role as Role },
    });

    return { success: true, role };
  }

  async register(dto: RegisterDto) {
    const {
      email,
      password,
      nombre,
      apellido,
      telefono,
      tipoDocumento,
      numeroDocumento,
    } = dto;

    // Verificar si el usuario ya existe
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Verificar si el documento ya existe
    const existingDoc = await this.prisma.user.findUnique({
      where: { numeroDocumento },
    });

    if (existingDoc) {
      throw new ConflictException('El número de documento ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          nombre,
          apellido,
          telefono,
          tipoDocumento,
          numeroDocumento,
        },
      });

      return {
        message:
          'Usuario registrado exitosamente. Ahora puedes unirte a una organización.',
        userId: user.id,
      };
    } catch (error) {
      console.error('Error in registration:', error);
      throw new InternalServerErrorException('Error al registrar el usuario');
    }
  }
}
