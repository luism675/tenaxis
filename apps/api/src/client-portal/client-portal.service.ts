import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { JwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoOrden, Prisma } from '../generated/client/client';
import {
  getPrismaAccessFilter,
  PrismaAccessFilter,
} from '../common/utils/access-control.util';
import { CreateClientPortalLinkDto } from './dto/create-client-portal-link.dto';

const TOKEN_TTL_DAYS = 30;
const HISTORY_LIMIT = 10;
const BLOCKED_UUID = '00000000-0000-0000-0000-000000000000';

type AuthContext = {
  tenantId: string;
  membershipId: string;
};

type ClientPortalClientRow = {
  id: string;
  tenantId?: string;
  empresaId: string;
  tipoCliente?: string | null;
  nombre: string | null;
  apellido: string | null;
  razonSocial: string | null;
  telefono: string | null;
  telefono2: string | null;
  correo: string | null;
  numeroDocumento?: string | null;
  tipoDocumento?: string | null;
  nit?: string | null;
  empresaNombre: string;
};

type ClientPortalTokenRow = {
  id: string;
  tenantId: string;
  clienteId: string;
  empresaId: string;
  expiresAt: Date;
};

type ClientPortalOrderRow = {
  id: string;
  numeroOrden?: string | null;
  servicioNombre?: string | null;
  serviciosSeleccionados?: Prisma.JsonValue | null;
  fechaVisita?: Date | null;
  horaInicio?: Date | null;
  horaFin?: Date | null;
  estadoServicio?: EstadoOrden | null;
  tipoVisita?: string | null;
  direccionTexto?: string | null;
  barrio?: string | null;
  municipio?: string | null;
  departamento?: string | null;
  observacion?: string | null;
  observacionFinal?: string | null;
  intervencionRealizada?: string | null;
  recomendacionesObligatorias?: string | null;
};

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createLink(
    user: JwtPayload,
    clienteId: string,
    dto: CreateClientPortalLinkDto = {},
  ) {
    const { tenantId, membershipId } = await this.resolveAuthContext(user);
    const accessFilter = getPrismaAccessFilter(user);
    const cliente = await this.findAccessibleClientOrThrow(
      tenantId,
      clienteId,
      accessFilter,
    );

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(
      Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO client_portal_tokens
        ("id", "tenantId", "clienteId", "empresaId", "tokenHash", "expiresAt", "createdByMembershipId", "createdAt", "updatedAt")
      VALUES
        (${randomUUID()}::uuid, ${tenantId}::uuid, ${cliente.id}::uuid, ${cliente.empresaId}::uuid, ${tokenHash}, ${expiresAt}, ${membershipId}::uuid, NOW(), NOW())
    `);

    return {
      url: this.buildPortalUrl(token, dto.baseUrl),
      expiresAt,
    };
  }

  async getPublicDashboard(token: string) {
    const tokenHash = this.hashTokenOrThrow(token);
    const now = new Date();
    const tokenRow = await this.findUsableTokenOrThrow(tokenHash, now);
    const cliente = await this.findPublicClientOrThrow(tokenRow);
    const proximoServicio = await this.findNextOrder(tokenRow, now);
    const ultimoServicio = await this.findLastCompletedOrder(tokenRow);
    const historial = await this.findHistory(tokenRow);

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE client_portal_tokens
      SET "lastUsedAt" = ${now}, "updatedAt" = NOW()
      WHERE "id" = ${tokenRow.id}::uuid
        AND "tenantId" = ${tokenRow.tenantId}::uuid
    `);

    return {
      cliente: this.mapClient(cliente),
      proximoServicio: this.mapOrder(proximoServicio),
      ultimoServicio: this.mapOrder(ultimoServicio),
      historial: historial.map((row) => this.mapOrder(row)),
      generadoAt: now,
    };
  }

  private async resolveAuthContext(user: JwtPayload): Promise<AuthContext> {
    if (!user?.tenantId) {
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

  private async findAccessibleClientOrThrow(
    tenantId: string,
    clienteId: string,
    accessFilter: PrismaAccessFilter,
  ): Promise<ClientPortalClientRow> {
    const accessClauses = this.buildClientAccessClauses(accessFilter);
    const [cliente] = await this.prisma.$queryRaw<ClientPortalClientRow[]>(
      Prisma.sql`
        SELECT
          c."id",
          c."tenantId",
          c."empresaId",
          c."tipoCliente",
          c."nombre",
          c."apellido",
          c."razonSocial",
          c."telefono",
          c."telefono2",
          c."correo",
          c."numeroDocumento",
          c."tipoDocumento",
          c."nit",
          e."nombre" AS "empresaNombre"
        FROM clientes c
        INNER JOIN empresas e
          ON e."id" = c."empresaId"
          AND e."tenantId" = c."tenantId"
        WHERE c."id" = ${clienteId}::uuid
          AND c."tenantId" = ${tenantId}::uuid
          AND c."empresaId" IS NOT NULL
          AND c."deletedAt" IS NULL
          AND e."deletedAt" IS NULL
          ${accessClauses.length ? Prisma.sql`AND ${Prisma.join(accessClauses, ' AND ')}` : Prisma.empty}
        LIMIT 1
      `,
    );

    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return cliente;
  }

  private async findUsableTokenOrThrow(
    tokenHash: string,
    now: Date,
  ): Promise<ClientPortalTokenRow> {
    const [tokenRow] = await this.prisma.$queryRaw<ClientPortalTokenRow[]>(
      Prisma.sql`
        SELECT "id", "tenantId", "clienteId", "empresaId", "expiresAt"
        FROM client_portal_tokens
        WHERE "tokenHash" = ${tokenHash}
          AND "revokedAt" IS NULL
          AND "expiresAt" > ${now}
        LIMIT 1
      `,
    );

    if (!tokenRow) {
      throw new NotFoundException('Portal no disponible');
    }

    return tokenRow;
  }

  private async findPublicClientOrThrow(
    tokenRow: ClientPortalTokenRow,
  ): Promise<ClientPortalClientRow> {
    const [cliente] = await this.prisma.$queryRaw<ClientPortalClientRow[]>(
      Prisma.sql`
        SELECT
          c."id",
          c."tipoCliente",
          c."nombre",
          c."apellido",
          c."razonSocial",
          c."telefono",
          c."telefono2",
          c."correo",
          c."numeroDocumento",
          c."tipoDocumento",
          c."nit",
          e."nombre" AS "empresaNombre"
        FROM clientes c
        INNER JOIN empresas e
          ON e."id" = c."empresaId"
          AND e."tenantId" = c."tenantId"
        WHERE c."id" = ${tokenRow.clienteId}::uuid
          AND c."tenantId" = ${tokenRow.tenantId}::uuid
          AND c."empresaId" = ${tokenRow.empresaId}::uuid
          AND c."deletedAt" IS NULL
          AND e."id" = ${tokenRow.empresaId}::uuid
          AND e."deletedAt" IS NULL
        LIMIT 1
      `,
    );

    if (!cliente) {
      throw new NotFoundException('Portal no disponible');
    }

    return cliente;
  }

  private async findNextOrder(
    tokenRow: ClientPortalTokenRow,
    now: Date,
  ): Promise<ClientPortalOrderRow | null> {
    const [row] = await this.prisma.$queryRaw<ClientPortalOrderRow[]>(
      Prisma.sql`
        ${this.orderSelectSql()}
        WHERE ${this.orderBaseWhereSql(tokenRow)}
          AND os."fechaVisita" IS NOT NULL
          AND os."fechaVisita" >= ${now}
          AND os."estadoServicio" <> ${EstadoOrden.CANCELADO}::"EstadoOrden"
        ORDER BY os."fechaVisita" ASC, os."horaInicio" ASC NULLS LAST
        LIMIT 1
      `,
    );

    return row ?? null;
  }

  private async findLastCompletedOrder(
    tokenRow: ClientPortalTokenRow,
  ): Promise<ClientPortalOrderRow | null> {
    const [row] = await this.prisma.$queryRaw<ClientPortalOrderRow[]>(
      Prisma.sql`
        ${this.orderSelectSql()}
        WHERE ${this.orderBaseWhereSql(tokenRow)}
          AND os."estadoServicio" IN (${EstadoOrden.LIQUIDADO}::"EstadoOrden", ${EstadoOrden.TECNICO_FINALIZO}::"EstadoOrden")
        ORDER BY os."fechaVisita" DESC NULLS LAST, os."updatedAt" DESC
        LIMIT 1
      `,
    );

    return row ?? null;
  }

  private async findHistory(
    tokenRow: ClientPortalTokenRow,
  ): Promise<ClientPortalOrderRow[]> {
    return this.prisma.$queryRaw<ClientPortalOrderRow[]>(Prisma.sql`
      ${this.orderSelectSql()}
      WHERE ${this.orderBaseWhereSql(tokenRow)}
        AND os."estadoServicio" IN (${EstadoOrden.LIQUIDADO}::"EstadoOrden", ${EstadoOrden.TECNICO_FINALIZO}::"EstadoOrden")
      ORDER BY os."fechaVisita" DESC NULLS LAST, os."updatedAt" DESC
      LIMIT ${HISTORY_LIMIT}
    `);
  }

  private orderSelectSql(): Prisma.Sql {
    return Prisma.sql`
      SELECT
        os."id",
        os."numeroOrden",
        s."nombre" AS "servicioNombre",
        os."fechaVisita",
        os."horaInicio",
        os."horaFin",
        os."estadoServicio",
        os."tipoVisita",
        os."direccionTexto",
        os."barrio",
        os."municipio",
        os."departamento",
        os."observacion",
        os."observacionFinal",
        os."intervencionRealizada",
        os."recomendacionesObligatorias",
        os."serviciosSeleccionados"
      FROM ordenes_servicio os
      LEFT JOIN servicios s
        ON s."id" = os."servicioId"
        AND s."tenantId" = os."tenantId"
        AND s."empresaId" = os."empresaId"
    `;
  }

  private orderBaseWhereSql(tokenRow: ClientPortalTokenRow): Prisma.Sql {
    return Prisma.sql`
      os."tenantId" = ${tokenRow.tenantId}::uuid
      AND os."clienteId" = ${tokenRow.clienteId}::uuid
      AND os."empresaId" = ${tokenRow.empresaId}::uuid
      AND os."deletedAt" IS NULL
    `;
  }

  private buildClientAccessClauses(
    accessFilter: PrismaAccessFilter,
  ): Prisma.Sql[] {
    const clauses: Prisma.Sql[] = [];

    if (typeof accessFilter.empresaId === 'string') {
      clauses.push(Prisma.sql`c."empresaId" = ${accessFilter.empresaId}::uuid`);
    } else if (accessFilter.empresaId && 'in' in accessFilter.empresaId) {
      const empresaIds =
        accessFilter.empresaId.in.length > 0
          ? accessFilter.empresaId.in
          : [BLOCKED_UUID];
      clauses.push(
        Prisma.sql`c."empresaId" IN (${Prisma.join(
          empresaIds.map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    const geoClauses = this.buildGeoScopeClauses(accessFilter);
    if (geoClauses.length > 0) {
      clauses.push(Prisma.sql`
        EXISTS (
          SELECT 1
          FROM direcciones d
          WHERE d."clienteId" = c."id"
            AND d."tenantId" = c."tenantId"
            AND ${Prisma.join(geoClauses, ' AND ')}
        )
      `);
    }

    return clauses;
  }

  private buildGeoScopeClauses(accessFilter: PrismaAccessFilter): Prisma.Sql[] {
    const clauses: Prisma.Sql[] = [];

    if ((accessFilter.zonaIds || []).length > 0) {
      clauses.push(
        Prisma.sql`d."zonaId" IN (${Prisma.join(
          (accessFilter.zonaIds || []).map((id) => Prisma.sql`${id}::uuid`),
        )})`,
      );
    }

    if ((accessFilter.municipalityIds || []).length > 0) {
      clauses.push(
        Prisma.sql`d."municipioId" IN (${Prisma.join(
          (accessFilter.municipalityIds || []).map(
            (id) => Prisma.sql`${id}::uuid`,
          ),
        )})`,
      );
    }

    if ((accessFilter.departmentIds || []).length > 0) {
      clauses.push(
        Prisma.sql`d."departmentId" IN (${Prisma.join(
          (accessFilter.departmentIds || []).map(
            (id) => Prisma.sql`${id}::uuid`,
          ),
        )})`,
      );
    }

    return clauses;
  }

  private buildPortalUrl(token: string, baseUrl?: string): string {
    const configuredBase =
      baseUrl ||
      this.config.get<string>('CLIENT_PORTAL_BASE_URL') ||
      this.config.get<string>('NEXT_PUBLIC_APP_URL') ||
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('FRONTEND_URL') ||
      'http://localhost:3000';

    const normalizedBase = configuredBase.replace(/\/+$/, '');
    const suffix = normalizedBase.endsWith('/portal-cliente')
      ? token
      : `portal-cliente/${token}`;

    return `${normalizedBase}/${suffix}`;
  }

  private hashTokenOrThrow(token: string): string {
    const normalizedToken = token?.trim();
    if (!normalizedToken) {
      throw new NotFoundException('Portal no disponible');
    }

    return this.hashToken(normalizedToken);
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private cleanDisplayText(value?: string | null): string | null {
    const normalized = value?.trim();
    if (!normalized) {
      return null;
    }

    const lowered = normalized.toLowerCase();
    if (
      lowered === 'no concretado' ||
      lowered === 'sin concretar' ||
      lowered === 'n/a'
    ) {
      return null;
    }

    return normalized;
  }

  private mapClient(row: ClientPortalClientRow) {
    const fullName = [
      this.cleanDisplayText(row.nombre),
      this.cleanDisplayText(row.apellido),
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    const razonSocial = this.cleanDisplayText(row.razonSocial);
    const displayName =
      (row.tipoCliente === 'EMPRESA' ? razonSocial || fullName : fullName) ||
      razonSocial ||
      'Cliente';

    return {
      id: row.id,
      nombre: displayName,
      apellido: this.cleanDisplayText(row.apellido),
      razonSocial,
      tipoCliente: row.tipoCliente,
      empresa: row.empresaNombre,
      telefono: row.telefono,
      telefono2: row.telefono2,
      correo: row.correo,
      numeroDocumento: this.cleanDisplayText(row.numeroDocumento),
      tipoDocumento: this.cleanDisplayText(row.tipoDocumento),
      nit: this.cleanDisplayText(row.nit),
    };
  }

  private mapOrder(row: ClientPortalOrderRow | null) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      numeroOrden: row.numeroOrden ?? null,
      servicio: row.servicioNombre
        ? {
            nombre: row.servicioNombre,
          }
        : null,
      tipoServicio: row.servicioNombre ?? null,
      serviciosSeleccionados: row.serviciosSeleccionados ?? null,
      fechaVisita: row.fechaVisita ?? null,
      fechaServicio: row.fechaVisita ?? null,
      fechaProgramada: row.fechaVisita ?? null,
      horaInicio: row.horaInicio ?? null,
      horaFin: row.horaFin ?? null,
      estado: row.estadoServicio ?? null,
      tipoVisita: row.tipoVisita ?? null,
      direccion: {
        texto: row.direccionTexto ?? null,
        barrio: row.barrio ?? null,
        municipio: row.municipio ?? null,
        departamento: row.departamento ?? null,
      },
      observacion: row.observacionFinal ?? row.observacion ?? null,
      observaciones: row.observacionFinal ?? row.observacion ?? null,
      resumen:
        row.intervencionRealizada ??
        row.observacionFinal ??
        row.observacion ??
        null,
      recomendaciones: row.recomendacionesObligatorias ?? null,
    };
  }
}
