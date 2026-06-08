import { PrismaClient } from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (connectionString) {
  console.log('🔗 URL:', connectionString.replace(/:[^:@]+@/, ':****@'));
} else {
  console.error('❌ NO DATABASE_URL FOUND');
}

// Clean SSL params from URL to let pg.Pool config handle it
let cleanedUrl = connectionString || '';
try {
  const urlObj = new URL(cleanedUrl);
  urlObj.searchParams.delete('sslmode');
  urlObj.searchParams.delete('sslrootcert');
  urlObj.searchParams.delete('sslcert');
  urlObj.searchParams.delete('sslkey');
  cleanedUrl = urlObj.toString();
} catch (e) {
  // ignore
}

const pool = new pg.Pool({ 
  connectionString: cleanedUrl,
  ssl: false
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface LocationData {
  dpto: string;
  cod_dpto: string;
  nom_mpio: string;
  cod_mpio: string;
}

interface DBLocation {
  id: string;
  code: string;
  name: string;
}

async function main() {
  console.log('🌱 Iniciando Seed de Departamentos y Municipios...');

  // 0. Popular Departamentos y Municipios
  console.log('🇨🇴 Poblando Departamentos y Municipios...');
  const jsonPath = path.join(__dirname, '../departamentos-municipios.json');
  const rawData = fs.readFileSync(jsonPath, 'utf-8');
  const locations = JSON.parse(rawData) as LocationData[];

  // Extraer Departamentos únicos
  const departmentsMap = new Map<string, { name: string; code: string }>();
  locations.forEach((loc) => {
    if (!departmentsMap.has(loc.cod_dpto)) {
      departmentsMap.set(loc.cod_dpto, {
        name: loc.dpto,
        code: loc.cod_dpto
      });
    }
  });

  // Insertar Departamentos
  // Usamos unknown y luego any porque los modelos no están en el esquema actual
  // pero queremos mantener la lógica del seed intacta por si se agregan luego.
  const prismaAny = prisma as unknown as any;

  if (prismaAny.department) {
    await prismaAny.department.createMany({
      data: Array.from(departmentsMap.values()),
      skipDuplicates: true,
    });

    // Obtener IDs de Departamentos creados
    const createdDepartments = await prismaAny.department.findMany() as DBLocation[];
    const depCodeToId = new Map(createdDepartments.map((d) => [d.code, d.id]));

    // Preparar Municipios
    const municipalitiesData = locations.map((loc) => {
      const depId = depCodeToId.get(loc.cod_dpto);
      if (!depId) return null;
      
      return {
        name: loc.nom_mpio,
        code: loc.cod_mpio,
        departmentId: depId
      };
    }).filter((m): m is { name: string; code: string; departmentId: string } => m !== null);

    // Insertar Municipios
    if (prismaAny.municipality) {
      await prismaAny.municipality.createMany({
        data: municipalitiesData,
        skipDuplicates: true,
      });
      console.log(`✅ ${departmentsMap.size} Departamentos y ${municipalitiesData.length} Municipios creados.`);
    }
  } else {
    console.warn('⚠️ Los modelos Department/Municipality no existen en el esquema actual. Saltando inserción.');
  }
  
  console.log('✅ Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });