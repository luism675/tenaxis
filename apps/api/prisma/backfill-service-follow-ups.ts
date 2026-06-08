import {
  EstadoOrden,
  PrismaClient,
  TipoFacturacion,
  TipoVisita,
} from '../src/generated/client/client';
import {
  addBogotaDaysUtc,
  startOfBogotaDayUtc,
} from '../src/common/utils/timezone.util';

const prisma = new PrismaClient({} as any);
const shouldApply = process.argv.includes('--apply');

type FollowUpBlueprint = {
  followUpType: 'INICIAL' | 'TRES_MESES';
  dueAt: Date;
  observacion: string;
};

function buildBlueprints(order: {
  fechaVisita: Date | null;
  createdAt: Date;
  servicio: {
    primerSeguimientoDias: number | null;
    requiereSeguimientoTresMeses: boolean;
  };
}): FollowUpBlueprint[] {
  const baseDate = startOfBogotaDayUtc(order.fechaVisita || order.createdAt);
  const blueprints: FollowUpBlueprint[] = [];

  if (order.servicio.primerSeguimientoDias) {
    blueprints.push({
      followUpType: 'INICIAL',
      dueAt: addBogotaDaysUtc(baseDate, order.servicio.primerSeguimientoDias),
      observacion: `Seguimiento automático inicial programado a ${order.servicio.primerSeguimientoDias} días.`,
    });
  }

  if (order.servicio.requiereSeguimientoTresMeses) {
    const threeMonthsLater = new Date(baseDate);
    threeMonthsLater.setUTCMonth(threeMonthsLater.getUTCMonth() + 3);

    blueprints.push({
      followUpType: 'TRES_MESES',
      dueAt: threeMonthsLater,
      observacion: 'Seguimiento automático programado a 3 meses.',
    });
  }

  return blueprints;
}

async function main() {
  const eligibleOrders = await prisma.ordenServicio.findMany({
    where: {
      ordenPadreId: null,
      creadoPorId: { not: null },
      OR: [
        { tipoFacturacion: null },
        { tipoFacturacion: TipoFacturacion.UNICO },
      ],
      servicio: {
        requiereSeguimiento: true,
      },
    },
    include: {
      servicio: true,
      ordenesHijas: {
        where: {
          tipoVisita: TipoVisita.CITA_VERIFICACION,
        },
        include: {
          seguimientos: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  let missingChildren = 0;
  let missingTrackingRows = 0;
  let createdChildren = 0;
  let createdTrackingRows = 0;

  for (const order of eligibleOrders) {
    if (!order.creadoPorId) continue;

    const blueprints = buildBlueprints(order);
    if (!blueprints.length) continue;

    for (const blueprint of blueprints) {
      const childWithTracking = order.ordenesHijas.find((child) =>
        child.seguimientos.some(
          (followUp) => followUp.followUpType === blueprint.followUpType,
        ),
      );

      if (childWithTracking) {
        continue;
      }

      const existingChild = order.ordenesHijas.find((child) => {
        const childDate = child.fechaVisita
          ? startOfBogotaDayUtc(child.fechaVisita).getTime()
          : null;
        return childDate === startOfBogotaDayUtc(blueprint.dueAt).getTime();
      });

      if (!existingChild) {
        missingChildren += 1;
      } else if (!existingChild.seguimientos.length) {
        missingTrackingRows += 1;
      }

      if (!shouldApply) {
        continue;
      }

      let childOrderId = existingChild?.id;

      if (!childOrderId) {
        const createdChild = await prisma.ordenServicio.create({
          data: {
            tenantId: order.tenantId,
            empresaId: order.empresaId,
            clienteId: order.clienteId,
            servicioId: order.servicioId,
            creadoPorId: order.creadoPorId,
            direccionId: order.direccionId,
            direccionTexto: order.direccionTexto,
            estadoServicio: EstadoOrden.NUEVO,
            observacion: blueprint.observacion,
            nivelInfestacion: order.nivelInfestacion || undefined,
            urgencia: order.urgencia || undefined,
            tipoVisita: TipoVisita.CITA_VERIFICACION,
            tipoFacturacion: TipoFacturacion.UNICO,
            fechaVisita: blueprint.dueAt,
            ordenPadreId: order.id,
          },
        });

        childOrderId = createdChild.id;
        createdChildren += 1;
      }

      const existingTracking = await prisma.ordenServicioSeguimiento.findFirst({
        where: {
          ordenServicioId: childOrderId,
          followUpType: blueprint.followUpType,
        },
      });

      if (!existingTracking) {
        await prisma.ordenServicioSeguimiento.create({
          data: {
            tenantId: order.tenantId,
            empresaId: order.empresaId,
            ordenServicioId: childOrderId,
            createdByMembershipId: order.creadoPorId,
            followUpType: blueprint.followUpType,
            dueAt: blueprint.dueAt,
            status: 'PENDIENTE',
          },
        });

        createdTrackingRows += 1;
      }
    }
  }

  console.log('');
  console.log('Backfill de seguimientos de servicio');
  console.log(`Modo: ${shouldApply ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Ordenes elegibles revisadas: ${eligibleOrders.length}`);
  console.log(`Hijos faltantes detectados: ${missingChildren}`);
  console.log(`Registros de seguimiento faltantes detectados: ${missingTrackingRows}`);
  console.log(`Hijos creados: ${createdChildren}`);
  console.log(`Registros de seguimiento creados: ${createdTrackingRows}`);
}

main()
  .catch((error) => {
    console.error('Error ejecutando el backfill:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
