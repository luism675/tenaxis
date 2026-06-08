import {
  PrismaClient,
  Role,
  TipoCliente,
  EstadoOrden,
  MembershipStatus,
} from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import bcrypt from 'bcrypt';

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

let connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL;

try {
  if (connectionString) {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete('sslmode');
    urlObj.searchParams.delete('sslrootcert');
    urlObj.searchParams.delete('sslcert');
    urlObj.searchParams.delete('sslkey');
    if (!urlObj.searchParams.has('schema')) {
      urlObj.searchParams.set('schema', 'public');
    }
    urlObj.searchParams.set('options', '-c search_path=public');
    connectionString = urlObj.toString();
  }
} catch (error) {
  console.error('Error parsing connection string', error);
}

const pool = new pg.Pool({
  connectionString,
  ssl: false,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = 'Tenaxis2026*';

const IDS = {
  mainTenant: '11111111-1111-4111-8111-111111111111',
  outsiderTenant: '22222222-2222-4222-8222-222222222222',
  empresaNorte: '33333333-3333-4333-8333-333333333331',
  empresaSur: '33333333-3333-4333-8333-333333333332',
  outsiderEmpresa: '33333333-3333-4333-8333-333333333333',
  zonaNorteUno: '44444444-4444-4444-8444-444444444441',
  zonaNorteDos: '44444444-4444-4444-8444-444444444442',
  zonaSurUno: '44444444-4444-4444-8444-444444444443',
  zonaSurDos: '44444444-4444-4444-8444-444444444444',
  servicioNorte: '55555555-5555-4555-8555-555555555551',
  servicioSur: '55555555-5555-4555-8555-555555555552',
  outsiderServicio: '55555555-5555-4555-8555-555555555553',
  metodoPagoNorte: '66666666-6666-4666-8666-666666666661',
  metodoPagoSur: '66666666-6666-4666-8666-666666666662',
  outsiderMetodoPago: '66666666-6666-4666-8666-666666666663',
  clienteNorteA: '77777777-7777-4777-8777-777777777771',
  clienteNorteB: '77777777-7777-4777-8777-777777777772',
  clienteSurA: '77777777-7777-4777-8777-777777777773',
  clienteSurB: '77777777-7777-4777-8777-777777777774',
  clienteOutsider: '77777777-7777-4777-8777-777777777775',
  direccionNorteA: '99999999-9999-4999-8999-999999999991',
  direccionNorteB: '99999999-9999-4999-8999-999999999992',
  direccionSurA: '99999999-9999-4999-8999-999999999993',
  direccionSurB: '99999999-9999-4999-8999-999999999994',
  direccionOutsider: '99999999-9999-4999-8999-999999999995',
  ordenNorteA: '88888888-8888-4888-8888-888888888881',
  ordenNorteB: '88888888-8888-4888-8888-888888888882',
  ordenSurA: '88888888-8888-4888-8888-888888888883',
  ordenSurB: '88888888-8888-4888-8888-888888888884',
  ordenOutsider: '88888888-8888-4888-8888-888888888885',
} as const;

type EmpresaScope = {
  empresaId: string;
  zonaId?: string;
  role?: Role;
};

type SeedUserConfig = {
  key: string;
  email: string;
  nombre: string;
  apellido: string;
  numeroDocumento: string;
  tenantId: string;
  role: Role;
  empresaScopes: EmpresaScope[];
  expectedVisibility: string[];
};

const MAIN_USERS: SeedUserConfig[] = [
  {
    key: 'su-admin',
    email: 'rbac.suadmin@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'SuAdmin',
    numeroDocumento: '900000001',
    tenantId: IDS.mainTenant,
    role: Role.SU_ADMIN,
    empresaScopes: [
      { empresaId: IDS.empresaNorte },
      { empresaId: IDS.empresaSur },
    ],
    expectedVisibility: [
      'Ve Empresa Norte y Empresa Sur',
      'Ve órdenes y clientes de ambas empresas',
      'No debe ver datos del tenant outsider',
    ],
  },
  {
    key: 'admin',
    email: 'rbac.admin@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'Admin',
    numeroDocumento: '900000002',
    tenantId: IDS.mainTenant,
    role: Role.ADMIN,
    empresaScopes: [
      { empresaId: IDS.empresaNorte },
      { empresaId: IDS.empresaSur },
    ],
    expectedVisibility: [
      'Ve ambas empresas del tenant principal',
      'Ve clientes y órdenes Norte/Sur',
      'No debe ver tenant outsider',
    ],
  },
  {
    key: 'coord-global',
    email: 'rbac.coord.global@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'CoordGlobal',
    numeroDocumento: '900000003',
    tenantId: IDS.mainTenant,
    role: Role.COORDINADOR,
    empresaScopes: [
      { empresaId: IDS.empresaNorte },
      { empresaId: IDS.empresaSur },
    ],
    expectedVisibility: [
      'Ve órdenes Norte y Sur dentro del tenant principal',
      'Puede compararse contra coordinador restringido',
    ],
  },
  {
    key: 'coord-norte',
    email: 'rbac.coord.empresa.norte@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'CoordEmpresaNorte',
    numeroDocumento: '900000004',
    tenantId: IDS.mainTenant,
    role: Role.COORDINADOR,
    empresaScopes: [{ empresaId: IDS.empresaNorte }],
    expectedVisibility: [
      'Debe ver solo Empresa Norte',
      'Debe ver Zona Norte 1 y Zona Norte 2',
      'No debe ver Empresa Sur',
    ],
  },
  {
    key: 'coord-norte-zona-1',
    email: 'rbac.coord.norte.zona1@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'CoordZonaNorteUno',
    numeroDocumento: '900000005',
    tenantId: IDS.mainTenant,
    role: Role.COORDINADOR,
    empresaScopes: [{ empresaId: IDS.empresaNorte, zonaId: IDS.zonaNorteUno }],
    expectedVisibility: [
      'Debe ver solo Empresa Norte',
      'Debe ver solo órdenes de Zona Norte 1',
      'No debe ver Zona Norte 2 ni Empresa Sur',
    ],
  },
  {
    key: 'asesor-sur',
    email: 'rbac.asesor.empresa.sur@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'AsesorEmpresaSur',
    numeroDocumento: '900000006',
    tenantId: IDS.mainTenant,
    role: Role.ASESOR,
    empresaScopes: [{ empresaId: IDS.empresaSur }],
    expectedVisibility: [
      'Debe ver solo Empresa Sur',
      'Debe ver Zona Sur 1 y Zona Sur 2',
      'No debe ver Empresa Norte',
    ],
  },
  {
    key: 'asesor-sur-zona-1',
    email: 'rbac.asesor.sur.zona1@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'AsesorZonaSurUno',
    numeroDocumento: '900000007',
    tenantId: IDS.mainTenant,
    role: Role.ASESOR,
    empresaScopes: [{ empresaId: IDS.empresaSur, zonaId: IDS.zonaSurUno }],
    expectedVisibility: [
      'Debe ver solo Empresa Sur',
      'Debe ver solo órdenes de Zona Sur 1',
      'No debe ver Zona Sur 2 ni Empresa Norte',
    ],
  },
  {
    key: 'operador-norte',
    email: 'rbac.operador.norte@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'OperadorNorte',
    numeroDocumento: '900000008',
    tenantId: IDS.mainTenant,
    role: Role.OPERADOR,
    empresaScopes: [{ empresaId: IDS.empresaNorte, zonaId: IDS.zonaNorteUno }],
    expectedVisibility: [
      'Debe quedar restringido a su membership operativa',
      'Sirve para validar órdenes asignadas en Norte',
    ],
  },
  {
    key: 'operador-sur',
    email: 'rbac.operador.sur@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'OperadorSur',
    numeroDocumento: '900000009',
    tenantId: IDS.mainTenant,
    role: Role.OPERADOR,
    empresaScopes: [{ empresaId: IDS.empresaSur, zonaId: IDS.zonaSurUno }],
    expectedVisibility: [
      'Debe quedar restringido a su membership operativa',
      'Sirve para validar órdenes asignadas en Sur',
    ],
  },
  {
    key: 'outsider-admin',
    email: 'rbac.outsider.admin@tenaxis.test',
    nombre: 'Rbac',
    apellido: 'OutsiderAdmin',
    numeroDocumento: '900000010',
    tenantId: IDS.outsiderTenant,
    role: Role.ADMIN,
    empresaScopes: [{ empresaId: IDS.outsiderEmpresa }],
    expectedVisibility: [
      'Solo ve su tenant outsider',
      'Nunca debe ver datos del tenant principal',
    ],
  },
];

async function upsertTenant(id: string, nombre: string, slug: string) {
  return prisma.tenant.upsert({
    where: { id },
    update: { nombre, slug, isActive: true },
    create: { id, nombre, slug, isActive: true },
  });
}

async function upsertEmpresa(id: string, tenantId: string, nombre: string) {
  return prisma.empresa.upsert({
    where: { id },
    update: { tenantId, nombre, activo: true, deletedAt: null },
    create: { id, tenantId, nombre, activo: true },
  });
}

async function upsertZona(
  id: string,
  tenantId: string,
  empresaId: string,
  nombre: string,
) {
  return prisma.zona.upsert({
    where: { id },
    update: { tenantId, empresaId, nombre, estado: true, deletedAt: null },
    create: {
      id,
      tenantId,
      empresaId,
      nombre,
      estado: true,
    },
  });
}

async function upsertServicio(
  id: string,
  tenantId: string,
  empresaId: string,
  nombre: string,
) {
  return prisma.servicio.upsert({
    where: { id },
    update: { tenantId, empresaId, nombre, activo: true },
    create: {
      id,
      tenantId,
      empresaId,
      nombre,
      activo: true,
    },
  });
}

async function upsertMetodoPago(
  id: string,
  tenantId: string,
  empresaId: string,
  nombre: string,
) {
  return prisma.metodoPago.upsert({
    where: { id },
    update: { tenantId, empresaId, nombre },
    create: { id, tenantId, empresaId, nombre },
  });
}

async function upsertCliente(
  id: string,
  data: {
    tenantId: string;
    empresaId: string;
    nombre: string;
    apellido?: string;
    razonSocial?: string;
    nit?: string;
    telefono: string;
    tipoCliente: TipoCliente;
  },
) {
  return prisma.cliente.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });
}

