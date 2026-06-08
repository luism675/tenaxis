import { PrismaClient, Role } from '../src/generated/client/client';
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

const pool = new pg.Pool({ connectionString, ssl: false });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TENANT_ID = '0d003940-5049-4ebe-86f8-d62605e26a93';
const EMPRESA_ID = '05cefa1d-5018-4b9f-a5ee-96cd29c6eed0';

async function main() {
  console.log('🌱 Iniciando Seed de Monitoreo...');
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  const usersData = [
    { email: 'camila@tenaxis.com', nombre: 'Camila', apellido: 'a', username: 'camila', role: Role.ASESOR },
    { email: 'andreitha@tenaxis.com', nombre: 'Dayan Andrea', apellido: 'Benavides Mora', username: 'andreitha', role: Role.ADMIN },
    { email: 'diego@tenaxis.com', nombre: 'Diego', apellido: 'Loaiza', username: 'diego', role: Role.ASESOR },
    { email: 'dilan@tenaxis.com', nombre: 'Dilan Andres', apellido: 'Rojas Perez', username: 'dilan', role: Role.ASESOR },
    { email: 'edison@tenaxis.com', nombre: 'Edison', apellido: 'Hurtado', username: 'Edison', role: Role.ADMIN },
    { email: 'hilary@tenaxis.com', nombre: 'Hilary', apellido: 'Arbelaez', username: 'hilary', role: Role.ADMIN },
    { email: 'luis@tenaxis.com', nombre: 'Luis', apellido: 'Florez', username: 'luis', role: Role.ADMIN },
  ];

  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: passwordHash,
        nombre: u.nombre,
        apellido: u.apellido,
        numeroDocumento: `DOC-${u.username.toUpperCase()}`,
        isActive: true,
      },
    });

    const membership = await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: TENANT_ID } },
      update: { username: u.username, role: u.role, aprobado: true, activo: true },
      create: {
        userId: user.id,
        tenantId: TENANT_ID,
        username: u.username,
        role: u.role,
        aprobado: true,
        activo: true,
      },
    });

    await prisma.empresaMembership.upsert({
      where: { membershipId_empresaId: { membershipId: membership.id, empresaId: EMPRESA_ID } },
      update: { role: u.role, activo: true },
      create: {
        tenantId: TENANT_ID,
        membershipId: membership.id,
        empresaId: EMPRESA_ID,
        role: u.role,
        activo: true,
      },
    });

    // Crear sesión de actividad
    let fechaInicio = new Date();
    let fechaFin: Date | null = new Date();
    let tipoEvento = 'FOCO_PERDIDO';
    let tiempoInactivo = 0;

    if (u.username === 'camila') {
      fechaInicio.setHours(6, 46, 0);
      fechaFin.setHours(8, 17, 0);
      tiempoInactivo = 137;
    } else if (u.username === 'andreitha') {
      fechaInicio.setHours(9, 35, 0);
      fechaFin = null;
      tipoEvento = 'INACTIVIDAD_FIN';
      tiempoInactivo = 982;
    } else if (u.username === 'diego') {
      fechaInicio.setHours(6, 22, 0);
      fechaFin.setHours(11, 7, 0);
      tipoEvento = 'INACTIVIDAD_INICIO';
      tiempoInactivo = 5;
    } else if (u.username === 'dilan') {
      fechaInicio.setHours(7, 16, 0);
      fechaFin = null;
      tipoEvento = 'INACTIVIDAD_INICIO';
      tiempoInactivo = 95;
    } else if (u.username === 'Edison') {
      fechaInicio.setHours(10, 45, 0);
      fechaFin = null;
      tipoEvento = 'FOCO_PERDIDO';
      tiempoInactivo = 0;
    } else if (u.username === 'hilary') {
      fechaInicio.setHours(7, 57, 0);
      fechaFin.setHours(11, 32, 0);
      tipoEvento = 'FOCO_PERDIDO';
      tiempoInactivo = 13;
    } else if (u.username === 'luis') {
      fechaInicio.setHours(10, 51, 0);
      fechaFin = null;
      tipoEvento = 'FOCO_RECUPERADO';
      tiempoInactivo = 29;
    }

    const session = await prisma.sesionActividad.create({
      data: {
        tenantId: TENANT_ID,
        empresaId: EMPRESA_ID,
        membershipId: membership.id,
        fechaInicio,
        fechaFin,
        tiempoInactivo,
        dispositivo: 'Web Browser',
        ip: '192.168.1.10',
      },
    });

    await prisma.logEvento.create({
      data: {
        tenantId: TENANT_ID,
        empresaId: EMPRESA_ID,
        sesionId: session.id,
        tipo: tipoEvento,
        descripcion: `El usuario cambió el estado a ${tipoEvento}`,
        createdAt: new Date(),
      },
    });
  }

  console.log('✅ Seed de monitoreo completado.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
