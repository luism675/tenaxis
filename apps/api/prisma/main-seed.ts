import { PrismaClient, Role, TipoCliente, EstadoOrden, MembershipStatus } from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import bcrypt from 'bcrypt';

// Cargar variables de entorno
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

let connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DIRECT_URL;

// Limpieza de parámetros SSL
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
} catch (e) {
  console.error('Error parsing connection string', e);
}

const pool = new pg.Pool({ 
  connectionString,
  ssl: false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// IDS REALES
const TENANT_ID = '0d003940-5049-4ebe-86f8-d62605e26a93';
const EMPRESA_ID = '05cefa1d-5018-4b9f-a5ee-96cd29c6eed0';

interface LocationData {
  dpto: string;
  cod_dpto: string;
  nom_mpio: string;
  cod_mpio: string;
}

async function main() {
  console.log('🚀 Iniciando Master Seed (Full Reset Mode)...');
  const passwordHash = bcrypt.hashSync('Password123!', 10);

  // 1. Departamentos y Municipios
  console.log('🇨🇴 Poblando Geografía Colombiana...');
  const jsonPath = path.join(__dirname, '../departamentos-municipios.json');
  if (fs.existsSync(jsonPath)) {
    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const locations = JSON.parse(rawData) as LocationData[];
    const prismaAny = prisma as any;

    if (prismaAny.department) {
      const departmentsMap = new Map<string, { name: string; code: string }>();
      locations.forEach(loc => departmentsMap.set(loc.cod_dpto, { name: loc.dpto, code: loc.cod_dpto }));
      
      await prismaAny.department.createMany({ data: Array.from(departmentsMap.values()), skipDuplicates: true });
      const createdDeps = await prismaAny.department.findMany();
      const depCodeToId = new Map(createdDeps.map((d: any) => [d.code, d.id]));

      const municipalitiesData = locations.map(loc => ({
        name: loc.nom_mpio,
        code: loc.cod_mpio,
        departmentId: depCodeToId.get(loc.cod_dpto)
      })).filter(m => m.departmentId);

      await prismaAny.municipality.createMany({ data: municipalitiesData, skipDuplicates: true });
      console.log('✅ Geografía completada.');
    }
  }

  // 2. Tenant y Empresa
  console.log('🏢 Configurando Tenant y Empresa...');
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: {},
    create: { id: TENANT_ID, nombre: 'Tenaxis SaaS Cloud', slug: 'tenaxis-main', isActive: true }
  });

  await prisma.empresa.upsert({
    where: { id: EMPRESA_ID },
    update: {},
    create: { id: EMPRESA_ID, tenantId: TENANT_ID, nombre: 'Tenaxis Operaciones SAS', activo: true }
  });
  console.log('✅ Estructura base lista.');

  // 3. Super Admin
  console.log('👑 Creando SU_ADMIN...');
  const suAdmin = await prisma.user.upsert({
    where: { email: 'suadmin@tenaxis.com' },
    update: { password: passwordHash },
    create: {
      email: 'suadmin@tenaxis.com',
      password: passwordHash,
      nombre: 'Super',
      apellido: 'Admin',
      numeroDocumento: '1000000',
      isActive: true
    }
  });

  const suMembership = await prisma.tenantMembership.upsert({
    where: { userId_tenantId: { userId: suAdmin.id, tenantId: TENANT_ID } },
    update: { role: Role.SU_ADMIN },
    create: { userId: suAdmin.id, tenantId: TENANT_ID, role: Role.SU_ADMIN, status: MembershipStatus.ACTIVE, aprobado: true }
  });

  await prisma.empresaMembership.upsert({
    where: { membershipId_empresaId: { membershipId: suMembership.id, empresaId: EMPRESA_ID } },
    update: { role: Role.SU_ADMIN },
    create: { tenantId: TENANT_ID, membershipId: suMembership.id, empresaId: EMPRESA_ID, role: Role.SU_ADMIN }
  });
  console.log('✅ Super Admin creado: suadmin@tenaxis.com / Password123!');

  // 4. Usuarios por Rol (20 en total)
  const roles = [Role.ADMIN, Role.COORDINADOR, Role.ASESOR, Role.OPERADOR];
  console.log('👥 Generando 20 usuarios operativos...');
  
  for (const role of roles) {
    for (let i = 1; i <= 5; i++) {
      const email = `${role.toLowerCase()}${i}@tenaxis.com`;
      const user = await prisma.user.create({
        data: {
          email,
          password: passwordHash,
          nombre: `${role.charAt(0) + role.slice(1).toLowerCase()}`,
          apellido: `Usuario ${i}`,
          numeroDocumento: `${role.substring(0,2)}${i}${Math.floor(Math.random() * 1000)}`,
          isActive: true
        }
      });

      const tm = await prisma.tenantMembership.create({
        data: { userId: user.id, tenantId: TENANT_ID, role, status: MembershipStatus.ACTIVE, aprobado: true }
      });

      await prisma.empresaMembership.create({
        data: { tenantId: TENANT_ID, membershipId: tm.id, empresaId: EMPRESA_ID, role }
      });
    }
  }

  // 5. Configuración de Negocio
  console.log('⚙️ Configurando métodos y catálogos...');
  const metodos = ['EFECTIVO', 'TRANSFERENCIA', 'CREDITO', 'BONO', 'CORTESIA'];
  for (const m of metodos) {
    await prisma.metodoPago.create({ data: { nombre: m, tenantId: TENANT_ID, empresaId: EMPRESA_ID } });
  }

  const serviciosList = ['CONTROL DE PLAGAS', 'LIMPIEZA DE TANQUES', 'DESINFECCION'];
  for (const s of serviciosList) {
    await prisma.servicio.create({ data: { nombre: s, tenantId: TENANT_ID, empresaId: EMPRESA_ID } });
  }

  const estadosServicioList = ['PROGRAMADO', 'EN CAMINO', 'EN SITIO', 'FINALIZADO', 'CANCELADO', 'REPROGRAMADO'];
  for (const e of estadosServicioList) {
    await prisma.estadoServicio.create({
      data: {
        nombre: e,
        activo: true,
        tenantId: TENANT_ID,
        empresaId: EMPRESA_ID
      }
    });
  }

  // 6. Clientes
  console.log('👤 Creando clientes...');
  const clientes: any[] = [];
  const clsData = [
    { nombre: 'Andrés', apellido: 'Patiño', telefono: '3001112233', tipoCliente: TipoCliente.PERSONA },
    { razonSocial: 'Restaurante Central', nit: '900123456-1', telefono: '6041234567', tipoCliente: TipoCliente.EMPRESA },
    { nombre: 'Beatriz', apellido: 'Sierra', telefono: '3105554433', tipoCliente: TipoCliente.PERSONA },
  ];

  for (const c of clsData) {
    const created = await prisma.cliente.create({ data: { ...c, tenantId: TENANT_ID, empresaId: EMPRESA_ID } });
    clientes.push(created);
  }

  // 7. Órdenes y Recaudo (Simular flujo de caja)
  console.log('💰 Generando órdenes con saldos pendientes...');
  const operators = await prisma.tenantMembership.findMany({ where: { tenantId: TENANT_ID, role: Role.OPERADOR } });
  const serviceItems = await prisma.servicio.findMany({ where: { empresaId: EMPRESA_ID } });
  const paymentMethods = await prisma.metodoPago.findMany({ where: { empresaId: EMPRESA_ID } });
  const cashMethod = paymentMethods.find(m => m.nombre === 'EFECTIVO');

  for (let i = 0; i < 15; i++) {
    const tech = operators[i % operators.length]!;
    const method = i % 3 === 0 ? cashMethod! : paymentMethods[i % paymentMethods.length]!;
    const value = 150000 + (i * 10000);

    const orden = await prisma.ordenServicio.create({
      data: {
        tenantId: TENANT_ID,
        empresaId: EMPRESA_ID,
        clienteId: clientes[i % clientes.length]!.id,
        servicioId: serviceItems[i % serviceItems.length]!.id,
        tecnicoId: tech.id,
        metodoPagoId: method.id,
        direccionTexto: 'Calle de prueba ' + i,
        valorCotizado: value,
        estadoServicio: EstadoOrden.TECNICO_FINALIZO,
        numeroOrden: `ORD-2026-${100 + i}`,
        fechaVisita: new Date()
      }
    });

    if (method.nombre === 'EFECTIVO') {
      await prisma.declaracionEfectivo.create({
        data: {
          tenantId: TENANT_ID,
          empresaId: EMPRESA_ID,
          ordenId: orden.id,
          tecnicoId: tech.id,
          valorDeclarado: value,
          evidenciaPath: 'https://via.placeholder.com/200',
          consignado: false
        }
      });
    }
  }

  console.log(`
✅ BASE DE DATOS RECONSTRUIDA EXITOSAMENTE
-------------------------------------------
SU_ADMIN: suadmin@tenaxis.com / Password123!
USUARIOS: admin1@tenaxis.com, operador1@tenaxis.com, etc.
-------------------------------------------
`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
