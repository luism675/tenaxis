import * as dotenv from 'dotenv';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  EstadoPagoOrden,
  MetodoPagoBase,
  Prisma,
  PrismaClient,
} from '../src/generated/client/client';

dotenv.config();

const shouldApply = process.argv.includes('--apply');
const includeClosed = process.argv.includes('--include-closed');
const verbose = process.argv.includes('--verbose');
const tenantArg = readArg('--tenant');
const orderArg = readArg('--order');
const limitArg = Number(readArg('--limit') || 0);

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required to run this backfill');
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
  // Let pg report malformed URLs.
}

const pool = new pg.Pool({
  connectionString: cleanedUrl,
  ssl: false,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type PaymentSupportRecord = {
  path?: unknown;
  url?: unknown;
  comprobantePath?: unknown;
  monto?: unknown;
  metodo?: unknown;
  tipo?: unknown;
  referenciaPago?: unknown;
  referencia?: unknown;
  fechaPago?: unknown;
  fecha?: unknown;
  banco?: unknown;
  observacion?: unknown;
};

type TransferEvent = {
  original: unknown;
  path: string;
  monto: number;
  referenciaPago?: string;
  fechaPago?: string;
  banco?: string;
  observacion?: string;
};

type BreakdownLine = {
  metodo: MetodoPagoBase;
  monto: number;
};

const CLOSED_STATES = new Set<EstadoPagoOrden>([
  EstadoPagoOrden.CONSIGNADO,
  EstadoPagoOrden.CONCILIADO,
]);
const CASH_CONFIRMED_STATES = new Set<EstadoPagoOrden>([
  EstadoPagoOrden.EFECTIVO_DECLARADO,
  EstadoPagoOrden.CONSIGNADO,
  EstadoPagoOrden.CONCILIADO,
]);

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function decodeStoragePath(path: string): string | undefined {
  const cleanPath = path.replace(/^\/+/, '').trim();
  if (!cleanPath) return undefined;

  try {
    return decodeURIComponent(cleanPath);
  } catch {
    return cleanPath;
  }
}

function extractTenaxisStoragePathFromStorageUrl(
  pathname: string,
): string | undefined {
  const cleanPath = pathname.replace(/^\/+/, '');
  const match = cleanPath.match(
    /^storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
  );

  if (!match || match[1] !== 'tenaxis-docs') {
    return undefined;
  }

  return decodeStoragePath(match[2]);
}

function normalizeTenaxisStoragePath(value: unknown): string | undefined {
  const raw = toOptionalString(value);
  if (!raw) return undefined;

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      return extractTenaxisStoragePathFromStorageUrl(url.pathname);
    } catch {
      return undefined;
    }
  }

  const cleanPath = raw.split('?')[0].split('#')[0].replace(/^\/+/, '');
  const storageUrlPath = extractTenaxisStoragePathFromStorageUrl(cleanPath);
  if (storageUrlPath) return storageUrlPath;

  const bucketPrefix = 'tenaxis-docs/';
  const objectPath = cleanPath.startsWith(bucketPrefix)
    ? cleanPath.slice(bucketPrefix.length)
    : cleanPath;

  return decodeStoragePath(objectPath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTransferSupport(value: unknown): boolean {
  if (!isRecord(value)) return true;

  const method = toOptionalString(value.metodo);
  const type = toOptionalString(value.tipo);
  const normalized = (method || type || '').toUpperCase();

  return !normalized || normalized.includes('TRANSFERENCIA');
}

function normalizeTransferEvents(value: Prisma.JsonValue | null): TransferEvent[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const path = isRecord(item)
      ? normalizeTenaxisStoragePath(
          item.path ?? item.comprobantePath ?? item.url,
        )
      : normalizeTenaxisStoragePath(item);

    if (!path || !isTransferSupport(item)) return [];

    const record = isRecord(item) ? (item as PaymentSupportRecord) : {};
    const monto = Number(record.monto ?? 0);

    return [
      {
        original: item,
        path,
        monto: Number.isFinite(monto) && monto > 0 ? monto : 0,
        referenciaPago: toOptionalString(
          record.referenciaPago ?? record.referencia,
        ),
        fechaPago: toOptionalString(record.fechaPago ?? record.fecha),
        banco: toOptionalString(record.banco),
        observacion: toOptionalString(record.observacion),
      },
    ];
  });
}