async function upsertDireccion(
  id: string,
  data: {
    tenantId: string;
    empresaId: string;
    clienteId: string;
    direccion: string;
    zonaId?: string;
  },
) {
  return prisma.direccion.upsert({
    where: { id },
    update: {
      ...data,
      activa: true,
      bloqueada: false,
    },
    create: {
      id,
      ...data,
      activa: true,
      bloqueada: false,
    },
  });
}

async function main() {
  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

  console.log('🚀 Iniciando seed RBAC de validación...');

  await upsertTenant(IDS.mainTenant, 'Tenant RBAC Principal', 'rbac-principal');
  await upsertTenant(
    IDS.outsiderTenant,
    'Tenant RBAC Outsider',
    'rbac-outsider',
  );

  await upsertEmpresa(IDS.empresaNorte, IDS.mainTenant, 'Empresa Norte');
  await upsertEmpresa(IDS.empresaSur, IDS.mainTenant, 'Empresa Sur');
  await upsertEmpresa(
    IDS.outsiderEmpresa,
    IDS.outsiderTenant,
    'Empresa Outsider',
  );

  await upsertZona(
    IDS.zonaNorteUno,
    IDS.mainTenant,
    IDS.empresaNorte,
    'Zona Norte 1',
  );
  await upsertZona(
    IDS.zonaNorteDos,
    IDS.mainTenant,
    IDS.empresaNorte,
    'Zona Norte 2',
  );
  await upsertZona(
    IDS.zonaSurUno,
    IDS.mainTenant,
    IDS.empresaSur,
    'Zona Sur 1',
  );
  await upsertZona(
    IDS.zonaSurDos,
    IDS.mainTenant,
    IDS.empresaSur,
    'Zona Sur 2',
  );

  await upsertServicio(
    IDS.servicioNorte,
    IDS.mainTenant,
    IDS.empresaNorte,
    'Servicio Norte',
  );
  await upsertServicio(
    IDS.servicioSur,
    IDS.mainTenant,
    IDS.empresaSur,
    'Servicio Sur',
  );
  await upsertServicio(
    IDS.outsiderServicio,
    IDS.outsiderTenant,
    IDS.outsiderEmpresa,
    'Servicio Outsider',
  );

  await upsertMetodoPago(
    IDS.metodoPagoNorte,
    IDS.mainTenant,
    IDS.empresaNorte,
    'EFECTIVO',
  );
  await upsertMetodoPago(
    IDS.metodoPagoSur,
    IDS.mainTenant,
    IDS.empresaSur,
    'TRANSFERENCIA',
  );
  await upsertMetodoPago(
    IDS.outsiderMetodoPago,
    IDS.outsiderTenant,
    IDS.outsiderEmpresa,
    'EFECTIVO',
  );

  const membershipByKey = new Map<string, { id: string; tenantId: string }>();

  for (const userConfig of MAIN_USERS) {
    const user = await prisma.user.upsert({
      where: { email: userConfig.email },
      update: {
        nombre: userConfig.nombre,
        apellido: userConfig.apellido,
        numeroDocumento: userConfig.numeroDocumento,
        password: passwordHash,
        isActive: true,
      },
      create: {
        email: userConfig.email,
        password: passwordHash,
        nombre: userConfig.nombre,
        apellido: userConfig.apellido,
        numeroDocumento: userConfig.numeroDocumento,
        isActive: true,
      },
    });

    const membership = await prisma.tenantMembership.upsert({
      where: {
        userId_tenantId: {
          userId: user.id,
          tenantId: userConfig.tenantId,
        },
      },
      update: {
        role: userConfig.role,
        status: MembershipStatus.ACTIVE,
        aprobado: true,
        activo: true,
      },
      create: {
        userId: user.id,
        tenantId: userConfig.tenantId,
        role: userConfig.role,
        status: MembershipStatus.ACTIVE,
        aprobado: true,
        activo: true,
      },
    });

    membershipByKey.set(userConfig.key, {
      id: membership.id,
      tenantId: membership.tenantId,
    });

    await prisma.empresaMembership.deleteMany({
      where: {
        membershipId: membership.id,
        tenantId: userConfig.tenantId,
        empresaId: {
          notIn: userConfig.empresaScopes.map((scope) => scope.empresaId),
        },
      },
    });

    for (const scope of userConfig.empresaScopes) {
      await prisma.empresaMembership.upsert({
        where: {
          membershipId_empresaId: {
            membershipId: membership.id,
            empresaId: scope.empresaId,
          },
        },
        update: {
          tenantId: userConfig.tenantId,
          role: scope.role ?? userConfig.role,
          zonaId: scope.zonaId ?? null,
          activo: true,
          deletedAt: null,
        },
        create: {
          tenantId: userConfig.tenantId,
          membershipId: membership.id,
          empresaId: scope.empresaId,
          zonaId: scope.zonaId ?? null,
          role: scope.role ?? userConfig.role,
          activo: true,
        },
      });
    }
  }

  await upsertCliente(IDS.clienteNorteA, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaNorte,
    nombre: 'Cliente Norte A',
    apellido: 'Validacion',
    telefono: '3001000001',
    tipoCliente: TipoCliente.PERSONA,
  });
  await upsertCliente(IDS.clienteNorteB, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaNorte,
    nombre: 'Cliente Norte B',
    apellido: 'Validacion',
    telefono: '3001000002',
    tipoCliente: TipoCliente.PERSONA,
  });
  await upsertCliente(IDS.clienteSurA, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaSur,
    nombre: 'Cliente Sur A',
    apellido: 'Validacion',
    telefono: '3002000001',
    tipoCliente: TipoCliente.PERSONA,
  });
  await upsertCliente(IDS.clienteSurB, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaSur,
    nombre: 'Cliente Sur B',
    apellido: 'Validacion',
    telefono: '3002000002',
    tipoCliente: TipoCliente.PERSONA,
  });
  await upsertCliente(IDS.clienteOutsider, {
    tenantId: IDS.outsiderTenant,
    empresaId: IDS.outsiderEmpresa,
    nombre: 'Cliente Outsider',
    apellido: 'Validacion',
    telefono: '3003000001',
    tipoCliente: TipoCliente.PERSONA,
  });

  await upsertDireccion(IDS.direccionNorteA, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaNorte,
    clienteId: IDS.clienteNorteA,
    direccion: 'Calle Norte 123',
    zonaId: IDS.zonaNorteUno,
  });
  await upsertDireccion(IDS.direccionNorteB, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaNorte,
    clienteId: IDS.clienteNorteB,
    direccion: 'Carrera Norte 456',
    zonaId: IDS.zonaNorteDos,
  });
  await upsertDireccion(IDS.direccionSurA, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaSur,
    clienteId: IDS.clienteSurA,
    direccion: 'Avenida Sur 789',
    zonaId: IDS.zonaSurUno,
  });
  await upsertDireccion(IDS.direccionSurB, {
    tenantId: IDS.mainTenant,
    empresaId: IDS.empresaSur,
    clienteId: IDS.clienteSurB,
    direccion: 'Boulevard Sur 321',
    zonaId: IDS.zonaSurDos,
  });
  await upsertDireccion(IDS.direccionOutsider, {
    tenantId: IDS.outsiderTenant,
    empresaId: IDS.outsiderEmpresa,
    clienteId: IDS.clienteOutsider,
    direccion: 'Diagonal Outsider 999',
  });

  const operadorNorte = membershipByKey.get('operador-norte');
  const operadorSur = membershipByKey.get('operador-sur');
  const outsiderAdmin = membershipByKey.get('outsider-admin');

  if (!operadorNorte || !operadorSur || !outsiderAdmin) {
    throw new Error(
      'No se pudieron resolver memberships base para sembrar órdenes RBAC.',
    );
  }

  await prisma.ordenServicio.upsert({
    where: { id: IDS.ordenNorteA },
    update: {
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaNorte,
      zonaId: IDS.zonaNorteUno,
      clienteId: IDS.clienteNorteA,
      direccionId: IDS.direccionNorteA,
      servicioId: IDS.servicioNorte,
      tecnicoId: operadorNorte.id,
      metodoPagoId: IDS.metodoPagoNorte,
      numeroOrden: 'RBAC-NORTE-001',
      direccionTexto: 'Calle Norte 123',
      valorCotizado: 150000,
      estadoServicio: EstadoOrden.TECNICO_FINALIZO,
      fechaVisita: new Date('2026-03-01T10:00:00.000Z'),
    },
    create: {
      id: IDS.ordenNorteA,
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaNorte,
      zonaId: IDS.zonaNorteUno,
      clienteId: IDS.clienteNorteA,
      direccionId: IDS.direccionNorteA,
      servicioId: IDS.servicioNorte,
      tecnicoId: operadorNorte.id,
      metodoPagoId: IDS.metodoPagoNorte,
      numeroOrden: 'RBAC-NORTE-001',
      direccionTexto: 'Calle Norte 123',
      valorCotizado: 150000,
      estadoServicio: EstadoOrden.TECNICO_FINALIZO,
      fechaVisita: new Date('2026-03-01T10:00:00.000Z'),
    },
  });

  await prisma.ordenServicio.upsert({
    where: { id: IDS.ordenNorteB },
    update: {
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaNorte,
      zonaId: IDS.zonaNorteDos,
      clienteId: IDS.clienteNorteB,
      direccionId: IDS.direccionNorteB,
      servicioId: IDS.servicioNorte,
      tecnicoId: operadorNorte.id,
      metodoPagoId: IDS.metodoPagoNorte,
      numeroOrden: 'RBAC-NORTE-002',
      direccionTexto: 'Carrera Norte 456',
      valorCotizado: 180000,
      estadoServicio: EstadoOrden.NUEVO,
      fechaVisita: new Date('2026-03-02T10:00:00.000Z'),
    },
    create: {
      id: IDS.ordenNorteB,
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaNorte,
      zonaId: IDS.zonaNorteDos,
      clienteId: IDS.clienteNorteB,
      direccionId: IDS.direccionNorteB,
      servicioId: IDS.servicioNorte,
      tecnicoId: operadorNorte.id,
      metodoPagoId: IDS.metodoPagoNorte,
      numeroOrden: 'RBAC-NORTE-002',
      direccionTexto: 'Carrera Norte 456',
      valorCotizado: 180000,
      estadoServicio: EstadoOrden.NUEVO,
      fechaVisita: new Date('2026-03-02T10:00:00.000Z'),
    },
  });

  await prisma.ordenServicio.upsert({
    where: { id: IDS.ordenSurA },
    update: {
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaSur,
      zonaId: IDS.zonaSurUno,
      clienteId: IDS.clienteSurA,
      direccionId: IDS.direccionSurA,
      servicioId: IDS.servicioSur,
      tecnicoId: operadorSur.id,
      metodoPagoId: IDS.metodoPagoSur,
      numeroOrden: 'RBAC-SUR-001',
      direccionTexto: 'Avenida Sur 789',
      valorCotizado: 210000,
      estadoServicio: EstadoOrden.TECNICO_FINALIZO,
      fechaVisita: new Date('2026-03-03T10:00:00.000Z'),
    },
    create: {
      id: IDS.ordenSurA,
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaSur,
      zonaId: IDS.zonaSurUno,
      clienteId: IDS.clienteSurA,
      direccionId: IDS.direccionSurA,
      servicioId: IDS.servicioSur,
      tecnicoId: operadorSur.id,
      metodoPagoId: IDS.metodoPagoSur,
      numeroOrden: 'RBAC-SUR-001',
      direccionTexto: 'Avenida Sur 789',
      valorCotizado: 210000,
      estadoServicio: EstadoOrden.TECNICO_FINALIZO,
      fechaVisita: new Date('2026-03-03T10:00:00.000Z'),
    },
  });

  await prisma.ordenServicio.upsert({
    where: { id: IDS.ordenSurB },
    update: {
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaSur,
      zonaId: IDS.zonaSurDos,
      clienteId: IDS.clienteSurB,
      direccionId: IDS.direccionSurB,
      servicioId: IDS.servicioSur,
      tecnicoId: operadorSur.id,
      metodoPagoId: IDS.metodoPagoSur,
      numeroOrden: 'RBAC-SUR-002',
      direccionTexto: 'Boulevard Sur 321',
      valorCotizado: 195000,
      estadoServicio: EstadoOrden.NUEVO,
      fechaVisita: new Date('2026-03-04T10:00:00.000Z'),
    },
    create: {
      id: IDS.ordenSurB,
      tenantId: IDS.mainTenant,
      empresaId: IDS.empresaSur,
      zonaId: IDS.zonaSurDos,
      clienteId: IDS.clienteSurB,
      direccionId: IDS.direccionSurB,
      servicioId: IDS.servicioSur,
      tecnicoId: operadorSur.id,
      metodoPagoId: IDS.metodoPagoSur,
      numeroOrden: 'RBAC-SUR-002',
      direccionTexto: 'Boulevard Sur 321',
      valorCotizado: 195000,
      estadoServicio: EstadoOrden.NUEVO,
      fechaVisita: new Date('2026-03-04T10:00:00.000Z'),
    },
  });

  await prisma.ordenServicio.upsert({
    where: { id: IDS.ordenOutsider },
    update: {
      tenantId: IDS.outsiderTenant,
      empresaId: IDS.outsiderEmpresa,
      clienteId: IDS.clienteOutsider,
      direccionId: IDS.direccionOutsider,
      servicioId: IDS.outsiderServicio,
      tecnicoId: outsiderAdmin.id,
      metodoPagoId: IDS.outsiderMetodoPago,
      numeroOrden: 'RBAC-OUT-001',
      direccionTexto: 'Diagonal Outsider 999',
      valorCotizado: 99000,
      estadoServicio: EstadoOrden.NUEVO,
      fechaVisita: new Date('2026-03-05T10:00:00.000Z'),
    },
    create: {
      id: IDS.ordenOutsider,
      tenantId: IDS.outsiderTenant,
      empresaId: IDS.outsiderEmpresa,
      clienteId: IDS.clienteOutsider,
      direccionId: IDS.direccionOutsider,
      servicioId: IDS.outsiderServicio,
      tecnicoId: outsiderAdmin.id,
      metodoPagoId: IDS.outsiderMetodoPago,
      numeroOrden: 'RBAC-OUT-001',
      direccionTexto: 'Diagonal Outsider 999',
      valorCotizado: 99000,
      estadoServicio: EstadoOrden.NUEVO,
      fechaVisita: new Date('2026-03-05T10:00:00.000Z'),
    },
  });

  console.log('\n✅ Seed RBAC completado.\n');
  console.log(`Credencial común: ${DEFAULT_PASSWORD}`);
  console.log('Usuarios semilla y expectativa de validación:\n');

  for (const user of MAIN_USERS) {
    console.log(`- ${user.email} [${user.role}]`);
    for (const line of user.expectedVisibility) {
      console.log(`  • ${line}`);
    }
  }

  console.log('\nChecklist sugerido:');
  console.log(
    '1. SU_ADMIN / ADMIN deben ver Norte + Sur, pero nunca tenant outsider.',
  );
  console.log(
    '2. COORDINADOR global debe ver ambas empresas del tenant principal.',
  );
  console.log(
    '3. Coordinadores/asesores empresa-only deben ver ambas zonas de su empresa.',
  );
  console.log(
    '4. Coordinadores/asesores zona-only deben quedar restringidos a Zona 1.',
  );
  console.log(
    '5. OPERADOR Norte/Sur deben servir para validar órdenes asignadas por membership.',
  );
  console.log('6. Outsider admin debe ver solo RBAC-OUT-001 y su cliente.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
