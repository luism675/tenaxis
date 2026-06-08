import { PrismaClient } from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import bcrypt from 'bcrypt';

import * as path from 'path';

// Force load the .env from the local apps/api directory and override existing env vars
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

let connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL;

if (connectionString) {
  console.log('🔗 URL detectada:', connectionString.replace(/:[^:@]+@/, ':****@'));
} else {
  console.error('❌ No se encontró ninguna variable de conexión (DATABASE_URL, POSTGRES_URL_NON_POOLING, o DIRECT_URL)');
}

// 1. Clean SSL params to avoid conflicts and force SSL: false later
try {
  if (connectionString) {
    const urlObj = new URL(connectionString);
    urlObj.searchParams.delete('sslmode');
    urlObj.searchParams.delete('sslrootcert');
    urlObj.searchParams.delete('sslcert');
    urlObj.searchParams.delete('sslkey');

    // 2. Ensure schema is set in the search_path via query param options
    if (!urlObj.searchParams.has('schema')) {
      urlObj.searchParams.set('schema', 'public');
    }

    // Also force it via 'options' param which pg driver respects
    urlObj.searchParams.set('options', '-c search_path=public');

    connectionString = urlObj.toString();
  }
} catch (e) {
  console.error('Error parsing connection string', e);
}

const pool = new pg.Pool({ 
  connectionString,
  ssl: false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TENANT_ID = '0d003940-5049-4ebe-86f8-d62605e26a93';
const EMPRESA_ID = '05cefa1d-5018-4b9f-a5ee-96cd29c6eed0';

async function main() {
  console.log('🌱 Iniciando Seed de Usuarios...');

  // 1. Asegurar que el Tenant existe
  const tenant = await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: {
      id: TENANT_ID,
      nombre: 'Tenant Principal',
      slug: 'tenant-principal',
      isActive: true,
    },
  });
  console.log(`✅ Tenant asegurado: ${tenant.nombre} (${TENANT_ID})`);

  // 2. Asegurar que la Empresa existe
  const empresa = await prisma.empresa.upsert({
    where: { id: EMPRESA_ID },
    update: {},
    create: {
      id: EMPRESA_ID,
      tenantId: TENANT_ID,
      nombre: 'Empresa Principal',
      activo: true,
    },
  });
  console.log(`✅ Empresa asegurada: ${empresa.nombre} (${EMPRESA_ID})`);

  // Roles a seedear (excluyendo SU_ADMIN)
  const roles = ['ADMIN', 'COORDINADOR', 'ASESOR', 'OPERADOR'] as const;
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  for (const role of roles) {
    console.log(`👥 Creando 5 usuarios para el rol: ${role}...`);
    for (let i = 1; i <= 5; i++) {
      const email = `${role.toLowerCase()}${i}@tenaxis.com`.replace('ñ', 'n'); // Por si acaso
      const nombre = `${role.charAt(0)}${role.slice(1).toLowerCase()} ${i}`;
      const apellido = 'Prueba';
      const docNum = `${role.substring(0, 3).toUpperCase()}-${1000 + i + (roles.indexOf(role) * 10)}`;

      // 3. Crear o actualizar Usuario
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          password: passwordHash,
          isActive: true,
        },
        create: {
          email,
          password: passwordHash,
          nombre,
          apellido,
          numeroDocumento: docNum,
          isActive: true,
        },
      });
      console.log(`   👤 Usuario: ${user.email} (${user.id})`);

      // 4. Crear o actualizar Membresía de Tenant
      const membership = await prisma.tenantMembership.upsert({
        where: {
          userId_tenantId: {
            userId: user.id,
            tenantId: TENANT_ID,
          },
        },
        update: {
          role: role as any,
          status: 'ACTIVE',
          aprobado: true,
          activo: true,
        },
        create: {
          userId: user.id,
          tenantId: TENANT_ID,
          role: role as any,
          status: 'ACTIVE',
          aprobado: true,
          activo: true,
        },
      });
      console.log(`   🆔 Membresía Tenant: ${membership.id} (Rol: ${membership.role})`);

      // 5. Crear o actualizar Membresía de Empresa
      const empMembership = await prisma.empresaMembership.upsert({
        where: {
          membershipId_empresaId: {
            membershipId: membership.id,
            empresaId: EMPRESA_ID,
          },
        },
        update: {
          tenantId: TENANT_ID,
          role: role as any,
          activo: true,
        },
        create: {
          tenantId: TENANT_ID,
          membershipId: membership.id,
          empresaId: EMPRESA_ID,
          role: role as any,
          activo: true,
        },
      });
      console.log(`   🏢 Membresía Empresa: ${empMembership.id}`);
    }
  }

  // Resumen final
  const userCount = await prisma.user.count();
  const membershipCount = await prisma.tenantMembership.count({ where: { tenantId: TENANT_ID } });
  const empresaMembershipCount = await prisma.empresaMembership.count({ where: { empresaId: EMPRESA_ID } });

  console.log('\n--- RESUMEN FINAL ---');
  console.log(`Total Usuarios en DB: ${userCount}`);
  console.log(`Total Membresías en Tenant: ${membershipCount}`);
  console.log(`Total Membresías en Empresa: ${empresaMembershipCount}`);
  console.log('---------------------\n');

  console.log('✅ Seed de usuarios completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
