import { FinanzasController } from './contabilidad.controller';
import { RegistrarConsignacionDto } from './registrar-consignacion.dto';
import { SendLiquidationReminderDto } from './send-liquidation-reminder.dto';
import type { ContabilidadService } from './contabilidad.service';

type ContabilidadServiceMock = Pick<
  ContabilidadService,
  'registrarConsignacion'
> & {
  registrarConsignacion: jest.MockedFunction<
    ContabilidadService['registrarConsignacion']
  >;
};

describe('FinanzasController - registrar consignación JSON', () => {
  it('reenvía ordenIds como array real y comprobantePath al service', async () => {
    const contabilidadService: ContabilidadServiceMock = {
      registrarConsignacion: jest
        .fn<
          ReturnType<ContabilidadService['registrarConsignacion']>,
          Parameters<ContabilidadService['registrarConsignacion']>
        >()
        .mockResolvedValue({ id: 'cons-1' } as Awaited<
          ReturnType<ContabilidadService['registrarConsignacion']>
        >),
    };

    const controller = new FinanzasController(
      contabilidadService as unknown as ContabilidadService,
    );

    const req = {
      user: {
        tenantId: 'tenant-1',
        membershipId: 'membership-1',
        role: 'ADMIN',
      },
    } as unknown as Parameters<FinanzasController['register']>[0];

    const dto: RegistrarConsignacionDto = {
      tecnicoId: '01906f58-8c7d-75a4-a685-3c3da2c46801',
      empresaId: '01906f58-8c7d-75a4-a685-3c3da2c46802',
      valorConsignado: 60000,
      valorEntregado: 50000,
      valorAdelanto: 10000,
      referenciaBanco: 'REF-JSON-001',
      comprobantePath: 'consignaciones/soporte-json.jpg',
      confirmarEfectivoFisico: true,
      ordenIds: [
        '01906f58-8c7d-75a4-a685-3c3da2c46803',
        '01906f58-8c7d-75a4-a685-3c3da2c46804',
      ],
      fechaConsignacion: '2026-03-26',
      observacion: 'Cierre mixto con payload JSON',
    };

    await controller.register(req, dto);

    expect(contabilidadService.registrarConsignacion).toHaveBeenCalledWith(
      'tenant-1',
      'membership-1',
      {
        tecnicoId: dto.tecnicoId,
        empresaId: dto.empresaId,
        valorConsignado: dto.valorConsignado,
        valorEntregado: dto.valorEntregado,
        valorAdelanto: dto.valorAdelanto,
        referenciaBanco: dto.referenciaBanco,
        comprobantePath: dto.comprobantePath,
        confirmarEfectivoFisico: dto.confirmarEfectivoFisico,
        ordenIds: dto.ordenIds,
        fechaConsignacion: dto.fechaConsignacion,
        observacion: dto.observacion,
      },
    );
  });
});

describe('FinanzasController - recordatorio manual de liquidación', () => {
  it('reenvía membershipId y empresa scope al service', async () => {
    const contabilidadService = {
      sendManualCashCollectionReminder: jest
        .fn<
          ReturnType<ContabilidadService['sendManualCashCollectionReminder']>,
          Parameters<ContabilidadService['sendManualCashCollectionReminder']>
        >()
        .mockResolvedValue({
          success: true,
          membershipId: 'membership-operator-1',
          saldoPendiente: 150000,
          ordenesPendientesCount: 3,
          message: 'Recordatorio enviado a Operador Demo.',
        } as Awaited<
          ReturnType<ContabilidadService['sendManualCashCollectionReminder']>
        >),
    };

    const controller = new FinanzasController(
      contabilidadService as unknown as ContabilidadService,
    );

    const req = {
      user: {
        tenantId: 'tenant-1',
        role: 'ADMIN',
      },
    } as unknown as Parameters<
      FinanzasController['sendLiquidationReminder']
    >[0];

    const dto: SendLiquidationReminderDto = {
      empresaId: '01906f58-8c7d-75a4-a685-3c3da2c46802',
    };

    await controller.sendLiquidationReminder(req, 'membership-operator-1', dto);

    expect(
      contabilidadService.sendManualCashCollectionReminder,
    ).toHaveBeenCalledWith('tenant-1', 'membership-operator-1', dto.empresaId);
  });
});
