import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/client/client';
import {
  endOfBogotaDayUtc,
  endOfBogotaMonthUtc,
  endOfPreviousBogotaMonthUtc,
  getBogotaWeekday,
  startOfBogotaDayUtc,
  startOfBogotaMonthUtc,
  startOfBogotaWeekUtc,
  startOfPreviousBogotaMonthUtc,
  addBogotaDaysUtc,
} from '../common/utils/timezone.util';

const DASHBOARD_KPI_CUTOFF_UTC = new Date('2026-01-01T05:00:00.000Z');

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(tenantId?: string, empresaId?: string) {
    const now = new Date();

    // Dates for current period
    const startOfMonth = startOfBogotaMonthUtc(now);
    const endOfMonth = endOfBogotaMonthUtc(now);

    // Dates for previous period (for comparisons)
    const startOfPrevMonth = startOfPreviousBogotaMonthUtc(now);
    const endOfPrevMonth = endOfPreviousBogotaMonthUtc(now);
    const startOfToday = startOfBogotaDayUtc(now);
    const endOfToday = endOfBogotaDayUtc(now);

    const commonWhere: Prisma.OrdenServicioWhereInput = {
      ...(tenantId ? { tenantId } : {}),
      ...(empresaId && { empresaId }),
      AND: [
        {
          OR: [
            { fechaVisita: { gte: DASHBOARD_KPI_CUTOFF_UTC } },
            { createdAt: { gte: DASHBOARD_KPI_CUTOFF_UTC } },
          ],
        },
      ],
    };

    const [
      ingresosActual,
      ingresosPrev,
      ordenesActivas,
      ordenesPrev,
      cobranzaPendiente,
      totalMes,
      aTiempoMes,
      sinAsignacion,
      tareasVencidas,
      alertasCriticas,
      ingresosSemanales,
      serviciosAgendadosHoy,
      enProcesoHoy,
      realizadosHoy,
      ingresosHoy,
      pendientesLiquidarHoy,
      canceladosHoy,
      sinCobrarHoy,
      enProcesoTotal,
      pendientesLiquidarTotal,
      realizadosTotal,
      serviciosTotales,
      ingresosTotales,
      sinCobrarTotales,
      canceladosTotales,
    ] = await Promise.all([
      // 1. Ingresos Mes Actual
      this.prisma.ordenServicio.aggregate({
        where: {
          ...commonWhere,
          estadoServicio: 'LIQUIDADO',
          fechaVisita: { gte: startOfMonth, lte: endOfMonth },
          OR: [
            { estadoPago: { in: ['PAGADO', 'CONCILIADO'] } },
            { valorPagado: { gt: 0 } },
          ],
        },
        _sum: { valorPagado: true },
      }),
      // 2. Ingresos Mes Anterior
      this.prisma.ordenServicio.aggregate({
        where: {
          ...commonWhere,
          estadoServicio: 'LIQUIDADO',
          fechaVisita: { gte: startOfPrevMonth, lte: endOfPrevMonth },
          OR: [
            { estadoPago: { in: ['PAGADO', 'CONCILIADO'] } },
            { valorPagado: { gt: 0 } },
          ],
        },
        _sum: { valorPagado: true },
      }),
      // 3. Ordenes Activas Actual (Created this month)
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      // 4. Ordenes Activas Anterior
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth },
        },
      }),
      // 5. Cobranza (Pending payments)
      this.prisma.ordenServicio.aggregate({
        where: {
          ...commonWhere,
          estadoPago: 'PENDIENTE',
          estadoServicio: { in: ['LIQUIDADO', 'TECNICO_FINALIZO'] },
        },
        _sum: { valorCotizado: true },
      }),
      // 6. SLA - Total completed this month
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfMonth, lte: endOfMonth },
          estadoServicio: { in: ['LIQUIDADO', 'TECNICO_FINALIZO'] },
        },
      }),
      // 7. SLA - Completed on time (not rescheduled or completed same day as visita)
      // Logic: For now, simplified as count of non-cancelled/non-reprogrammed completed ones
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfMonth, lte: endOfMonth },
          estadoServicio: 'LIQUIDADO',
          urgencia: { not: 'CRITICA' },
        },
      }),
      // 8. Sin Asignación
      this.prisma.ordenServicio.count({
        where: { ...commonWhere, tecnicoId: null, estadoServicio: 'NUEVO' },
      }),
      // 9. Tareas Vencidas (Visita in past, not completed)
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { lt: startOfToday },
          estadoServicio: {
            notIn: ['LIQUIDADO', 'TECNICO_FINALIZO', 'CANCELADO'],
          },
        },
      }),
      // 10. Alertas Críticas
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          urgencia: 'CRITICA',
          estadoServicio: { notIn: ['LIQUIDADO', 'CANCELADO'] },
        },
      }),
      // 11. Weekly Trend
      this.getWeeklyIncome(tenantId, empresaId),
      // 12. Servicios agendados hoy
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfToday, lte: endOfToday },
        },
      }),
      // 13. En proceso hoy
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: 'PROCESO',
        },
      }),
      // 14. Realizados hoy
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: 'LIQUIDADO',
        },
      }),
      // 15. Ingresos hoy
      this.prisma.ordenServicio.aggregate({
        where: {
          ...commonWhere,
          estadoServicio: 'LIQUIDADO',
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoPago: { in: ['PAGADO', 'CONCILIADO'] },
        },
        _sum: { valorPagado: true, valorCotizado: true },
      }),
      // 16. Pendientes por liquidar hoy
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: 'TECNICO_FINALIZO',
        },
      }),
      // 17. Cancelados hoy
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoServicio: 'CANCELADO',
        },
      }),
      // 18. Sin cobrar hoy
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          fechaVisita: { gte: startOfToday, lte: endOfToday },
          estadoPago: 'PENDIENTE',
          estadoServicio: { in: ['LIQUIDADO', 'TECNICO_FINALIZO'] },
        },
      }),
      // 19. En proceso (total)
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          estadoServicio: 'PROCESO',
        },
      }),
      // 20. Pendientes liquidar (total)
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          estadoServicio: 'TECNICO_FINALIZO',
        },
      }),
      // 21. Realizados histórico
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          estadoServicio: 'LIQUIDADO',
        },
      }),
      // 22. Servicios totales
      this.prisma.ordenServicio.count({
        where: commonWhere,
      }),
      // 23. Ingresos totales
      this.prisma.ordenServicio.aggregate({
        where: {
          ...commonWhere,
          estadoServicio: 'LIQUIDADO',
          estadoPago: { in: ['PAGADO', 'CONCILIADO'] },
        },
        _sum: { valorPagado: true, valorCotizado: true },
      }),
      // 24. Sin cobrar totales
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          estadoPago: 'PENDIENTE',
          estadoServicio: { in: ['LIQUIDADO', 'TECNICO_FINALIZO'] },
        },
      }),
      // 25. Cancelados totales
      this.prisma.ordenServicio.count({
        where: {
          ...commonWhere,
          estadoServicio: 'CANCELADO',
        },
      }),
    ]);

    const valActual = Number(ingresosActual._sum?.valorPagado || 0);
    const valPrev = Number(ingresosPrev._sum?.valorPagado || 0);
    const changeIngresos =
      valPrev > 0 ? ((valActual - valPrev) / valPrev) * 100 : 0;
    const changeOrdenes =
      ordenesPrev > 0
        ? ((ordenesActivas - ordenesPrev) / ordenesPrev) * 100
        : 0;

    const sla = totalMes > 0 ? Math.round((aTiempoMes / totalMes) * 100) : 100;
    const ingresosHoyValue = Number(ingresosHoy._sum?.valorPagado || 0);
    const ingresosTotalesValue = Number(ingresosTotales._sum?.valorPagado || 0);
    const tasaCancelacionHoy =
      serviciosAgendadosHoy > 0
        ? (canceladosHoy / serviciosAgendadosHoy) * 100
        : 0;
    const tasaCancelacionTotal =
      serviciosTotales > 0 ? (canceladosTotales / serviciosTotales) * 100 : 0;

    return {
      kpis: {
        ingresos: {
          current: valActual,
          previous: valPrev,
          change: Math.round(changeIngresos),
        },
        ordenes: {
          current: ordenesActivas,
          previous: ordenesPrev,
          change: Math.round(changeOrdenes),
        },
        sla: { value: sla },
        cobranza: { total: Number(cobranzaPendiente._sum?.valorCotizado || 0) },
      },
      trends: {
        ingresosSemanales: ingresosSemanales,
        monthlyComparison: [
          { label: 'Anterior', value: valPrev },
          { label: 'Actual', value: valActual },
        ],
      },
      actionable: {
        vencidas: tareasVencidas,
        sinAsignacion: sinAsignacion,
        alertas: alertasCriticas,
      },
      overview: {
        today: {
          serviciosAgendados: serviciosAgendadosHoy,
          enProceso: enProcesoHoy,
          realizados: realizadosHoy,
          ingresos: ingresosHoyValue,
          pendientesLiquidar: pendientesLiquidarHoy,
          cancelados: canceladosHoy,
          tasaCancelacion: Number(tasaCancelacionHoy.toFixed(1)),
          sinCobrar: sinCobrarHoy,
        },
        global: {
          enProceso: enProcesoTotal,
          pendientesLiquidar: pendientesLiquidarTotal,
          realizadosHistorico: realizadosTotal,
          serviciosTotales: serviciosTotales,
          ingresosTotales: ingresosTotalesValue,
          sinCobrarTotales: sinCobrarTotales,
          cancelados: canceladosTotales,
          tasaCancelacion: Number(tasaCancelacionTotal.toFixed(1)),
        },
      },
    };
  }

  private async getWeeklyIncome(
    tenantId?: string,
    empresaId?: string,
  ): Promise<number[]> {
    const currNow = new Date();
    const startOfWeek = startOfBogotaWeekUtc(currNow);
    const endOfWeek = addBogotaDaysUtc(startOfWeek, 7);

    const ordenesSemana = await this.prisma.ordenServicio.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(empresaId && { empresaId }),
        estadoServicio: 'LIQUIDADO',
        fechaVisita: { gte: startOfWeek, lt: endOfWeek },
        estadoPago: { in: ['PAGADO', 'CONCILIADO'] },
      },
      select: { fechaVisita: true, valorPagado: true, valorCotizado: true },
    });

    const weeklyStats = [0, 0, 0, 0, 0, 0, 0];
    ordenesSemana.forEach((o) => {
      if (o.fechaVisita) {
        const day = getBogotaWeekday(o.fechaVisita);
        const index = day === 0 ? 6 : day - 1;
        const valor = Number(o.valorPagado) || Number(o.valorCotizado) || 0;
        weeklyStats[index] += valor;
      }
    });
    return weeklyStats;
  }
}
