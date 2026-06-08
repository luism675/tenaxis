/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  function buildService() {
    const prismaMock = {
      ordenServicio: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    } as unknown as PrismaService;

    return {
      service: new DashboardService(prismaMock),
      prismaMock: prismaMock as unknown as {
        ordenServicio: {
          aggregate: jest.Mock;
          count: jest.Mock;
          findMany: jest.Mock;
        };
      },
    };
  }

  it('returns kpis/actionable/trends/overview with expected calculations', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.aggregate
      .mockResolvedValueOnce({ _sum: { valorPagado: 1000, valorCotizado: 0 } })
      .mockResolvedValueOnce({ _sum: { valorPagado: 500, valorCotizado: 0 } })
      .mockResolvedValueOnce({ _sum: { valorCotizado: 300 } })
      .mockResolvedValueOnce({ _sum: { valorPagado: 200, valorCotizado: 0 } })
      .mockResolvedValueOnce({ _sum: { valorPagado: 5000, valorCotizado: 0 } });

    prismaMock.ordenServicio.count
      .mockResolvedValueOnce(10) // ordenesActivas
      .mockResolvedValueOnce(8) // ordenesPrev
      .mockResolvedValueOnce(20) // totalMes
      .mockResolvedValueOnce(15) // aTiempoMes
      .mockResolvedValueOnce(3) // sinAsignacion
      .mockResolvedValueOnce(4) // tareasVencidas
      .mockResolvedValueOnce(2) // alertasCriticas
      .mockResolvedValueOnce(10) // serviciosAgendadosHoy
      .mockResolvedValueOnce(5) // enProcesoHoy
      .mockResolvedValueOnce(6) // realizadosHoy
      .mockResolvedValueOnce(3) // pendientesLiquidarHoy
      .mockResolvedValueOnce(2) // canceladosHoy
      .mockResolvedValueOnce(7) // sinCobrarHoy
      .mockResolvedValueOnce(12) // enProcesoTotal
      .mockResolvedValueOnce(9) // pendientesLiquidarTotal
      .mockResolvedValueOnce(25) // realizadosTotal
      .mockResolvedValueOnce(50) // serviciosTotales
      .mockResolvedValueOnce(18) // sinCobrarTotales
      .mockResolvedValueOnce(5); // canceladosTotales

    prismaMock.ordenServicio.findMany.mockResolvedValue([]);

    const stats = await service.getStats('tenant-1', 'empresa-1');

    expect(stats.kpis.ingresos).toEqual({
      current: 1000,
      previous: 500,
      change: 100,
    });
    expect(stats.kpis.ordenes).toEqual({
      current: 10,
      previous: 8,
      change: 25,
    });
    expect(stats.kpis.sla).toEqual({ value: 75 });
    expect(stats.kpis.cobranza).toEqual({ total: 300 });

    expect(stats.actionable).toEqual({
      vencidas: 4,
      sinAsignacion: 3,
      alertas: 2,
    });
    expect(stats.trends.monthlyComparison).toEqual([
      { label: 'Anterior', value: 500 },
      { label: 'Actual', value: 1000 },
    ]);

    expect(stats.overview.today).toEqual({
      serviciosAgendados: 10,
      enProceso: 5,
      realizados: 6,
      ingresos: 200,
      pendientesLiquidar: 3,
      cancelados: 2,
      tasaCancelacion: 20,
      sinCobrar: 7,
    });

    expect(stats.overview.global).toEqual({
      enProceso: 12,
      pendientesLiquidar: 9,
      realizadosHistorico: 25,
      serviciosTotales: 50,
      ingresosTotales: 5000,
      sinCobrarTotales: 18,
      cancelados: 5,
      tasaCancelacion: 10,
    });

    expect(prismaMock.ordenServicio.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          empresaId: 'empresa-1',
        }),
      }),
    );

    expect(prismaMock.ordenServicio.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant-1',
          empresaId: 'empresa-1',
        }),
      }),
    );
  });

  it('returns zero cancellation rates when denominator is zero', async () => {
    const { service, prismaMock } = buildService();

    prismaMock.ordenServicio.aggregate
      .mockResolvedValueOnce({ _sum: { valorPagado: 0, valorCotizado: 0 } })
      .mockResolvedValueOnce({ _sum: { valorPagado: 0, valorCotizado: 0 } })
      .mockResolvedValueOnce({ _sum: { valorCotizado: 0 } })
      .mockResolvedValueOnce({ _sum: { valorPagado: 0, valorCotizado: 0 } })
      .mockResolvedValueOnce({ _sum: { valorPagado: 0, valorCotizado: 0 } });

    prismaMock.ordenServicio.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0) // serviciosAgendadosHoy
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2) // canceladosHoy
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0) // serviciosTotales
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(3); // canceladosTotales

    prismaMock.ordenServicio.findMany.mockResolvedValue([]);

    const stats = await service.getStats('tenant-1');

    expect(stats.overview.today.tasaCancelacion).toBe(0);
    expect(stats.overview.global.tasaCancelacion).toBe(0);
  });
});
