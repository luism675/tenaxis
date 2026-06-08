const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

try {
  const dotenv = require('dotenv');
  const envPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
  }
} catch {
  // En producción las variables llegan desde el contenedor; dotenv puede no existir.
}

function readValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;

  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function printUsage() {
  console.log(`
Revoca sesiones activas de un usuario.

Uso local:
  pnpm --filter api revoke:user-sessions -- --email usuario@correo.com --apply

Uso dentro del contenedor API:
  node prisma/revoke-user-sessions.js --email usuario@correo.com --apply

Opciones:
  --email       Email del usuario.
  --user-id     ID del usuario.
  --tenant-id   Limita la revocación a un tenant.
  --empresa-id  Limita la revocación a una empresa.
  --session-id  Revoca una sesión específica.
  --apply       Aplica cambios. Sin este flag solo muestra el dry-run.
`);
}

function parseOptions() {
  const email = readValue('--email') || process.env.TARGET_EMAIL;
  const userId = readValue('--user-id') || process.env.TARGET_USER_ID;

  if (email && userId) {
    throw new Error('Usá --email o --user-id, no ambos.');
  }

  if (!email && !userId) {
    throw new Error('Falta identificar el usuario con --email o --user-id.');
  }

  return {
    email: email ? email.trim().toLowerCase() : undefined,
    userId: userId ? userId.trim() : undefined,
    tenantId: readValue('--tenant-id') || process.env.TARGET_TENANT_ID,
    empresaId: readValue('--empresa-id') || process.env.TARGET_EMPRESA_ID,
    sessionId: readValue('--session-id') || process.env.TARGET_SESSION_ID,
    shouldApply: hasFlag('--apply') || process.env.APPLY === 'true',
  };
}

function buildConnectionString() {
  const rawConnectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DIRECT_URL;

  if (!rawConnectionString) {
    throw new Error(
      'No se encontró DATABASE_URL, POSTGRES_URL_NON_POOLING ni DIRECT_URL.',
    );
  }

  const url = new URL(rawConnectionString);
  if (!url.password) {
    throw new Error(
      'La URL de PostgreSQL no tiene password. Revisá la variable de conexión.',
    );
  }

  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslrootcert');
  url.searchParams.delete('sslcert');
  url.searchParams.delete('sslkey');
  url.searchParams.set('schema', url.searchParams.get('schema') || 'public');
  url.searchParams.set('options', '-c search_path=public');

  return url.toString();
}

function buildSessionWhere(options, values) {
  const clauses = ['s.revoked = false', 's."expiresAt" > now()'];

  if (options.email) {
    values.push(options.email);
    clauses.push(`lower(u.email) = lower($${values.length})`);
  }

  if (options.userId) {
    values.push(options.userId);
    clauses.push(`u.id = $${values.length}`);
  }

  if (options.tenantId) {
    values.push(options.tenantId);
    clauses.push(`s."tenantId" = $${values.length}`);
  }

  if (options.empresaId) {
    values.push(options.empresaId);
    clauses.push(`s."empresaId" = $${values.length}`);
  }

  if (options.sessionId) {
    values.push(options.sessionId);
    clauses.push(`s.id = $${values.length}`);
  }

  return clauses.join('\n    AND ');
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    printUsage();
    return;
  }

  const options = parseOptions();
  const pool = new Pool({
    connectionString: buildConnectionString(),
    ssl: false,
  });

  try {
    const values = [];
    const where = buildSessionWhere(options, values);

    const sessionsResult = await pool.query(
      `
      SELECT
        s.id,
        s."tenantId",
        s."empresaId",
        s."createdAt",
        s."expiresAt",
        u.id AS "userId",
        u.email,
        u.nombre,
        u.apellido
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s."userId"
      WHERE ${where}
      ORDER BY s."createdAt" DESC
      `,
      values,
    );

    const firstRow = sessionsResult.rows[0];
    if (!firstRow) {
      console.log('Sesiones activas encontradas: 0');
      return;
    }

    console.log(
      `Usuario: ${firstRow.email} (${firstRow.nombre} ${firstRow.apellido}) - ${firstRow.userId}`,
    );
    console.log(`Sesiones activas encontradas: ${sessionsResult.rowCount}`);

    for (const session of sessionsResult.rows) {
      console.log(
        `- ${session.id} | tenant=${session.tenantId || 'N/A'} | empresa=${
          session.empresaId || 'N/A'
        } | creada=${session.createdAt.toISOString()} | expira=${session.expiresAt.toISOString()}`,
      );
    }

    if (!options.shouldApply) {
      console.log('\nDry-run: agregá --apply para revocar estas sesiones.');
      return;
    }

    const sessionIds = sessionsResult.rows.map((session) => session.id);
    const updateResult = await pool.query(
      `
      UPDATE auth_sessions
      SET revoked = true
      WHERE id = ANY($1::uuid[])
        AND revoked = false
      RETURNING id
      `,
      [sessionIds],
    );

    console.log(`\nSesiones revocadas: ${updateResult.rowCount}`);
    console.log(updateResult.rows.map((row) => row.id).join('\n'));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