function mergeDuplicateEvent(
  existing: TransferEvent,
  next: TransferEvent,
): TransferEvent {
  return {
    ...next,
    ...existing,
    path: existing.path,
    monto: existing.monto > 0 ? existing.monto : next.monto,
    referenciaPago: existing.referenciaPago || next.referenciaPago,
    fechaPago: existing.fechaPago || next.fechaPago,
    banco: existing.banco ?? next.banco,
    observacion: existing.observacion ?? next.observacion,
  };
}

function dedupeTransferEvents(events: TransferEvent[]): TransferEvent[] {
  const deduped = new Map<string, TransferEvent>();

  for (const event of events) {
    const existing = deduped.get(event.path);
    deduped.set(event.path, existing ? mergeDuplicateEvent(existing, event) : event);
  }

  return Array.from(deduped.values());
}

function buildStoredSupport(event: TransferEvent): Prisma.InputJsonValue {
  if (isRecord(event.original)) {
    return {
      ...event.original,
      path: event.path,
      monto: event.monto,
      referenciaPago:
        event.referenciaPago ??
        toOptionalString(event.original.referenciaPago ?? event.original.referencia),
      fechaPago:
        event.fechaPago ??
        toOptionalString(event.original.fechaPago ?? event.original.fecha),
      banco: event.banco ?? toOptionalString(event.original.banco),
      observacion: event.observacion ?? toOptionalString(event.original.observacion),
    } as Prisma.InputJsonObject;
  }

  return {
    path: event.path,
    monto: event.monto,
    metodo: MetodoPagoBase.TRANSFERENCIA,
    referenciaPago: event.referenciaPago,
    fechaPago: event.fechaPago,
    banco: event.banco,
    observacion: event.observacion,
  } as Prisma.InputJsonObject;
}

function normalizeBreakdown(value: Prisma.JsonValue | null): BreakdownLine[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];

    const metodo = toOptionalString(item.metodo)?.toUpperCase();
    if (!metodo || !(metodo in MetodoPagoBase)) return [];

    const monto = Number(item.monto ?? 0);
    return [
      {
        metodo: metodo as MetodoPagoBase,
        monto: Number.isFinite(monto) && monto > 0 ? monto : 0,
      },
    ];
  });
}

function sumBreakdown(breakdown: BreakdownLine[], metodo: MetodoPagoBase): number {
  return breakdown
    .filter((line) => line.metodo === metodo)
    .reduce((sum, line) => sum + line.monto, 0);
}

function calculateEstadoPago(params: {
  breakdown: BreakdownLine[];
  valorCotizado: number;
  valorPagado: number;
  valorEfectivo: number;
  valorTransferencia: number;
}): EstadoPagoOrden {
  const { breakdown, valorCotizado, valorPagado, valorEfectivo, valorTransferencia } =
    params;
  const efectivoPlaneado = sumBreakdown(breakdown, MetodoPagoBase.EFECTIVO);
  const valorDescuentos =
    sumBreakdown(breakdown, MetodoPagoBase.BONO) +
    sumBreakdown(breakdown, MetodoPagoBase.CORTESIA);
  const valorCredito = sumBreakdown(breakdown, MetodoPagoBase.CREDITO);
  const totalCubierto = valorPagado + valorDescuentos + valorCredito;
  const hasCredito = valorCredito > 0;
  const hasCortesia = breakdown.some(
    (line) => line.metodo === MetodoPagoBase.CORTESIA,
  );

  if (totalCubierto >= valorCotizado && !hasCredito) {
    if (hasCortesia && valorPagado === 0) {
      return EstadoPagoOrden.CORTESIA;
    }

    if (efectivoPlaneado > 0) {
      return valorEfectivo > 0
        ? EstadoPagoOrden.EFECTIVO_DECLARADO
        : valorTransferencia > 0
          ? EstadoPagoOrden.PARCIAL
          : EstadoPagoOrden.PENDIENTE;
    }

    return valorTransferencia > 0
      ? EstadoPagoOrden.PAGADO
      : EstadoPagoOrden.PENDIENTE;
  }

  return totalCubierto > 0 ? EstadoPagoOrden.PARCIAL : EstadoPagoOrden.PENDIENTE;
}

function almostEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.01;
}

