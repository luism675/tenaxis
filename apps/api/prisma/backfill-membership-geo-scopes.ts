import { PrismaClient } from '../src/generated/client/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is required to run backfill-membership-geo-scopes',
  );
}

let cleanedUrl = connectionString;
try {
  const urlObj = new URL(cleanedUrl);
  urlObj.searchParams.delete('sslmode');
  urlObj.searchParams.delete('sslrootcert');
  urlObj.searchParams.delete('sslcert');
  urlObj.searchParams.delete('sslkey');
  cleanedUrl = urlObj.toString();
} catch {
  // ignore malformed DATABASE_URL parsing and let pg handle it later
}

const pool = new pg.Pool({
  connectionString: cleanedUrl,
  ssl: false,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const shouldApply = process.argv.includes('--apply');

type ScopeKey = `${string}:${string}`;

type LegacyMembershipRow = {
  id: string;
  tenantId: string;
  municipioId: string | null;
  municipio: {
    id: string;
    name: string;
    departmentId: string;
    department: {
      id: string;
      name: string;
    } | null;
  } | null;
};

function buildScopeKey(membershipId: string, geoId: string): ScopeKey {
  return `${membershipId}:${geoId}`;
}

async function main() {
  const legacyMemberships: LegacyMembershipRow[] =
    await prisma.tenantMembership.findMany({
      where: {
        municipioId: {
          not: null,
        },
      },
      select: {
        id: true,
        tenantId: true,
        municipioId: true,
        municipio: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            department: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

  const municipalityMembershipIds = legacyMemberships.map(
    (membership) => membership.id,
  );
  const municipalityIds = [
    ...new Set(
      legacyMemberships
        .map((membership) => membership.municipioId)
        .filter((municipioId): municipioId is string => !!municipioId),
    ),
  ];

  const [existingMunicipalityScopes, existingDepartmentScopes]: [
    Array<{ membershipId: string; municipalityId: string }>,
    Array<{ membershipId: string; departmentId: string }>,
  ] = await Promise.all([
    municipalityMembershipIds.length
      ? prisma.tenantMembershipMunicipalityScope.findMany({
          where: {
            membershipId: {
              in: municipalityMembershipIds,
            },
          },
          select: {
            membershipId: true,
            municipalityId: true,
          },
        })
      : [],
    municipalityMembershipIds.length
      ? prisma.tenantMembershipDepartmentScope.findMany({
          where: {
            membershipId: {
              in: municipalityMembershipIds,
            },
          },
          select: {
            membershipId: true,
            departmentId: true,
          },
        })
      : [],
  ]);

  const existingMunicipalityScopeKeys = new Set(
    existingMunicipalityScopes.map((scope) =>
      buildScopeKey(scope.membershipId, scope.municipalityId),
    ),
  );
  const existingDepartmentScopeKeys = new Set(
    existingDepartmentScopes.map((scope) =>
      buildScopeKey(scope.membershipId, scope.departmentId),
    ),
  );

  const municipalityScopeRows: Array<{
    tenantId: string;
    membershipId: string;
    municipalityId: string;
  }> = [];
  const departmentScopeRows: Array<{
    tenantId: string;
    membershipId: string;
    departmentId: string;
  }> = [];
  const orphanedLegacyMunicipios: Array<{
    membershipId: string;
    municipioId: string;
  }> = [];

  for (const membership of legacyMemberships) {
    if (!membership.municipioId) {
      continue;
    }

    if (!membership.municipio) {
      orphanedLegacyMunicipios.push({
        membershipId: membership.id,
        municipioId: membership.municipioId,
      });
      continue;
    }

    const municipalityScopeKey = buildScopeKey(
      membership.id,
      membership.municipioId,
    );
    if (!existingMunicipalityScopeKeys.has(municipalityScopeKey)) {
      municipalityScopeRows.push({
        tenantId: membership.tenantId,
        membershipId: membership.id,
        municipalityId: membership.municipioId,
      });
      existingMunicipalityScopeKeys.add(municipalityScopeKey);
    }

    const departmentScopeKey = buildScopeKey(
      membership.id,
      membership.municipio.departmentId,
    );
    if (!existingDepartmentScopeKeys.has(departmentScopeKey)) {
      departmentScopeRows.push({
        tenantId: membership.tenantId,
        membershipId: membership.id,
        departmentId: membership.municipio.departmentId,
      });
      existingDepartmentScopeKeys.add(departmentScopeKey);
    }
  }

  if (shouldApply) {
    await prisma.$transaction(async (tx) => {
      if (municipalityScopeRows.length > 0) {
        await tx.tenantMembershipMunicipalityScope.createMany({
          data: municipalityScopeRows,
          skipDuplicates: true,
        });
      }

      if (departmentScopeRows.length > 0) {
        await tx.tenantMembershipDepartmentScope.createMany({
          data: departmentScopeRows,
          skipDuplicates: true,
        });
      }
    });
  }

  console.log('');
  console.log('Backfill legacy municipioId -> membership geo scopes');
  console.log(`Modo: ${shouldApply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Membresías legacy detectadas: ${legacyMemberships.length}`);
  console.log(`Municipios únicos legacy detectados: ${municipalityIds.length}`);
  console.log(`Municipality scopes faltantes: ${municipalityScopeRows.length}`);
  console.log(`Department scopes faltantes: ${departmentScopeRows.length}`);

  if (orphanedLegacyMunicipios.length > 0) {
    console.log(
      `Advertencia: ${orphanedLegacyMunicipios.length} membresías apuntan a un municipio inexistente o roto.`,
    );
    for (const orphan of orphanedLegacyMunicipios.slice(0, 20)) {
      console.log(
        `  - membership ${orphan.membershipId} -> municipioId ${orphan.municipioId}`,
      );
    }
  }
}

main()
  .catch((error) => {
    console.error('Error ejecutando el backfill de geo scopes:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