async function main() {
  const where: Prisma.OrdenServicioWhereInput = {
    comprobantePago: {
      not: Prisma.JsonNull,
    },
    ...(tenantArg ? { tenantId: tenantArg } : {}),
    ...(orderArg ? { id: orderArg } : {}),
  };

  const orders = await prisma.ordenServicio.findMany({
    where,
    select: {
      id: true,
      tenantId: true,
      numeroOrden: true,
      valorCotizado: true,
      valorPagado: true,
      estadoPago: true,
      desglosePago: true,
      comprobantePago: true,
      declaracionEfectivo: {
        select: {
          valorDeclarado: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    ...(limitArg > 0 ? { take: limitArg } : {}),
  });

  let duplicatedOrders = 0;
  let valueCandidates = 0;
  let jsonOnlyCandidates = 0;
  let skippedClosed = 0;
  let skippedUnsafeValue = 0;
  let updated = 0;

  for (const order of orders) {
    const transferEvents = normalizeTransferEvents(order.comprobantePago);
    const dedupedEvents = dedupeTransferEvents(transferEvents);
    const duplicateAmountRemoved =
      transferEvents.reduce((sum, event) => sum + event.monto, 0) -
      dedupedEvents.reduce((sum, event) => sum + event.monto, 0);

    if (
      transferEvents.length === dedupedEvents.length ||
      duplicateAmountRemoved <= 0
    ) {
      continue;
    }

    duplicatedOrders += 1;

    if (CLOSED_STATES.has(order.estadoPago) && !includeClosed) {
      skippedClosed += 1;
      continue;
    }

    const currentPaid = Number(order.valorPagado || 0);
    const breakdown = normalizeBreakdown(order.desglosePago);
    const declaredCash = Number(order.declaracionEfectivo?.valorDeclarado || 0);
    const fallbackCash =
      declaredCash > 0
        ? declaredCash
        : CASH_CONFIRMED_STATES.has(order.estadoPago)
          ? sumBreakdown(breakdown, MetodoPagoBase.EFECTIVO)
          : 0;
    const uniqueTransferTotal = dedupedEvents.reduce(
      (sum, event) => sum + event.monto,
      0,
    );
    const expectedPaid = uniqueTransferTotal + fallbackCash;
    const canSafelyUpdateValue =
      currentPaid > expectedPaid &&
      almostEqual(currentPaid - expectedPaid, duplicateAmountRemoved);
    const nextEstadoPago = calculateEstadoPago({
      breakdown,
      valorCotizado: Number(order.valorCotizado || 0),
      valorPagado: canSafelyUpdateValue ? expectedPaid : currentPaid,
      valorEfectivo: fallbackCash,
      valorTransferencia: uniqueTransferTotal,
    });

    if (canSafelyUpdateValue) {
      valueCandidates += 1;
    } else {
      jsonOnlyCandidates += 1;
      skippedUnsafeValue += currentPaid > expectedPaid ? 1 : 0;
    }

    if (verbose || !shouldApply) {
      console.log(
        [
          `Orden ${order.numeroOrden || order.id}`,
          `estado=${order.estadoPago}`,
          `actual=${currentPaid}`,
          `esperado=${expectedPaid}`,
          `duplicado=${duplicateAmountRemoved}`,
          canSafelyUpdateValue ? `nuevoEstado=${nextEstadoPago}` : 'JSON_ONLY',
        ].join(' | '),
      );
    }

    if (!shouldApply) continue;

    await prisma.ordenServicio.update({
      where: {
        id: order.id,
      },
      data: {
        comprobantePago: dedupedEvents.map(buildStoredSupport),
        ...(canSafelyUpdateValue
          ? {
              valorPagado: expectedPaid,
              estadoPago: nextEstadoPago,
            }
          : {}),
      },
    });

    updated += 1;
  }

  console.log('');
  console.log('Backfill pagos por transferencia duplicados');
  console.log(`Modo: ${shouldApply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Órdenes revisadas: ${orders.length}`);
  console.log(`Órdenes con soportes duplicados: ${duplicatedOrders}`);
  console.log(`Candidatas a corregir valorPagado: ${valueCandidates}`);
  console.log(`Candidatas solo a limpiar JSON: ${jsonOnlyCandidates}`);
  console.log(`Omitidas por estado cerrado: ${skippedClosed}`);
  console.log(`Valores omitidos por seguridad: ${skippedUnsafeValue}`);
  console.log(`Órdenes actualizadas: ${updated}`);
  console.log('');
  console.log(
    shouldApply
      ? 'Aplicado. Revisá el resumen antes de cerrar el incidente.'
      : 'Dry-run listo. Para escribir cambios ejecutá el mismo comando con --apply.',
  );
}

main()
  .catch((error) => {
    console.error('Error ejecutando el backfill:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
